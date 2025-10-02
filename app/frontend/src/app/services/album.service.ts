import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config.service';

export interface CreateAlbumRequest {
  title: string;
  artistIds: string[];
  releaseDate: string;
  genres: string[];
  coverImageBase64?: string;
}

export interface AlbumResponse {
  albumId: string;
  title: string;
  artistIds: string[];
  releaseDate: string;
  genres: string[];
  coverUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAlbumResponse {
  message: string;
  album: AlbumResponse;
}

export interface ListAlbumsResponse {
  albums: AlbumResponse[];
  count: number;
}

@Injectable({
  providedIn: 'root'
})
export class AlbumService {
  private readonly http = inject(HttpClient);
  private readonly configService = inject(ConfigService);

  private get apiUrl(): string {
    return this.configService.getApiUrl();
  }

  /**
   * Create a new album
   */
  createAlbum(request: CreateAlbumRequest): Observable<CreateAlbumResponse> {
    return this.http.post<CreateAlbumResponse>(`${this.apiUrl}albums`, request);
  }

  /**
   * List all albums
   */
  listAlbums(): Observable<ListAlbumsResponse> {
    return this.http.get<ListAlbumsResponse>(`${this.apiUrl}albums`);
  }

  /**
   * Get a specific album by ID
   */
  getAlbum(id: string): Observable<{ album: AlbumResponse }> {
    return this.http.get<{ album: AlbumResponse }>(`${this.apiUrl}albums/${id}`);
  }

  /**
   * Get presigned URL for album cover image
   */
  getCoverImageUrl(albumId: string): Observable<{ downloadUrl: string }> {
    return this.http.get<{ downloadUrl: string }>(`${this.apiUrl}albums/${albumId}/cover-url`);
  }

  /**
   * Get songs for a specific album
   */
  getAlbumSongs(albumId: string): Observable<{ songs: any[], count: number }> {
    return this.http.get<{ songs: any[], count: number }>(`${this.apiUrl}albums/${albumId}/songs`);
  }

  /**
   * Convert a File to Base64 string
   */
  async fileToBase64(file: File): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsDataURL(file);
    });
  }
}
