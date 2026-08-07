'use client';

import React, { useEffect, useState } from 'react';
import { useapp } from '../context/appcontext';
import { fetchtmdb, norm, genrenames } from '../lib/tmdb';
import MediaCard from './mediacard';
import { MediaItem, Episode, CastMember } from '../lib/types';

export default function DetailModal() {
  const { detailitem, closedetail, playcontent, togglemylist, isinmylist } = useapp();

  const [cast, setCast] = useState<CastMember[]>([]);
  const [seasons, setSeasons] = useState<number[]>([]);
  const [selectedseason, setSelectedseason] = useState<number>(1);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [similar, setSimilar] = useState<MediaItem[]>([]);

  useEffect(() => {
    if (!detailitem) return;

    let ismounted = true;
    const itemid = detailitem.id;
    const mediatype = detailitem.type || 'movie';

    const loadDetails = async () => {
      try {
        const creditsRes = await fetchtmdb(`/${mediatype}/${itemid}/credits`).catch(() => ({ cast: [] }));
        if (ismounted) setCast((creditsRes.cast || []).slice(0, 5));

        const similarRes = await fetchtmdb(`/${mediatype}/${itemid}/similar`).catch(() => ({ results: [] }));
        if (ismounted) {
          const simRaw = similarRes.results || [];
          const simNorm = simRaw.map((i: any) => norm(i, mediatype)).filter(Boolean) as MediaItem[];
          setSimilar(simNorm.slice(0, 6));
        }

        if (mediatype === 'tv') {
          const tvRes = await fetchtmdb(`/tv/${itemid}`).catch(() => ({ number_of_seasons: 1 }));
          const seasonCount = tvRes.number_of_seasons || 1;
          const sArr = Array.from({ length: seasonCount }, (_, i) => i + 1);
          if (ismounted) {
            setSeasons(sArr);
            setSelectedseason(1);
          }
        }
      } catch (_) {}
    };

    loadDetails();
    return () => {
      ismounted = false;
    };
  }, [detailitem]);

  useEffect(() => {
    if (!detailitem || detailitem.type !== 'tv') return;

    let ismounted = true;
    const loadEpisodes = async () => {
      try {
        const epRes = await fetchtmdb(`/tv/${detailitem.id}/season/${selectedseason}`);
        if (ismounted) setEpisodes(epRes.episodes || []);
      } catch (_) {
        if (ismounted) setEpisodes([]);
      }
    };

    loadEpisodes();
    return () => {
      ismounted = false;
    };
  }, [detailitem, selectedseason]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && detailitem) {
        closedetail();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [detailitem, closedetail]);

  if (!detailitem) return null;

  const inlist = isinmylist(detailitem.id);
  const matchscore = detailitem.rating ? `${Math.round(parseFloat(detailitem.rating) * 10)}% Khớp` : '98% Khớp';
  const genrelist = genrenames(detailitem.genreids);

  return (
    <div
      className="detail-overlay active"
      id="detail-overlay"
      onClick={closedetail}
    >
      <div
        className="detail-modal"
        id="detail-modal"
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-handle"></div>
        <button
          className="modal-close"
          id="detail-close-btn"
          title="Đóng"
          aria-label="Đóng chi tiết"
          onClick={closedetail}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div
          className="detail-hero"
          id="detail-hero"
          style={{
            backgroundImage: detailitem.backdrop ? `url(${detailitem.backdrop})` : undefined
          }}
        >
          <div className="detail-hero-fade"></div>
          <div className="detail-hero-inner">
            <h1 className="detail-hero-title" id="detail-title">
              {detailitem.title}
            </h1>
            <div className="detail-hero-buttons">
              <button
                className="btn-hero btn-white"
                id="detail-play-btn"
                onClick={() => {
                  closedetail();
                  playcontent(detailitem, detailitem.type === 'tv' ? selectedseason : null, detailitem.type === 'tv' ? 1 : null);
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 4l15 8-15 8z" />
                </svg>
                <span>Phát</span>
              </button>
              <button
                className="circle-action"
                id="detail-list-btn"
                title={inlist ? 'Xóa khỏi danh sách' : 'Thêm vào danh sách'}
                onClick={() => togglemylist(detailitem)}
              >
                {inlist ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                )}
              </button>
              <button className="circle-action" title="Đánh giá">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="detail-body">
          <div className="detail-columns">
            <div className="detail-col-main">
              <div className="detail-meta" id="detail-meta">
                <span style={{ color: '#46d369', fontWeight: 600 }}>{matchscore}</span>
                {detailitem.year && <span>{detailitem.year}</span>}
                <span style={{ border: '1px solid rgba(255,255,255,0.4)', padding: '0 4px', borderRadius: 2 }}>18+</span>
                <span style={{ border: '1px solid rgba(255,255,255,0.4)', padding: '0 4px', borderRadius: 2 }}>HD</span>
              </div>
              <p className="detail-desc" id="detail-overview">
                {detailitem.desc}
              </p>
            </div>

            <div className="detail-col-side">
              {cast.length > 0 && (
                <p className="detail-tag" id="detail-cast-line">
                  <span style={{ color: '#808080' }}>Diễn viên: </span>
                  {cast.map(c => c.name).join(', ')}
                </p>
              )}
              {genrelist.length > 0 && (
                <p className="detail-tag" id="detail-genre-line">
                  <span style={{ color: '#808080' }}>Thể loại: </span>
                  {genrelist.join(', ')}
                </p>
              )}
            </div>
          </div>

          {detailitem.type === 'tv' && (
            <div className="episodes-section active" id="episodes-section">
              <div className="episodes-top">
                <h3>Tập phim</h3>
                <select
                  id="season-picker"
                  value={selectedseason}
                  onChange={e => setSelectedseason(Number(e.target.value))}
                >
                  {seasons.map(s => (
                    <option key={s} value={s}>
                      Mùa {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="ep-list" id="episodes-list">
                {episodes.map(ep => (
                  <div
                    key={ep.id}
                    className="ep-card"
                    onClick={() => {
                      closedetail();
                      playcontent(detailitem, selectedseason, ep.episode_number);
                    }}
                  >
                    <div className="ep-index">{ep.episode_number}</div>
                    <div
                      className="ep-thumb"
                      style={{
                        backgroundImage: ep.still_path
                          ? `url(https://image.tmdb.org/t/p/w300${ep.still_path})`
                          : undefined
                      }}
                    >
                      <div className="ep-play-overlay">
                        <svg viewBox="0 0 24 24">
                          <path d="M6 4l15 8-15 8z" />
                        </svg>
                      </div>
                    </div>
                    <div className="ep-info">
                      <div className="ep-info-top">
                        <div className="ep-name">{ep.name}</div>
                      </div>
                      <div className="ep-synopsis">
                        {ep.overview || 'Không có mô tả cho tập này.'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {similar.length > 0 && (
            <div className="similar-section" id="similar-section" style={{ marginTop: 32 }}>
              <h3 style={{ marginBottom: 16 }}>Nội dung tương tự</h3>
              <div className="card-grid" id="similar-grid">
                {similar.map(s => (
                  <MediaCard key={s.id} item={s} />
                ))}
              </div>
            </div>
          )}

          <div className="about-section" id="about-section" style={{ marginTop: 32 }}>
            <h3>Về <span id="about-title">{detailitem.title}</span></h3>
            <div id="about-details" style={{ marginTop: 8, color: '#a0a0a0', fontSize: 14 }}>
              <p>Phim được sản xuất và cập nhật dữ liệu tự động từ cơ sở dữ liệu TMDB.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
