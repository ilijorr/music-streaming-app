import os
import boto3
from utils import generate_response, get_path_parameter, generate_presigned_url

dynamodb = boto3.resource('dynamodb')
songs_table = dynamodb.Table(os.environ['SONGS_TABLE'])


def handler(event, context):
    """
    Get presigned URL for streaming a song
    """
    try:
        # Get song ID from path parameters
        song_id = get_path_parameter(event, 'songId')
        if not song_id:
            return generate_response(400, {"error": "Song ID is required"})

        # Query DynamoDB to get song info
        response = songs_table.get_item(
            Key={
                'PK': f"SONG#{song_id}",
                'SK': 'METADATA'
            }
        )

        # Check if song exists
        if 'Item' not in response:
            return generate_response(404, {"error": "Song not found"})

        song_item = response['Item']

        # Check if file URL exists
        if 'fileUrl' not in song_item:
            return generate_response(404, {"error": "Song file not found"})

        file_url = song_item['fileUrl']

        # Extract S3 key from URL
        if not file_url.startswith('s3://'):
            return generate_response(400, {"error": "Invalid file URL format"})

        s3_key = file_url.replace(f"s3://{os.environ['MEDIA_BUCKET']}/", "")

        # Generate presigned URL (valid for 1 hour)
        try:
            stream_url = generate_presigned_url(
                bucket=os.environ['MEDIA_BUCKET'],
                key=s3_key,
                expiration=3600
            )
        except Exception as e:
            return generate_response(500, {"error": f"Failed to generate stream URL: {str(e)}"})

        return generate_response(200, {
            "song_id": song_id,
            "title": song_item.get('title', 'Unknown'),
            "stream_url": stream_url,
            "expires_in": 3600
        })

    except Exception as e:
        print(f"Error getting stream URL: {str(e)}")
        return generate_response(500, {"error": "Internal server error"})