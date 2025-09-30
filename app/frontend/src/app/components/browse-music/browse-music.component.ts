import { Component, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MusicCardComponent } from '../music-card/music-card.component';
import { MusicContent } from '../../models/music-content.interface';

@Component({
  selector: 'app-browse-music',
  imports: [CommonModule, ReactiveFormsModule, MusicCardComponent],
  templateUrl: './browse-music.component.html',
  styleUrl: './browse-music.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BrowseMusicComponent {
  private readonly fb = inject(FormBuilder);

  // Mock data - in real app this would come from a service
  private readonly mockMusicContent = signal<MusicContent[]>([
    {
      fileName: 'song1.mp3',
      fileType: 'audio/mpeg',
      fileSize: 3584000, // ~3.4 MB
      createdAt: new Date('2024-01-15'),
      lastModified: new Date('2024-01-15'),
      title: 'Midnight Dreams',
      genres: ['Jazz', 'Ambient'],
      duration: 245, // 4:05
      artistIds: ['John Doe', 'Jane Smith'],
      audioFile: new File([''], 'song1.mp3', { type: 'audio/mpeg' })
    },
    {
      fileName: 'rock_anthem.wav',
      fileType: 'audio/wav',
      fileSize: 45678000, // ~43.5 MB
      createdAt: new Date('2024-02-10'),
      lastModified: new Date('2024-02-12'),
      title: 'Electric Thunder',
      genres: ['Rock', 'Alternative'],
      duration: 312, // 5:12
      artistIds: ['Rock Band'],
      albumId: 'album-123',
      audioFile: new File([''], 'rock_anthem.wav', { type: 'audio/wav' })
    },
    {
      fileName: 'classical_piece.flac',
      fileType: 'audio/flac',
      fileSize: 28945000, // ~27.6 MB
      createdAt: new Date('2024-03-05'),
      lastModified: new Date('2024-03-05'),
      title: 'Symphony No. 1',
      genres: ['Classical', 'Orchestral'],
      duration: 1825, // 30:25
      artistIds: ['Orchestra Ensemble'],
      audioFile: new File([''], 'classical_piece.flac', { type: 'audio/flac' })
    }
  ]);

  protected readonly currentlyPlaying = signal<MusicContent | null>(null);
  protected readonly audioElement = signal<HTMLAudioElement | null>(null);

  protected readonly filterForm: FormGroup = this.fb.group({
    searchTerm: [''],
    selectedGenre: [''],
    selectedArtist: [''],
    fileType: ['']
  });

  protected readonly allGenres = computed(() => {
    const genres = new Set<string>();
    this.mockMusicContent().forEach(content => {
      content.genres.forEach(genre => genres.add(genre));
    });
    return Array.from(genres).sort();
  });

  protected readonly allArtists = computed(() => {
    const artists = new Set<string>();
    this.mockMusicContent().forEach(content => {
      content.artistIds.forEach(artist => artists.add(artist));
    });
    return Array.from(artists).sort();
  });

  protected readonly fileTypes = computed(() => {
    const types = new Set<string>();
    this.mockMusicContent().forEach(content => {
      types.add(content.fileType);
    });
    return Array.from(types).sort();
  });

  protected readonly filteredContent = computed(() => {
    const content = this.mockMusicContent();
    const filters = this.filterForm.value;

    return content.filter(item => {
      // Search term filter
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(searchLower);
        const matchesArtist = item.artistIds.some(artist =>
          artist.toLowerCase().includes(searchLower)
        );
        const matchesFileName = item.fileName.toLowerCase().includes(searchLower);

        if (!matchesTitle && !matchesArtist && !matchesFileName) {
          return false;
        }
      }

      // Genre filter
      if (filters.selectedGenre && !item.genres.includes(filters.selectedGenre)) {
        return false;
      }

      // Artist filter
      if (filters.selectedArtist && !item.artistIds.includes(filters.selectedArtist)) {
        return false;
      }

      // File type filter
      if (filters.fileType && item.fileType !== filters.fileType) {
        return false;
      }

      return true;
    });
  });

  protected readonly totalResults = computed(() => this.filteredContent().length);

  protected onPlayTrack(content: MusicContent): void {
    // Stop current audio if playing
    const currentAudio = this.audioElement();
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }

    // Create new audio element
    const audioUrl = URL.createObjectURL(content.audioFile);
    const audio = new Audio(audioUrl);

    audio.addEventListener('loadedmetadata', () => {
      console.log(`Playing: ${content.title} - Duration: ${audio.duration}s`);
    });

    audio.addEventListener('ended', () => {
      this.currentlyPlaying.set(null);
      this.audioElement.set(null);
    });

    audio.addEventListener('error', (e) => {
      console.error('Audio playback error:', e);
      this.currentlyPlaying.set(null);
      this.audioElement.set(null);
    });

    this.audioElement.set(audio);
    this.currentlyPlaying.set(content);

    audio.play().catch(err => {
      console.error('Failed to play audio:', err);
      this.currentlyPlaying.set(null);
      this.audioElement.set(null);
    });
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
}