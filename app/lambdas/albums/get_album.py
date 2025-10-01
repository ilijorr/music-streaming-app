import os
import json
import boto3
from boto3.dynamodb.conditions import Attr
from botocore.exceptions import ClientError
from utils import generate_response, get_path_parameter
from models import Album, Song

# Environment variables
TABLE_NAME = os.environ.get('TABLE_NAME')

# AWS clients
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(TABLE_NAME)


def lambda_handler(event, context):
    """
    Get a specific album by ID with all its songs (Admins and Users).

    GET /albums/{id}
    """
    print(f"Received event: {json.dumps(event)}")

    try:
        # Get album ID from path parameters
        album_id = get_path_parameter(event, 'id')

        if not album_id:
            return generate_response(400, {
                'error': 'Bad Request',
                'message': 'Album ID is required'
            })

        # Query DynamoDB for album metadata
        pk = f"ALBUM#{album_id}"
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
                'message': f'Album with ID {album_id} not found'
            })

        # Convert to Album object
        item = response['Item']
        album = Album.from_dynamodb_item(item)

        # Query all songs that belong to this album
        print(f"Querying songs for album: {album_id}")

        try:
            songs_response = table.scan(
                FilterExpression=Attr('PK').begins_with('SONG#') &
                                Attr('SK').eq('METADATA') &
                                Attr('albumId').eq(album_id)
            )

            song_items = songs_response.get('Items', [])

            # Handle pagination
            while 'LastEvaluatedKey' in songs_response:
                songs_response = table.scan(
                    FilterExpression=Attr('PK').begins_with('SONG#') &
                                    Attr('SK').eq('METADATA') &
                                    Attr('albumId').eq(album_id),
                    ExclusiveStartKey=songs_response['LastEvaluatedKey']
                )
                song_items.extend(songs_response.get('Items', []))

            # Convert songs to dictionaries
            songs = []
            for song_item in song_items:
                try:
                    song = Song.from_dynamodb_item(song_item)
                    songs.append(song.to_dict())
                except Exception as e:
                    print(f"Error parsing song: {str(e)}")
                    continue

            album.songs = songs
            print(f"Found {len(songs)} songs in album")

        except Exception as e:
            print(f"Error querying songs: {str(e)}")
            # Continue without songs

        print(f"Found album: {album_id}")

        return generate_response(200, {
            'album': album.to_dict()
        })

    except Exception as e:
        print(f"Error getting album: {str(e)}")
        return generate_response(500, {
            'error': 'Internal Server Error',
            'message': str(e)
        })