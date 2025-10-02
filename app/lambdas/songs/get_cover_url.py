import os
import json
import boto3
from botocore.exceptions import ClientError
from utils import generate_response, get_path_parameter

# Environment variables
TABLE_NAME = os.environ.get('TABLE_NAME')
BUCKET_NAME = os.environ.get('BUCKET_NAME')

# AWS clients
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(TABLE_NAME)
s3_client = boto3.client('s3')


def lambda_handler(event, context):
    """
    Generate presigned URL for song cover image.

    GET /songs/{id}/cover-url
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

        # Query DynamoDB for song metadata
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

        item = response['Item']
        cover_url = item.get('coverUrl')

        if not cover_url:
            return generate_response(404, {
                'error': 'Not Found',
                'message': 'Song cover image not found'
            })

        # Extract S3 key from coverUrl (format: s3://bucket/key)
        if cover_url.startswith('s3://'):
            s3_key = cover_url.replace(f's3://{BUCKET_NAME}/', '')
        else:
            return generate_response(500, {
                'error': 'Internal Server Error',
                'message': 'Invalid cover URL format'
            })

        # Generate presigned URL (valid for 1 hour)
        try:
            presigned_url = s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': BUCKET_NAME,
                    'Key': s3_key
                },
                ExpiresIn=3600  # 1 hour
            )

            print(f"Generated presigned URL for song cover: {song_id}")

            return generate_response(200, {
                'downloadUrl': presigned_url
            })

        except ClientError as e:
            print(f"S3 error generating presigned URL: {str(e)}")
            return generate_response(500, {
                'error': 'Internal Server Error',
                'message': 'Failed to generate cover URL'
            })

    except Exception as e:
        print(f"Error generating cover URL: {str(e)}")
        return generate_response(500, {
            'error': 'Internal Server Error',
            'message': str(e)
        })
