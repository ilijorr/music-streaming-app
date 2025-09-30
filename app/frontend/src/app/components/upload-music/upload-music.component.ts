import { Component, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { inject } from '@angular/core';
import { MusicContent } from '../../models/music-content.interface';
import { Album } from '../../models/album.interface';
import { Artist } from '../../models/artist.interface';

@Component({
  selector: 'app-upload-music',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './upload-music.component.html',
  styleUrl: './upload-music.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UploadMusicComponent {
  private readonly fb = inject(FormBuilder);

  protected readonly uploadType = signal<'single' | 'album'>('single');
  protected readonly selectedAudioFiles = signal<File[]>([]);
  protected readonly selectedCoverImage = signal<File | null>(null);
  protected readonly coverImagePreview = computed(() => {
    const image = this.selectedCoverImage();
    return image ? URL.createObjectURL(image) : null;
  });

  // Mock artists data - in real app this would come from a service
  protected readonly availableArtists = signal<Artist[]>([
    { name: 'Test Artist', biography: 'Bio', photo: new File([], 'test'), genres: ['Rock'] }
  ]);

  protected readonly uploadForm: FormGroup = this.fb.group({
    uploadType: ['single', Validators.required],
    // Single track fields
    title: [''],
    genres: this.fb.array([this.fb.control('')]),
    selectedArtists: [[]],
    // Album fields
    albumTitle: [''],
    albumReleaseDate: [''],
    albumGenres: this.fb.array([this.fb.control('')]),
    albumArtists: [[]]
  });

  protected get genres(): FormArray {
    return this.uploadForm.get('genres') as FormArray;
  }

  protected get albumGenres(): FormArray {
    return this.uploadForm.get('albumGenres') as FormArray;
  }

  protected onUploadTypeChange(type: 'single' | 'album'): void {
    this.uploadType.set(type);
    this.uploadForm.patchValue({ uploadType: type });
    this.updateValidators();
  }

  private updateValidators(): void {
    const isAlbum = this.uploadType() === 'album';

    // Single track validators
    const titleControl = this.uploadForm.get('title');
    const selectedArtistsControl = this.uploadForm.get('selectedArtists');

    // Album validators
    const albumTitleControl = this.uploadForm.get('albumTitle');
    const albumReleaseDateControl = this.uploadForm.get('albumReleaseDate');
    const albumArtistsControl = this.uploadForm.get('albumArtists');

    if (isAlbum) {
      titleControl?.clearValidators();
      selectedArtistsControl?.clearValidators();

      albumTitleControl?.setValidators([Validators.required]);
      albumReleaseDateControl?.setValidators([Validators.required]);
      albumArtistsControl?.setValidators([Validators.required]);
    } else {
      albumTitleControl?.clearValidators();
      albumReleaseDateControl?.clearValidators();
      albumArtistsControl?.clearValidators();

      titleControl?.setValidators([Validators.required]);
      selectedArtistsControl?.setValidators([Validators.required]);
    }

    // Update validity
    titleControl?.updateValueAndValidity();
    selectedArtistsControl?.updateValueAndValidity();
    albumTitleControl?.updateValueAndValidity();
    albumReleaseDateControl?.updateValueAndValidity();
    albumArtistsControl?.updateValueAndValidity();
  }

  protected onAudioFilesSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    const files = Array.from(target.files || []);

    const audioFiles = files.filter(file => file.type.startsWith('audio/'));
    this.selectedAudioFiles.set(audioFiles);
  }

  protected onCoverImageSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (file && file.type.startsWith('image/')) {
      this.selectedCoverImage.set(file);
    }
  }

  protected addGenre(isAlbum: boolean = false): void {
    const genresArray = isAlbum ? this.albumGenres : this.genres;
    genresArray.push(this.fb.control('', Validators.required));
  }

  protected removeGenre(index: number, isAlbum: boolean = false): void {
    const genresArray = isAlbum ? this.albumGenres : this.genres;
    if (genresArray.length > 1) {
      genresArray.removeAt(index);
    }
  }

  protected extractFileMetadata(file: File): {
    fileName: string;
    fileType: string;
    fileSize: number;
    createdAt: Date;
    lastModified: Date;
  } {
    return {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      createdAt: new Date(), // In real app, this might come from file metadata
      lastModified: new Date(file.lastModified)
    };
  }

  protected onSubmit(): void {
    if (!this.uploadForm.valid || this.selectedAudioFiles().length === 0) {
      return;
    }

    const formValue = this.uploadForm.value;
    const audioFiles = this.selectedAudioFiles();

    if (this.uploadType() === 'single') {
      // Create single track
      const audioFile = audioFiles[0];
      const metadata = this.extractFileMetadata(audioFile);

      const musicContent: MusicContent = {
        ...metadata,
        title: formValue.title,
        genres: formValue.genres.filter((g: string) => g.trim()),
        coverImage: this.selectedCoverImage() || undefined,
        artistIds: formValue.selectedArtists,
        audioFile: audioFile
      };

      console.log('Single track to upload:', musicContent);
    } else {
      // Create album
      const tracks: MusicContent[] = audioFiles.map((file, index) => {
        const metadata = this.extractFileMetadata(file);
        return {
          ...metadata,
          title: `Track ${index + 1}`, // Would be extracted from metadata or user input
          genres: formValue.albumGenres.filter((g: string) => g.trim()),
          artistIds: formValue.albumArtists,
          audioFile: file
        };
      });

      const album: Album = {
        title: formValue.albumTitle,
        releaseDate: new Date(formValue.albumReleaseDate),
        coverImage: this.selectedCoverImage() || undefined,
        genres: formValue.albumGenres.filter((g: string) => g.trim()),
        artistIds: formValue.albumArtists,
        tracks: tracks
      };

      console.log('Album to upload:', album);
    }

    // TODO: Implement upload service calls
  }
}