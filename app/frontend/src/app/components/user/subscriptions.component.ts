import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';

import { ApiService } from '../../services/api.service';
import { AudioPlayerService } from '../../services/audio-player.service';
import { Artist } from '../../models/artist.model';
import { Subscription } from '../../models/subscription.model';
import { Song } from '../../models/song.model';
import { Album } from '../../models/album.model';
import { Notification } from '../../models/notification.model';

@Component({
  selector: 'app-subscriptions',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTabsModule,
    MatBadgeModule,
    MatDialogModule,
    MatListModule,
    MatDividerModule
  ],
  template: `
    <div class="subscriptions-container">
      <div class="header">
        <h1>My Subscriptions</h1>
        <p>Manage your artist subscriptions and stay updated with new releases</p>
      </div>

      <mat-tab-group>
        <!-- Subscribed Artists Tab -->
        <mat-tab label="Subscribed Artists" [matBadge]="subscriptions().length" matBadgeColor="accent">
          <div class="tab-content">
            @if (loadingSubscriptions()) {
              <div class="loading">
                <mat-spinner></mat-spinner>
              </div>
            } @else if (subscriptions().length === 0) {
              <div class="empty-state">
                <mat-icon class="empty-icon">subscriptions</mat-icon>
                <h2>No Subscriptions Yet</h2>
                <p>You haven't subscribed to any artists yet. Discover new artists and subscribe to get notified about their new releases.</p>
                <button mat-raised-button color="primary" routerLink="/discover">
                  <mat-icon>explore</mat-icon>
                  Discover Artists
                </button>
              </div>
            } @else {
              <div class="artists-grid">
                @for (subscription of subscriptions(); track subscription.subscriptionId) {
                  <mat-card class="artist-subscription-card">
                    <div class="artist-header">
                      <div class="artist-image">
                        @if (getArtist(subscription.artistId)?.imageUrl) {
                          <img [src]="getArtist(subscription.artistId)?.imageUrl" [alt]="getArtist(subscription.artistId)?.name">
                        } @else {
                          <div class="image-placeholder">
                            <mat-icon>person</mat-icon>
                          </div>
                        }
                      </div>
                      <div class="subscription-info">
                        <h3>{{ getArtist(subscription.artistId)?.name }}</h3>
                        <p class="subscription-date">Subscribed on {{ formatDate(subscription.createdAt) }}</p>
                        <div class="notification-settings">
                          <mat-icon [class.enabled]="subscription.emailNotifications">email</mat-icon>
                          <mat-icon [class.enabled]="subscription.inAppNotifications">notifications</mat-icon>
                        </div>
                      </div>
                    </div>

                    <mat-card-content>
                      <div class="artist-genres">
                        @for (genre of getArtist(subscription.artistId)?.genres; track genre) {
                          <mat-chip>{{ genre }}</mat-chip>
                        }
                      </div>

                      @if (getArtist(subscription.artistId)?.biography) {
                        <p class="artist-bio">{{ getArtist(subscription.artistId)?.biography | slice:0:120 }}...</p>
                      }

                      <div class="subscription-stats">
                        <div class="stat">
                          <mat-icon>library_music</mat-icon>
                          <span>{{ getArtistSongCount(subscription.artistId) }} songs</span>
                        </div>
                        <div class="stat">
                          <mat-icon>album</mat-icon>
                          <span>{{ getArtistAlbumCount(subscription.artistId) }} albums</span>
                        </div>
                      </div>
                    </mat-card-content>

                    <mat-card-actions>
                      <button mat-button (click)="viewArtistContent(subscription.artistId)">
                        <mat-icon>library_music</mat-icon>
                        View Content
                      </button>
                      <button mat-button (click)="toggleNotificationSettings(subscription)">
                        <mat-icon>settings</mat-icon>
                        Settings
                      </button>
                      <button mat-button color="warn" (click)="unsubscribe(subscription)">
                        <mat-icon>unsubscribe</mat-icon>
                        Unsubscribe
                      </button>
                    </mat-card-actions>
                  </mat-card>
                }
              </div>
            }
          </div>
        </mat-tab>

        <!-- Notifications Tab -->
        <mat-tab label="Notifications" [matBadge]="unreadNotifications().length" matBadgeColor="accent">
          <div class="tab-content">
            <div class="notifications-header">
              <h2>Recent Notifications</h2>
              @if (unreadNotifications().length > 0) {
                <button mat-button (click)="markAllAsRead()">
                  <mat-icon>done_all</mat-icon>
                  Mark All as Read
                </button>
              }
            </div>

            @if (loadingNotifications()) {
              <div class="loading">
                <mat-spinner></mat-spinner>
              </div>
            } @else if (notifications().length === 0) {
              <div class="empty-state">
                <mat-icon class="empty-icon">notifications</mat-icon>
                <h2>No Notifications</h2>
                <p>You don't have any notifications yet. Subscribe to artists to receive updates about their new releases.</p>
              </div>
            } @else {
              <mat-list class="notifications-list">
                @for (notification of notifications(); track notification.notificationId) {
                  <mat-list-item [class.unread]="!notification.read" (click)="markAsRead(notification)">
                    <div matListItemAvatar>
                      <mat-icon [class.new-release]="notification.type === 'new_release'">
                        {{ getNotificationIcon(notification.type) }}
                      </mat-icon>
                    </div>
                    <div matListItemTitle>{{ notification.title }}</div>
                    <div matListItemLine>{{ notification.message }}</div>
                    <div matListItemMeta class="notification-time">
                      {{ formatNotificationTime(notification.createdAt) }}
                    </div>
                  </mat-list-item>
                  <mat-divider></mat-divider>
                }
              </mat-list>

              @if (notifications().length >= 20) {
                <div class="load-more">
                  <button mat-button (click)="loadMoreNotifications()">
                    Load More Notifications
                  </button>
                </div>
              }
            }
          </div>
        </mat-tab>

        <!-- New Releases Tab -->
        <mat-tab label="New Releases">
          <div class="tab-content">
            <h2>Latest from Your Subscribed Artists</h2>

            @if (loadingNewReleases()) {
              <div class="loading">
                <mat-spinner></mat-spinner>
              </div>
            } @else if (newReleases().length === 0) {
              <div class="empty-state">
                <mat-icon class="empty-icon">new_releases</mat-icon>
                <h2>No New Releases</h2>
                <p>No new releases from your subscribed artists yet. Check back later for updates!</p>
              </div>
            } @else {
              <div class="releases-section">
                <!-- New Songs -->
                @if (newSongs().length > 0) {
                  <div class="release-category">
                    <h3>New Songs</h3>
                    <div class="songs-grid">
                      @for (song of newSongs(); track song.songId) {
                        <mat-card class="release-card">
                          <div class="release-cover">
                            @if (song.coverUrl) {
                              <img [src]="song.coverUrl" [alt]="song.title">
                            } @else {
                              <div class="cover-placeholder">
                                <mat-icon>music_note</mat-icon>
                              </div>
                            }
                            <div class="play-overlay">
                              <button mat-fab color="primary" (click)="playSong(song)">
                                <mat-icon>play_arrow</mat-icon>
                              </button>
                            </div>
                          </div>
                          <mat-card-content>
                            <h4>{{ song.title }}</h4>
                            <p>{{ getArtistNames(song.artistIds) }}</p>
                            <p class="release-date">{{ formatDate(song.createdAt) }}</p>
                          </mat-card-content>
                        </mat-card>
                      }
                    </div>
                  </div>
                }

                <!-- New Albums -->
                @if (newAlbums().length > 0) {
                  <div class="release-category">
                    <h3>New Albums</h3>
                    <div class="albums-grid">
                      @for (album of newAlbums(); track album.albumId) {
                        <mat-card class="release-card">
                          <div class="release-cover">
                            @if (album.coverUrl) {
                              <img [src]="album.coverUrl" [alt]="album.title">
                            } @else {
                              <div class="cover-placeholder">
                                <mat-icon>album</mat-icon>
                              </div>
                            }
                            <div class="play-overlay">
                              <button mat-fab color="primary" (click)="playAlbum(album)">
                                <mat-icon>play_arrow</mat-icon>
                              </button>
                            </div>
                          </div>
                          <mat-card-content>
                            <h4>{{ album.title }}</h4>
                            <p>{{ getArtistNames(album.artistIds) }}</p>
                            <p class="release-date">{{ formatDate(album.createdAt) }}</p>
                            <p class="song-count">{{ album.songIds?.length || 0 }} songs</p>
                          </mat-card-content>
                        </mat-card>
                      }
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    .subscriptions-container {
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .header {
      margin-bottom: 32px;
      text-align: center;
    }

    .header h1 {
      margin-bottom: 8px;
      color: #333;
    }

    .header p {
      color: #666;
      font-size: 1.1rem;
    }

    .tab-content {
      padding: 24px 0;
    }

    .loading {
      display: flex;
      justify-content: center;
      padding: 40px;
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #666;
    }

    .empty-icon {
      font-size: 72px;
      width: 72px;
      height: 72px;
      margin-bottom: 24px;
      color: #ccc;
    }

    .empty-state h2 {
      margin-bottom: 16px;
      color: #333;
    }

    .empty-state p {
      margin-bottom: 24px;
      max-width: 400px;
      margin-left: auto;
      margin-right: auto;
      line-height: 1.5;
    }

    .artists-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 24px;
    }

    .artist-subscription-card {
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .artist-subscription-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    }

    .artist-header {
      display: flex;
      gap: 16px;
      padding: 16px;
      align-items: center;
    }

    .artist-image {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      overflow: hidden;
      flex-shrink: 0;
    }

    .artist-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .image-placeholder {
      width: 100%;
      height: 100%;
      background: #f5f5f5;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #999;
    }

    .subscription-info h3 {
      margin: 0 0 4px 0;
      font-weight: 500;
    }

    .subscription-date {
      font-size: 0.9rem;
      color: #666;
      margin: 0 0 8px 0;
    }

    .notification-settings {
      display: flex;
      gap: 8px;
    }

    .notification-settings mat-icon {
      font-size: 18px;
      color: #ccc;
    }

    .notification-settings mat-icon.enabled {
      color: #1976d2;
    }

    .artist-genres {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-bottom: 12px;
    }

    .artist-bio {
      font-size: 0.9rem;
      color: #666;
      line-height: 1.4;
      margin-bottom: 16px;
    }

    .subscription-stats {
      display: flex;
      gap: 24px;
    }

    .stat {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.9rem;
      color: #666;
    }

    .stat mat-icon {
      font-size: 18px;
    }

    .notifications-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }

    .notifications-list {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .notifications-list mat-list-item {
      cursor: pointer;
      transition: background-color 0.2s ease;
    }

    .notifications-list mat-list-item:hover {
      background-color: #f5f5f5;
    }

    .notifications-list mat-list-item.unread {
      background-color: #e3f2fd;
      font-weight: 500;
    }

    .notification-time {
      font-size: 0.8rem;
      color: #999;
    }

    .new-release {
      color: #ff5722 !important;
    }

    .load-more {
      text-align: center;
      padding: 16px;
    }

    .releases-section {
      margin-top: 24px;
    }

    .release-category {
      margin-bottom: 48px;
    }

    .release-category h3 {
      margin-bottom: 24px;
      color: #333;
      border-bottom: 2px solid #1976d2;
      padding-bottom: 8px;
    }

    .songs-grid,
    .albums-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 24px;
    }

    .release-card {
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .release-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    }

    .release-cover {
      position: relative;
      width: 100%;
      height: 200px;
      overflow: hidden;
      border-radius: 4px;
    }

    .release-cover img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .cover-placeholder {
      width: 100%;
      height: 100%;
      background: #f5f5f5;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #999;
    }

    .cover-placeholder mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
    }

    .play-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .release-card:hover .play-overlay {
      opacity: 1;
    }

    .release-card h4 {
      margin: 8px 0 4px 0;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .release-card p {
      font-size: 0.9rem;
      color: #666;
      margin: 4px 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .release-date {
      font-weight: 500;
      color: #1976d2 !important;
    }

    @media (max-width: 768px) {
      .subscriptions-container {
        padding: 16px;
      }

      .artists-grid {
        grid-template-columns: 1fr;
      }

      .artist-header {
        flex-direction: column;
        text-align: center;
      }

      .subscription-stats {
        justify-content: center;
      }

      .notifications-header {
        flex-direction: column;
        gap: 16px;
        align-items: stretch;
      }

      .songs-grid,
      .albums-grid {
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 16px;
      }
    }
  `]
})
export class SubscriptionsComponent implements OnInit {
  private apiService = inject(ApiService);
  private audioPlayerService = inject(AudioPlayerService);
  private snackBar = inject(MatSnackBar);

