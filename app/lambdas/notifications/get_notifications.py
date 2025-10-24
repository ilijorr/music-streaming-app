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
    """Get user notifications"""

    print(f"Event: {json.dumps(event)}")

    try:
        # Extract user ID from JWT token
        user_id = event['requestContext']['authorizer']['claims']['sub']

        # Get subscriptions table
        subscriptions_table_name = os.environ['SUBSCRIPTIONS_TABLE']
        subscriptions_table = dynamodb.Table(subscriptions_table_name)

        # Query for user's notifications (stored in subscriptions table with SK starting with "NOTIFICATION#")
        response = subscriptions_table.query(
            KeyConditionExpression='PK = :pk AND begins_with(SK, :sk)',
            ExpressionAttributeValues={
                ':pk': f'USER#{user_id}',
                ':sk': 'NOTIFICATION#'
            },
            ScanIndexForward=False,  # Most recent first
            Limit=50  # Limit to 50 notifications
        )

        notifications = []
        for item in response.get('Items', []):
            notification = {
                'notificationId': item['SK'].replace('NOTIFICATION#', ''),
                'userId': user_id,
                'type': item.get('type', 'UNKNOWN'),
                'title': item.get('title', ''),
                'message': item.get('message', ''),
                'read': item.get('read', False),
                'createdAt': item.get('createdAt', '')
            }
            notifications.append(notification)

        return generate_response(200, {
            'notifications': notifications,
            'count': len(notifications)
        })

    except Exception as e:
        print(f"Error getting notifications: {str(e)}")
        return generate_response(500, {'error': 'Failed to get notifications'})