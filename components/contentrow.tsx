'use client';

import React, { useEffect, useState, useRef } from 'react';
import MediaCard from './mediacard';
import { fetchtmdb, norm } from '../lib/tmdb';
import { MediaItem, RowEntry } from '../lib/types';

interface ContentRowProps {
  title: string;
  fetchEndpoint?: string;
  entries?: RowEntry[];
  isContinueRow?: boolean;
}

export default function ContentRow({ title, fetchEndpoint, entries, isContinueRow }: ContentRowProps) {
  const [fetched, setFetched] = useState<MediaItem[]>([]);
  const trackref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (entries || !fetchEndpoint) return;

    const ctrl = new AbortController();
    const loadItems = async () => {
      try {
        const res = await fetchtmdb(fetchEndpoint, {}, ctrl.signal);
        const raw = res.results || [];
        setFetched(raw.map((i: any) => norm(i)).filter(Boolean) as MediaItem[]);
      } catch (_) {}
    };

    loadItems();
    return () => ctrl.abort();
  }, [fetchEndpoint, entries]);

  const rowentries: RowEntry[] = entries || fetched.map(item => ({ item }));

  if (rowentries.length === 0) return null;

  const scrollby = (dir: number) => {
    const el = trackref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(320, el.clientWidth * 0.8), behavior: 'smooth' });
  };

  const istop = !isContinueRow && title.includes('Top');

  return (
    <section className="content-row">
      <div className="row-head">
        <h2>{title}</h2>
      </div>
      <div className="slider-wrap">
        <button
          className="slide-arrow l"
          onClick={() => scrollby(-1)}
          title="Cuộn sang trái"
          aria-label="Cuộn sang trái"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="slider-track" ref={trackref}>
          {rowentries.map((entry, idx) => (
            <MediaCard
              key={`${entry.item.type}-${entry.item.id}-${entry.season ?? ''}-${entry.episode ?? ''}-${idx}`}
              item={entry.item}
              progress={entry.progress}
              season={entry.season}
              episode={entry.episode}
              badge={istop && idx < 10 ? `TOP ${idx + 1}` : undefined}
            />
          ))}
        </div>
        <button
          className="slide-arrow r"
          onClick={() => scrollby(1)}
          title="Cuộn sang phải"
          aria-label="Cuộn sang phải"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </section>
  );
}
