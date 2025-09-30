import { MusicContent } from './music-content.interface';

export interface Album {
  title: string;
  releaseDate: Date;
  coverImage?: File;
  genres: string[];
  artistIds: string[];
  tracks: MusicContent[];
}