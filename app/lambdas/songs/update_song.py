import os
import json
import boto3
import base64
from botocore.exceptions import ClientError
from utils import (
    generate_response,
    validate_required_fields,
    upload_to_s3,
    is_admin,
    parse_body,
    get_current_timestamp,
    get_path_parameter
)
from models import Song, extract_file_metadata

# Environment variables
TABLE_NAME = os.environ.get('TABLE_NAME')
BUCKET_NAME = os.environ.get('BUCKET_NAME')

# AWS clients
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(TABLE_NAME)
s3_client = boto3.client('s3')


def lambda_handler(event, context):
    """
    Update an existing song's metadata (Admin only).

    PUT /songs/{id}
    Body: {title (optional), artistIds (optional), genres (optional),
           albumId (optional), featuringArtists (optional),
           coverImageBase64 (optional)}
    """
    print(f"Received event: {json.dumps(event)}")

    try:
        # Check authorization - Admin only
        if not is_admin(event):
            return generate_response(403, {
                'error': 'Forbidden',
                'message': 'Only administrators can update songs'
            })

        # Get song ID from path parameters
        song_id = get_path_parameter(event, 'id')

        if not song_id:
            return generate_response(400, {
                'error': 'Bad Request',
                'message': 'Song ID is required'
            })

        # Parse request body
        try:
            body = parse_body(event)
        except ValueError as e:
            return generate_response(400, {
                'error': 'Bad Request',
                'message': str(e)
            })

        # Verify song exists
        pk = f"SONG#{song_id}"
        sk = "METADATA"

        try:
            response = table.get_item(
                Key={
                    'PK': pk,
                    'SK': sk
                }
            )
        except ClientError as e:
            print(f"DynamoDB error: {str(e)}")
            return generate_response(500, {
                'error': 'Internal Server Error',
                'message': 'Database query failed'
            })

        if 'Item' not in response:
            return generate_response(404, {
                'error': 'Not Found',
                'message': f'Song with ID {song_id} not found'
            })

        # Get existing song data
        existing_item = response['Item']
        existing_song = Song.from_dynamodb_item(existing_item)

        # Prepare update attributes
        update_expression_parts = []
        expression_attribute_values = {}
        expression_attribute_names = {}

        # Update title
        if 'title' in body:
            update_expression_parts.append('#title = :title')
            expression_attribute_names['#title'] = 'title'
            expression_attribute_values[':title'] = body['title']

        # Update artistIds
        if 'artistIds' in body:
            if not isinstance(body['artistIds'], list) or len(body['artistIds']) == 0:
                return generate_response(400, {
                    'error': 'Bad Request',
                    'message': 'artistIds must be a non-empty list'
                })
            update_expression_parts.append('artistIds = :artistIds')
            expression_attribute_values[':artistIds'] = body['artistIds']

        # Update genres
        if 'genres' in body:
            if not isinstance(body['genres'], list) or len(body['genres']) == 0:
                return generate_response(400, {
                    'error': 'Bad Request',
                    'message': 'genres must be a non-empty list'
                })
            update_expression_parts.append('genres = :genres')
            expression_attribute_values[':genres'] = body['genres']

        # Update albumId
        if 'albumId' in body:
            if body['albumId']:  # If not null/empty
                update_expression_parts.append('albumId = :albumId')
                expression_attribute_values[':albumId'] = body['albumId']
            else:
                # Remove albumId
                update_expression_parts.append('REMOVE albumId')

        # Update featuringArtists
        if 'featuringArtists' in body:
            if body['featuringArtists'] and isinstance(body['featuringArtists'], list):
                update_expression_parts.append('featuringArtists = :featuringArtists')
                expression_attribute_values[':featuringArtists'] = body['featuringArtists']
            else:
                update_expression_parts.append('featuringArtists = :featuringArtists')
                expression_attribute_values[':featuringArtists'] = []

        # Update cover image if provided
        if 'coverImageBase64' in body and body['coverImageBase64']:
            try:
                # Decode base64 image
                cover_data = base64.b64decode(body['coverImageBase64'])

                # Delete old cover if exists
                if hasattr(existing_song, 'cover_url') and existing_song.cover_url:
                    old_cover_key = existing_song.cover_url.replace(f's3://{BUCKET_NAME}/', '')
                    try:
                        s3_client.delete_object(Bucket=BUCKET_NAME, Key=old_cover_key)
                        print(f"Deleted old cover: {old_cover_key}")
                    except Exception as e:
                        print(f"Failed to delete old cover: {str(e)}")

                # Upload new cover
                cover_key = f"covers/{song_id}.jpg"
                cover_url = upload_to_s3(
                    data=cover_data,
                    bucket=BUCKET_NAME,
                    key=cover_key,
                    content_type='image/jpeg'
                )

                update_expression_parts.append('coverUrl = :coverUrl')
                expression_attribute_values[':coverUrl'] = cover_url
                print(f"Uploaded new cover: {cover_key}")

            except Exception as e:
                print(f"Error uploading cover: {str(e)}")
                return generate_response(400, {
                    'error': 'Bad Request',
                    'message': f'Invalid cover image: {str(e)}'
                })

        # Always update updatedAt timestamp
        update_expression_parts.append('updatedAt = :updatedAt')
        expression_attribute_values[':updatedAt'] = get_current_timestamp()

        # Build update expression
        if not update_expression_parts:
            return generate_response(400, {
                'error': 'Bad Request',
                'message': 'No fields to update'
            })

        update_expression = 'SET ' + ', '.join([part for part in update_expression_parts if not part.startswith('REMOVE')])
        if any(part.startswith('REMOVE') for part in update_expression_parts):
            remove_parts = [part.replace('REMOVE ', '') for part in update_expression_parts if part.startswith('REMOVE')]
            update_expression += ' REMOVE ' + ', '.join(remove_parts)

        # Update DynamoDB
        try:
            update_params = {
                'Key': {
                    'PK': pk,
                    'SK': sk
                },
                'UpdateExpression': update_expression,
                'ExpressionAttributeValues': expression_attribute_values,
                'ReturnValues': 'ALL_NEW'
            }

            if expression_attribute_names:
                update_params['ExpressionAttributeNames'] = expression_attribute_names

            response = table.update_item(**update_params)

            updated_item = response['Attributes']
            updated_song = Song.from_dynamodb_item(updated_item)

            print(f"Successfully updated song: {song_id}")

            return generate_response(200, {
                'message': 'Song updated successfully',
                'song': updated_song.to_dict()
            })

        except ClientError as e:
            print(f"DynamoDB update error: {str(e)}")
            return generate_response(500, {
                'error': 'Internal Server Error',
                'message': 'Failed to update song in database'
            })

    except Exception as e:
        print(f"Error updating song: {str(e)}")
        return generate_response(500, {
            'error': 'Internal Server Error',
            'message': str(e)
        })
