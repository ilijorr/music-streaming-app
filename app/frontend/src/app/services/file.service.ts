import { Injectable, inject } from '@angular/core';
import { ConfigService } from './config.service';

@Injectable({
  providedIn: 'root'
})
export class FileService {
  private configService = inject(ConfigService);

  /**
   * Convert File to base64 string
   */
  fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          // Remove the data URL prefix (e.g., "data:audio/mp3;base64,")
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error('Failed to convert file to base64'));
        }
      };
      reader.onerror = error => reject(error);
    });
  }

  /**
   * Validate file type for audio files
   */
  isValidAudioFile(file: File): boolean {
    const validTypes = this.configService.getAllowedAudioFormats();
    return validTypes.includes(file.type) || this.hasValidAudioExtension(file.name);
  }

  /**
   * Validate file type for image files
   */
  isValidImageFile(file: File): boolean {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    return validTypes.includes(file.type) || this.hasValidImageExtension(file.name);
  }

  /**
   * Check file extension for audio files (fallback when MIME type is not detected)
   */
  private hasValidAudioExtension(filename: string): boolean {
    const validExtensions = this.configService.getAllowedAudioExtensions();
    const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return validExtensions.includes(extension);
  }

  /**
   * Check file extension for image files (fallback when MIME type is not detected)
   */
  private hasValidImageExtension(filename: string): boolean {
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return validExtensions.includes(extension);
  }

  /**
   * Format file size to human readable format
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get file extension from filename
   */
  getFileExtension(filename: string): string {
    return filename.toLowerCase().substring(filename.lastIndexOf('.'));
  }

  /**
   * Validate file size (in bytes)
   */
  isValidFileSize(file: File, maxSizeInMB: number = 10): boolean {
    const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
    return file.size <= maxSizeInBytes;
  }

  /**
   * Create a safe filename (remove special characters)
   */
  createSafeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .toLowerCase();
  }

  /**
   * Validate multiple files
   */
  validateFiles(files: FileList, type: 'audio' | 'image', maxSizeInMB: number = 10): {
    valid: File[];
    invalid: { file: File; reason: string }[];
  } {
    const valid: File[] = [];
    const invalid: { file: File; reason: string }[] = [];

    Array.from(files).forEach(file => {
      if (!this.isValidFileSize(file, maxSizeInMB)) {
        invalid.push({ file, reason: `File size exceeds ${maxSizeInMB}MB limit` });
      } else if (type === 'audio' && !this.isValidAudioFile(file)) {
        invalid.push({ file, reason: 'Invalid audio file type' });
      } else if (type === 'image' && !this.isValidImageFile(file)) {
        invalid.push({ file, reason: 'Invalid image file type' });
      } else {
        valid.push(file);
      }
    });

    return { valid, invalid };
  }

  /**
   * Upload image file - converts to base64 for backend upload
   */
  async uploadImage(file: File): Promise<string> {
    if (!this.isValidImageFile(file)) {
      throw new Error('Invalid image file type');
    }

    // Return just the base64 data without the data URL prefix
    return this.fileToBase64(file);
  }

  /**
   * Upload audio file - converts to base64 for backend upload
   */
  async uploadAudio(file: File): Promise<string> {
    if (!this.isValidAudioFile(file)) {
      throw new Error('Invalid audio file type');
    }

    // Return just the base64 data without the data URL prefix
    return this.fileToBase64(file);
  }
}