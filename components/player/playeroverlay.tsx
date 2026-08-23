'use client';

import React, { useEffect, useRef } from 'react';
import { useapp } from '../../context/appcontext';
import VylaPlayer from './vylaplayer';
import { playuisound } from '../../lib/audio';

export default function PlayerOverlay() {
  const { activeplayer, closeplayer, playersource, savehistory, audiopanelopen, setaudiopanelopen, audiosettings } = useapp();
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeplayer) return;

    const handleMsg = (e: MessageEvent) => {
      let payload = e.data;
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload);
        } catch (_) {
          return;
        }
      }
      if (!payload || payload.type !== 'PLAYER_EVENT' || !payload.data) return;

      const d = payload.data;
      const item = activeplayer.item;
      const id = String(d.id ?? item.id);
      if (!id) return;

      const season = Number(d.season) || null;
      const episode = Number(d.episode) || null;
      const mediatype = d.mediaType === 'tv' || d.mediaType === 'movie' ? d.mediaType : item.type;
      const duration = Number(d.duration) || 0;
      const currenttime = Number(d.currentTime) || 0;
      const progress = Number(d.progress) || (duration > 0 ? (currenttime / duration) * 100 : 0);

      const pkey = season && episode
        ? `vk_p_tv_${id}_s${season}_e${episode}`
        : `vk_p_${mediatype}_${id}`;

      try {
        localStorage.setItem(pkey, JSON.stringify({ id, mediatype, currenttime, duration, progress, season, episode }));
      } catch (_) {}

      if (progress > 0) {
        savehistory({
          id,
          mediatype,
          title: item.title,
          poster: item.poster,
          backdrop: item.backdrop,
          year: item.year,
          rating: item.rating,
          currenttime,
          duration,
          progress: Math.max(0, Math.min(100, progress)),
          season,
          episode,
          updatedat: Date.now()
        });
      }
    };

    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  }, [activeplayer, savehistory]);

  useEffect(() => {
    if (!activeplayer || audiopanelopen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.fullscreenElement) return;
      e.stopImmediatePropagation();
      playuisound('close', audiosettings, -0.4);
      closeplayer();
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [activeplayer, audiopanelopen, closeplayer, audiosettings]);

  if (!activeplayer) return null;

  const { item, season, episode } = activeplayer;
  const istv = item.type === 'tv';
  const s = season || 1;
  const ep = episode || 1;

  const embedurl = playersource === 'vidking'
    ? (istv
      ? `https://www.vidking.net/embed/tv/${item.id}/${s}/${ep}`
      : `https://www.vidking.net/embed/movie/${item.id}`)
    : (istv
      ? `https://player.videasy.net/tv/${item.id}/${s}/${ep}`
      : `https://player.videasy.net/movie/${item.id}`);

  const togglefs = () => {
    const el = overlayRef.current;
    if (!el) return;
    if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
      if (document.exitFullscreen) document.exitFullscreen();
      else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
    } else {
      if (el.requestFullscreen) el.requestFullscreen();
      else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();
    }
  };

  return (
    <div
      id="player-overlay"
      ref={overlayRef}
      className="player-overlay active"
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        zIndex: 9995,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div
        className="player-header"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 56,
          padding: '0 20px',
          background: 'linear-gradient(rgba(0,0,0,0.8), transparent)',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <button
          id="player-back-btn"
          className="btn-hero"
          onClick={() => {
            playuisound('close', audiosettings, -0.4);
            closeplayer();
          }}
          style={{
            background: 'rgba(0,0,0,0.5)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.2)',
            padding: '6px 14px',
            borderRadius: 4,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: '0.85rem'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>Quay lại</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => {
              playuisound('open', audiosettings, 0.2);
              setaudiopanelopen(true);
            }}
            title="Cấu hình âm thanh"
            style={{
              background: 'rgba(0,0,0,0.5)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.2)',
              padding: 6,
              borderRadius: 4,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 5 6 9H3v6h3l5 4V5z" />
              <path d="M15.5 8.5a5 5 0 0 1 0 7" />
              <path d="M18.5 5.5a9 9 0 0 1 0 13" />
            </svg>
          </button>

          <button
            id="player-fullscreen-btn"
            onClick={togglefs}
            title="Toàn màn hình"
            style={{
              background: 'rgba(0,0,0,0.5)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.2)',
              padding: 6,
              borderRadius: 4,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3" />
              <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
              <path d="M3 16v3a2 2 0 0 0 2 2h3" />
              <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
            </svg>
          </button>
        </div>
      </div>

      <div id="player-frame" style={{ width: '100%', height: '100%', flex: 1, background: '#000' }}>
        {playersource === 'vyla' ? (
          <VylaPlayer item={item} season={season} episode={episode} />
        ) : (
          <iframe
            key={embedurl}
            src={embedurl}
            title={item.title}
            style={{ width: '100%', height: '100%', border: 'none' }}
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        )}
      </div>
    </div>
  );
}
