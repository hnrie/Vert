'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MediaItem } from '../../lib/types';
import Hls from 'hls.js';

interface VylaPlayerProps {
  item: MediaItem;
  season?: number | null;
  episode?: number | null;
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

export default function VylaPlayer({ item, season, episode }: VylaPlayerProps) {
  const playerwrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const tokenRef = useRef<string | null>(null);
  const triedSourcesRef = useRef<Set<string>>(new Set());
  const manifestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sourcesRef = useRef<SourceItem[]>([]);
  const activeUrlRef = useRef<string | null>(null);
  const disposedRef = useRef<boolean>(false);
  const lastreportRef = useRef<number>(0);

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
    const tok = String(data?.token || '');
    if (!tok) throw new Error('Xác thực thất bại');
    tokenRef.current = tok;
    return tok;
  };

  const cleartimer = () => {
    if (manifestTimerRef.current) {
      clearTimeout(manifestTimerRef.current);
      manifestTimerRef.current = null;
    }
  };

  const trynextsource = (failedurl?: string) => {
    cleartimer();
    if (disposedRef.current) return;
    if (failedurl) triedSourcesRef.current.add(failedurl);
    const next = sourcesRef.current.find(s => !triedSourcesRef.current.has(s.url));
    if (next) {
      switchsource(next.url, next.label || next.source);
    } else {
      setError('Tất cả nguồn đều thất bại.');
      setIsloading(false);
    }
  };

  const switchsource = (url: string, label?: string) => {
    if (disposedRef.current) return;

    triedSourcesRef.current.add(url);
    activeUrlRef.current = url;
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
    cleartimer();

    const vid = videoRef.current;
    if (!vid) return;
    vid.removeAttribute('src');
    vid.load();

    const stale = () => disposedRef.current || activeUrlRef.current !== url;

    manifestTimerRef.current = setTimeout(() => {
      if (!stale()) trynextsource(url);
    }, 15000);

    if (isMp4(url)) {
      vid.src = url;
      vid.addEventListener('loadedmetadata', () => {
        cleartimer();
        if (stale()) return;
        setIsloading(false);
      }, { once: true });
      vid.addEventListener('error', () => {
        cleartimer();
        if (!stale()) trynextsource(url);
      }, { once: true });
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
        cleartimer();
        if (stale()) return;
        setIsloading(false);
        vid.play().catch(() => {});
        if (data.levels.length > 1) {
          setLevels(data.levels.map((lvl, i) => ({
            id: i,
            label: lvl.height ? `${lvl.height}p` : `Level ${i}`
          })));
        }
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        if (stale()) return;
        setCurrentlevel(hls.autoLevelEnabled ? -1 : data.level);
      });

      let recoveries = 0;
      hls.on(Hls.Events.ERROR, (_, err) => {
        if (!err.fatal || stale()) return;
        if (recoveries < 2 && (err.type === Hls.ErrorTypes.NETWORK_ERROR || err.type === Hls.ErrorTypes.MEDIA_ERROR)) {
          recoveries++;
          if (err.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
          else hls.recoverMediaError();
          return;
        }
        trynextsource(url);
      });
      return;
    }

    if (vid.canPlayType('application/vnd.apple.mpegurl')) {
      vid.src = proxiedurl;
      vid.addEventListener('loadedmetadata', () => {
        cleartimer();
        if (stale()) return;
        setIsloading(false);
        vid.play().catch(() => {});
      }, { once: true });
      return;
    }

