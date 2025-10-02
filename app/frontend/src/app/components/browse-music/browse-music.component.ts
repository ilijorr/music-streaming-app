import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
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
export class BrowseMusicComponent implements OnInit {
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
  protected readonly viewMode = signal<'songs' | 'albums'>('songs');
  protected readonly selectedAlbum = signal<AlbumResponse | null>(null);
  protected readonly albumSongs = signal<SongData[]>([]);

  protected readonly currentlyPlaying = signal<SongData | null>(null);
  protected readonly audioElement = signal<HTMLAudioElement | null>(null);

  protected readonly filterForm: FormGroup = this.fb.group({
    searchTerm: [''],
    selectedGenre: [''],
    selectedArtist: [''],
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
    const filters = this.filterForm.value;

    return content.filter(song => {
      // Search term filter
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const matchesTitle = song.title.toLowerCase().includes(searchLower);
        const matchesFileName = song.fileName.toLowerCase().includes(searchLower);

        if (!matchesTitle && !matchesFileName) {
          return false;
        }
      }

      // Genre filter
      if (filters.selectedGenre && !song.genres.includes(filters.selectedGenre)) {
        return false;
      }

      // Artist filter
      if (filters.selectedArtist && !song.artistIds.includes(filters.selectedArtist)) {
        return false;
      }

      // File type filter
      if (filters.fileType && song.fileType !== filters.fileType) {
        return false;
      }

      return true;
    });
  });

  protected readonly totalResults = computed(() => this.filteredContent().length);

  protected readonly filteredAlbums = computed(() => {
    const albumList = this.albums();
    const filters = this.filterForm.value;

    return albumList.filter(album => {
      // Search term filter
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const matchesTitle = album.title.toLowerCase().includes(searchLower);

        if (!matchesTitle) {
          return false;
        }
      }

      // Genre filter
      if (filters.selectedGenre && !album.genres.includes(filters.selectedGenre)) {
        return false;
      }

      // Artist filter
      if (filters.selectedArtist && !album.artistIds.includes(filters.selectedArtist)) {
        return false;
      }

      return true;
    });
  });

  protected readonly totalAlbums = computed(() => this.filteredAlbums().length);

  protected readonly currentUser = this.authService.currentUser;
  protected readonly isAdmin = computed(() => this.authService.isAdmin());

  protected setViewMode(mode: 'songs' | 'albums'): void {
    this.viewMode.set(mode);
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
}