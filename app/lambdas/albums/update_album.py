import os
import boto3
from utils import generate_response, parse_body, is_admin, get_path_parameter, upload_to_s3, get_current_timestamp
from models import Album

dynamodb = boto3.resource('dynamodb')
albums_table = dynamodb.Table(os.environ['ALBUMS_TABLE'])


def handler(event, context):
    """
    Update an existing album (Admin only)

    Optional fields that can be updated:
    - title: Album title
    - artist_ids: List of artist IDs
    - release_date: Album release date
    - genres: List of genres
    - cover_image_base64: Base64 encoded cover image
    - cover_filename: Name of the cover image file
    """
    try:
        # Check if user is admin
        if not is_admin(event):
            return generate_response(403, {"error": "Access denied. Admin privileges required."})

        # Get album ID from path parameters
        album_id = get_path_parameter(event, 'albumId')
        if not album_id:
            return generate_response(400, {"error": "Album ID is required"})

        # Parse request body
        body = parse_body(event)

        # Get existing album
        response = albums_table.get_item(
            Key={
                'PK': f"ALBUM#{album_id}",
                'SK': 'METADATA'
            }
        )

        if 'Item' not in response:
            return generate_response(404, {"error": "Album not found"})

        # Convert to Album object
        album = Album.from_dynamodb_item(response['Item'])

        # Update fields if provided
        if 'title' in body:
            album.title = body['title']
        if 'artist_ids' in body:
            if not isinstance(body['artist_ids'], list):
                return generate_response(400, {"error": "Artist IDs must be a list"})
            album.artist_ids = body['artist_ids']
        if 'release_date' in body:
            album.release_date = body['release_date']
        if 'genres' in body:
            if not isinstance(body['genres'], list):
                return generate_response(400, {"error": "Genres must be a list"})
            album.genres = body['genres']

        # Handle cover image upload if provided
        if body.get('cover_image_base64') and body.get('cover_filename'):
            try:
                cover_key = f"albums/{album_id}/cover/{body['cover_filename']}"
                cover_url = upload_to_s3(
                    bucket=os.environ['IMAGES_BUCKET'],
                    key=cover_key,
                    file_data=body['cover_image_base64'],
                    content_type='image/jpeg'
                )
                album.cover_url = cover_url
            except Exception as e:
                return generate_response(400, {"error": f"Failed to upload cover image: {str(e)}"})

        # Update timestamp
        album.updated_at = get_current_timestamp()

        # Delete old album entries (in case attributes changed)
        albums_table.delete_item(
            Key={
                'PK': f"ALBUM#{album_id}",
                'SK': 'METADATA'
            }
        )

        # Save updated album to DynamoDB with GSI attributes
        item = album.to_dynamodb_item()

        # Add GSI attributes for filtering
        # Artist GSI
        for artist_id in album.artist_ids:
            artist_item = {
                **item,
                'GSI1PK': f"ARTIST#{artist_id}",
                'GSI1SK': f"ALBUM#{album_id}"
            }
            albums_table.put_item(Item=artist_item)
            break

        # Genre GSI
        for genre in album.genres:
            genre_item = {
                **item,
                'GSI2PK': f"GENRE#{genre}",
                'GSI2SK': f"ALBUM#{album_id}"
            }
            albums_table.put_item(Item=genre_item)
            break

        # Store main item if minimal GSI usage
        if len(album.artist_ids) <= 1 and len(album.genres) <= 1:
            albums_table.put_item(Item=item)

        return generate_response(200, {
            "message": "Album updated successfully",
            "album": album.to_dict()
        })

    except ValueError as e:
        return generate_response(400, {"error": str(e)})
    except Exception as e:
        print(f"Error updating album: {str(e)}")
        return generate_response(500, {"error": "Internal server error"})