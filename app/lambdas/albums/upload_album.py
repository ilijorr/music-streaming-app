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
from models import Album, AlbumSong, extract_file_metadata

# Environment variables
TABLE_NAME = os.environ.get('TABLE_NAME')
BUCKET_NAME = os.environ.get('BUCKET_NAME')

# AWS clients
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(TABLE_NAME)


def lambda_handler(event, context):
    """
    Upload a new album with multiple songs (Admin only).

    POST /albums/upload
    Body: {
        title,
        artistIds,
        releaseDate,
        genres,
        coverImageBase64,
        songs: [
            {
                title,
                audioFileBase64,
                genres,
                duration (optional),
                featuringArtists (optional),
                trackNumber (optional),
                filename (optional)
            }
        ]
    }
    """
    print(f"Received event: {json.dumps(event)}")

    try:
        # Check authorization - Admin only
        if not is_admin(event):
            return generate_response(403, {
                'error': 'Forbidden',
                'message': 'Only administrators can upload albums'
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
        required_fields = ['title', 'artistIds', 'releaseDate', 'genres', 'coverImageBase64', 'songs']
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
        cover_image_base64 = body['coverImageBase64']
        songs_data = body['songs']

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

        if not isinstance(songs_data, list) or len(songs_data) == 0:
            return generate_response(400, {
                'error': 'Bad Request',
                'message': 'songs must be a non-empty array'
            })

        # Validate each song data
        for i, song_data in enumerate(songs_data):
            song_required_fields = ['title', 'audioFileBase64', 'genres']
            song_validation_error = validate_required_fields(song_data, song_required_fields)
            if song_validation_error:
                return generate_response(400, {
                    'error': 'Bad Request',
                    'message': f'Song {i+1}: {song_validation_error}'
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

        # Upload album cover image
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
            print(f"Failed to upload album cover: {str(e)}")
            return generate_response(500, {
                'error': 'Internal Server Error',
                'message': f'Failed to upload album cover: {str(e)}'
            })

        # Process and upload each song
        uploaded_songs = []

        for i, song_data in enumerate(songs_data):
            try:
                # Create AlbumSong object
                album_song = AlbumSong(
                    title=song_data['title'].strip(),
                    audio_file_base64=song_data['audioFileBase64'],
                    genres=song_data['genres'],
                    duration=song_data.get('duration'),
                    featuring_artists=song_data.get('featuringArtists', []),
                    track_number=song_data.get('trackNumber', i + 1)
                )

                # Generate unique song ID
                song_id = str(uuid.uuid4())

                # Extract file metadata
                file_metadata = extract_file_metadata(
                    album_song.audio_file_base64,
                    song_data.get('filename')
                )

                # Upload audio file to S3
                ext = '.mp3'  # default
                if file_metadata['file_type'] == 'audio/wav':
                    ext = '.wav'
                elif file_metadata['file_type'] == 'audio/mp4':
                    ext = '.m4a'

                audio_key = f"songs/{song_id}{ext}"
                file_url = upload_to_s3(
                    bucket=BUCKET_NAME,
                    key=audio_key,
                    file_data=album_song.audio_file_base64,
                    content_type=file_metadata['file_type']
                )
                print(f"Uploaded song {i+1} audio file to: {file_url}")

                # Convert to Song model
                song = album_song.to_song_model(
                    song_id=song_id,
                    album_id=album_id,
                    file_url=file_url,
                    file_metadata=file_metadata,
                    cover_url=cover_url,  # Use album cover for all songs
                    primary_artist_ids=artist_ids
                )

                # Save song metadata to DynamoDB
                main_item = song.to_dynamodb_item()
                table.put_item(Item=main_item)
                print(f"Saved song metadata: {song_id}")

                # Create GSI items for each genre in the song
                for genre in song.genres:
                    genre_item = {
                        'PK': f"SONG#{song_id}",
                        'SK': f"GENRE#{genre}",
                        'GSI1PK': f"GENRE#{genre}",
                        'GSI1SK': f"SONG#{song_id}",
                        'songId': song_id,
                        'title': song.title,
                        'artistIds': song.artist_ids,
                        'albumId': album_id
                    }
                    table.put_item(Item=genre_item)

                uploaded_songs.append(song.to_dict())

            except Exception as e:
                print(f"Error processing song {i+1}: {str(e)}")
                return generate_response(500, {
                    'error': 'Internal Server Error',
                    'message': f'Failed to process song {i+1}: {str(e)}'
                })

        # Create album object
        album = Album(
            album_id=album_id,
            title=title,
            artist_ids=artist_ids,
            release_date=release_date,
            genres=genres,
            cover_url=cover_url,
            songs=uploaded_songs
        )

        # Save album metadata to DynamoDB
        main_item = album.to_dynamodb_item()
        table.put_item(Item=main_item)
        print(f"Saved album metadata: {album_id}")

        # Create GSI items for each genre in the album
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
            print(f"Created album genre index for: {genre}")

        # Return success response
        return generate_response(201, {
            'message': 'Album uploaded successfully',
            'album': album.to_dict()
        })

    except Exception as e:
        print(f"Error uploading album: {str(e)}")
        return generate_response(500, {
            'error': 'Internal Server Error',
            'message': str(e)
        })