  public subscriptions = signal<Subscription[]>([]);
  public notifications = signal<Notification[]>([]);
  public artists = signal<Artist[]>([]);
  public newReleases = signal<(Song | Album)[]>([]);

  public loadingSubscriptions = signal(false);
  public loadingNotifications = signal(false);
  public loadingNewReleases = signal(false);

  public unreadNotifications = signal<Notification[]>([]);
  public newSongs = signal<Song[]>([]);
  public newAlbums = signal<Album[]>([]);

  ngOnInit(): void {
    this.loadSubscriptions();
    this.loadNotifications();
    this.loadNewReleases();
    this.loadArtists();
  }

  loadSubscriptions(): void {
    this.loadingSubscriptions.set(true);
    this.apiService.getUserSubscriptions().subscribe({
      next: (subscriptions) => {
        this.subscriptions.set(subscriptions);
        this.loadingSubscriptions.set(false);
      },
      error: () => {
        this.loadingSubscriptions.set(false);
      }
    });
  }

  loadNotifications(): void {
    this.loadingNotifications.set(true);
    this.apiService.getUserNotifications().subscribe({
      next: (notifications) => {
        this.notifications.set(notifications);
        this.unreadNotifications.set(notifications.filter(n => !n.read));
        this.loadingNotifications.set(false);
      },
      error: () => {
        this.loadingNotifications.set(false);
      }
    });
  }

