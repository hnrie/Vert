import { MediaItem } from './types';
import { isrecord } from './utils';

export interface TmdbListResponse {
  results?: unknown;
}

export const GENRE_MAP: Record<number, string> = {
  28: 'Hành Động',
  12: 'Phiêu Lưu',
  16: 'Hoạt Hình',
  35: 'Hài Hước',
  80: 'Tội Phạm',
  99: 'Tài Liệu',
  18: 'Chính Kịch',
  10751: 'Gia Đình',
  14: 'Kỳ Ảo',
  36: 'Lịch Sử',
  27: 'Kinh Dị',
  10402: 'Âm Nhạc',
  9648: 'Bí Ẩn',
  10749: 'Lãng Mạn',
  878: 'Viễn Tưởng',
  10770: 'Phim Truyền Hình',
  53: 'Giật Gân',
  10752: 'Chiến Tranh',
  37: 'Miền Tây',
  10759: 'Hành Động & Phiêu Lưu',
  10762: 'Trẻ Em',
  10763: 'Tin Tức',
  10764: 'Thực Tế',
  10765: 'Viễn Tưởng & Kỳ Ảo',
  10766: 'Phim Dài Tập',
  10767: 'Trò Chuyện',
  10768: 'Chiến Tranh & Chính Trị'
};

export const GENRE_LIST = [
  { id: 28, name: 'Hành Động' },
  { id: 12, name: 'Phiêu Lưu' },
  { id: 16, name: 'Hoạt Hình' },
  { id: 35, name: 'Hài Hước' },
  { id: 80, name: 'Tội Phạm' },
  { id: 99, name: 'Tài Liệu' },
  { id: 18, name: 'Chính Kịch' },
  { id: 10751, name: 'Gia Đình' },
  { id: 14, name: 'Kỳ Ảo' },
  { id: 36, name: 'Lịch Sử' },
  { id: 27, name: 'Kinh Dị' },
  { id: 10402, name: 'Âm Nhạc' },
  { id: 9648, name: 'Bí Ẩn' },
  { id: 10749, name: 'Lãng Mạn' },
  { id: 878, name: 'Viễn Tưởng' },
  { id: 53, name: 'Giật Gân' },
  { id: 10752, name: 'Chiến Tranh' },
  { id: 10759, name: 'Hành Động & Phiêu Lưu' },
  { id: 10765, name: 'Viễn Tưởng & Kỳ Ảo' }
];

export async function fetchtmdb<T = unknown>(
  ep: string,
  extra: Record<string, string | number> = {},
  signal?: AbortSignal
): Promise<T> {
  const queryparams = new URLSearchParams();
  queryparams.set('ep', ep);
  Object.entries(extra).forEach(([k, v]) => {
    queryparams.set(k, String(v));
  });

  const res = await fetch(`/api/tmdb?${queryparams.toString()}`, { signal });
  if (!res.ok) {
    throw new Error(`TMDB error ${res.status}`);
  }
  return await res.json() as T;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function imageurl(path: unknown, size: string): string | null {
  const value = text(path);
  return value ? `https://image.tmdb.org/t/p/${size}${value}` : null;
}

export function norm(item: unknown, fallback?: 'movie' | 'tv'): MediaItem | null {
  if (!isrecord(item)) return null;
  const rawid = item.id;
  if (typeof rawid !== 'number' && typeof rawid !== 'string') return null;

  const media = text(item.media_type);
  const mt = media || fallback || 'movie';
  if (mt === 'person') return null;

  const vote = typeof item.vote_average === 'number' ? item.vote_average : Number(item.vote_average);
  const genres = Array.isArray(item.genre_ids)
    ? item.genre_ids
    : Array.isArray(item.genres)
      ? item.genres
      : [];
  const genreids = genres
    .map(genre => isrecord(genre) ? Number(genre.id) : Number(genre))
    .filter(Number.isFinite);
  const released = text(item.release_date) || text(item.first_air_date);

  return {
    id: String(rawid),
    title: text(item.title) || text(item.name),
    type: mt === 'tv' ? 'tv' : 'movie',
    poster: imageurl(item.poster_path, 'w500'),
    backdrop: imageurl(item.backdrop_path, 'w1280'),
    desc: text(item.overview),
    rating: Number.isFinite(vote) && vote > 0 ? vote.toFixed(1) : null,
    year: released.slice(0, 4) || null,
    genreids
  };
}

export function normlist(items: unknown, fallback?: 'movie' | 'tv'): MediaItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map(item => norm(item, fallback))
    .filter((item): item is MediaItem => item !== null);
}

export function genrenames(ids: number[]): string[] {
  return ids.map(id => GENRE_MAP[id]).filter((name): name is string => Boolean(name));
}
