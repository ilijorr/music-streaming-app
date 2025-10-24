import { Component, inject, signal, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDividerModule } from '@angular/material/divider';

import { ApiService } from '../../services/api.service';
import { FileService } from '../../services/file.service';
import { Artist } from '../../models/artist.model';
import { Album } from '../../models/album.model';

interface SongUploadData {
  file: File;
  title: string;
  artistIds: string[];
  albumId: string;
  genres: string[];
  coverImage?: File;
  duration: number;
}

@Component({
  selector: 'app-multiple-song-upload',
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
    MatProgressSpinnerModule,
    MatExpansionModule,
    MatDividerModule
  ],
  template: `
    <mat-card class="upload-card">
      <mat-card-header>
        <mat-card-title>Upload Multiple Songs</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <!-- File Selection -->
        <div class="file-selection-section">
          <div class="file-upload">
            <input type="file" #audioInput (change)="onAudioFilesSelected($event)" accept="audio/*" multiple style="display: none">
            <button type="button" mat-raised-button color="primary" (click)="audioInput.click()">
              <mat-icon>audiotrack</mat-icon>
              Select Audio Files
            </button>
            @if (songData().length > 0) {
              <span class="file-count">{{ songData().length }} files selected</span>
            }
          </div>

          @if (songData().length > 0) {
            <div class="bulk-actions">
              <h3>Apply to All Songs:</h3>

              <mat-form-field appearance="outline" class="bulk-field">
                <mat-label>Default Artists</mat-label>
                <mat-select [value]="bulkArtistIds()" (selectionChange)="setBulkArtists($event.value)" multiple>
                  @for (artist of artists(); track artist.artistId) {
                    <mat-option [value]="artist.artistId">{{ artist.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="bulk-field">
                <mat-label>Default Album</mat-label>
                <mat-select [value]="bulkAlbumId()" (selectionChange)="setBulkAlbum($event.value)">
                  <mat-option value="">None</mat-option>
                  @for (album of albums(); track album.albumId) {
                    <mat-option [value]="album.albumId">{{ album.title }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <div class="bulk-genres">
                <mat-form-field appearance="outline" class="genre-input">
                  <mat-label>Add Default Genre</mat-label>
                  <input matInput #bulkGenreInput (keyup.enter)="addBulkGenre(bulkGenreInput.value); bulkGenreInput.value = ''">
                </mat-form-field>
                <button type="button" mat-button (click)="addBulkGenre(bulkGenreInput.value); bulkGenreInput.value = ''">
                  Add
                </button>
              </div>

              <mat-chip-listbox class="bulk-genres-chips">
                @for (genre of bulkGenres(); track genre) {
                  <mat-chip-option (removed)="removeBulkGenre(genre)">
                    {{ genre }}
                    <mat-icon matChipRemove>cancel</mat-icon>
                  </mat-chip-option>
                }
              </mat-chip-listbox>

              <button type="button" mat-stroked-button (click)="applyBulkSettings()">
                <mat-icon>content_copy</mat-icon>
                Apply to All Songs
              </button>
            </div>
          }
        </div>

        <!-- Individual Song Forms -->
        @if (songData().length > 0) {
          <mat-divider></mat-divider>

          <div class="songs-section">
            <h3>Individual Song Details:</h3>

            <mat-accordion>
              @for (song of songData(); track song.file.name; let i = $index) {
                <mat-expansion-panel [expanded]="i === 0">
                  <mat-expansion-panel-header>
                    <mat-panel-title>
                      {{ song.title || song.file.name }}
                    </mat-panel-title>
                    <mat-panel-description>
                      @if (song.duration > 0) {
                        Duration: {{ formatDuration(song.duration) }}
                      }
                      @if (song.artistIds.length > 0) {
                        • Artists: {{ getArtistNames(song.artistIds) }}
                      }
                    </mat-panel-description>
                  </mat-expansion-panel-header>

                  <div class="song-form">
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Title</mat-label>
                      <input matInput [(ngModel)]="song.title" required>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Artists</mat-label>
                      <mat-select [(ngModel)]="song.artistIds" multiple required>
                        @for (artist of artists(); track artist.artistId) {
                          <mat-option [value]="artist.artistId">{{ artist.name }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Album (Optional)</mat-label>
                      <mat-select [(ngModel)]="song.albumId">
                        <mat-option value="">None</mat-option>
                        @for (album of albums(); track album.albumId) {
                          <mat-option [value]="album.albumId">{{ album.title }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>

                    <div class="genres-section">
                      <mat-form-field appearance="outline" class="genre-input">
                        <mat-label>Add Genre</mat-label>
                        <input matInput #genreInput (keyup.enter)="addSongGenre(i, genreInput.value); genreInput.value = ''">
                      </mat-form-field>
                      <button type="button" mat-button (click)="addSongGenre(i, genreInput.value); genreInput.value = ''">
                        Add
                      </button>
                    </div>

                    <mat-chip-listbox class="genres-chips">
                      @for (genre of song.genres; track genre) {
                        <mat-chip-option (removed)="removeSongGenre(i, genre)">
                          {{ genre }}
                          <mat-icon matChipRemove>cancel</mat-icon>
                        </mat-chip-option>
                      }
                    </mat-chip-listbox>

                    <div class="file-info">
                      <div class="file-details">
                        <strong>File:</strong> {{ song.file.name }}
                        @if (song.duration > 0) {
                          <span class="duration-info">Duration: {{ formatDuration(song.duration) }}</span>
                        }
                      </div>

                      <div class="cover-upload">
                        <input type="file" #coverInput (change)="onCoverSelected(i, $event)" accept="image/*" style="display: none">
                        <button type="button" mat-stroked-button (click)="coverInput.click()">
                          <mat-icon>image</mat-icon>
                          {{ song.coverImage ? 'Change Cover' : 'Add Cover' }}
                        </button>
                        @if (song.coverImage) {
                          <span class="cover-name">{{ song.coverImage.name }}</span>
                        }
                      </div>
                    </div>

                    <div class="song-actions">
                      <button type="button" mat-icon-button color="warn" (click)="removeSong(i)">
                        <mat-icon>delete</mat-icon>
                      </button>
                    </div>
                  </div>
                </mat-expansion-panel>
              }
            </mat-accordion>
          </div>

          <div class="upload-actions">
            <button type="button" mat-raised-button color="primary" (click)="uploadAllSongs()" [disabled]="saving() || !isFormValid()">
              @if (saving()) {
                <mat-spinner diameter="20"></mat-spinner>
                Uploading... ({{ uploadProgress() }}/{{ songData().length }})
              } @else {
                <ng-container>
                  <mat-icon>cloud_upload</mat-icon>
                  Upload All Songs ({{ songData().length }})
                </ng-container>
              }
            </button>
            <button type="button" mat-button (click)="cancel()">Cancel</button>
          </div>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .upload-card {
      margin-bottom: 24px;
    }

    .file-selection-section {
      margin-bottom: 24px;
    }

    .file-upload {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;
    }

    .file-count {
      font-weight: 500;
      color: #1976d2;
    }

    .bulk-actions {
      background: #f8f9fa;
      padding: 16px;
      border-radius: 8px;
      margin-top: 16px;
    }

    .bulk-actions h3 {
      margin: 0 0 16px 0;
      font-size: 16px;
      color: #333;
    }

    .bulk-field {
      width: 100%;
      margin-bottom: 16px;
    }

    .bulk-genres {
      display: flex;
      align-items: center;
      gap: 16px;
      margin: 16px 0;
    }

    .genre-input {
      flex: 1;
    }

    .bulk-genres-chips,
    .genres-chips {
      margin: 16px 0;
    }

    .songs-section {
      margin-top: 24px;
    }

    .songs-section h3 {
      margin-bottom: 16px;
      font-size: 18px;
      color: #333;
    }

    .song-form {
      padding: 16px 0;
    }

    .full-width {
      width: 100%;
      margin-bottom: 16px;
    }

    .genres-section {
      display: flex;
      align-items: center;
      gap: 16px;
      margin: 16px 0;
    }

    .file-info {
      background: #f5f5f5;
      padding: 16px;
      border-radius: 8px;
      margin: 16px 0;
    }

    .file-details {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 12px;
    }

    .duration-info {
      font-size: 14px;
      color: #1976d2;
      font-weight: 500;
    }

    .cover-upload {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .cover-name {
      font-size: 14px;
      color: #666;
    }

    .song-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 16px;
    }

    .upload-actions {
      display: flex;
      gap: 16px;
      margin-top: 32px;
      justify-content: center;
    }

    mat-chip-listbox {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    mat-accordion {
      margin-top: 16px;
    }

    @media (max-width: 768px) {
      .bulk-genres {
        flex-direction: column;
        align-items: stretch;
      }

      .genres-section {
        flex-direction: column;
        align-items: stretch;
      }

      .file-details {
        flex-direction: column;
        align-items: flex-start;
      }

      .cover-upload {
        flex-direction: column;
        align-items: stretch;
      }

      .upload-actions {
        flex-direction: column;
      }
    }
  `]
})
export class MultipleSongUploadComponent {
  @Input() artists = signal<Artist[]>([]);
  @Input() albums = signal<Album[]>([]);
  @Output() songsUploaded = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  private apiService = inject(ApiService);
  private fileService = inject(FileService);
  private snackBar = inject(MatSnackBar);