  loadNewReleases(): void {
    this.loadingNewReleases.set(true);

    // Load new songs and albums from subscribed artists
    Promise.all([
      this.apiService.getSongs().toPromise(),
      this.apiService.getAlbums().toPromise()
    ]).then(([songs, albums]) => {
      const subscribedArtistIds = this.subscriptions().map(s => s.artistId);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentSongs = (songs || []).filter(song =>
        song.artistIds.some(id => subscribedArtistIds.includes(id)) &&
        new Date(song.createdAt) > sevenDaysAgo
      );

      const recentAlbums = (albums || []).filter(album =>
        album.artistIds.some(id => subscribedArtistIds.includes(id)) &&
        new Date(album.createdAt) > sevenDaysAgo
      );

      this.newSongs.set(recentSongs);
      this.newAlbums.set(recentAlbums);
      this.newReleases.set([...recentSongs, ...recentAlbums]);
      this.loadingNewReleases.set(false);
    }).catch(() => {
      this.loadingNewReleases.set(false);
    });
  }

  loadArtists(): void {
    this.apiService.getArtists().subscribe({
      next: (artists) => {
        this.artists.set(artists);
      }
    });
  }

  getArtist(artistId: string): Artist | undefined {
    return this.artists().find(a => a.artistId === artistId);
  }

