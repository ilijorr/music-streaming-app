import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SongService, SongData, UpdateSongRequest } from '../../services/song.service';
import { ArtistService } from '../../services/artist.service';
import { AlbumService } from '../../services/album.service';

@Component({
  selector: 'app-edit-song',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './edit-song.component.html',
  styleUrl: './edit-song.component.css'
})
export class EditSongComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly songService = inject(SongService);
  private readonly artistService = inject(ArtistService);
  private readonly albumService = inject(AlbumService);

  protected readonly loading = signal<boolean>(false);
  protected readonly saving = signal<boolean>(false);
  protected readonly error = signal<string | null>(null);
  protected readonly song = signal<SongData | null>(null);
  protected readonly allArtists = signal<Array<{ id: string; name: string }>>([]);
  protected readonly allAlbums = signal<Array<{ id: string; title: string }>>([]);
  protected readonly availableGenres = ['Rock', 'Pop', 'Jazz', 'Classical', 'Hip Hop', 'Electronic', 'R&B', 'Country', 'Metal', 'Folk'];

  protected readonly editForm: FormGroup = this.fb.group({
    title: ['', Validators.required],
    artistIds: [[], Validators.required],
    genres: [[], Validators.required],
    albumId: [''],
    featuringArtists: [[]],
    coverImageFile: [null]
  });

  ngOnInit(): void {
    const songId = this.route.snapshot.paramMap.get('id');

    if (!songId) {
      this.error.set('No song ID provided');
      return;
    }

    this.loadArtists();
    this.loadAlbums();
    this.loadSong(songId);
  }

  private loadArtists(): void {
    this.artistService.listArtists().subscribe({
      next: (response) => {
        this.allArtists.set(response.artists.map(a => ({ id: a.artistId, name: a.name })));
      },
      error: (error) => {
        console.error('Error loading artists:', error);
      }
    });
  }

  private loadAlbums(): void {
    this.albumService.listAlbums().subscribe({
      next: (response) => {
        this.allAlbums.set(response.albums.map(a => ({ id: a.albumId, title: a.title })));
      },
      error: (error) => {
        console.error('Error loading albums:', error);
      }
    });
  }

  private loadSong(songId: string): void {
    this.loading.set(true);

    this.songService.getSong(songId).subscribe({
      next: (response) => {
        this.song.set(response.song);

        // Populate form with existing data
        this.editForm.patchValue({
          title: response.song.title,
          artistIds: response.song.artistIds,
          genres: response.song.genres,
          albumId: response.song.albumId || '',
          featuringArtists: response.song.featuringArtists || []
        });

        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading song:', error);
        this.error.set('Failed to load song');
        this.loading.set(false);
      }
    });
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.editForm.patchValue({ coverImageFile: input.files[0] });
    }
  }

  protected async onSubmit(): Promise<void> {
    if (this.editForm.invalid || !this.song()) {
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    try {
      const formValue = this.editForm.value;
      const updateRequest: UpdateSongRequest = {
        title: formValue.title,
        artistIds: formValue.artistIds,
        genres: formValue.genres,
        albumId: formValue.albumId || undefined,
        featuringArtists: formValue.featuringArtists
      };

      // Handle cover image if provided
      if (formValue.coverImageFile) {
        const coverBase64 = await this.songService.fileToBase64(formValue.coverImageFile);
        updateRequest.coverImageBase64 = coverBase64;
      }

      this.songService.updateSong(this.song()!.songId, updateRequest).subscribe({
        next: (response) => {
          console.log('Song updated successfully', response);
          this.saving.set(false);
          // Navigate back to browse page
          this.router.navigate(['/music/browse']);
        },
        error: (error) => {
          console.error('Error updating song:', error);
          this.error.set(`Failed to update song: ${error.message || 'Unknown error'}`);
          this.saving.set(false);
        }
      });
    } catch (error: any) {
      console.error('Error processing update:', error);
      this.error.set(`Error: ${error.message}`);
      this.saving.set(false);
    }
  }

  protected cancel(): void {
    this.router.navigate(['/music/browse']);
  }

  protected toggleArtist(artistId: string): void {
    const currentArtists = this.editForm.value.artistIds || [];
    const index = currentArtists.indexOf(artistId);

    if (index > -1) {
      currentArtists.splice(index, 1);
    } else {
      currentArtists.push(artistId);
    }

    this.editForm.patchValue({ artistIds: [...currentArtists] });
  }

  protected toggleGenre(genre: string): void {
    const currentGenres = this.editForm.value.genres || [];
    const index = currentGenres.indexOf(genre);

    if (index > -1) {
      currentGenres.splice(index, 1);
    } else {
      currentGenres.push(genre);
    }

    this.editForm.patchValue({ genres: [...currentGenres] });
  }

  protected isArtistSelected(artistId: string): boolean {
    return (this.editForm.value.artistIds || []).includes(artistId);
  }

  protected isGenreSelected(genre: string): boolean {
    return (this.editForm.value.genres || []).includes(genre);
  }
}
