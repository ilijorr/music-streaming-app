import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

export interface AppConfig {
  apiUrl: string;
  cognito: {
    userPoolId: string;
    userPoolClientId: string;
    region: string;
  };
  s3: {
    mediaBucketName: string;
    imagesBucketName: string;
    region: string;
  };
  allowedAudioFormats: string[];
  allowedAudioExtensions: string[];
}

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private configSubject = new BehaviorSubject<AppConfig | null>(null);
  public config$ = this.configSubject.asObservable();

  constructor(private http: HttpClient) {}

  loadConfig(): Observable<AppConfig> {
    return this.http.get<AppConfig>('/assets/config.json').pipe(
      tap(config => {
        this.configSubject.next(config);
      })
    );
  }

  getConfig(): AppConfig | null {
    return this.configSubject.value;
  }

  getApiUrl(): string {
    const config = this.getConfig();
    const apiUrl = config?.apiUrl || '';
    // Remove trailing slash to prevent double slashes when constructing endpoints
    return apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
  }

  getCognitoConfig(): AppConfig['cognito'] | null {
    const config = this.getConfig();
    return config?.cognito || null;
  }

  getS3Config(): AppConfig['s3'] | null {
    const config = this.getConfig();
    return config?.s3 || null;
  }

  getAllowedAudioFormats(): string[] {
    const config = this.getConfig();
    return config?.allowedAudioFormats || [];
  }

  getAllowedAudioExtensions(): string[] {
    const config = this.getConfig();
    return config?.allowedAudioExtensions || [];
  }
}