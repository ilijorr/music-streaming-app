import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { fetchAuthSession } from 'aws-amplify/auth';
import { from, switchMap, catchError, throwError } from 'rxjs';
import { ConfigService } from '../services/config.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const configService = inject(ConfigService);

  console.log(`[AuthInterceptor] Intercepting request: ${req.url}`);

  // Skip interceptor for config.json and other asset requests
  if (req.url.includes('/assets/') || req.url.includes('config.json')) {
    console.log(`[AuthInterceptor] Skipping asset request`);
    return next(req);
  }

  // Skip interceptor for Cognito/AWS authentication requests to avoid infinite loops
  if (req.url.includes('cognito-idp') || req.url.includes('amazonaws.com/cognito')) {
    console.log(`[AuthInterceptor] Skipping Cognito request`);
    return next(req);
  }

  // If config is not loaded yet, skip interceptor
  if (!configService.isConfigLoaded()) {
    console.log(`[AuthInterceptor] Config not loaded, skipping`);
    return next(req);
  }

  // Get API URL
  const apiUrl = configService.getApiUrl();

  // Only add auth header for API requests
  if (!req.url.startsWith(apiUrl)) {
    console.log(`[AuthInterceptor] Not an API request, skipping`);
    return next(req);
  }

  console.log(`[AuthInterceptor] Fetching auth session...`);

  // Get auth session and add token to request
  return from(fetchAuthSession()).pipe(
    switchMap(session => {
      const token = session.tokens?.idToken?.toString();

      console.log(`[AuthInterceptor] Processing request to: ${req.url}`);
      console.log(`[AuthInterceptor] Token found:`, !!token);

      if (!token) {
        console.warn('[AuthInterceptor] No auth token found in session');
        return throwError(() => new Error('No authentication token available'));
      }

      // Clone request and add Authorization header
      const authReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });

      console.log(`[AuthInterceptor] Added Authorization header to request`);
      return next(authReq);
    }),
    catchError(error => {
      console.error('[AuthInterceptor] Error fetching auth session:', error);
      // Don't continue with the request if we can't get auth session
      return throwError(() => error);
    })
  );
};
