import os
import boto3
from boto3.dynamodb.conditions import Key
from utils import generate_response, get_query_parameter
from models import Album

dynamodb = boto3.resource('dynamodb')
albums_table = dynamodb.Table(os.environ['ALBUMS_TABLE'])


def handler(event, context):
    """
    List all albums or filter by artist or genre
    """
    try:
        # Check for filter parameters
        artist_id = get_query_parameter(event, 'artist_id')
        genre = get_query_parameter(event, 'genre')

        if artist_id:
            # Filter by artist using GSI
            response = albums_table.query(
                IndexName='ArtistIndex',
                KeyConditionExpression=Key('GSI1PK').eq(f"ARTIST#{artist_id}"),
                ScanIndexForward=True,
                Limit=50
            )
        elif genre:
            # Filter by genre using GSI
            response = albums_table.query(
                IndexName='GenreIndex',
                KeyConditionExpression=Key('GSI2PK').eq(f"GENRE#{genre}"),
                ScanIndexForward=True,
                Limit=50
            )
        else:
            # Get all albums
            response = albums_table.scan(
                FilterExpression='SK = :metadata',
                ExpressionAttributeValues={
                    ':metadata': 'METADATA'
                },
                Limit=50
            )

        # Convert DynamoDB items to Album objects
        albums = []
        for item in response.get('Items', []):
            try:
                album = Album.from_dynamodb_item(item)
                albums.append(album.to_dict())
            except Exception as e:
                print(f"Error converting album item: {str(e)}")
                continue

        return generate_response(200, {
            "albums": albums,
            "count": len(albums)
        })

    except Exception as e:
        print(f"Error listing albums: {str(e)}")
        return generate_response(500, {"error": "Internal server error"})