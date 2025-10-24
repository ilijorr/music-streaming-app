import os
import json
import uuid
import boto3
from datetime import datetime
from utils import generate_response, validate_required_fields, parse_body, is_admin, upload_to_s3
from models import Album, AlbumSong, extract_file_metadata

dynamodb = boto3.resource('dynamodb')
albums_table = dynamodb.Table(os.environ['ALBUMS_TABLE'])
songs_table = dynamodb.Table(os.environ['SONGS_TABLE'])
subscriptions_table = dynamodb.Table(os.environ['SUBSCRIPTIONS_TABLE'])
sns_client = boto3.client('sns')


def handler(event, context):
    """
    Upload a new album with songs (Admin only)

    Required fields:
    - title: Album title
    - artist_ids: List of artist IDs
    - release_date: Album release date (YYYY-MM-DD)
    - genres: List of genres
    - songs: List of song objects with audio files

    Optional fields:
    - cover_image_base64: Base64 encoded cover image
    - cover_filename: Name of the cover image file

    Song object structure:
    - title: Song title
    - audio_file_base64: Base64 encoded audio file
    - genres: List of genres (can be different from album)
    - duration: Song duration in seconds (optional)
    - featuring_artists: List of featuring artist names (optional)
    - track_number: Track number in album (optional)
    """
    try:
        # Check if user is admin
        if not is_admin(event):
            return generate_response(403, {"error": "Access denied. Admin privileges required."})

        # Parse request body
        body = parse_body(event)

        # Validate required fields
        required_fields = ['title', 'artist_ids', 'release_date', 'genres', 'songs']
        validation_error = validate_required_fields(body, required_fields)
        if validation_error:
            return generate_response(400, {"error": validation_error})

        # Validate lists
        if not isinstance(body['artist_ids'], list):
            return generate_response(400, {"error": "Artist IDs must be a list"})
        if not isinstance(body['genres'], list):
            return generate_response(400, {"error": "Genres must be a list"})
        if not isinstance(body['songs'], list) or len(body['songs']) == 0:
            return generate_response(400, {"error": "Songs must be a non-empty list"})

        # Generate unique album ID
        album_id = str(uuid.uuid4())

        # Handle cover image upload if provided
        cover_url = None
        if body.get('cover_image_base64') and body.get('cover_filename'):
            try:
                cover_key = f"albums/{album_id}/cover/{body['cover_filename']}"
                cover_url = upload_to_s3(
                    bucket=os.environ['IMAGES_BUCKET'],
                    key=cover_key,
                    file_data=body['cover_image_base64'],
                    content_type='image/jpeg'
                )
            except Exception as e:
                return generate_response(400, {"error": f"Failed to upload cover image: {str(e)}"})

        # Create album object
        album = Album(
            album_id=album_id,
            title=body['title'],
            artist_ids=body['artist_ids'],
            release_date=body['release_date'],
            genres=body['genres'],
            cover_url=cover_url
        )

        # Process and upload songs
        uploaded_songs = []
        for i, song_data in enumerate(body['songs']):
            try:
                # Validate song data
                song_required_fields = ['title', 'audio_file_base64']
                song_validation_error = validate_required_fields(song_data, song_required_fields)
                if song_validation_error:
                    return generate_response(400, {"error": f"Song {i+1}: {song_validation_error}"})

                # Generate unique song ID
                song_id = str(uuid.uuid4())

                # Extract audio filename
                audio_filename = song_data.get('audio_filename', f"track_{i+1}.mp3")

                # Extract audio metadata
                audio_metadata = extract_file_metadata(song_data['audio_file_base64'], audio_filename)

                # Upload audio file
                audio_key = f"albums/{album_id}/songs/{song_id}/{audio_filename}"
                audio_url = upload_to_s3(
                    bucket=os.environ['MEDIA_BUCKET'],
                    key=audio_key,
                    file_data=song_data['audio_file_base64'],
                    content_type=audio_metadata['file_type']
                )

                # Create song using AlbumSong helper
                album_song = AlbumSong(
                    title=song_data['title'],
                    audio_file_base64=song_data['audio_file_base64'],
                    genres=song_data.get('genres', body['genres']),
                    duration=song_data.get('duration'),
                    featuring_artists=song_data.get('featuring_artists', []),
                    track_number=song_data.get('track_number', i + 1)
                )

                song = album_song.to_song_model(
                    song_id=song_id,
                    album_id=album_id,
                    file_url=audio_url,
                    file_metadata=audio_metadata,
                    cover_url=cover_url,  # Use album cover for songs
                    primary_artist_ids=body['artist_ids']
                )

                # Save song to DynamoDB with GSI attributes
                song_item = song.to_dynamodb_item()

                # Add GSI attributes for filtering
                # Artist GSI
                for artist_id in body['artist_ids']:
                    artist_item = {
                        **song_item,
                        'GSI1PK': f"ARTIST#{artist_id}",
                        'GSI1SK': f"SONG#{song_id}"
                    }
                    songs_table.put_item(Item=artist_item)
                    break

                # Genre GSI
                song_genres = song_data.get('genres', body['genres'])
                for genre in song_genres:
                    genre_item = {
                        **song_item,
                        'GSI2PK': f"GENRE#{genre}",
                        'GSI2SK': f"SONG#{song_id}"
                    }
                    songs_table.put_item(Item=genre_item)
                    break

                # Album GSI
                album_item = {
                    **song_item,
                    'GSI3PK': f"ALBUM#{album_id}",
                    'GSI3SK': f"SONG#{song_id}"
                }
                songs_table.put_item(Item=album_item)

                uploaded_songs.append(song.to_dict())

            except Exception as e:
                return generate_response(400, {"error": f"Failed to upload song {i+1}: {str(e)}"})

        # Save main album item to DynamoDB
        album_item = album.to_dynamodb_item()
        albums_table.put_item(Item=album_item)

        # Create genre index entries for each genre using proper GSI structure
        for genre in body['genres']:
            # Normalize genre for consistent querying
            normalized_genre = genre.upper().replace(' ', '_')
            
            # Create genre index item with proper GSI attributes
            genre_item = {
                'PK': album_item['PK'],  # Keep original PK
                'SK': album_item['SK'],  # Keep original SK
                'GSI2PK': f"GENRE#{normalized_genre}",
                'GSI2SK': f"ALBUM#{album_id}",
                'album_id': album_id,
                'title': body['title'],
                'artist_ids': body['artist_ids'],
                'release_date': body['release_date'],
                'genres': body['genres'],
                'cover_url': cover_url,
                'created_at': album_item['created_at'],
                'updated_at': album_item['updated_at'],
                'entity_type': 'ALBUM_GENRE_INDEX'
            }
            
            # Put genre index item
            albums_table.put_item(Item=genre_item)

        # Create artist index entries (keeping your existing logic)
        for artist_id in body['artist_ids']:
            artist_item = {
                'PK': album_item['PK'],
                'SK': album_item['SK'],
                'GSI1PK': f"ARTIST#{artist_id}",
                'GSI1SK': f"ALBUM#{album_id}",
                'album_id': album_id,
                'title': body['title'],
                'artist_ids': body['artist_ids'],
                'release_date': body['release_date'],
                'genres': body['genres'],
                'cover_url': cover_url,
                'created_at': album_item['created_at'],
                'updated_at': album_item['updated_at'],
                'entity_type': 'ALBUM_ARTIST_INDEX'
            }
            albums_table.put_item(Item=artist_item)

        # Send notifications to subscribers
        try:
            _send_notifications(album, body['artist_ids'], body['genres'])
        except Exception as e:
            print(f"Error sending notifications: {str(e)}")

        album_dict = album.to_dict()
        album_dict['songs'] = uploaded_songs

        return generate_response(201, {
            "message": "Album uploaded successfully",
            "album": album_dict
        })

    except ValueError as e:
        return generate_response(400, {"error": str(e)})
    except Exception as e:
        print(f"Error uploading album: {str(e)}")
        return generate_response(500, {"error": "Internal server error"})


