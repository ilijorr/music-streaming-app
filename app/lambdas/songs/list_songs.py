import os
import json
import boto3
from boto3.dynamodb.conditions import Key, Attr
from utils import generate_response, get_query_parameter
from models import Song

# Environment variables
TABLE_NAME = os.environ.get('TABLE_NAME')

# AWS clients
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(TABLE_NAME)


def lambda_handler(event, context):
    """
    List songs with optional filtering (Admins and Users).

    GET /songs?genre=...&artistId=...&albumId=...
    """
    print(f"Received event: {json.dumps(event)}")

    try:
        # Get query parameters
        genre = get_query_parameter(event, 'genre')
        artist_id = get_query_parameter(event, 'artistId')
        album_id = get_query_parameter(event, 'albumId')

        songs = []

        # If genre is specified, use GSI
        if genre:
            print(f"Querying by genre: {genre}")
            response = table.query(
                IndexName='GSI1',
                KeyConditionExpression=Key('GSI1PK').eq(f"GENRE#{genre}") & Key('GSI1SK').begins_with('SONG#')
            )

            # Get song IDs from GSI
            song_ids = [item['songId'] for item in response.get('Items', [])]

            # Fetch full song metadata
            for song_id in song_ids:
                try:
                    song_response = table.get_item(
                        Key={
                            'PK': f"SONG#{song_id}",
                            'SK': 'METADATA'
                        }
                    )
                    if 'Item' in song_response:
                        songs.append(song_response['Item'])
                except Exception as e:
                    print(f"Error fetching song {song_id}: {str(e)}")
                    continue

        else:
            # Scan for all songs
            print("Scanning all songs")
            response = table.scan(
                FilterExpression=Attr('PK').begins_with('SONG#') & Attr('SK').eq('METADATA')
            )

            songs = response.get('Items', [])

            # Handle pagination
            while 'LastEvaluatedKey' in response:
                response = table.scan(
                    FilterExpression=Attr('PK').begins_with('SONG#') & Attr('SK').eq('METADATA'),
                    ExclusiveStartKey=response['LastEvaluatedKey']
                )
                songs.extend(response.get('Items', []))

        # Filter by artist ID if specified
        if artist_id:
            songs = [
                song for song in songs
                if artist_id in song.get('artistIds', [])
            ]

        # Filter by album ID if specified
        if album_id:
            songs = [
                song for song in songs
                if song.get('albumId') == album_id
            ]

        # Convert to Song objects
        song_list = []
        for item in songs:
            try:
                song = Song.from_dynamodb_item(item)
                song_list.append(song.to_dict())
            except Exception as e:
                print(f"Error parsing song item: {str(e)}")
                continue

        print(f"Found {len(song_list)} songs")

        return generate_response(200, {
            'songs': song_list,
            'count': len(song_list)
        })

    except Exception as e:
        print(f"Error listing songs: {str(e)}")
        return generate_response(500, {
            'error': 'Internal Server Error',
            'message': str(e)
        })