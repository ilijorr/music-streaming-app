import os
import json
import uuid
import boto3
from botocore.exceptions import ClientError
from utils import (
    generate_response,
    is_admin,
    parse_body
)

# Environment variables
BUCKET_NAME = os.environ.get('BUCKET_NAME')

# AWS clients
s3_client = boto3.client('s3')


def lambda_handler(event, context):
    """
    Generate presigned URLs for direct S3 upload (Admin only).

    POST /songs/presigned-url
    Body: {fileType, fileName, fileSize}
    Returns: {uploadUrl, key, fields}
    """
    print(f"Received event: {json.dumps(event)}")

    try:
        # Check authorization - Admin only
        if not is_admin(event):
            return generate_response(403, {
                'error': 'Forbidden',
                'message': 'Only administrators can upload songs'
            })

        # Parse request body
        try:
            body = parse_body(event)
        except ValueError as e:
            return generate_response(400, {
                'error': 'Bad Request',
                'message': str(e)
            })

        # Extract and validate fields
        file_type = body.get('fileType', '').strip()
        file_name = body.get('fileName', '').strip()
        file_size = body.get('fileSize', 0)
        upload_type = body.get('uploadType', 'song')  # 'song' or 'cover'

        if not file_type:
            return generate_response(400, {
                'error': 'Bad Request',
                'message': 'fileType is required'
            })

        if not file_name:
            return generate_response(400, {
                'error': 'Bad Request',
                'message': 'fileName is required'
            })

        if file_size <= 0:
            return generate_response(400, {
                'error': 'Bad Request',
                'message': 'fileSize must be a positive number'
            })

        # Validate file type based on upload type
        if upload_type == 'song':
            if not file_type.startswith('audio/'):
                return generate_response(400, {
                    'error': 'Bad Request',
                    'message': 'Invalid file type for audio upload'
                })
            # Check file size limit for audio (100MB)
            max_size = 100 * 1024 * 1024  # 100MB
            if file_size > max_size:
                return generate_response(400, {
                    'error': 'Bad Request',
                    'message': 'Audio file size cannot exceed 100MB'
                })
        elif upload_type == 'cover':
            if not file_type.startswith('image/'):
                return generate_response(400, {
                    'error': 'Bad Request',
                    'message': 'Invalid file type for image upload'
                })
            # Check file size limit for images (10MB)
            max_size = 10 * 1024 * 1024  # 10MB
            if file_size > max_size:
                return generate_response(400, {
                    'error': 'Bad Request',
                    'message': 'Image file size cannot exceed 10MB'
                })
        else:
            return generate_response(400, {
                'error': 'Bad Request',
                'message': 'uploadType must be either "song" or "cover"'
            })

        # Generate unique file key
        file_id = str(uuid.uuid4())

        # Determine file extension
        ext = get_file_extension(file_type, file_name)

        # Create S3 key based on upload type
        if upload_type == 'song':
            s3_key = f"songs/{file_id}{ext}"
        else:  # cover
            s3_key = f"covers/{file_id}{ext}"

        # Generate presigned POST URL
        try:
            # Set conditions for the upload
            conditions = [
                {"bucket": BUCKET_NAME},
                {"key": s3_key},
                {"Content-Type": file_type},
                ["content-length-range", file_size, file_size]  # Exact file size
            ]

            # Generate presigned POST
            response = s3_client.generate_presigned_post(
                Bucket=BUCKET_NAME,
                Key=s3_key,
                Fields={
                    "Content-Type": file_type
                },
                Conditions=conditions,
                ExpiresIn=3600  # 1 hour expiration
            )

            return generate_response(200, {
                'uploadUrl': response['url'],
                'fields': response['fields'],
                'key': s3_key,
                'fileId': file_id,
                'expiresIn': 3600
            })

        except ClientError as e:
            print(f"Error generating presigned URL: {str(e)}")
            return generate_response(500, {
                'error': 'Internal Server Error',
                'message': 'Failed to generate upload URL'
            })

    except Exception as e:
        print(f"Error in presigned URL handler: {str(e)}")
        return generate_response(500, {
            'error': 'Internal Server Error',
            'message': str(e)
        })


def get_file_extension(file_type, file_name):
    """
    Determine the appropriate file extension based on file type and name.
    """
    # Try to get extension from filename first
    if '.' in file_name:
        ext = '.' + file_name.split('.')[-1].lower()
        return ext

    # Fallback to content type mapping
    type_mapping = {
        'audio/mpeg': '.mp3',
        'audio/mp3': '.mp3',
        'audio/wav': '.wav',
        'audio/wave': '.wav',
        'audio/x-wav': '.wav',
        'audio/mp4': '.m4a',
        'audio/x-m4a': '.m4a',
        'audio/aac': '.aac',
        'audio/flac': '.flac',
        'audio/ogg': '.ogg',
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp',
        'image/gif': '.gif'
    }

    return type_mapping.get(file_type, '.bin')