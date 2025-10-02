import { Component, ChangeDetectionStrategy, signal, computed, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpEventType } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { MusicContent } from '../../models/music-content.interface';
import { Album } from '../../models/album.interface';
import { ArtistResponse } from '../../models/artist.interface';
import { SongService, CreateSongRequest } from '../../services/song.service';
import { S3UploadService, S3UploadProgress, S3UploadResult } from '../../services/s3-upload.service';
import { ArtistService } from '../../services/artist.service';
import { AlbumService, AlbumResponse } from '../../services/album.service';
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
  private readonly s3UploadService = inject(S3UploadService);
  private readonly artistService = inject(ArtistService);
  private readonly albumService = inject(AlbumService);
  private readonly router = inject(Router);

  protected readonly uploadType = signal<'single' | 'album'>('single');
  protected readonly selectedAudioFile = signal<File | null>(null);
  protected readonly selectedCoverImage = signal<File | null>(null);
  protected readonly loading = signal<boolean>(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<boolean>(false);
  protected readonly uploadProgress = signal<number>(0);
  protected readonly uploadStatus = signal<string>('');

  protected readonly coverImagePreview = computed(() => {
    const image = this.selectedCoverImage();
    return image ? URL.createObjectURL(image) : null;
  });

  protected readonly availableArtists = signal<ArtistResponse[]>([]);
  protected readonly availableAlbums = signal<AlbumResponse[]>([]);
  protected readonly availableGenres = getAllGenres();

  // Single song form
  protected readonly singleForm: FormGroup = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(1)]],
    genres: this.fb.array([this.fb.control('', Validators.required)]),
    selectedArtists: [[], Validators.required],
    featuringArtists: [[]],
    albumId: [''] // Optional album to attach song to
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
    this.loadAlbums();
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

  private loadAlbums(): void {
    this.albumService.listAlbums().subscribe({
      next: (response) => {
        this.availableAlbums.set(response.albums);
      },
      error: (error) => {
        console.error('Error loading albums:', error);
      }
    });
  }

  protected onAudioFileSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (file) {
      // Use S3 upload service validation
      const validation = this.s3UploadService.validateFile(file, 'song');
      if (!validation.valid) {
        this.error.set(validation.error!);
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
      // Use S3 upload service validation
      const validation = this.s3UploadService.validateFile(file, 'cover');
      if (!validation.valid) {
        this.error.set(validation.error!);
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

  protected addSongToAlbum(): void {
    const songGroup = this.fb.group({
      title: ['', Validators.required],
      audioFile: [null, Validators.required],
      genres: this.fb.array([this.fb.control('', Validators.required)]),
      featuringArtists: [[]]
    });

    this.albumSongs.push(songGroup);
  }

  protected removeSongFromAlbum(index: number): void {
    this.albumSongs.removeAt(index);
  }

  protected onAlbumSongFileSelected(event: Event, songIndex: number): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (file) {
      // Use S3 upload service validation
      const validation = this.s3UploadService.validateFile(file, 'song');
      if (!validation.valid) {
        this.error.set(validation.error!);
        return;
      }

      const songControl = this.albumSongs.at(songIndex);
      songControl.patchValue({ audioFile: file });
      this.error.set(null);
    }
  }

  protected getSongGenres(songIndex: number): FormArray {
    return this.albumSongs.at(songIndex).get('genres') as FormArray;
  }

  protected addGenreToSong(songIndex: number): void {
    const genresArray = this.getSongGenres(songIndex);
    genresArray.push(this.fb.control('', Validators.required));
  }

  protected removeGenreFromSong(songIndex: number, genreIndex: number): void {
    const genresArray = this.getSongGenres(songIndex);
    if (genresArray.length > 1) {
      genresArray.removeAt(genreIndex);
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
    this.uploadProgress.set(0);
    this.uploadStatus.set('Preparing upload...');

    try {
      const formValue = this.singleForm.value;
      const audioFile = this.selectedAudioFile()!;
      const coverImage = this.selectedCoverImage();

      // Step 1: Upload audio file to S3
      this.uploadStatus.set('Uploading audio file...');
      const audioUploadResult = await this.uploadFileToS3(audioFile, 'song');

      // Step 2: Upload cover image to S3 if present
      let coverUploadResult: S3UploadResult | undefined;
      if (coverImage) {
        this.uploadStatus.set('Uploading cover image...');
        coverUploadResult = await this.uploadFileToS3(coverImage, 'cover');
      }

      // Step 3: Get audio duration
      this.uploadStatus.set('Processing metadata...');
      let duration: number | undefined;
      try {
        duration = await this.songService.getAudioDuration(audioFile);
      } catch (error) {
        console.warn('Could not extract audio duration:', error);
      }

      // Step 4: Create song metadata in backend
      this.uploadStatus.set('Saving song metadata...');
      const request: CreateSongRequest = {
        audioFileKey: audioUploadResult.key,
        title: formValue.title.trim(),
        artistIds: formValue.selectedArtists,
        genres: formValue.genres
          .map((genre: string) => genre.trim())
          .filter((genre: string) => genre.length > 0),
        filename: audioFile.name,
        coverImageKey: coverUploadResult?.key,
        duration
      };

      // Add optional featuring artists if provided
      if (formValue.featuringArtists && formValue.featuringArtists.length > 0) {
        request.featuringArtists = formValue.featuringArtists;
      }

      // Add optional album ID if provided
      if (formValue.albumId && formValue.albumId.trim().length > 0) {
        request.albumId = formValue.albumId;
      }

      // Call API
      this.songService.createSong(request).subscribe({
        next: (response) => {
          console.log('Single song uploaded successfully:', response);
          this.uploadStatus.set('Upload completed!');
          this.handleUploadSuccess();
        },
        error: (err) => {
          this.handleUploadError(err);
        }
      });
    } catch (err) {
      console.error('Error uploading single song:', err);
      this.loading.set(false);
      this.uploadStatus.set('');
      this.error.set('Failed to upload files. Please try again.');
    }
  }

  private async uploadFileToS3(file: File, uploadType: 'song' | 'cover'): Promise<S3UploadResult> {
    return new Promise((resolve, reject) => {
      this.s3UploadService.uploadFile(file, uploadType, (progress: S3UploadProgress) => {
        this.uploadProgress.set(progress.progress);
      }).subscribe({
        next: (result) => {
          resolve(result);
        },
        error: (error) => {
          reject(error);
        }
      });
    });
  }

  private async submitAlbum(): Promise<void> {
    if (!this.albumForm.valid || this.albumSongs.length === 0) {
      this.error.set('Please fill in all required fields and add at least one song');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.success.set(false);
    this.uploadProgress.set(0);
    this.uploadStatus.set('Preparing album upload...');

    try {
      const formValue = this.albumForm.value;
      const coverImage = this.selectedCoverImage();

      // Step 1: Convert cover image to base64 if present
      let coverImageBase64: string | undefined;
      if (coverImage) {
        this.uploadStatus.set('Processing album cover...');
        coverImageBase64 = await this.albumService.fileToBase64(coverImage);
      }

      // Step 2: Create the album
      this.uploadStatus.set('Creating album...');
      const albumRequest = {
        title: formValue.title.trim(),
        artistIds: formValue.artistIds,
        releaseDate: formValue.releaseDate,
        genres: formValue.genres
          .map((genre: string) => genre.trim())
          .filter((genre: string) => genre.length > 0),
        coverImageBase64
      };

      this.albumService.createAlbum(albumRequest).subscribe({
        next: async (albumResponse) => {
          console.log('Album created successfully:', albumResponse);
          const albumId = albumResponse.album.albumId;

          // Step 3: Upload each song with the albumId
          const totalSongs = this.albumSongs.length;

          for (let i = 0; i < totalSongs; i++) {
            const songData = this.albumSongs.at(i).value;
            const songFile = songData.audioFile as File;

            this.uploadStatus.set(`Uploading song ${i + 1} of ${totalSongs}: ${songData.title}...`);

            try {
              // Upload audio file to S3
              const audioUploadResult = await this.uploadFileToS3(songFile, 'song');

              // Get duration
              let duration: number | undefined;
              try {
                duration = await this.songService.getAudioDuration(songFile);
              } catch (error) {
                console.warn(`Could not extract audio duration for ${songFile.name}:`, error);
              }

              // Prepare song request
              const songRequest: CreateSongRequest = {
                audioFileKey: audioUploadResult.key,
                title: songData.title.trim(),
                artistIds: formValue.artistIds,
                genres: songData.genres
                  .map((genre: string) => genre.trim())
                  .filter((genre: string) => genre.length > 0),
                filename: songFile.name,
                duration,
                albumId: albumId
              };

              // Add featuring artists if provided
              if (songData.featuringArtists && songData.featuringArtists.length > 0) {
                songRequest.featuringArtists = songData.featuringArtists;
              }

              // Create song metadata
              await new Promise<void>((resolve, reject) => {
                this.songService.createSong(songRequest).subscribe({
                  next: () => {
                    console.log(`Song ${i + 1}/${totalSongs} uploaded successfully`);
                    resolve();
                  },
                  error: (err) => {
                    console.error(`Error uploading song ${songFile.name}:`, err);
                    reject(err);
                  }
                });
              });

              // Update progress
              const progress = Math.round(((i + 1) / totalSongs) * 100);
              this.uploadProgress.set(progress);

            } catch (err) {
              console.error(`Error uploading song ${songFile.name}:`, err);
              this.loading.set(false);
              this.uploadStatus.set('');
              this.error.set(`Failed to upload song: ${songData.title}. Please try again.`);
              return;
            }
          }

          console.log('All songs uploaded successfully');
          this.uploadStatus.set('Upload completed!');
          this.handleUploadSuccess();
        },
        error: (err) => {
          this.handleUploadError(err);
        }
      });
    } catch (err) {
      console.error('Error processing album:', err);
      this.loading.set(false);
      this.uploadStatus.set('');
      this.error.set('Failed to process album. Please try again.');
    }
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