  getArtistSongCount(artistId: string): number {
    // This would be implemented by calling the API
    return 0;
  }

  getArtistAlbumCount(artistId: string): number {
    // This would be implemented by calling the API
    return 0;
  }

  unsubscribe(subscription: Subscription): void {
    if (confirm(`Are you sure you want to unsubscribe from ${this.getArtist(subscription.artistId)?.name}?`)) {
      this.apiService.unsubscribeFromArtist(subscription.artistId).subscribe({
        next: () => {
          this.subscriptions.update(subs => subs.filter(s => s.subscriptionId !== subscription.subscriptionId));
          this.snackBar.open('Successfully unsubscribed', 'Close', { duration: 3000 });
        },
        error: () => {
          this.snackBar.open('Failed to unsubscribe', 'Close', { duration: 3000 });
        }
      });
    }
  }

  toggleNotificationSettings(subscription: Subscription): void {
    const updatedSubscription = {
      ...subscription,
      emailNotifications: !subscription.emailNotifications,
      inAppNotifications: !subscription.inAppNotifications
    };

    this.apiService.updateSubscription(subscription.subscriptionId, updatedSubscription).subscribe({
      next: () => {
        this.subscriptions.update(subs =>
          subs.map(s => s.subscriptionId === subscription.subscriptionId ? updatedSubscription : s)
        );
        this.snackBar.open('Notification settings updated', 'Close', { duration: 3000 });
      },
      error: () => {
        this.snackBar.open('Failed to update settings', 'Close', { duration: 3000 });
      }
    });
  }

