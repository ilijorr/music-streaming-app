export interface Song {
  songId: string;
  title: string;
  artistIds: string[];
  genres: string[];
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileCreatedAt: string;
  fileModifiedAt: string;
  albumId?: string;
  coverUrl?: string;
  duration: number;
  featuringArtists: string[];
  createdAt: string;
  updatedAt: string;
  streamUrl?: string;
}

export interface UploadSongRequest {
  title: string;
  artist_ids: string[];
  genres: string[];
  audio_file_base64: string;
  audio_filename: string;
  album_id?: string;
  cover_image_base64?: string;
  cover_filename?: string;
  duration?: number;
  featuring_artists?: string[];
}

export interface UpdateSongRequest {
  title?: string;
  artist_ids?: string[];
  genres?: string[];
  album_id?: string;
  audio_file_base64?: string;
  audio_filename?: string;
  cover_image_base64?: string;
  cover_filename?: string;
  duration?: number;
  featuring_artists?: string[];
}

export interface StreamUrlResponse {
  song_id: string;
  title: string;
  stream_url: string;
  expires_in: number;
}