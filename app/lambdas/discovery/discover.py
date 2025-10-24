import os
import boto3
from boto3.dynamodb.conditions import Key
from utils import generate_response, get_query_parameter
from models import Artist, Song, Album

dynamodb = boto3.resource('dynamodb')
artists_table = dynamodb.Table(os.environ['ARTISTS_TABLE'])
songs_table = dynamodb.Table(os.environ['SONGS_TABLE'])
albums_table = dynamodb.Table(os.environ['ALBUMS_TABLE'])


def handler(event, context):
    """
    Discover content by genre - implements the discover page functionality (Task 1.8)

    Query parameters:
    - genre: Genre to filter by (required)
    - type: Type of content to return ('artists', 'albums', 'songs', or 'all') - default: 'all'
    - limit: Maximum number of items to return per type - default: 20
    """
    try:
        # Get genre from query parameters
        genre = get_query_parameter(event, 'genre')
        if not genre:
            return generate_response(400, {"error": "Genre parameter is required"})

        # Normalize genre to match how it's stored in the index
        normalized_genre = genre.upper().replace(' ', '_')

        # Get optional parameters
        content_type = get_query_parameter(event, 'type') or 'all'
        limit = int(get_query_parameter(event, 'limit') or '20')

        result = {
            "genre": genre,
            "normalized_genre": normalized_genre,  # For debugging
            "content_type": content_type
        }

        # Get artists for the genre
        if content_type in ['artists', 'all']:
            try:
                artists_response = artists_table.query(
                    IndexName='GenreIndex',
                    KeyConditionExpression=Key('GSI1PK').eq(f"GENRE#{normalized_genre}"),
                    ScanIndexForward=True,
                    Limit=limit
                )

                artists = []
                for item in artists_response.get('Items', []):
                    try:
                        # For genre index items, we need to get the full artist data
                        # Either use the data already in the index item, or fetch the main item
                        if 'artist_id' in item:
                            # This is a genre index item with artist data
                            artist = Artist(
                                artist_id=item['artist_id'],
                                name=item['name'],
                                biography=item.get('biography', ''),
                                genres=item.get('genres', []),
                                image_url=item.get('image_url')
                            )
                            artists.append(artist.to_dict())
                        else:
                            # Fallback: fetch the main artist item
                            artist_id = item['SK'].replace('ARTIST#', '')
                            main_item = artists_table.get_item(
                                Key={'PK': f'ARTIST#{artist_id}', 'SK': f'ARTIST#{artist_id}'}
                            ).get('Item')
                            if main_item:
                                artist = Artist.from_dynamodb_item(main_item)
                                artists.append(artist.to_dict())
                    except Exception as e:
                        print(f"Error converting artist item: {str(e)}")
                        continue

                result['artists'] = {
                    'items': artists,
                    'count': len(artists)
                }
            except Exception as e:
                print(f"Error querying artists: {str(e)}")
                result['artists'] = {'items': [], 'count': 0}

        # Get albums for the genre
        if content_type in ['albums', 'all']:
            try:
                albums_response = albums_table.query(
                    IndexName='GenreIndex',
                    KeyConditionExpression=Key('GSI2PK').eq(f"GENRE#{normalized_genre}"),
                    ScanIndexForward=True,
                    Limit=limit
                )

                albums = []
                for item in albums_response.get('Items', []):
                    try:
                        album = Album.from_dynamodb_item(item)
                        albums.append(album.to_dict())
                    except Exception as e:
                        print(f"Error converting album item: {str(e)}")
                        continue

                result['albums'] = {
                    'items': albums,
                    'count': len(albums)
                }
            except Exception as e:
                print(f"Error querying albums: {str(e)}")
                result['albums'] = {'items': [], 'count': 0}

        # Get songs for the genre
        if content_type in ['songs', 'all']:
            try:
                songs_response = songs_table.query(
                    IndexName='GenreIndex',
                    KeyConditionExpression=Key('GSI2PK').eq(f"GENRE#{normalized_genre}"),
                    ScanIndexForward=True,
                    Limit=limit
                )

                songs = []
                for item in songs_response.get('Items', []):
                    try:
                        song = Song.from_dynamodb_item(item)
                        songs.append(song.to_dict())
                    except Exception as e:
                        print(f"Error converting song item: {str(e)}")
                        continue

                result['songs'] = {
                    'items': songs,
                    'count': len(songs)
                }
            except Exception as e:
                print(f"Error querying songs: {str(e)}")
                result['songs'] = {'items': [], 'count': 0}

        # Calculate total count
        total_count = 0
        if 'artists' in result:
            total_count += result['artists']['count']
        if 'albums' in result:
            total_count += result['albums']['count']
        if 'songs' in result:
            total_count += result['songs']['count']

        result['total_count'] = total_count

        return generate_response(200, result)

    except ValueError as e:
        return generate_response(400, {"error": str(e)})
    except Exception as e:
        print(f"Error in discover function: {str(e)}")
        return generate_response(500, {"error": "Internal server error"})
