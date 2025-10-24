import os
import json
import boto3
import uuid
from datetime import datetime
from utils import generate_response

sns_client = boto3.client('sns')
ses_client = boto3.client('ses')
cognito_client = boto3.client('cognito-idp')
dynamodb = boto3.resource('dynamodb')


def handler(event, context):
    """
    Process notification messages from SNS topic (Task 2.8)

    This function is triggered by SNS messages when new content is uploaded.
    It sends both email and in-app notifications to users.
    """
    try:
        # Process SNS records
        for record in event.get('Records', []):
            if record.get('EventSource') == 'aws:sns':
                try:
                    # Parse SNS message
                    sns_message = json.loads(record['Sns']['Message'])

                    user_id = sns_message.get('user_id')
                    message = sns_message.get('message')
                    notification_type = sns_message.get('type', 'general')

                    if not user_id or not message:
                        print(f"Invalid notification message: {sns_message}")
                        continue

                    # Send email notification
                    try:
                        _send_email_notification(user_id, message, notification_type)
                    except Exception as e:
                        print(f"Error sending email notification: {str(e)}")

                    # Send in-app notification (publish to user-specific SNS topic)
                    try:
                        _send_in_app_notification(user_id, message, notification_type)
                    except Exception as e:
                        print(f"Error sending in-app notification: {str(e)}")

                except Exception as e:
                    print(f"Error processing SNS record: {str(e)}")
                    continue

        return {
            'statusCode': 200,
            'body': json.dumps('Notifications processed successfully')
        }

    except Exception as e:
        print(f"Error in notification handler: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps('Error processing notifications')
        }


def _send_email_notification(user_id, message, notification_type):
    """Send email notification using SES"""
    try:
        # Get user email from Cognito
        email_address = _get_user_email_from_cognito(user_id)
        if not email_address:
            print(f"No email found for user {user_id}, skipping email notification")
            return

        subject = "New Music Content Available!"
        if notification_type == 'new_content':
            subject = "🎵 New Music Just Dropped!"

        body_text = f"""
Hello!

{message}

Visit our music streaming app to check out the latest content.

Best regards,
Music Streaming Team
        """

        body_html = f"""
<html>
<head></head>
<body>
    <h2>🎵 Music Streaming App</h2>
    <p>Hello!</p>
    <p>{message}</p>
    <p>Visit our music streaming app to check out the latest content.</p>
    <br>
    <p>Best regards,<br>Music Streaming Team</p>
</body>
</html>
        """

        # Using verified SES email address
        try:
            response = ses_client.send_email(
                Source='ilijajordanovski003@gmail.com',  # Your verified SES email
                Destination={'ToAddresses': [email_address]},
                Message={
                    'Subject': {'Data': subject, 'Charset': 'UTF-8'},
                    'Body': {
                        'Text': {'Data': body_text, 'Charset': 'UTF-8'},
                        'Html': {'Data': body_html, 'Charset': 'UTF-8'}
                    }
                }
            )
            print(f"Email sent successfully to {email_address}: {response['MessageId']}")
        except Exception as e:
            print(f"SES email sending failed - check SES configuration: {str(e)}")

    except Exception as e:
        print(f"Error in email notification function: {str(e)}")


def _get_user_email_from_cognito(user_id):
    """Get user email address from Cognito User Pool"""
    try:
        response = cognito_client.admin_get_user(
            UserPoolId=os.environ['USER_POOL_ID'],
            Username=user_id
        )

        # Find email attribute
        for attribute in response.get('UserAttributes', []):
            if attribute['Name'] == 'email':
                return attribute['Value']

        print(f"No email attribute found for user {user_id}")
        return None

    except cognito_client.exceptions.UserNotFoundException:
        print(f"User {user_id} not found in Cognito")
        return None
    except Exception as e:
        print(f"Error getting user email from Cognito: {str(e)}")
        return None


def _send_in_app_notification(user_id, message, notification_type):
    """Store in-app notification in database"""
    try:
        # Get subscriptions table
        subscriptions_table_name = os.environ['SUBSCRIPTIONS_TABLE']
        subscriptions_table = dynamodb.Table(subscriptions_table_name)

        # Create notification record
        notification_id = str(uuid.uuid4())
        current_time = datetime.utcnow().isoformat()

        # Parse message to extract title and content
        title = "New Content Available"
        if "new song" in message.lower():
            title = "New Song Released"
        elif "new album" in message.lower():
            title = "New Album Released"

        notification_item = {
            'PK': f'USER#{user_id}',
            'SK': f'NOTIFICATION#{notification_id}',
            'type': notification_type,
            'title': title,
            'message': message,
            'read': False,
            'createdAt': current_time,
            'updatedAt': current_time
        }

        # Store notification in database
        subscriptions_table.put_item(Item=notification_item)
        print(f"In-app notification stored for user {user_id}: {notification_id}")

    except Exception as e:
        print(f"Error storing in-app notification: {str(e)}")