import { Component, ChangeDetectionStrategy, input, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MusicContent } from '../../models/music-content.interface';

@Component({
  selector: 'app-music-card',
  imports: [CommonModule],
  templateUrl: './music-card.component.html',
  styleUrl: './music-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MusicCardComponent {
  readonly content = input.required<MusicContent>();
  readonly onPlay = output<MusicContent>();

  protected readonly isPlaying = signal(false);
  protected readonly coverImageUrl = computed(() => {
    const content = this.content();
    return content.coverImage ? URL.createObjectURL(content.coverImage) : null;
  });

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

  protected formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }
}