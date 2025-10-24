import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { ConfigService } from './config.service';
import {
  Artist, CreateArtistRequest, UpdateArtistRequest,
  Song, UploadSongRequest, UpdateSongRequest, StreamUrlResponse,
  Album, UploadAlbumRequest, UpdateAlbumRequest,
  Subscription, CreateSubscriptionRequest, SubscriptionsResponse,
  DiscoveryResponse
} from '../models';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private configService = inject(ConfigService);

  private get apiUrl(): string {
    return this.configService.getApiUrl();
  }

  private async getAuthHeaders(): Promise<HttpHeaders> {
    const token = await this.authService.getAuthToken();
    console.log('Creating auth headers:', {
      hasToken: !!token,
      tokenLength: token?.length,
      tokenPreview: token ? token.substring(0, 50) + '...' : 'none'
    });

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    });

    console.log('Final headers:', headers.keys().map(key => `${key}: ${headers.get(key)?.substring(0, 50)}...`));
    return headers;
  }

  private handleError(error: any): Observable<never> {
    console.error('API Error:', error);
    let errorMessage = 'An unknown error occurred';

    if (error.error?.error) {
      errorMessage = error.error.error;
    } else if (error.message) {
      errorMessage = error.message;
    }

    return throwError(() => new Error(errorMessage));
  }

  // ===== ARTIST ENDPOINTS =====

  getArtists(genre?: string): Observable<Artist[]> {
    return new Observable(observer => {
      this.getAuthHeaders().then(headers => {
        let params = new HttpParams();
        if (genre) {
          params = params.set('genre', genre);
        }

        this.http.get<{ artists: Artist[], count: number }>(`${this.apiUrl}/artists`, {
          headers,
          params
        }).pipe(
          map(response => response.artists),
          catchError(this.handleError)
        ).subscribe(observer);
      });
    });
  }

  async getArtist(artistId: string): Promise<Observable<{ artist: Artist }>> {
    const headers = await this.getAuthHeaders();
    return this.http.get<{ artist: Artist }>(`${this.apiUrl}/artists/${artistId}`, {
      headers
    }).pipe(
      catchError(this.handleError)
    );
  }

  createArtist(artistData: CreateArtistRequest): Observable<Artist> {
    return new Observable(observer => {
      this.getAuthHeaders().then(headers => {
        this.http.post<{ message: string, artist: Artist }>(`${this.apiUrl}/artists`, artistData, {
          headers
        }).pipe(
          map(response => response.artist),
          catchError(this.handleError)
        ).subscribe(observer);
      });
    });
  }

  updateArtist(artistId: string, artistData: UpdateArtistRequest): Observable<Artist> {
    return new Observable(observer => {
      this.getAuthHeaders().then(headers => {
        this.http.put<{ message: string, artist: Artist }>(`${this.apiUrl}/artists/${artistId}`, artistData, {
          headers
        }).pipe(
          map(response => response.artist),
          catchError(this.handleError)
        ).subscribe(observer);
      });
    });
  }

  deleteArtist(artistId: string): Observable<any> {
    return new Observable(observer => {
      this.getAuthHeaders().then(headers => {
        this.http.delete<{ message: string }>(`${this.apiUrl}/artists/${artistId}`, {
          headers
        }).pipe(
          catchError(this.handleError)
        ).subscribe(observer);
      });
    });
  }

  // ===== SONG ENDPOINTS =====

  getSongs(filters?: { artist_id?: string, genre?: string, album_id?: string }): Observable<Song[]> {
    return new Observable(observer => {
      this.getAuthHeaders().then(headers => {
        let params = new HttpParams();

        if (filters?.artist_id) params = params.set('artist_id', filters.artist_id);
        if (filters?.genre) params = params.set('genre', filters.genre);
        if (filters?.album_id) params = params.set('album_id', filters.album_id);

        this.http.get<{ songs: Song[], count: number }>(`${this.apiUrl}/songs`, {
          headers,
          params
        }).pipe(
          map(response => response.songs),
          catchError(this.handleError)
        ).subscribe(observer);
      });
    });
  }

  getSong(songId: string): Observable<Song> {
    return new Observable(observer => {
      this.getAuthHeaders().then(headers => {
        this.http.get<{ song: Song }>(`${this.apiUrl}/songs/${songId}`, {
          headers
        }).pipe(
          map(response => response.song),
          catchError(this.handleError)
        ).subscribe(observer);
      });
    });
  }

  getSongDownloadUrl(songId: string): Observable<string> {
    return new Observable(observer => {
      this.getAuthHeaders().then(headers => {
        this.http.get<{ stream_url: string }>(`${this.apiUrl}/songs/${songId}/stream`, {
          headers
        }).pipe(
          map(response => response.stream_url),
          catchError(this.handleError)
        ).subscribe(observer);
      });
    });
  }

  createSong(songData: UploadSongRequest): Observable<Song> {
    return new Observable(observer => {
      this.getAuthHeaders().then(headers => {
        this.http.post<{ message: string, song: Song }>(`${this.apiUrl}/songs`, songData, {
          headers
        }).pipe(
          map(response => response.song),
          catchError(this.handleError)
        ).subscribe(observer);
      });
    });
  }

  updateSong(songId: string, songData: UpdateSongRequest): Observable<Song> {
    return new Observable(observer => {
      this.getAuthHeaders().then(headers => {
        this.http.put<{ message: string, song: Song }>(`${this.apiUrl}/songs/${songId}`, songData, {
          headers
        }).pipe(
          map(response => response.song),
          catchError(this.handleError)
        ).subscribe(observer);
      });
    });
  }

  deleteSong(songId: string): Observable<any> {
    return new Observable(observer => {
      this.getAuthHeaders().then(headers => {
        this.http.delete<{ message: string }>(`${this.apiUrl}/songs/${songId}`, {
          headers
        }).pipe(
          catchError(this.handleError)
        ).subscribe(observer);
      });
    });
  }

  async getStreamUrl(songId: string): Promise<Observable<StreamUrlResponse>> {
    const headers = await this.getAuthHeaders();
    return this.http.get<StreamUrlResponse>(`${this.apiUrl}/songs/${songId}/stream`, {
      headers
    }).pipe(
      catchError(this.handleError)
    );
  }

  // ===== ALBUM ENDPOINTS =====

  getAlbums(filters?: { artist_id?: string, genre?: string }): Observable<Album[]> {
    return new Observable(observer => {
      this.getAuthHeaders().then(headers => {
        let params = new HttpParams();

        if (filters?.artist_id) params = params.set('artist_id', filters.artist_id);
        if (filters?.genre) params = params.set('genre', filters.genre);

        this.http.get<{ albums: Album[], count: number }>(`${this.apiUrl}/albums`, {
          headers,
          params
        }).pipe(
          map(response => response.albums),
          catchError(this.handleError)
        ).subscribe(observer);
      });
    });
  }

  async getAlbum(albumId: string): Promise<Observable<{ album: Album }>> {
    const headers = await this.getAuthHeaders();
    return this.http.get<{ album: Album }>(`${this.apiUrl}/albums/${albumId}`, {
      headers
    }).pipe(
      catchError(this.handleError)
    );
  }

  async getAlbumSongs(albumId: string): Promise<Observable<{ album_id: string, songs: Song[], count: number }>> {
    const headers = await this.getAuthHeaders();
    return this.http.get<{ album_id: string, songs: Song[], count: number }>(`${this.apiUrl}/albums/${albumId}/songs`, {
      headers
    }).pipe(
      catchError(this.handleError)
    );
  }

  createAlbum(albumData: UploadAlbumRequest): Observable<Album> {
    return new Observable(observer => {
      this.getAuthHeaders().then(headers => {
        this.http.post<{ message: string, album: Album }>(`${this.apiUrl}/albums`, albumData, {
          headers
        }).pipe(
          map(response => response.album),
          catchError(this.handleError)
        ).subscribe(observer);
      });
    });
  }

  updateAlbum(albumId: string, albumData: UpdateAlbumRequest): Observable<Album> {
    return new Observable(observer => {
      this.getAuthHeaders().then(headers => {
        this.http.put<{ message: string, album: Album }>(`${this.apiUrl}/albums/${albumId}`, albumData, {
          headers
        }).pipe(
          map(response => response.album),
          catchError(this.handleError)
        ).subscribe(observer);
      });
    });
  }

  deleteAlbum(albumId: string): Observable<any> {
    return new Observable(observer => {
      this.getAuthHeaders().then(headers => {
        this.http.delete<{ message: string }>(`${this.apiUrl}/albums/${albumId}`, {
          headers
        }).pipe(
          catchError(this.handleError)
        ).subscribe(observer);
      });
    });
  }

  // ===== SUBSCRIPTION ENDPOINTS =====

  subscribeToArtist(artistId: string): Observable<any> {
    return new Observable(observer => {
      this.getAuthHeaders().then(headers => {
        this.http.post<any>(`${this.apiUrl}/subscriptions`, {
          type: 'ARTIST',
          target_id: artistId
        }, {
          headers
        }).pipe(
          catchError(this.handleError)
        ).subscribe(observer);
      });
    });
  }

  unsubscribeFromArtist(artistId: string): Observable<any> {
    return new Observable(observer => {
      this.getAuthHeaders().then(headers => {
        this.http.delete<any>(`${this.apiUrl}/subscriptions/ARTIST/${artistId}`, {
          headers
        }).pipe(
          catchError(this.handleError)
        ).subscribe(observer);
      });
    });
  }

  getUserSubscriptions(): Observable<Subscription[]> {
    return new Observable(observer => {
      this.getAuthHeaders().then(headers => {
        this.http.get<SubscriptionsResponse>(`${this.apiUrl}/subscriptions`, {
          headers
        }).pipe(
          map(response => response.subscriptions),
          catchError(this.handleError)
        ).subscribe(observer);
      });
    });
  }

  updateSubscription(subscriptionId: string, data: any): Observable<any> {
    return new Observable(observer => {
      this.getAuthHeaders().then(headers => {
        this.http.put<any>(`${this.apiUrl}/subscriptions/${subscriptionId}`, data, {
          headers
        }).pipe(
          catchError(this.handleError)
        ).subscribe(observer);
      });
    });
  }

  // ===== NOTIFICATION ENDPOINTS =====

  getUserNotifications(): Observable<any[]> {
    return new Observable(observer => {
      this.getAuthHeaders().then(headers => {
        this.http.get<{ notifications: any[] }>(`${this.apiUrl}/notifications`, {
          headers
        }).pipe(
          map(response => response.notifications),
          catchError(this.handleError)
        ).subscribe(observer);
      });
    });
  }

  markNotificationAsRead(notificationId: string): Observable<any> {
    return new Observable(observer => {
      this.getAuthHeaders().then(headers => {
        this.http.patch<any>(`${this.apiUrl}/notifications/${notificationId}`, {
          read: true
        }, {
          headers
        }).pipe(
          catchError(this.handleError)
        ).subscribe(observer);
      });
    });
  }

  markAllNotificationsAsRead(): Observable<any> {
    return new Observable(observer => {
      this.getAuthHeaders().then(headers => {
        this.http.patch<any>(`${this.apiUrl}/notifications/mark-all-read`, {}, {
          headers
        }).pipe(
          catchError(this.handleError)
        ).subscribe(observer);
      });
    });
  }

  // ===== DISCOVERY ENDPOINTS =====

  discoverContent(genre: string, type?: string, limit?: number): Observable<DiscoveryResponse> {
    return new Observable(observer => {
      this.getAuthHeaders().then(headers => {
        let params = new HttpParams().set('genre', genre);

        if (type) params = params.set('type', type);
        if (limit) params = params.set('limit', limit.toString());

        this.http.get<DiscoveryResponse>(`${this.apiUrl}/discover`, {
          headers,
          params
        }).pipe(
          catchError(this.handleError)
        ).subscribe(observer);
      });
    });
  }

  // ===== SUBSCRIPTION ENDPOINTS =====

  async getSubscriptions(type?: string): Promise<Observable<SubscriptionsResponse>> {
    const headers = await this.getAuthHeaders();
    let params = new HttpParams();
    if (type) params = params.set('type', type);

    return this.http.get<SubscriptionsResponse>(`${this.apiUrl}/subscriptions`, {
      headers,
      params
    }).pipe(
      catchError(this.handleError)
    );
  }

  async createSubscription(subscriptionData: CreateSubscriptionRequest): Promise<Observable<{ message: string, subscription: any }>> {
    const headers = await this.getAuthHeaders();
    return this.http.post<{ message: string, subscription: any }>(`${this.apiUrl}/subscriptions`, subscriptionData, {
      headers
    }).pipe(
      catchError(this.handleError)
    );
  }

  async deleteSubscription(subscriptionId: string): Promise<Observable<{ message: string, deleted_subscription: any }>> {
    const headers = await this.getAuthHeaders();
    return this.http.delete<{ message: string, deleted_subscription: any }>(`${this.apiUrl}/subscriptions/${subscriptionId}`, {
      headers
    }).pipe(
      catchError(this.handleError)
    );
  }
}