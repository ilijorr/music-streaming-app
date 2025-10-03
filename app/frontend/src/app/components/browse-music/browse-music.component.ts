import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MusicCardComponent } from '../music-card/music-card.component';
import { AlbumCardComponent } from '../album-card/album-card.component';
import { AuthService } from '../../services/auth.service';
import { SongService, SongData } from '../../services/song.service';
import { AlbumService, AlbumResponse } from '../../services/album.service';
import { ArtistService } from '../../services/artist.service';

type ArtistDetail = {
  id: string;
  name: string;
  genres: string[];
};

type ArtistSummary = ArtistDetail & {
  songCount: number;
  albumCount: number;
};

@Component({
  selector: 'app-browse-music',
  imports: [CommonModule, MusicCardComponent, AlbumCardComponent],
  templateUrl: './browse-music.component.html',
  styleUrl: './browse-music.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BrowseMusicComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly songService = inject(SongService);
  private readonly albumService = inject(AlbumService);
  private readonly artistService = inject(ArtistService);
  private readonly router = inject(Router);

  protected readonly songs = signal<SongData[]>([]);
  protected readonly albums = signal<AlbumResponse[]>([]);
  protected readonly loading = signal<boolean>(false);
  protected readonly error = signal<string | null>(null);
  protected readonly viewMode = signal<'songs' | 'albums' | 'artists'>('songs');
  protected readonly selectedAlbum = signal<AlbumResponse | null>(null);
  protected readonly albumSongs = signal<SongData[]>([]);
  protected readonly selectedArtistDetail = signal<ArtistDetail | null>(null);
  protected readonly artistSongs = signal<SongData[]>([]);
  protected readonly artistAlbums = signal<AlbumResponse[]>([]);

  protected readonly currentlyPlaying = signal<SongData | null>(null);
  protected readonly audioElement = signal<HTMLAudioElement | null>(null);

  protected readonly currentUser = this.authService.currentUser;
  protected readonly isAdmin = computed(() => this.authService.isAdmin());

  protected readonly totalSongs = computed(() => this.songs().length);
  protected readonly totalAlbums = computed(() => this.albums().length);
  protected readonly totalArtists = computed(() => this.artistSummaries().length);

  protected readonly artistSummaries = computed<ArtistSummary[]>(() => {
    const songs = this.songs();
    const albums = this.albums();
    const artistIds = new Set<string>();

    songs.forEach(song => song.artistIds.forEach(id => artistIds.add(id)));
    albums.forEach(album => album.artistIds.forEach(id => artistIds.add(id)));

    return Array.from(artistIds)
      .map(id => {
        const artistSongs = songs.filter(song => song.artistIds.includes(id));
        const artistAlbums = albums.filter(album => album.artistIds.includes(id));
        const genres = new Set<string>();
        artistSongs.forEach(song => song.genres.forEach(genre => genres.add(genre)));

        return {
          id,
          name: this.artistService.getCachedArtistName(id),
          genres: Array.from(genres),
          songCount: artistSongs.length,
          albumCount: artistAlbums.length
        } satisfies ArtistSummary;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  ngOnInit(): void {
    this.artistService.listArtists().subscribe({
      next: () => {
        console.log('Artists loaded and cached');
        console.log(this.artistService.listArtists())
      },
      error: (error) => {
        console.error('Error loading artists:', error);
      }
    });

    this.loadSongs();
    this.loadAlbums();
  }

  protected getArtistNames(artistIds: string[]): string {
    return artistIds
      .map(id => this.artistService.getCachedArtistName(id))
      .join(', ');
  }

  private loadSongs(): void {
    this.loading.set(true);
    this.songService.listSongs().subscribe({
      next: (response) => {
        this.songs.set(response.songs);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading songs:', error);
        this.error.set('Failed to load songs');
        this.loading.set(false);
      }
    });
  }

  private loadAlbums(): void {
    this.albumService.listAlbums().subscribe({
      next: (response) => {
        this.albums.set(response.albums);
      },
      error: (error) => {
        console.error('Error loading albums:', error);
      }
    });
  }

  protected setViewMode(mode: 'songs' | 'albums' | 'artists'): void {
    this.viewMode.set(mode);
    if (mode !== 'albums') {
      this.closeAlbumView();
    }
    if (mode !== 'artists') {
      this.closeArtistView();
    }
  }

  protected async onPlayTrack(song: SongData): Promise<void> {
    const currentAudio = this.audioElement();
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const urlResponse = await this.songService.getDownloadUrl(song.songId).toPromise();

      if (!urlResponse) {
        throw new Error('Failed to get download URL');
      }

      const audio = new Audio(urlResponse.downloadUrl);

      audio.addEventListener('loadedmetadata', () => {
        console.log(`Playing: ${song.title} - Duration: ${audio.duration}s`);
        this.loading.set(false);
      });

      audio.addEventListener('ended', () => {
        this.currentlyPlaying.set(null);
        this.audioElement.set(null);
      });

      audio.addEventListener('error', (e) => {
        console.error('Audio playback error:', e);
        this.error.set('Failed to play audio');
        this.currentlyPlaying.set(null);
        this.audioElement.set(null);
        this.loading.set(false);
      });

      this.audioElement.set(audio);
      this.currentlyPlaying.set(song);

      await audio.play();
    } catch (err) {
      console.error('Failed to play audio:', err);
      this.error.set('Failed to load audio file');
      this.currentlyPlaying.set(null);
      this.audioElement.set(null);
      this.loading.set(false);
    }
  }

  protected stopPlayback(): void {
    const audio = this.audioElement();
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    this.currentlyPlaying.set(null);
    this.audioElement.set(null);
  }

  protected async logout(): Promise<void> {
    try {
      await this.authService.signOut();
      this.router.navigate(['/auth/login']);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  protected navigateToUpload(): void {
    this.router.navigate(['/music/upload']);
  }

  protected navigateToCreateArtist(): void {
    this.router.navigate(['/artists/create']);
  }

  protected onViewAlbum(album: AlbumResponse): void {
    this.selectedAlbum.set(album);
    this.loading.set(true);
    this.error.set(null);

    console.log('Loading songs for album:', album.albumId);

    this.albumService.getAlbumSongs(album.albumId).subscribe({
      next: (response) => {
        console.log('Album songs loaded:', response);
        this.albumSongs.set(response.songs);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading album songs:', error);
        console.error('Error status:', error.status);
        console.error('Error message:', error.message);
        this.error.set(`Failed to load album songs: ${error.status} ${error.statusText}`);
        this.loading.set(false);
      }
    });
  }

  protected closeAlbumView(): void {
    this.selectedAlbum.set(null);
    this.albumSongs.set([]);
  }

  protected onViewArtist(artist: ArtistSummary): void {
    this.selectedArtistDetail.set(artist);
    this.loading.set(true);

    const artistSongsFiltered = this.songs().filter(song => song.artistIds.includes(artist.id));
    this.artistSongs.set(artistSongsFiltered);

    const artistAlbumsFiltered = this.albums().filter(album => album.artistIds.includes(artist.id));
    this.artistAlbums.set(artistAlbumsFiltered);

    this.loading.set(false);
  }

  protected closeArtistView(): void {
    this.selectedArtistDetail.set(null);
    this.artistSongs.set([]);
    this.artistAlbums.set([]);
  }

  protected onViewAlbumFromArtist(album: AlbumResponse): void {
    this.onViewAlbum(album);
  }
}

