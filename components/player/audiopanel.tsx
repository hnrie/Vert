'use client';

import React from 'react';
import { useapp } from '../../context/appcontext';
import { playuisound } from '../../lib/audio';

export default function AudioPanel() {
  const { audiosettings, setaudiosettings, audiopanelopen, setaudiopanelopen } = useapp();

  if (!audiopanelopen) return null;

  const updatefield = (key: keyof typeof audiosettings, val: any) => {
    setaudiosettings(prev => {
      const next = { ...prev, [key]: val };
      if (key === 'volume' || key === 'width' || key === 'depth') {
        const pan = (next.width * 2) - 1;
        playuisound('move', next, pan);
      } else if (key === 'enabled' || key === 'spatial') {
        playuisound('toggle', next, 0);
      }
      return next;
    });
  };

  return (
    <div
      className="sync-modal-overlay active"
      onClick={() => setaudiopanelopen(false)}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 9990,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
    >
      <div
        className="sync-modal"
        onClick={e => e.stopPropagation()}
        style={{
          background: '#181818',
          borderRadius: 12,
          padding: 24,
          maxWidth: 360,
          width: '100%',
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          color: '#fff'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="audio-panel-title" style={{ fontSize: '1.1rem', margin: 0 }}>Cấu hình âm thanh chân thật</h3>
          <button
            onClick={() => {
              playuisound('close', audiosettings, 0);
              setaudiopanelopen(false);
            }}
            style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <input
            type="checkbox"
            id="audio-enabled"
            checked={audiosettings.enabled}
            onChange={e => updatefield('enabled', e.target.checked)}
            style={{ marginRight: 8, accentColor: '#E50914' }}
          />
          <span>Bật hiệu ứng âm thanh UI</span>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <input
            type="checkbox"
            id="audio-spatial"
            checked={audiosettings.spatial}
            onChange={e => updatefield('spatial', e.target.checked)}
            style={{ marginRight: 8, accentColor: '#E50914' }}
          />
          <span>Định vị âm thanh 3D (Spatial Panning)</span>
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#ccc' }}>
            <span>Âm lượng UI</span>
            <span>{Math.round(audiosettings.volume * 100)}%</span>
          </div>
          <input
            type="range"
            id="audio-volume"
            min="0"
            max="100"
            value={Math.round(audiosettings.volume * 100)}
            onChange={e => updatefield('volume', Number(e.target.value) / 100)}
            style={{ width: '100%', accentColor: '#E50914' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#ccc' }}>
            <span>Độ rộng không gian 3D</span>
            <span>{Math.round(audiosettings.width * 100)}%</span>
          </div>
          <input
            type="range"
            id="audio-width"
            min="0"
            max="100"
            value={Math.round(audiosettings.width * 100)}
            onChange={e => updatefield('width', Number(e.target.value) / 100)}
            style={{ width: '100%', accentColor: '#E50914' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#ccc' }}>
            <span>Độ sâu không gian</span>
            <span>{Math.round(audiosettings.depth * 100)}%</span>
          </div>
          <input
            type="range"
            id="audio-depth"
            min="0"
            max="100"
            value={Math.round(audiosettings.depth * 100)}
            onChange={e => updatefield('depth', Number(e.target.value) / 100)}
            style={{ width: '100%', accentColor: '#E50914' }}
          />
        </div>
      </div>
    </div>
  );
}
