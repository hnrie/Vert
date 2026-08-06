'use client';

import React from 'react';
import { useapp } from '../context/appcontext';
import { MediaItem } from '../lib/types';

interface MediaCardProps {
  item: MediaItem;
  badge?: string;
  progress?: number;
}

export default function MediaCard({ item, badge, progress }: MediaCardProps) {
  const { opendetail, playcontent, togglemylist, isinmylist } = useapp();
  const inlist = isinmylist(item.id);

  const matchscore = item.rating ? `${Math.round(parseFloat(item.rating) * 10)}%` : '';

  return (
    <div className="card">
      <div className="card-inner" onClick={() => opendetail(item)}>
        <img
          src={item.poster || 'https://via.placeholder.com/300x450/141414/ffffff?text=VERT'}
          alt={item.title}
          className="card-img"
          loading="lazy"
        />
        {badge && <div className="card-badge">{badge}</div>}
        {progress !== undefined && progress > 0 && (
          <div className="card-progress-bar">
            <div className="card-progress-fill" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}></div>
          </div>
        )}
      </div>
      <div className="card-panel">
        <div className="card-actions">
          <button
            className="card-circle"
            title="Phát"
            onClick={e => {
              e.stopPropagation();
              playcontent(item);
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 4l15 8-15 8z" />
            </svg>
          </button>
          <button
            className="circle-action"
            title={inlist ? 'Xóa khỏi danh sách' : 'Thêm vào danh sách'}
            onClick={e => {
              e.stopPropagation();
              togglemylist(item);
            }}
          >
            {inlist ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            )}
          </button>
          <button
            className="circle-action"
            title="Thông tin chi tiết"
            onClick={e => {
              e.stopPropagation();
              opendetail(item);
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
        <div className="card-title">{item.title}</div>
        <div className="card-meta">
          {matchscore && <span style={{ color: '#46d369', fontWeight: 600 }}>{matchscore}</span>}
          {item.year && <span>{item.year}</span>}
          <span style={{ border: '1px solid rgba(255,255,255,0.4)', padding: '0 4px', borderRadius: 2 }}>HD</span>
        </div>
      </div>
    </div>
  );
}
