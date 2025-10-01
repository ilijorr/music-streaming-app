import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { firstValueFrom, timeout, catchError, of } from 'rxjs';
import { filter } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';

export const adminGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  try {
    // Wait for auth loading to complete, with a timeout
    await firstValueFrom(
      toObservable(authService.isLoading).pipe(
        filter(loading => !loading),
        timeout(5000),
        catchError(() => of(false))
      )
    );

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
  } catch (error) {
    console.warn('Admin guard timeout, redirecting to login');
    router.navigate(['/auth/login']);
    return false;
  }
};