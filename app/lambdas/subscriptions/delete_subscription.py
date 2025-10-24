import os
import boto3
from utils import generate_response, get_path_parameter

dynamodb = boto3.resource('dynamodb')
subscriptions_table = dynamodb.Table(os.environ['SUBSCRIPTIONS_TABLE'])


def handler(event, context):
    """
    Delete a subscription for the authenticated user (Task 1.12)

    Path parameters:
    - subscriptionId: The full subscription key (SK) to delete
    """
    try:
        # Get user ID from Cognito claims
        user_id = event.get('requestContext', {}).get('authorizer', {}).get('claims', {}).get('sub')
        if not user_id:
            return generate_response(401, {"error": "User authentication required"})

        # Get subscription ID from path parameters
        subscription_id = get_path_parameter(event, 'subscriptionId')
        if not subscription_id:
            return generate_response(400, {"error": "Subscription ID is required"})

        # Validate subscription ID format
        if not subscription_id.startswith('SUBSCRIPTION#'):
            return generate_response(400, {"error": "Invalid subscription ID format"})

        # Check if subscription exists and belongs to the user
        response = subscriptions_table.get_item(
            Key={
                'PK': f"USER#{user_id}",
                'SK': subscription_id
            }
        )

        if 'Item' not in response:
            return generate_response(404, {"error": "Subscription not found"})

        subscription_item = response['Item']

        # Delete the subscription
        subscriptions_table.delete_item(
            Key={
                'PK': f"USER#{user_id}",
                'SK': subscription_id
            }
        )

        return generate_response(200, {
            "message": "Subscription deleted successfully",
            "deleted_subscription": {
                "id": subscription_id,
                "type": subscription_item.get('type'),
                "target_id": subscription_item.get('targetId'),
                "target_name": subscription_item.get('targetName')
            }
        })

    except Exception as e:
        print(f"Error deleting subscription: {str(e)}")
        return generate_response(500, {"error": "Internal server error"})