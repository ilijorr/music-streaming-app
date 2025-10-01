import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService, SignUpData } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly showConfirmation = signal(false);
  protected readonly registeredUsername = signal<string>('');

  protected readonly registerForm: FormGroup = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    givenName: ['', [Validators.required]],
    familyName: ['', [Validators.required]],
    birthdate: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]]
  });

  protected readonly confirmationForm: FormGroup = this.fb.group({
    confirmationCode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
  });

  protected readonly isLoading = this.authService.isLoading;

  protected async onSubmit(): Promise<void> {
    if (this.registerForm.invalid) {
      return;
    }

    const password = this.registerForm.value.password;
    const confirmPassword = this.registerForm.value.confirmPassword;

    if (password !== confirmPassword) {
      this.errorMessage.set('Passwords do not match');
      return;
    }

    this.errorMessage.set(null);

    try {
      const signUpData: SignUpData = {
        username: this.registerForm.value.username,
        email: this.registerForm.value.email,
        givenName: this.registerForm.value.givenName,
        familyName: this.registerForm.value.familyName,
        birthdate: this.registerForm.value.birthdate,
        password: this.registerForm.value.password
      };

      const result = await this.authService.signUp(signUpData);

      if (result.isSignUpComplete) {
        this.successMessage.set('Registration successful! You can now sign in.');
        setTimeout(() => this.router.navigate(['/auth/login']), 2000);
      } else {
        this.registeredUsername.set(signUpData.username);
        this.showConfirmation.set(true);
        this.successMessage.set('Please check your email for the confirmation code.');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      this.errorMessage.set(error.message || 'Registration failed. Please try again.');
    }
  }

  protected async onConfirmation(): Promise<void> {
    if (this.confirmationForm.invalid) {
      return;
    }

    this.errorMessage.set(null);

    try {
      await this.authService.confirmSignUp(
        this.registeredUsername(),
        this.confirmationForm.value.confirmationCode
      );

      this.successMessage.set('Email confirmed! You can now sign in.');
      setTimeout(() => this.router.navigate(['/auth/login']), 2000);
    } catch (error: any) {
      console.error('Confirmation error:', error);
      this.errorMessage.set(error.message || 'Confirmation failed. Please try again.');
    }
  }

  protected async resendCode(): Promise<void> {
    try {
      await this.authService.resendConfirmationCode(this.registeredUsername());
      this.successMessage.set('Confirmation code resent! Check your email.');
    } catch (error: any) {
      console.error('Resend error:', error);
      this.errorMessage.set(error.message || 'Failed to resend code.');
    }
  }

  protected navigateToLogin(): void {
    this.router.navigate(['/auth/login']);
  }
}