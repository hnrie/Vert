'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { MediaItem, VideoSource, AudioSettings, WatchHistoryItem, PlayerConfig } from '../lib/types';
import { updateambienthum, setupaudiopanning } from '../lib/audio';
import { isrecord, optionalnumber } from '../lib/utils';

interface AppContextType {
  currentpage: string;
  setcurrentpage: (page: string) => void;
  playersource: VideoSource;
  setplayersource: (src: VideoSource) => void;
  mylist: MediaItem[];
  togglemylist: (item: MediaItem) => void;
  isinmylist: (item: Pick<MediaItem, 'id' | 'type'>) => boolean;
  clearmylist: () => void;
  history: WatchHistoryItem[];
  savehistory: (item: WatchHistoryItem) => void;
  clearhistory: () => void;
  clearprogress: () => void;
  clearcache: () => void;
  audiosettings: AudioSettings;
  setaudiosettings: React.Dispatch<React.SetStateAction<AudioSettings>>;
  audiopanelopen: boolean;
  setaudiopanelopen: (open: boolean) => void;
  detailitem: MediaItem | null;
  opendetail: (item: MediaItem) => void;
  closedetail: () => void;
  activeplayer: PlayerConfig | null;
  playcontent: (item: MediaItem, season?: number | null, episode?: number | null) => void;
  closeplayer: () => void;
  searchquery: string;
  setsearchquery: (q: string) => void;
  filtergenre: { id: number; name: string } | null;
  setfiltergenre: (g: { id: number; name: string } | null) => void;
  syncmodalopen: boolean;
  setsyncmodalopen: (open: boolean) => void;
  restoresyncdata: (data: unknown) => void;
  showtoast: (msg: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const defaultaudio: AudioSettings = {
  enabled: false,
  spatial: false,
  volume: 0.45,
  width: 0.6,
  depth: 0.45
};

function clamp01(v: unknown, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function sanitizeaudio(raw: unknown): AudioSettings {
  if (!isrecord(raw)) return { ...defaultaudio };
  return {
    enabled: Boolean(raw.enabled),
    spatial: Boolean(raw.spatial),
    volume: clamp01(raw.volume, defaultaudio.volume),
    width: clamp01(raw.width, defaultaudio.width),
    depth: clamp01(raw.depth, defaultaudio.depth)
  };
}

function optionaltext(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

function sanitizemediaitem(value: unknown): MediaItem | null {
  if (!isrecord(value)) return null;
  if (typeof value.id !== 'string' || !value.id) return null;
  if (value.type !== 'movie' && value.type !== 'tv') return null;
  const genreids = Array.isArray(value.genreids)
    ? value.genreids.map(id => Number(id)).filter(Number.isFinite)
    : [];
  return {
    id: value.id,
    title: typeof value.title === 'string' ? value.title : '',
    type: value.type,
    poster: optionaltext(value.poster),
    backdrop: optionaltext(value.backdrop),
    desc: typeof value.desc === 'string' ? value.desc : '',
    rating: optionaltext(value.rating),
    year: optionaltext(value.year),
    genreids
  };
}

function sanitizehistoryitem(value: unknown): WatchHistoryItem | null {
  if (!isrecord(value)) return null;
  if (typeof value.id !== 'string' || !value.id) return null;
  if (value.mediatype !== 'movie' && value.mediatype !== 'tv') return null;
  return {
    id: value.id,
    mediatype: value.mediatype,
    title: typeof value.title === 'string' ? value.title : '',
    poster: optionaltext(value.poster),
    backdrop: optionaltext(value.backdrop),
    year: optionaltext(value.year),
    rating: optionaltext(value.rating),
    currenttime: Number(value.currenttime) || 0,
    duration: Number(value.duration) || 0,
    progress: Number(value.progress) || 0,
    season: optionalnumber(value.season),
    episode: optionalnumber(value.episode),
    updatedat: Number(value.updatedat) || 0
  };
}

function sanitizemylist(value: unknown): MediaItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(sanitizemediaitem)
    .filter((item): item is MediaItem => item !== null);
}

function sanitizehistory(value: unknown): WatchHistoryItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(sanitizehistoryitem)
    .filter((item): item is WatchHistoryItem => item !== null);
}

function isvideosource(value: unknown): value is VideoSource {
  return value === 'videasy' || value === 'vidking' || value === 'vyla';
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentpage, setcurrentpage] = useState<string>('home');
  const [playersource, setplayersource] = useState<VideoSource>('videasy');
  const [mylist, setmylist] = useState<MediaItem[]>([]);
  const [history, sethistory] = useState<WatchHistoryItem[]>([]);
  const [audiosettings, setaudiosettings] = useState<AudioSettings>({ ...defaultaudio });
  const [audiopanelopen, setaudiopanelopen] = useState<boolean>(false);
  const [detailitem, setdetailitem] = useState<MediaItem | null>(null);
  const [activeplayer, setactiveplayer] = useState<PlayerConfig | null>(null);
  const [searchquery, setsearchquery] = useState<string>('');
  const [filtergenre, setfiltergenre] = useState<{ id: number; name: string } | null>(null);
  const [syncmodalopen, setsyncmodalopen] = useState<boolean>(false);
  const [toastmsg, setToastmsg] = useState<string | null>(null);

  const audiosettingsref = useRef(audiosettings);
  audiosettingsref.current = audiosettings;

  const toasttimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hydrated, sethydrated] = useState<boolean>(false);

