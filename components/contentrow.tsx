'use client';

import React, { useEffect, useState, useRef } from 'react';
import MediaCard from './mediacard';
import { fetchtmdb, norm } from '../lib/tmdb';
import { MediaItem } from '../lib/types';

interface ContentRowProps {
  title: string;
  fetchEndpoint?: string;
  items?: MediaItem[];
  isContinueRow?: boolean;
}

export default function ContentRow({ title, fetchEndpoint, items: propItems, isContinueRow }: ContentRowProps) {
  const [rowitems, setRowitems] = useState<MediaItem[]>(propItems || []);
  const trackref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (propItems) {
      setRowitems(propItems);
      return;
    }

    if (!fetchEndpoint) return;

    let ismounted = true;
    const loadItems = async () => {
      try {
        const res = await fetchtmdb(fetchEndpoint);
        const raw = res.results || [];
        const normalized = raw.map((i: any) => norm(i)).filter(Boolean) as MediaItem[];
        if (ismounted) setRowitems(normalized);
      } catch (_) {}
    };

    loadItems();
    return () => {
      ismounted = false;
    };
  }, [fetchEndpoint, propItems]);

  if (!rowitems || rowitems.length === 0) return null;

  const scrollLeft = () => {
    if (trackref.current) {
      trackref.current.scrollBy({ left: -800, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (trackref.current) {
      trackref.current.scrollBy({ left: 800, behavior: 'smooth' });
    }
  };

  return (
    <div className="content-row">
      <div className="row-head">
        <h2>{title}</h2>
      </div>
      <div className="slider-wrap">
        <button
          className="slide-arrow l"
          onClick={scrollLeft}
          title="Cuộn sang trái"
          aria-label="Cuộn sang trái"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="slider-track" ref={trackref}>
          {rowitems.map((item, idx) => (
            <MediaCard
              key={`${item.id}-${idx}`}
              item={item}
              badge={isContinueRow ? undefined : idx < 10 && title.includes('Top') ? `TOP ${idx + 1}` : undefined}
            />
          ))}
        </div>
        <button
          className="slide-arrow r"
          onClick={scrollRight}
          title="Cuộn sang phải"
          aria-label="Cuộn sang phải"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
