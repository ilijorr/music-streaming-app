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
      console.error('Make sure the config.json file exists in src/assets/ directory');
      console.error('You can generate it by running the deployment script: deploy.bat or deploy.sh');

      // Use a fallback config for development if config.json is not available
      console.warn('Using fallback development config');
      this.config = {
        apiUrl: 'http://localhost:3000/dev',
        cognito: {
          userPoolId: 'PLACEHOLDER',
          userPoolClientId: 'PLACEHOLDER',
          region: 'eu-central-1'
        },
        s3: {
          bucketName: 'PLACEHOLDER',
          region: 'eu-central-1'
        },
        allowedAudioFormats: [
          'audio/mpeg',
          'audio/mp3',
          'audio/wav',
          'audio/flac',
          'audio/m4a',
          'audio/ogg',
          'audio/aac'
        ],
        allowedAudioExtensions: [
          '.mp3',
          '.wav',
          '.flac',
          '.m4a',
          '.ogg',
          '.aac'
        ]
      };
    }
  }

  isConfigLoaded(): boolean {
    return !!this.config;
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
