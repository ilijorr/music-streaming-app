export interface MusicContent {
  // File metadata (extracted automatically)
  fileName: string;
  fileType: string;
  fileSize: number;
  createdAt: Date;
  lastModified: Date;

  // Admin-defined information
  title: string;
  genres: string[];
  coverImage?: File;
  duration?: number; // in seconds

  // Relationships
  artistIds: string[];
  albumId?: string; // optional - for singles

  // The actual audio file
  audioFile: File;
}