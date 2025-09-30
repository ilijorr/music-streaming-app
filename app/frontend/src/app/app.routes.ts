import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'artists/create',
    loadComponent: () => import('./components/create-artist/create-artist.component').then(m => m.CreateArtistComponent)
  },
  {
    path: 'music/upload',
    loadComponent: () => import('./components/upload-music/upload-music.component').then(m => m.UploadMusicComponent)
  },
  {
    path: 'music/browse',
    loadComponent: () => import('./components/browse-music/browse-music.component').then(m => m.BrowseMusicComponent)
  },
  {
    path: '',
    redirectTo: '/music/browse',
    pathMatch: 'full'
  }
];