  viewArtistContent(artistId: string): void {
    // Navigate to discover page filtered by this artist
    // This would be implemented by the router
    console.log('Viewing content for artist:', artistId);
  }

  markAsRead(notification: Notification): void {
    if (!notification.read) {
      this.apiService.markNotificationAsRead(notification.notificationId).subscribe({
        next: () => {
          this.notifications.update(notifications =>
            notifications.map(n => n.notificationId === notification.notificationId ? { ...n, read: true } : n)
          );
          this.unreadNotifications.update(unread => unread.filter(n => n.notificationId !== notification.notificationId));
        }
      });
    }
  }

  markAllAsRead(): void {
    this.apiService.markAllNotificationsAsRead().subscribe({
      next: () => {
        this.notifications.update(notifications =>
          notifications.map(n => ({ ...n, read: true }))
        );
        this.unreadNotifications.set([]);
        this.snackBar.open('All notifications marked as read', 'Close', { duration: 3000 });
      },
      error: () => {
        this.snackBar.open('Failed to mark notifications as read', 'Close', { duration: 3000 });
      }
    });
  }

  loadMoreNotifications(): void {
    // This would implement pagination for notifications
    console.log('Loading more notifications');
  }

  playSong(song: Song): void {
    this.audioPlayerService.playSong(song);
  }

  playAlbum(album: Album): void {
    if (album.songIds && album.songIds.length > 0) {
      this.apiService.getSong(album.songIds[0]).subscribe({
        next: (song) => {
          this.audioPlayerService.playSong(song);
        }
      });
    }
  }

  getArtistNames(artistIds: string[]): string {
    const artistNames = artistIds.map(id => {
      const artist = this.artists().find(a => a.artistId === id);
      return artist ? artist.name : 'Unknown Artist';
    });
    return artistNames.join(', ');
  }

  getNotificationIcon(type: string): string {
    switch (type) {
      case 'new_release':
        return 'new_releases';
      case 'new_song':
        return 'music_note';
      case 'new_album':
        return 'album';
      default:
        return 'notifications';
    }
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  }

  formatNotificationTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) {
      return `${diffMins} minutes ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hours ago`;
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  }
}