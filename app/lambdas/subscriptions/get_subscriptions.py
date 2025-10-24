import os
import boto3
from boto3.dynamodb.conditions import Key
from utils import generate_response, get_query_parameter

dynamodb = boto3.resource('dynamodb')
subscriptions_table = dynamodb.Table(os.environ['SUBSCRIPTIONS_TABLE'])


def handler(event, context):
    """
    Get all subscriptions for the authenticated user (Task 1.12)

    Query parameters:
    - type: Filter by subscription type ('ARTIST', 'GENRE', 'ALBUM') - optional
    """
    try:
        # Get user ID from Cognito claims
        user_id = event.get('requestContext', {}).get('authorizer', {}).get('claims', {}).get('sub')
        if not user_id:
            return generate_response(401, {"error": "User authentication required"})

        # Get optional filter parameter
        filter_type = get_query_parameter(event, 'type')
        if filter_type:
            filter_type = filter_type.upper()
            if filter_type not in ['ARTIST', 'GENRE', 'ALBUM']:
                return generate_response(400, {"error": "Type filter must be 'ARTIST', 'GENRE', or 'ALBUM'"})

        # Query user's subscriptions
        if filter_type:
            # Query with filter for specific type
            response = subscriptions_table.query(
                KeyConditionExpression=Key('PK').eq(f"USER#{user_id}") & Key('SK').begins_with(f"SUBSCRIPTION#{filter_type}#")
            )
        else:
            # Query all subscriptions for user
            response = subscriptions_table.query(
                KeyConditionExpression=Key('PK').eq(f"USER#{user_id}") & Key('SK').begins_with('SUBSCRIPTION#')
            )

        # Process subscriptions
        subscriptions = []
        for item in response.get('Items', []):
            subscription = {
                'id': item['SK'],  # Full subscription key as ID
                'type': item.get('type'),
                'target_id': item.get('targetId'),
                'target_name': item.get('targetName'),
                'created_at': item.get('createdAt')
            }
            subscriptions.append(subscription)

        # Sort by creation date (newest first)
        subscriptions.sort(key=lambda x: x.get('created_at', ''), reverse=True)

        # Group by type for better organization
        grouped_subscriptions = {
            'ARTIST': [],
            'GENRE': [],
            'ALBUM': []
        }

        for subscription in subscriptions:
            sub_type = subscription.get('type')
            if sub_type in grouped_subscriptions:
                grouped_subscriptions[sub_type].append(subscription)

        return generate_response(200, {
            "user_id": user_id,
            "subscriptions": subscriptions,
            "grouped_subscriptions": grouped_subscriptions,
            "total_count": len(subscriptions),
            "counts_by_type": {
                "artists": len(grouped_subscriptions['ARTIST']),
                "genres": len(grouped_subscriptions['GENRE']),
                "albums": len(grouped_subscriptions['ALBUM'])
            }
        })

    except Exception as e:
        print(f"Error getting subscriptions: {str(e)}")
        return generate_response(500, {"error": "Internal server error"})