import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEventType, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, from } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import {ConfigService} from './config.service';

export interface PresignedUrlRequest {
  fileType: string;
  fileName: string;
  fileSize: number;
  uploadType: 'song' | 'cover';
}

export interface PresignedUrlResponse {
  uploadUrl: string;
  fields: Record<string, string>;
  key: string;
  fileId: string;
  expiresIn: number;
}

export interface S3UploadProgress {
  progress: number;
  loaded: number;
  total: number;
}

export interface S3UploadResult {
  key: string;
  fileId: string;
  url: string;
}

@Injectable({
  providedIn: 'root'
})
export class S3UploadService {
  private readonly http = inject(HttpClient);
  private readonly configService = inject(ConfigService);

  private get apiUrl(): string {
    return `${this.configService.getApiUrl()}/songs/presigned-url`;
  }

  /**
   * Get a presigned URL for direct S3 upload
   */
  getPresignedUrl(request: PresignedUrlRequest): Observable<PresignedUrlResponse> {
    return this.http.post<PresignedUrlResponse>(this.apiUrl, request);
  }

  /**
   * Upload file directly to S3 using presigned URL
   */
  uploadToS3(
    file: File,
    presignedData: PresignedUrlResponse,
    onProgress?: (progress: S3UploadProgress) => void
  ): Observable<S3UploadResult> {
    return from(this.performS3Upload(file, presignedData, onProgress));
  }

  /**
   * Complete upload flow: get presigned URL and upload file
   */
  uploadFile(
    file: File,
    uploadType: 'song' | 'cover' = 'song',
    onProgress?: (progress: S3UploadProgress) => void
  ): Observable<S3UploadResult> {
    const request: PresignedUrlRequest = {
      fileType: file.type,
      fileName: file.name,
      fileSize: file.size,
      uploadType
    };

    return this.getPresignedUrl(request).pipe(
      switchMap(presignedData =>
        this.uploadToS3(file, presignedData, onProgress)
      ),
      catchError(error => {
        console.error('Upload error:', error);
        return throwError(() => error);
      })
    );
  }

  private async performS3Upload(
    file: File,
    presignedData: PresignedUrlResponse,
    onProgress?: (progress: S3UploadProgress) => void
  ): Promise<S3UploadResult> {
    return new Promise((resolve, reject) => {
      const formData = new FormData();

      // Add all required fields from presigned URL
      Object.entries(presignedData.fields).forEach(([key, value]) => {
        formData.append(key, value);
      });

      // Add the file last
      formData.append('file', file);

      // Create XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const progress = Math.round((event.loaded / event.total) * 100);
          onProgress({
            progress,
            loaded: event.loaded,
            total: event.total
          });
        }
      });

      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          // S3 upload successful
          const result: S3UploadResult = {
            key: presignedData.key,
            fileId: presignedData.fileId,
            url: `${presignedData.uploadUrl}/${presignedData.key}`
          };
          resolve(result);
        } else {
          reject(new Error(`Upload failed with status: ${xhr.status}`));
        }
      });

      // Handle errors
      xhr.addEventListener('error', () => {
        reject(new Error('Network error during upload'));
      });

      xhr.addEventListener('timeout', () => {
        reject(new Error('Upload timeout'));
      });

      // Configure and send request
      xhr.open('POST', presignedData.uploadUrl);
      xhr.timeout = 5 * 60 * 1000; // 5 minutes timeout
      xhr.send(formData);
    });
  }

  /**
   * Validate file before upload
   */
  validateFile(file: File, uploadType: 'song' | 'cover'): { valid: boolean; error?: string } {
    if (uploadType === 'song') {
      if (!file.type.startsWith('audio/')) {
        return { valid: false, error: 'Please select a valid audio file' };
      }

      // 100MB limit for audio files
      const maxSize = 100 * 1024 * 1024;
      if (file.size > maxSize) {
        return { valid: false, error: 'Audio file size must be less than 100MB' };
      }
    } else if (uploadType === 'cover') {
      if (!file.type.startsWith('image/')) {
        return { valid: false, error: 'Please select a valid image file' };
      }

      // 10MB limit for images
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        return { valid: false, error: 'Image file size must be less than 10MB' };
      }
    }

    return { valid: true };
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
