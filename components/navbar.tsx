'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useapp } from '../context/appcontext';
import { fetchtmdb, norm, GENRE_LIST } from '../lib/tmdb';
import { MediaItem, VideoSource } from '../lib/types';

export default function Navbar() {
  const {
    currentpage,
    setcurrentpage,
    playersource,
    setplayersource,
    clearhistory,
    clearprogress,
    clearmylist,
    clearcache,
    audiosettings,
    setaudiosettings,
    setaudiopanelopen,
    opendetail,
    setsearchquery,
    setfiltergenre,
    setsyncmodalopen,
    showtoast
  } = useapp();

  const [issolid, setissolid] = useState<boolean>(false);
  const [searchinput, setSearchinput] = useState<string>('');
  const [suggestions, setSuggestions] = useState<MediaItem[]>([]);
  const [showsuggest, setShowsuggest] = useState<boolean>(false);
  const [showaccount, setShowaccount] = useState<boolean>(false);
  const [showfilter, setShowfilter] = useState<boolean>(false);
  const [showmobilemenu, setShowmobilemenu] = useState<boolean>(false);

  const suggesttimer = useRef<any>(null);
  const navref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setissolid(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (navref.current && !navref.current.contains(e.target as Node)) {
        setShowaccount(false);
        setShowfilter(false);
        setShowsuggest(false);
        setShowmobilemenu(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleSearchInput = (val: string) => {
    setSearchinput(val);
    if (suggesttimer.current) clearTimeout(suggesttimer.current);

    if (!val.trim()) {
      setSuggestions([]);
      setShowsuggest(false);
      return;
    }

    suggesttimer.current = setTimeout(async () => {
      try {
        const res = await fetchtmdb('/search/multi', { query: val.trim() });
        const raw = res.results || [];
        const items = raw.map((i: any) => norm(i)).filter(Boolean) as MediaItem[];
        setSuggestions(items.slice(0, 6));
        setShowsuggest(true);
      } catch (_) {
        setSuggestions([]);
      }
    }, 250);
  };

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (searchinput.trim()) {
      setsearchquery(searchinput.trim());
      setfiltergenre(null);
      setcurrentpage('search');
      setShowsuggest(false);
    }
  };

  const clearSearch = () => {
    setSearchinput('');
    setSuggestions([]);
    setShowsuggest(false);
    if (currentpage === 'search') {
      setsearchquery('');
      setcurrentpage('home');
    }
  };

  const selectGenre = (g: { id: number; name: string }) => {
    setfiltergenre(g);
    setsearchquery('');
    setcurrentpage('filter');
    setShowfilter(false);
    setShowmobilemenu(false);
  };

  const togglePlayerSource = () => {
    const sources: VideoSource[] = ['videasy', 'vidking', 'vyla'];
    const idx = sources.indexOf(playersource);
    const next = sources[(idx + 1) % sources.length];
    setplayersource(next);
    showtoast(`Đã chuyển sang trình phát: ${next === 'videasy' ? 'VidEasy' : next === 'vidking' ? 'VidKing' : 'Vyla'}`);
  };

  const toggleAudio = () => {
    setaudiosettings(prev => {
      const n = !prev.enabled;
      showtoast(n ? 'Đã bật hiệu ứng âm thanh' : 'Đã tắt hiệu ứng âm thanh');
      return { ...prev, enabled: n };
    });
  };

  const playerlabel = playersource === 'vidking' ? 'VidKing' : playersource === 'vyla' ? 'Vyla' : 'VidEasy';

  return (
    <div ref={navref}>
      <nav id="navbar" className={issolid ? 'solid' : ''}>
        <div className="nav-left">
          <div
            className="logo"
            id="logo-btn"
            tabIndex={0}
            role="button"
            onClick={() => {
              setsearchquery('');
              setfiltergenre(null);
              setcurrentpage('home');
            }}
          >
            <span className="logo-v">V</span>ERT
          </div>
          <ul className="nav-links" id="nav-links">
            <li
              className={`nav-link ${currentpage === 'home' ? 'active' : ''}`}
              onClick={() => {
                setsearchquery('');
                setfiltergenre(null);
                setcurrentpage('home');
              }}
            >
              Trang chủ
            </li>
            <li className="nav-link-dropdown" id="filter-wrapper">
              <span
                className={`nav-link ${currentpage === 'filter' ? 'active' : ''}`}
                onClick={() => setShowfilter(!showfilter)}
              >
                Lọc{' '}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 10l5 5 5-5z" />
                </svg>
              </span>
            </li>
            <li
              className={`nav-link ${currentpage === 'mylist' ? 'active' : ''}`}
              onClick={() => {
                setcurrentpage('mylist');
              }}
            >
              Danh sách của tôi
            </li>
          </ul>
          <div
            className="mobile-menu-btn"
            id="mobile-menu-btn"
            onClick={() => setShowmobilemenu(!showmobilemenu)}
          >
            <span>Duyệt</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 10l5 5 5-5z" />
            </svg>
          </div>
        </div>

        <div className="nav-right">
          <form className="search-wrapper" id="search-wrapper" onSubmit={handleSearchSubmit}>
            <button type="submit" className="search-btn" id="search-btn" title="Tìm kiếm">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <circle cx="11" cy="11" r="7" />
                <line x1="16.5" y1="16.5" x2="22" y2="22" />
              </svg>
            </button>
            <input
              type="text"
              id="search-input"
              placeholder="Tên phim, diễn viên, thể loại"
              value={searchinput}
              onChange={e => handleSearchInput(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) setShowsuggest(true);
              }}
              spellCheck={false}
              autoComplete="off"
            />
            {searchinput && (
              <button
                type="button"
                className="search-clear"
                id="search-clear"
                onClick={clearSearch}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
            {showsuggest && suggestions.length > 0 && (
              <div className="search-suggestions active" id="search-suggestions">
                {suggestions.map(s => (
                  <div
                    key={s.id}
                    className="suggest-item"
                    onClick={() => {
                      opendetail(s);
                      setShowsuggest(false);
                    }}
                  >
                    <img
                      src={s.poster || 'https://via.placeholder.com/50x75/141414/ffffff?text=VERT'}
                      alt={s.title}
                      className="suggest-poster"
                    />
                    <div className="suggest-info">
                      <div className="suggest-title">{s.title}</div>
                      <div className="suggest-meta">
                        <span className="sug-type">{s.type === 'tv' ? 'Phim bộ' : 'Phim lẻ'}</span>
                        {s.year ? ` · ${s.year}` : ''}
                        {s.rating ? ` · ${s.rating} ★` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </form>

          <button className="nav-icon-btn" title="Thông báo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </button>

          <div
            className={`nav-avatar ${showaccount ? 'open' : ''}`}
            id="nav-avatar"
            onClick={() => setShowaccount(!showaccount)}
          >
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png"
              alt="Hồ sơ"
            />
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="avatar-caret">
              <path d="M7 10l5 5 5-5z" />
            </svg>

            {showaccount && (
              <div className="account-dropdown open" id="account-dropdown" onClick={e => e.stopPropagation()}>
                <div className="account-header">
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png"
                    alt="Hồ sơ"
                  />
                  <div className="account-info">
                    <span className="account-name">Người xem</span>
                    <span className="account-sub">Quản lý hồ sơ</span>
                  </div>
                </div>
                <div className="account-divider"></div>
                <button
                  className="account-item"
                  id="settings-clear-history"
                  onClick={() => {
                    clearhistory();
                    setShowaccount(false);
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="1 4 1 10 7 10" />
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                  </svg>
                  <span>Xóa lịch sử xem</span>
                </button>
                <button
                  className="account-item"
                  id="settings-clear-progress"
                  onClick={() => {
                    clearprogress();
                    setShowaccount(false);
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span>Xóa tiến độ xem</span>
                </button>
                <button
                  className="account-item"
                  id="settings-clear-list"
                  onClick={() => {
                    clearmylist();
                    setShowaccount(false);
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                  </svg>
                  <span>Xóa danh sách của tôi</span>
                </button>
                <button
                  className="account-item"
                  id="settings-clear-cache"
                  onClick={() => {
                    clearcache();
                    setShowaccount(false);
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zM11.5 12.5L16 8" />
                    <path d="M16 8l5-1-1 5" />
                  </svg>
                  <span>Xóa bộ nhớ đệm</span>
                </button>
                <button
                  className="account-item"
                  id="settings-sync"
                  onClick={() => {
                    setsyncmodalopen(true);
                    setShowaccount(false);
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4v5h5" />
                    <path d="M20 20v-5h-5" />
                    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L4 4m16 16l-1.64-1.64A9 9 0 0 1 3.51 15" />
                  </svg>
                  <span>Đồng bộ dữ liệu</span>
                </button>
                <button
                  className="account-item"
                  id="settings-toggle-player"
                  onClick={togglePlayerSource}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  <span>Trình phát: {playerlabel}</span>
                </button>
                <button
                  className="account-item"
                  id="settings-audio-panel"
                  onClick={() => {
                    setaudiopanelopen(true);
                    setShowaccount(false);
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 5 6 9H3v6h3l5 4V5z" />
                    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                    <path d="M18.5 5.5a9 9 0 0 1 0 13" />
                  </svg>
                  <span>Âm thanh chân thật: {audiosettings.enabled ? 'Bật' : 'Tắt'}</span>
                </button>
                <div className="account-divider"></div>
                <div className="account-version">v1.1.0 · Dữ liệu từ TMDB</div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {showfilter && (
        <div className="filter-dropdown open" id="filter-dropdown">
          {GENRE_LIST.map(g => (
            <div
              key={g.id}
              className="filter-item"
              onClick={() => selectGenre(g)}
            >
              {g.name}
            </div>
          ))}
        </div>
      )}

      {showmobilemenu && (
        <div className="mobile-dropdown open" id="mobile-dropdown">
          <div
            className={`mobile-dropdown-item ${currentpage === 'home' ? 'active' : ''}`}
            onClick={() => {
              setcurrentpage('home');
              setShowmobilemenu(false);
            }}
          >
            Trang chủ
          </div>
          <div
            className={`mobile-dropdown-item ${currentpage === 'filter' ? 'active' : ''}`}
            onClick={() => {
              setShowfilter(!showfilter);
              setShowmobilemenu(false);
            }}
          >
            Lọc
          </div>
          <div
            className={`mobile-dropdown-item ${currentpage === 'mylist' ? 'active' : ''}`}
            onClick={() => {
              setcurrentpage('mylist');
              setShowmobilemenu(false);
            }}
          >
            Danh sách của tôi
          </div>
        </div>
      )}

      <nav className="mobile-bottom-nav" id="mobile-bottom-nav">
        <div
          className={`bottom-nav-item ${currentpage === 'home' ? 'active' : ''}`}
          onClick={() => setcurrentpage('home')}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
          <span>Trang chủ</span>
        </div>
        <div
          className={`bottom-nav-item ${currentpage === 'filter' ? 'active' : ''}`}
          onClick={() => setShowfilter(!showfilter)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          <span>Lọc</span>
        </div>
        <div
          className={`bottom-nav-item ${currentpage === 'mylist' ? 'active' : ''}`}
          onClick={() => setcurrentpage('mylist')}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
          <span>Danh sách của tôi</span>
        </div>
      </nav>
    </div>
  );
}
