'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useapp } from '../context/appcontext';
import { fetchtmdb, norm, GENRE_LIST } from '../lib/tmdb';
import MediaCard from './mediacard';
import { MediaItem } from '../lib/types';

const maxpages = 20;

export default function SearchView() {
  const { searchquery, filtergenre, setfiltergenre, setsearchquery } = useapp();

  const querykey = filtergenre ? `g:${filtergenre.id}` : searchquery ? `q:${searchquery}` : '';

  const [items, setItems] = useState<MediaItem[]>([]);
  const [cursor, setCursor] = useState<{ key: string; page: number }>({ key: querykey, page: 1 });
  const [loading, setLoading] = useState<boolean>(false);
  const [hasmore, setHasmore] = useState<boolean>(true);

  const sentinelref = useRef<HTMLDivElement>(null);
  const loadingref = useRef<boolean>(false);
  const seenref = useRef<Set<string>>(new Set());

  if (cursor.key !== querykey) {
    setCursor({ key: querykey, page: 1 });
    setItems([]);
    setHasmore(true);
  }

  const activekey = cursor.key;
  const activepage = cursor.page;

  useEffect(() => {
    if (!activekey || !hasmore || activepage > maxpages) return;

    if (activepage === 1) seenref.current = new Set();

    const ctrl = new AbortController();
    let active = true;
    loadingref.current = true;
    setLoading(true);

    const run = async () => {
      try {
        let fresh: MediaItem[] = [];

        if (activekey.startsWith('g:')) {
          const gid = activekey.slice(2);
          const [resmovie, restv] = await Promise.all([
            fetchtmdb('/discover/movie', { with_genres: gid, page: activepage }, ctrl.signal),
            fetchtmdb('/discover/tv', { with_genres: gid, page: activepage }, ctrl.signal)
          ]);
          const mlist = (resmovie.results || []).map((i: any) => norm(i, 'movie')).filter(Boolean);
          const tlist = (restv.results || []).map((i: any) => norm(i, 'tv')).filter(Boolean);
          fresh = [...mlist, ...tlist] as MediaItem[];
        } else {
          const res = await fetchtmdb('/search/multi', { query: activekey.slice(2), page: activepage }, ctrl.signal);
          fresh = (res.results || []).map((i: any) => norm(i)).filter(Boolean) as MediaItem[];
        }

        if (!active) return;

        const unique = fresh.filter(i => {
          const key = `${i.type}-${i.id}`;
          if (seenref.current.has(key)) return false;
          seenref.current.add(key);
          return true;
        });

        if (fresh.length === 0 || activepage >= maxpages) setHasmore(false);
        if (unique.length > 0) setItems(prev => (activepage === 1 ? unique : [...prev, ...unique]));
      } catch (e: any) {
        if (active && e?.name !== 'AbortError') setHasmore(false);
      } finally {
        if (active) {
          loadingref.current = false;
          setLoading(false);
        }
      }
    };

    run();
    return () => {
      active = false;
      loadingref.current = false;
      ctrl.abort();
    };
  }, [activekey, activepage, hasmore]);

  useEffect(() => {
    const el = sentinelref.current;
    if (!el || !hasmore || !activekey || activepage > maxpages) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && !loadingref.current) {
          setCursor(prev => ({ key: prev.key, page: prev.page + 1 }));
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasmore, loading, activekey, activepage]);

  const heading = filtergenre
    ? `Thể loại: ${filtergenre.name}`
    : searchquery
    ? `Kết quả tìm kiếm cho "${searchquery}"`
    : 'Khám phá nội dung';

  return (
    <section className="page-section search-page active" id="search-page">
      <div className="page-inner">
        <h2 className="page-heading" id="search-heading">
          {heading}
        </h2>

        {!searchquery && (
          <div className="filter-grid-selector">
            {GENRE_LIST.map(g => (
              <button
                key={g.id}
                type="button"
                className={`filter-tag ${filtergenre?.id === g.id ? 'active' : ''}`}
                onClick={() => {
                  setsearchquery('');
                  setfiltergenre(g);
                }}
              >
                {g.name}
              </button>
            ))}
          </div>
        )}

        {items.length > 0 ? (
          <div className="card-grid" id="search-grid">
            {items.map(item => (
              <MediaCard key={`${item.type}-${item.id}`} item={item} />
            ))}
          </div>
        ) : (
          !loading && (
            <div className="empty-state">
              <h3>Không tìm thấy kết quả phù hợp</h3>
              <p>Thử tìm kiếm với từ khóa khác hoặc duyệt theo thể loại</p>
            </div>
          )
        )}

        <div ref={sentinelref} id="infinite-scroll-sentinel" className="scroll-sentinel"></div>

        {loading && (
          <div id="search-loading" className="loading-spinner-wrap active">
            <div className="spinner"></div>
          </div>
        )}
      </div>
    </section>
  );
}
