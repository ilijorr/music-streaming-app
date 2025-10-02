import { Component, ChangeDetectionStrategy, input, output, signal, computed, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SongData, SongService } from '../../services/song.service';
import { ArtistService } from '../../services/artist.service';
import { AlbumService } from '../../services/album.service';

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

  readonly content = input.required<SongData>();
  readonly onPlay = output<SongData>();

  protected readonly isPlaying = signal(false);
  protected readonly coverImageUrl = signal<string | null>(null);

  protected readonly artistNames = computed(() => {
    return this.content().artistIds
      .map(id => this.artistService.getCachedArtistName(id))
      .join(', ');
  });

  protected readonly albumName = computed(() => {
    const albumId = this.content().albumId;
    if (!albumId) return null;

    const name = this.albumService.getCachedAlbumName(albumId);
    // If the name is same as ID (UUID format), it means album is not cached yet
    return name === albumId ? null : name;
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