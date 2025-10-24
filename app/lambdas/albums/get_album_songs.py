import os
import boto3
from boto3.dynamodb.conditions import Key
from utils import generate_response, get_path_parameter
from models import Song

dynamodb = boto3.resource('dynamodb')
songs_table = dynamodb.Table(os.environ['SONGS_TABLE'])


def handler(event, context):
    """
    Get all songs for a specific album
    """
    try:
        # Get album ID from path parameters
        album_id = get_path_parameter(event, 'albumId')
        if not album_id:
            return generate_response(400, {"error": "Album ID is required"})

        # Query songs by album using GSI
        response = songs_table.query(
            IndexName='AlbumIndex',
            KeyConditionExpression=Key('GSI3PK').eq(f"ALBUM#{album_id}"),
            ScanIndexForward=True
        )

        # Convert DynamoDB items to Song objects
        songs = []
        for item in response.get('Items', []):
            try:
                song = Song.from_dynamodb_item(item)
                songs.append(song.to_dict())
            except Exception as e:
                print(f"Error converting song item: {str(e)}")
                continue

        # Sort by track number if available
        songs.sort(key=lambda x: x.get('trackNumber', 999))

        return generate_response(200, {
            "album_id": album_id,
            "songs": songs,
            "count": len(songs)
        })

    except Exception as e:
        print(f"Error getting album songs: {str(e)}")
        return generate_response(500, {"error": "Internal server error"})