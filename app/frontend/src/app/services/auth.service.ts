import { Injectable, inject, signal } from '@angular/core';
import { Amplify } from 'aws-amplify';
import { signIn, signUp, signOut, getCurrentUser, confirmSignUp, resendSignUpCode, fetchUserAttributes } from '@aws-amplify/auth';
import { fetchAuthSession } from '@aws-amplify/auth';
import { ConfigService } from './config.service';

export interface User {
  userId: string;
  username: string;
  email?: string;
  givenName?: string;
  familyName?: string;
  birthdate?: string;
  groups?: string[];
}

export interface SignUpData {
  username: string;
  password: string;
  email: string;
  givenName: string;
  familyName: string;
  birthdate: string;
}

export interface SignInData {
  username: string;
  password: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly configService = inject(ConfigService);

  readonly isAuthenticated = signal(false);
  readonly currentUser = signal<User | null>(null);
  readonly isLoading = signal(false);

  constructor() {
    this.initializeAmplify();
    this.checkAuthStatus();
  }

  private initializeAmplify(): void {
    const cognitoConfig = this.configService.getCognitoConfig();

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

  private async checkAuthStatus(): Promise<void> {
    try {
      this.isLoading.set(true);
      const user = await getCurrentUser();
      const attributes = await fetchUserAttributes();
      const session = await fetchAuthSession();

      // Extract groups from JWT token
      const groups = this.extractGroupsFromToken(session);

      this.currentUser.set({
        userId: user.userId,
        username: user.username,
        email: attributes.email,
        givenName: attributes.given_name,
        familyName: attributes.family_name,
        birthdate: attributes.birthdate,
        groups: groups
      });
      this.isAuthenticated.set(true);

      console.log('User is authenticated:', user, 'Attributes:', attributes, 'Groups:', groups);
    } catch (error) {
      console.log('User is not authenticated');
      this.isAuthenticated.set(false);
      this.currentUser.set(null);
    } finally {
      this.isLoading.set(false);
    }
  }

  private extractGroupsFromToken(session: any): string[] {
    try {
      const accessToken = session.tokens?.accessToken?.payload;
      return accessToken?.['cognito:groups'] || [];
    } catch (error) {
      console.warn('Could not extract groups from token:', error);
      return [];
    }
  }

  async signUp(signUpData: SignUpData): Promise<{ isSignUpComplete: boolean; nextStep?: any }> {
    try {
      this.isLoading.set(true);

      const { isSignUpComplete, nextStep } = await signUp({
        username: signUpData.username,
        password: signUpData.password,
        options: {
          userAttributes: {
            email: signUpData.email,
            given_name: signUpData.givenName,
            family_name: signUpData.familyName,
            birthdate: signUpData.birthdate
          }
        }
      });

      return { isSignUpComplete, nextStep };
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  async confirmSignUp(username: string, confirmationCode: string): Promise<void> {
    try {
      this.isLoading.set(true);
      await confirmSignUp({
        username,
        confirmationCode
      });
    } catch (error) {
      console.error('Confirmation error:', error);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  async resendConfirmationCode(username: string): Promise<void> {
    try {
      await resendSignUpCode({ username });
    } catch (error) {
      console.error('Resend confirmation error:', error);
      throw error;
    }
  }

  async signIn(signInData: SignInData): Promise<void> {
    try {
      this.isLoading.set(true);

      const { isSignedIn } = await signIn({
        username: signInData.username,
        password: signInData.password
      });

      if (isSignedIn) {
        await this.checkAuthStatus();
      }
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  async signOut(): Promise<void> {
    try {
      this.isLoading.set(true);
      await signOut();
      this.isAuthenticated.set(false);
      this.currentUser.set(null);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  async getAccessToken(): Promise<string | null> {
    try {
      const user = await getCurrentUser();
      return user.signInDetails?.loginId || null;
    } catch (error) {
      return null;
    }
  }

  isUserInGroup(groupName: string): boolean {
    const user = this.currentUser();
    return user?.groups?.includes(groupName) || false;
  }

  isAdmin(): boolean {
    return this.isUserInGroup('Admins');
  }
}