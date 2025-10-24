import os
import boto3
from boto3.dynamodb.conditions import Key
from utils import generate_response, is_admin, get_path_parameter

dynamodb = boto3.resource('dynamodb')
artists_table = dynamodb.Table(os.environ['ARTISTS_TABLE'])
songs_table = dynamodb.Table(os.environ['SONGS_TABLE'])
albums_table = dynamodb.Table(os.environ['ALBUMS_TABLE'])
s3_client = boto3.client('s3')


def handler(event, context):
    """
    Delete an artist and all associated content (Admin only)
    """
    try:
        # Check if user is admin
        if not is_admin(event):
            return generate_response(403, {"error": "Access denied. Admin privileges required."})

        # Get artist ID from path parameters
        artist_id = get_path_parameter(event, 'artistId')
        if not artist_id:
            return generate_response(400, {"error": "Artist ID is required"})

        # Check if artist exists
        response = artists_table.get_item(
            Key={
                'PK': f"ARTIST#{artist_id}",
                'SK': 'METADATA'
            }
        )

        if 'Item' not in response:
            return generate_response(404, {"error": "Artist not found"})

        artist_item = response['Item']

        # Delete associated songs
        try:
            # Query songs by this artist using GSI
            songs_response = songs_table.query(
                IndexName='ArtistIndex',
                KeyConditionExpression=Key('GSI1PK').eq(f"ARTIST#{artist_id}")
            )

            for song_item in songs_response.get('Items', []):
                # Delete song from S3
                if 'fileUrl' in song_item and song_item['fileUrl'].startswith('s3://'):
                    s3_key = song_item['fileUrl'].replace(f"s3://{os.environ['MEDIA_BUCKET']}/", "")
                    try:
                        s3_client.delete_object(
                            Bucket=os.environ['MEDIA_BUCKET'],
                            Key=s3_key
                        )
                    except Exception as e:
                        print(f"Error deleting song S3 object: {str(e)}")

                # Delete song from DynamoDB
                songs_table.delete_item(
                    Key={
                        'PK': song_item['PK'],
                        'SK': song_item['SK']
                    }
                )

        except Exception as e:
            print(f"Error deleting associated songs: {str(e)}")

        # Delete associated albums
        try:
            # Query albums by this artist using GSI
            albums_response = albums_table.query(
                IndexName='ArtistIndex',
                KeyConditionExpression=Key('GSI1PK').eq(f"ARTIST#{artist_id}")
            )

            for album_item in albums_response.get('Items', []):
                # Delete album from DynamoDB
                albums_table.delete_item(
                    Key={
                        'PK': album_item['PK'],
                        'SK': album_item['SK']
                    }
                )

        except Exception as e:
            print(f"Error deleting associated albums: {str(e)}")

        # Delete artist image from S3 if exists
        if artist_item.get('imageUrl') and artist_item['imageUrl'].startswith('s3://'):
            s3_key = artist_item['imageUrl'].replace(f"s3://{os.environ['IMAGES_BUCKET']}/", "")
            try:
                s3_client.delete_object(
                    Bucket=os.environ['IMAGES_BUCKET'],
                    Key=s3_key
                )
            except Exception as e:
                print(f"Error deleting artist image: {str(e)}")

        # Delete artist from DynamoDB (main entry)
        artists_table.delete_item(
            Key={
                'PK': f"ARTIST#{artist_id}",
                'SK': 'METADATA'
            }
        )

        # Delete artist from genre GSI entries
        # Note: In a production environment, you might want to scan for all genre entries
        # For simplicity, we'll delete known genre entries
        if 'genres' in artist_item:
            for genre in artist_item['genres']:
                try:
                    artists_table.delete_item(
                        Key={
                            'PK': f"ARTIST#{artist_id}",
                            'SK': 'METADATA'
                        },
                        ConditionExpression='attribute_exists(GSI1PK)'
                    )
                except:
                    # Ignore if item doesn't exist
                    pass

        return generate_response(200, {
            "message": "Artist and associated content deleted successfully"
        })

    except Exception as e:
        print(f"Error deleting artist: {str(e)}")
        return generate_response(500, {"error": "Internal server error"})