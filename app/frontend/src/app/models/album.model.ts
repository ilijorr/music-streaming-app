export interface Album {
  albumId: string;
  title: string;
  artistIds: string[];
  releaseDate: string;
  releaseYear: number; // For compatibility
  genres: string[];
  coverUrl?: string;
  createdAt: string;
  updatedAt: string;
  songs?: any[]; // Will be populated when needed
  songIds?: string[]; // List of song IDs in the album
}

export interface AlbumSong {
  title: string;
  audio_file_base64: string;
  genres?: string[];
  duration?: number;
  featuring_artists?: string[];
  track_number?: number;
  audio_filename?: string;
}

export interface UploadAlbumRequest {
  title: string;
  artist_ids: string[];
  release_date: string; // YYYY-MM-DD format
  genres: string[];
  songs: AlbumSong[];
  cover_image_base64?: string;
  cover_filename?: string;
}

export interface UpdateAlbumRequest {
  title?: string;
  artist_ids?: string[];
  release_date?: string;
  genres?: string[];
  cover_image_base64?: string;
  cover_filename?: string;
}