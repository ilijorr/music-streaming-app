import os
import boto3
from boto3.dynamodb.conditions import Key
from utils import generate_response, get_query_parameter
from models import Song

dynamodb = boto3.resource('dynamodb')
songs_table = dynamodb.Table(os.environ['SONGS_TABLE'])


def handler(event, context):
    """
    List all songs or filter by artist, genre, or album
    """
    try:
        # Check for filter parameters
        artist_id = get_query_parameter(event, 'artist_id')
        genre = get_query_parameter(event, 'genre')
        album_id = get_query_parameter(event, 'album_id')

        if artist_id:
            # Filter by artist using GSI
            response = songs_table.query(
                IndexName='ArtistIndex',
                KeyConditionExpression=Key('GSI1PK').eq(f"ARTIST#{artist_id}"),
                ScanIndexForward=True,
                Limit=50
            )
        elif genre:
            # Filter by genre using GSI
            response = songs_table.query(
                IndexName='GenreIndex',
                KeyConditionExpression=Key('GSI2PK').eq(f"GENRE#{genre}"),
                ScanIndexForward=True,
                Limit=50
            )
        elif album_id:
            # Filter by album using GSI
            response = songs_table.query(
                IndexName='AlbumIndex',
                KeyConditionExpression=Key('GSI3PK').eq(f"ALBUM#{album_id}"),
                ScanIndexForward=True,
                Limit=50
            )
        else:
            # Get all songs
            response = songs_table.scan(
                FilterExpression='SK = :metadata',
                ExpressionAttributeValues={
                    ':metadata': 'METADATA'
                },
                Limit=50
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

        return generate_response(200, {
            "songs": songs,
            "count": len(songs)
        })

    except Exception as e:
        print(f"Error listing songs: {str(e)}")
        return generate_response(500, {"error": "Internal server error"})