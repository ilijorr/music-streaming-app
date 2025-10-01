import os
import json
import boto3
from botocore.exceptions import ClientError
from utils import generate_response, get_path_parameter, generate_presigned_url
from models import Song

# Environment variables
TABLE_NAME = os.environ.get('TABLE_NAME')
BUCKET_NAME = os.environ.get('BUCKET_NAME')

# AWS clients
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(TABLE_NAME)


def lambda_handler(event, context):
    """
    Get a specific song by ID with presigned streaming URL (Admins and Users).

    GET /songs/{id}
    """
    print(f"Received event: {json.dumps(event)}")

    try:
        # Get song ID from path parameters
        song_id = get_path_parameter(event, 'id')

        if not song_id:
            return generate_response(400, {
                'error': 'Bad Request',
                'message': 'Song ID is required'
            })

        # Query DynamoDB
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

        # Check if item exists
        if 'Item' not in response:
            return generate_response(404, {
                'error': 'Not Found',
                'message': f'Song with ID {song_id} not found'
            })

        # Convert to Song object
        item = response['Item']
        song = Song.from_dynamodb_item(item)

        # Generate presigned URL for streaming (expires in 1 hour)
        try:
            # Extract S3 key from file URL (format: s3://bucket/key)
            file_url = song.file_url
            if file_url.startswith('s3://'):
                # Parse S3 URL
                s3_key = file_url.replace(f's3://{BUCKET_NAME}/', '')

                # Generate presigned URL
                stream_url = generate_presigned_url(
                    bucket=BUCKET_NAME,
                    key=s3_key,
                    expiration=3600  # 1 hour
                )

                song.stream_url = stream_url
                print(f"Generated presigned URL for song: {song_id}")

        except Exception as e:
            print(f"Failed to generate presigned URL: {str(e)}")
            # Continue without presigned URL

        print(f"Found song: {song_id}")

        return generate_response(200, {
            'song': song.to_dict()
        })

    except Exception as e:
        print(f"Error getting song: {str(e)}")
        return generate_response(500, {
            'error': 'Internal Server Error',
            'message': str(e)
        })