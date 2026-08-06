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

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentpage, setcurrentpage] = useState<string>('home');
  const [playersource, setplayersource] = useState<VideoSource>('videasy');
  const [mylist, setmylist] = useState<MediaItem[]>([]);
  const [history, sethistory] = useState<WatchHistoryItem[]>([]);
  const [audiosettings, setaudiosettings] = useState<AudioSettings>({
    enabled: false,
    spatial: false,
    volume: 0.45,
    width: 0.6,
    depth: 0.45
  });
  const [audiopanelopen, setaudiopanelopen] = useState<boolean>(false);
  const [detailitem, setdetailitem] = useState<MediaItem | null>(null);
  const [activeplayer, setactiveplayer] = useState<PlayerConfig | null>(null);
  const [searchquery, setsearchquery] = useState<string>('');
  const [filtergenre, setfiltergenre] = useState<{ id: number; name: string } | null>(null);
  const [syncmodalopen, setsyncmodalopen] = useState<boolean>(false);
  const [toastmsg, setToastmsg] = useState<string | null>(null);

  const audiosettingsref = useRef(audiosettings);
  audiosettingsref.current = audiosettings;

  useEffect(() => {
    try {
      const p = localStorage.getItem('vk_player');
      if (p === 'videasy' || p === 'vidking' || p === 'vyla') setplayersource(p);

      const l = localStorage.getItem('vk_mylist');
      if (l) setmylist(JSON.parse(l));

      const h = localStorage.getItem('vk_hist');
      if (h) sethistory(JSON.parse(h));

      const a = localStorage.getItem('vk_audio');
      if (a) setaudiosettings(JSON.parse(a));
    } catch (_) {}

    setupaudiopanning(() => audiosettingsref.current);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('vk_player', playersource);
    } catch (_) {}
  }, [playersource]);

  useEffect(() => {
    try {
      localStorage.setItem('vk_mylist', JSON.stringify(mylist));
    } catch (_) {}
  }, [mylist]);

  useEffect(() => {
    try {
      localStorage.setItem('vk_hist', JSON.stringify(history));
    } catch (_) {}
  }, [history]);

  useEffect(() => {
    try {
      localStorage.setItem('vk_audio', JSON.stringify(audiosettings));
    } catch (_) {}
    updateambienthum(audiosettings);
  }, [audiosettings]);

  const showtoast = (msg: string) => {
    setToastmsg(msg);
    setTimeout(() => {
      setToastmsg(null);
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
    if (data.mylist) setmylist(data.mylist);
    if (data.history) sethistory(data.history);
    if (data.audiosettings) setaudiosettings(data.audiosettings);
    if (data.playersource) setplayersource(data.playersource);
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
      {toastmsg && <div className="account-toast active">{toastmsg}</div>}
    </AppContext.Provider>
  );
}

export function useapp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useapp must be used within AppProvider');
  return ctx;
}
