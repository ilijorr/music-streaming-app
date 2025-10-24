import { Component, inject, signal, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ApiService } from '../../services/api.service';
import { FileService } from '../../services/file.service';
import { Artist } from '../../models/artist.model';
import { Song } from '../../models/song.model';
import { Album } from '../../models/album.model';

@Component({
  selector: 'app-single-song-upload',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatChipsModule,
    MatSnackBarModule,
    MatProgressSpinnerModule
  ],
  template: `
    <mat-card class="upload-card">
      <mat-card-header>
        <mat-card-title>{{ editingSong() ? 'Edit Song' : 'Upload Single Song' }}</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <form [formGroup]="songForm" (ngSubmit)="saveSong()">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Title</mat-label>
            <input matInput formControlName="title" required>
            @if (songForm.get('title')?.hasError('required')) {
              <mat-error>Title is required</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Artists</mat-label>
            <mat-select formControlName="artistIds" multiple required>
              @for (artist of artists(); track artist.artistId) {
                <mat-option [value]="artist.artistId">{{ artist.name }}</mat-option>
              }
            </mat-select>
            @if (songForm.get('artistIds')?.hasError('required')) {
              <mat-error>At least one artist is required</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Album (Optional)</mat-label>
            <mat-select formControlName="albumId">
              <mat-option value="">None</mat-option>
              @for (album of albums(); track album.albumId) {
                <mat-option [value]="album.albumId">{{ album.title }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <div class="genres-section">
            <mat-form-field appearance="outline" class="genre-input">
              <mat-label>Add Genre</mat-label>
              <input matInput #genreInput (keyup.enter)="addGenre(genreInput.value); genreInput.value = ''">
            </mat-form-field>
            <button type="button" mat-button (click)="addGenre(genreInput.value); genreInput.value = ''">
              Add
            </button>
          </div>

          <mat-chip-listbox class="genres-chips">
            @for (genre of genres(); track genre) {
              <mat-chip-option (removed)="removeGenre(genre)">
                {{ genre }}
                <mat-icon matChipRemove>cancel</mat-icon>
              </mat-chip-option>
            }
          </mat-chip-listbox>

          <div class="file-upload">
            <input type="file" #audioInput (change)="onAudioSelected($event)" accept="audio/*" style="display: none">
            <button type="button" mat-stroked-button (click)="audioInput.click()">
              <mat-icon>audiotrack</mat-icon>
              {{ selectedAudio() ? 'Change Audio' : 'Select Audio File' }}
            </button>
            @if (selectedAudio()) {
              <span class="file-name">{{ selectedAudio()?.name }}</span>
            }
            @if (detectedDuration() > 0) {
              <span class="duration-info">Duration: {{ formatDuration(detectedDuration()) }}</span>
            }
          </div>

          <div class="file-upload">
            <input type="file" #coverInput (change)="onCoverSelected($event)" accept="image/*" style="display: none">
            <button type="button" mat-stroked-button (click)="coverInput.click()">
              <mat-icon>image</mat-icon>
              {{ selectedCover() ? 'Change Cover' : 'Select Cover Image' }}
            </button>
            @if (selectedCover()) {
              <span class="file-name">{{ selectedCover()?.name }}</span>
            }
          </div>

          <div class="form-actions">
            <button type="submit" mat-raised-button color="primary" [disabled]="songForm.invalid || saving()">
              @if (saving()) {
                <mat-spinner diameter="20"></mat-spinner>
              } @else {
                {{ editingSong() ? 'Update' : 'Upload' }}
              }
            </button>
            <button type="button" mat-button (click)="cancel()">Cancel</button>
          </div>
        </form>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .upload-card {
      margin-bottom: 24px;
    }

    .full-width {
      width: 100%;
    }

    .file-upload {
      margin: 16px 0;
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .file-name {
      font-size: 14px;
      color: #666;
      flex: 1;
    }

    .duration-info {
      font-size: 14px;
      color: #1976d2;
      font-weight: 500;
      margin-left: 16px;
    }

    .genres-section {
      display: flex;
      align-items: center;
      gap: 16px;
      margin: 16px 0;
    }

    .genre-input {
      flex: 1;
    }

    .genres-chips {
      margin: 16px 0;
    }

    .form-actions {
      display: flex;
      gap: 16px;
      margin-top: 24px;
    }

    mat-chip-listbox {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    @media (max-width: 768px) {
      .form-actions {
        flex-direction: column;
      }

      .genres-section {
        flex-direction: column;
        align-items: stretch;
      }

      .file-upload {
        flex-direction: column;
        align-items: stretch;
      }

      .duration-info {
        margin-left: 0;
      }
    }
  `]
})
export class SingleSongUploadComponent implements OnInit {
  @Input() artists = signal<Artist[]>([]);
  @Input() albums = signal<Album[]>([]);
  @Input() editingSong = signal<Song | null>(null);
  @Output() songSaved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  private apiService = inject(ApiService);
  private fileService = inject(FileService);
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);

  public saving = signal(false);
  public selectedAudio = signal<File | null>(null);
  public selectedCover = signal<File | null>(null);
  public genres = signal<string[]>([]);
  public detectedDuration = signal<number>(0);

  public songForm: FormGroup;

  constructor() {
    this.songForm = this.fb.group({
      title: ['', Validators.required],
      artistIds: [[], Validators.required],
      albumId: ['']
    });
  }

  ngOnInit(): void {
    // If editing, populate the form
    const song = this.editingSong();
    if (song) {
      this.songForm.patchValue({
        title: song.title,
        artistIds: song.artistIds,
        albumId: song.albumId || ''
      });
      this.genres.set([...song.genres]);
      this.detectedDuration.set(song.duration);
    }
  }

  onAudioSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.selectedAudio.set(file);

      // Extract duration from audio file
      const audio = new Audio();
      audio.onloadedmetadata = () => {
        const duration = Math.round(audio.duration);
        this.detectedDuration.set(duration);
        console.log('Audio duration detected:', duration, 'seconds');
        URL.revokeObjectURL(audio.src);
      };
      audio.src = URL.createObjectURL(file);
    }
  }

  onCoverSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.selectedCover.set(input.files[0]);
    }
  }

  addGenre(genre: string): void {
    if (genre.trim() && !this.genres().includes(genre.trim())) {
      this.genres.set([...this.genres(), genre.trim()]);
    }
  }

  removeGenre(genre: string): void {
    this.genres.set(this.genres().filter(g => g !== genre));
  }

  formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  async saveSong(): Promise<void> {
    if (this.songForm.invalid) return;

    this.saving.set(true);
    const formData = this.songForm.value;

    try {
      let audioUrl = '';
      let coverUrl = '';

      if (this.selectedAudio()) {
        audioUrl = await this.fileService.uploadAudio(this.selectedAudio()!);
      }

      if (this.selectedCover()) {
        coverUrl = await this.fileService.uploadImage(this.selectedCover()!);
      }

      const songData = {
        title: formData.title,
        artist_ids: formData.artistIds,
        genres: this.genres(),
        audio_file_base64: audioUrl,
        audio_filename: this.selectedAudio()?.name || 'audio.mp3',
        cover_image_base64: coverUrl,
        cover_filename: this.selectedCover()?.name || 'cover.jpg',
        duration: this.detectedDuration(),
        album_id: formData.albumId || undefined
      };

      if (this.editingSong()) {
        await this.apiService.updateSong(this.editingSong()!.songId, songData).toPromise();
        this.snackBar.open('Song updated successfully', 'Close', { duration: 3000 });
      } else {
        await this.apiService.createSong(songData).toPromise();
        this.snackBar.open('Song uploaded successfully', 'Close', { duration: 3000 });
      }

      this.resetForm();
      this.songSaved.emit();
    } catch (error) {
      this.snackBar.open('Failed to save song', 'Close', { duration: 3000 });
    }

    this.saving.set(false);
  }

  cancel(): void {
    this.resetForm();
    this.cancelled.emit();
  }

  private resetForm(): void {
    this.songForm.reset();
    this.genres.set([]);
    this.detectedDuration.set(0);
    this.selectedAudio.set(null);
    this.selectedCover.set(null);
  }
}