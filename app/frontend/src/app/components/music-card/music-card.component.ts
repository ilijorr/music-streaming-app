import { Component, ChangeDetectionStrategy, input, output, signal, computed, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SongData, SongService } from '../../services/song.service';
import { ArtistService } from '../../services/artist.service';
import { AlbumService } from '../../services/album.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-music-card',
  imports: [CommonModule],
  templateUrl: './music-card.component.html',
  styleUrl: './music-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MusicCardComponent {
  private readonly songService = inject(SongService);
  private readonly artistService = inject(ArtistService);
  private readonly albumService = inject(AlbumService);
  private readonly authService = inject(AuthService);

  readonly content = input.required<SongData>();
  readonly onPlay = output<SongData>();
  readonly onEdit = output<SongData>();
  readonly onDelete = output<SongData>();

  protected readonly isAdmin = computed(() => this.authService.isAdmin());

  protected readonly isPlaying = signal(false);
  protected readonly coverImageUrl = signal<string | null>(null);

  protected readonly artistNames = computed(() => {
    return this.content().artistIds
      .map(id => this.artistService.getCachedArtistName(id))
      .join(', ');
  });

  protected readonly albumName = computed(() => {
    const albumId = this.content().albumId;
    return albumId ? this.albumService.getCachedAlbumName(albumId) : null;
  });

  constructor() {
    effect(() => {
      const song = this.content();
      if (song.coverUrl && song.coverUrl.startsWith('s3://')) {
        // Load presigned URL for S3 cover
        this.songService.getCoverImageUrl(song.songId).subscribe({
          next: (response) => {
            this.coverImageUrl.set(response.downloadUrl);
          },
          error: (error) => {
            console.error('Error loading song cover image:', error);
            this.coverImageUrl.set(null);
          }
        });
      } else {
        this.coverImageUrl.set(song.coverUrl || null);
      }
    });
  }

  protected readonly fileSizeInMB = computed(() => {
    return (this.content().fileSize / 1024 / 1024).toFixed(2);
  });

  protected readonly durationFormatted = computed(() => {
    const duration = this.content().duration;
    if (!duration) return 'Unknown';

    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  });

  protected playTrack(): void {
    this.onPlay.emit(this.content());
  }

  protected editSong(): void {
    this.onEdit.emit(this.content());
  }

  protected deleteSong(): void {
    if (confirm(`Are you sure you want to delete "${this.content().title}"?`)) {
      this.onDelete.emit(this.content());
    }
  }

  protected formatDate(date: string | Date): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(dateObj);
  }
}