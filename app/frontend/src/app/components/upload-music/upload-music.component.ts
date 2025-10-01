import { Component, ChangeDetectionStrategy, signal, computed, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { MusicContent } from '../../models/music-content.interface';
import { Album } from '../../models/album.interface';
import { ArtistResponse } from '../../models/artist.interface';
import { SongService, CreateSongRequest } from '../../services/song.service';
import { ArtistService } from '../../services/artist.service';
import { getAllGenres } from '../../models/genre.enum';

@Component({
  selector: 'app-upload-music',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './upload-music.component.html',
  styleUrl: './upload-music.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UploadMusicComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly songService = inject(SongService);
  private readonly artistService = inject(ArtistService);
  private readonly router = inject(Router);

  protected readonly uploadType = signal<'single' | 'album'>('single');
  protected readonly selectedAudioFile = signal<File | null>(null);
  protected readonly selectedCoverImage = signal<File | null>(null);
  protected readonly loading = signal<boolean>(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<boolean>(false);

  protected readonly coverImagePreview = computed(() => {
    const image = this.selectedCoverImage();
    return image ? URL.createObjectURL(image) : null;
  });

  protected readonly availableArtists = signal<ArtistResponse[]>([]);
  protected readonly availableGenres = getAllGenres();

  // Single song form
  protected readonly singleForm: FormGroup = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(1)]],
    genres: this.fb.array([this.fb.control('', Validators.required)]),
    selectedArtists: [[], Validators.required],
    featuringArtists: [[]]
  });

  // Album form
  protected readonly albumForm: FormGroup = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(1)]],
    artistIds: [[], Validators.required],
    releaseDate: ['', Validators.required],
    genres: this.fb.array([this.fb.control('', Validators.required)]),
    songs: this.fb.array([])
  });

  ngOnInit(): void {
    this.loadArtists();
  }

  protected get currentForm(): FormGroup {
    return this.uploadType() === 'single' ? this.singleForm : this.albumForm;
  }

  protected get genres(): FormArray {
    return this.currentForm.get('genres') as FormArray;
  }

  protected get albumSongs(): FormArray {
    return this.albumForm.get('songs') as FormArray;
  }

  protected setUploadType(type: 'single' | 'album'): void {
    this.uploadType.set(type);
    this.error.set(null);

    // Reset forms when switching
    this.singleForm.reset();
    this.albumForm.reset();
    this.selectedAudioFile.set(null);
    this.selectedCoverImage.set(null);

    // Reset genres arrays
    this.resetGenresArray(this.singleForm);
    this.resetGenresArray(this.albumForm);

    // Reset album songs array
    this.albumSongs.clear();
  }

  private resetGenresArray(form: FormGroup): void {
    const genresArray = form.get('genres') as FormArray;
    genresArray.clear();
    genresArray.push(this.fb.control('', Validators.required));
  }

  private loadArtists(): void {
    this.artistService.listArtists().subscribe({
      next: (response) => {
        this.availableArtists.set(response.artists);
      },
      error: (error) => {
        console.error('Error loading artists:', error);
        this.error.set('Failed to load artists. Please refresh the page.');
      }
    });
  }

  protected onAudioFileSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (file) {
      // Validate file type
      if (!file.type.startsWith('audio/')) {
        this.error.set('Please select a valid audio file');
        return;
      }

      // Validate file size (max 50MB)
      const maxSizeInBytes = 50 * 1024 * 1024; // 50MB
      if (file.size > maxSizeInBytes) {
        this.error.set('Audio file size must be less than 50MB');
        return;
      }

      this.selectedAudioFile.set(file);
      this.error.set(null);
    }
  }

  protected onCoverImageSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        this.error.set('Please select a valid image file');
        return;
      }

      // Validate file size (max 5MB)
      const maxSizeInBytes = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSizeInBytes) {
        this.error.set('Image size must be less than 5MB');
        return;
      }

      this.selectedCoverImage.set(file);
      this.error.set(null);
    }
  }

  protected addGenre(): void {
    this.genres.push(this.fb.control('', Validators.required));
  }

  protected removeGenre(index: number): void {
    if (this.genres.length > 1) {
      this.genres.removeAt(index);
    }
  }

  protected async onSubmit(): Promise<void> {
    if (this.uploadType() === 'single') {
      await this.submitSingle();
    } else {
      await this.submitAlbum();
    }
  }

  private async submitSingle(): Promise<void> {
    if (!this.singleForm.valid || !this.selectedAudioFile()) {
      this.error.set('Please fill in all required fields and select an audio file');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.success.set(false);

    try {
      const formValue = this.singleForm.value;
      const audioFile = this.selectedAudioFile()!;
      const coverImage = this.selectedCoverImage();

      // Convert audio file to base64
      const audioFileBase64 = await this.songService.fileToBase64(audioFile);

      // Convert cover image to base64 if present
      let coverImageBase64: string | undefined;
      if (coverImage) {
        coverImageBase64 = await this.songService.fileToBase64(coverImage);
      }

      // Get audio duration
      let duration: number | undefined;
      try {
        duration = await this.songService.getAudioDuration(audioFile);
      } catch (error) {
        console.warn('Could not extract audio duration:', error);
      }

      // Prepare request payload for single song (NO albumId)
      const request: CreateSongRequest = {
        audioFileBase64,
        title: formValue.title.trim(),
        artistIds: formValue.selectedArtists,
        genres: formValue.genres
          .map((genre: string) => genre.trim())
          .filter((genre: string) => genre.length > 0),
        filename: audioFile.name,
        coverImageBase64,
        duration
      };

      // Add optional featuring artists if provided
      if (formValue.featuringArtists && formValue.featuringArtists.length > 0) {
        request.featuringArtists = formValue.featuringArtists;
      }

      // Call API
      this.songService.createSong(request).subscribe({
        next: (response) => {
          console.log('Single song uploaded successfully:', response);
          this.handleUploadSuccess();
        },
        error: (err) => {
          this.handleUploadError(err);
        }
      });
    } catch (err) {
      console.error('Error processing single song files:', err);
      this.loading.set(false);
      this.error.set('Failed to process files. Please try again.');
    }
  }

  private async submitAlbum(): Promise<void> {
    // TODO: Implement album upload logic
    this.error.set('Album upload not yet implemented');
  }

  private handleUploadSuccess(): void {
    this.success.set(true);
    this.loading.set(false);

    // Reset forms
    this.singleForm.reset();
    this.albumForm.reset();
    this.selectedAudioFile.set(null);
    this.selectedCoverImage.set(null);

    // Reset genres arrays
    this.resetGenresArray(this.singleForm);
    this.resetGenresArray(this.albumForm);

    // Redirect to browse music after 2 seconds
    setTimeout(() => {
      this.router.navigate(['/music/browse']);
    }, 2000);
  }

  private handleUploadError(err: any): void {
    console.error('Error uploading:', err);
    this.loading.set(false);

    // Handle different error status codes
    if (err.status === 401) {
      this.error.set('You are not authenticated. Please log in.');
    } else if (err.status === 403) {
      this.error.set('Access denied. Only administrators can upload music.');
    } else if (err.status === 400) {
      this.error.set('Invalid input. Please check your data and try again.');
    } else {
      this.error.set('An error occurred while uploading. Please try again.');
    }
  }
}