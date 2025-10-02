import { Component, ChangeDetectionStrategy, input, output, computed, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlbumResponse, AlbumService } from '../../services/album.service';
import { ArtistService } from '../../services/artist.service';

@Component({
  selector: 'app-album-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './album-card.component.html',
  styleUrl: './album-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AlbumCardComponent {
  private readonly albumService = inject(AlbumService);
  private readonly artistService = inject(ArtistService);

  readonly album = input.required<AlbumResponse>();
  readonly onView = output<AlbumResponse>();

  protected readonly coverImageUrl = signal<string | null>(null);

  protected readonly artistNames = computed(() => {
    return this.album().artistIds
      .map(id => this.artistService.getCachedArtistName(id))
      .join(', ');
  });

  constructor() {
    effect(() => {
      const album = this.album();
      if (album.coverUrl && album.coverUrl.startsWith('s3://')) {
        // Load presigned URL for S3 cover
        this.albumService.getCoverImageUrl(album.albumId).subscribe({
          next: (response) => {
            this.coverImageUrl.set(response.downloadUrl);
          },
          error: (error) => {
            console.error('Error loading cover image:', error);
            this.coverImageUrl.set(null);
          }
        });
      } else {
        this.coverImageUrl.set(album.coverUrl || null);
      }
    });
  }

  protected readonly formattedReleaseDate = computed(() => {
    const album = this.album();
    return new Date(album.releaseDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  });

  protected viewAlbum(): void {
    this.onView.emit(this.album());
  }
}
