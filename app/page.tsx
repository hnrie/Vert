'use client';

import React from 'react';
import { AppProvider, useapp } from '../context/appcontext';
import Titlebar from '../components/titlebar';
import Navbar from '../components/navbar';
import HeroBanner from '../components/herobanner';
import ContentRow from '../components/contentrow';
import MediaCard from '../components/mediacard';
import SearchView from '../components/searchview';
import DetailModal from '../components/detailmodal';
import SyncModal from '../components/syncmodal';
import PlayerOverlay from '../components/player/playeroverlay';
import AudioPanel from '../components/player/audiopanel';
import { MediaItem } from '../lib/types';

function MainAppContent() {
  const { currentpage, mylist, history, setcurrentpage } = useapp();

  const historymediaitems: MediaItem[] = history.map(h => ({
    id: h.id,
    title: h.title,
    type: h.mediatype,
    poster: h.poster,
    backdrop: h.backdrop,
    desc: '',
    rating: h.rating,
    year: h.year,
    genreids: []
  }));

  return (
    <>
      <Titlebar />
      <Navbar />

      <main className="main-container">
        {(currentpage === 'search' || currentpage === 'filter') && <SearchView />}

        {currentpage === 'mylist' && (
          <section className="page-section mylist-page active" id="mylist-page">
            <div className="page-inner">
              <h2 className="page-heading">Danh sách của tôi</h2>
              {mylist.length > 0 ? (
                <div className="card-grid" id="mylist-grid">
                  {mylist.map(item => (
                    <MediaCard key={item.id} item={item} />
                  ))}
                </div>
              ) : (
                <div className="empty-state" id="mylist-empty" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1">
                    <path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z" />
                  </svg>
                  <h3>Danh sách của bạn đang trống</h3>
                  <p>Thêm phim và chương trình bạn muốn xem sau</p>
                  <button
                    className="btn-hero btn-white"
                    style={{ marginTop: 20 }}
                    onClick={() => setcurrentpage('home')}
                  >
                    Khám phá nội dung
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {currentpage === 'home' && (
          <>
            <HeroBanner />
            <main id="main-rows">
              {historymediaitems.length > 0 && (
                <ContentRow
                  title="Tiếp tục xem dành cho bạn"
                  items={historymediaitems}
                  isContinueRow={true}
                />
              )}
              <ContentRow
                title="Xu Hướng Phim Hôm Nay"
                fetchEndpoint="/trending/all/day"
              />
              <ContentRow
                title="Top Phim Chiếu Rạp Hot"
                fetchEndpoint="/movie/popular"
              />
              <ContentRow
                title="Loạt Phim Truyền Hình Hot"
                fetchEndpoint="/tv/popular"
              />
              <ContentRow
                title="Hoạt Hình Anime Cho Bạn"
                fetchEndpoint="/discover/tv?with_genres=16"
              />
              <ContentRow
                title="Phim Hành Động Kịch Tính"
                fetchEndpoint="/discover/movie?with_genres=28"
              />
            </main>
          </>
        )}

        {currentpage === 'movies' && (
          <>
            <HeroBanner />
            <main id="main-rows">
              <ContentRow
                title="Phim Chiếu Rạp Phổ Biến"
                fetchEndpoint="/movie/popular"
              />
              <ContentRow
                title="Phim Chiếu Rạp Đánh Giá Cao"
                fetchEndpoint="/movie/top_rated"
              />
              <ContentRow
                title="Phim Hành Động Hot"
                fetchEndpoint="/discover/movie?with_genres=28"
              />
              <ContentRow
                title="Phim Hoạt Hình Chiếu Rạp"
                fetchEndpoint="/discover/movie?with_genres=16"
              />
            </main>
          </>
        )}

        {currentpage === 'tv' && (
          <>
            <HeroBanner />
            <main id="main-rows">
              <ContentRow
                title="Loạt Phim Truyền Hình Phổ Biến"
                fetchEndpoint="/tv/popular"
              />
              <ContentRow
                title="Loạt Phim Đánh Giá Cao"
                fetchEndpoint="/tv/top_rated"
              />
              <ContentRow
                title="Hoạt Hình Anime Hot"
                fetchEndpoint="/discover/tv?with_genres=16"
              />
              <ContentRow
                title="Phim Chính Kịch Sâu Sắc"
                fetchEndpoint="/discover/tv?with_genres=18"
              />
            </main>
          </>
        )}
      </main>

      <footer>
        <p className="footer-copy">© 2026 Vert~uwu Dữ liệu từ TMDB</p>
      </footer>

      <DetailModal />
      <SyncModal />
      <PlayerOverlay />
      <AudioPanel />
    </>
  );
}

export default function homepage() {
  return (
    <AppProvider>
      <MainAppContent />
    </AppProvider>
  );
}
