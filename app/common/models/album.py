from typing import Dict, List, Optional, Any
from datetime import datetime

class Album:
    """Album data model."""

    def __init__(
        self,
        album_id: str,
        title: str,
        artist_ids: List[str],
        release_date: str,
        genres: List[str],
        cover_url: Optional[str] = None,
        created_at: Optional[str] = None,
        updated_at: Optional[str] = None,
        songs: Optional[List[Dict]] = None
    ):
        self.album_id = album_id
        self.title = title
        self.artist_ids = artist_ids
        self.release_date = release_date
        self.genres = genres
        self.cover_url = cover_url
        self.created_at = created_at or datetime.utcnow().isoformat() + 'Z'
        self.updated_at = updated_at or datetime.utcnow().isoformat() + 'Z'
        self.songs = songs or []

    def to_dict(self) -> Dict[str, Any]:
        """Convert album to dictionary."""
        result = {
            'albumId': self.album_id,
            'title': self.title,
            'artistIds': self.artist_ids,
            'releaseDate': self.release_date,
            'genres': self.genres,
            'createdAt': self.created_at,
            'updatedAt': self.updated_at
        }

        if self.cover_url:
            result['coverUrl'] = self.cover_url

        if self.songs:
            result['songs'] = self.songs

        return result

    def to_dynamodb_item(self) -> Dict[str, Any]:
        """Convert album to DynamoDB item format."""
        item = {
            'PK': f"ALBUM#{self.album_id}",
            'SK': 'METADATA',
            'albumId': self.album_id,
            'title': self.title,
            'artistIds': self.artist_ids,
            'releaseDate': self.release_date,
            'genres': self.genres,
            'createdAt': self.created_at,
            'updatedAt': self.updated_at
        }

        if self.cover_url:
            item['coverUrl'] = self.cover_url

        return item

    @staticmethod
    def from_dynamodb_item(item: Dict[str, Any]) -> 'Album':
        """Create album from DynamoDB item."""
        return Album(
            album_id=item['albumId'],
            title=item['title'],
            artist_ids=item['artistIds'],
            release_date=item['releaseDate'],
            genres=item['genres'],
            cover_url=item.get('coverUrl'),
            created_at=item.get('createdAt'),
            updated_at=item.get('updatedAt')
        )