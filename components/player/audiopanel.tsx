'use client';

import React, { useEffect } from 'react';
import { useapp } from '../../context/appcontext';
import { playuisound } from '../../lib/audio';
import { AudioSettings } from '../../lib/types';

export default function AudioPanel() {
  const { audiosettings, setaudiosettings, audiopanelopen, setaudiopanelopen } = useapp();

  useEffect(() => {
    if (!audiopanelopen) return;
    const onkey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.fullscreenElement) return;
      e.stopImmediatePropagation();
      setaudiopanelopen(false);
    };
    window.addEventListener('keydown', onkey, true);
    return () => window.removeEventListener('keydown', onkey, true);
  }, [audiopanelopen, setaudiopanelopen]);

  if (!audiopanelopen) return null;

  const updatefield = (key: keyof AudioSettings, val: boolean | number) => {
    setaudiosettings(prev => {
      const next = { ...prev, [key]: val } as AudioSettings;
      if (key === 'volume' || key === 'width' || key === 'depth') {
        playuisound('move', next, next.width * 2 - 1);
      } else {
        playuisound('toggle', next, 0);
      }
      return next;
    });
  };

  const close = () => {
    playuisound('close', audiosettings, 0);
    setaudiopanelopen(false);
  };

  const sliders: { key: 'volume' | 'width' | 'depth'; id: string; label: string }[] = [
    { key: 'volume', id: 'audio-volume', label: 'Âm lượng UI' },
    { key: 'width', id: 'audio-width', label: 'Độ rộng không gian 3D' },
    { key: 'depth', id: 'audio-depth', label: 'Độ sâu không gian' }
  ];

  return (
    <div className="audio-overlay" role="dialog" aria-modal="true" aria-label="Cấu hình âm thanh chân thật" onClick={close}>
      <div className="audio-modal" onClick={e => e.stopPropagation()}>
        <div className="audio-modal-head">
          <h3 className="audio-panel-title">Cấu hình âm thanh chân thật</h3>
          <button type="button" className="audio-close" onClick={close} title="Đóng" aria-label="Đóng cấu hình âm thanh">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <label className="audio-check">
          <input
            type="checkbox"
            id="audio-enabled"
            checked={audiosettings.enabled}
            onChange={e => updatefield('enabled', e.target.checked)}
          />
          <span>Bật hiệu ứng âm thanh UI</span>
        </label>

        <label className="audio-check">
          <input
            type="checkbox"
            id="audio-spatial"
            checked={audiosettings.spatial}
            onChange={e => updatefield('spatial', e.target.checked)}
          />
          <span>Định vị âm thanh 3D</span>
        </label>

        {sliders.map(s => (
          <div className="audio-field" key={s.key}>
            <div className="audio-field-head">
              <span>{s.label}</span>
              <span>{Math.round(audiosettings[s.key] * 100)}%</span>
            </div>
            <input
              type="range"
              id={s.id}
              min="0"
              max="100"
              value={Math.round(audiosettings[s.key] * 100)}
              onChange={e => updatefield(s.key, Number(e.target.value) / 100)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
