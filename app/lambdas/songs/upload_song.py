import os
import json
import uuid
import boto3
import base64
from botocore.exceptions import ClientError
from utils import (
    generate_response,
    validate_required_fields,
    upload_to_s3,
    is_admin,
    parse_body,
    get_current_timestamp
)
from models import Song, extract_file_metadata

# Environment variables
TABLE_NAME = os.environ.get('TABLE_NAME')
BUCKET_NAME = os.environ.get('BUCKET_NAME')

# AWS clients
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(TABLE_NAME)


def lambda_handler(event, context):
    """
    Upload a new song (Admin only).

    POST /songs
    Body: {audioFileBase64, title, artistIds, albumId (optional),
           genres, coverImageBase64 (optional), duration (optional)}
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
        required_fields = ['audioFileBase64', 'title', 'artistIds', 'genres']
        validation_error = validate_required_fields(body, required_fields)

        if validation_error:
            return generate_response(400, {
                'error': 'Bad Request',
                'message': validation_error
            })

        # Extract fields
        audio_file_base64 = body['audioFileBase64']
        title = body['title'].strip()
        artist_ids = body['artistIds']
        album_id = body.get('albumId')
        genres = body['genres']
        cover_image_base64 = body.get('coverImageBase64')
        duration = body.get('duration')
        featuring_artists = body.get('featuringArtists', [])
        filename = body.get('filename')  # Optional filename for metadata extraction

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

        # Generate unique song ID
        song_id = str(uuid.uuid4())

        # Extract file metadata
        file_metadata = extract_file_metadata(audio_file_base64, filename)

        # Upload audio file to S3
        try:
            # Use appropriate extension based on file type
            ext = '.mp3'  # default
            if file_metadata['file_type'] == 'audio/wav':
                ext = '.wav'
            elif file_metadata['file_type'] == 'audio/mp4':
                ext = '.m4a'

            audio_key = f"songs/{song_id}{ext}"
            file_url = upload_to_s3(
                bucket=BUCKET_NAME,
                key=audio_key,
                file_data=audio_file_base64,
                content_type=file_metadata['file_type']
            )
            print(f"Uploaded audio file to: {file_url}")

        except Exception as e:
            print(f"Failed to upload audio file: {str(e)}")
            return generate_response(500, {
                'error': 'Internal Server Error',
                'message': f'Failed to upload audio file: {str(e)}'
            })

        # Upload cover image if provided
        cover_url = None
        if cover_image_base64:
            try:
                cover_key = f"covers/{song_id}.jpg"
                cover_url = upload_to_s3(
                    bucket=BUCKET_NAME,
                    key=cover_key,
                    file_data=cover_image_base64,
                    content_type='image/jpeg'
                )
                print(f"Uploaded cover image to: {cover_url}")
            except Exception as e:
                print(f"Failed to upload cover image: {str(e)}")
                # Continue without cover image

        # Create song object
        song = Song(
            song_id=song_id,
            title=title,
            artist_ids=artist_ids,
            genres=genres,
            file_url=file_url,
            file_name=file_metadata['file_name'],
            file_type=file_metadata['file_type'],
            file_size=file_metadata['file_size'],
            file_created_at=file_metadata['file_created_at'],
            file_modified_at=file_metadata['file_modified_at'],
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
            'message': 'Song uploaded successfully',
            'song': song.to_dict()
        })

    except Exception as e:
        print(f"Error uploading song: {str(e)}")
        return generate_response(500, {
            'error': 'Internal Server Error',
            'message': str(e)
        })