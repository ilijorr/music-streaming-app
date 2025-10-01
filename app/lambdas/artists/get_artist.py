import os
import json
import boto3
from botocore.exceptions import ClientError
from utils import generate_response, get_path_parameter
from models import Artist

# Environment variables
TABLE_NAME = os.environ.get('TABLE_NAME')

# AWS clients
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(TABLE_NAME)


def lambda_handler(event, context):
    """
    Get a specific artist by ID (Admins and Users).

    GET /artists/{id}
    """
    print(f"Received event: {json.dumps(event)}")

    try:
        # Get artist ID from path parameters
        artist_id = get_path_parameter(event, 'id')

        if not artist_id:
            return generate_response(400, {
                'error': 'Bad Request',
                'message': 'Artist ID is required'
            })

        # Query DynamoDB
        pk = f"ARTIST#{artist_id}"
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
                'message': f'Artist with ID {artist_id} not found'
            })

        # Convert to Artist object
        item = response['Item']
        artist = Artist.from_dynamodb_item(item)

        print(f"Found artist: {artist_id}")

        return generate_response(200, {
            'artist': artist.to_dict()
        })

    except Exception as e:
        print(f"Error getting artist: {str(e)}")
        return generate_response(500, {
            'error': 'Internal Server Error',
            'message': str(e)
        })