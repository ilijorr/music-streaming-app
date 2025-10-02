from typing import List, Optional, Dict, Any
from datetime import datetime


class Song:
    """Song data model."""

    def __init__(
        self,
        song_id: str,
        title: str,
        artist_ids: List[str],
        genres: List[str],
        file_url: str,
        file_name: str,
        file_type: str,
        file_size: int,
        file_created_at: str,
        file_modified_at: str,
        album_id: Optional[str] = None,
        cover_url: Optional[str] = None,
        duration: Optional[int] = None,
        created_at: Optional[str] = None,
        updated_at: Optional[str] = None,
    ):
        self.song_id = song_id
        self.title = title
        self.artist_ids = artist_ids or []
        self.genres = genres or []
        self.file_url = file_url
        self.file_name = file_name
        self.file_type = file_type
        self.file_size = file_size
        self.file_created_at = file_created_at
        self.file_modified_at = file_modified_at
        self.album_id = album_id
        self.cover_url = cover_url
        self.duration = duration
        self.created_at = created_at or datetime.utcnow().isoformat() + 'Z'
        self.updated_at = updated_at or datetime.utcnow().isoformat() + 'Z'

    def to_dict(self) -> Dict[str, Any]:
        """Convert song to dictionary."""
        result = {
            'songId': self.song_id,
            'title': self.title,
            'artistIds': self.artist_ids,
            'genres': self.genres,
            'fileUrl': self.file_url,
            'fileName': self.file_name,
            'fileType': self.file_type,
            'fileSize': self.file_size,
            'fileCreatedAt': self.file_created_at,
            'fileModifiedAt': self.file_modified_at,
            'createdAt': self.created_at,
            'updatedAt': self.updated_at
        }

        if self.album_id:
            result['albumId'] = self.album_id
        if self.cover_url:
            result['coverUrl'] = self.cover_url
        if self.duration:
            result['duration'] = self.duration

        return result

    def to_dynamodb_item(self) -> Dict[str, Any]:
        """Convert song to DynamoDB item format."""
        item = {
            'PK': f"SONG#{self.song_id}",
            'SK': 'METADATA',
            'songId': self.song_id,
            'title': self.title,
            'artistIds': self.artist_ids,
            'genres': self.genres,
            'fileUrl': self.file_url,
            'fileName': self.file_name,
            'fileType': self.file_type,
            'fileSize': self.file_size,
            'fileCreatedAt': self.file_created_at,
            'fileModifiedAt': self.file_modified_at,
            'createdAt': self.created_at,
            'updatedAt': self.updated_at
        }

        if self.album_id:
            item['albumId'] = self.album_id
        if self.cover_url:
            item['coverUrl'] = self.cover_url
        if self.duration is not None:
            item['duration'] = self.duration

        return item

    @staticmethod
    def from_dynamodb_item(item: Dict[str, Any]) -> 'Song':
        """Create song from DynamoDB item."""
        return Song(
            song_id=item['songId'],
            title=item['title'],
            artist_ids=item.get('artistIds', []),
            genres=item.get('genres', []),
            file_url=item['fileUrl'],
            file_name=item['fileName'],
            file_type=item['fileType'],
            file_size=item['fileSize'],
            file_created_at=item['fileCreatedAt'],
            file_modified_at=item['fileModifiedAt'],
            album_id=item.get('albumId'),
            cover_url=item.get('coverUrl'),
            duration=item.get('duration'),
            created_at=item.get('createdAt'),
            updated_at=item.get('updatedAt'),
        )
