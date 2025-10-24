import os
import boto3
from boto3.dynamodb.conditions import Key
from utils import generate_response, is_admin, get_path_parameter

dynamodb = boto3.resource('dynamodb')
albums_table = dynamodb.Table(os.environ['ALBUMS_TABLE'])
songs_table = dynamodb.Table(os.environ['SONGS_TABLE'])
s3_client = boto3.client('s3')


def handler(event, context):
    """
    Delete an album and all its songs (Admin only)
    """
    try:
        # Check if user is admin
        if not is_admin(event):
            return generate_response(403, {"error": "Access denied. Admin privileges required."})

        # Get album ID from path parameters
        album_id = get_path_parameter(event, 'albumId')
        if not album_id:
            return generate_response(400, {"error": "Album ID is required"})

        # Check if album exists
        response = albums_table.get_item(
            Key={
                'PK': f"ALBUM#{album_id}",
                'SK': 'METADATA'
            }
        )

        if 'Item' not in response:
            return generate_response(404, {"error": "Album not found"})

        album_item = response['Item']

        # Delete all songs that belong to this album
        try:
            # Query songs by album using GSI
            songs_response = songs_table.query(
                IndexName='AlbumIndex',
                KeyConditionExpression=Key('GSI3PK').eq(f"ALBUM#{album_id}")
            )

            for song_item in songs_response.get('Items', []):
                # Delete song audio file from S3
                if 'fileUrl' in song_item and song_item['fileUrl'].startswith('s3://'):
                    s3_key = song_item['fileUrl'].replace(f"s3://{os.environ['MEDIA_BUCKET']}/", "")
                    try:
                        s3_client.delete_object(
                            Bucket=os.environ['MEDIA_BUCKET'],
                            Key=s3_key
                        )
                    except Exception as e:
                        print(f"Error deleting song audio file: {str(e)}")

                # Delete song cover image from S3 (if different from album cover)
                if song_item.get('coverUrl') and song_item['coverUrl'].startswith('s3://'):
                    if song_item['coverUrl'] != album_item.get('coverUrl'):
                        s3_key = song_item['coverUrl'].replace(f"s3://{os.environ['IMAGES_BUCKET']}/", "")
                        try:
                            s3_client.delete_object(
                                Bucket=os.environ['IMAGES_BUCKET'],
                                Key=s3_key
                            )
                        except Exception as e:
                            print(f"Error deleting song cover image: {str(e)}")

                # Delete song from DynamoDB
                songs_table.delete_item(
                    Key={
                        'PK': song_item['PK'],
                        'SK': song_item['SK']
                    }
                )

        except Exception as e:
            print(f"Error deleting album songs: {str(e)}")

        # Delete album cover image from S3 if exists
        if album_item.get('coverUrl') and album_item['coverUrl'].startswith('s3://'):
            s3_key = album_item['coverUrl'].replace(f"s3://{os.environ['IMAGES_BUCKET']}/", "")
            try:
                s3_client.delete_object(
                    Bucket=os.environ['IMAGES_BUCKET'],
                    Key=s3_key
                )
            except Exception as e:
                print(f"Error deleting album cover image: {str(e)}")

        # Delete album from DynamoDB (main entry)
        albums_table.delete_item(
            Key={
                'PK': f"ALBUM#{album_id}",
                'SK': 'METADATA'
            }
        )

        # Delete album from GSI entries
        # Note: In a production environment, you might want to scan for all GSI entries
        # For simplicity, we'll attempt to delete known GSI entries

        # Clean up artist GSI entries
        if 'artistIds' in album_item:
            for artist_id in album_item['artistIds']:
                try:
                    albums_table.delete_item(
                        Key={
                            'PK': f"ALBUM#{album_id}",
                            'SK': 'METADATA'
                        },
                        ConditionExpression='attribute_exists(GSI1PK)'
                    )
                except:
                    # Ignore if item doesn't exist
                    pass

        # Clean up genre GSI entries
        if 'genres' in album_item:
            for genre in album_item['genres']:
                try:
                    albums_table.delete_item(
                        Key={
                            'PK': f"ALBUM#{album_id}",
                            'SK': 'METADATA'
                        },
                        ConditionExpression='attribute_exists(GSI2PK)'
                    )
                except:
                    # Ignore if item doesn't exist
                    pass

        return generate_response(200, {
            "message": "Album and all associated songs deleted successfully"
        })

    except Exception as e:
        print(f"Error deleting album: {str(e)}")
        return generate_response(500, {"error": "Internal server error"})