import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { fetchAuthSession } from 'aws-amplify/auth';
import { from, switchMap, catchError, throwError } from 'rxjs';
import { ConfigService } from '../services/config.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const configService = inject(ConfigService);

  // Skip interceptor for config.json and other asset requests
  if (req.url.includes('/assets/') || req.url.includes('config.json')) {
    return next(req);
  }

  // If config is not loaded yet, skip interceptor
  if (!configService.isConfigLoaded()) {
    return next(req);
  }

  // Get API URL
  const apiUrl = configService.getApiUrl();

  // Only add auth header for API requests
  if (!req.url.startsWith(apiUrl)) {
    return next(req);
  }

  // Get auth session and add token to request
  return from(fetchAuthSession()).pipe(
    switchMap(session => {
      const token = session.tokens?.idToken?.toString();

      if (!token) {
        console.warn('No auth token found in session');
        return next(req);
      }

      // Clone request and add Authorization header
      const authReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });

      return next(authReq);
    }),
    catchError(error => {
      console.error('Error fetching auth session:', error);
      return next(req);
    })
  );
};