  useEffect(() => {
    const readjson = (key: string): unknown => {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch {
        try { localStorage.removeItem(key); } catch {}
        return null;
      }
    };

    try {
      const p = localStorage.getItem('vk_player');
      if (isvideosource(p)) setplayersource(p);

      setmylist(sanitizemylist(readjson('vk_mylist')));
      sethistory(sanitizehistory(readjson('vk_hist')));

      const a = readjson('vk_audio');
      if (isrecord(a)) setaudiosettings(prev => sanitizeaudio({ ...prev, ...a }));
    } catch {
    } finally {
      sethydrated(true);
    }

    setupaudiopanning(() => audiosettingsref.current);

    return () => {
      if (toasttimer.current) clearTimeout(toasttimer.current);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem('vk_player', playersource);
    } catch {}
  }, [hydrated, playersource]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem('vk_mylist', JSON.stringify(mylist));
    } catch {}
  }, [hydrated, mylist]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem('vk_hist', JSON.stringify(history));
    } catch {}
  }, [hydrated, history]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem('vk_audio', JSON.stringify(audiosettings));
    } catch {}
    updateambienthum(audiosettings);
  }, [hydrated, audiosettings]);

  useEffect(() => {
    const locked = Boolean(detailitem || activeplayer || syncmodalopen || audiopanelopen);
    if (!locked) return;
    const body = document.body;
    const prevoverflow = body.style.overflow;
    const prevpad = body.style.paddingRight;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    return () => {
      body.style.overflow = prevoverflow;
      body.style.paddingRight = prevpad;
    };
  }, [detailitem, activeplayer, syncmodalopen, audiopanelopen]);

  const showtoast = useCallback((msg: string) => {
    if (toasttimer.current) clearTimeout(toasttimer.current);
    setToastmsg(msg);
    toasttimer.current = setTimeout(() => {
      setToastmsg(null);
      toasttimer.current = null;
    }, 3000);
  }, []);

  const togglemylist = useCallback((item: MediaItem) => {
    setmylist(prev => {
      const exists = prev.some(i => i.id === item.id && i.type === item.type);
      if (exists) {
        showtoast('Đã xóa khỏi danh sách của tôi');
        return prev.filter(i => !(i.id === item.id && i.type === item.type));
      }
      showtoast('Đã thêm vào danh sách của tôi');
      return [item, ...prev].slice(0, 100);
    });
  }, [showtoast]);

  const isinmylist = useCallback(
    (item: Pick<MediaItem, 'id' | 'type'>) => mylist.some(i => i.id === item.id && i.type === item.type),
    [mylist]
  );

  const clearmylist = useCallback(() => {
    setmylist([]);
    try { localStorage.removeItem('vk_mylist'); } catch {}
    showtoast('Đã xóa danh sách của tôi');
  }, [showtoast]);

  const savehistory = useCallback((item: WatchHistoryItem) => {
    sethistory(prev => {
      const filtered = prev.filter(i => !(i.id === item.id && i.mediatype === item.mediatype));
      return [item, ...filtered].slice(0, 30);
    });
  }, []);

  const clearhistory = useCallback(() => {
    sethistory([]);
    try { localStorage.removeItem('vk_hist'); } catch {}
    showtoast('Đã xóa lịch sử xem');
  }, [showtoast]);

  const clearprogress = useCallback(() => {
    try {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('vk_p_')) localStorage.removeItem(k);
      });
    } catch {}
    showtoast('Đã xóa tiến độ xem');
  }, [showtoast]);

  const clearcache = useCallback(() => {
    try {
      sessionStorage.clear();
    } catch {}
    showtoast('Đã xóa bộ nhớ đệm');
  }, [showtoast]);

  const opendetail = useCallback((item: MediaItem) => {
    setdetailitem(item);
  }, []);

  const closedetail = useCallback(() => {
    setdetailitem(null);
  }, []);

  const playcontent = useCallback((item: MediaItem, season?: number | null, episode?: number | null) => {
    setactiveplayer({ item, season, episode });
  }, []);

  const closeplayer = useCallback(() => {
    setactiveplayer(null);
  }, []);

  const restoresyncdata = useCallback((data: unknown) => {
    if (!isrecord(data)) return;
    if (Array.isArray(data.mylist)) setmylist(sanitizemylist(data.mylist));
    if (Array.isArray(data.history)) sethistory(sanitizehistory(data.history));
    if (data.audiosettings) setaudiosettings(sanitizeaudio(data.audiosettings));
    if (isvideosource(data.playersource)) setplayersource(data.playersource);
    showtoast('Đồng bộ dữ liệu thành công!');
  }, [showtoast]);

  return (
    <AppContext.Provider
      value={{
        currentpage,
        setcurrentpage,
        playersource,
        setplayersource,
        mylist,
        togglemylist,
        isinmylist,
        clearmylist,
        history,
        savehistory,
        clearhistory,
        clearprogress,
        clearcache,
        audiosettings,
        setaudiosettings,
        audiopanelopen,
        setaudiopanelopen,
        detailitem,
        opendetail,
        closedetail,
        activeplayer,
        playcontent,
        closeplayer,
        searchquery,
        setsearchquery,
        filtergenre,
        setfiltergenre,
        syncmodalopen,
        setsyncmodalopen,
        restoresyncdata,
        showtoast
      }}
    >
      {children}
      {toastmsg && <div className="account-toast show" role="status" aria-live="polite">{toastmsg}</div>}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
