import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './guards/auth.guard';

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
    canActivate: [authGuard]
  },
  {
    path: 'music/upload',
    loadComponent: () => import('./components/upload-music/upload-music.component').then(m => m.UploadMusicComponent),
    canActivate: [authGuard]
  },
  {
    path: 'music/browse',
    loadComponent: () => import('./components/browse-music/browse-music.component').then(m => m.BrowseMusicComponent),
    canActivate: [authGuard]
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
