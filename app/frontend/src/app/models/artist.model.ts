export interface Artist {
  artistId: string;
  name: string;
  biography: string;
  genres: string[];
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateArtistRequest {
  name: string;
  biography: string;
  genres: string[];
  image_base64?: string;
  image_filename?: string;
}

export interface UpdateArtistRequest {
  name?: string;
  biography?: string;
  genres?: string[];
  image_base64?: string;
  image_filename?: string;
}