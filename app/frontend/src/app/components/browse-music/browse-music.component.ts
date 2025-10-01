import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MusicCardComponent } from '../music-card/music-card.component';
import { MusicContent } from '../../models/music-content.interface';
import { AuthService } from '../../services/auth.service';
import { SongService, SongData } from '../../services/song.service';
import { AlbumService, AlbumResponse } from '../../services/album.service';

@Component({
  selector: 'app-browse-music',
  imports: [CommonModule, ReactiveFormsModule, MusicCardComponent],
  templateUrl: './browse-music.component.html',
  styleUrl: './browse-music.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BrowseMusicComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly songService = inject(SongService);
  private readonly albumService = inject(AlbumService);
  private readonly router = inject(Router);

  protected readonly songs = signal<SongData[]>([]);
  protected readonly albums = signal<AlbumResponse[]>([]);
  protected readonly loading = signal<boolean>(false);
  protected readonly error = signal<string | null>(null);

  protected readonly currentlyPlaying = signal<SongData | null>(null);
  protected readonly audioElement = signal<HTMLAudioElement | null>(null);

  protected readonly filterForm: FormGroup = this.fb.group({
    searchTerm: [''],
    selectedGenre: [''],
    selectedArtist: [''],
    fileType: ['']
  });

  ngOnInit(): void {
    this.loadSongs();
    this.loadAlbums();
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
    const artists = new Set<string>();
    this.songs().forEach(song => {
      song.artistIds.forEach(artistId => artists.add(artistId));
    });
    return Array.from(artists).sort();
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

  protected readonly currentUser = this.authService.currentUser;
  protected readonly isAdmin = computed(() => this.authService.isAdmin());

  protected async onPlayTrack(song: SongData): Promise<void> {
    // Stop current audio if playing
    const currentAudio = this.audioElement();
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }

    try {
      // Get presigned URL from S3
      const audioUrl = await this.getAudioUrl(song.fileUrl);

      // Create new audio element
      const audio = new Audio(audioUrl);

      audio.addEventListener('loadedmetadata', () => {
        console.log(`Playing: ${song.title} - Duration: ${audio.duration}s`);
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
      });

      this.audioElement.set(audio);
      this.currentlyPlaying.set(song);

      await audio.play();
    } catch (err) {
      console.error('Failed to play audio:', err);
      this.error.set('Failed to load audio file');
      this.currentlyPlaying.set(null);
      this.audioElement.set(null);
    }
  }

  private async getAudioUrl(s3Url: string): Promise<string> {
    // TODO: Implement presigned URL generation or use direct S3 URL
    // For now, return the S3 URL directly (requires proper CORS and permissions)
    // In production, you should generate a presigned URL from backend
    return s3Url.replace('s3://', 'https://');
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
}