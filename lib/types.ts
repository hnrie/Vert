export interface MediaItem {
  id: string;
  title: string;
  type: 'movie' | 'tv';
  poster: string | null;
  backdrop: string | null;
  desc: string;
  rating: string | null;
  year: string | null;
  genreids: number[];
}

export interface Episode {
  id: number;
  episode_number: number;
  name: string;
  overview: string;
  still_path: string | null;
  vote_average: number;
  air_date: string;
}

export type VideoSource = 'videasy' | 'vidking' | 'vyla';

export interface AudioSettings {
  enabled: boolean;
  spatial: boolean;
  volume: number;
  width: number;
  depth: number;
}

export interface WatchHistoryItem {
  id: string;
  mediatype: 'movie' | 'tv';
  title: string;
  poster: string | null;
  backdrop: string | null;
  year: string | null;
  rating: string | null;
  currenttime: number;
  duration: number;
  progress: number;
  season: number | null;
  episode: number | null;
  updatedat: number;
}

export interface SyncState {
  mylist: MediaItem[];
  history: WatchHistoryItem[];
  audiosettings: AudioSettings;
  playersource: VideoSource;
}

export interface PlayerConfig {
  item: MediaItem;
  season?: number | null;
  episode?: number | null;
}

export interface RowEntry {
  item: MediaItem;
  progress?: number;
  season?: number | null;
  episode?: number | null;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}
