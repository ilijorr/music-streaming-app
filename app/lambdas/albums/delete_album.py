import os
import json
import boto3
from botocore.exceptions import ClientError
from utils import (
    generate_response,
    is_admin,
    get_path_parameter
)

# Environment variables
TABLE_NAME = os.environ.get('TABLE_NAME')
BUCKET_NAME = os.environ.get('BUCKET_NAME')

# AWS clients
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(TABLE_NAME)
s3_client = boto3.client('s3')


def lambda_handler(event, context):
    """
    Delete an album and all songs within it (Admin only).
    Cascade delete: Deletes album metadata, album cover, all songs, and their audio files.

    DELETE /albums/{id}
    """
    print(f"Received event: {json.dumps(event)}")

    try:
        # Check authorization - Admin only
        if not is_admin(event):
            return generate_response(403, {
                'error': 'Forbidden',
                'message': 'Only administrators can delete albums'
            })

        # Get album ID from path parameters
        album_id = get_path_parameter(event, 'id')

        if not album_id:
            return generate_response(400, {
                'error': 'Bad Request',
                'message': 'Album ID is required'
            })

        # Verify album exists and get its data for cleanup
        pk = f"ALBUM#{album_id}"
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
                'message': f'Album with ID {album_id} not found'
            })

        album_item = response['Item']

        # CASCADE DELETE: Find and delete all songs in this album
        deleted_songs_count = 0
        try:
            # Scan for all songs with this albumId
            scan_response = table.scan(
                FilterExpression='albumId = :albumId',
                ExpressionAttributeValues={
                    ':albumId': album_id
                }
            )

            songs_to_delete = scan_response.get('Items', [])
            print(f"Found {len(songs_to_delete)} songs in album {album_id}")

            # Delete each song
            for song_item in songs_to_delete:
                song_id = song_item.get('songId')
                if not song_id:
                    continue

                print(f"Deleting song {song_id} from album {album_id}")

                # Delete audio file from S3
                if 'fileUrl' in song_item and song_item['fileUrl']:
                    file_url = song_item['fileUrl']
                    if file_url.startswith('s3://'):
                        s3_key = file_url.replace(f's3://{BUCKET_NAME}/', '')
                        try:
                            s3_client.delete_object(Bucket=BUCKET_NAME, Key=s3_key)
                            print(f"Deleted audio file: {s3_key}")
                        except Exception as e:
                            print(f"Failed to delete audio file {s3_key}: {str(e)}")

                # Delete song cover image from S3 if exists
                if 'coverUrl' in song_item and song_item['coverUrl']:
                    song_cover_url = song_item['coverUrl']
                    if song_cover_url.startswith('s3://'):
                        cover_key = song_cover_url.replace(f's3://{BUCKET_NAME}/', '')
                        try:
                            s3_client.delete_object(Bucket=BUCKET_NAME, Key=cover_key)
                            print(f"Deleted song cover: {cover_key}")
                        except Exception as e:
                            print(f"Failed to delete song cover {cover_key}: {str(e)}")

                # Delete song metadata from DynamoDB
                try:
                    table.delete_item(
                        Key={
                            'PK': f"SONG#{song_id}",
                            'SK': 'METADATA'
                        }
                    )
                    deleted_songs_count += 1
                    print(f"Deleted song metadata: {song_id}")
                except ClientError as e:
                    print(f"Failed to delete song {song_id}: {str(e)}")

            print(f"Deleted {deleted_songs_count} songs from album {album_id}")

        except Exception as e:
            print(f"Error deleting songs from album: {str(e)}")
            # Continue with album deletion even if some songs failed

        # Delete album cover image from S3 if exists
        if 'coverUrl' in album_item and album_item['coverUrl']:
            cover_url = album_item['coverUrl']
            if cover_url.startswith('s3://'):
                cover_key = cover_url.replace(f's3://{BUCKET_NAME}/', '')
                try:
                    s3_client.delete_object(Bucket=BUCKET_NAME, Key=cover_key)
                    print(f"Deleted album cover: {cover_key}")
                except Exception as e:
                    print(f"Failed to delete album cover: {str(e)}")
                    # Continue with deletion even if S3 delete fails

        # Delete album metadata from DynamoDB
        try:
            table.delete_item(
                Key={
                    'PK': pk,
                    'SK': sk
                }
            )
            print(f"Deleted album metadata: {album_id}")
        except ClientError as e:
            print(f"DynamoDB delete error: {str(e)}")
            return generate_response(500, {
                'error': 'Internal Server Error',
                'message': 'Failed to delete album from database'
            })

        print(f"Successfully deleted album: {album_id}")

        return generate_response(200, {
            'message': f'Album {album_id} and {deleted_songs_count} songs deleted successfully'
        })

    except Exception as e:
        print(f"Error deleting album: {str(e)}")
        return generate_response(500, {
            'error': 'Internal Server Error',
            'message': str(e)
        })
