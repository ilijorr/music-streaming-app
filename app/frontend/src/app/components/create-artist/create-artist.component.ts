import { Component, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Artist, CreateArtistRequest } from '../../models/artist.interface';
import { ArtistService } from '../../services/artist.service';

@Component({
  selector: 'app-create-artist',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './create-artist.component.html',
  styleUrl: './create-artist.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CreateArtistComponent {
  private readonly fb = inject(FormBuilder);
  private readonly artistService = inject(ArtistService);
  private readonly router = inject(Router);

  protected readonly selectedPhoto = signal<File | null>(null);
  protected readonly loading = signal<boolean>(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<boolean>(false);

  protected readonly photoPreview = computed(() => {
    const photo = this.selectedPhoto();
    return photo ? URL.createObjectURL(photo) : null;
  });

  protected readonly artistForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    biography: ['', [Validators.required, Validators.minLength(10)]],
    genres: this.fb.array([this.fb.control('', Validators.required)])
  });

  protected get genres(): FormArray {
    return this.artistForm.get('genres') as FormArray;
  }

  protected onPhotoSelected(event: Event): void {
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

      this.selectedPhoto.set(file);
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
    if (!this.artistForm.valid || !this.selectedPhoto()) {
      this.error.set('Please fill in all required fields and select a photo');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.success.set(false);

    try {
      const formValue = this.artistForm.value;
      const photo = this.selectedPhoto()!;

      // Convert photo to base64
      const imageBase64 = await this.artistService.fileToBase64(photo);

      // Prepare request payload
      const request: CreateArtistRequest = {
        name: formValue.name.trim(),
        biography: formValue.biography.trim(),
        genres: formValue.genres
          .map((genre: string) => genre.trim())
          .filter((genre: string) => genre.length > 0),
        imageBase64
      };

      // Call API
      this.artistService.createArtist(request).subscribe({
        next: (response) => {
          console.log('Artist created successfully:', response);
          this.success.set(true);
          this.loading.set(false);

          // Reset form
          this.artistForm.reset();
          this.selectedPhoto.set(null);

          // Redirect to browse music after 2 seconds
          setTimeout(() => {
            this.router.navigate(['/browse-music']);
          }, 2000);
        },
        error: (err) => {
          console.error('Error creating artist:', err);
          this.loading.set(false);

          // Handle different error status codes
          if (err.status === 401) {
            this.error.set('You are not authenticated. Please log in.');
          } else if (err.status === 403) {
            this.error.set('Access denied. Only administrators can create artists.');
          } else if (err.status === 400) {
            this.error.set('Invalid input. Please check your data and try again.');
          } else {
            this.error.set('An error occurred while creating the artist. Please try again.');
          }
        }
      });
    } catch (err) {
      console.error('Error converting image to base64:', err);
      this.loading.set(false);
      this.error.set('Failed to process image. Please try again.');
    }
  }
}