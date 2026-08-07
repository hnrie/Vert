'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useapp } from '../context/appcontext';
import { fetchtmdb, norm, GENRE_LIST } from '../lib/tmdb';
import MediaCard from './mediacard';
import { MediaItem } from '../lib/types';

export default function SearchView() {
  const { searchquery, filtergenre, setfiltergenre, setsearchquery } = useapp();

  const [items, setItems] = useState<MediaItem[]>([]);
  const [page, setPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasmore, setHasmore] = useState<boolean>(true);

  const sentinelref = useRef<HTMLDivElement>(null);

  const loadData = useCallback(
    async (targetPage: number, append: boolean = false) => {
      if (loading) return;
      setLoading(true);

      try {
        let newItems: MediaItem[] = [];

        if (filtergenre) {
          const [resMovie, resTv] = await Promise.all([
            fetchtmdb('/discover/movie', { with_genres: filtergenre.id, page: targetPage }),
            fetchtmdb('/discover/tv', { with_genres: filtergenre.id, page: targetPage })
          ]);
          const mList = (resMovie.results || []).map((i: any) => norm(i, 'movie')).filter(Boolean);
          const tList = (resTv.results || []).map((i: any) => norm(i, 'tv')).filter(Boolean);
          newItems = [...mList, ...tList] as MediaItem[];
        } else if (searchquery) {
          const res = await fetchtmdb('/search/multi', { query: searchquery, page: targetPage });
          const raw = res.results || [];
          newItems = raw.map((i: any) => norm(i)).filter(Boolean) as MediaItem[];
        }

        if (newItems.length === 0) {
          setHasmore(false);
        } else {
          setItems(prev => (append ? [...prev, ...newItems] : newItems));
        }
      } catch (_) {
        setHasmore(false);
      } finally {
        setLoading(false);
      }
    },
    [filtergenre, searchquery, loading]
  );

  useEffect(() => {
    setPage(1);
    setHasmore(true);
    setItems([]);
    if (searchquery || filtergenre) {
      loadData(1, false);
    }
  }, [searchquery, filtergenre]);

  useEffect(() => {
    if (!sentinelref.current || !hasmore || loading) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasmore && !loading) {
          const nextpage = page + 1;
          setPage(nextpage);
          loadData(nextpage, true);
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(sentinelref.current);
    return () => observer.disconnect();
  }, [page, hasmore, loading, loadData]);

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
          <div className="filter-grid-selector" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
            {GENRE_LIST.map(g => (
              <button
                key={g.id}
                className={`filter-tag ${filtergenre?.id === g.id ? 'active' : ''}`}
                style={{
                  background: filtergenre?.id === g.id ? '#E50914' : '#2a2a2a',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: 20,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
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
            {items.map((item, idx) => (
              <MediaCard key={`${item.id}-${idx}`} item={item} />
            ))}
          </div>
        ) : (
          !loading && (
            <div className="empty-state" style={{ textAlign: 'center', padding: '60px 0' }}>
              <h3>Không tìm thấy kết quả phù hợp</h3>
              <p>Thử tìm kiếm với từ khóa khác hoặc duyệt theo thể loại</p>
            </div>
          )
        )}

        <div ref={sentinelref} id="infinite-scroll-sentinel" style={{ height: 20 }}></div>

        {loading && (
          <div id="search-loading" className="loading-spinner-wrap active">
            <div className="spinner"></div>
          </div>
        )}
      </div>
    </section>
  );
}
