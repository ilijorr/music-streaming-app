import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface AppConfig {
  apiUrl: string;
  cognito: {
    userPoolId: string;
    userPoolClientId: string;
    region: string;
  };
  s3: {
    bucketName: string;
    region: string;
  };
  allowedAudioFormats: string[];
  allowedAudioExtensions: string[];
}

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private readonly http = inject(HttpClient);
  private config!: AppConfig;

  async loadConfig(): Promise<void> {
    try {
      this.config = await firstValueFrom(
        this.http.get<AppConfig>('/assets/config.json')
      );
      console.log('Config loaded successfully:', this.config);
    } catch (error) {
      console.error('Failed to load config.json!', error);
    }
  }

  get(): AppConfig {
    if (!this.config) {
      throw new Error('Config not loaded. Make sure ConfigService.loadConfig() is called during app initialization.');
    }
    return this.config;
  }

  getApiUrl(): string {
    return this.get().apiUrl;
  }

  getCognitoConfig() {
    return this.get().cognito;
  }

  getS3Config() {
    return this.get().s3;
  }

  getAllowedAudioFormats(): string[] {
    return this.get().allowedAudioFormats;
  }

  getAllowedAudioExtensions(): string[] {
    return this.get().allowedAudioExtensions;
  }
}
