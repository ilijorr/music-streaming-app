import os
import json
import uuid
import boto3
from datetime import datetime
from utils import generate_response, validate_required_fields, parse_body, is_admin, upload_to_s3
from models import Artist

dynamodb = boto3.resource('dynamodb')
artists_table = dynamodb.Table(os.environ['ARTISTS_TABLE'])


def handler(event, context):
    """
    Create a new artist (Admin only)

    Required fields:
    - name: Artist name
    - biography: Artist biography
    - genres: List of genres

    Optional fields:
    - image_base64: Base64 encoded image data
    - image_filename: Name of the image file
    """
    try:
        # Check if user is admin
        if not is_admin(event):
            return generate_response(403, {"error": "Access denied. Admin privileges required."})

        # Parse request body
        body = parse_body(event)

        # Validate required fields
        required_fields = ['name', 'biography', 'genres']
        validation_error = validate_required_fields(body, required_fields)
        if validation_error:
            return generate_response(400, {"error": validation_error})

        # Validate genres is a list
        if not isinstance(body['genres'], list):
            return generate_response(400, {"error": "Genres must be a list"})

        # Generate unique artist ID
        artist_id = str(uuid.uuid4())

        # Handle image upload if provided
        image_url = None
        if body.get('image_base64') and body.get('image_filename'):
            try:
                image_key = f"artists/{artist_id}/{body['image_filename']}"
                image_url = upload_to_s3(
                    bucket=os.environ['IMAGES_BUCKET'],
                    key=image_key,
                    file_data=body['image_base64'],
                    content_type='image/jpeg'  # Default to JPEG, could be improved
                )
            except Exception as e:
                return generate_response(400, {"error": f"Failed to upload image: {str(e)}"})

        # Create artist object
        artist = Artist(
            artist_id=artist_id,
            name=body['name'],
            biography=body['biography'],
            genres=body['genres'],
            image_url=image_url
        )

        # Save to DynamoDB
        item = artist.to_dynamodb_item()

        # Add GSI attributes for genre filtering
        for genre in body['genres']:
            genre_item = {
                **item,
                'GSI1PK': f"GENRE#{genre}",
                'GSI1SK': f"ARTIST#{artist_id}"
            }
            artists_table.put_item(Item=genre_item)
            break  # Only store in one genre GSI for simplicity

        # If no genres or only one genre, store the main item
        if len(body['genres']) <= 1:
            artists_table.put_item(Item=item)

        return generate_response(201, {
            "message": "Artist created successfully",
            "artist": artist.to_dict()
        })

    except ValueError as e:
        return generate_response(400, {"error": str(e)})
    except Exception as e:
        print(f"Error creating artist: {str(e)}")
        return generate_response(500, {"error": "Internal server error"})