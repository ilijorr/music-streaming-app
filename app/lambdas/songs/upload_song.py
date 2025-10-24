import os
import json
import uuid
import boto3
from datetime import datetime
from utils import generate_response, validate_required_fields, parse_body, is_admin, upload_to_s3
from models import Song, extract_file_metadata

dynamodb = boto3.resource('dynamodb')
songs_table = dynamodb.Table(os.environ['SONGS_TABLE'])
subscriptions_table = dynamodb.Table(os.environ['SUBSCRIPTIONS_TABLE'])
sns_client = boto3.client('sns')


def handler(event, context):
    """
    Upload a new song (Admin only)

    Required fields:
    - title: Song title
    - artist_ids: List of artist IDs
    - genres: List of genres
    - audio_file_base64: Base64 encoded audio file
    - audio_filename: Name of the audio file

    Optional fields:
    - album_id: Album ID if part of an album
    - cover_image_base64: Base64 encoded cover image
    - cover_filename: Name of the cover image file
    - duration: Song duration in seconds
    - featuring_artists: List of featuring artist names
    """
    try:
        # Check if user is admin
        if not is_admin(event):
            return generate_response(403, {"error": "Access denied. Admin privileges required."})

        # Parse request body
        body = parse_body(event)

        # Validate required fields
        required_fields = ['title', 'artist_ids', 'genres', 'audio_file_base64', 'audio_filename']
        validation_error = validate_required_fields(body, required_fields)
        if validation_error:
            return generate_response(400, {"error": validation_error})

        # Validate lists
        if not isinstance(body['artist_ids'], list):
            return generate_response(400, {"error": "Artist IDs must be a list"})
        if not isinstance(body['genres'], list):
            return generate_response(400, {"error": "Genres must be a list"})

        # Generate unique song ID
        song_id = str(uuid.uuid4())

        # Extract audio file metadata
        audio_metadata = extract_file_metadata(body['audio_file_base64'], body['audio_filename'])

        # Upload audio file to S3
        try:
            audio_key = f"songs/{song_id}/{body['audio_filename']}"
            audio_url = upload_to_s3(
                bucket=os.environ['MEDIA_BUCKET'],
                key=audio_key,
                file_data=body['audio_file_base64'],
                content_type=audio_metadata['file_type']
            )
        except Exception as e:
            return generate_response(400, {"error": f"Failed to upload audio file: {str(e)}"})

        # Handle cover image upload if provided
        cover_url = None
        if body.get('cover_image_base64') and body.get('cover_filename'):
            try:
                cover_key = f"songs/{song_id}/cover/{body['cover_filename']}"
                cover_url = upload_to_s3(
                    bucket=os.environ['IMAGES_BUCKET'],
                    key=cover_key,
                    file_data=body['cover_image_base64'],
                    content_type='image/jpeg'  # Default to JPEG
                )
            except Exception as e:
                return generate_response(400, {"error": f"Failed to upload cover image: {str(e)}"})

        # Create song object
        song = Song(
            song_id=song_id,
            title=body['title'],
            artist_ids=body['artist_ids'],
            genres=body['genres'],
            file_url=audio_url,
            file_name=audio_metadata['file_name'],
            file_type=audio_metadata['file_type'],
            file_size=audio_metadata['file_size'],
            file_created_at=audio_metadata['file_created_at'],
            file_modified_at=audio_metadata['file_modified_at'],
            album_id=body.get('album_id'),
            cover_url=cover_url,
            duration=body.get('duration'),
            featuring_artists=body.get('featuring_artists', [])
        )

        # Save to DynamoDB with GSI attributes
        item = song.to_dynamodb_item()

        # Add GSI attributes for filtering
        # Artist GSI
        for artist_id in body['artist_ids']:
            artist_item = {
                **item,
                'GSI1PK': f"ARTIST#{artist_id}",
                'GSI1SK': f"SONG#{song_id}"
            }
            songs_table.put_item(Item=artist_item)
            break  # Only store in one artist GSI for simplicity

        # Genre GSI
        for genre in body['genres']:
            genre_item = {
                **item,
                'GSI2PK': f"GENRE#{genre}",
                'GSI2SK': f"SONG#{song_id}"
            }
            songs_table.put_item(Item=genre_item)
            break  # Only store in one genre GSI for simplicity

        # Album GSI (if applicable)
        if body.get('album_id'):
            album_item = {
                **item,
                'GSI3PK': f"ALBUM#{body['album_id']}",
                'GSI3SK': f"SONG#{song_id}"
            }
            songs_table.put_item(Item=album_item)

        # Store main item if minimal GSI usage
        if len(body['artist_ids']) <= 1 and len(body['genres']) <= 1:
            songs_table.put_item(Item=item)

        # Send notifications to subscribers
        try:
            _send_notifications(song, body['artist_ids'], body['genres'])
        except Exception as e:
            print(f"Error sending notifications: {str(e)}")

        return generate_response(201, {
            "message": "Song uploaded successfully",
            "song": song.to_dict()
        })

    except ValueError as e:
        return generate_response(400, {"error": str(e)})
    except Exception as e:
        print(f"Error uploading song: {str(e)}")
        return generate_response(500, {"error": "Internal server error"})


def _send_notifications(song, artist_ids, genres):
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
                    _send_notification(user_id, f"New song '{song.title}' by your subscribed artist!")
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
                    _send_notification(user_id, f"New {genre} song '{song.title}' available!")
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