    cleartimer();
    setError('Trình duyệt không hỗ trợ HLS.');
    setIsloading(false);
  };

  useEffect(() => {
    disposedRef.current = false;
    triedSourcesRef.current = new Set();
    sourcesRef.current = [];
    activeUrlRef.current = null;
    tokenRef.current = null;

    setSources([]);
    setActiveUrl(null);
    setSubtitles([]);
    setActivesub(0);
    setLevels([]);
    setCurrentlevel(-1);
    setError(null);
    setIsloading(true);
    setLoadlabel('Đang kết nối...');

    const ctrl = new AbortController();

    const loadstream = async () => {
      if (!item.id) {
        setError('Thiếu ID phim.');
        setIsloading(false);
        return;
      }
      try {
        const tok = await gettoken();
        if (disposedRef.current) return;

        const apiurl = season && episode
          ? `https://api.vyla.cc/tv?id=${item.id}&season=${season}&episode=${episode}`
          : `https://api.vyla.cc/movie?id=${item.id}`;

        setLoadlabel('Đang tìm nguồn...');

        const res = await fetch(apiurl, { headers: { 'X-Session-Token': tok }, signal: ctrl.signal });
        if (!res.ok) {
          if (res.status === 403) throw new Error('Không có quyền truy cập streaming.');
          throw new Error(`Lỗi API: ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error('Không thể đọc stream.');
        const decoder = new TextDecoder();
        let buffer = '';
        let started = false;

        while (!disposedRef.current) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            let event: any;
            try {
              event = JSON.parse(line.slice(6));
            } catch (_) {
              continue;
            }
            if (disposedRef.current) return;

            if (event.type === 'meta') {
              const t = event.meta?.title || event.meta?.name || item.title;
              setTitle(t + (season ? ` S${season}E${episode || 1}` : ''));
              if (Array.isArray(event.subtitles)) setSubtitles(event.subtitles.filter((s: any) => s && s.file));
            }
            if (event.type === 'source' && event.source?.url) {
              const src: SourceItem = event.source;
              if (sourcesRef.current.some(s => s.url === src.url)) continue;
              sourcesRef.current = [...sourcesRef.current, src];
              setSources(sourcesRef.current);
              if (!started) {
                started = true;
                switchsource(src.url, src.label || src.source);
              }
            }
            if (event.type === 'done' && !started) {
              setError('Không tìm thấy nguồn video.');
              setIsloading(false);
            }
          }
        }
      } catch (e: any) {
        if (!disposedRef.current && e?.name !== 'AbortError') {
          setError(e.message || 'Lỗi kết nối.');
          setIsloading(false);
        }
      }
    };

    loadstream();

    return () => {
      disposedRef.current = true;
      ctrl.abort();
      cleartimer();
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [item.id, season, episode]);

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
    const next = activesub === idx ? -1 : idx;
    setActivesub(next);
    const vid = videoRef.current;
    if (!vid) return;
    Array.from(vid.textTracks).forEach((t, i) => {
      t.mode = i === next ? 'showing' : 'hidden';
    });
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const vid = videoRef.current;
      if (!vid) return;

      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;

      if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        toggleplay();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        vid.currentTime = Math.max(0, vid.currentTime - 10);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        vid.currentTime = Math.min(vid.duration || vid.currentTime, vid.currentTime + 10);
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
      onMouseMove={() => setShowcontrols(true)}
      onClick={() => setShowcontrols(true)}
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
          if (!vid) return;

          const time = vid.currentTime || 0;
          const dur = Number.isFinite(vid.duration) ? vid.duration : 0;
          setCurtime(time);
          setDuration(dur);

          const now = Date.now();
          if (dur > 0 && now - lastreportRef.current >= 5000) {
            lastreportRef.current = now;
            window.postMessage({
              type: 'PLAYER_EVENT',
              data: {
                id: item.id,
                mediaType: item.type,
                currentTime: time,
                duration: dur,
                progress: (time / dur) * 100,
                season: season || null,
                episode: episode || null
              }
            }, window.location.origin);
          }
        }}
        onCanPlay={() => setIsloading(false)}
      >
        {subtitles.map((sub, i) => (
          <track
            key={`${sub.file}-${i}`}
            kind="subtitles"
            label={sub.label || `Phụ đề ${i + 1}`}
            srcLang={(sub.label || 'vi').slice(0, 2).toLowerCase()}
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
                  onClick={e => {
                    e.stopPropagation();
                    selectsub(i);
                  }}
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
                onClick={e => {
                  e.stopPropagation();
                  triedSourcesRef.current = new Set();
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
