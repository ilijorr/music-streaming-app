import os
import uuid
import boto3
from utils import generate_response, validate_required_fields, parse_body, get_current_timestamp
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource('dynamodb')
subscriptions_table = dynamodb.Table(os.environ['SUBSCRIPTIONS_TABLE'])
artists_table = dynamodb.Table(os.environ['ARTISTS_TABLE'])
albums_table = dynamodb.Table(os.environ['ALBUMS_TABLE'])


def handler(event, context):
    """
    Create a new subscription for a user (Task 1.11)

    Required fields:
    - type: Subscription type ('ARTIST', 'GENRE', 'ALBUM')
    - target_id: ID of the target (artist_id, genre name, or album_id)

    The user ID is extracted from the Cognito JWT token
    """
    try:
        # Get user ID from Cognito claims
        user_id = event.get('requestContext', {}).get('authorizer', {}).get('claims', {}).get('sub')
        if not user_id:
            return generate_response(401, {"error": "User authentication required"})

        # Parse request body
        body = parse_body(event)

        # Validate required fields
        required_fields = ['type', 'target_id']
        validation_error = validate_required_fields(body, required_fields)
        if validation_error:
            return generate_response(400, {"error": validation_error})

        # Validate subscription type
        subscription_type = body['type'].upper()
        if subscription_type not in ['ARTIST', 'GENRE', 'ALBUM']:
            return generate_response(400, {"error": "Subscription type must be 'ARTIST', 'GENRE', or 'ALBUM'"})

        target_id = body['target_id']
        target_name = target_id  # Default for GENRE

        # Validate target exists and get target name
        if subscription_type == 'ARTIST':
            # Check if artist exists
            artist_response = artists_table.get_item(
                Key={
                    'PK': f"ARTIST#{target_id}",
                    'SK': 'METADATA'
                }
            )
            if 'Item' not in artist_response:
                return generate_response(404, {"error": "Artist not found"})
            target_name = artist_response['Item'].get('name', target_id)

        elif subscription_type == 'ALBUM':
            # Check if album exists
            album_response = albums_table.get_item(
                Key={
                    'PK': f"ALBUM#{target_id}",
                    'SK': 'METADATA'
                }
            )
            if 'Item' not in album_response:
                return generate_response(404, {"error": "Album not found"})
            target_name = album_response['Item'].get('title', target_id)

        # Check if subscription already exists
        subscription_key = f"SUBSCRIPTION#{subscription_type}#{target_id}"
        existing_response = subscriptions_table.get_item(
            Key={
                'PK': f"USER#{user_id}",
                'SK': subscription_key
            }
        )

        if 'Item' in existing_response:
            return generate_response(409, {"error": "Subscription already exists"})

        # Create subscription item
        subscription_item = {
            'PK': f"USER#{user_id}",
            'SK': subscription_key,
            'GSI1PK': subscription_key,
            'GSI1SK': f"USER#{user_id}",
            'type': subscription_type,
            'targetId': target_id,
            'targetName': target_name,
            'createdAt': get_current_timestamp()
        }

        # Save subscription to DynamoDB
        subscriptions_table.put_item(Item=subscription_item)

        return generate_response(201, {
            "message": "Subscription created successfully",
            "subscription": {
                "type": subscription_type,
                "target_id": target_id,
                "target_name": target_name,
                "created_at": subscription_item['createdAt']
            }
        })

    except ValueError as e:
        return generate_response(400, {"error": str(e)})
    except Exception as e:
        print(f"Error creating subscription: {str(e)}")
        return generate_response(500, {"error": "Internal server error"})