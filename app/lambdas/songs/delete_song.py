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
    Delete a song (Admin only).

    DELETE /songs/{id}
    """
    print(f"Received event: {json.dumps(event)}")

    try:
        # Check authorization - Admin only
        if not is_admin(event):
            return generate_response(403, {
                'error': 'Forbidden',
                'message': 'Only administrators can delete songs'
            })

        # Get song ID from path parameters
        song_id = get_path_parameter(event, 'id')

        if not song_id:
            return generate_response(400, {
                'error': 'Bad Request',
                'message': 'Song ID is required'
            })

        # Verify song exists and get its data for cleanup
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

        song_item = response['Item']

        # Delete audio file from S3
        if 'fileUrl' in song_item and song_item['fileUrl']:
            file_url = song_item['fileUrl']
            if file_url.startswith('s3://'):
                s3_key = file_url.replace(f's3://{BUCKET_NAME}/', '')
                try:
                    s3_client.delete_object(Bucket=BUCKET_NAME, Key=s3_key)
                    print(f"Deleted audio file: {s3_key}")
                except Exception as e:
                    print(f"Failed to delete audio file: {str(e)}")
                    # Continue with deletion even if S3 delete fails

        # Delete cover image from S3 if exists
        if 'coverUrl' in song_item and song_item['coverUrl']:
            cover_url = song_item['coverUrl']
            if cover_url.startswith('s3://'):
                cover_key = cover_url.replace(f's3://{BUCKET_NAME}/', '')
                try:
                    s3_client.delete_object(Bucket=BUCKET_NAME, Key=cover_key)
                    print(f"Deleted cover image: {cover_key}")
                except Exception as e:
                    print(f"Failed to delete cover image: {str(e)}")
                    # Continue with deletion even if S3 delete fails

        # Delete song metadata from DynamoDB
        try:
            table.delete_item(
                Key={
                    'PK': pk,
                    'SK': sk
                }
            )
            print(f"Deleted song metadata: {song_id}")
        except ClientError as e:
            print(f"DynamoDB delete error: {str(e)}")
            return generate_response(500, {
                'error': 'Internal Server Error',
                'message': 'Failed to delete song from database'
            })

        print(f"Successfully deleted song: {song_id}")

        return generate_response(200, {
            'message': f'Song {song_id} deleted successfully'
        })

    except Exception as e:
        print(f"Error deleting song: {str(e)}")
        return generate_response(500, {
            'error': 'Internal Server Error',
            'message': str(e)
        })
