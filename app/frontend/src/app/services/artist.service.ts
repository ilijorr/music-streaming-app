import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { ConfigService } from './config.service';
import {
  CreateArtistRequest,
  CreateArtistResponse,
  ArtistResponse
} from '../models/artist.interface';

export interface ListArtistsResponse {
  artists: ArtistResponse[];
  count: number;
}

export interface GetArtistResponse {
  artist: ArtistResponse;
}

@Injectable({
  providedIn: 'root'
})
export class ArtistService {
  private readonly http = inject(HttpClient);
  private readonly configService = inject(ConfigService);
  private readonly artistCache = new Map<string, ArtistResponse>();
  private readonly allArtists = signal<ArtistResponse[]>([]);

  private get apiUrl(): string {
    return this.configService.getApiUrl();
  }

  /**
   * Create a new artist
   */
  createArtist(request: CreateArtistRequest): Observable<CreateArtistResponse> {
    return this.http.post<CreateArtistResponse>(
      `${this.apiUrl}artists`,
      request
    );
  }

  /**
   * List all artists
   */
  listArtists(): Observable<ListArtistsResponse> {
    return this.http.get<ListArtistsResponse>(`${this.apiUrl}artists`).pipe(
      tap(response => {
        // Cache all artists
        response.artists.forEach(artist => {
          this.artistCache.set(artist.artistId, artist);
        });
        this.allArtists.set(response.artists);
      })
    );
  }

  /**
   * Get a specific artist by ID
   */
  getArtist(id: string): Observable<GetArtistResponse> {
    return this.http.get<GetArtistResponse>(`${this.apiUrl}artists/${id}`).pipe(
      tap(response => {
        // Cache artist
        this.artistCache.set(id, response.artist);
      })
    );
  }

  /**
   * Get artist name by ID (uses cache if available)
   */
  getArtistName(id: string): Observable<string> {
    // Check cache first
    const cached = this.artistCache.get(id);
    if (cached) {
      return of(cached.name);
    }

    // Fetch from API
    return this.getArtist(id).pipe(
      map(response => response.artist.name),
      catchError(() => of(id)) // Return ID if fetch fails
    );
  }

  /**
   * Get multiple artist names by IDs
   */
  getArtistNames(ids: string[]): Observable<string[]> {
    const requests = ids.map(id => this.getArtistName(id));
    return forkJoin(requests);
  }

  /**
   * Get cached artist name (synchronous, returns ID if not in cache)
   */
  getCachedArtistName(id: string): string {
    return this.artistCache.get(id)?.name || id;
  }

  /**
   * Convert a File to Base64 string
   */
  async fileToBase64(file: File): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
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
