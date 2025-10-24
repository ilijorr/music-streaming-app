import { Injectable, signal, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Song } from '../models';
import { ApiService } from './api.service';

export interface PlayerState {
  isPlaying: boolean;
  currentSong: Song | null;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AudioPlayerService {
  private apiService = inject(ApiService);
  private audio: HTMLAudioElement | null = null;
  private updateInterval: any;

  // Reactive state using signals
  public isPlaying = signal(false);
  public currentSong = signal<Song | null>(null);
  public currentTime = signal(0);
  public duration = signal(0);
  public volume = signal(1);
  public isMuted = signal(false);
  public isLoading = signal(false);
  public error = signal<string | null>(null);

  // Observable state for components that prefer observables
  private stateSubject = new BehaviorSubject<PlayerState>({
    isPlaying: false,
    currentSong: null,
    currentTime: 0,
    duration: 0,
    volume: 1,
    isMuted: false
  });

  public state$ = this.stateSubject.asObservable();

  constructor() {
    this.initializeAudio();
  }

  private initializeAudio() {
    this.audio = new Audio();
    this.audio.preload = 'metadata';

    // Event listeners
    this.audio.addEventListener('loadstart', () => {
      this.isLoading.set(true);
      this.error.set(null);
    });

    this.audio.addEventListener('loadedmetadata', () => {
      this.duration.set(this.audio?.duration || 0);
      this.isLoading.set(false);
      this.updateState();
    });

    this.audio.addEventListener('play', () => {
      this.isPlaying.set(true);
      this.startTimeUpdate();
      this.updateState();
    });

    this.audio.addEventListener('pause', () => {
      this.isPlaying.set(false);
      this.stopTimeUpdate();
      this.updateState();
    });

    this.audio.addEventListener('ended', () => {
      this.isPlaying.set(false);
      this.currentTime.set(0);
      this.stopTimeUpdate();
      this.updateState();
    });

    this.audio.addEventListener('error', (e) => {
      this.isLoading.set(false);
      this.error.set('Failed to load audio');
      console.error('Audio error:', e);
    });

    this.audio.addEventListener('volumechange', () => {
      this.volume.set(this.audio?.volume || 1);
      this.isMuted.set(this.audio?.muted || false);
      this.updateState();
    });
  }

  private startTimeUpdate() {
    this.updateInterval = setInterval(() => {
      if (this.audio) {
        this.currentTime.set(this.audio.currentTime);
        this.updateState();
      }
    }, 100); // Update every 100ms for smooth progress
  }

  private stopTimeUpdate() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  private updateState() {
    this.stateSubject.next({
      isPlaying: this.isPlaying(),
      currentSong: this.currentSong(),
      currentTime: this.currentTime(),
      duration: this.duration(),
      volume: this.volume(),
      isMuted: this.isMuted()
    });
  }

  async playSong(song: Song): Promise<void> {
    try {
      this.isLoading.set(true);
      this.error.set(null);

      // Get the stream URL from the API
      const streamUrl = await this.apiService.getSongDownloadUrl(song.songId).toPromise();

      if (this.audio && streamUrl) {
        this.audio.src = streamUrl;
        this.currentSong.set(song);
        this.updateState();

        // Auto-play after loading
        this.audio.addEventListener('canplay', () => {
          this.play();
        }, { once: true });
      }
    } catch (error) {
      this.error.set('Failed to load song');
      this.isLoading.set(false);
      console.error('Error loading song:', error);
    }
  }

  async loadSong(song: Song, streamUrl: string): Promise<void> {
    try {
      if (this.audio) {
        this.audio.src = streamUrl;
        this.currentSong.set(song);
        this.error.set(null);
        this.updateState();
      }
    } catch (error) {
      this.error.set('Failed to load song');
      console.error('Error loading song:', error);
    }
  }

  play(): void {
    if (this.audio && !this.isLoading()) {
      this.audio.play().catch(error => {
        this.error.set('Failed to play audio');
        console.error('Play error:', error);
      });
    }
  }

  pause(): void {
    if (this.audio) {
      this.audio.pause();
    }
  }

  togglePlayPause(): void {
    if (this.isPlaying()) {
      this.pause();
    } else {
      this.play();
    }
  }

  stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.currentTime.set(0);
    }
  }

  seekTo(time: number): void {
    if (this.audio && time >= 0 && time <= this.duration()) {
      this.audio.currentTime = time;
      this.currentTime.set(time);
    }
  }

  setVolume(volume: number): void {
    if (this.audio && volume >= 0 && volume <= 1) {
      this.audio.volume = volume;
    }
  }

  toggleMute(): void {
    if (this.audio) {
      this.audio.muted = !this.audio.muted;
    }
  }

  // Utility methods
  formatTime(seconds: number): string {
    if (isNaN(seconds)) return '0:00';

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  getProgress(): number {
    const duration = this.duration();
    const currentTime = this.currentTime();
    return duration > 0 ? (currentTime / duration) * 100 : 0;
  }

  // Cleanup
  destroy(): void {
    this.stopTimeUpdate();
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
    }
  }
}