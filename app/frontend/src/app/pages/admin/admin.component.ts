import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';

import { ApiService } from '../../services/api.service';
import { FileService } from '../../services/file.service';
import { Artist } from '../../models/artist.model';
import { Song } from '../../models/song.model';
import { Album } from '../../models/album.model';
import { SingleSongUploadComponent } from '../../components/single-song-upload/single-song-upload.component';
import { MultipleSongUploadComponent } from '../../components/multiple-song-upload/multiple-song-upload.component';

interface AlbumSongFile {
  file: File;
  title: string;
  duration: number;
  base64Data?: string;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatTabsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatChipsModule,
    MatTableModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatCheckboxModule,
    SingleSongUploadComponent,
    MultipleSongUploadComponent
  ],
  template: `
    <div class="admin-container">
      <h1>Content Management</h1>

      <mat-tab-group>
        <!-- Artists Tab -->
        <mat-tab label="Artists">
          <div class="tab-content">
            <div class="actions-bar">
              <button mat-raised-button color="primary" (click)="showArtistForm = !showArtistForm">
                <mat-icon>add</mat-icon>
                Add Artist
              </button>
              <button mat-button (click)="loadArtists()">
                <mat-icon>refresh</mat-icon>
                Refresh
              </button>
            </div>

            @if (showArtistForm) {
              <mat-card class="form-card">
                <mat-card-header>
                  <mat-card-title>{{ editingArtist() ? 'Edit Artist' : 'New Artist' }}</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <form [formGroup]="artistForm" (ngSubmit)="saveArtist()">
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Name</mat-label>
                      <input matInput formControlName="name" required>
                      @if (artistForm.get('name')?.hasError('required')) {
                        <mat-error>Name is required</mat-error>
                      }
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Biography</mat-label>
                      <textarea matInput formControlName="biography" rows="4"></textarea>
                    </mat-form-field>

                    <div class="file-upload">
                      <input type="file" #imageInput (change)="onImageSelected($event)" accept="image/*" style="display: none">
                      <button type="button" mat-stroked-button (click)="imageInput.click()">
                        <mat-icon>image</mat-icon>
                        {{ selectedImage() ? 'Change Image' : 'Select Image' }}
                      </button>
                      @if (selectedImage()) {
                        <span class="file-name">{{ selectedImage()?.name }}</span>
                      }
                    </div>

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
                      @for (genre of artistGenres(); track genre) {
                        <mat-chip-option (removed)="removeGenre(genre)">
                          {{ genre }}
                          <mat-icon matChipRemove>cancel</mat-icon>
                        </mat-chip-option>
                      }
                    </mat-chip-listbox>

                    <div class="form-actions">
                      <button type="submit" mat-raised-button color="primary" [disabled]="artistForm.invalid || saving()">
                        @if (saving()) {
                          <mat-spinner diameter="20"></mat-spinner>
                        } @else {
                          {{ editingArtist() ? 'Update' : 'Create' }}
                        }
                      </button>
                      <button type="button" mat-button (click)="cancelArtistForm()">Cancel</button>
                    </div>
                  </form>
                </mat-card-content>
              </mat-card>
            }

            <mat-card class="data-card">
              <mat-card-header>
                <mat-card-title>Artists</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                @if (loading()) {
                  <div class="loading">
                    <mat-spinner></mat-spinner>
                  </div>
                } @else {
                  <table mat-table [dataSource]="artists()" class="full-width">
                    <ng-container matColumnDef="image">
                      <th mat-header-cell *matHeaderCellDef>Image</th>
                      <td mat-cell *matCellDef="let artist">
                        @if (artist.imageUrl) {
                          <img [src]="artist.imageUrl" alt="Artist" class="artist-image">
                        } @else {
                          <div class="no-image">
                            <mat-icon>person</mat-icon>
                          </div>
                        }
                      </td>
                    </ng-container>

                    <ng-container matColumnDef="name">
                      <th mat-header-cell *matHeaderCellDef>Name</th>
                      <td mat-cell *matCellDef="let artist">{{ artist.name }}</td>
                    </ng-container>

                    <ng-container matColumnDef="genres">
                      <th mat-header-cell *matHeaderCellDef>Genres</th>
                      <td mat-cell *matCellDef="let artist">
                        <mat-chip-listbox>
                          @for (genre of artist.genres; track genre) {
                            <mat-chip-option>{{ genre }}</mat-chip-option>
                          }
                        </mat-chip-listbox>
                      </td>
                    </ng-container>

                    <ng-container matColumnDef="actions">
                      <th mat-header-cell *matHeaderCellDef>Actions</th>
                      <td mat-cell *matCellDef="let artist">
                        <button mat-icon-button (click)="editArtist(artist)">
                          <mat-icon>edit</mat-icon>
                        </button>
                        <button mat-icon-button color="warn" (click)="deleteArtist(artist.artistId)">
                          <mat-icon>delete</mat-icon>
                        </button>
                      </td>
                    </ng-container>

                    <tr mat-header-row *matHeaderRowDef="artistColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: artistColumns;"></tr>
                  </table>
                }
              </mat-card-content>
            </mat-card>
          </div>
        </mat-tab>

        <!-- Songs Tab -->
        <mat-tab label="Songs">
          <div class="tab-content">
            <div class="actions-bar">
              <button mat-raised-button color="primary" (click)="showSingleUpload = !showSingleUpload">
                <mat-icon>add</mat-icon>
                Upload Single Song
              </button>
              <button mat-raised-button color="accent" (click)="showMultipleUpload = !showMultipleUpload">
                <mat-icon>library_music</mat-icon>
                Upload Multiple Songs
              </button>
              <button mat-button (click)="loadSongs()">
                <mat-icon>refresh</mat-icon>
                Refresh
              </button>
            </div>

            @if (showSingleUpload) {
              <app-single-song-upload
                [artists]="artists"
                [albums]="albums"
                [editingSong]="editingSong"
                (songSaved)="onSongSaved()"
                (cancelled)="onSingleUploadCancelled()">
              </app-single-song-upload>
            }

            @if (showMultipleUpload) {
              <app-multiple-song-upload
                [artists]="artists"
                [albums]="albums"
                (songsUploaded)="onSongsSaved()"
                (cancelled)="onMultipleUploadCancelled()">
              </app-multiple-song-upload>
            }

            <mat-card class="data-card">
              <mat-card-header>
                <mat-card-title>Songs</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                @if (loading()) {
                  <div class="loading">
                    <mat-spinner></mat-spinner>
                  </div>
                } @else {
                  <table mat-table [dataSource]="songs()" class="full-width">
                    <ng-container matColumnDef="cover">
                      <th mat-header-cell *matHeaderCellDef>Cover</th>
                      <td mat-cell *matCellDef="let song">
                        @if (song.coverUrl) {
                          <img [src]="song.coverUrl" alt="Cover" class="song-cover">
                        } @else {
                          <div class="no-image">
                            <mat-icon>music_note</mat-icon>
                          </div>
                        }
                      </td>
                    </ng-container>

                    <ng-container matColumnDef="title">
                      <th mat-header-cell *matHeaderCellDef>Title</th>
                      <td mat-cell *matCellDef="let song">{{ song.title }}</td>
                    </ng-container>

                    <ng-container matColumnDef="artists">
                      <th mat-header-cell *matHeaderCellDef>Artists</th>
                      <td mat-cell *matCellDef="let song">{{ getArtistNames(song.artistIds) }}</td>
                    </ng-container>

                    <ng-container matColumnDef="duration">
                      <th mat-header-cell *matHeaderCellDef>Duration</th>
                      <td mat-cell *matCellDef="let song">{{ formatDuration(song.duration) }}</td>
                    </ng-container>

                    <ng-container matColumnDef="actions">
                      <th mat-header-cell *matHeaderCellDef>Actions</th>
                      <td mat-cell *matCellDef="let song">
                        <button mat-icon-button (click)="editSong(song)">
                          <mat-icon>edit</mat-icon>
                        </button>
                        <button mat-icon-button color="warn" (click)="deleteSong(song.songId)">
                          <mat-icon>delete</mat-icon>
                        </button>
                      </td>
                    </ng-container>

                    <tr mat-header-row *matHeaderRowDef="songColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: songColumns;"></tr>
                  </table>
                }
              </mat-card-content>
            </mat-card>
          </div>
        </mat-tab>

        <!-- Albums Tab -->
        <mat-tab label="Albums">
          <div class="tab-content">
            <div class="actions-bar">
              <button mat-raised-button color="primary" (click)="showAlbumForm = !showAlbumForm">
                <mat-icon>add</mat-icon>
                Add Album
              </button>
              <button mat-button (click)="loadAlbums()">
                <mat-icon>refresh</mat-icon>
                Refresh
              </button>
            </div>

            @if (showAlbumForm) {
              <mat-card class="form-card">
                <mat-card-header>
                  <mat-card-title>{{ editingAlbum() ? 'Edit Album' : 'New Album' }}</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <form [formGroup]="albumForm" (ngSubmit)="saveAlbum()">
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Title</mat-label>
                      <input matInput formControlName="title" required>
                      @if (albumForm.get('title')?.hasError('required')) {
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
                      @if (albumForm.get('artistIds')?.hasError('required')) {
                        <mat-error>At least one artist is required</mat-error>
                      }
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Release Year</mat-label>
                      <input matInput type="number" formControlName="releaseYear" required min="1900" [max]="currentYear">
                      @if (albumForm.get('releaseYear')?.hasError('required')) {
                        <mat-error>Release year is required</mat-error>
                      }
                      @if (albumForm.get('releaseYear')?.hasError('min')) {
                        <mat-error>Release year must be after 1900</mat-error>
                      }
                      @if (albumForm.get('releaseYear')?.hasError('max')) {
                        <mat-error>Release year cannot be in the future</mat-error>
                      }
                    </mat-form-field>

                    <div class="genres-section">
                      <mat-form-field appearance="outline" class="genre-input">
                        <mat-label>Add Genre</mat-label>
                        <input matInput #albumGenreInput (keyup.enter)="addAlbumGenre(albumGenreInput.value); albumGenreInput.value = ''">
                      </mat-form-field>
                      <button type="button" mat-button (click)="addAlbumGenre(albumGenreInput.value); albumGenreInput.value = ''">
                        Add
                      </button>
                    </div>

                    <mat-chip-listbox class="genres-chips">
                      @for (genre of albumGenres(); track genre) {
                        <mat-chip-option (removed)="removeAlbumGenre(genre)">
                          {{ genre }}
                          <mat-icon matChipRemove>cancel</mat-icon>
                        </mat-chip-option>
                      }
                    </mat-chip-listbox>

                    <div class="album-songs-section">
                      <h3>Album Songs</h3>
                      <p class="instruction-text">Add songs to this album. Each song will be uploaded as part of the album creation.</p>

                      <div class="album-song-upload">
                        <div class="song-upload-actions">
                          <input type="file" #songInput (change)="onAlbumSongSelected($event)" accept="audio/*" multiple style="display: none">
                          <button type="button" mat-stroked-button (click)="songInput.click()">
                            <mat-icon>audiotrack</mat-icon>
                            Add Songs to Album
                          </button>
                        </div>

                        @if (albumSongs().length > 0) {
                          <div class="album-songs-list">
                            @for (songFile of albumSongs(); track songFile.file.name; let i = $index) {
                              <mat-card class="song-item-card">
                                <mat-card-content>
                                  <div class="song-item-header">
                                    <mat-form-field appearance="outline" class="song-title-field">
                                      <mat-label>Song Title</mat-label>
                                      <input matInput [(ngModel)]="songFile.title" required>
                                    </mat-form-field>
                                    <button type="button" mat-icon-button color="warn" (click)="removeAlbumSong(i)">
                                      <mat-icon>delete</mat-icon>
                                    </button>
                                  </div>
                                  <div class="song-details">
                                    <span class="file-name">{{ songFile.file.name }}</span>
                                    @if (songFile.duration > 0) {
                                      <span class="duration-info">{{ formatDuration(songFile.duration) }}</span>
                                    }
                                  </div>
                                </mat-card-content>
                              </mat-card>
                            }
                          </div>
                        }

                        @if (albumSongs().length === 0) {
                          <div class="no-songs-message">
                            <mat-icon>music_note</mat-icon>
                            <span>No songs added yet. Click "Add Songs to Album" to upload audio files.</span>
                          </div>
                        }
                      </div>
                    </div>

                    <div class="file-upload">
                      <input type="file" #albumCoverInput (change)="onAlbumCoverSelected($event)" accept="image/*" style="display: none">
                      <button type="button" mat-stroked-button (click)="albumCoverInput.click()">
                        <mat-icon>image</mat-icon>
                        {{ selectedAlbumCover() ? 'Change Cover' : 'Select Cover Image' }}
                      </button>
                      @if (selectedAlbumCover()) {
                        <span class="file-name">{{ selectedAlbumCover()?.name }}</span>
                      }
                    </div>

                    <div class="form-actions">
                      <button type="submit" mat-raised-button color="primary" [disabled]="albumForm.invalid || saving() || albumGenres().length === 0 || albumSongs().length === 0">
                        @if (saving()) {
                          <mat-spinner diameter="20"></mat-spinner>
                        } @else {
                          {{ editingAlbum() ? 'Update' : 'Create' }}
                        }
                      </button>
                      <button type="button" mat-button (click)="cancelAlbumForm()">Cancel</button>
                    </div>

                    @if (albumGenres().length === 0 || albumSongs().length === 0) {
                      <div class="genre-requirement-hint">
                        <mat-icon>info</mat-icon>
                        <span>
                          @if (albumGenres().length === 0 && albumSongs().length === 0) {
                            Please add at least one genre and one song to create an album
                          } @else if (albumGenres().length === 0) {
                            Please add at least one genre to create an album
                          } @else {
                            Please add at least one song to create an album
                          }
                        </span>
                      </div>
                    }
                  </form>
                </mat-card-content>
              </mat-card>
            }

            <mat-card class="data-card">
              <mat-card-header>
                <mat-card-title>Albums</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                @if (loading()) {
                  <div class="loading">
                    <mat-spinner></mat-spinner>
                  </div>
                } @else {
                  <table mat-table [dataSource]="albums()" class="full-width">
                    <ng-container matColumnDef="cover">
                      <th mat-header-cell *matHeaderCellDef>Cover</th>
                      <td mat-cell *matCellDef="let album">
                        @if (album.coverUrl) {
                          <img [src]="album.coverUrl" alt="Cover" class="album-cover">
                        } @else {
                          <div class="no-image">
                            <mat-icon>album</mat-icon>
                          </div>
                        }
                      </td>
                    </ng-container>

                    <ng-container matColumnDef="title">
                      <th mat-header-cell *matHeaderCellDef>Title</th>
                      <td mat-cell *matCellDef="let album">{{ album.title }}</td>
                    </ng-container>

                    <ng-container matColumnDef="artists">
                      <th mat-header-cell *matHeaderCellDef>Artists</th>
                      <td mat-cell *matCellDef="let album">{{ getArtistNames(album.artistIds) }}</td>
                    </ng-container>

                    <ng-container matColumnDef="year">
                      <th mat-header-cell *matHeaderCellDef>Year</th>
                      <td mat-cell *matCellDef="let album">{{ album.releaseYear }}</td>
                    </ng-container>

                    <ng-container matColumnDef="songs">
                      <th mat-header-cell *matHeaderCellDef>Songs</th>
                      <td mat-cell *matCellDef="let album">{{ album.songIds?.length || 0 }}</td>
                    </ng-container>

                    <ng-container matColumnDef="actions">
                      <th mat-header-cell *matHeaderCellDef>Actions</th>
                      <td mat-cell *matCellDef="let album">
                        <button mat-icon-button (click)="editAlbum(album)">
                          <mat-icon>edit</mat-icon>
                        </button>
                        <button mat-icon-button color="warn" (click)="deleteAlbum(album.albumId)">
                          <mat-icon>delete</mat-icon>
                        </button>
                      </td>
                    </ng-container>

                    <tr mat-header-row *matHeaderRowDef="albumColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: albumColumns;"></tr>
                  </table>
                }
              </mat-card-content>
            </mat-card>
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    .admin-container {
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
    }

    h1 {
      margin-bottom: 24px;
      color: #333;
    }

    .tab-content {
      padding: 24px 0;
    }

    .actions-bar {
      display: flex;
      gap: 16px;
      margin-bottom: 24px;
    }

    .form-card {
      margin-bottom: 24px;
    }

    .data-card {
      margin-top: 24px;
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

    .genre-requirement-hint {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 16px;
      padding: 12px;
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      border-radius: 4px;
      color: #856404;
      font-size: 14px;
    }

    .album-songs-section {
      margin: 24px 0;
    }

    .album-songs-section h3 {
      margin: 0 0 8px 0;
      font-size: 18px;
      color: #333;
    }

    .instruction-text {
      margin: 0 0 16px 0;
      color: #666;
      font-size: 14px;
    }

    .album-songs-list {
      margin-top: 16px;
    }

    .song-item-card {
      margin-bottom: 12px;
    }

    .song-item-header {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .song-title-field {
      flex: 1;
    }

    .song-details {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-top: 8px;
      font-size: 14px;
      color: #666;
    }

    .no-songs-message {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 24px;
      background: #f5f5f5;
      border-radius: 8px;
      color: #666;
      text-align: center;
      justify-content: center;
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

    .loading {
      display: flex;
      justify-content: center;
      padding: 40px;
    }

    .artist-image,
    .song-cover,
    .album-cover {
      width: 50px;
      height: 50px;
      object-fit: cover;
      border-radius: 4px;
    }

    .no-image {
      width: 50px;
      height: 50px;
      background: #f5f5f5;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #999;
    }

    mat-chip-listbox {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    @media (max-width: 768px) {
      .admin-container {
        padding: 16px;
      }

      .actions-bar {
        flex-direction: column;
      }

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

    }
  `]
})
export class AdminComponent implements OnInit {
  private apiService = inject(ApiService);
  private fileService = inject(FileService);
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);

  public artists = signal<Artist[]>([]);
  public songs = signal<Song[]>([]);
  public albums = signal<Album[]>([]);
  public loading = signal(false);
  public saving = signal(false);

  public showArtistForm = false;
  public showAlbumForm = false;
  public showSingleUpload = false;
  public showMultipleUpload = false;

  public editingArtist = signal<Artist | null>(null);
  public editingSong = signal<Song | null>(null);
  public editingAlbum = signal<Album | null>(null);

  public selectedImage = signal<File | null>(null);
  public selectedAlbumCover = signal<File | null>(null);

  public artistGenres = signal<string[]>([]);
  public albumGenres = signal<string[]>([]);
  public albumSongs = signal<AlbumSongFile[]>([]);

  public artistColumns = ['image', 'name', 'genres', 'actions'];
  public songColumns = ['cover', 'title', 'artists', 'duration', 'actions'];
  public albumColumns = ['cover', 'title', 'artists', 'year', 'songs', 'actions'];

  public currentYear = new Date().getFullYear();

  public artistForm: FormGroup;
  public albumForm: FormGroup;

  constructor() {
    this.artistForm = this.fb.group({
      name: ['', Validators.required],
      biography: ['']
    });

    this.albumForm = this.fb.group({
      title: ['', Validators.required],
      artistIds: [[], Validators.required],
      releaseYear: ['', [Validators.required, Validators.min(1900), Validators.max(this.currentYear)]]
    });
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loadArtists();
    this.loadSongs();
    this.loadAlbums();
  }

  loadArtists(): void {
    this.loading.set(true);
    this.apiService.getArtists().subscribe({
      next: (artists) => {
        this.artists.set(artists);
        this.loading.set(false);
      },
      error: (error) => {
        this.snackBar.open('Failed to load artists', 'Close', { duration: 3000 });
        this.loading.set(false);
      }
    });
  }

  loadSongs(): void {
    this.loading.set(true);
    this.apiService.getSongs().subscribe({
      next: (songs) => {
        this.songs.set(songs);
        this.loading.set(false);
      },
      error: (error) => {
        this.snackBar.open('Failed to load songs', 'Close', { duration: 3000 });
        this.loading.set(false);
      }
    });
  }

  loadAlbums(): void {
    this.loading.set(true);
    this.apiService.getAlbums().subscribe({
      next: (albums) => {
        this.albums.set(albums);
        this.loading.set(false);
      },
      error: (error) => {
        this.snackBar.open('Failed to load albums', 'Close', { duration: 3000 });
        this.loading.set(false);
      }
    });
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.selectedImage.set(input.files[0]);
    }
  }


  onAlbumCoverSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.selectedAlbumCover.set(input.files[0]);
    }
  }

  addGenre(genre: string): void {
    if (genre.trim() && !this.artistGenres().includes(genre.trim())) {
      this.artistGenres.update(genres => [...genres, genre.trim()]);
    }
  }

  removeGenre(genre: string): void {
    this.artistGenres.update(genres => genres.filter(g => g !== genre));
  }

  addAlbumGenre(genre: string): void {
    if (genre.trim() && !this.albumGenres().includes(genre.trim())) {
      this.albumGenres.update(genres => [...genres, genre.trim()]);
    }
  }

  removeAlbumGenre(genre: string): void {
    this.albumGenres.update(genres => genres.filter(g => g !== genre));
  }

  onAlbumSongSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const files = Array.from(input.files);
      const newSongs: AlbumSongFile[] = files.map(file => ({
        file,
        title: this.extractTitleFromFilename(file.name),
        duration: 0
      }));

      this.albumSongs.update(songs => [...songs, ...newSongs]);

      // Extract durations from audio files
      newSongs.forEach((songFile, index) => {
        const audio = new Audio();
        audio.onloadedmetadata = () => {
          const duration = Math.round(audio.duration);
          const currentSongs = this.albumSongs();
          const songIndex = currentSongs.length - newSongs.length + index;
          currentSongs[songIndex].duration = duration;
          this.albumSongs.set([...currentSongs]);
          URL.revokeObjectURL(audio.src);
        };
        audio.src = URL.createObjectURL(songFile.file);
      });
    }
  }

  removeAlbumSong(index: number): void {
    this.albumSongs.update(songs => {
      songs.splice(index, 1);
      return [...songs];
    });
  }

  private extractTitleFromFilename(filename: string): string {
    return filename.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ').trim();
  }


  async saveArtist(): Promise<void> {
    if (this.artistForm.invalid) return;

    this.saving.set(true);
    const formData = this.artistForm.value;

    try {
      let imageUrl = '';
      if (this.selectedImage()) {
        imageUrl = await this.fileService.uploadImage(this.selectedImage()!);
      }

      const artistData: any = {
        name: formData.name,
        biography: formData.biography,
        genres: this.artistGenres()
      };

      // Only include image data if an image is selected
      if (this.selectedImage() && imageUrl) {
        artistData.image_base64 = imageUrl;
        artistData.image_filename = this.selectedImage()!.name;
      }

      if (this.editingArtist()) {
        await this.apiService.updateArtist(this.editingArtist()!.artistId, artistData).toPromise();
        this.snackBar.open('Artist updated successfully', 'Close', { duration: 3000 });
      } else {
        await this.apiService.createArtist(artistData).toPromise();
        this.snackBar.open('Artist created successfully', 'Close', { duration: 3000 });
      }

      this.cancelArtistForm();
      this.loadArtists();
    } catch (error) {
      this.snackBar.open('Failed to save artist', 'Close', { duration: 3000 });
    }

    this.saving.set(false);
  }


  async saveAlbum(): Promise<void> {
    if (this.albumForm.invalid || this.albumGenres().length === 0 || this.albumSongs().length === 0) {
      return;
    }

    this.saving.set(true);
    const formData = this.albumForm.value;

    try {
      let coverUrl = '';
      if (this.selectedAlbumCover()) {
        coverUrl = await this.fileService.uploadImage(this.selectedAlbumCover()!);
      }

      // Convert album songs to base64 for backend upload
      const songs = await Promise.all(
        this.albumSongs().map(async (songFile, index) => {
          const base64Data = await this.fileService.uploadAudio(songFile.file);

          return {
            title: songFile.title,
            audio_file_base64: base64Data,
            genres: this.albumGenres(), // Use album genres as default
            duration: songFile.duration,
            featuring_artists: [],
            track_number: index + 1,
            audio_filename: songFile.file.name
          };
        })
      );

      const albumData = {
        title: formData.title,
        artist_ids: formData.artistIds,
        release_date: formData.releaseYear.toString() + '-01-01',
        genres: this.albumGenres(),
        songs: songs,
        cover_image_base64: coverUrl,
        cover_filename: this.selectedAlbumCover()?.name || 'cover.jpg'
      };

      await this.apiService.createAlbum(albumData).toPromise();
      this.snackBar.open('Album created successfully with all songs', 'Close', { duration: 3000 });

      this.cancelAlbumForm();
      this.loadAlbums();
      this.loadSongs(); // Refresh songs list since new songs were created
    } catch (error) {
      console.error('Album creation error:', error);
      this.snackBar.open('Failed to create album', 'Close', { duration: 3000 });
    }

    this.saving.set(false);
  }

  editArtist(artist: Artist): void {
    this.editingArtist.set(artist);
    this.artistForm.patchValue({
      name: artist.name,
      biography: artist.biography
    });
    this.artistGenres.set([...artist.genres]);
    this.showArtistForm = true;
  }

  editSong(song: Song): void {
    this.editingSong.set(song);
    this.showSingleUpload = true;
    this.showMultipleUpload = false;
  }

  editAlbum(album: Album): void {
    this.editingAlbum.set(album);
    this.albumForm.patchValue({
      title: album.title,
      artistIds: album.artistIds,
      releaseYear: album.releaseYear,
      songIds: album.songIds || []
    });
    this.albumGenres.set([...album.genres]);
    this.showAlbumForm = true;
  }

  deleteArtist(artistId: string): void {
    if (confirm('Are you sure you want to delete this artist?')) {
      this.apiService.deleteArtist(artistId).subscribe({
        next: () => {
          this.snackBar.open('Artist deleted successfully', 'Close', { duration: 3000 });
          this.loadArtists();
        },
        error: () => {
          this.snackBar.open('Failed to delete artist', 'Close', { duration: 3000 });
        }
      });
    }
  }

  deleteSong(songId: string): void {
    if (confirm('Are you sure you want to delete this song?')) {
      this.apiService.deleteSong(songId).subscribe({
        next: () => {
          this.snackBar.open('Song deleted successfully', 'Close', { duration: 3000 });
          this.loadSongs();
        },
        error: () => {
          this.snackBar.open('Failed to delete song', 'Close', { duration: 3000 });
        }
      });
    }
  }

  deleteAlbum(albumId: string): void {
    if (confirm('Are you sure you want to delete this album?')) {
      this.apiService.deleteAlbum(albumId).subscribe({
        next: () => {
          this.snackBar.open('Album deleted successfully', 'Close', { duration: 3000 });
          this.loadAlbums();
        },
        error: () => {
          this.snackBar.open('Failed to delete album', 'Close', { duration: 3000 });
        }
      });
    }
  }

  cancelArtistForm(): void {
    this.showArtistForm = false;
    this.editingArtist.set(null);
    this.artistForm.reset();
    this.artistGenres.set([]);
    this.selectedImage.set(null);
  }


  cancelAlbumForm(): void {
    this.showAlbumForm = false;
    this.editingAlbum.set(null);
    this.albumForm.reset();
    this.albumGenres.set([]);
    this.albumSongs.set([]);
    this.selectedAlbumCover.set(null);
  }

  getArtistNames(artistIds: string[]): string {
    const artistNames = artistIds.map(id => {
      const artist = this.artists().find(a => a.artistId === id);
      return artist ? artist.name : 'Unknown';
    });
    return artistNames.join(', ');
  }

  formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  // Upload component event handlers
  onSongSaved(): void {
    this.showSingleUpload = false;
    this.editingSong.set(null);
    this.loadSongs();
  }

  onSongsSaved(): void {
    this.showMultipleUpload = false;
    this.loadSongs();
  }

  onSingleUploadCancelled(): void {
    this.showSingleUpload = false;
    this.editingSong.set(null);
  }

  onMultipleUploadCancelled(): void {
    this.showMultipleUpload = false;
  }
}