import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './services/auth.service';

// Route Guards
const authGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isUserAuthenticated()) {
    return true;
  } else {
    router.navigate(['/login']);
    return false;
  }
};

const adminGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isUserAuthenticated() && authService.isUserAdmin()) {
    return true;
  } else {
    router.navigate(['/']);
    return false;
  }
};

const guestGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isUserAuthenticated()) {
    return true;
  } else {
    router.navigate(['/']);
    return false;
  }
};

export const routes: Routes = [
  // Public routes (guest only)
  {
    path: 'login',
    loadComponent: () => import('./components/auth/login.component').then(m => m.LoginComponent),
    canActivate: [guestGuard]
  },
  {
    path: 'register',
    loadComponent: () => import('./components/auth/register.component').then(m => m.RegisterComponent),
    canActivate: [guestGuard]
  },

  // Protected routes (authenticated users)
  {
    path: '',
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent),
    canActivate: [authGuard]
  },
  {
    path: 'discover',
    loadComponent: () => import('./pages/discover/discover.component').then(m => m.DiscoverComponent),
    canActivate: [authGuard]
  },
  {
    path: 'subscriptions',
    loadComponent: () => import('./components/user/subscriptions.component').then(m => m.SubscriptionsComponent),
    canActivate: [authGuard]
  },

  // Admin routes
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin/admin.component').then(m => m.AdminComponent),
    canActivate: [adminGuard]
  },

  // Fallback route
  {
    path: '**',
    redirectTo: ''
  }
];
