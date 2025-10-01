import os
import json
import boto3
from boto3.dynamodb.conditions import Key, Attr
from utils import generate_response
from models import Artist

# Environment variables
TABLE_NAME = os.environ.get('TABLE_NAME')

# AWS clients
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(TABLE_NAME)


def lambda_handler(event, context):
    """
    List all artists (Admins and Users).

    GET /artists
    """
    print(f"Received event: {json.dumps(event)}")

    try:
        # Scan table for all items where PK starts with "ARTIST#" and SK = "METADATA"
        response = table.scan(
            FilterExpression=Attr('PK').begins_with('ARTIST#') & Attr('SK').eq('METADATA')
        )

        items = response.get('Items', [])

        # Handle pagination if needed
        while 'LastEvaluatedKey' in response:
            response = table.scan(
                FilterExpression=Attr('PK').begins_with('ARTIST#') & Attr('SK').eq('METADATA'),
                ExclusiveStartKey=response['LastEvaluatedKey']
            )
            items.extend(response.get('Items', []))

        # Convert items to Artist objects
        artists = []
        for item in items:
            try:
                artist = Artist.from_dynamodb_item(item)
                artists.append(artist.to_dict())
            except Exception as e:
                print(f"Error parsing artist item: {str(e)}")
                continue

        print(f"Found {len(artists)} artists")

        return generate_response(200, {
            'artists': artists,
            'count': len(artists)
        })

    except Exception as e:
        print(f"Error listing artists: {str(e)}")
        return generate_response(500, {
            'error': 'Internal Server Error',
            'message': str(e)
        })