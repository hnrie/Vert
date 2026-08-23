'use client';

import React from 'react';
import { useapp } from '../context/appcontext';
import { MediaItem } from '../lib/types';

interface MediaCardProps {
  item: MediaItem;
  badge?: string;
  progress?: number;
  season?: number | null;
  episode?: number | null;
}

export default function MediaCard({ item, badge, progress, season, episode }: MediaCardProps) {
  const { opendetail, playcontent, togglemylist, isinmylist } = useapp();
  const inlist = isinmylist(item.id);

  const rated = item.rating ? parseFloat(item.rating) : NaN;
  const matchscore = Number.isFinite(rated) ? `${Math.round(rated * 10)}%` : '';
  const hasposter = Boolean(item.poster);
  const play = () => playcontent(item, season ?? null, episode ?? null);

  return (
    <div
      className={`card${hasposter ? '' : ' no-img'}`}
      role="button"
      tabIndex={0}
      onClick={() => opendetail(item)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          opendetail(item);
        }
      }}
    >
      {badge && <div className="top-badge">{badge}</div>}

      {item.poster ? (
        <img src={item.poster} alt={item.title} loading="lazy" />
      ) : (
        <span>{item.title}</span>
      )}

      {progress !== undefined && progress > 0 && (
        <div className="card-progress">
          <div
            className="card-progress-fill"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}

      <div className="card-panel">
        <div className="card-btns">
          <button
            className="card-circle play-c"
            title="Phát"
            aria-label="Phát"
            onClick={e => {
              e.stopPropagation();
              play();
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 4l15 8-15 8z" />
            </svg>
          </button>

          <button
            className="card-circle"
            title={inlist ? 'Xóa khỏi danh sách' : 'Thêm vào danh sách'}
            aria-label={inlist ? 'Xóa khỏi danh sách' : 'Thêm vào danh sách'}
            onClick={e => {
              e.stopPropagation();
              togglemylist(item);
            }}
          >
            {inlist ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            )}
          </button>

          <button
            className="card-circle card-info-btn"
            title="Thông tin chi tiết"
            aria-label="Thông tin chi tiết"
            onClick={e => {
              e.stopPropagation();
              opendetail(item);
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>

        {matchscore && <div className="card-match">{matchscore} phù hợp</div>}
        <div className="card-name">{item.title}</div>
        <div className="card-tags">
          {[item.year, item.type === 'tv' ? 'Phim bộ' : 'Phim lẻ', 'HD'].filter(Boolean).join(' • ')}
        </div>
      </div>
    </div>
  );
}