import os
import json
import uuid
import boto3
from botocore.exceptions import ClientError
from utils import (
    generate_response,
    validate_required_fields,
    upload_to_s3,
    is_admin,
    parse_body,
    get_current_timestamp
)
from models import Album

# Environment variables
TABLE_NAME = os.environ.get('TABLE_NAME')
BUCKET_NAME = os.environ.get('BUCKET_NAME')

# AWS clients
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(TABLE_NAME)


def lambda_handler(event, context):
    """
    Create a new album (Admin only).

    POST /albums
    Body: {title, artistIds, releaseDate, genres, coverImageBase64 (optional)}
    """
    print(f"Received event: {json.dumps(event)}")

    try:
        # Check authorization - Admin only
        if not is_admin(event):
            return generate_response(403, {
                'error': 'Forbidden',
                'message': 'Only administrators can create albums'
            })

        # Parse request body
        try:
            body = parse_body(event)
        except ValueError as e:
            return generate_response(400, {
                'error': 'Bad Request',
                'message': str(e)
            })

        # Validate required fields
        required_fields = ['title', 'artistIds', 'releaseDate', 'genres']
        validation_error = validate_required_fields(body, required_fields)

        if validation_error:
            return generate_response(400, {
                'error': 'Bad Request',
                'message': validation_error
            })

        # Extract fields
        title = body['title'].strip()
        artist_ids = body['artistIds']
        release_date = body['releaseDate']
        genres = body['genres']
        cover_image_base64 = body.get('coverImageBase64')

        # Additional validation
        if not isinstance(artist_ids, list) or len(artist_ids) == 0:
            return generate_response(400, {
                'error': 'Bad Request',
                'message': 'artistIds must be a non-empty array'
            })

        if not isinstance(genres, list) or len(genres) == 0:
            return generate_response(400, {
                'error': 'Bad Request',
                'message': 'genres must be a non-empty array'
            })

        # Validate that all artists exist
        for artist_id in artist_ids:
            try:
                response = table.get_item(
                    Key={
                        'PK': f"ARTIST#{artist_id}",
                        'SK': 'METADATA'
                    }
                )
                if 'Item' not in response:
                    return generate_response(400, {
                        'error': 'Bad Request',
                        'message': f'Artist with ID {artist_id} does not exist'
                    })
            except ClientError as e:
                print(f"Error validating artist {artist_id}: {str(e)}")
                return generate_response(500, {
                    'error': 'Internal Server Error',
                    'message': 'Failed to validate artist IDs'
                })

        # Generate unique album ID
        album_id = str(uuid.uuid4())

        # Upload cover image if provided
        cover_url = None
        if cover_image_base64:
            try:
                cover_key = f"albums/{album_id}.jpg"
                cover_url = upload_to_s3(
                    bucket=BUCKET_NAME,
                    key=cover_key,
                    file_data=cover_image_base64,
                    content_type='image/jpeg'
                )
                print(f"Uploaded album cover to: {cover_url}")
            except Exception as e:
                print(f"Failed to upload cover image: {str(e)}")
                return generate_response(500, {
                    'error': 'Internal Server Error',
                    'message': f'Failed to upload cover image: {str(e)}'
                })

        # Create album object
        album = Album(
            album_id=album_id,
            title=title,
            artist_ids=artist_ids,
            release_date=release_date,
            genres=genres,
            cover_url=cover_url
        )

        # Save main metadata to DynamoDB
        main_item = album.to_dynamodb_item()
        table.put_item(Item=main_item)
        print(f"Saved album metadata: {album_id}")

        # Create GSI items for each genre
        for genre in genres:
            genre_item = {
                'PK': f"ALBUM#{album_id}",
                'SK': f"GENRE#{genre}",
                'GSI1PK': f"GENRE#{genre}",
                'GSI1SK': f"ALBUM#{album_id}",
                'albumId': album_id,
                'title': title,
                'artistIds': artist_ids
            }
            table.put_item(Item=genre_item)
            print(f"Created genre index for: {genre}")

        # Return success response
        return generate_response(201, {
            'message': 'Album created successfully',
            'album': album.to_dict()
        })

    except Exception as e:
        print(f"Error creating album: {str(e)}")
        return generate_response(500, {
            'error': 'Internal Server Error',
            'message': str(e)
        })