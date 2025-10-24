import json
import boto3
import os
from datetime import datetime
from typing import Dict, Any
from botocore.exceptions import ClientError

dynamodb = boto3.resource('dynamodb')

def generate_response(status_code: int, body: Dict[str, Any]) -> Dict[str, Any]:
    """Generate a standardized API response"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        'body': json.dumps(body, default=str)
    }

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Mark a notification as read"""

    print(f"Event: {json.dumps(event)}")

    try:
        # Extract user ID from JWT token
        user_id = event['requestContext']['authorizer']['claims']['sub']

        # Get notification ID from path parameters
        notification_id = event['pathParameters']['notificationId']

        # Parse request body
        body = json.loads(event['body'])
        read_status = body.get('read', True)

        # Get subscriptions table
        subscriptions_table_name = os.environ['SUBSCRIPTIONS_TABLE']
        subscriptions_table = dynamodb.Table(subscriptions_table_name)

        # Update the notification read status
        try:
            response = subscriptions_table.update_item(
                Key={
                    'PK': f'USER#{user_id}',
                    'SK': f'NOTIFICATION#{notification_id}'
                },
                UpdateExpression='SET #read = :read, updatedAt = :updatedAt',
                ExpressionAttributeNames={
                    '#read': 'read'
                },
                ExpressionAttributeValues={
                    ':read': read_status,
                    ':updatedAt': datetime.utcnow().isoformat()
                },
                ConditionExpression='attribute_exists(PK)',  # Ensure notification exists
                ReturnValues='ALL_NEW'
            )

            return generate_response(200, {
                'message': 'Notification updated successfully',
                'notification': {
                    'notificationId': notification_id,
                    'read': read_status
                }
            })

        except ClientError as e:
            if e.response['Error']['Code'] == 'ConditionalCheckFailedException':
                return generate_response(404, {'error': 'Notification not found'})
            else:
                raise e

    except Exception as e:
        print(f"Error updating notification: {str(e)}")
        return generate_response(500, {'error': 'Failed to update notification'})