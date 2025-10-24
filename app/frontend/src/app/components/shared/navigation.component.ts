import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';

import { AuthService } from '../../services/auth.service';
import { AudioPlayerService } from '../../services/audio-player.service';

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatBadgeModule,
    MatTooltipModule,
    MatDividerModule
  ],
  template: `
    <mat-toolbar color="primary" class="navbar">
      <div class="nav-container">
        <!-- Logo and Brand -->
        <div class="brand" routerLink="/">
          <mat-icon class="brand-icon">music_note</mat-icon>
          <span class="brand-text">Music Stream</span>
        </div>

        <!-- Navigation Links -->
        <nav class="nav-links">
          @if (authService.isAuthenticated()) {
            <a mat-button routerLink="/discover" routerLinkActive="active">
              <mat-icon>explore</mat-icon>
              Discover
            </a>

            <a mat-button routerLink="/subscriptions" routerLinkActive="active">
              <mat-icon>subscriptions</mat-icon>
              My Subscriptions
            </a>

            @if (authService.isAdmin()) {
              <a mat-button routerLink="/admin" routerLinkActive="active">
                <mat-icon>admin_panel_settings</mat-icon>
                Admin
              </a>
            }
          }
        </nav>

        <!-- Right Side Actions -->
        <div class="nav-actions">
          @if (!authService.isAuthenticated()) {
            <!-- Not authenticated -->
            <a mat-button routerLink="/login">Sign In</a>
            <a mat-raised-button color="accent" routerLink="/register">Sign Up</a>
          } @else {
            <!-- Authenticated -->

            <!-- Now Playing Button -->
            @if (audioPlayerService.currentSong()) {
              <button
                mat-icon-button
                class="now-playing-btn"
                [matTooltip]="'Now Playing: ' + audioPlayerService.currentSong()?.title"
                (click)="toggleMiniPlayer()">
                <mat-icon
                  [class.playing]="audioPlayerService.isPlaying()"
                  matBadge="♪"
                  matBadgeSize="small"
                  matBadgeColor="accent">
                  {{ audioPlayerService.isPlaying() ? 'pause' : 'play_arrow' }}
                </mat-icon>
              </button>
            }

            <!-- User Menu -->
            <button mat-icon-button [matMenuTriggerFor]="userMenu" class="user-menu-btn">
              <mat-icon>account_circle</mat-icon>
            </button>

            <mat-menu #userMenu="matMenu">
              <div class="user-info">
                <div class="user-name">{{ authService.currentUser()?.given_name }} {{ authService.currentUser()?.family_name }}</div>
                <div class="user-email">{{ authService.currentUser()?.email }}</div>
                @if (authService.isAdmin()) {
                  <div class="user-role">
                    <mat-icon>admin_panel_settings</mat-icon>
                    Administrator
                  </div>
                }
              </div>

              <mat-divider></mat-divider>

              <button mat-menu-item routerLink="/profile">
                <mat-icon>person</mat-icon>
                <span>Profile</span>
              </button>

              <button mat-menu-item routerLink="/settings">
                <mat-icon>settings</mat-icon>
                <span>Settings</span>
              </button>

              <mat-divider></mat-divider>

              <button mat-menu-item (click)="logout()">
                <mat-icon>logout</mat-icon>
                <span>Sign Out</span>
              </button>
            </mat-menu>
          }
        </div>
      </div>

      <!-- Mini Player (when song is playing) -->
      @if (showMiniPlayer() && audioPlayerService.currentSong()) {
        <div class="mini-player">
          <div class="song-info">
            @if (audioPlayerService.currentSong()?.coverUrl) {
              <img [src]="audioPlayerService.currentSong()?.coverUrl" alt="Cover" class="mini-cover">
            } @else {
              <div class="mini-cover-placeholder">
                <mat-icon>music_note</mat-icon>
              </div>
            }
            <div class="song-details">
              <div class="song-title">{{ audioPlayerService.currentSong()?.title }}</div>
              <div class="song-artist">{{ formatArtists(audioPlayerService.currentSong()?.artistIds || []) }}</div>
            </div>
          </div>

          <div class="player-controls">
            <button mat-icon-button (click)="audioPlayerService.togglePlayPause()">
              <mat-icon>{{ audioPlayerService.isPlaying() ? 'pause' : 'play_arrow' }}</mat-icon>
            </button>

            <div class="progress-container">
              <span class="time">{{ audioPlayerService.formatTime(audioPlayerService.currentTime()) }}</span>
              <div class="progress-bar" (click)="seekTo($event)">
                <div class="progress-fill" [style.width.%]="audioPlayerService.getProgress()"></div>
              </div>
              <span class="time">{{ audioPlayerService.formatTime(audioPlayerService.duration()) }}</span>
            </div>

            <button mat-icon-button (click)="audioPlayerService.toggleMute()">
              <mat-icon>{{ audioPlayerService.isMuted() ? 'volume_off' : 'volume_up' }}</mat-icon>
            </button>

            <button mat-icon-button (click)="closeMiniPlayer()" matTooltip="Close">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        </div>
      }
    </mat-toolbar>
  `,
  styles: [`
    .navbar {
      position: sticky;
      top: 0;
      z-index: 1000;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .nav-container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 16px;
    }

    .brand {
      display: flex;
      align-items: center;
      cursor: pointer;
      text-decoration: none;
      color: inherit;
    }

    .brand-icon {
      margin-right: 8px;
      font-size: 28px;
    }

    .brand-text {
      font-size: 20px;
      font-weight: 500;
    }

    .nav-links {
      display: flex;
      gap: 8px;
    }

    .nav-links a.active {
      background-color: rgba(255, 255, 255, 0.1);
    }

    .nav-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .now-playing-btn .mat-icon.playing {
      animation: pulse 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.1); }
      100% { transform: scale(1); }
    }

    .user-info {
      padding: 16px;
      border-bottom: 1px solid rgba(0,0,0,0.1);
    }

    .user-name {
      font-weight: 500;
      margin-bottom: 4px;
    }

    .user-email {
      font-size: 12px;
      color: rgba(0,0,0,0.6);
    }

    .user-role {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #ff9800;
      margin-top: 4px;
    }

    .user-role mat-icon {
      font-size: 16px;
    }

    /* Mini Player Styles */
    .mini-player {
      position: absolute;
      bottom: -64px;
      left: 0;
      right: 0;
      height: 64px;
      background: rgba(0, 0, 0, 0.9);
      backdrop-filter: blur(10px);
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      align-items: center;
      padding: 0 16px;
      gap: 16px;
    }

    .song-info {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
      min-width: 0;
    }

    .mini-cover,
    .mini-cover-placeholder {
      width: 40px;
      height: 40px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .mini-cover {
      object-fit: cover;
    }

    .song-details {
      min-width: 0;
      flex: 1;
    }

    .song-title {
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: white;
    }

    .song-artist {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.7);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .player-controls {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .progress-container {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 200px;
    }

    .time {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.8);
      min-width: 35px;
    }

    .progress-bar {
      flex: 1;
      height: 4px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 2px;
      cursor: pointer;
      position: relative;
    }

    .progress-fill {
      height: 100%;
      background: white;
      border-radius: 2px;
      transition: width 0.1s ease;
    }

    @media (max-width: 768px) {
      .nav-links {
        display: none;
      }

      .brand-text {
        display: none;
      }

      .progress-container {
        min-width: 120px;
      }

      .song-info {
        max-width: 150px;
      }
    }
  `]
})
export class NavigationComponent {
  public authService = inject(AuthService);
  public audioPlayerService = inject(AudioPlayerService);
  private router = inject(Router);

  public showMiniPlayer = signal(false);

  logout(): void {
    this.authService.logout().subscribe();
  }

  toggleMiniPlayer(): void {
    this.showMiniPlayer.set(!this.showMiniPlayer());
  }

  closeMiniPlayer(): void {
    this.showMiniPlayer.set(false);
  }

  formatArtists(artistIds: string[]): string {
    // In a real app, you'd look up artist names from IDs
    return artistIds.length > 0 ? `Artist ${artistIds[0]}` : 'Unknown Artist';
  }

  seekTo(event: MouseEvent): void {
    const progressBar = event.currentTarget as HTMLElement;
    const rect = progressBar.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = (clickX / rect.width) * 100;
    const newTime = (percentage / 100) * this.audioPlayerService.duration();
    this.audioPlayerService.seekTo(newTime);
  }
}