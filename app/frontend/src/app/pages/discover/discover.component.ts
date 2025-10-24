import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';

import { ApiService } from '../../services/api.service';
import { AudioPlayerService } from '../../services/audio-player.service';
import { Song } from '../../models/song.model';
import { Album } from '../../models/album.model';
import { Artist } from '../../models/artist.model';

@Component({
  selector: 'app-discover',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTabsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatPaginatorModule,
    MatSnackBarModule
  ],
  template: `
    <div class="discover-container">
      <div class="header">
        <h1>Discover Music</h1>
        <div class="search-bar">
          <mat-form-field appearance="outline" class="search-input">
            <mat-label>Search for songs, albums, or artists</mat-label>
            <input matInput [(ngModel)]="searchQuery" (keyup.enter)="search()" placeholder="Type to search...">
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>
          <button mat-raised-button color="primary" (click)="search()">Search</button>
        </div>
      </div>

      <mat-tab-group [(selectedIndex)]="activeTab" (selectedIndexChange)="onTabChange($event)">
        <!-- Songs Tab -->
        <mat-tab label="Songs">
          <div class="tab-content">
            <div class="filters">
              <mat-form-field appearance="outline">
                <mat-label>Genre</mat-label>
                <mat-select [(ngModel)]="selectedGenre" (selectionChange)="filterSongs()">
                  <mat-option value="">All Genres</mat-option>
                  @for (genre of availableGenres(); track genre) {
                    <mat-option [value]="genre">{{ genre }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Sort By</mat-label>
                <mat-select [(ngModel)]="songSortBy" (selectionChange)="filterSongs()">
                  <mat-option value="newest">Newest First</mat-option>
                  <mat-option value="oldest">Oldest First</mat-option>
                  <mat-option value="title">Title A-Z</mat-option>
                  <mat-option value="duration">Duration</mat-option>
                </mat-select>
              </mat-form-field>

              <button mat-button (click)="clearFilters()">
                <mat-icon>clear</mat-icon>
                Clear Filters
              </button>
            </div>

            @if (loadingSongs()) {
              <div class="loading">
                <mat-spinner></mat-spinner>
              </div>
            } @else {
              <div class="songs-grid">
                @for (song of paginatedSongs(); track song.songId) {
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
                    <mat-card-actions>
                      <button mat-icon-button (click)="toggleFavorite(song)" [color]="isFavorite(song) ? 'accent' : ''">
                        <mat-icon>{{ isFavorite(song) ? 'favorite' : 'favorite_border' }}</mat-icon>
                      </button>
                      <button mat-icon-button (click)="shareSong(song)">
                        <mat-icon>share</mat-icon>
                      </button>
                    </mat-card-actions>
                  </mat-card>
                }
              </div>

              <mat-paginator
                [length]="filteredSongs().length"
                [pageSize]="songsPageSize"
                [pageSizeOptions]="[12, 24, 48]"
                (page)="onSongsPageChange($event)"
                showFirstLastButtons>
              </mat-paginator>
            }
          </div>
        </mat-tab>

        <!-- Albums Tab -->
        <mat-tab label="Albums">
          <div class="tab-content">
            <div class="filters">
              <mat-form-field appearance="outline">
                <mat-label>Year</mat-label>
                <mat-select [(ngModel)]="selectedYear" (selectionChange)="filterAlbums()">
                  <mat-option value="">All Years</mat-option>
                  @for (year of availableYears(); track year) {
                    <mat-option [value]="year">{{ year }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Sort By</mat-label>
                <mat-select [(ngModel)]="albumSortBy" (selectionChange)="filterAlbums()">
                  <mat-option value="newest">Newest First</mat-option>
                  <mat-option value="oldest">Oldest First</mat-option>
                  <mat-option value="title">Title A-Z</mat-option>
                  <mat-option value="year">Release Year</mat-option>
                </mat-select>
              </mat-form-field>

              <button mat-button (click)="clearFilters()">
                <mat-icon>clear</mat-icon>
                Clear Filters
              </button>
            </div>

            @if (loadingAlbums()) {
              <div class="loading">
                <mat-spinner></mat-spinner>
              </div>
            } @else {
              <div class="albums-grid">
                @for (album of paginatedAlbums(); track album.albumId) {
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
                    <mat-card-actions>
                      <button mat-button (click)="viewAlbumSongs(album)">
                        <mat-icon>library_music</mat-icon>
                        View Songs
                      </button>
                    </mat-card-actions>
                  </mat-card>
                }
              </div>

              <mat-paginator
                [length]="filteredAlbums().length"
                [pageSize]="albumsPageSize"
                [pageSizeOptions]="[12, 24, 48]"
                (page)="onAlbumsPageChange($event)"
                showFirstLastButtons>
              </mat-paginator>
            }
          </div>
        </mat-tab>

        <!-- Artists Tab -->
        <mat-tab label="Artists">
          <div class="tab-content">
            <div class="filters">
              <mat-form-field appearance="outline">
                <mat-label>Genre</mat-label>
                <mat-select [(ngModel)]="selectedArtistGenre" (selectionChange)="filterArtists()">
                  <mat-option value="">All Genres</mat-option>
                  @for (genre of availableGenres(); track genre) {
                    <mat-option [value]="genre">{{ genre }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Sort By</mat-label>
                <mat-select [(ngModel)]="artistSortBy" (selectionChange)="filterArtists()">
                  <mat-option value="name">Name A-Z</mat-option>
                  <mat-option value="newest">Newest First</mat-option>
                  <mat-option value="oldest">Oldest First</mat-option>
                </mat-select>
              </mat-form-field>

              <button mat-button (click)="clearFilters()">
                <mat-icon>clear</mat-icon>
                Clear Filters
              </button>
            </div>

            @if (loadingArtists()) {
              <div class="loading">
                <mat-spinner></mat-spinner>
              </div>
            } @else {
              <div class="artists-grid">
                @for (artist of paginatedArtists(); track artist.artistId) {
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
                      <p class="artist-bio">{{ artist.biography | slice:0:100 }}{{ artist.biography.length > 100 ? '...' : '' }}</p>
                      <div class="artist-genres">
                        @for (genre of artist.genres; track genre) {
                          <mat-chip>{{ genre }}</mat-chip>
                        }
                      </div>
                    </mat-card-content>
                    <mat-card-actions>
                      <button mat-button (click)="viewArtistSongs(artist)">
                        <mat-icon>library_music</mat-icon>
                        View Songs
                      </button>
                      <button mat-button (click)="subscribeToArtist(artist)" [disabled]="isSubscribed(artist)">
                        <mat-icon>{{ isSubscribed(artist) ? 'notifications' : 'notifications_none' }}</mat-icon>
                        {{ isSubscribed(artist) ? 'Subscribed' : 'Subscribe' }}
                      </button>
                    </mat-card-actions>
                  </mat-card>
                }
              </div>

              <mat-paginator
                [length]="filteredArtists().length"
                [pageSize]="artistsPageSize"
                [pageSizeOptions]="[12, 24, 48]"
                (page)="onArtistsPageChange($event)"
                showFirstLastButtons>
              </mat-paginator>
            }
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    .discover-container {
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .header {
      margin-bottom: 32px;
    }

    .header h1 {
      margin-bottom: 24px;
      color: #333;
    }

    .search-bar {
      display: flex;
      gap: 16px;
      align-items: flex-end;
    }

    .search-input {
      flex: 1;
      max-width: 400px;
    }

    .tab-content {
      padding: 24px 0;
    }

    .filters {
      display: flex;
      gap: 16px;
      margin-bottom: 24px;
      align-items: center;
      flex-wrap: wrap;
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
      margin-bottom: 32px;
    }

    .song-card,
    .album-card,
    .artist-card {
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .song-card:hover,
    .album-card:hover,
    .artist-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    }

    .song-cover,
    .album-cover {
      position: relative;
      width: 100%;
      height: 200px;
      overflow: hidden;
      border-radius: 4px;
    }

    .artist-image {
      position: relative;
      width: 100%;
      height: 200px;
      overflow: hidden;
      border-radius: 50%;
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
    .album-songs,
    .artist-bio {
      font-size: 0.9rem;
      color: #666;
      margin: 4px 0;
    }

    .artist-bio {
      line-height: 1.4;
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

    mat-paginator {
      margin-top: 24px;
    }

    @media (max-width: 768px) {
      .discover-container {
        padding: 16px;
      }

      .search-bar {
        flex-direction: column;
        align-items: stretch;
      }

      .search-input {
        max-width: none;
      }

      .filters {
        flex-direction: column;
        align-items: stretch;
      }

      .songs-grid,
      .albums-grid,
      .artists-grid {
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 16px;
      }
    }
  `]
})
export class DiscoverComponent implements OnInit {
  private apiService = inject(ApiService);
  private audioPlayerService = inject(AudioPlayerService);
  private snackBar = inject(MatSnackBar);

