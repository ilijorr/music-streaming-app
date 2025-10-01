import os
import json
import uuid
import boto3
from utils import (
    generate_response,
    validate_required_fields,
    upload_to_s3,
    is_admin,
    parse_body,
    get_current_timestamp
)
from models import Artist

# Environment variables
TABLE_NAME = os.environ.get('TABLE_NAME')
BUCKET_NAME = os.environ.get('BUCKET_NAME')

# AWS clients
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(TABLE_NAME)


def lambda_handler(event, context):
    """
    Create a new artist (Admin only).

    POST /artists
    Body: {name, biography, genres, imageBase64 (optional)}
    """
    print(f"Received event: {json.dumps(event)}")

    try:
        # Check authorization - Admin only
        if not is_admin(event):
            return generate_response(403, {
                'error': 'Forbidden',
                'message': 'Only administrators can create artists'
            })

        # Parse request body
        try:
            body = parse_body(event)
        except ValueError as e:
            return generate_response(400, {
                'error': 'Bad Request',
                'message': str(e)
            })

        # Validate required fields
        required_fields = ['name', 'biography', 'genres']
        validation_error = validate_required_fields(body, required_fields)

        if validation_error:
            return generate_response(400, {
                'error': 'Bad Request',
                'message': validation_error
            })

        # Extract fields
        name = body['name'].strip()
        biography = body['biography'].strip()
        genres = body['genres']
        image_base64 = body.get('imageBase64')

        # Additional validation
        if not isinstance(genres, list) or len(genres) == 0:
            return generate_response(400, {
                'error': 'Bad Request',
                'message': 'genres must be a non-empty array'
            })

        # Generate unique artist ID
        artist_id = str(uuid.uuid4())

        # Upload image to S3 if provided
        image_url = None
        if image_base64:
            try:
                s3_key = f"artists/{artist_id}.jpg"
                image_url = upload_to_s3(
                    bucket=BUCKET_NAME,
                    key=s3_key,
                    file_data=image_base64,
                    content_type='image/jpeg'
                )
                print(f"Uploaded artist image to: {image_url}")
            except Exception as e:
                print(f"Failed to upload image: {str(e)}")
                return generate_response(500, {
                    'error': 'Internal Server Error',
                    'message': f'Failed to upload image: {str(e)}'
                })

        # Create artist object
        artist = Artist(
            artist_id=artist_id,
            name=name,
            biography=biography,
            genres=genres,
            image_url=image_url
        )

        # Save main metadata to DynamoDB
        main_item = artist.to_dynamodb_item()
        table.put_item(Item=main_item)
        print(f"Saved artist metadata: {artist_id}")

        # Create GSI items for each genre
        for genre in genres:
            genre_item = {
                'PK': f"ARTIST#{artist_id}",
                'SK': f"GENRE#{genre}",
                'GSI1PK': f"GENRE#{genre}",
                'GSI1SK': f"ARTIST#{artist_id}",
                'artistId': artist_id,
                'name': name
            }
            table.put_item(Item=genre_item)
            print(f"Created genre index for: {genre}")

        # Return success response
        return generate_response(201, {
            'message': 'Artist created successfully',
            'artist': artist.to_dict()
        })

    except Exception as e:
        print(f"Error creating artist: {str(e)}")
        return generate_response(500, {
            'error': 'Internal Server Error',
            'message': str(e)
        })