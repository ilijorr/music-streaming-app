import os
import boto3
from utils import generate_response, parse_body, is_admin, get_path_parameter, upload_to_s3, get_current_timestamp
from models import Song, extract_file_metadata

dynamodb = boto3.resource('dynamodb')
songs_table = dynamodb.Table(os.environ['SONGS_TABLE'])


def handler(event, context):
    """
    Update an existing song (Admin only)

    Optional fields that can be updated:
    - title: Song title
    - artist_ids: List of artist IDs
    - genres: List of genres
    - album_id: Album ID
    - audio_file_base64: Base64 encoded audio file (replaces existing)
    - audio_filename: Name of the audio file
    - cover_image_base64: Base64 encoded cover image
    - cover_filename: Name of the cover image file
    - duration: Song duration in seconds
    - featuring_artists: List of featuring artist names
    """
    try:
        # Check if user is admin
        if not is_admin(event):
            return generate_response(403, {"error": "Access denied. Admin privileges required."})

        # Get song ID from path parameters
        song_id = get_path_parameter(event, 'songId')
        if not song_id:
            return generate_response(400, {"error": "Song ID is required"})

        # Parse request body
        body = parse_body(event)

        # Get existing song
        response = songs_table.get_item(
            Key={
                'PK': f"SONG#{song_id}",
                'SK': 'METADATA'
            }
        )

        if 'Item' not in response:
            return generate_response(404, {"error": "Song not found"})

        # Convert to Song object
        song = Song.from_dynamodb_item(response['Item'])

        # Update fields if provided
        if 'title' in body:
            song.title = body['title']
        if 'artist_ids' in body:
            if not isinstance(body['artist_ids'], list):
                return generate_response(400, {"error": "Artist IDs must be a list"})
            song.artist_ids = body['artist_ids']
        if 'genres' in body:
            if not isinstance(body['genres'], list):
                return generate_response(400, {"error": "Genres must be a list"})
            song.genres = body['genres']
        if 'album_id' in body:
            song.album_id = body['album_id']
        if 'duration' in body:
            song.duration = body['duration']
        if 'featuring_artists' in body:
            song.featuring_artists = body['featuring_artists']

        # Handle audio file replacement if provided
        if body.get('audio_file_base64') and body.get('audio_filename'):
            try:
                # Delete old file from S3 (optional, could keep for versioning)
                # s3_client = boto3.client('s3')
                # old_key = song.file_url.replace(f"s3://{os.environ['MEDIA_BUCKET']}/", "")
                # s3_client.delete_object(Bucket=os.environ['MEDIA_BUCKET'], Key=old_key)

                # Extract new file metadata
                audio_metadata = extract_file_metadata(body['audio_file_base64'], body['audio_filename'])

                # Upload new audio file
                audio_key = f"songs/{song_id}/{body['audio_filename']}"
                audio_url = upload_to_s3(
                    bucket=os.environ['MEDIA_BUCKET'],
                    key=audio_key,
                    file_data=body['audio_file_base64'],
                    content_type=audio_metadata['file_type']
                )

                # Update song attributes
                song.file_url = audio_url
                song.file_name = audio_metadata['file_name']
                song.file_type = audio_metadata['file_type']
                song.file_size = audio_metadata['file_size']
                song.file_modified_at = audio_metadata['file_modified_at']

            except Exception as e:
                return generate_response(400, {"error": f"Failed to upload audio file: {str(e)}"})

        # Handle cover image upload if provided
        if body.get('cover_image_base64') and body.get('cover_filename'):
            try:
                cover_key = f"songs/{song_id}/cover/{body['cover_filename']}"
                cover_url = upload_to_s3(
                    bucket=os.environ['IMAGES_BUCKET'],
                    key=cover_key,
                    file_data=body['cover_image_base64'],
                    content_type='image/jpeg'
                )
                song.cover_url = cover_url
            except Exception as e:
                return generate_response(400, {"error": f"Failed to upload cover image: {str(e)}"})

        # Update timestamp
        song.updated_at = get_current_timestamp()

        # Delete old song entries (in case attributes changed)
        songs_table.delete_item(
            Key={
                'PK': f"SONG#{song_id}",
                'SK': 'METADATA'
            }
        )

        # Save updated song to DynamoDB with GSI attributes
        item = song.to_dynamodb_item()

        # Add GSI attributes for filtering
        # Artist GSI
        for artist_id in song.artist_ids:
            artist_item = {
                **item,
                'GSI1PK': f"ARTIST#{artist_id}",
                'GSI1SK': f"SONG#{song_id}"
            }
            songs_table.put_item(Item=artist_item)
            break  # Only store in one artist GSI for simplicity

        # Genre GSI
        for genre in song.genres:
            genre_item = {
                **item,
                'GSI2PK': f"GENRE#{genre}",
                'GSI2SK': f"SONG#{song_id}"
            }
            songs_table.put_item(Item=genre_item)
            break  # Only store in one genre GSI for simplicity

        # Album GSI (if applicable)
        if song.album_id:
            album_item = {
                **item,
                'GSI3PK': f"ALBUM#{song.album_id}",
                'GSI3SK': f"SONG#{song_id}"
            }
            songs_table.put_item(Item=album_item)

        # Store main item if minimal GSI usage
        if len(song.artist_ids) <= 1 and len(song.genres) <= 1:
            songs_table.put_item(Item=item)

        return generate_response(200, {
            "message": "Song updated successfully",
            "song": song.to_dict()
        })

    except ValueError as e:
        return generate_response(400, {"error": str(e)})
    except Exception as e:
        print(f"Error updating song: {str(e)}")
        return generate_response(500, {"error": "Internal server error"})