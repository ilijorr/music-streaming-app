import os
import boto3
from datetime import datetime
from utils import generate_response, validate_required_fields, parse_body, is_admin, get_path_parameter, upload_to_s3, get_current_timestamp
from models import Artist

dynamodb = boto3.resource('dynamodb')
artists_table = dynamodb.Table(os.environ['ARTISTS_TABLE'])


def handler(event, context):
    """
    Update an existing artist (Admin only)

    Optional fields that can be updated:
    - name: Artist name
    - biography: Artist biography
    - genres: List of genres
    - image_base64: Base64 encoded image data
    - image_filename: Name of the image file
    """
    try:
        # Check if user is admin
        if not is_admin(event):
            return generate_response(403, {"error": "Access denied. Admin privileges required."})

        # Get artist ID from path parameters
        artist_id = get_path_parameter(event, 'artistId')
        if not artist_id:
            return generate_response(400, {"error": "Artist ID is required"})

        # Parse request body
        body = parse_body(event)

        # Get existing artist
        response = artists_table.get_item(
            Key={
                'PK': f"ARTIST#{artist_id}",
                'SK': 'METADATA'
            }
        )

        if 'Item' not in response:
            return generate_response(404, {"error": "Artist not found"})

        # Convert to Artist object
        artist = Artist.from_dynamodb_item(response['Item'])

        # Update fields if provided
        if 'name' in body:
            artist.name = body['name']
        if 'biography' in body:
            artist.biography = body['biography']
        if 'genres' in body:
            if not isinstance(body['genres'], list):
                return generate_response(400, {"error": "Genres must be a list"})
            artist.genres = body['genres']

        # Handle image upload if provided
        if body.get('image_base64') and body.get('image_filename'):
            try:
                image_key = f"artists/{artist_id}/{body['image_filename']}"
                image_url = upload_to_s3(
                    bucket=os.environ['IMAGES_BUCKET'],
                    key=image_key,
                    file_data=body['image_base64'],
                    content_type='image/jpeg'  # Default to JPEG
                )
                artist.image_url = image_url
            except Exception as e:
                return generate_response(400, {"error": f"Failed to upload image: {str(e)}"})

        # Update timestamp
        artist.updated_at = get_current_timestamp()

        # Delete old artist entries (in case genres changed)
        artists_table.delete_item(
            Key={
                'PK': f"ARTIST#{artist_id}",
                'SK': 'METADATA'
            }
        )

        # Save updated artist to DynamoDB
        item = artist.to_dynamodb_item()

        # Add GSI attributes for genre filtering
        for genre in artist.genres:
            genre_item = {
                **item,
                'GSI1PK': f"GENRE#{genre}",
                'GSI1SK': f"ARTIST#{artist_id}"
            }
            artists_table.put_item(Item=genre_item)
            break  # Only store in one genre GSI for simplicity

        # If no genres or only one genre, store the main item
        if len(artist.genres) <= 1:
            artists_table.put_item(Item=item)

        return generate_response(200, {
            "message": "Artist updated successfully",
            "artist": artist.to_dict()
        })

    except ValueError as e:
        return generate_response(400, {"error": str(e)})
    except Exception as e:
        print(f"Error updating artist: {str(e)}")
        return generate_response(500, {"error": "Internal server error"})