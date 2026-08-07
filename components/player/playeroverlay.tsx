'use client';

import React, { useEffect, useRef } from 'react';
import { useapp } from '../../context/appcontext';
import VylaPlayer from './vylaplayer';
import { playuisound } from '../../lib/audio';

export default function PlayerOverlay() {
  const { activeplayer, closeplayer, playersource, savehistory, setaudiopanelopen, audiosettings } = useapp();
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMsg = (e: MessageEvent) => {
      if (!e.data || e.data.type !== 'PLAYER_EVENT' || !e.data.data) return;
      const d = e.data.data;
      if (!d.id) return;

      const pkey = d.season && d.episode
        ? `vk_p_tv_${d.id}_s${d.season}_e${d.episode}`
        : `vk_p_${d.mediaType || 'movie'}_${d.id}`;

      try {
        localStorage.setItem(pkey, JSON.stringify(d));
      } catch (_) {}

      if (activeplayer && activeplayer.item && d.progress > 0) {
        savehistory({
          id: String(d.id),
          mediatype: d.mediaType || activeplayer.item.type || 'movie',
          title: activeplayer.item.title,
          poster: activeplayer.item.poster,
          backdrop: activeplayer.item.backdrop,
          year: activeplayer.item.year,
          rating: activeplayer.item.rating,
          currenttime: d.currentTime || 0,
          duration: d.duration || 0,
          progress: d.progress || 0,
          season: d.season || null,
          episode: d.episode || null,
          updatedat: Date.now()
        });
      }
    };

    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  }, [activeplayer, savehistory]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeplayer) {
        playuisound('close', audiosettings, -0.4);
        closeplayer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeplayer, closeplayer, audiosettings]);

  if (!activeplayer) return null;

  const { item, season, episode } = activeplayer;

  let embedurl = '';
  if (playersource === 'videasy') {
    embedurl = item.type === 'tv'
      ? `https://player.videasy.net/tv/${item.id}/${season || 1}/${episode || 1}`
      : `https://player.videasy.net/movie/${item.id}`;
  } else if (playersource === 'vidking') {
    embedurl = item.type === 'tv'
      ? `https://www.vidking.net/embed/tv/${item.id}/${season || 1}/${episode || 1}`
      : `https://www.vidking.net/embed/movie/${item.id}`;
  }

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
          <VylaPlayer item={item} season={season} episode={episode} onClose={closeplayer} />
        ) : (
          <iframe
            src={embedurl}
            style={{ width: '100%', height: '100%', border: 'none' }}
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          />
        )}
      </div>
    </div>
  );
}
