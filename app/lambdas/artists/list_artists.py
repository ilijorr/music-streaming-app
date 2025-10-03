import json
import os
import boto3
from utils import generate_response, get_query_parameter
from models.Artist import Artist

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['TABLE_NAME'])


def lambda_handler(event, context):
    """
    List all artists with optional genre filtering

    GET /artists
    Query Parameters:
      - genre (optional): Filter by genre (automatically normalized)
    """
    print(f"Received event: {json.dumps(event)}")

    try:
        # Get and normalize genre parameter
        genre = get_query_parameter(event, 'genre')
        normalized_genre = normalize_genre(genre) if genre else None

        if normalized_genre:
            # Query by genre using GSI (KEYS_ONLY projection)
            response = table.query(
                IndexName='GenreEntityIndex',
                KeyConditionExpression=boto3.dynamodb.conditions.Key('GSI1PK').eq(f'GENRE#{normalized_genre}') & \
                                     boto3.dynamodb.conditions.Key('GSI1SK').begins_with('ARTIST#')
            )
            print(f"Querying artists by genre: {normalized_genre}")

            # Extract artist IDs from GSI response
            artist_ids = []
            for item in response.get('Items', []):
                artist_id = item['GSI1SK'].replace('ARTIST#', '')
                artist_ids.append(artist_id)

            # Batch get full artist details
            artists = batch_get_artists(artist_ids)

        else:
            # Scan for all artists (since we can't use begins_with on partition key)
            response = table.scan(
                FilterExpression=boto3.dynamodb.conditions.Attr('PK').begins_with('ARTIST#') & \
                               boto3.dynamodb.conditions.Attr('SK').eq('METADATA')
            )
            artists = []
            for item in response.get('Items', []):
                try:
                    artist = Artist.from_dynamodb_item(item)
                    artists.append(artist.to_dict())
                except Exception as e:
                    print(f"Error parsing artist item: {str(e)}")
                    continue
            print("Querying all artists")

        return generate_response(200, {
            'artists': artists,
            'count': len(artists),
            'genre': normalized_genre if normalized_genre else 'all'
        })

    except Exception as e:
        print(f"Error listing artists: {str(e)}")
        return generate_response(500, {
            'error': 'Internal Server Error',
            'message': str(e)
        })


def batch_get_artists(artist_ids):
    """Batch get full artist details from main table"""
    if not artist_ids:
        return []

    artists = []
    try:
        # DynamoDB batch_get_item can handle up to 100 items
        for i in range(0, len(artist_ids), 100):
            batch_ids = artist_ids[i:i + 100]

            keys = [{'PK': f'ARTIST#{artist_id}', 'SK': 'METADATA'} for artist_id in batch_ids]

            response = dynamodb.batch_get_item(
                RequestItems={
                    table.table_name: {
                        'Keys': keys
                    }
                }
            )

            for item in response['Responses'][table.table_name]:
                try:
                    artist = Artist.from_dynamodb_item(item)
                    artists.append(artist.to_dict())
                except Exception as e:
                    print(f"Error parsing artist item: {str(e)}")
                    continue

    except Exception as e:
        print(f"Error in batch_get_artists: {str(e)}")

    return artists


def normalize_genre(genre):
    """Normalize genre string: lowercase, strip"""
    if not genre:
        return None

    # Convert to lowercase and strip whitespace
    normalized = genre.lower().strip()

    print(f"Normalized genre '{genre}' to '{normalized}'")
    return normalized