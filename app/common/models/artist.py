from typing import Dict, List, Optional, Any
from datetime import datetime

class Artist:
    """Artist data model."""

    def __init__(
        self,
        artist_id: str,
        name: str,
        biography: str,
        genres: List[str],
        image_url: Optional[str] = None,
        created_at: Optional[str] = None,
        updated_at: Optional[str] = None
    ):
        self.artist_id = artist_id
        self.name = name
        self.biography = biography
        self.genres = genres
        self.image_url = image_url
        self.created_at = created_at or datetime.utcnow().isoformat() + 'Z'
        self.updated_at = updated_at or datetime.utcnow().isoformat() + 'Z'

    def to_dict(self) -> Dict[str, Any]:
        """Convert artist to dictionary."""
        return {
            'artistId': self.artist_id,
            'name': self.name,
            'biography': self.biography,
            'genres': self.genres,
            'imageUrl': self.image_url,
            'createdAt': self.created_at,
            'updatedAt': self.updated_at
        }

    def to_dynamodb_item(self) -> Dict[str, Any]:
        """Convert artist to DynamoDB item format."""
        item = {
            'PK': f"ARTIST#{self.artist_id}",
            'SK': 'METADATA',
            'artistId': self.artist_id,
            'name': self.name,
            'biography': self.biography,
            'genres': self.genres,
            'createdAt': self.created_at,
            'updatedAt': self.updated_at
        }

        if self.image_url:
            item['imageUrl'] = self.image_url

        return item

    @staticmethod
    def from_dynamodb_item(item: Dict[str, Any]) -> 'Artist':
        """Create artist from DynamoDB item."""
        return Artist(
            artist_id=item['artistId'],
            name=item['name'],
            biography=item['biography'],
            genres=item['genres'],
            image_url=item.get('imageUrl'),
            created_at=item.get('createdAt'),
            updated_at=item.get('updatedAt')
        )