def _send_notifications(album, artist_ids, genres):
    """Send notifications to subscribers"""
    try:
        # Find subscribers for artists
        for artist_id in artist_ids:
            try:
                response = subscriptions_table.query(
                    IndexName='SubscriptionIndex',
                    KeyConditionExpression='GSI1PK = :pk',
                    ExpressionAttributeValues={
                        ':pk': f"SUBSCRIPTION#ARTIST#{artist_id}"
                    }
                )
                for subscription in response.get('Items', []):
                    user_id = subscription['PK'].replace('USER#', '')
                    _send_notification(user_id, f"New album '{album.title}' by your subscribed artist!")
            except Exception as e:
                print(f"Error notifying artist subscribers: {str(e)}")

        # Find subscribers for genres
        for genre in genres:
            try:
                response = subscriptions_table.query(
                    IndexName='SubscriptionIndex',
                    KeyConditionExpression='GSI1PK = :pk',
                    ExpressionAttributeValues={
                        ':pk': f"SUBSCRIPTION#GENRE#{genre}"
                    }
                )
                for subscription in response.get('Items', []):
                    user_id = subscription['PK'].replace('USER#', '')
                    _send_notification(user_id, f"New {genre} album '{album.title}' available!")
            except Exception as e:
                print(f"Error notifying genre subscribers: {str(e)}")

    except Exception as e:
        print(f"Error in notification process: {str(e)}")


def _send_notification(user_id, message):
    """Send notification to user"""
    try:
        sns_client.publish(
            TopicArn=os.environ['NOTIFICATION_TOPIC_ARN'],
            Message=json.dumps({
                'user_id': user_id,
                'message': message,
                'type': 'new_content'
            }),
            Subject='New Music Content Available'
        )
    except Exception as e:
        print(f"Error sending SNS notification: {str(e)}")
