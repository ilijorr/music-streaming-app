import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService, SignInData } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly errorMessage = signal<string | null>(null);

  protected readonly loginForm: FormGroup = this.fb.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(8)]]
  });

  protected readonly isLoading = this.authService.isLoading;

  protected async onSubmit(): Promise<void> {
    if (this.loginForm.invalid) {
      return;
    }

    this.errorMessage.set(null);

    try {
      const signInData: SignInData = {
        username: this.loginForm.value.username,
        password: this.loginForm.value.password
      };

      await this.authService.signIn(signInData);

      // Navigate to main app after successful login
      this.router.navigate(['/music/browse']);
    } catch (error: any) {
      console.error('Login error:', error);
      this.errorMessage.set(error.message || 'Login failed. Please try again.');
    }
  }

  protected navigateToRegister(): void {
    this.router.navigate(['/auth/register']);
  }
}