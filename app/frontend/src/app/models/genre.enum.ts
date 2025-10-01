/**
 * Music genres available in the application
 */
export enum Genre {
  AFROBEAT = 'Afrobeat',
  ALTERNATIVE = 'Alternative',
  AMBIENT = 'Ambient',
  BLUES = 'Blues',
  CLASSICAL = 'Classical',
  COUNTRY = 'Country',
  DISCO = 'Disco',
  DUBSTEP = 'Dubstep',
  ELECTRONIC = 'Electronic',
  FOLK = 'Folk',
  FUNK = 'Funk',
  GOSPEL = 'Gospel',
  HIP_HOP = 'Hip Hop',
  HOUSE = 'House',
  INDIE = 'Indie',
  JAZZ = 'Jazz',
  K_POP = 'K-Pop',
  LATIN = 'Latin',
  METAL = 'Metal',
  OPERA = 'Opera',
  POP = 'Pop',
  PUNK = 'Punk',
  R_AND_B = 'R&B',
  REGGAE = 'Reggae',
  ROCK = 'Rock',
  SOUL = 'Soul',
  TECHNO = 'Techno',
  TRAP = 'Trap',
  WORLD = 'World'
}

/**
 * Helper function to get all genre values as an array
 */
export function getAllGenres(): string[] {
  return Object.values(Genre).sort();
}

/**
 * Helper function to check if a string is a valid genre
 */
export function isValidGenre(value: string): boolean {
  return Object.values(Genre).includes(value as Genre);
}