  public songs = signal<Song[]>([]);
  public albums = signal<Album[]>([]);
  public artists = signal<Artist[]>([]);

  public filteredSongs = signal<Song[]>([]);
  public filteredAlbums = signal<Album[]>([]);
  public filteredArtists = signal<Artist[]>([]);

  public paginatedSongs = signal<Song[]>([]);
  public paginatedAlbums = signal<Album[]>([]);
  public paginatedArtists = signal<Artist[]>([]);

  public loadingSongs = signal(false);
  public loadingAlbums = signal(false);
  public loadingArtists = signal(false);

  public searchQuery = '';
  public activeTab = 0;

  public selectedGenre = '';
  public selectedYear = '';
  public selectedArtistGenre = '';

  public songSortBy = 'newest';
  public albumSortBy = 'newest';
  public artistSortBy = 'name';

  public songsPageSize = 12;
  public albumsPageSize = 12;
  public artistsPageSize = 12;

  public songsPageIndex = 0;
  public albumsPageIndex = 0;
  public artistsPageIndex = 0;

  public availableGenres = signal<string[]>([]);
  public availableYears = signal<number[]>([]);

  public favoriteSongs = signal<string[]>([]);
  public subscribedArtists = signal<string[]>([]);

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loadSongs();
    this.loadAlbums();
    this.loadArtists();
  }

  loadSongs(): void {
    this.loadingSongs.set(true);
    this.apiService.getSongs().subscribe({
      next: (songs) => {
        this.songs.set(songs);
        this.filteredSongs.set(songs);
        this.updatePaginatedSongs();
        this.updateAvailableGenres();
        this.loadingSongs.set(false);
      },
      error: () => {
        this.loadingSongs.set(false);
      }
    });
  }

  loadAlbums(): void {
    this.loadingAlbums.set(true);
    this.apiService.getAlbums().subscribe({
      next: (albums) => {
        this.albums.set(albums);
        this.filteredAlbums.set(albums);
        this.updatePaginatedAlbums();
        this.updateAvailableYears();
        this.loadingAlbums.set(false);
      },
      error: () => {
        this.loadingAlbums.set(false);
      }
    });
  }

  loadArtists(): void {
    this.loadingArtists.set(true);
    this.apiService.getArtists().subscribe({
      next: (artists) => {
        this.artists.set(artists);
        this.filteredArtists.set(artists);
        this.updatePaginatedArtists();
        this.updateAvailableGenres();
        this.loadingArtists.set(false);
      },
      error: () => {
        this.loadingArtists.set(false);
      }
    });
  }

  search(): void {
    this.filterSongs();
    this.filterAlbums();
    this.filterArtists();
  }

  filterSongs(): void {
    let filtered = this.songs();

    if (this.searchQuery) {
      filtered = filtered.filter(song =>
        song.title.toLowerCase().includes(this.searchQuery.toLowerCase())
      );
    }

    if (this.selectedGenre) {
      // Filter by artist genres
      filtered = filtered.filter(song =>
        song.artistIds.some(artistId => {
          const artist = this.artists().find(a => a.artistId === artistId);
          return artist?.genres.includes(this.selectedGenre);
        })
      );
    }

    filtered = this.sortSongs(filtered);
    this.filteredSongs.set(filtered);
    this.songsPageIndex = 0;
    this.updatePaginatedSongs();
  }

  filterAlbums(): void {
    let filtered = this.albums();

    if (this.searchQuery) {
      filtered = filtered.filter(album =>
        album.title.toLowerCase().includes(this.searchQuery.toLowerCase())
      );
    }

    if (this.selectedYear) {
      filtered = filtered.filter(album => album.releaseYear === parseInt(this.selectedYear));
    }

    filtered = this.sortAlbums(filtered);
    this.filteredAlbums.set(filtered);
    this.albumsPageIndex = 0;
    this.updatePaginatedAlbums();
  }

  filterArtists(): void {
    let filtered = this.artists();

    if (this.searchQuery) {
      filtered = filtered.filter(artist =>
        artist.name.toLowerCase().includes(this.searchQuery.toLowerCase())
      );
    }

    if (this.selectedArtistGenre) {
      filtered = filtered.filter(artist =>
        artist.genres.includes(this.selectedArtistGenre)
      );
    }

    filtered = this.sortArtists(filtered);
    this.filteredArtists.set(filtered);
    this.artistsPageIndex = 0;
    this.updatePaginatedArtists();
  }

  sortSongs(songs: Song[]): Song[] {
    switch (this.songSortBy) {
      case 'newest':
        return songs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      case 'oldest':
        return songs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      case 'title':
        return songs.sort((a, b) => a.title.localeCompare(b.title));
      case 'duration':
        return songs.sort((a, b) => a.duration - b.duration);
      default:
        return songs;
    }
  }

  sortAlbums(albums: Album[]): Album[] {
    switch (this.albumSortBy) {
      case 'newest':
        return albums.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      case 'oldest':
        return albums.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      case 'title':
        return albums.sort((a, b) => a.title.localeCompare(b.title));
      case 'year':
        return albums.sort((a, b) => b.releaseYear - a.releaseYear);
      default:
        return albums;
    }
  }

  sortArtists(artists: Artist[]): Artist[] {
    switch (this.artistSortBy) {
      case 'name':
        return artists.sort((a, b) => a.name.localeCompare(b.name));
      case 'newest':
        return artists.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      case 'oldest':
        return artists.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      default:
        return artists;
    }
  }

  updatePaginatedSongs(): void {
    const start = this.songsPageIndex * this.songsPageSize;
    const end = start + this.songsPageSize;
    this.paginatedSongs.set(this.filteredSongs().slice(start, end));
  }

  updatePaginatedAlbums(): void {
    const start = this.albumsPageIndex * this.albumsPageSize;
    const end = start + this.albumsPageSize;
    this.paginatedAlbums.set(this.filteredAlbums().slice(start, end));
  }

  updatePaginatedArtists(): void {
    const start = this.artistsPageIndex * this.artistsPageSize;
    const end = start + this.artistsPageSize;
    this.paginatedArtists.set(this.filteredArtists().slice(start, end));
  }

  updateAvailableGenres(): void {
    const genres = new Set<string>();
    this.artists().forEach(artist => {
      artist.genres.forEach(genre => genres.add(genre));
    });
    this.availableGenres.set(Array.from(genres).sort());
  }

  updateAvailableYears(): void {
    const years = new Set<number>();
    this.albums().forEach(album => years.add(album.releaseYear));
    this.availableYears.set(Array.from(years).sort((a, b) => b - a));
  }

  onTabChange(index: number): void {
    this.activeTab = index;
  }

  onSongsPageChange(event: PageEvent): void {
    this.songsPageIndex = event.pageIndex;
    this.songsPageSize = event.pageSize;
    this.updatePaginatedSongs();
  }

  onAlbumsPageChange(event: PageEvent): void {
    this.albumsPageIndex = event.pageIndex;
    this.albumsPageSize = event.pageSize;
    this.updatePaginatedAlbums();
  }

  onArtistsPageChange(event: PageEvent): void {
    this.artistsPageIndex = event.pageIndex;
    this.artistsPageSize = event.pageSize;
    this.updatePaginatedArtists();
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.selectedGenre = '';
    this.selectedYear = '';
    this.selectedArtistGenre = '';
    this.songSortBy = 'newest';
    this.albumSortBy = 'newest';
    this.artistSortBy = 'name';
    this.search();
  }

  playSong(song: Song): void {
    this.audioPlayerService.playSong(song);
  }

  playAlbum(album: Album): void {
    if (album.songIds && album.songIds.length > 0) {
      this.apiService.getSong(album.songIds[0]).subscribe({
        next: (song) => {
          this.audioPlayerService.playSong(song);
        }
      });
    }
  }

  viewAlbumSongs(album: Album): void {
    // Filter songs by album
    this.activeTab = 0;
    this.searchQuery = album.title;
    this.filterSongs();
  }

  viewArtistSongs(artist: Artist): void {
    // Filter songs by artist
    this.activeTab = 0;
    this.searchQuery = artist.name;
    this.filterSongs();
  }

  subscribeToArtist(artist: Artist): void {
    this.apiService.subscribeToArtist(artist.artistId).subscribe({
      next: () => {
        this.subscribedArtists.update(subscribed => [...subscribed, artist.artistId]);
        this.snackBar.open(`Subscribed to ${artist.name}`, 'Close', { duration: 3000 });
      },
      error: () => {
        this.snackBar.open('Failed to subscribe to artist', 'Close', { duration: 3000 });
      }
    });
  }

  toggleFavorite(song: Song): void {
    // This would be implemented with a favorites service
    const favorites = this.favoriteSongs();
    if (favorites.includes(song.songId)) {
      this.favoriteSongs.set(favorites.filter(id => id !== song.songId));
    } else {
      this.favoriteSongs.set([...favorites, song.songId]);
    }
  }

  shareSong(song: Song): void {
    if (navigator.share) {
      navigator.share({
        title: song.title,
        text: `Check out "${song.title}" on Music Stream`,
        url: window.location.href
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      this.snackBar.open('Link copied to clipboard', 'Close', { duration: 2000 });
    }
  }

  isSubscribed(artist: Artist): boolean {
    return this.subscribedArtists().includes(artist.artistId);
  }

  isFavorite(song: Song): boolean {
    return this.favoriteSongs().includes(song.songId);
  }

  getArtistNames(artistIds: string[]): string {
    const artistNames = artistIds.map(id => {
      const artist = this.artists().find(a => a.artistId === id);
      return artist ? artist.name : 'Unknown Artist';
    });
    return artistNames.join(', ');
  }

  formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}