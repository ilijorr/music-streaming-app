import os
import boto3
from utils import generate_response, get_path_parameter
from models import Song

dynamodb = boto3.resource('dynamodb')
songs_table = dynamodb.Table(os.environ['SONGS_TABLE'])


def handler(event, context):
    """
    Get song by ID
    """
    try:
        # Get song ID from path parameters
        song_id = get_path_parameter(event, 'songId')
        if not song_id:
            return generate_response(400, {"error": "Song ID is required"})

        # Query DynamoDB
        response = songs_table.get_item(
            Key={
                'PK': f"SONG#{song_id}",
                'SK': 'METADATA'
            }
        )

        # Check if song exists
        if 'Item' not in response:
            return generate_response(404, {"error": "Song not found"})

        # Convert DynamoDB item to Song object
        song = Song.from_dynamodb_item(response['Item'])

        return generate_response(200, {
            "song": song.to_dict()
        })

    except Exception as e:
        print(f"Error getting song: {str(e)}")
        return generate_response(500, {"error": "Internal server error"})