import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
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
  private readonly albumCache = new Map<string, AlbumResponse>();

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
    return this.http.get<ListAlbumsResponse>(`${this.apiUrl}albums`).pipe(
      tap(response => {
        // Cache all albums
        response.albums.forEach(album => {
          this.albumCache.set(album.albumId, album);
        });
      })
    );
  }

  /**
   * Get a specific album by ID
   */
  getAlbum(id: string): Observable<{ album: AlbumResponse }> {
    return this.http.get<{ album: AlbumResponse }>(`${this.apiUrl}albums/${id}`).pipe(
      tap(response => {
        // Cache album
        this.albumCache.set(id, response.album);
      })
    );
  }

  /**
   * Get cached album name (synchronous, returns ID if not in cache)
   */
  getCachedAlbumName(id: string): string {
    return this.albumCache.get(id)?.title || id;
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

  /**
   * Update an existing album (Admin only)
   */
  updateAlbum(albumId: string, request: UpdateAlbumRequest): Observable<UpdateAlbumResponse> {
    return this.http.put<UpdateAlbumResponse>(`${this.apiUrl}albums/${albumId}`, request);
  }

  /**
   * Delete an album (Admin only)
   */
  deleteAlbum(albumId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}albums/${albumId}`);
  }
}

export interface UpdateAlbumRequest {
  title?: string;
  artistIds?: string[];
  genres?: string[];
  releaseDate?: string;
  coverImageBase64?: string;
}

export interface UpdateAlbumResponse {
  message: string;
  album: AlbumResponse;
}
