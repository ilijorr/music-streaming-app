import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // First check if user is authenticated
  if (!authService.isAuthenticated()) {
    router.navigate(['/auth/login']);
    return false;
  }

  // Then check if user is admin
  if (authService.isAdmin()) {
    return true;
  }

  // Redirect to browse page if not admin
  console.warn('Access denied: User is not in Admins group');
  router.navigate(['/music/browse']);
  return false;
};