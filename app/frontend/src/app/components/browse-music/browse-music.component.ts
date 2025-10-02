import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, Subject, takeUntil } from 'rxjs';
import { MusicCardComponent } from '../music-card/music-card.component';
import { AlbumCardComponent } from '../album-card/album-card.component';
import { MusicContent } from '../../models/music-content.interface';
import { AuthService } from '../../services/auth.service';
import { SongService, SongData } from '../../services/song.service';
import { AlbumService, AlbumResponse } from '../../services/album.service';
import { ArtistService } from '../../services/artist.service';

@Component({
  selector: 'app-browse-music',
  imports: [CommonModule, ReactiveFormsModule, MusicCardComponent, AlbumCardComponent],
  templateUrl: './browse-music.component.html',
  styleUrl: './browse-music.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BrowseMusicComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly songService = inject(SongService);
  private readonly albumService = inject(AlbumService);
  private readonly artistService = inject(ArtistService);
  private readonly router = inject(Router);

  protected readonly songs = signal<SongData[]>([]);
  protected readonly albums = signal<AlbumResponse[]>([]);
  protected readonly loading = signal<boolean>(false);
  protected readonly error = signal<string | null>(null);
  protected readonly viewMode = signal<'songs' | 'albums' | 'artists'>('songs');
  protected readonly selectedAlbum = signal<AlbumResponse | null>(null);
  protected readonly albumSongs = signal<SongData[]>([]);
  protected readonly selectedArtistDetail = signal<{ id: string; name: string; genres: string[] } | null>(null);
  protected readonly artistSongs = signal<SongData[]>([]);
  protected readonly artistAlbums = signal<AlbumResponse[]>([]);

  protected readonly currentlyPlaying = signal<SongData | null>(null);
  protected readonly audioElement = signal<HTMLAudioElement | null>(null);

  // Reactive filter values as signals
  protected readonly searchTerm = signal<string>('');
  protected readonly selectedGenre = signal<string>('');
  protected readonly selectedArtistFilter = signal<string>('');
  protected readonly selectedAlbumFilter = signal<string>('');
  protected readonly fileType = signal<string>('');

  protected readonly filterForm: FormGroup = this.fb.group({
    searchTerm: [''],
    selectedGenre: [''],
    selectedArtist: [''],
    selectedAlbum: [''],
    fileType: ['']
  });

  ngOnInit(): void {
    // Load artists first to populate cache
    this.artistService.listArtists().subscribe({
      next: () => {
        console.log('Artists loaded and cached');
      },
      error: (error) => {
        console.error('Error loading artists:', error);
      }
    });

    this.loadSongs();
    this.loadAlbums();
    this.setupFilterSubscriptions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Setup reactive subscriptions to form changes
   * This makes filters work in real-time with performance optimizations
   */
  private setupFilterSubscriptions(): void {
    // Search term with debouncing for performance
    this.filterForm.get('searchTerm')?.valueChanges
      .pipe(
        debounceTime(300), // Wait 300ms after user stops typing
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(value => {
        this.searchTerm.set(value || '');
      });

    // Genre filter - immediate update
    this.filterForm.get('selectedGenre')?.valueChanges
      .pipe(
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(value => {
        this.selectedGenre.set(value || '');
        // Clear artist and album when genre changes for cascading effect
        if (value) {
          this.filterForm.patchValue({ selectedArtist: '', selectedAlbum: '' }, { emitEvent: false });
          this.selectedArtistFilter.set('');
          this.selectedAlbumFilter.set('');
        }
      });

    // Artist filter - immediate update
    this.filterForm.get('selectedArtist')?.valueChanges
      .pipe(
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(value => {
        this.selectedArtistFilter.set(value || '');
        // Clear album when artist changes for cascading effect
        if (value) {
          this.filterForm.patchValue({ selectedAlbum: '' }, { emitEvent: false });
          this.selectedAlbumFilter.set('');
        }
      });

    // Album filter - immediate update
    this.filterForm.get('selectedAlbum')?.valueChanges
      .pipe(
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(value => {
        this.selectedAlbumFilter.set(value || '');
      });

    // File type filter - immediate update
    this.filterForm.get('fileType')?.valueChanges
      .pipe(
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(value => {
        this.fileType.set(value || '');
      });
  }

  /**
   * Get artist names for display
   */
  protected getArtistNames(artistIds: string[]): string {
    return artistIds
      .map(id => this.artistService.getCachedArtistName(id))
      .join(', ');
  }

  private loadSongs(): void {
    this.loading.set(true);
    this.songService.listSongs().subscribe({
      next: (response) => {
        this.songs.set(response.songs);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading songs:', error);
        this.error.set('Failed to load songs');
        this.loading.set(false);
      }
    });
  }

  private loadAlbums(): void {
    this.albumService.listAlbums().subscribe({
      next: (response) => {
        this.albums.set(response.albums);
      },
      error: (error) => {
        console.error('Error loading albums:', error);
      }
    });
  }

  protected readonly allGenres = computed(() => {
    const genres = new Set<string>();
    this.songs().forEach(song => {
      song.genres.forEach(genre => genres.add(genre));
    });
    return Array.from(genres).sort();
  });

  protected readonly allArtists = computed(() => {
    const artistIds = new Set<string>();
    this.songs().forEach(song => {
      song.artistIds.forEach(artistId => artistIds.add(artistId));
    });

    // Convert to array of objects with id and name
    return Array.from(artistIds)
      .map(id => ({
        id,
        name: this.artistService.getCachedArtistName(id)
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  protected readonly fileTypes = computed(() => {
    const types = new Set<string>();
    this.songs().forEach(song => {
      types.add(song.fileType);
    });
    return Array.from(types).sort();
  });

  protected readonly filteredContent = computed(() => {
    const content = this.songs();
    const search = this.searchTerm();
    const genre = this.selectedGenre();
    const artist = this.selectedArtistFilter();
    const album = this.selectedAlbumFilter();
    const type = this.fileType();

    return content.filter(song => {
      // Search term filter
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesTitle = song.title.toLowerCase().includes(searchLower);
        const matchesFileName = song.fileName.toLowerCase().includes(searchLower);

        if (!matchesTitle && !matchesFileName) {
          return false;
        }
      }

      // Genre filter
      if (genre && !song.genres.includes(genre)) {
        return false;
      }

      // Artist filter
      if (artist && !song.artistIds.includes(artist)) {
        return false;
      }

      // Album filter
      if (album && song.albumId !== album) {
        return false;
      }

      // File type filter
      if (type && song.fileType !== type) {
        return false;
      }

      return true;
    });
  });

  protected readonly totalResults = computed(() => this.filteredContent().length);

  protected readonly filteredAlbums = computed(() => {
    const albumList = this.albums();
    const search = this.searchTerm();
    const genre = this.selectedGenre();
    const artist = this.selectedArtistFilter();

    return albumList.filter(album => {
      // Search term filter
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesTitle = album.title.toLowerCase().includes(searchLower);

        if (!matchesTitle) {
          return false;
        }
      }

      // Genre filter
      if (genre && !album.genres.includes(genre)) {
        return false;
      }

      // Artist filter
      if (artist && !album.artistIds.includes(artist)) {
        return false;
      }

      return true;
    });
  });

  protected readonly totalAlbums = computed(() => this.filteredAlbums().length);

  protected readonly currentUser = this.authService.currentUser;
  protected readonly isAdmin = computed(() => this.authService.isAdmin());

  /**
   * Filter artists by selected genre (cascading filter)
   */
  protected readonly filteredArtistsByGenre = computed(() => {
    const genre = this.selectedGenre();
    const artists = this.allArtists();

    if (!genre) {
      return artists;
    }

    // Filter artists that have songs in the selected genre
    const artistIds = new Set<string>();
    this.songs().forEach(song => {
      if (song.genres.includes(genre)) {
        song.artistIds.forEach(artistId => artistIds.add(artistId));
      }
    });

    return artists.filter(artist => artistIds.has(artist.id));
  });

  /**
   * Filter albums for dropdown (cascading filters by genre and artist)
   */
  protected readonly filteredAlbumsForDropdown = computed(() => {
    const genre = this.selectedGenre();
    const artist = this.selectedArtistFilter();
    const albumList = this.albums();

    return albumList.filter(album => {
      // Genre filter
      if (genre && !album.genres.includes(genre)) {
        return false;
      }

      // Artist filter
      if (artist && !album.artistIds.includes(artist)) {
        return false;
      }

      return true;
    });
  });

  /**
   * Get all artists with additional metadata for artist view
   */
  protected readonly filteredArtists = computed(() => {
    const search = this.searchTerm();
    const genre = this.selectedGenre();
    const artists = this.allArtists();
    const songs = this.songs();
    const albums = this.albums();

    return artists
      .filter(artist => {
        // Search filter
        if (search) {
          const searchLower = search.toLowerCase();
          if (!artist.name.toLowerCase().includes(searchLower)) {
            return false;
          }
        }

        // Genre filter - check if artist has any song in selected genre
        if (genre) {
          const hasGenre = songs.some(song =>
            song.artistIds.includes(artist.id) && song.genres.includes(genre)
          );
          if (!hasGenre) {
            return false;
          }
        }

        return true;
      })
      .map(artist => {
        const artistSongs = songs.filter(song => song.artistIds.includes(artist.id));
        const artistAlbums = albums.filter(album => album.artistIds.includes(artist.id));
        const genres = new Set<string>();
        artistSongs.forEach(song => song.genres.forEach(genre => genres.add(genre)));

        return {
          id: artist.id,
          name: artist.name,
          genres: Array.from(genres),
          songCount: artistSongs.length,
          albumCount: artistAlbums.length
        };
      });
  });

  protected setViewMode(mode: 'songs' | 'albums' | 'artists'): void {
    this.viewMode.set(mode);
    // Clear any selected detail views when switching modes
    if (mode !== 'albums') {
      this.closeAlbumView();
    }
    if (mode !== 'artists') {
      this.closeArtistView();
    }
  }

  protected async onPlayTrack(song: SongData): Promise<void> {
    // Stop current audio if playing
    const currentAudio = this.audioElement();
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      // Get presigned download URL from backend
      const urlResponse = await this.songService.getDownloadUrl(song.songId).toPromise();

      if (!urlResponse) {
        throw new Error('Failed to get download URL');
      }

      // Create new audio element with presigned URL
      const audio = new Audio(urlResponse.downloadUrl);

      audio.addEventListener('loadedmetadata', () => {
        console.log(`Playing: ${song.title} - Duration: ${audio.duration}s`);
        this.loading.set(false);
      });

      audio.addEventListener('ended', () => {
        this.currentlyPlaying.set(null);
        this.audioElement.set(null);
      });

      audio.addEventListener('error', (e) => {
        console.error('Audio playback error:', e);
        this.error.set('Failed to play audio');
        this.currentlyPlaying.set(null);
        this.audioElement.set(null);
        this.loading.set(false);
      });

      this.audioElement.set(audio);
      this.currentlyPlaying.set(song);

      await audio.play();
    } catch (err) {
      console.error('Failed to play audio:', err);
      this.error.set('Failed to load audio file');
      this.currentlyPlaying.set(null);
      this.audioElement.set(null);
      this.loading.set(false);
    }
  }

  protected stopPlayback(): void {
    const audio = this.audioElement();
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    this.currentlyPlaying.set(null);
    this.audioElement.set(null);
  }

  protected clearFilters(): void {
    this.filterForm.reset();
    // Manually reset all signal values
    this.searchTerm.set('');
    this.selectedGenre.set('');
    this.selectedArtistFilter.set('');
    this.selectedAlbumFilter.set('');
    this.fileType.set('');
  }

  protected async logout(): Promise<void> {
    try {
      await this.authService.signOut();
      this.router.navigate(['/auth/login']);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  protected navigateToUpload(): void {
    this.router.navigate(['/music/upload']);
  }

  protected navigateToCreateArtist(): void {
    this.router.navigate(['/artists/create']);
  }

  protected onViewAlbum(album: AlbumResponse): void {
    this.selectedAlbum.set(album);
    this.loading.set(true);
    this.error.set(null);

    console.log('Loading songs for album:', album.albumId);

    this.albumService.getAlbumSongs(album.albumId).subscribe({
      next: (response) => {
        console.log('Album songs loaded:', response);
        this.albumSongs.set(response.songs);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading album songs:', error);
        console.error('Error status:', error.status);
        console.error('Error message:', error.message);
        this.error.set(`Failed to load album songs: ${error.status} ${error.statusText}`);
        this.loading.set(false);
      }
    });
  }

  protected closeAlbumView(): void {
    this.selectedAlbum.set(null);
    this.albumSongs.set([]);
  }

  protected onViewArtist(artist: { id: string; name: string; genres: string[] }): void {
    this.selectedArtistDetail.set(artist);
    this.loading.set(true);

    // Filter songs by artist
    const artistSongsFiltered = this.songs().filter(song => song.artistIds.includes(artist.id));
    this.artistSongs.set(artistSongsFiltered);

    // Filter albums by artist
    const artistAlbumsFiltered = this.albums().filter(album => album.artistIds.includes(artist.id));
    this.artistAlbums.set(artistAlbumsFiltered);

    this.loading.set(false);
  }

  protected closeArtistView(): void {
    this.selectedArtistDetail.set(null);
    this.artistSongs.set([]);
    this.artistAlbums.set([]);
  }

  protected onViewAlbumFromArtist(album: AlbumResponse): void {
    // When viewing album from artist page, just load the album songs
    this.onViewAlbum(album);
  }

  protected onEditSong(song: SongData): void {
    // Navigate to edit song page
    this.router.navigate(['/music/edit', song.songId]);
  }

  protected onDeleteSong(song: SongData): void {
    this.loading.set(true);
    this.error.set(null);

    this.songService.deleteSong(song.songId).subscribe({
      next: () => {
        console.log(`Song ${song.songId} deleted successfully`);
        // Remove from local list
        this.songs.set(this.songs().filter(s => s.songId !== song.songId));
        // Also remove from album songs if present
        this.albumSongs.set(this.albumSongs().filter(s => s.songId !== song.songId));
        // Also remove from artist songs if present
        this.artistSongs.set(this.artistSongs().filter(s => s.songId !== song.songId));
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error deleting song:', error);
        this.error.set(`Failed to delete song: ${error.message || 'Unknown error'}`);
        this.loading.set(false);
        alert(`Failed to delete song: ${error.message || 'Unknown error'}`);
      }
    });
  }

  protected onEditAlbum(album: AlbumResponse): void {
    // Navigate to edit album page
    this.router.navigate(['/albums/edit', album.albumId]);
  }

  protected onDeleteAlbum(album: AlbumResponse): void {
    this.loading.set(true);
    this.error.set(null);

    this.albumService.deleteAlbum(album.albumId).subscribe({
      next: (response) => {
        console.log(`Album ${album.albumId} deleted successfully`, response);

        // Remove from local albums list
        this.albums.set(this.albums().filter(a => a.albumId !== album.albumId));

        // Also remove from artist albums if present
        this.artistAlbums.set(this.artistAlbums().filter(a => a.albumId !== album.albumId));

        // Remove all songs that belonged to this album from the songs list
        // (Backend cascade deletes them, so we need to update our local state)
        this.songs.set(this.songs().filter(s => s.albumId !== album.albumId));
        this.albumSongs.set(this.albumSongs().filter(s => s.albumId !== album.albumId));
        this.artistSongs.set(this.artistSongs().filter(s => s.albumId !== album.albumId));

        // Clear selected album if it was the one deleted
        if (this.selectedAlbum()?.albumId === album.albumId) {
          this.closeAlbumView();
        }

        this.loading.set(false);

        // Show success message
        alert(`Album and all its songs deleted successfully`);
      },
      error: (error) => {
        console.error('Error deleting album:', error);
        this.error.set(`Failed to delete album: ${error.message || 'Unknown error'}`);
        this.loading.set(false);
        alert(`Failed to delete album: ${error.message || 'Unknown error'}`);
      }
    });
  }
}