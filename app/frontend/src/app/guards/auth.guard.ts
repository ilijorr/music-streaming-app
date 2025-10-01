import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { firstValueFrom, timeout, catchError, of } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';

export const authGuard: CanActivateFn = async (route, state) => {
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

    if (authService.isAuthenticated()) {
      return true;
    }

    // Redirect to login page
    router.navigate(['/auth/login']);
    return false;
  } catch (error) {
    console.warn('Auth guard timeout, redirecting to login');
    router.navigate(['/auth/login']);
    return false;
  }
};

export const guestGuard: CanActivateFn = async (route, state) => {
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

    if (!authService.isAuthenticated()) {
      return true;
    }

    // Redirect to main app if already authenticated
    router.navigate(['/music/browse']);
    return false;
  } catch (error) {
    console.warn('Guest guard timeout, allowing access');
    return true;
  }
};