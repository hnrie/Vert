'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MediaItem } from '../../lib/types';
import Hls from 'hls.js';

interface VylaPlayerProps {
  item: MediaItem;
  season?: number | null;
  episode?: number | null;
  onClose?: () => void;
}

interface SourceItem {
  url: string;
  label?: string;
  source?: string;
}

interface SubItem {
  label: string;
  file: string;
}

export default function VylaPlayer({ item, season, episode, onClose }: VylaPlayerProps) {
  const playerwrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const tokenRef = useRef<string | null>(null);
  const triedSourcesRef = useRef<Set<string>>(new Set());
  const manifestTimerRef = useRef<any>(null);

  const [title, setTitle] = useState<string>('');
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [subtitles, setSubtitles] = useState<SubItem[]>([]);
  const [activesub, setActivesub] = useState<number>(0);
  const [levels, setLevels] = useState<{ id: number; label: string }[]>([]);
  const [currentlevel, setCurrentlevel] = useState<number>(-1);
  const [isplaying, setIsplaying] = useState<boolean>(false);
  const [ismuted, setIsmuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(100);
  const [curtime, setCurtime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isloading, setIsloading] = useState<boolean>(true);
  const [loadlabel, setLoadlabel] = useState<string>('Đang kết nối...');
  const [error, setError] = useState<string | null>(null);
  const [showcontrols, setShowcontrols] = useState<boolean>(false);

  const isMp4 = (u: string) => {
    try {
      const inner = new URL(u).searchParams.get('url') || u;
      return /\.(mp4|mkv)(\?|$)/i.test(inner);
    } catch {
      return /\.(mp4|mkv)(\?|$)/i.test(u);
    }
  };

  const fmttime = (s: number) => {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const h = Math.floor(m / 60);
    return h > 0
      ? `${h}:${String(m % 60).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
      : `${m}:${String(sec).padStart(2, '0')}`;
  };

  const gettoken = async () => {
    if (tokenRef.current) return tokenRef.current;
    setLoadlabel('Đang xác thực...');
    const r = await fetch('/api/vyla-auth', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    if (!r.ok) throw new Error('Xác thực thất bại');
    const data = await r.json();
    tokenRef.current = data.token;
    return data.token;
  };

  const trynextsource = (failedurl?: string) => {
    if (manifestTimerRef.current) clearTimeout(manifestTimerRef.current);
    if (failedurl) triedSourcesRef.current.add(failedurl);
    const next = sources.find(s => !triedSourcesRef.current.has(s.url));
    if (next) {
      switchsource(next.url, next.label || next.source);
    } else {
      setError('Tất cả nguồn đều thất bại.');
      setIsloading(false);
    }
  };

  const switchsource = (url: string, label?: string) => {
    setActiveUrl(url);
    setIsloading(true);
    setError(null);
    setLoadlabel(`Đang tải ${label || 'nguồn'}...`);
    setLevels([]);
    setCurrentlevel(-1);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (manifestTimerRef.current) clearTimeout(manifestTimerRef.current);

    const vid = videoRef.current;
    if (!vid) return;
    vid.removeAttribute('src');
    vid.load();

    manifestTimerRef.current = setTimeout(() => {
      trynextsource(url);
    }, 15000);

    if (isMp4(url)) {
      if (manifestTimerRef.current) clearTimeout(manifestTimerRef.current);
      vid.src = url;
      vid.play().catch(() => {});
      return;
    }

    const proxiedurl = url.includes('api.vyla.cc')
      ? `/api/vyla-proxy?url=${encodeURIComponent(url)}`
      : url;

    if (Hls.isSupported()) {
      const hls = new Hls({
        startLevel: -1,
        fragLoadingMaxRetry: 8,
        fragLoadingRetryDelay: 500,
        manifestLoadingMaxRetry: 4,
        levelLoadingMaxRetry: 4,
        xhrSetup: (xhr, requrl) => {
          if (requrl && requrl.includes('api.vyla.cc') && tokenRef.current) {
            try { xhr.setRequestHeader('X-Session-Token', tokenRef.current); } catch (_) {}
          }
        }
      });
      hlsRef.current = hls;
      hls.loadSource(proxiedurl);
      hls.attachMedia(vid);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        if (manifestTimerRef.current) clearTimeout(manifestTimerRef.current);
        setIsloading(false);
        vid.play().catch(() => {});
        if (data.levels.length > 1) {
          const lvls = data.levels.map((lvl, i) => ({
            id: i,
            label: lvl.height ? `${lvl.height}p` : `Level ${i}`
          }));
          setLevels(lvls);
        }
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        setCurrentlevel(hls.autoLevelEnabled ? -1 : data.level);
      });

      hls.on(Hls.Events.ERROR, (_, err) => {
        if (err.fatal) {
          trynextsource(url);
        }
      });
      return;
    }

    if (vid.canPlayType('application/vnd.apple.mpegurl')) {
      vid.src = proxiedurl;
      vid.addEventListener('loadedmetadata', () => {
        if (manifestTimerRef.current) clearTimeout(manifestTimerRef.current);
        setIsloading(false);
        vid.play().catch(() => {});
      }, { once: true });
      return;
    }

    if (manifestTimerRef.current) clearTimeout(manifestTimerRef.current);
    setError('Trình duyệt không hỗ trợ HLS.');
    setIsloading(false);
  };

  useEffect(() => {
    let ismounted = true;

    const loadstream = async () => {
      if (!item.id) {
        setError('Thiếu ID phim.');
        setIsloading(false);
        return;
      }
      try {
        const tok = await gettoken();
        const apiurl = season && episode
          ? `https://api.vyla.cc/tv?id=${item.id}&season=${season}&episode=${episode}`
          : `https://api.vyla.cc/movie?id=${item.id}`;

        if (ismounted) setLoadlabel('Đang tìm nguồn...');
        triedSourcesRef.current.clear();
        setSources([]);

        const res = await fetch(apiurl, { headers: { 'X-Session-Token': tok } });
        if (!res.ok) {
          if (res.status === 403) throw new Error('Không có quyền truy cập streaming.');
          throw new Error(`Lỗi API: ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error('Không thể đọc stream.');
        const decoder = new TextDecoder();
        let buffer = '';
        let started = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === 'meta') {
                const t = event.meta?.title || event.meta?.name || item.title;
                if (ismounted) {
                  setTitle(t + (season ? ` S${season}E${episode || 1}` : ''));
                  setSubtitles(event.subtitles || []);
                }
              }
              if (event.type === 'source') {
                const src: SourceItem = event.source;
                if (ismounted) {
                  setSources(prev => [...prev, src]);
                  if (!started) {
                    started = true;
                    switchsource(src.url, src.label || src.source);
                  }
                }
              }
              if (event.type === 'done' && !started) {
                if (ismounted) {
                  setError('Không tìm thấy nguồn video.');
                  setIsloading(false);
                }
              }
            } catch (_) {}
          }
        }
      } catch (e: any) {
        if (ismounted) {
          setError(e.message || 'Lỗi kết nối.');
          setIsloading(false);
        }
      }
    };

    loadstream();

    return () => {
      ismounted = false;
      if (hlsRef.current) hlsRef.current.destroy();
      if (manifestTimerRef.current) clearTimeout(manifestTimerRef.current);
    };
  }, [item, season, episode]);

  const toggleplay = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) vid.play().catch(() => {});
    else vid.pause();
  };

  const togglemute = () => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = !vid.muted;
    setIsmuted(vid.muted);
  };

  const handlevolume = (val: number) => {
    setVolume(val);
    const vid = videoRef.current;
    if (!vid) return;
    vid.volume = val / 100;
    vid.muted = val === 0;
    setIsmuted(vid.muted);
  };

  const handleseek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const vid = videoRef.current;
    if (vid && vid.duration) {
      vid.currentTime = pct * vid.duration;
    }
  };

  const handlequality = (val: number) => {
    setCurrentlevel(val);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = val;
    }
  };

  const togglefullscreen = () => {
    const el = playerwrapRef.current;
    if (!el) return;
    if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
      if (document.exitFullscreen) document.exitFullscreen();
      else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
    } else {
      if (el.requestFullscreen) el.requestFullscreen();
      else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();
    }
  };

  const selectsub = (idx: number) => {
    setActivesub(idx);
    const vid = videoRef.current;
    if (!vid) return;
    Array.from(vid.textTracks).forEach((t, i) => {
      t.mode = i === idx ? 'showing' : 'hidden';
    });
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const vid = videoRef.current;
      if (!vid) return;
      if (e.key === ' ') {
        e.preventDefault();
        toggleplay();
      } else if (e.key === 'ArrowLeft') {
        vid.currentTime = Math.max(0, vid.currentTime - 10);
      } else if (e.key === 'ArrowRight') {
        vid.currentTime = Math.min(vid.duration || 0, vid.currentTime + 10);
      } else if (e.key === 'f') {
        togglefullscreen();
      } else if (e.key === 'm') {
        togglemute();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const progresspct = duration ? (curtime / duration) * 100 : 0;

  return (
    <div
      id="player-wrap"
      ref={playerwrapRef}
      onMouseEnter={() => setShowcontrols(true)}
      onMouseLeave={() => setShowcontrols(false)}
      onClick={() => setShowcontrols(prev => !prev)}
      style={{ position: 'relative', width: '100%', height: '100%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <video
        id="video"
        ref={videoRef}
        playsInline
        style={{ width: '100%', height: '100%', background: '#000', objectFit: 'contain' }}
        onPlay={() => setIsplaying(true)}
        onPause={() => setIsplaying(false)}
        onTimeUpdate={() => {
          const vid = videoRef.current;
          if (vid) {
            setCurtime(vid.currentTime || 0);
            setDuration(vid.duration || 0);
            if (Math.random() < 0.1 && typeof window !== 'undefined') {
              window.postMessage({
                type: 'PLAYER_EVENT',
                data: {
                  id: item.id,
                  mediaType: season ? 'tv' : 'movie',
                  currentTime: vid.currentTime || 0,
                  duration: vid.duration || 0,
                  progress: vid.duration ? (vid.currentTime / vid.duration) * 100 : 0,
                  season: season || null,
                  episode: episode || null
                }
              }, '*');
            }
          }
        }}
        onCanPlay={() => setIsloading(false)}
      >
        {subtitles.map((sub, i) => (
          <track
            key={i}
            kind="subtitles"
            label={sub.label}
            srcLang={sub.label.slice(0, 2).toLowerCase()}
            src={sub.file.startsWith('data:') ? sub.file : `/api/vyla-sub?url=${encodeURIComponent(sub.file)}`}
            default={i === 0}
          />
        ))}
      </video>

      <div
        id="top-bar"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '12px 16px',
          background: 'linear-gradient(rgba(0,0,0,0.7), transparent)',
          opacity: showcontrols ? 1 : 0,
          transition: 'opacity 0.3s',
          zIndex: 5,
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}
      >
        <span id="title" style={{ fontSize: '0.9rem', fontWeight: 600, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title || item.title}
        </span>

        {levels.length > 0 && (
          <select
            id="quality-select"
            value={currentlevel}
            onChange={e => handlequality(Number(e.target.value))}
            style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, padding: '4px 8px', fontSize: '0.75rem' }}
          >
            <option value="-1">Auto</option>
            {levels.map(l => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>
        )}

        <button id="fs-btn" className="ctrl-btn" onClick={e => { e.stopPropagation(); togglefullscreen(); }} title="Toàn màn hình" style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
            <path d="M8 3H5a2 2 0 0 0-2 2v3" />
            <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
            <path d="M3 16v3a2 2 0 0 0 2 2h3" />
            <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
          </svg>
        </button>
      </div>

      <div
        id="controls"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '12px 16px',
          background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
          opacity: showcontrols ? 1 : 0,
          transition: 'opacity 0.3s',
          zIndex: 5
        }}
        onClick={e => e.stopPropagation()}
      >
        <div
          id="progress-bar"
          onClick={handleseek}
          style={{ height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 2, cursor: 'pointer', marginBottom: 10, position: 'relative' }}
        >
          <div
            id="progress-filled"
            style={{ height: '100%', background: '#e50914', borderRadius: 2, width: `${progresspct}%` }}
          />
        </div>

        <div id="control-row" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button id="play-btn" className="ctrl-btn" onClick={toggleplay} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
            {isplaying ? (
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <button id="mute-btn" className="ctrl-btn" onClick={togglemute} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
            {ismuted ? (
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.59 3L19 9.59 17.59 8.17 15.17 10.59 12.76 8.17 11.34 9.59 13.76 12l-2.42 2.41 1.42 1.42L15.17 13.41 17.59 15.83 19 14.41z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
              </svg>
            )}
          </button>

          <input
            type="range"
            id="volume"
            min="0"
            max="100"
            value={volume}
            onChange={e => handlevolume(Number(e.target.value))}
            style={{ width: 60, accentColor: '#e50914' }}
          />

          <span id="time-display" style={{ fontSize: '0.75rem', color: '#aaa', marginLeft: 4 }}>
            {fmttime(curtime)} / {fmttime(duration)}
          </span>

          {subtitles.length > 0 && (
            <div id="sub-list" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {subtitles.map((sub, i) => (
                <button
                  key={i}
                  className={`sub-btn ${activesub === i ? 'active' : ''}`}
                  onClick={() => selectsub(i)}
                  style={{
                    background: activesub === i ? '#fff' : 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: activesub === i ? '#000' : '#ccc',
                    padding: '3px 8px',
                    borderRadius: 3,
                    fontSize: '0.65rem',
                    cursor: 'pointer'
                  }}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          )}

          <div id="source-list" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginLeft: 'auto', maxWidth: '50%' }}>
            {sources.map((s, i) => (
              <button
                key={i}
                className={`src-btn ${activeUrl === s.url ? 'active' : ''}`}
                onClick={() => {
                  triedSourcesRef.current.clear();
                  switchsource(s.url, s.label || s.source);
                }}
                style={{
                  background: activeUrl === s.url ? '#e50914' : 'rgba(255,255,255,0.1)',
                  border: `1px solid ${activeUrl === s.url ? '#e50914' : 'rgba(255,255,255,0.15)'}`,
                  color: activeUrl === s.url ? '#fff' : '#ccc',
                  padding: '4px 10px',
                  borderRadius: 4,
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {s.label || s.source || `Nguồn ${i + 1}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isloading && (
        <div id="loader" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, background: '#000', zIndex: 10 }}>
          <div className="spinner" style={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,0.15)', borderTopColor: '#e50914', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
          <span id="loader-label" style={{ fontSize: '0.8rem', color: '#888' }}>{loadlabel}</span>
        </div>
      )}

      {error && (
        <div id="error-screen" className="show" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: '#000', zIndex: 10 }}>
          <h3 style={{ fontSize: '1.1rem', color: '#ff4444' }}>Phát lại thất bại</h3>
          <p id="error-msg" style={{ fontSize: '0.85rem', color: '#888', maxWidth: 400, textAlign: 'center' }}>{error}</p>
        </div>
      )}
    </div>
  );
}
