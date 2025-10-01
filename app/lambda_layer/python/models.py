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


class Song:
    """Song data model."""

    def __init__(
        self,
        song_id: str,
        title: str,
        artist_ids: List[str],
        genres: List[str],
        file_url: str,
        album_id: Optional[str] = None,
        cover_url: Optional[str] = None,
        duration: Optional[int] = None,
        file_size: Optional[int] = None,
        file_type: Optional[str] = None,
        created_at: Optional[str] = None,
        updated_at: Optional[str] = None,
        stream_url: Optional[str] = None
    ):
        self.song_id = song_id
        self.title = title
        self.artist_ids = artist_ids
        self.genres = genres
        self.file_url = file_url
        self.album_id = album_id
        self.cover_url = cover_url
        self.duration = duration
        self.file_size = file_size
        self.file_type = file_type
        self.created_at = created_at or datetime.utcnow().isoformat() + 'Z'
        self.updated_at = updated_at or datetime.utcnow().isoformat() + 'Z'
        self.stream_url = stream_url

    def to_dict(self) -> Dict[str, Any]:
        """Convert song to dictionary."""
        result = {
            'songId': self.song_id,
            'title': self.title,
            'artistIds': self.artist_ids,
            'genres': self.genres,
            'fileUrl': self.file_url,
            'createdAt': self.created_at,
            'updatedAt': self.updated_at
        }

        if self.album_id:
            result['albumId'] = self.album_id
        if self.cover_url:
            result['coverUrl'] = self.cover_url
        if self.duration:
            result['duration'] = self.duration
        if self.file_size:
            result['fileSize'] = self.file_size
        if self.file_type:
            result['fileType'] = self.file_type
        if self.stream_url:
            result['streamUrl'] = self.stream_url

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
            'createdAt': self.created_at,
            'updatedAt': self.updated_at
        }

        if self.album_id:
            item['albumId'] = self.album_id
        if self.cover_url:
            item['coverUrl'] = self.cover_url
        if self.duration is not None:
            item['duration'] = self.duration
        if self.file_size is not None:
            item['fileSize'] = self.file_size
        if self.file_type:
            item['fileType'] = self.file_type

        return item

    @staticmethod
    def from_dynamodb_item(item: Dict[str, Any]) -> 'Song':
        """Create song from DynamoDB item."""
        return Song(
            song_id=item['songId'],
            title=item['title'],
            artist_ids=item['artistIds'],
            genres=item['genres'],
            file_url=item['fileUrl'],
            album_id=item.get('albumId'),
            cover_url=item.get('coverUrl'),
            duration=item.get('duration'),
            file_size=item.get('fileSize'),
            file_type=item.get('fileType'),
            created_at=item.get('createdAt'),
            updated_at=item.get('updatedAt')
        )


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