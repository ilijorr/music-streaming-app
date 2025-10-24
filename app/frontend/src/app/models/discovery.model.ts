import { Artist } from './artist.model';
import { Album } from './album.model';
import { Song } from './song.model';

export interface DiscoveryResponse {
  genre: string;
  content_type: string;
  artists?: {
    items: Artist[];
    count: number;
  };
  albums?: {
    items: Album[];
    count: number;
  };
  songs?: {
    items: Song[];
    count: number;
  };
  total_count: number;
}