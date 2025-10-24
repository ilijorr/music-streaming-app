import os
import boto3
from utils import generate_response, is_admin, get_path_parameter

dynamodb = boto3.resource('dynamodb')
songs_table = dynamodb.Table(os.environ['SONGS_TABLE'])
s3_client = boto3.client('s3')


def handler(event, context):
    """
    Delete a song (Admin only)
    """
    try:
        # Check if user is admin
        if not is_admin(event):
            return generate_response(403, {"error": "Access denied. Admin privileges required."})

        # Get song ID from path parameters
        song_id = get_path_parameter(event, 'songId')
        if not song_id:
            return generate_response(400, {"error": "Song ID is required"})

        # Check if song exists
        response = songs_table.get_item(
            Key={
                'PK': f"SONG#{song_id}",
                'SK': 'METADATA'
            }
        )

        if 'Item' not in response:
            return generate_response(404, {"error": "Song not found"})

        song_item = response['Item']

        # Delete audio file from S3
        if 'fileUrl' in song_item and song_item['fileUrl'].startswith('s3://'):
            s3_key = song_item['fileUrl'].replace(f"s3://{os.environ['MEDIA_BUCKET']}/", "")
            try:
                s3_client.delete_object(
                    Bucket=os.environ['MEDIA_BUCKET'],
                    Key=s3_key
                )
            except Exception as e:
                print(f"Error deleting audio file: {str(e)}")

        # Delete cover image from S3 if exists
        if song_item.get('coverUrl') and song_item['coverUrl'].startswith('s3://'):
            s3_key = song_item['coverUrl'].replace(f"s3://{os.environ['IMAGES_BUCKET']}/", "")
            try:
                s3_client.delete_object(
                    Bucket=os.environ['IMAGES_BUCKET'],
                    Key=s3_key
                )
            except Exception as e:
                print(f"Error deleting cover image: {str(e)}")

        # Delete song from DynamoDB (main entry)
        songs_table.delete_item(
            Key={
                'PK': f"SONG#{song_id}",
                'SK': 'METADATA'
            }
        )

        # Delete song from GSI entries
        # Note: In a production environment, you might want to scan for all GSI entries
        # For simplicity, we'll attempt to delete known GSI entries

        # Clean up artist GSI entries
        if 'artistIds' in song_item:
            for artist_id in song_item['artistIds']:
                try:
                    songs_table.delete_item(
                        Key={
                            'PK': f"SONG#{song_id}",
                            'SK': 'METADATA'
                        },
                        ConditionExpression='attribute_exists(GSI1PK)'
                    )
                except:
                    # Ignore if item doesn't exist
                    pass

        # Clean up genre GSI entries
        if 'genres' in song_item:
            for genre in song_item['genres']:
                try:
                    songs_table.delete_item(
                        Key={
                            'PK': f"SONG#{song_id}",
                            'SK': 'METADATA'
                        },
                        ConditionExpression='attribute_exists(GSI2PK)'
                    )
                except:
                    # Ignore if item doesn't exist
                    pass

        # Clean up album GSI entry
        if song_item.get('albumId'):
            try:
                songs_table.delete_item(
                    Key={
                        'PK': f"SONG#{song_id}",
                        'SK': 'METADATA'
                    },
                    ConditionExpression='attribute_exists(GSI3PK)'
                )
            except:
                # Ignore if item doesn't exist
                pass

        return generate_response(200, {
            "message": "Song deleted successfully"
        })

    except Exception as e:
        print(f"Error deleting song: {str(e)}")
        return generate_response(500, {"error": "Internal server error"})