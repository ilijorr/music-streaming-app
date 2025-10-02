import json
import boto3
import base64
from typing import Dict, Any, List, Optional
from datetime import datetime
import os
import mimetypes

s3_client = boto3.client('s3')


def generate_response(
        status_code: int,
        body: Any,
        headers: Optional[Dict] = None) -> Dict:
    """
    Generate standardized API Gateway response with CORS headers.

    Args:
        status_code: HTTP status code
        body: Response body (will be JSON serialized)
        headers: Additional headers

    Returns:
        API Gateway response dictionary
    """
    default_headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    }

    if headers:
        default_headers.update(headers)

    return {
        'statusCode': status_code,
        'headers': default_headers,
        'body': json.dumps(body, default=str)
    }


def validate_required_fields(
        data: Dict,
        required_fields: List[str]) -> Optional[str]:
    """
    Validate that all required fields are present and non-empty in the data.

    Args:
        data: Dictionary to validate
        required_fields: List of required field names

    Returns:
        Error message if validation fails, None otherwise
    """
    for field in required_fields:
        if field not in data:
            return f"Missing required field: {field}"

        value = data[field]

        # Check if value is empty string or empty array
        if isinstance(value, str) and not value.strip():
            return f"Field '{field}' cannot be empty"
        elif isinstance(value, list) and len(value) == 0:
            return f"Field '{field}' must contain at least one element"

    return None


def upload_to_s3(
        bucket: str,
        key: str,
        file_data: str,
        content_type: str) -> str:
    """
    Upload base64-encoded file to S3.

    Args:
        bucket: S3 bucket name
        key: S3 object key
        file_data: Base64-encoded file data
        content_type: MIME type of the file

    Returns:
        S3 object URL
    """
    try:
        # Decode base64 data
        file_bytes = base64.b64decode(file_data)

        # Upload to S3
        s3_client.put_object(
            Bucket=bucket,
            Key=key,
            Body=file_bytes,
            ContentType=content_type
        )

        # Return S3 URL
        return f"s3://{bucket}/{key}"

    except Exception as e:
        raise Exception(f"Failed to upload to S3: {str(e)}")


def generate_presigned_url(
        bucket: str,
        key: str,
        expiration: int = 3600) -> str:
    """
    Generate presigned URL for S3 object access.

    Args:
        bucket: S3 bucket name
        key: S3 object key
        expiration: URL expiration time in seconds (default 1 hour)

    Returns:
        Presigned URL
    """
    try:
        url = s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': bucket,
                'Key': key
            },
            ExpiresIn=expiration
        )
        return url
    except Exception as e:
        raise Exception(f"Failed to generate presigned URL: {str(e)}")


def get_user_groups(event: Dict) -> List[str]:
    """
    Extract Cognito user groups from JWT token in API Gateway event.

    Args:
        event: API Gateway event

    Returns:
        List of group names the user belongs to
    """
    try:
        # Groups are in the authorizer context
        ctx = event.get('requestContext', {})
        claims = ctx.get('authorizer', {}).get('claims', {})

        # Groups are stored as comma-separated string in 'cognito:groups'
        groups_str = claims.get('cognito:groups', '')

        if groups_str:
            return groups_str.split(',')

        return []

    except Exception:
        return []


def is_admin(event: Dict) -> bool:
    """
    Check if the user belongs to Admins group.

    Args:
        event: API Gateway event

    Returns:
        True if user is admin, False otherwise
    """
    groups = get_user_groups(event)
    return 'Admins' in groups


def get_current_timestamp() -> str:
    """
    Get current timestamp in ISO format.

    Returns:
        Current timestamp string
    """
    return datetime.utcnow().isoformat() + 'Z'


def parse_body(event: Dict) -> Dict:
    """
    Parse JSON body from API Gateway event.

    Args:
        event: API Gateway event

    Returns:
        Parsed JSON body

    Raises:
        ValueError: If body is invalid JSON
    """
    body = event.get('body', '{}')

    if isinstance(body, str):
        try:
            return json.loads(body)
        except json.JSONDecodeError:
            raise ValueError("Invalid JSON in request body")

    return body


def get_path_parameter(event: Dict, param_name: str) -> Optional[str]:
    """
    Extract path parameter from API Gateway event.

    Args:
        event: API Gateway event
        param_name: Name of the path parameter

    Returns:
        Parameter value or None
    """
    return event.get('pathParameters', {}).get(param_name)


def get_query_parameter(event: Dict, param_name: str) -> Optional[str]:
    """
    Extract query parameter from API Gateway event.

    Args:
        event: API Gateway event
        param_name: Name of the query parameter

    Returns:
        Parameter value or None
    """
    query_params = event.get('queryStringParameters')
    if query_params:
        return query_params.get(param_name)
    return None


def extract_file_metadata(
        file_base64: str,
        filename: str = None) -> Dict[str, Any]:
    """Extract metadata from base64 file data."""
    try:
        file_bytes = base64.b64decode(file_base64)
        file_size = len(file_bytes)

        # Get file type from content or filename
        file_type = 'application/octet-stream'  # default
        file_name = filename or 'unknown'

        if filename:
            file_type, _ = mimetypes.guess_type(filename)
            if not file_type:
                # Try to determine from extension
                ext = os.path.splitext(filename)[1].lower()
                if ext in ['.mp3', '.mpeg']:
                    file_type = 'audio/mpeg'
                elif ext in ['.wav']:
                    file_type = 'audio/wav'
                elif ext in ['.m4a']:
                    file_type = 'audio/mp4'
                elif ext in ['.jpg', '.jpeg']:
                    file_type = 'image/jpeg'
                elif ext in ['.png']:
                    file_type = 'image/png'

        # For uploaded files,
        # we use current timestamp as creation/modification time
        current_time = datetime.utcnow().isoformat() + 'Z'

        return {
            'file_name': file_name,
            'file_type': file_type or 'application/octet-stream',
            'file_size': file_size,
            'file_created_at': current_time,
            'file_modified_at': current_time
        }
    except Exception:
        # Return basic metadata if extraction fails
        current_time = datetime.utcnow().isoformat() + 'Z'
        return {
            'file_name': filename or 'unknown',
            'file_type': 'application/octet-stream',
            'file_size': 0,
            'file_created_at': current_time,
            'file_modified_at': current_time
        }
