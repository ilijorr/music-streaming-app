import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AlbumService, AlbumResponse, UpdateAlbumRequest } from '../../services/album.service';
import { ArtistService } from '../../services/artist.service';

@Component({
  selector: 'app-edit-album',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './edit-album.component.html',
  styleUrl: './edit-album.component.css'
})
export class EditAlbumComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly albumService = inject(AlbumService);
  private readonly artistService = inject(ArtistService);

  protected readonly loading = signal<boolean>(false);
  protected readonly saving = signal<boolean>(false);
  protected readonly error = signal<string | null>(null);
  protected readonly album = signal<AlbumResponse | null>(null);
  protected readonly allArtists = signal<Array<{ id: string; name: string }>>([]);
  protected readonly availableGenres = ['Rock', 'Pop', 'Jazz', 'Classical', 'Hip Hop', 'Electronic', 'R&B', 'Country', 'Metal', 'Folk'];

  protected readonly editForm: FormGroup = this.fb.group({
    title: ['', Validators.required],
    artistIds: [[], Validators.required],
    genres: [[], Validators.required],
    releaseDate: ['', Validators.required],
    coverImageFile: [null]
  });

  ngOnInit(): void {
    const albumId = this.route.snapshot.paramMap.get('id');

    if (!albumId) {
      this.error.set('No album ID provided');
      return;
    }

    this.loadArtists();
    this.loadAlbum(albumId);
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

  private loadAlbum(albumId: string): void {
    this.loading.set(true);

    this.albumService.getAlbum(albumId).subscribe({
      next: (response) => {
        this.album.set(response.album);

        // Populate form with existing data
        this.editForm.patchValue({
          title: response.album.title,
          artistIds: response.album.artistIds,
          genres: response.album.genres,
          releaseDate: response.album.releaseDate
        });

        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading album:', error);
        this.error.set('Failed to load album');
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
    if (this.editForm.invalid || !this.album()) {
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    try {
      const formValue = this.editForm.value;
      const updateRequest: UpdateAlbumRequest = {
        title: formValue.title,
        artistIds: formValue.artistIds,
        genres: formValue.genres,
        releaseDate: formValue.releaseDate
      };

      // Handle cover image if provided
      if (formValue.coverImageFile) {
        const coverBase64 = await this.albumService.fileToBase64(formValue.coverImageFile);
        updateRequest.coverImageBase64 = coverBase64;
      }

      this.albumService.updateAlbum(this.album()!.albumId, updateRequest).subscribe({
        next: (response) => {
          console.log('Album updated successfully', response);
          this.saving.set(false);
          // Navigate back to browse page
          this.router.navigate(['/music/browse']);
        },
        error: (error) => {
          console.error('Error updating album:', error);
          this.error.set(`Failed to update album: ${error.message || 'Unknown error'}`);
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
