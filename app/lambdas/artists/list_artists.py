import os
import boto3
from boto3.dynamodb.conditions import Key
from utils import generate_response, get_query_parameter
from models import Artist

dynamodb = boto3.resource('dynamodb')
artists_table = dynamodb.Table(os.environ['ARTISTS_TABLE'])


def handler(event, context):
    """
    List all artists or filter by genre
    """
    try:
        # Check if genre filter is provided
        genre = get_query_parameter(event, 'genre')

        if genre:
            # Filter by genre using GSI
            response = artists_table.query(
                IndexName='GenreIndex',
                KeyConditionExpression=Key('GSI1PK').eq(f"GENRE#{genre}"),
                ScanIndexForward=True,
                Limit=50  # Pagination support
            )
        else:
            # Get all artists
            response = artists_table.scan(
                FilterExpression='SK = :metadata',
                ExpressionAttributeValues={
                    ':metadata': 'METADATA'
                },
                Limit=50  # Pagination support
            )

        # Convert DynamoDB items to Artist objects
        artists = []
        for item in response.get('Items', []):
            try:
                artist = Artist.from_dynamodb_item(item)
                artists.append(artist.to_dict())
            except Exception as e:
                print(f"Error converting artist item: {str(e)}")
                continue

        return generate_response(200, {
            "artists": artists,
            "count": len(artists)
        })

    except Exception as e:
        print(f"Error listing artists: {str(e)}")
        return generate_response(500, {"error": "Internal server error"})