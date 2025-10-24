import os
import boto3
from utils import generate_response, get_path_parameter
from models import Album

dynamodb = boto3.resource('dynamodb')
albums_table = dynamodb.Table(os.environ['ALBUMS_TABLE'])


def handler(event, context):
    """
    Get album by ID
    """
    try:
        # Get album ID from path parameters
        album_id = get_path_parameter(event, 'albumId')
        if not album_id:
            return generate_response(400, {"error": "Album ID is required"})

        # Query DynamoDB
        response = albums_table.get_item(
            Key={
                'PK': f"ALBUM#{album_id}",
                'SK': 'METADATA'
            }
        )

        # Check if album exists
        if 'Item' not in response:
            return generate_response(404, {"error": "Album not found"})

        # Convert DynamoDB item to Album object
        album = Album.from_dynamodb_item(response['Item'])

        return generate_response(200, {
            "album": album.to_dict()
        })

    except Exception as e:
        print(f"Error getting album: {str(e)}")
        return generate_response(500, {"error": "Internal server error"})