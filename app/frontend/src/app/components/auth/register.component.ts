import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';

import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  template: `
    <div class="register-container">
      <mat-card class="register-card">
        <mat-card-header>
          <mat-card-title>🎵 Music Streaming</mat-card-title>
          <mat-card-subtitle>Create your account</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          @if (!showConfirmation()) {
            <!-- Registration Form -->
            <form [formGroup]="registerForm" (ngSubmit)="onSubmit()">
              <div class="name-row">
                <mat-form-field appearance="outline" class="half-width">
                  <mat-label>First Name</mat-label>
                  <input matInput type="text" formControlName="given_name" required>
                  @if (registerForm.get('given_name')?.hasError('required') && registerForm.get('given_name')?.touched) {
                    <mat-error>First name is required</mat-error>
                  }
                </mat-form-field>

                <mat-form-field appearance="outline" class="half-width">
                  <mat-label>Last Name</mat-label>
                  <input matInput type="text" formControlName="family_name" required>
                  @if (registerForm.get('family_name')?.hasError('required') && registerForm.get('family_name')?.touched) {
                    <mat-error>Last name is required</mat-error>
                  }
                </mat-form-field>
              </div>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Username</mat-label>
                <input matInput type="text" formControlName="username" required>
                <mat-icon matSuffix>person</mat-icon>
                @if (registerForm.get('username')?.hasError('required') && registerForm.get('username')?.touched) {
                  <mat-error>Username is required</mat-error>
                }
                @if (registerForm.get('username')?.hasError('minlength') && registerForm.get('username')?.touched) {
                  <mat-error>Username must be at least 3 characters long</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Email</mat-label>
                <input matInput type="email" formControlName="email" required>
                <mat-icon matSuffix>email</mat-icon>
                @if (registerForm.get('email')?.hasError('required') && registerForm.get('email')?.touched) {
                  <mat-error>Email is required</mat-error>
                }
                @if (registerForm.get('email')?.hasError('email') && registerForm.get('email')?.touched) {
                  <mat-error>Please enter a valid email address</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Birth Date</mat-label>
                <input matInput [matDatepicker]="picker" formControlName="birthdate" required readonly>
                <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
                <mat-datepicker #picker></mat-datepicker>
                @if (registerForm.get('birthdate')?.hasError('required') && registerForm.get('birthdate')?.touched) {
                  <mat-error>Birth date is required</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Password</mat-label>
                <input matInput [type]="hidePassword() ? 'password' : 'text'" formControlName="password" required>
                <button type="button" mat-icon-button matSuffix (click)="togglePasswordVisibility()">
                  <mat-icon>{{ hidePassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
                @if (registerForm.get('password')?.hasError('required') && registerForm.get('password')?.touched) {
                  <mat-error>Password is required</mat-error>
                }
                @if (registerForm.get('password')?.hasError('minlength') && registerForm.get('password')?.touched) {
                  <mat-error>Password must be at least 8 characters long</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Confirm Password</mat-label>
                <input matInput [type]="hideConfirmPassword() ? 'password' : 'text'" formControlName="confirmPassword" required>
                <button type="button" mat-icon-button matSuffix (click)="toggleConfirmPasswordVisibility()">
                  <mat-icon>{{ hideConfirmPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
                @if (registerForm.get('confirmPassword')?.hasError('required') && registerForm.get('confirmPassword')?.touched) {
                  <mat-error>Please confirm your password</mat-error>
                }
                @if (registerForm.hasError('passwordMismatch') && registerForm.get('confirmPassword')?.touched) {
                  <mat-error>Passwords do not match</mat-error>
                }
              </mat-form-field>

              @if (errorMessage()) {
                <div class="error-message">
                  <mat-icon>error</mat-icon>
                  {{ errorMessage() }}
                </div>
              }

              <div class="form-actions">
                <button
                  mat-raised-button
                  color="primary"
                  type="submit"
                  [disabled]="registerForm.invalid || isLoading()"
                  class="full-width">
                  @if (isLoading()) {
                    <mat-spinner diameter="20"></mat-spinner>
                    Creating Account...
                  } @else {
                    Create Account
                  }
                </button>
              </div>
            </form>
          } @else {
            <!-- Email Confirmation Form -->
            <form [formGroup]="confirmationForm" (ngSubmit)="onConfirmSubmit()">
              <div class="confirmation-info">
                <mat-icon class="success-icon">email</mat-icon>
                <h3>Check your email</h3>
                <p>We've sent a confirmation code to <strong>{{ registeredEmail() }}</strong></p>
                <p>Please enter the code below to complete your registration.</p>
              </div>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Confirmation Code</mat-label>
                <input matInput type="text" formControlName="code" required placeholder="Enter 6-digit code">
                <mat-icon matSuffix>verified_user</mat-icon>
                @if (confirmationForm.get('code')?.hasError('required') && confirmationForm.get('code')?.touched) {
                  <mat-error>Confirmation code is required</mat-error>
                }
              </mat-form-field>

              @if (confirmationError()) {
                <div class="error-message">
                  <mat-icon>error</mat-icon>
                  {{ confirmationError() }}
                </div>
              }

              <div class="form-actions">
                <button
                  mat-raised-button
                  color="primary"
                  type="submit"
                  [disabled]="confirmationForm.invalid || isConfirming()"
                  class="full-width">
                  @if (isConfirming()) {
                    <mat-spinner diameter="20"></mat-spinner>
                    Confirming...
                  } @else {
                    Confirm Email
                  }
                </button>

                <button
                  mat-button
                  type="button"
                  (click)="goBackToRegistration()"
                  class="full-width secondary-button">
                  Back to Registration
                </button>
              </div>
            </form>
          }
        </mat-card-content>

        <mat-card-actions>
          <div class="auth-links">
            <p>Already have an account? <a routerLink="/login" class="link">Sign in here</a></p>
          </div>
        </mat-card-actions>
      </mat-card>
    </div>
  `,
  styles: [`
    .register-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .register-card {
      width: 100%;
      max-width: 500px;
      padding: 20px;
    }

    .full-width {
      width: 100%;
      margin-bottom: 16px;
    }

    .half-width {
      width: calc(50% - 8px);
      margin-bottom: 16px;
    }

    .name-row {
      display: flex;
      gap: 16px;
    }

    .form-actions {
      margin-top: 20px;
    }

    .secondary-button {
      margin-top: 8px;
    }

    .auth-links {
      width: 100%;
      text-align: center;
    }

    .link {
      color: #667eea;
      text-decoration: none;
      font-weight: 500;
    }

    .link:hover {
      text-decoration: underline;
    }

    .error-message {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #f44336;
      margin-bottom: 16px;
      font-size: 14px;
    }

    .confirmation-info {
      text-align: center;
      margin-bottom: 24px;
    }

    .success-icon {
      font-size: 48px;
      color: #4caf50;
      margin-bottom: 16px;
    }

    mat-card-header {
      text-align: center;
      margin-bottom: 20px;
    }

    mat-card-title {
      font-size: 24px;
      margin-bottom: 8px;
    }

    mat-spinner {
      margin-right: 8px;
    }
  `]
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  public hidePassword = signal(true);
  public hideConfirmPassword = signal(true);
  public isLoading = signal(false);
  public isConfirming = signal(false);
  public errorMessage = signal<string>('');
  public confirmationError = signal<string>('');
  public showConfirmation = signal(false);
  public registeredEmail = signal<string>('');
  public registeredUsername = signal<string>('');

  public registerForm: FormGroup = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]],
    given_name: ['', [Validators.required]],
    family_name: ['', [Validators.required]],
    birthdate: ['', [Validators.required]]
  }, { validators: this.passwordMatchValidator });

  public confirmationForm: FormGroup = this.fb.group({
    code: ['', [Validators.required]]
  });

  constructor() {
    // Redirect if already authenticated
    if (this.authService.isUserAuthenticated()) {
      this.router.navigate(['/']);
    }
  }

  private passwordMatchValidator(group: FormGroup) {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  togglePasswordVisibility(): void {
    this.hidePassword.set(!this.hidePassword());
  }

  toggleConfirmPasswordVisibility(): void {
    this.hideConfirmPassword.set(!this.hideConfirmPassword());
  }

  onSubmit(): void {
    if (this.registerForm.valid) {
      this.isLoading.set(true);
      this.errorMessage.set('');

      const formData = this.registerForm.value;

      // Format birth date to YYYY-MM-DD
      const birthDate = new Date(formData.birthdate);
      const formattedBirthDate = birthDate.toISOString().split('T')[0];

      const userData = {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        given_name: formData.given_name,
        family_name: formData.family_name,
        birthdate: formattedBirthDate
      };

      this.authService.register(userData).subscribe({
        next: (result) => {
          this.isLoading.set(false);
          this.registeredEmail.set(userData.email);
          this.registeredUsername.set(userData.username);
          this.showConfirmation.set(true);
          this.snackBar.open('Registration successful! Please check your email.', 'Close', { duration: 5000 });
        },
        error: (error) => {
          this.isLoading.set(false);
          this.errorMessage.set(error.message || 'Registration failed. Please try again.');
        }
      });
    } else {
      // Mark all fields as touched to show validation errors
      Object.keys(this.registerForm.controls).forEach(key => {
        this.registerForm.get(key)?.markAsTouched();
      });
    }
  }

  onConfirmSubmit(): void {
    if (this.confirmationForm.valid) {
      this.isConfirming.set(true);
      this.confirmationError.set('');

      const code = this.confirmationForm.value.code;

      this.authService.confirmRegistration(this.registeredUsername(), code).subscribe({
        next: () => {
          this.isConfirming.set(false);
          this.snackBar.open('Email confirmed successfully! You can now sign in.', 'Close', { duration: 5000 });
          this.router.navigate(['/login']);
        },
        error: (error) => {
          this.isConfirming.set(false);
          this.confirmationError.set(error.message || 'Confirmation failed. Please try again.');
        }
      });
    }
  }

  goBackToRegistration(): void {
    this.showConfirmation.set(false);
    this.confirmationError.set('');
    this.confirmationForm.reset();
  }
}