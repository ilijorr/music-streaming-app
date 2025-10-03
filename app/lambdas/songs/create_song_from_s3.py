import os
import json
import boto3
from utils import (
        generate_response,
        is_admin,
        parse_body,
        validate_required_fields,
        )
from models.Song import Song

BUCKET_NAME = os.environ['BUCKET_NAME']
TABLE_NAME = os.environ['TABLE_NAME']
s3_client = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(TABLE_NAME)


def lambda_handler(event, context):
    """
    Create song record after file is uploaded to S3 (Admin only)

    POST /songs
    Body: {
            song_id,
            title,
            artist_ids,
            genres,
            s3_key,
            duration,
            album_id (optional),
            cover_url (optional)
            }
    """
    print(f"Received event: {json.dumps(event)}")

    try:
        if not is_admin(event):
            return generate_response(403, {
                'error': 'Forbidden',
                'message': 'Only administrators can create songs'
            })

        try:
            body = parse_body(event)
        except ValueError as e:
            return generate_response(400, {
                'error': 'Bad Request',
                'message': str(e)
            })

        # Validate required fields
        required_fields = [
                'song_id',
                'title',
                'artist_ids',
                'genres',
                's3_key',
                'duration'
                ]
        validation_error = validate_required_fields(body, required_fields)
        if validation_error:
            return generate_response(400, {
                'error': 'Bad Request',
                'message': validation_error
            })

        song_id = body['song_id']
        s3_key = body['s3_key']

        # Verify file exists in S3 and get metadata
        try:
            head_response = s3_client.head_object(
                    Bucket=BUCKET_NAME,
                    Key=s3_key
                    )
            file_size = head_response['ContentLength']

            file_type = head_response.get('ContentType', 'audio/mpeg')
            last_modified = head_response['LastModified'].isoformat() + 'Z'
        except Exception as e:
            return generate_response(400, {
                'error': 'Bad Request',
                'message': f'S3 file not found: {str(e)}'
            })

        # Extract filename from S3 key
        filename = s3_key.split('/')[-1]

        file_url = f"https://{BUCKET_NAME} \
                .s3.{os.environ['AWS_REGION']}.amazonaws.com/{s3_key}"

        # Create song object
        song = Song(
            song_id=song_id,
            title=body['title'].strip(),
            artist_ids=body['artist_ids'],
            genres=body['genres'],
            file_url=file_url,
            file_name=filename,
            file_type=file_type,
            file_size=file_size,
            file_created_at=last_modified,
            file_modified_at=last_modified,
            album_id=body.get('album_id'),
            cover_url=body.get('cover_url'),
            duration=body['duration'],
            track_number=body.get('track_number')
        )

        # Save to DynamoDB
        table.put_item(Item=song.to_dynamodb_item())
        print(f"Saved song to DynamoDB: {song_id}")

        # Update artist singles
        update_artist_singles(song_id, body['artist_ids'])

        return generate_response(201, {
            'message': 'Song created successfully',
            'song': song.to_dict()
        })

    except Exception as e:
        print(f"Error creating song: {str(e)}")
        return generate_response(500, {
            'error': 'Internal Server Error',
            'message': str(e)
        })


def update_artist_singles(song_id, artist_ids):
    """Add song to artist's singles list"""
    for artist_id in artist_ids:
        try:
            table.update_item(
                Key={'PK': f"ARTIST#{artist_id}", 'SK': 'METADATA'},
                UpdateExpression='ADD singles :song_id',
                ExpressionAttributeValues={':song_id': {song_id}},
                ConditionExpression='attribute_exists(PK)'
            )
            print(f"Added song {song_id} to artist {artist_id}")
        except Exception as e:
            print(f"Failed to update artist {artist_id}: {str(e)}")
