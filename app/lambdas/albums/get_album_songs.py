import os
import json
import boto3
from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError
from utils import generate_response, get_path_parameter

# Environment variables
TABLE_NAME = os.environ.get('TABLE_NAME')

# AWS clients
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(TABLE_NAME)


def lambda_handler(event, context):
    """
    Get all songs for a specific album.

    GET /albums/{id}/songs
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

        # First, verify the album exists
        pk = f"ALBUM#{album_id}"
        sk = "METADATA"

        try:
            album_response = table.get_item(
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

        if 'Item' not in album_response:
            return generate_response(404, {
                'error': 'Not Found',
                'message': f'Album with ID {album_id} not found'
            })

        # Query for all songs that belong to this album
        # Songs with albumId are stored as SONG#{songId} with SK=METADATA
        # We need to scan for all songs first, then filter by albumId
        try:
            # Scan for all songs
            response = table.scan(
                FilterExpression=Attr('PK').begins_with('SONG#') & Attr('SK').eq('METADATA')
            )

            all_songs = response.get('Items', [])

            # Handle pagination if there are more items
            while 'LastEvaluatedKey' in response:
                response = table.scan(
                    FilterExpression=Attr('PK').begins_with('SONG#') & Attr('SK').eq('METADATA'),
                    ExclusiveStartKey=response['LastEvaluatedKey']
                )
                all_songs.extend(response.get('Items', []))

            # Filter by album ID
            songs = [
                song for song in all_songs
                if song.get('albumId') == album_id
            ]

            print(f"Found {len(songs)} songs for album {album_id} out of {len(all_songs)} total songs")

            # Clean up the response - remove DynamoDB keys
            cleaned_songs = []
            for song in songs:
                cleaned_song = {
                    'songId': song.get('songId'),
                    'title': song.get('title'),
                    'artistIds': song.get('artistIds', []),
                    'genres': song.get('genres', []),
                    'fileUrl': song.get('fileUrl'),
                    'fileName': song.get('fileName'),
                    'fileType': song.get('fileType'),
                    'fileSize': song.get('fileSize'),
                    'fileCreatedAt': song.get('fileCreatedAt'),
                    'fileModifiedAt': song.get('fileModifiedAt'),
                    'featuringArtists': song.get('featuringArtists', []),
                    'coverUrl': song.get('coverUrl'),
                    'duration': song.get('duration'),
                    'albumId': song.get('albumId'),
                    'trackNumber': song.get('trackNumber'),
                    'createdAt': song.get('createdAt'),
                    'updatedAt': song.get('updatedAt')
                }
                cleaned_songs.append(cleaned_song)

            # Sort by track number if available (handle None values)
            cleaned_songs.sort(key=lambda x: x.get('trackNumber') if x.get('trackNumber') is not None else 999)

            return generate_response(200, {
                'songs': cleaned_songs,
                'count': len(cleaned_songs)
            })

        except ClientError as e:
            print(f"Error querying songs: {str(e)}")
            return generate_response(500, {
                'error': 'Internal Server Error',
                'message': 'Failed to query songs'
            })

    except Exception as e:
        print(f"Error getting album songs: {str(e)}")
        return generate_response(500, {
            'error': 'Internal Server Error',
            'message': str(e)
        })
