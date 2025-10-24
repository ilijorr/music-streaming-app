import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../services/api.service';
import { AudioPlayerService } from '../../services/audio-player.service';
import { AuthService } from '../../services/auth.service';
import { Song } from '../../models/song.model';
import { Album } from '../../models/album.model';
import { Artist } from '../../models/artist.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatGridListModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    RouterLink
  ],
  template: `
    <div class="home-container">
      <div class="welcome-section">
        <h1>Welcome to Music Stream</h1>
        <p>Discover and enjoy your favorite music</p>
      </div>

      <!-- Recently Added Songs -->
      <section class="content-section">
        <div class="section-header">
          <h2>Recently Added Songs</h2>
          <a mat-button routerLink="/discover">View All</a>
        </div>

        @if (loadingSongs()) {
          <div class="loading">
            <mat-spinner></mat-spinner>
          </div>
        } @else {
          <div class="songs-grid">
            @for (song of recentSongs(); track song.songId) {
              <mat-card class="song-card">
                <div class="song-cover">
                  @if (song.coverUrl) {
                    <img [src]="song.coverUrl" [alt]="song.title">
                  } @else {
                    <div class="cover-placeholder">
                      <mat-icon>music_note</mat-icon>
                    </div>
                  }
                  <div class="play-overlay">
                    <button mat-fab color="primary" (click)="playSong(song)">
                      <mat-icon>play_arrow</mat-icon>
                    </button>
                  </div>
                </div>
                <mat-card-content>
                  <h3 class="song-title">{{ song.title }}</h3>
                  <p class="song-artists">{{ getArtistNames(song.artistIds) }}</p>
                  <p class="song-duration">{{ formatDuration(song.duration) }}</p>
                </mat-card-content>
              </mat-card>
            }
          </div>
        }
      </section>

      <!-- Featured Albums -->
      <section class="content-section">
        <div class="section-header">
          <h2>Featured Albums</h2>
          <a mat-button routerLink="/discover">View All</a>
        </div>

        @if (loadingAlbums()) {
          <div class="loading">
            <mat-spinner></mat-spinner>
          </div>
        } @else {
          <div class="albums-grid">
            @for (album of featuredAlbums(); track album.albumId) {
              <mat-card class="album-card">
                <div class="album-cover">
                  @if (album.coverUrl) {
                    <img [src]="album.coverUrl" [alt]="album.title">
                  } @else {
                    <div class="cover-placeholder">
                      <mat-icon>album</mat-icon>
                    </div>
                  }
                  <div class="play-overlay">
                    <button mat-fab color="primary" (click)="playAlbum(album)">
                      <mat-icon>play_arrow</mat-icon>
                    </button>
                  </div>
                </div>
                <mat-card-content>
                  <h3 class="album-title">{{ album.title }}</h3>
                  <p class="album-artists">{{ getArtistNames(album.artistIds) }}</p>
                  <p class="album-year">{{ album.releaseYear }}</p>
                  <p class="album-songs">{{ album.songIds?.length || 0 }} songs</p>
                </mat-card-content>
              </mat-card>
            }
          </div>
        }
      </section>

      <!-- Popular Artists -->
      <section class="content-section">
        <div class="section-header">
          <h2>Popular Artists</h2>
          <a mat-button routerLink="/discover">View All</a>
        </div>

        @if (loadingArtists()) {
          <div class="loading">
            <mat-spinner></mat-spinner>
          </div>
        } @else {
          <div class="artists-grid">
            @for (artist of popularArtists(); track artist.artistId) {
              <mat-card class="artist-card">
                <div class="artist-image">
                  @if (artist.imageUrl) {
                    <img [src]="artist.imageUrl" [alt]="artist.name">
                  } @else {
                    <div class="image-placeholder">
                      <mat-icon>person</mat-icon>
                    </div>
                  }
                </div>
                <mat-card-content>
                  <h3 class="artist-name">{{ artist.name }}</h3>
                  <div class="artist-genres">
                    @for (genre of artist.genres; track genre) {
                      <mat-chip>{{ genre }}</mat-chip>
                    }
                  </div>
                </mat-card-content>
                <mat-card-actions>
                  <button mat-button (click)="exploreArtist(artist)">
                    <mat-icon>explore</mat-icon>
                    Explore
                  </button>
                </mat-card-actions>
              </mat-card>
            }
          </div>
        }
      </section>

      <!-- Quick Actions -->
      <section class="content-section">
        <div class="section-header">
          <h2>Quick Actions</h2>
        </div>
        <div class="quick-actions">
          <mat-card class="action-card">
            <mat-card-content>
              <mat-icon>explore</mat-icon>
              <h3>Discover Music</h3>
              <p>Explore new songs, albums, and artists</p>
            </mat-card-content>
            <mat-card-actions>
              <button mat-raised-button color="primary" routerLink="/discover">Discover</button>
            </mat-card-actions>
          </mat-card>

          <mat-card class="action-card">
            <mat-card-content>
              <mat-icon>subscriptions</mat-icon>
              <h3>My Subscriptions</h3>
              <p>Manage your artist subscriptions</p>
            </mat-card-content>
            <mat-card-actions>
              <button mat-raised-button color="accent" routerLink="/subscriptions">View Subscriptions</button>
            </mat-card-actions>
          </mat-card>

          @if (isCurrentUserAdmin()) {
            <mat-card class="action-card">
              <mat-card-content>
                <mat-icon>admin_panel_settings</mat-icon>
                <h3>Admin Panel</h3>
                <p>Manage content and users</p>
              </mat-card-content>
              <mat-card-actions>
                <button mat-raised-button color="warn" routerLink="/admin">Admin</button>
              </mat-card-actions>
            </mat-card>
          }
        </div>
      </section>
    </div>
  `,
  styles: [`
    .home-container {
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .welcome-section {
      text-align: center;
      margin-bottom: 48px;
      padding: 48px 0;
      background: linear-gradient(135deg, #1976d2 0%, #42a5f5 100%);
      color: white;
      border-radius: 8px;
    }

    .welcome-section h1 {
      font-size: 3rem;
      margin-bottom: 16px;
      font-weight: 300;
    }

    .welcome-section p {
      font-size: 1.2rem;
      opacity: 0.9;
    }

    .content-section {
      margin-bottom: 48px;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }

    .section-header h2 {
      margin: 0;
      color: #333;
    }

    .loading {
      display: flex;
      justify-content: center;
      padding: 40px;
    }

    .songs-grid,
    .albums-grid,
    .artists-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 24px;
    }

    .quick-actions {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 24px;
    }

    .song-card,
    .album-card,
    .artist-card,
    .action-card {
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .song-card:hover,
    .album-card:hover,
    .artist-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    }

    .song-cover,
    .album-cover,
    .artist-image {
      position: relative;
      width: 100%;
      height: 200px;
      overflow: hidden;
      border-radius: 4px;
    }

    .song-cover img,
    .album-cover img,
    .artist-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .cover-placeholder,
    .image-placeholder {
      width: 100%;
      height: 100%;
      background: #f5f5f5;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #999;
    }

    .cover-placeholder mat-icon,
    .image-placeholder mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
    }

    .play-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .song-card:hover .play-overlay,
    .album-card:hover .play-overlay {
      opacity: 1;
    }

    .song-title,
    .album-title,
    .artist-name {
      font-weight: 500;
      margin: 8px 0 4px 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .song-artists,
    .album-artists,
    .song-duration,
    .album-year,
    .album-songs {
      font-size: 0.9rem;
      color: #666;
      margin: 4px 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .artist-genres {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 8px;
    }

    .artist-genres mat-chip {
      font-size: 0.8rem;
    }

    .action-card {
      text-align: center;
    }

    .action-card mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #1976d2;
      margin-bottom: 16px;
    }

    .action-card h3 {
      margin: 0 0 8px 0;
      color: #333;
    }

    .action-card p {
      color: #666;
      margin-bottom: 16px;
    }

    .artist-image {
      border-radius: 50%;
    }

    @media (max-width: 768px) {
      .home-container {
        padding: 16px;
      }

      .welcome-section {
        padding: 32px 16px;
      }

      .welcome-section h1 {
        font-size: 2rem;
      }

      .songs-grid,
      .albums-grid,
      .artists-grid {
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 16px;
      }

      .quick-actions {
        grid-template-columns: 1fr;
      }

      .section-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 16px;
      }
    }
  `]
})
export class HomeComponent implements OnInit {
  private apiService = inject(ApiService);
  private audioPlayerService = inject(AudioPlayerService);
  private authService = inject(AuthService);

