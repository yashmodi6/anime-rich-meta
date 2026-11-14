export interface AnimeRecord {
  id: number;
  title: {
    romaji: string | null;
    english: string | null;
    native: string | null;
  };
  synonyms: string[];
  posterUrl: string | null;
  airDate: string | null;
  episodes: number | null;
  format: string | null;
  status: string | null;
  popularity: number | null;
  averageScore: number | null;
}

export interface AnimeApiResponse {
  items: AnimeRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TmdbImageNode {
  file_path: string;
  width: number;
  height: number;
  iso_639_1?: string | null;
  vote_average?: number;
}

export interface TmdbImagesResult {
  posters: TmdbImageNode[];
  backdrops: TmdbImageNode[];
  logos: TmdbImageNode[];
}

export interface AnimeMapping {
  anilist_id: number;
  tmdb_id: number;
  media_type: 'tv' | 'movie';
  poster: string | null;
  backdrop: string | null;
  logo: string | null;
  clearlogoWhite?: string | null;
  updated_at?: string;
}
