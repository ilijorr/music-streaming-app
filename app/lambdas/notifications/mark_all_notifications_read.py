import json
import boto3
import os
from datetime import datetime
from typing import Dict, Any, List
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
    """Mark all notifications as read for a user"""

    print(f"Event: {json.dumps(event)}")

    try:
        # Extract user ID from JWT token
        user_id = event['requestContext']['authorizer']['claims']['sub']

        # Get subscriptions table
        subscriptions_table_name = os.environ['SUBSCRIPTIONS_TABLE']
        subscriptions_table = dynamodb.Table(subscriptions_table_name)

        # Query for all user's notifications
        response = subscriptions_table.query(
            KeyConditionExpression='PK = :pk AND begins_with(SK, :sk)',
            ExpressionAttributeValues={
                ':pk': f'USER#{user_id}',
                ':sk': 'NOTIFICATION#'
            }
        )

        # Update all notifications to read
        updated_count = 0
        current_time = datetime.utcnow().isoformat()

        with subscriptions_table.batch_writer() as batch:
            for item in response.get('Items', []):
                if not item.get('read', False):  # Only update unread notifications
                    item['read'] = True
                    item['updatedAt'] = current_time
                    batch.put_item(Item=item)
                    updated_count += 1

        return generate_response(200, {
            'message': f'Marked {updated_count} notifications as read',
            'updated_count': updated_count
        })

    except Exception as e:
        print(f"Error marking all notifications as read: {str(e)}")
        return generate_response(500, {'error': 'Failed to mark notifications as read'})