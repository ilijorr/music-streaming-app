// Export all models from a single entry point
export * from './artist.model';
export * from './song.model';
export * from './album.model';
export * from './subscription.model';
export * from './discovery.model';
export * from './auth.model';

// Common response interfaces
export interface ApiResponse<T> {
  statusCode: number;
  body: T;
}

export interface ErrorResponse {
  error: string;
}