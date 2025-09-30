import { Component, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { inject } from '@angular/core';
import { Artist } from '../../models/artist.interface';

@Component({
  selector: 'app-create-artist',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './create-artist.component.html',
  styleUrl: './create-artist.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CreateArtistComponent {
  private readonly fb = inject(FormBuilder);

  protected readonly selectedPhoto = signal<File | null>(null);
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

    if (file && file.type.startsWith('image/')) {
      this.selectedPhoto.set(file);
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

  protected onSubmit(): void {
    if (this.artistForm.valid && this.selectedPhoto()) {
      const formValue = this.artistForm.value;
      const artist: Artist = {
        name: formValue.name,
        biography: formValue.biography,
        photo: this.selectedPhoto()!,
        genres: formValue.genres.filter((genre: string) => genre.trim())
      };

      console.log('Artist to create:', artist);
      // TODO: Implement artist creation service call
    }
  }
}