  public saving = signal(false);
  public uploadProgress = signal(0);
  public songData = signal<SongUploadData[]>([]);

  // Bulk settings
  public bulkArtistIds = signal<string[]>([]);
  public bulkAlbumId = signal<string>('');
  public bulkGenres = signal<string[]>([]);

  onAudioFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const files = Array.from(input.files);
      const newSongData: SongUploadData[] = files.map(file => ({
        file,
        title: this.extractTitleFromFilename(file.name),
        artistIds: [],
        albumId: '',
        genres: [],
        duration: 0
      }));

      this.songData.set(newSongData);

      // Extract durations from all files
      newSongData.forEach((songData, index) => {
        const audio = new Audio();
        audio.onloadedmetadata = () => {
          const duration = Math.round(audio.duration);
          const updatedData = this.songData();
          updatedData[index].duration = duration;
          this.songData.set([...updatedData]);
          console.log(`Audio duration detected for ${songData.file.name}:`, duration, 'seconds');
          URL.revokeObjectURL(audio.src);
        };
        audio.src = URL.createObjectURL(songData.file);
      });
    }
  }

  private extractTitleFromFilename(filename: string): string {
    // Remove file extension and clean up the filename
    return filename.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ').trim();
  }

  setBulkArtists(artistIds: string[]): void {
    this.bulkArtistIds.set(artistIds);
  }

  setBulkAlbum(albumId: string): void {
    this.bulkAlbumId.set(albumId);
  }

  addBulkGenre(genre: string): void {
    if (genre.trim() && !this.bulkGenres().includes(genre.trim())) {
      this.bulkGenres.set([...this.bulkGenres(), genre.trim()]);
    }
  }

  removeBulkGenre(genre: string): void {
    this.bulkGenres.set(this.bulkGenres().filter(g => g !== genre));
  }

  applyBulkSettings(): void {
    const updatedData = this.songData().map(song => ({
      ...song,
      artistIds: [...this.bulkArtistIds()],
      albumId: this.bulkAlbumId(),
      genres: [...this.bulkGenres()]
    }));
    this.songData.set(updatedData);
    this.snackBar.open('Bulk settings applied to all songs', 'Close', { duration: 2000 });
  }

  addSongGenre(index: number, genre: string): void {
    if (genre.trim()) {
      const updatedData = this.songData();
      if (!updatedData[index].genres.includes(genre.trim())) {
        updatedData[index].genres.push(genre.trim());
        this.songData.set([...updatedData]);
      }
    }
  }

  removeSongGenre(index: number, genre: string): void {
    const updatedData = this.songData();
    updatedData[index].genres = updatedData[index].genres.filter(g => g !== genre);
    this.songData.set([...updatedData]);
  }

  onCoverSelected(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const updatedData = this.songData();
      updatedData[index].coverImage = input.files[0];
      this.songData.set([...updatedData]);
    }
  }

  removeSong(index: number): void {
    const updatedData = this.songData();
    updatedData.splice(index, 1);
    this.songData.set([...updatedData]);
  }

  getArtistNames(artistIds: string[]): string {
    return artistIds
      .map(id => this.artists().find(artist => artist.artistId === id)?.name)
      .filter(name => name)
      .join(', ');
  }

  formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  isFormValid(): boolean {
    return this.songData().every(song =>
      song.title.trim() &&
      song.artistIds.length > 0
    );
  }

  async uploadAllSongs(): Promise<void> {
    if (!this.isFormValid()) {
      this.snackBar.open('Please fill in all required fields for all songs', 'Close', { duration: 3000 });
      return;
    }

    this.saving.set(true);
    this.uploadProgress.set(0);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < this.songData().length; i++) {
      try {
        const song = this.songData()[i];

        const audioUrl = await this.fileService.uploadAudio(song.file);
        let coverUrl = '';

        if (song.coverImage) {
          coverUrl = await this.fileService.uploadImage(song.coverImage);
        }

        const songData = {
          title: song.title,
          artist_ids: song.artistIds,
          genres: song.genres,
          audio_file_base64: audioUrl,
          audio_filename: song.file.name,
          cover_image_base64: coverUrl,
          cover_filename: song.coverImage?.name || 'cover.jpg',
          duration: song.duration,
          album_id: song.albumId || undefined
        };

        await this.apiService.createSong(songData).toPromise();
        successCount++;
        this.uploadProgress.set(i + 1);
      } catch (error) {
        console.error(`Failed to upload song ${i + 1}:`, error);
        failCount++;
      }
    }

    if (successCount > 0) {
      this.snackBar.open(`${successCount} song(s) uploaded successfully`, 'Close', { duration: 3000 });
    }
    if (failCount > 0) {
      this.snackBar.open(`Failed to upload ${failCount} song(s)`, 'Close', { duration: 3000 });
    }

    this.saving.set(false);
    this.resetForm();
    this.songsUploaded.emit();
  }

  cancel(): void {
    this.resetForm();
    this.cancelled.emit();
  }

  private resetForm(): void {
    this.songData.set([]);
    this.bulkArtistIds.set([]);
    this.bulkAlbumId.set('');
    this.bulkGenres.set([]);
    this.uploadProgress.set(0);
  }
}