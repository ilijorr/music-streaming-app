import os
import boto3
from utils import generate_response, get_path_parameter
from models import Artist

dynamodb = boto3.resource('dynamodb')
artists_table = dynamodb.Table(os.environ['ARTISTS_TABLE'])


def handler(event, context):
    """
    Get artist by ID
    """
    try:
        # Get artist ID from path parameters
        artist_id = get_path_parameter(event, 'artistId')
        if not artist_id:
            return generate_response(400, {"error": "Artist ID is required"})

        # Query DynamoDB
        response = artists_table.get_item(
            Key={
                'PK': f"ARTIST#{artist_id}",
                'SK': 'METADATA'
            }
        )

        # Check if artist exists
        if 'Item' not in response:
            return generate_response(404, {"error": "Artist not found"})

        # Convert DynamoDB item to Artist object
        artist = Artist.from_dynamodb_item(response['Item'])

        return generate_response(200, {
            "artist": artist.to_dict()
        })

    except Exception as e:
        print(f"Error getting artist: {str(e)}")
        return generate_response(500, {"error": "Internal server error"})