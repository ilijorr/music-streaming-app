// Form data used in the create artist form
export interface ArtistFormData {
  name: string;
  biography: string;
  photo: File;
  genres: string[];
}

// Request payload for creating an artist
export interface CreateArtistRequest {
  name: string;
  biography: string;
  genres: string[];
  imageBase64?: string;
}

// Artist response from API
export interface ArtistResponse {
  artistId: string;
  name: string;
  biography: string;
  genres: string[];
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

// Response from create artist endpoint
export interface CreateArtistResponse {
  message: string;
  artist: ArtistResponse;
}

// Backward compatibility
export type Artist = ArtistFormData;