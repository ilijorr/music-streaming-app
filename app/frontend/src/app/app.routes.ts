import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  // Auth routes (accessible only when not authenticated)
  {
    path: 'auth/login',
    loadComponent: () => import('./components/auth/login.component').then(m => m.LoginComponent),
    canActivate: [guestGuard]
  },
  {
    path: 'auth/register',
    loadComponent: () => import('./components/auth/register.component').then(m => m.RegisterComponent),
    canActivate: [guestGuard]
  },

  // Protected routes (require authentication)
  {
    path: 'artists/create',
    loadComponent: () => import('./components/create-artist/create-artist.component').then(m => m.CreateArtistComponent),
    canActivate: [adminGuard]
  },
  {
    path: 'music/upload',
    loadComponent: () => import('./components/upload-music/upload-music.component').then(m => m.UploadMusicComponent),
    canActivate: [adminGuard]
  },
  {
    path: 'music/browse',
    loadComponent: () => import('./components/browse-music/browse-music.component').then(m => m.BrowseMusicComponent),
    canActivate: [authGuard]
  },
  {
    path: 'music/edit/:id',
    loadComponent: () => import('./components/edit-song/edit-song.component').then(m => m.EditSongComponent),
    canActivate: [adminGuard]
  },
  {
    path: 'albums/edit/:id',
    loadComponent: () => import('./components/edit-album/edit-album.component').then(m => m.EditAlbumComponent),
    canActivate: [adminGuard]
  },
  {
    path: 'browse-music',
    redirectTo: '/music/browse',
    pathMatch: 'full'
  },

  // Default redirects
  {
    path: '',
    redirectTo: '/music/browse',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: '/auth/login'
  }
];
