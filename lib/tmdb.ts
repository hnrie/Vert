import { MediaItem } from './types';

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

export async function fetchtmdb(ep: string, extra: Record<string, string | number> = {}, signal?: AbortSignal) {
  const queryparams = new URLSearchParams();
  queryparams.set('ep', ep);
  Object.entries(extra).forEach(([k, v]) => {
    queryparams.set(k, String(v));
  });

  const res = await fetch(`/api/tmdb?${queryparams.toString()}`, { signal });
  if (!res.ok) {
    throw new Error(`TMDB error ${res.status}`);
  }
  return await res.json();
}

export function norm(item: any, fallback?: string): MediaItem | null {
  if (!item) return null;
  const mt = item.media_type || fallback || 'movie';
  if (mt === 'person') return null;
  return {
    id: String(item.id),
    title: item.title || item.name || '',
    type: mt === 'tv' ? 'tv' : 'movie',
    poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
    backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null,
    desc: item.overview || '',
    rating: item.vote_average ? item.vote_average.toFixed(1) : null,
    year: (item.release_date || item.first_air_date || '').slice(0, 4) || null,
    genreids: item.genre_ids || (item.genres ? item.genres.map((g: any) => g.id) : [])
  };
}

export function genrenames(ids: number[]): string[] {
  return (ids || []).map(i => GENRE_MAP[i]).filter(Boolean);
}
