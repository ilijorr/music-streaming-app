import os
import json
import boto3
from boto3.dynamodb.conditions import Key
from utils import generate_response

# Environment variables
TABLE_NAME = os.environ.get('TABLE_NAME')

# AWS clients
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(TABLE_NAME)


def lambda_handler(event, context):
    """
    List all albums.

    GET /albums
    """
    print(f"Received event: {json.dumps(event)}")

    try:
        # Query all albums from DynamoDB
        # Albums are stored with PK="ALBUM#{albumId}" and SK="METADATA"
        response = table.scan(
            FilterExpression='begins_with(PK, :pk_prefix) AND SK = :sk',
            ExpressionAttributeValues={
                ':pk_prefix': 'ALBUM#',
                ':sk': 'METADATA'
            }
        )

        albums = response.get('Items', [])

        # Handle pagination if there are more items
        while 'LastEvaluatedKey' in response:
            response = table.scan(
                FilterExpression='begins_with(PK, :pk_prefix) AND SK = :sk',
                ExpressionAttributeValues={
                    ':pk_prefix': 'ALBUM#',
                    ':sk': 'METADATA'
                },
                ExclusiveStartKey=response['LastEvaluatedKey']
            )
            albums.extend(response.get('Items', []))

        print(f"Found {len(albums)} albums")

        # Clean up the response - remove DynamoDB keys
        cleaned_albums = []
        for album in albums:
            cleaned_album = {
                'albumId': album.get('albumId'),
                'title': album.get('title'),
                'artistIds': album.get('artistIds', []),
                'releaseDate': album.get('releaseDate'),
                'genres': album.get('genres', []),
                'coverUrl': album.get('coverUrl'),
                'createdAt': album.get('createdAt'),
                'updatedAt': album.get('updatedAt')
            }
            cleaned_albums.append(cleaned_album)

        return generate_response(200, {
            'albums': cleaned_albums,
            'count': len(cleaned_albums)
        })

    except Exception as e:
        print(f"Error listing albums: {str(e)}")
        return generate_response(500, {
            'error': 'Internal Server Error',
            'message': str(e)
        })
