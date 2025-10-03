import os
import json
import uuid
import boto3
from utils import (
    generate_response,
    is_admin,
    parse_body,
    validate_required_fields,
    generate_presigned_url
)

s3_client = boto3.client('s3')
BUCKET_NAME = os.environ.get('BUCKET_NAME')


def lambda_handler(event, context):
    """
    Generate presigned URLs for direct S3 upload (Admin only).

    POST /songs/presigned-url
    Body: {fileType, fileName, fileSize}
    Returns: {uploadUrl, key, fields}
    """
    print(f"Received event: {json.dumps(event)}")

    try:
        if not is_admin(event):
            return generate_response(403, {
                'error': 'Forbidden',
                'message': 'Only administrators can upload songs'
            })

        try:
            body = parse_body(event)
        except ValueError as e:
            return generate_response(400, {
                'error': 'Bad Request',
                'message': str(e)
            })

    # Validate required fields
        required_fields = ['fileName', 'fileType']
        validation_error = validate_required_fields(body, required_fields)
        if validation_error:
            return generate_response(400, {
                'error': 'Bad Request',
                'message': validation_error
            })

        filename = body['fileName']
        file_type = body['fileType']

        allowed_audio_types = [
                'audio/mpeg',
                'audio/wav',
                'audio/mp4',
                'audio/x-m4a'
                ]
        if file_type not in allowed_audio_types:
            return generate_response(400, {
                'error': 'Bad Request',
                'message': f'Invalid file type. Allowed: {allowed_audio_types}'
            })

        # Generate unique S3 key
        song_id = str(uuid.uuid4())
        s3_key = f"songs/{song_id}/{filename}"

        # Generate presigned URL for upload (valid for 1 hour)
        presigned_url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': BUCKET_NAME,
                'Key': s3_key,
                'ContentType': file_type
            },
            ExpiresIn=3600
        )

        return generate_response(200, {
            'uploadUrl': presigned_url,
            'key': s3_key,
            'fileId': song_id,
            'expiresIn': 3600,
            'fields': {}  # For POST form uploads, but we're using PUT
        })

    except Exception as e:
        print(f"Error generating upload URL: {str(e)}")
        return generate_response(500, {
            'error': 'Internal Server Error',
            'message': str(e)
        })
