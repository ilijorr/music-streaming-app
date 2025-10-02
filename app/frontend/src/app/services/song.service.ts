import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';

export interface CreateSongRequest {
  audioFileKey: string;
  title: string;
  artistIds: string[];
  genres: string[];
  filename?: string;
  coverImageKey?: string;
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
   * Create a new song from S3 keys
   */
  createSong(request: CreateSongRequest): Observable<CreateSongResponse> {
    return this.http.post<CreateSongResponse>(`${this.apiUrl}songs/from-s3`, request);
  }

  /**
   * List all songs
   */
  listSongs(): Observable<{ songs: SongData[], count: number }> {
    return this.http.get<{ songs: SongData[], count: number }>(`${this.apiUrl}songs`);
  }

  /**
   * Get a specific song by ID
   */
  getSong(id: string): Observable<{ song: SongData }> {
    return this.http.get<{ song: SongData }>(`${this.apiUrl}songs/${id}`);
  }

  /**
   * Get presigned download URL for a song
   */
  getDownloadUrl(id: string): Observable<{ downloadUrl: string, expiresIn: number }> {
    return this.http.get<{ downloadUrl: string, expiresIn: number }>(`${this.apiUrl}songs/${id}/download-url`);
  }

  /**
   * Get presigned URL for song cover image
   */
  getCoverImageUrl(songId: string): Observable<{ downloadUrl: string }> {
    return this.http.get<{ downloadUrl: string }>(`${this.apiUrl}songs/${songId}/cover-url`);
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