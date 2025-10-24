import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Amplify } from 'aws-amplify';
import { getCurrentUser, signIn, signUp, signOut, confirmSignUp, fetchAuthSession } from 'aws-amplify/auth';
import { BehaviorSubject, Observable, from, map, catchError, of } from 'rxjs';
import { User, LoginRequest, RegisterRequest } from '../models';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private router = inject(Router);
  private configService = inject(ConfigService);

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  // Signal for reactive templates
  public isAuthenticated = signal(false);
  public isAdmin = signal(false);
  public currentUser = signal<User | null>(null);

  constructor() {
    // Initialize after config is loaded
  }

  initializeWithConfig(): void {
    this.initializeAmplify();
    this.checkAuthState();
  }

  private initializeAmplify() {
    const cognitoConfig = this.configService.getCognitoConfig();
    if (!cognitoConfig) {
      console.error('Cognito configuration not available');
      return;
    }

    console.log('Initializing Amplify with config:', {
      userPoolId: cognitoConfig.userPoolId,
      userPoolClientId: cognitoConfig.userPoolClientId,
      region: cognitoConfig.region
    });

    Amplify.configure({
      Auth: {
        Cognito: {
          userPoolId: cognitoConfig.userPoolId,
          userPoolClientId: cognitoConfig.userPoolClientId,
          loginWith: {
            email: true,
            username: true
          }
        }
      }
    });
  }

  private async checkAuthState() {
    try {
      const user = await getCurrentUser();
      const session = await fetchAuthSession();

      if (user && session.tokens) {
        const userData = await this.buildUserFromCognito(user, session.tokens);
        this.updateUserState(userData);
      }
    } catch (error) {
      console.log('No authenticated user');
      this.updateUserState(null);
    }
  }

  private async buildUserFromCognito(cognitoUser: any, tokens: any): Promise<User> {
    const claims = tokens.idToken?.payload || {};
    const groups = claims['cognito:groups'] || [];

    return {
      userId: cognitoUser.userId,
      username: cognitoUser.username,
      email: claims.email || '',
      given_name: claims.given_name || '',
      family_name: claims.family_name || '',
      birthdate: claims.birthdate || '',
      groups: groups,
      isAdmin: groups.includes('Admins')
    };
  }

  private updateUserState(user: User | null) {
    this.currentUserSubject.next(user);
    this.currentUser.set(user);
    this.isAuthenticated.set(!!user);
    this.isAdmin.set(user?.isAdmin || false);
  }

  login(credentials: LoginRequest): Observable<User> {
    return from(
      signIn({
        username: credentials.username,
        password: credentials.password
      }).then(async (result) => {
        if (result.isSignedIn) {
          const user = await getCurrentUser();
          const session = await fetchAuthSession();
          const userData = await this.buildUserFromCognito(user, session.tokens);
          this.updateUserState(userData);
          return userData;
        } else {
          throw new Error('Sign in incomplete');
        }
      })
    ).pipe(
      catchError((error) => {
        console.error('Login error:', error);
        throw error;
      })
    );
  }

  register(userData: RegisterRequest): Observable<any> {
    console.log('Attempting registration for user:', userData.username);
    console.log('Current Cognito config:', this.configService.getCognitoConfig());

    return from(signUp({
      username: userData.username,
      password: userData.password,
      options: {
        userAttributes: {
          email: userData.email,
          given_name: userData.given_name,
          family_name: userData.family_name,
          birthdate: userData.birthdate
        }
      }
    })).pipe(
      catchError((error) => {
        console.error('Registration error details:', {
          error: error,
          message: error.message,
          code: error.code,
          name: error.name
        });
        throw error;
      })
    );
  }

  confirmRegistration(username: string, code: string): Observable<any> {
    return from(confirmSignUp({
      username: username,
      confirmationCode: code
    }));
  }

  logout(): Observable<void> {
    return from(signOut()).pipe(
      map(() => {
        this.updateUserState(null);
        this.router.navigate(['/login']);
      }),
      catchError((error) => {
        console.error('Logout error:', error);
        // Clear state even if logout fails
        this.updateUserState(null);
        this.router.navigate(['/login']);
        return of(undefined);
      })
    );
  }

  async getAuthToken(): Promise<string | null> {
    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      console.log('Getting auth token:', {
        hasIdToken: !!idToken,
        hasAccessToken: !!session.tokens?.accessToken,
        tokenPreview: idToken ? idToken.substring(0, 50) + '...' : 'none'
      });
      return idToken || null;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  // Helper methods
  isUserAuthenticated(): boolean {
    return this.isAuthenticated();
  }

  isUserAdmin(): boolean {
    return this.isAdmin();
  }

  getCurrentUser(): User | null {
    return this.currentUser();
  }
}