'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { MediaItem, VideoSource, AudioSettings, WatchHistoryItem, SyncState, PlayerConfig } from '../lib/types';
import { updateambienthum, setupaudiopanning } from '../lib/audio';

interface AppContextType {
  currentpage: string;
  setcurrentpage: (page: string) => void;
  playersource: VideoSource;
  setplayersource: (src: VideoSource) => void;
  mylist: MediaItem[];
  togglemylist: (item: MediaItem) => void;
  isinmylist: (id: string) => boolean;
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
  openmodal: (name: string, data?: any) => void;
  closemodal: () => void;
  restoresyncdata: (data: SyncState) => void;
  toastmsg: string | null;
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

function clamp01(v: any, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function sanitizeaudio(raw: any): AudioSettings {
  if (!raw || typeof raw !== 'object') return { ...defaultaudio };
  return {
    enabled: Boolean(raw.enabled),
    spatial: Boolean(raw.spatial),
    volume: clamp01(raw.volume, defaultaudio.volume),
    width: clamp01(raw.width, defaultaudio.width),
    depth: clamp01(raw.depth, defaultaudio.depth)
  };
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
    const readjson = (key: string) => {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch (_) {
        try { localStorage.removeItem(key); } catch (__) {}
        return null;
      }
    };

    try {
      const p = localStorage.getItem('vk_player');
      if (p === 'videasy' || p === 'vidking' || p === 'vyla') setplayersource(p);

      const l = readjson('vk_mylist');
      if (Array.isArray(l)) setmylist(l.filter(i => i && typeof i.id === 'string'));

      const h = readjson('vk_hist');
      if (Array.isArray(h)) sethistory(h.filter(i => i && typeof i.id === 'string'));

      const a = readjson('vk_audio');
      if (a && typeof a === 'object') setaudiosettings(prev => sanitizeaudio({ ...prev, ...a }));
    } catch (_) {
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
    } catch (_) {}
  }, [hydrated, playersource]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem('vk_mylist', JSON.stringify(mylist));
    } catch (_) {}
  }, [hydrated, mylist]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem('vk_hist', JSON.stringify(history));
    } catch (_) {}
  }, [hydrated, history]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem('vk_audio', JSON.stringify(audiosettings));
    } catch (_) {}
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

  const showtoast = (msg: string) => {
    if (toasttimer.current) clearTimeout(toasttimer.current);
    setToastmsg(msg);
    toasttimer.current = setTimeout(() => {
      setToastmsg(null);
      toasttimer.current = null;
    }, 3000);
  };

  const togglemylist = (item: MediaItem) => {
    setmylist(prev => {
      const exists = prev.some(i => i.id === item.id);
      if (exists) {
        showtoast('Đã xóa khỏi danh sách của tôi');
        return prev.filter(i => i.id !== item.id);
      }
      showtoast('Đã thêm vào danh sách của tôi');
      return [item, ...prev].slice(0, 100);
    });
  };

  const isinmylist = (id: string) => mylist.some(i => i.id === id);

  const clearmylist = () => {
    setmylist([]);
    try { localStorage.removeItem('vk_mylist'); } catch (_) {}
    showtoast('Đã xóa danh sách của tôi');
  };

  const savehistory = (item: WatchHistoryItem) => {
    sethistory(prev => {
      const filtered = prev.filter(i => !(i.id === item.id && i.mediatype === item.mediatype));
      return [item, ...filtered].slice(0, 30);
    });
  };

  const clearhistory = () => {
    sethistory([]);
    try { localStorage.removeItem('vk_hist'); } catch (_) {}
    showtoast('Đã xóa lịch sử xem');
  };

  const clearprogress = () => {
    try {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('vk_p_')) localStorage.removeItem(k);
      });
    } catch (_) {}
    showtoast('Đã xóa tiến độ xem');
  };

  const clearcache = () => {
    try {
      sessionStorage.clear();
    } catch (_) {}
    showtoast('Đã xóa bộ nhớ đệm');
  };

  const opendetail = (item: MediaItem) => {
    setdetailitem(item);
  };

  const closedetail = () => {
    setdetailitem(null);
  };

  const playcontent = (item: MediaItem, season?: number | null, episode?: number | null) => {
    setactiveplayer({ item, season, episode });
  };

  const closeplayer = () => {
    setactiveplayer(null);
  };

  const openmodal = (name: string, data?: any) => {
    if (name === 'sync') setsyncmodalopen(true);
    if (name === 'detail' && data) setdetailitem(data);
    if (name === 'audio') setaudiopanelopen(true);
  };

  const closemodal = () => {
    setsyncmodalopen(false);
    setdetailitem(null);
    setaudiopanelopen(false);
  };

  const restoresyncdata = (data: SyncState) => {
    if (!data || typeof data !== 'object') return;
    if (Array.isArray(data.mylist)) setmylist(data.mylist.filter(i => i && typeof i.id === 'string'));
    if (Array.isArray(data.history)) sethistory(data.history.filter(i => i && typeof i.id === 'string'));
    if (data.audiosettings) setaudiosettings(sanitizeaudio(data.audiosettings));
    if (data.playersource === 'videasy' || data.playersource === 'vidking' || data.playersource === 'vyla') {
      setplayersource(data.playersource);
    }
    showtoast('Đồng bộ dữ liệu thành công!');
  };

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
        openmodal,
        closemodal,
        restoresyncdata,
        toastmsg,
        showtoast
      }}
    >
      {children}
      {toastmsg && <div className="account-toast show" role="status" aria-live="polite">{toastmsg}</div>}
    </AppContext.Provider>
  );
}

export function useapp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useapp must be used within AppProvider');
  return ctx;
}
