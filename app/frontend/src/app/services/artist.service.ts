import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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
    return this.http.get<ListArtistsResponse>(`${this.apiUrl}artists`);
  }

  /**
   * Get a specific artist by ID
   */
  getArtist(id: string): Observable<GetArtistResponse> {
    return this.http.get<GetArtistResponse>(`${this.apiUrl}artists/${id}`);
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
