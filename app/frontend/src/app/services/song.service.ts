import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';

export interface CreateSongRequest {
  audioFileBase64: string;
  title: string;
  artistIds: string[];
  genres: string[];
  filename?: string;
  coverImageBase64?: string;
  duration?: number;
  featuringArtists?: string[];
  albumId?: string;
}

export interface SongData {
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
  featuringArtists: string[];
  coverUrl?: string;
  duration?: number;
  albumId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSongResponse {
  message: string;
  song: SongData;
}

export interface CreateAlbumRequest {
  title: string;
  artistIds: string[];
  releaseDate: string;
  genres: string[];
  coverImageBase64: string;
  songs: AlbumSongData[];
}

export interface AlbumSongData {
  title: string;
  audioFileBase64: string;
  genres: string[];
  filename?: string;
  duration?: number;
  featuringArtists?: string[];
  trackNumber?: number;
}

export interface CreateAlbumResponse {
  message: string;
  album: {
    albumId: string;
    title: string;
    artistIds: string[];
    releaseDate: string;
    genres: string[];
    coverUrl: string;
    createdAt: string;
    updatedAt: string;
    songs: SongData[];
  };
}

@Injectable({
  providedIn: 'root'
})
export class SongService {
  private readonly http = inject(HttpClient);
  private readonly configService = inject(ConfigService);

  private get apiUrl(): string {
    return this.configService.getApiUrl();
  }

  /**
   * Create a new song
   */
  createSong(request: CreateSongRequest): Observable<CreateSongResponse> {
    return this.http.post<CreateSongResponse>(`${this.apiUrl}songs`, request);
  }

  /**
   * Upload an album with songs
   */
  uploadAlbum(request: CreateAlbumRequest): Observable<CreateAlbumResponse> {
    return this.http.post<CreateAlbumResponse>(`${this.apiUrl}albums/upload`, request);
  }

  /**
   * Convert a File to Base64 string
   */
  async fileToBase64(file: File): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix (e.g., "data:audio/mpeg;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsDataURL(file);
    });
  }

  /**
   * Get audio duration from file
   */
  async getAudioDuration(file: File): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      const audio = new Audio();
      const url = URL.createObjectURL(file);

      audio.addEventListener('loadedmetadata', () => {
        URL.revokeObjectURL(url);
        resolve(Math.floor(audio.duration));
      });

      audio.addEventListener('error', () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load audio metadata'));
      });

      audio.src = url;
    });
  }
}