  public recentSongs = signal<Song[]>([]);
  public featuredAlbums = signal<Album[]>([]);
  public popularArtists = signal<Artist[]>([]);

  public loadingSongs = signal(false);
  public loadingAlbums = signal(false);
  public loadingArtists = signal(false);

  ngOnInit(): void {
    this.loadRecentSongs();
    this.loadFeaturedAlbums();
    this.loadPopularArtists();
  }

  loadRecentSongs(): void {
    this.loadingSongs.set(true);
    this.apiService.getSongs().subscribe({
      next: (songs) => {
        // Sort by creation date and take first 6
        const sortedSongs = songs
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 6);
        this.recentSongs.set(sortedSongs);
        this.loadingSongs.set(false);
      },
      error: () => {
        this.loadingSongs.set(false);
      }
    });
  }

  loadFeaturedAlbums(): void {
    this.loadingAlbums.set(true);
    this.apiService.getAlbums().subscribe({
      next: (albums) => {
        // Take first 6 albums as featured
        this.featuredAlbums.set(albums.slice(0, 6));
        this.loadingAlbums.set(false);
      },
      error: () => {
        this.loadingAlbums.set(false);
      }
    });
  }

  loadPopularArtists(): void {
    this.loadingArtists.set(true);
    this.apiService.getArtists().subscribe({
      next: (artists) => {
        // Take first 6 artists as popular
        this.popularArtists.set(artists.slice(0, 6));
        this.loadingArtists.set(false);
      },
      error: () => {
        this.loadingArtists.set(false);
      }
    });
  }

  playSong(song: Song): void {
    this.audioPlayerService.playSong(song);
  }

  playAlbum(album: Album): void {
    if (album.songIds && album.songIds.length > 0) {
      // Get first song of the album
      this.apiService.getSong(album.songIds[0]).subscribe({
        next: (song) => {
          this.audioPlayerService.playSong(song);
        }
      });
    }
  }

  exploreArtist(artist: Artist): void {
    // Navigate to artist's songs in discover page
    // This would require implementing artist filtering in discover page
    console.log('Exploring artist:', artist.name);
  }

  getArtistNames(artistIds: string[]): string {
    const artistNames = artistIds.map(id => {
      const artist = this.popularArtists().find(a => a.artistId === id);
      return artist ? artist.name : 'Unknown Artist';
    });
    return artistNames.join(', ');
  }

  formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  isCurrentUserAdmin(): boolean {
    return this.authService.isAdmin();
  }
}