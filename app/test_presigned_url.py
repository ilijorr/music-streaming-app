#!/usr/bin/env python3

import boto3
import os

def test_presigned_url_generation():
    """Test generating presigned URLs for existing S3 objects"""

    # Set environment variables for testing
    os.environ['IMAGES_BUCKET'] = 'music-streaming-images-752221278142-eu-central-1'

    s3_client = boto3.client('s3')

    try:
        # Test generating a presigned URL for an existing image
        bucket = 'music-streaming-images-752221278142-eu-central-1'
        key = 'albums/0c2746aa-cb80-44bf-b0fd-1af4377f9237/cover/Get_Rich_Or_Die_Tryin\'.JPG'

        url = s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': bucket,
                'Key': key
            },
            ExpiresIn=3600  # 1 hour
        )

        print(f"Generated presigned URL:")
        print(f"Original S3 path: s3://{bucket}/{key}")
        print(f"Presigned URL: {url}")

        return url

    except Exception as e:
        print(f"Error generating presigned URL: {str(e)}")
        return None

if __name__ == "__main__":
    test_presigned_url_generation()