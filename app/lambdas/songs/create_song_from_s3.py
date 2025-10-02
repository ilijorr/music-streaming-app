import os
import json
import uuid
import boto3
from botocore.exceptions import ClientError
from utils import (
    generate_response,
    validate_required_fields,
    is_admin,
    parse_body,
    get_current_timestamp
)
from models import Song

# Environment variables
TABLE_NAME = os.environ.get('TABLE_NAME')
BUCKET_NAME = os.environ.get('BUCKET_NAME')

# AWS clients
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(TABLE_NAME)
s3_client = boto3.client('s3')


def lambda_handler(event, context):
    """
    Create a new song from existing S3 objects (Admin only).

    POST /songs/from-s3
    Body: {audioFileKey, title, artistIds, albumId (optional),
           genres, coverImageKey (optional), duration (optional)}
    """
    print(f"Received event: {json.dumps(event)}")

    try:
        # Check authorization - Admin only
        if not is_admin(event):
            return generate_response(403, {
                'error': 'Forbidden',
                'message': 'Only administrators can upload songs'
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
        required_fields = ['audioFileKey', 'title', 'artistIds', 'genres']
        validation_error = validate_required_fields(body, required_fields)

        if validation_error:
            return generate_response(400, {
                'error': 'Bad Request',
                'message': validation_error
            })

        # Extract fields
        audio_file_key = body['audioFileKey']
        title = body['title'].strip()
        artist_ids = body['artistIds']
        album_id = body.get('albumId')
        genres = body['genres']
        cover_image_key = body.get('coverImageKey')
        duration = body.get('duration')
        featuring_artists = body.get('featuringArtists', [])
        filename = body.get('filename', 'unknown.mp3')

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

        # Verify that S3 objects exist
        try:
            # Check audio file exists
            s3_client.head_object(Bucket=BUCKET_NAME, Key=audio_file_key)
            print(f"Verified audio file exists: {audio_file_key}")

            # Get audio file metadata
            audio_response = s3_client.head_object(Bucket=BUCKET_NAME, Key=audio_file_key)
            file_size = audio_response['ContentLength']
            file_type = audio_response.get('ContentType', 'audio/mpeg')
            file_modified_at = audio_response['LastModified'].isoformat()

            # Check cover image exists if provided
            if cover_image_key:
                s3_client.head_object(Bucket=BUCKET_NAME, Key=cover_image_key)
                print(f"Verified cover image exists: {cover_image_key}")

        except ClientError as e:
            if e.response['Error']['Code'] == '404':
                return generate_response(400, {
                    'error': 'Bad Request',
                    'message': 'One or more files not found in S3'
                })
            else:
                print(f"Error checking S3 objects: {str(e)}")
                return generate_response(500, {
                    'error': 'Internal Server Error',
                    'message': 'Failed to verify file existence'
                })

        # Generate unique song ID
        song_id = str(uuid.uuid4())

        # Create file URLs
        file_url = f"s3://{BUCKET_NAME}/{audio_file_key}"
        cover_url = f"s3://{BUCKET_NAME}/{cover_image_key}" if cover_image_key else None

        # Create song object
        song = Song(
            song_id=song_id,
            title=title,
            artist_ids=artist_ids,
            genres=genres,
            file_url=file_url,
            file_name=filename,
            file_type=file_type,
            file_size=file_size,
            file_created_at=get_current_timestamp(),  # Use current time as creation
            file_modified_at=file_modified_at,
            album_id=album_id,
            cover_url=cover_url,
            duration=duration,
            featuring_artists=featuring_artists
        )

        # Save main metadata to DynamoDB
        main_item = song.to_dynamodb_item()
        table.put_item(Item=main_item)
        print(f"Saved song metadata: {song_id}")

        # Create GSI items for each genre
        for genre in genres:
            genre_item = {
                'PK': f"SONG#{song_id}",
                'SK': f"GENRE#{genre}",
                'GSI1PK': f"GENRE#{genre}",
                'GSI1SK': f"SONG#{song_id}",
                'songId': song_id,
                'title': title,
                'artistIds': artist_ids
            }
            table.put_item(Item=genre_item)
            print(f"Created genre index for: {genre}")

        # Return success response
        return generate_response(201, {
            'message': 'Song created successfully from S3 objects',
            'song': song.to_dict()
        })

    except Exception as e:
        print(f"Error creating song from S3: {str(e)}")
        return generate_response(500, {
            'error': 'Internal Server Error',
            'message': str(e)
        })