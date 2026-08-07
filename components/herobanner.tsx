'use client';

import React, { useEffect, useState } from 'react';
import { useapp } from '../context/appcontext';
import { fetchtmdb, norm } from '../lib/tmdb';
import { MediaItem } from '../lib/types';

interface HeroBannerProps {
  item?: MediaItem | null;
}

export default function HeroBanner({ item: propItem }: HeroBannerProps) {
  const { opendetail, playcontent } = useapp();
  const [heroitem, setHeroitem] = useState<MediaItem | null>(propItem || null);

  useEffect(() => {
    if (propItem) {
      setHeroitem(propItem);
      return;
    }

    let ismounted = true;
    const fetchHero = async () => {
      try {
        const res = await fetchtmdb('/trending/all/day');
        const results = res.results || [];
        const valid = results.map((i: any) => norm(i)).filter(Boolean) as MediaItem[];
        if (valid.length > 0 && ismounted) {
          const picked = valid[Math.floor(Math.random() * Math.min(5, valid.length))];
          setHeroitem(picked);
        }
      } catch (_) {}
    };

    fetchHero();
    return () => {
      ismounted = false;
    };
  }, [propItem]);

  if (!heroitem) {
    return (
      <header id="hero" style={{ minHeight: '60vh', background: '#141414' }}>
        <div className="hero-vignette"></div>
        <div className="hero-bottom-fade"></div>
      </header>
    );
  }

  const matchscore = heroitem.rating ? `${Math.round(parseFloat(heroitem.rating) * 10)}% Khớp` : '98% Khớp';
  const typebadge = heroitem.type === 'tv' ? 'LOẠT PHIM' : 'PHIM CHIẾU RẠP';

  return (
    <header
      id="hero"
      style={{
        backgroundImage: heroitem.backdrop ? `url(${heroitem.backdrop})` : undefined
      }}
    >
      <div className="hero-vignette"></div>
      <div className="hero-bottom-fade"></div>
      <div className="hero-content">
        <div className="hero-title-area">
          <div className="hero-content-type" id="hero-badge">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 4h16v16H4z" opacity=".3" />
              <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z" />
            </svg>
            <span id="hero-type-text">{typebadge}</span>
          </div>
          <h1 className="hero-title" id="hero-title">
            {heroitem.title}
          </h1>
        </div>

        <div className="hero-metadata" id="hero-metadata">
          <span className="match-score">{matchscore}</span>
          {heroitem.year && <span className="meta-year">{heroitem.year}</span>}
          <span className="meta-badge">18+</span>
          <span className="meta-quality">4K Ultra HD</span>
        </div>

        <p className="hero-overview" id="hero-overview">
          {heroitem.desc}
        </p>

        <div className="hero-actions">
          <button
            className="btn-hero btn-white"
            id="hero-play-btn"
            onClick={() => playcontent(heroitem)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 4l15 8-15 8z" />
            </svg>
            <span>Phát</span>
          </button>
          <button
            className="btn-hero btn-gray"
            id="hero-info-btn"
            onClick={() => opendetail(heroitem)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>Thông tin thêm</span>
          </button>
        </div>
      </div>

      <div className="hero-age-rating" id="hero-age">
        <div className="age-divider"></div>
        <span className="age-text">18+</span>
      </div>
    </header>
  );
}
