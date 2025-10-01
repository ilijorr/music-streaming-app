from typing import Dict, List, Optional, Any
from datetime import datetime
import os
import base64
import mimetypes


def extract_file_metadata(file_base64: str, filename: str = None) -> Dict[str, Any]:
    """Extract metadata from base64 file data."""
    try:
        file_bytes = base64.b64decode(file_base64)
        file_size = len(file_bytes)

        # Get file type from content or filename
        file_type = 'application/octet-stream'  # default
        file_name = filename or 'unknown'

        if filename:
            file_type, _ = mimetypes.guess_type(filename)
            if not file_type:
                # Try to determine from extension
                ext = os.path.splitext(filename)[1].lower()
                if ext in ['.mp3', '.mpeg']:
                    file_type = 'audio/mpeg'
                elif ext in ['.wav']:
                    file_type = 'audio/wav'
                elif ext in ['.m4a']:
                    file_type = 'audio/mp4'
                elif ext in ['.jpg', '.jpeg']:
                    file_type = 'image/jpeg'
                elif ext in ['.png']:
                    file_type = 'image/png'

        # For uploaded files, we use current timestamp as creation/modification time
        current_time = datetime.utcnow().isoformat() + 'Z'

        return {
            'file_name': file_name,
            'file_type': file_type or 'application/octet-stream',
            'file_size': file_size,
            'file_created_at': current_time,
            'file_modified_at': current_time
        }
    except Exception as e:
        # Return basic metadata if extraction fails
        current_time = datetime.utcnow().isoformat() + 'Z'
        return {
            'file_name': filename or 'unknown',
            'file_type': 'application/octet-stream',
            'file_size': 0,
            'file_created_at': current_time,
            'file_modified_at': current_time
        }


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
        file_name: str,
        file_type: str,
        file_size: int,
        file_created_at: str,
        file_modified_at: str,
        album_id: Optional[str] = None,
        cover_url: Optional[str] = None,
        duration: Optional[int] = None,
        featuring_artists: Optional[List[str]] = None,
        created_at: Optional[str] = None,
        updated_at: Optional[str] = None,
        stream_url: Optional[str] = None
    ):
        self.song_id = song_id
        self.title = title
        self.artist_ids = artist_ids
        self.genres = genres
        self.file_url = file_url
        self.file_name = file_name
        self.file_type = file_type
        self.file_size = file_size
        self.file_created_at = file_created_at
        self.file_modified_at = file_modified_at
        self.album_id = album_id
        self.cover_url = cover_url
        self.duration = duration
        self.featuring_artists = featuring_artists or []
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
            'fileName': self.file_name,
            'fileType': self.file_type,
            'fileSize': self.file_size,
            'fileCreatedAt': self.file_created_at,
            'fileModifiedAt': self.file_modified_at,
            'featuringArtists': self.featuring_artists,
            'createdAt': self.created_at,
            'updatedAt': self.updated_at
        }

        if self.album_id:
            result['albumId'] = self.album_id
        if self.cover_url:
            result['coverUrl'] = self.cover_url
        if self.duration:
            result['duration'] = self.duration
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
            'fileName': self.file_name,
            'fileType': self.file_type,
            'fileSize': self.file_size,
            'fileCreatedAt': self.file_created_at,
            'fileModifiedAt': self.file_modified_at,
            'featuringArtists': self.featuring_artists,
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
            artist_ids=item['artistIds'],
            genres=item['genres'],
            file_url=item['fileUrl'],
            file_name=item['fileName'],
            file_type=item['fileType'],
            file_size=item['fileSize'],
            file_created_at=item['fileCreatedAt'],
            file_modified_at=item['fileModifiedAt'],
            album_id=item.get('albumId'),
            cover_url=item.get('coverUrl'),
            duration=item.get('duration'),
            featuring_artists=item.get('featuringArtists', []),
            created_at=item.get('createdAt'),
            updated_at=item.get('updatedAt')
        )


class AlbumSong:
    """Song data for album uploads."""

    def __init__(
        self,
        title: str,
        audio_file_base64: str,
        genres: List[str],
        duration: Optional[int] = None,
        featuring_artists: Optional[List[str]] = None,
        track_number: Optional[int] = None
    ):
        self.title = title
        self.audio_file_base64 = audio_file_base64
        self.genres = genres
        self.duration = duration
        self.featuring_artists = featuring_artists or []
        self.track_number = track_number

    def to_song_model(
        self,
        song_id: str,
        album_id: str,
        file_url: str,
        file_metadata: Dict[str, Any],
        cover_url: str,
        primary_artist_ids: List[str]
    ) -> 'Song':
        """Convert AlbumSong to Song model."""
        return Song(
            song_id=song_id,
            title=self.title,
            artist_ids=primary_artist_ids,
            genres=self.genres,
            file_url=file_url,
            file_name=file_metadata['file_name'],
            file_type=file_metadata['file_type'],
            file_size=file_metadata['file_size'],
            file_created_at=file_metadata['file_created_at'],
            file_modified_at=file_metadata['file_modified_at'],
            album_id=album_id,
            cover_url=cover_url,
            duration=self.duration,
            featuring_artists=self.featuring_artists
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