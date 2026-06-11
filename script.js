
const IMG = 'https://image.tmdb.org/t/p';
const VIDKING = 'https://www.vidking.net/embed';
const VIDKING_ORIGIN = 'https://www.vidking.net';
const VIDEASY = 'https://player.videasy.net';
const VYLA = 'https://vyla.pages.dev';
let playerSource = localStorage.getItem('vk_player') || 'videasy';
const DEFAULT_AUDIO_SETTINGS = { enabled: false, spatial: false, volume: 0.45, width: 0.6, depth: 0.45 };
let audioSettings = (() => {
    try { return { ...DEFAULT_AUDIO_SETTINGS, ...(JSON.parse(localStorage.getItem('vk_audio_settings') || '{}')) }; }
    catch (_) { return { ...DEFAULT_AUDIO_SETTINGS }; }
})();
let audioEngine = null;

const IS_LOCAL = location.hostname === 'localhost' || 
                 location.hostname === '127.0.0.1' || 
                 location.hostname === 'tauri.localhost' || 
                 location.protocol === 'file:' || 
                 location.hostname.startsWith('192.168.') || 
                 location.hostname.startsWith('10.') || 
                 location.hostname.startsWith('172.') || 
                 location.hostname.endsWith('.local') ||
                 !!window.__TAURI__ || 
                 !!window.Capacitor;

const API_KEY = '85134f05e0f15fe779e23cd56c1a08d5';
const BASE = 'https://api.themoviedb.org/3';

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function saveAudioSettings() {
    localStorage.setItem('vk_audio_settings', JSON.stringify(audioSettings));
}

function createAudioEngine() {
    // Disabled per user request to clean up console errors
    return;
}

function updateAudioLabel() {
    const el = document.getElementById('audio-settings-text');
    if (el) el.textContent = `Âm thanh chân thật: ${audioSettings.enabled ? 'Bật' : 'Tắt'}`;
}

function applyAudioScene() {
    if (!audioEngine) return;
    const targetVolume = audioSettings.enabled ? (audioSettings.volume * 0.7) : 0;
    audioEngine.hum.fade(audioEngine.hum.volume(), targetVolume, 280);
    if (audioSettings.enabled && !audioEngine.hum.playing()) audioEngine.hum.play();
}

function playUiSound(kind, pan = 0) {
    if (!audioSettings.enabled || !audioEngine || !audioEngine[kind]) return;
    const snd = audioEngine[kind];
    const id = snd.play();
    snd.volume(Math.max(0, Math.min(1, audioSettings.volume)), id);
    if (audioSettings.spatial && typeof snd.stereo === 'function') snd.stereo(Math.max(-1, Math.min(1, pan)), id);
}


const TRUSTED_NAV_HOSTS = new Set([location.hostname, 'www.themoviedb.org', 'themoviedb.org']);

function isLikelyAdUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return false;
    let url;
    try { url = new URL(rawUrl, location.href); } catch (_) { return false; }
    const host = url.hostname.toLowerCase();
    const pathAndQuery = `${url.pathname}${url.search}`.toLowerCase();
    if (host === location.hostname) return false;
    const noisyHost = /(adservice|doubleclick|popads|propellerads|adsterra|trafficjunky|exoclick|hilltopads|taboola|outbrain|adnxs|mgid|popcash)/.test(host);
    const noisyPath = /(ad[sx]?|popunder|redirect|clickid|utm_source=ad|gclid=|fbclid=|zoneid=|campaignid=)/.test(pathAndQuery);
    return noisyHost || noisyPath;
}

function installAdHooks() {
    if (window.__vertAdHooksInstalled) return;
    window.__vertAdHooksInstalled = true;

    const nativeOpen = window.open;
    window.open = function hookedWindowOpen(url, target, features) {
        const blocked = isLikelyAdUrl(url) && target === '_blank';
        if (blocked) {
            showToast('Đã chặn cửa sổ quảng cáo nghi ngờ');
            return {
                closed: false,
                focus: function() {},
                blur: function() {},
                close: function() { this.closed = true; },
                postMessage: function() {},
                location: { href: url || '' },
                document: { write: function() {}, close: function() {} }
            };
        }
        return nativeOpen.call(window, url, target, features);
    };

    document.addEventListener('click', (event) => {
        const anchor = event.target.closest && event.target.closest('a[href]');
        if (!anchor) return;
        const href = anchor.getAttribute('href') || '';
        if (href.startsWith('#')) return;
        const opensNewTab = anchor.target === '_blank' || anchor.rel.includes('noopener');
        if (!opensNewTab) return;
        if (isLikelyAdUrl(href)) {
            event.preventDefault();
            event.stopPropagation();
            showToast('Đã chặn liên kết quảng cáo nghi ngờ');
        }
    }, true);

    let lastSafePath = `${location.pathname}${location.search}${location.hash}`;
    setInterval(() => {
        const currentPath = `${location.pathname}${location.search}${location.hash}`;
        if (currentPath !== lastSafePath) {
            const outsideTrusted = !TRUSTED_NAV_HOSTS.has(location.hostname);
            if (outsideTrusted || isLikelyAdUrl(location.href)) {
                history.replaceState(null, '', lastSafePath);
                showToast('Đã chặn chuyển hướng nghi ngờ');
                return;
            }
            lastSafePath = currentPath;
        }
    }, 900);
}
const ROWS = [
    { id: 'trending', title: 'Xu hướng hiện nay', endpoint: '/trending/all/week', mediaType: 'all', badge: 'top10' },
    { id: 'popular-m', title: 'Phổ biến trên Vert', endpoint: '/movie/popular', mediaType: 'movie' },
    { id: 'now-play', title: 'Đang chiếu ngoài rạp', endpoint: '/movie/now_playing', mediaType: 'movie', badge: 'new' },
    { id: 'top-m', title: 'Phim được đánh giá cao nhất', endpoint: '/movie/top_rated', mediaType: 'movie' },
    { id: 'upcoming', title: 'Phim sắp chiếu', endpoint: '/movie/upcoming', mediaType: 'movie', badge: 'new' },
    { id: 'popular-t', title: 'Chương trình truyền hình phổ biến', endpoint: '/tv/popular', mediaType: 'tv' },
    { id: 'top-t', title: 'Chương trình truyền hình đánh giá cao nhất', endpoint: '/tv/top_rated', mediaType: 'tv' },
    { id: 'airing', title: 'Đang phát sóng', endpoint: '/tv/on_the_air', mediaType: 'tv', badge: 'new' },
    { id: 'action', title: 'Hành động & Phiêu lưu', endpoint: '/discover/movie?with_genres=28&sort_by=popularity.desc&vote_count.gte=100', mediaType: 'movie' },
    { id: 'comedy', title: 'Hài', endpoint: '/discover/movie?with_genres=35&sort_by=popularity.desc&vote_count.gte=100', mediaType: 'movie' },
    { id: 'horror', title: 'Kinh dị', endpoint: '/discover/movie?with_genres=27&sort_by=popularity.desc&vote_count.gte=50', mediaType: 'movie' },
    { id: 'scifi', title: 'Khoa học viễn tưởng', endpoint: '/discover/movie?with_genres=878&sort_by=popularity.desc&vote_count.gte=100', mediaType: 'movie' },
    { id: 'romance', title: 'Phim lãng mạn', endpoint: '/discover/movie?with_genres=10749&sort_by=popularity.desc&vote_count.gte=50', mediaType: 'movie' },
    { id: 'thriller', title: 'Giật gân', endpoint: '/discover/movie?with_genres=53&sort_by=popularity.desc&vote_count.gte=100', mediaType: 'movie' },
    { id: 'docs', title: 'Tài liệu', endpoint: '/discover/movie?with_genres=99&sort_by=popularity.desc&vote_count.gte=20', mediaType: 'movie' },
    { id: 'animation', title: 'Hoạt hình', endpoint: '/discover/movie?with_genres=16&sort_by=popularity.desc&vote_count.gte=50', mediaType: 'movie' },
    { id: 'anime-tv', title: 'Phim anime', endpoint: '/discover/tv?with_genres=16&sort_by=popularity.desc&vote_count.gte=20', mediaType: 'tv' },
    { id: 'crime-tv', title: 'Phim hình sự', endpoint: '/discover/tv?with_genres=80&sort_by=popularity.desc&vote_count.gte=50', mediaType: 'tv' },
];

const GENRE_MAP = {};


let currentPage = 'home';
let heroItem = null;
let detailCurrent = null;
let searchDebounce = null;
let suggestDebounce = null;
let filterCurrent = null;
let lastSearchQuery = '';
let searchPage = 1;
let filterPage = 1;
let isFetchingMore = false;
let ignoreProgress = false;


const CACHE_TTL = 30 * 60 * 1000;

async function tmdb(ep, extra = {}) {
    let url;
    const forceDirect = !!window.__TAURI__ || !!window.Capacitor || IS_LOCAL;
    
    const getDirectUrl = () => {
        const sep = ep.includes('?') ? '&' : '?';
        let u = `${BASE}${ep}${sep}api_key=${API_KEY}&language=vi-VN`;
        Object.entries(extra).forEach(([k, v]) => u += `&${k}=${encodeURIComponent(v)}`);
        return u;
    };

    if (forceDirect) {
        url = getDirectUrl();
    } else {
        const params = new URLSearchParams({ ep, ...extra });
        url = `/api/tmdb?${params.toString()}`;
    }

    const cacheKey = 'tmdb_' + ep + JSON.stringify(extra);
    if (!Object.keys(extra).includes('query')) {
        try {
            const cached = sessionStorage.getItem(cacheKey);
            if (cached) {
                const { data, ts } = JSON.parse(cached);
                if (Date.now() - ts < CACHE_TTL) return data;
            }
        } catch (_) { }
    }

    let r = await fetch(url);
    let data;

    const tryParse = async (res) => {
        const ct = res.headers.get('content-type');
        if (ct && ct.includes('application/json')) return await res.json();
        throw new Error('Not JSON');
    };

    try {
        if (!r.ok) throw new Error('Not OK');
        data = await tryParse(r);
    } catch (err) {
        if (!forceDirect) {
            console.warn(`TMDB Proxy failed or returned non-JSON, falling back to direct API`);
            url = getDirectUrl();
            r = await fetch(url);
            if (!r.ok) throw new Error(`TMDB Direct ${r.status}`);
            data = await r.json();
        } else {
            throw err;
        }
    }

    if (!Object.keys(extra).includes('query')) {
        try { sessionStorage.setItem(cacheKey, JSON.stringify({ data, ts: Date.now() })); } catch (_) { }
    }
    return data;
}

function norm(item, fallback) {
    const mt = item.media_type || fallback || 'movie';
    if (mt === 'person') return null;
    return {
        id: String(item.id),
        title: item.title || item.name || '',
        type: mt,
        poster: item.poster_path ? `${IMG}/w500${item.poster_path}` : null,
        backdrop: item.backdrop_path ? `${IMG}/w1280${item.backdrop_path}` : null,
        desc: item.overview || '',
        rating: item.vote_average ? item.vote_average.toFixed(1) : null,
        year: (item.release_date || item.first_air_date || '').slice(0, 4) || null,
        genreIds: item.genre_ids || [],
    };
}

async function loadGenres() {
    try {
        const [m, t] = await Promise.all([
            tmdb('/genre/movie/list').catch(() => ({ genres: [] })),
            tmdb('/genre/tv/list').catch(() => ({ genres: [] }))
        ]);
        [...(m.genres || []), ...(t.genres || [])].forEach(g => GENRE_MAP[g.id] = g.name);
        buildFilterMenu();
    } catch (e) {
        console.error('Failed to load genres', e);
    }
}

function buildFilterMenu() {
    const box = document.getElementById('filter-dropdown');
    const genres = Object.entries(GENRE_MAP).sort((a,b) => a[1].localeCompare(b[1]));
    const uniqueGenres = [];
    const seenNames = new Set();
    genres.forEach(([id, name]) => {
        if (name === 'Western' || name === 'Westerns') return; // Skip Western
        if (!seenNames.has(name)) {
            seenNames.add(name);
            uniqueGenres.push({id, name});
        }
    });

    if (!seenNames.has('Anime')) {
        uniqueGenres.push({id: '16', name: 'Anime'});
    }

    box.innerHTML = uniqueGenres.map(g => `<div class="filter-item" data-id="${g.id}">${g.name}</div>`).join('');
    box.querySelectorAll('.filter-item').forEach(el => {
        el.onclick = () => {
            const id = el.dataset.id;
            const name = el.textContent;
            setFilterDropdown(false);
            applyFilter(id, name);
        };
    });
}

function genreNames(ids) { return (ids || []).map(i => GENRE_MAP[i]).filter(Boolean); }


function getPlayerName(source) {
    if (source === 'vidking') return 'VidKing';
    if (source === 'vyla') return 'Vyla';
    return 'VidEasy';
}

document.addEventListener('DOMContentLoaded', async () => {
    wireListeners();
    const pt = document.getElementById('player-source-text');
    if (pt) pt.textContent = `Trình phát: ${getPlayerName(playerSource)}`;
    installAdHooks();
    const hash = window.location.hash.slice(1);
    if (['movies', 'tv', 'mylist'].includes(hash)) {
        currentPage = hash;
    } else if (hash.startsWith('movie/') || hash.startsWith('tv/')) {
        // We handle detail view opening after rows load so it doesn't block the UI
        const [type, id] = hash.split('/');
        setTimeout(() => loadDetailFromUrl(type, id), 500);
    }

    try {
        await loadGenres();
        await buildAllRows();
        pickHero();
        buildContinueRow();
        setupInfiniteScroll();
        if (currentPage !== 'home') navTo(currentPage, false);
        hideLoader();
    } catch (e) { console.error('Boot', e); }
});

function setupInfiniteScroll() {
    const sentinel = document.getElementById('infinite-scroll-sentinel');
    const observer = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting && !isFetchingMore) {
            loadNextPage();
        }
    }, { rootMargin: '400px' });
    observer.observe(sentinel);
}

async function loadNextPage() {
    const sp = document.getElementById('search-page');
    if (!sp.classList.contains('active')) return;

    isFetchingMore = true;
    const loader = document.getElementById('search-loading');
    loader.classList.add('active');

    try {
        let results = [];
        if (filterCurrent) {
            filterPage++;
            const params = { with_genres: filterCurrent.id, page: filterPage };
            if (filterCurrent.name === 'Anime') params.with_original_language = 'ja';
            const [m, t] = await Promise.all([tmdb('/discover/movie', params), tmdb('/discover/tv', params)]);
            results = [...(m.results || []).map(r => norm(r, 'movie')), ...(t.results || []).map(r => norm(r, 'tv'))];
        } else if (lastSearchQuery) {
            searchPage++;
            const [m, t] = await Promise.all([
                tmdb('/search/movie', { query: lastSearchQuery, page: searchPage }),
                tmdb('/search/tv', { query: lastSearchQuery, page: searchPage })
            ]);
            results = [...(m.results || []).map(r => norm(r, 'movie')), ...(t.results || []).map(r => norm(r, 'tv'))];
        }

        const items = results.filter(i => i && i.poster).sort((a,b) => (b.rating || 0) - (a.rating || 0));
        const grid = document.getElementById('search-grid');
        items.forEach(i => grid.appendChild(makeCard(i)));
        
        if (results.length === 0) {
            // No more results to fetch
            document.getElementById('infinite-scroll-sentinel').style.display = 'none';
        }
    } catch (e) { console.error('Paging error', e); } finally {
        isFetchingMore = false;
        loader.classList.remove('active');
    }
}

function genreNames(ids) { return (ids || []).map(i => GENRE_MAP[i]).filter(Boolean); }

async function loadDetailFromUrl(type, id) {
    try {
        const itemData = await tmdb(`/${type}/${id}`);
        const item = {
            id: String(itemData.id),
            title: itemData.title || itemData.name || '',
            type: type,
            media_type: type,
            poster_path: itemData.poster_path,
            backdrop_path: itemData.backdrop_path,
            overview: itemData.overview,
            vote_average: itemData.vote_average,
            release_date: itemData.release_date,
            first_air_date: itemData.first_air_date,
            genre_ids: (itemData.genres || []).map(g => g.id)
        };
        openDetail(norm(item, type), false);
    } catch (e) {
        console.error('Failed to load item from URL', e);
    }
}


let trendingData = null;

async function buildAllRows() {
    const main = document.getElementById('main-rows');
    main.innerHTML = '';

    const seenIds = new Set();

    const BATCH_SIZE = 10;
    const allResults = [];
    for (let i = 0; i < ROWS.length; i += BATCH_SIZE) {
        const batch = ROWS.slice(i, i + BATCH_SIZE);
        const tasks = batch.map(async cfg => {
            try {
                let ep = cfg.endpoint;
                if (ep.includes('/discover/')) {
                    const page = Math.floor(Math.random() * 3) + 1;
                    ep += `&page=${page}`;
                }
                const data = await tmdb(ep);
                if (cfg.id === 'trending') trendingData = data;
                return { cfg, items: (data.results || []).map(r => norm(r, cfg.mediaType)).filter(Boolean) };
            } catch (err) {
                console.warn(`Failed to load row ${cfg.id}:`, err);
                return { cfg, items: [] };
            }
        });
        const results = await Promise.allSettled(tasks);
        allResults.push(...results);
    }
    allResults.forEach(r => {
        if (r.status !== 'fulfilled') return;
        const { cfg, items } = r.value;
        const unique = items.filter(item => {
            if (seenIds.has(item.id)) return false;
            seenIds.add(item.id);
            return true;
        });
        if (!unique.length) return;
        main.appendChild(makeRow(cfg, unique));
    });
}

function makeRow(cfg, items) {
    const sec = document.createElement('section');
    sec.className = 'content-row';
    sec.dataset.type = cfg.mediaType;
    sec.dataset.rowid = cfg.id;
    sec.innerHTML = `
        <div class="row-head">
            <h2>${cfg.title}</h2>
            <span class="see-all">Xem tất cả <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg></span>
        </div>
        <div class="slider-wrap">
            <button class="slide-arrow l" aria-label="Trái">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
            </button>
            <div class="slider-track"></div>
            <button class="slide-arrow r" aria-label="Phải">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
            </button>
        </div>`;
    const track = sec.querySelector('.slider-track');
    items.forEach((item, idx) => track.appendChild(makeCard(item, cfg.badge, idx)));
    sec.querySelector('.slide-arrow.l').onclick = () => track.scrollBy({ left: -track.clientWidth * .82, behavior: 'smooth' });
    sec.querySelector('.slide-arrow.r').onclick = () => track.scrollBy({ left: track.clientWidth * .82, behavior: 'smooth' });
    return sec;
}


function makeCard(item, badgeType, idx) {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.animationDelay = `${(idx % 20) * 0.05}s`;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Xem chi tiết ${item.title}`);

    if (item.poster) {
        const img = document.createElement('img');
        img.loading = 'lazy'; img.alt = item.title; img.src = item.poster;
        img.onerror = () => { img.remove(); card.classList.add('no-img'); card.textContent = item.title; };
        card.appendChild(img);
    } else {
        card.classList.add('no-img');
        card.textContent = item.title;
    }

    if (badgeType === 'top10' && idx < 10) {
        const b = document.createElement('div');
        b.className = 'top-badge'; b.textContent = `HẠNG ${idx + 1}`;
        card.appendChild(b);
    } else if (badgeType === 'new') {
        const b = document.createElement('div');
        b.className = 'new-badge'; b.textContent = 'Mới';
        card.appendChild(b);
    }

    const prog = getProgress(item.id, item.type);
    if (prog && prog.progress > 2) {
        const bar = document.createElement('div'); bar.className = 'card-progress';
        const fill = document.createElement('div'); fill.className = 'card-progress-fill';
        fill.style.width = Math.min(prog.progress, 100) + '%';
        bar.appendChild(fill); card.appendChild(bar);
    }

    const genres = genreNames(item.genreIds).slice(0, 3).join(' · ');
    const panel = document.createElement('div');
    panel.className = 'card-panel';
    const inList = isInMyList(item.id);
    const plusIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
    const checkIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
    panel.innerHTML = `
        <div class="card-btns">
            <button class="card-circle play-c" data-do="play" title="Phát" aria-label="Phát">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4l15 8-15 8z"/></svg>
            </button>
            <button class="card-circle ${inList ? 'in-list' : ''}" data-do="list" title="${inList ? 'Xóa khỏi danh sách' : 'Thêm vào danh sách'}" aria-label="${inList ? 'Xóa khỏi danh sách' : 'Thêm vào danh sách'}">${inList ? checkIcon : plusIcon}</button>
            <button class="card-circle card-info-btn" data-do="info" title="Thông tin thêm" aria-label="Thông tin thêm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
        </div>
        ${item.rating ? `<div class="card-match">${Math.round(item.rating * 10)}% phù hợp</div>` : ''}
        <div class="card-name">${item.title}</div>
        ${genres ? `<div class="card-tags">${genres}</div>` : ''}`;
    card.appendChild(panel);

    panel.querySelector('[data-do="play"]').onclick = e => { e.stopPropagation(); playContent(item); };
    const listBtn = panel.querySelector('[data-do="list"]');
    listBtn.onclick = e => {
        e.stopPropagation();
        toggleMyList(item);
        const nowInList = isInMyList(item.id);
        listBtn.innerHTML = nowInList ? checkIcon : plusIcon;
        listBtn.title = nowInList ? 'Xóa khỏi danh sách' : 'Thêm vào danh sách';
        listBtn.setAttribute('aria-label', nowInList ? 'Xóa khỏi danh sách' : 'Thêm vào danh sách');
        listBtn.classList.toggle('in-list', nowInList);
    };
    panel.querySelector('[data-do="info"]').onclick = e => { e.stopPropagation(); openDetail(item); };
    card.onclick = () => openDetail(item);
    card.onkeydown = e => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openDetail(item);
        }
    };
    return card;
}


function pickHero() {
    const use = data => {
        const ok = (data.results || []).map(r => norm(r)).filter(i => i && i.backdrop && i.desc);
        if (!ok.length) return;
        heroItem = ok[Math.floor(Math.random() * Math.min(ok.length, 6))];
        renderHero();
    };
    if (trendingData) { use(trendingData); return; }
    tmdb('/trending/all/week').then(use);
}

function renderHero() {
    if (!heroItem) return;
    document.getElementById('hero').style.backgroundImage = `url(${heroItem.backdrop})`;
    document.getElementById('hero-title').textContent = heroItem.title;
    document.getElementById('hero-overview').textContent = heroItem.desc;
    document.getElementById('hero-type-text').textContent = heroItem.type === 'tv' ? 'P H I M  B Ộ' : 'P H I M';

    const meta = document.getElementById('hero-metadata');
    meta.innerHTML = '';
    if (heroItem.rating) {
        const ms = document.createElement('span'); ms.className = 'match-score';
        ms.textContent = `${Math.round(heroItem.rating * 10)}% phù hợp`; meta.appendChild(ms);
    }
    if (heroItem.year) {
        const y = document.createElement('span'); y.className = 'meta-year';
        y.textContent = heroItem.year; meta.appendChild(y);
    }
    const mb = document.createElement('span'); mb.className = 'meta-badge'; mb.textContent = 'HD';
    meta.appendChild(mb);

    document.getElementById('hero-play-btn').onclick = () => playContent(heroItem);
    document.getElementById('hero-info-btn').onclick = () => openDetail(heroItem);
}


async function openDetail(item, updateUrl = true) {
    if (!item) return;
    detailCurrent = item;

    if (updateUrl) {
        history.pushState({ isDetail: true, type: item.type, id: item.id }, '', `#${item.type}/${item.id}`);
    }

    const ov = document.getElementById('detail-overlay');

    document.getElementById('detail-hero').style.backgroundImage = item.backdrop ? `url(${item.backdrop})` : 'none';
    document.getElementById('detail-title').textContent = item.title;
    document.getElementById('detail-overview').textContent = item.desc;

    const meta = document.getElementById('detail-meta');
    meta.innerHTML = '';
    if (item.rating) { const s = document.createElement('span'); s.className = 'match'; s.textContent = `${Math.round(item.rating * 10)}% phù hợp`; meta.appendChild(s); }
    if (item.year) { const s = document.createElement('span'); s.className = 'year'; s.textContent = item.year; meta.appendChild(s); }
    const b = document.createElement('span'); b.className = 'badge'; b.textContent = item.type === 'tv' ? 'Phim bộ' : 'Phim'; meta.appendChild(b);
    const hd = document.createElement('span'); hd.className = 'badge'; hd.textContent = 'HD'; meta.appendChild(hd);

    document.getElementById('detail-genre-line').innerHTML = genreNames(item.genreIds).length
        ? `<span>Thể loại:</span> ${genreNames(item.genreIds).join(', ')}` : '';

    const pb = document.getElementById('detail-play-btn');
    const pr = getProgress(item.id, item.type);
    if (pr && pr.season && pr.episode) {
        pb.querySelector('span').textContent = `Xem tiếp P${pr.season}:T${pr.episode}`;
        pb.onclick = () => playContent(item, pr.season, pr.episode);
    } else {
        pb.querySelector('span').textContent = 'Phát';
        pb.onclick = () => playContent(item);
    }
    syncListBtn(item);

    document.getElementById('episodes-section').classList.remove('active');
    document.getElementById('detail-cast-line').innerHTML = '';
    document.getElementById('similar-grid').innerHTML = '';
    document.getElementById('about-title').textContent = item.title;
    document.getElementById('about-details').innerHTML = '';

    ov.classList.add('active');
    document.body.style.overflow = 'hidden';
    ov.scrollTop = 0;

    try {
        const [det, cred, sim] = await Promise.all([
            tmdb(`/${item.type}/${item.id}`),
            tmdb(`/${item.type}/${item.id}/credits`),
            tmdb(`/${item.type}/${item.id}/similar`)
        ]);

        if (det.overview) { item.desc = det.overview; document.getElementById('detail-overview').textContent = det.overview; }
        if (det.genres) document.getElementById('detail-genre-line').innerHTML = `<span>Thể loại:</span> ${det.genres.map(g => g.name).join(', ')}`;

        const cast = (cred.cast || []).slice(0, 8);
        if (cast.length) document.getElementById('detail-cast-line').innerHTML = `<span>Diễn viên:</span> ${cast.map(c => c.name).join(', ')}`;

        const abt = document.getElementById('about-details');
        const rows = [];
        if (cast.length) rows.push(`<div class="about-row"><strong>Diễn viên:</strong> ${cast.map(c => c.name).join(', ')}</div>`);
        if (det.genres) rows.push(`<div class="about-row"><strong>Thể loại:</strong> ${det.genres.map(g => g.name).join(', ')}</div>`);
        if (det.status) rows.push(`<div class="about-row"><strong>Trạng thái:</strong> ${det.status}</div>`);
        if (det.runtime) rows.push(`<div class="about-row"><strong>Thời lượng:</strong> ${det.runtime} phút</div>`);
        if (det.vote_average) rows.push(`<div class="about-row"><strong>Đánh giá:</strong> ${det.vote_average.toFixed(1)}/10</div>`);
        abt.innerHTML = rows.join('');

        if (item.type === 'tv' && det.seasons) {
            const seasons = det.seasons.filter(s => s.season_number > 0);
            if (seasons.length) {
                meta.querySelector('.badge').textContent = `${seasons.length} phần`;
                const pick = document.getElementById('season-picker');
                pick.innerHTML = seasons.map(s => `<option value="${s.season_number}">Phần ${s.season_number}</option>`).join('');
                const sp = getProgress(item.id, 'tv');
                if (sp && sp.season) pick.value = sp.season;
                pick.onchange = () => fetchEps(item.id, +pick.value);
                await fetchEps(item.id, +pick.value);
                document.getElementById('episodes-section').classList.add('active');
            }
        }

        const sims = (sim.results || []).slice(0, 9).map(r => norm(r, item.type)).filter(Boolean);
        const sg = document.getElementById('similar-grid');
        sg.innerHTML = '';
        sims.forEach(si => {
            const sc = document.createElement('div');
            sc.className = 'sim-card';
            sc.tabIndex = 0;
            sc.setAttribute('role', 'button');
            sc.setAttribute('aria-label', `Xem chi tiết ${escapeHtml(si.title)}`);
            sc.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sc.click(); } };
            sc.innerHTML = `
                <img class="sim-card-img" src="${escapeHtml(si.backdrop || si.poster || '')}" alt="${escapeHtml(si.title)}" loading="lazy"
                     onerror="this.style.background='#333'">
                <div class="sim-card-body">
                    <div class="sim-card-head">
                        ${si.rating ? `<span class="sim-match">${Math.round(si.rating * 10)}%</span>` : '<span></span>'}
                        ${si.year ? `<span class="sim-year">${escapeHtml(si.year)}</span>` : ''}
                    </div>
                    <div class="sim-card-title">${escapeHtml(si.title)}</div>
                    <div class="sim-card-desc">${escapeHtml(si.desc)}</div>
                </div>`;
            sc.onclick = () => { closeDetail(); setTimeout(() => openDetail(si), 350); };
            sg.appendChild(sc);
        });
    } catch (e) { console.warn('Detail', e); }
}

function closeDetail(updateUrl = true) {
    document.getElementById('detail-overlay').classList.remove('active');
    document.body.style.overflow = '';
    detailCurrent = null;

    if (updateUrl) {
        if (currentPage === 'home') {
            history.pushState(null, '', window.location.pathname + window.location.search);
        } else {
            history.pushState(null, '', '#' + currentPage);
        }
    }
}

function syncListBtn(item) {
    const btn = document.getElementById('detail-list-btn');
    const yes = isInMyList(item.id);
    btn.classList.toggle('in-list', yes);
    btn.title = yes ? 'Xóa khỏi danh sách' : 'Thêm vào danh sách';
    btn.onclick = () => { toggleMyList(item); syncListBtn(item); };
}


async function fetchEps(tvId, sNum) {
    const list = document.getElementById('episodes-list');
    list.innerHTML = '<div class="loading-spinner-wrap active"><div class="spinner"></div></div>';
    try {
        const d = await tmdb(`/tv/${tvId}/season/${sNum}`);
        const eps = d.episodes || [];
        if (!eps.length) { list.innerHTML = '<div class="empty-state"><svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="1"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg><h3>Không có tập</h3><p>Các tập của phần này hiện chưa có.</p><button class="btn-hero btn-gray" style="margin-top: 20px;" onclick="closeDetail()">Quay lại</button></div>'; return; }
        list.innerHTML = eps.map(ep => {
            const still = ep.still_path ? `${IMG}/w300${ep.still_path}` : '';
            const rt = ep.runtime ? `${ep.runtime}m` : '';
            return `
                <div class="ep-card" tabindex="0" role="button" aria-label="Phát tập ${ep.episode_number}: ${escapeHtml(ep.name) || 'Tập ' + ep.episode_number}" onkeydown="if(event.key==='Enter'||event.key===' ') { event.preventDefault(); this.click(); }" onclick="playContent(detailCurrent,${sNum},${ep.episode_number})">
                    <div class="ep-index">${ep.episode_number}</div>
                    <div class="ep-thumb" style="background-image:url(${escapeHtml(still)})">
                        <div class="ep-play-overlay"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
                    </div>
                    <div class="ep-info">
                        <div class="ep-info-top">
                            <span class="ep-name">${escapeHtml(ep.name) || 'Tập ' + ep.episode_number}</span>
                            <span class="ep-len">${escapeHtml(rt)}</span>
                        </div>
                        <div class="ep-synopsis">${escapeHtml(ep.overview || '')}</div>
                    </div>
                </div>`;
        }).join('');
    } catch (e) { list.innerHTML = '<div class="empty-state"><svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#ff4444" stroke-width="1"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg><h3 style="color:#ff4444">Tải thất bại</h3><p>Vui lòng thử lại sau.</p><button class="btn-hero btn-gray" style="margin-top: 20px;" onclick="closeDetail()">Quay lại</button></div>'; }
}


function playContent(item, season, episode) {
    if (!item) return;
    saveHistory(item);

    destroyPlayerFrame();

    if (item.type === 'tv' && !season && !episode) {
        const pr = getProgress(item.id, 'tv');
        if (pr && pr.season && pr.episode) {
            season = pr.season;
            episode = pr.episode;
        }
    }

    const s = season || 1;
    const e = episode || 1;

    let url;


    if (item.type === 'tv') {
        if (playerSource === 'vidking') {
            url = `${VIDKING}/tv/${item.id}/${s}/${e}?color=e50914&autoPlay=true&nextEpisode=true&episodeSelector=true`;
        } else if (playerSource === 'vyla') {
            url = `${VYLA}/tv/${item.id}/${s}/${e}`;
        } else {
            url = `${VIDEASY}/tv/${item.id}/${s}/${e}?color=e50914&autoplayNextEpisode=true&nextEpisode=true&episodeSelector=true&overlay=true`;
        }
    } else {
        if (playerSource === 'vidking') {
            url = `${VIDKING}/movie/${item.id}?color=e50914&autoPlay=true`;
        } else if (playerSource === 'vyla') {
            url = `${VYLA}/movie/${item.id}`;
        } else {
            url = `${VIDEASY}/movie/${item.id}?color=e50914&overlay=true`;
        }
    }

    closeDetail();

    ignoreProgress = false;

    setTimeout(() => {
        const frame = document.getElementById('player-frame');
        frame.innerHTML = `<iframe src="${url}" allowfullscreen allow="autoplay;fullscreen;encrypted-media;picture-in-picture"></iframe>`;
    }, 150);

    const playerOverlay = document.getElementById('player-overlay');
    playerOverlay.classList.remove('show-audio-panel');
    playerOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    playUiSound('open', 0.35);
    applyAudioScene();
}

function destroyPlayerFrame() {
    const wrap = document.getElementById('player-frame');
    const iframe = wrap.querySelector('iframe');
    if (iframe) {
        try { iframe.contentWindow.postMessage('{"type":"PAUSE"}', '*'); } catch (_) { }
        iframe.src = 'about:blank';   // force-stop all media
        iframe.remove();
    }
    wrap.innerHTML = '';
}

function closePlayer() {
    ignoreProgress = true;
    destroyPlayerFrame();
    const playerOverlay = document.getElementById('player-overlay');
    playerOverlay.classList.remove('active', 'show-audio-panel');
    document.body.style.overflow = '';
    applyAudioScene();
    buildContinueRow();
}


async function applyFilter(genreId, genreName) {
    filterCurrent = { id: genreId, name: genreName };
    filterPage = 1;
    lastSearchQuery = '';
    document.getElementById('infinite-scroll-sentinel').style.display = 'block';
    navTo('filter', false);

    document.getElementById('search-heading').innerHTML = `Phim & chương trình: <span>${escapeHtml(genreName)}</span>`;
    const grid = document.getElementById('search-grid');
    grid.innerHTML = '<div class="loading-spinner-wrap active" style="grid-column: 1 / -1;"><div class="spinner"></div></div>';

    try {
        const params = { with_genres: genreId };
        if (genreName === 'Anime') params.with_original_language = 'ja';

        const [m, t] = await Promise.all([
            tmdb('/discover/movie', params),
            tmdb('/discover/tv', params)
        ]);
        const items = [
            ...(m.results || []).map(r => norm(r, 'movie')),
            ...(t.results || []).map(r => norm(r, 'tv'))
        ].filter(i => i && i.poster).sort((a, b) => (b.rating || 0) - (a.rating || 0));

        if (!items.length) {
            grid.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;"><svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="1"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg><h3>Không tìm thấy nội dung phù hợp</h3><p>Hãy thử chọn thể loại khác.</p><button class="btn-hero btn-white" style="margin-top: 20px;" onclick="navTo(\'home\')">Về Trang chủ</button></div>';
            return;
        }
        grid.innerHTML = '';
        items.forEach(i => grid.appendChild(makeCard(i)));
    } catch (e) {
        grid.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;"><svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#ff4444" stroke-width="1"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg><h3 style="color:#ff4444">Đã xảy ra lỗi</h3><p>Vui lòng thử lại sau.</p><button class="btn-hero btn-white" style="margin-top: 20px;" onclick="navTo(\'home\')">Về Trang chủ</button></div>';
    }
}

async function doSearch(q) {
    const sp = document.getElementById('search-page');
    const mr = document.getElementById('main-rows');
    const he = document.getElementById('hero');
    const ml = document.getElementById('mylist-page');

    if (!q.trim()) {
        sp.classList.remove('active'); ml.classList.remove('active');
        mr.style.display = ''; he.style.display = '';
        lastSearchQuery = '';
        return;
    }
    lastSearchQuery = q;
    searchPage = 1;
    filterCurrent = null;
    document.getElementById('infinite-scroll-sentinel').style.display = 'block';
    he.style.display = 'none'; mr.style.display = 'none'; ml.classList.remove('active');
    sp.classList.add('active');

    document.getElementById('search-heading').innerHTML = `Kết quả tìm kiếm cho "<span>${escapeHtml(q)}</span>"`;
    const grid = document.getElementById('search-grid');
    grid.innerHTML = '<div class="loading-spinner-wrap active" style="grid-column: 1 / -1;"><div class="spinner"></div></div>';

    try {
        const data = await tmdb('/search/multi', { query: q });
        const items = (data.results || []).map(r => norm(r)).filter(i => i && i.poster);
        if (!items.length) {
            grid.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;"><svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="1"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg><h3>Không tìm thấy kết quả</h3><p>Hãy thử điều chỉnh từ khóa tìm kiếm.</p><button class="btn-hero btn-white" style="margin-top: 20px;" onclick="document.getElementById(\'search-clear\').click()">Xóa tìm kiếm</button></div>';
            return;
        }
        grid.innerHTML = '';
        items.forEach(i => grid.appendChild(makeCard(i)));
    } catch (e) {
        grid.innerHTML = '<div class="empty-state" style="grid-column: 1 / -1;"><svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#ff4444" stroke-width="1"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg><h3 style="color:#ff4444">Đã xảy ra lỗi</h3><p>Vui lòng thử lại sau.</p><button class="btn-hero btn-white" style="margin-top: 20px;" onclick="document.getElementById(\'search-clear\').click()">Xóa tìm kiếm</button></div>';
    }
}


async function fetchSuggestions(q) {
    const box = document.getElementById('search-suggestions');
    if (!q || q.length < 2) { box.classList.remove('active'); box.innerHTML = ''; return; }
    try {
        const data = await tmdb('/search/multi', { query: q });
        const items = (data.results || []).map(r => norm(r)).filter(i => i && i.poster).slice(0, 6);
        if (!items.length) { box.classList.remove('active'); box.innerHTML = ''; return; }
        box.innerHTML = items.map(i => `
            <div class="suggest-item" tabindex="0" role="button" aria-label="${escapeHtml(i.title)}" onkeydown="if(event.key==='Enter'||event.key===' ') { event.preventDefault(); this.click(); }" data-id="${escapeHtml(i.id)}" data-type="${escapeHtml(i.type)}">
                <img class="suggest-poster" src="${escapeHtml(i.poster)}" alt="${escapeHtml(i.title)}" loading="lazy" onerror="this.style.background='#333'">
                <div class="suggest-info">
                    <div class="suggest-title">${escapeHtml(i.title)}</div>
                    <div class="suggest-meta">
                        <span class="sug-type">${i.type === 'tv' ? 'Phim bộ' : 'Phim'}</span>
                        ${i.year ? ` · ${escapeHtml(i.year)}` : ''}
                        ${i.rating ? ` · ${Math.round(i.rating * 10)}%` : ''}
                    </div>
                </div>
            </div>
        `).join('') + `<div class="suggest-footer" id="suggest-see-all">Xem tất cả kết quả cho "${escapeHtml(q)}"</div>`;
        box.querySelectorAll('.suggest-item').forEach((el, idx) => {
            el.onclick = () => { box.classList.remove('active'); box.innerHTML = ''; openDetail(items[idx]); };
        });
        document.getElementById('suggest-see-all').onclick = () => { box.classList.remove('active'); box.innerHTML = ''; doSearch(q); };
        box.classList.add('active');
    } catch (_) { box.classList.remove('active'); }
}

function hideSuggestions() {
    const box = document.getElementById('search-suggestions');
    box.classList.remove('active');
    box.innerHTML = '';
}


function getMyList() { return JSON.parse(localStorage.getItem('vk_mylist') || '[]'); }
function isInMyList(id) { return getMyList().some(i => i.id === id); }
function toggleMyList(item) {
    let ls = getMyList();
    if (ls.some(i => i.id === item.id)) {
        ls = ls.filter(i => i.id !== item.id);
        showToast('Đã xóa khỏi danh sách');
    } else {
        ls.unshift({ id: item.id, title: item.title, type: item.type, poster: item.poster, backdrop: item.backdrop, desc: item.desc, rating: item.rating, year: item.year, genreIds: item.genreIds || [] });
        showToast('Đã thêm vào danh sách');
    }
    localStorage.setItem('vk_mylist', JSON.stringify(ls.slice(0, 100)));
}
function showMyList() {
    const ls = getMyList(), g = document.getElementById('mylist-grid'), em = document.getElementById('mylist-empty');
    g.innerHTML = '';
    if (!ls.length) { em.classList.remove('hidden'); return; }
    em.classList.add('hidden');
    ls.forEach(i => g.appendChild(makeCard(i)));
}


function saveHistory(item) {
    let h = JSON.parse(localStorage.getItem('vk_hist') || '[]');
    h = h.filter(x => x.id !== item.id);
    h.unshift({ id: item.id, title: item.title, type: item.type, poster: item.poster, backdrop: item.backdrop, desc: item.desc, rating: item.rating, year: item.year, genreIds: item.genreIds || [] });
    localStorage.setItem('vk_hist', JSON.stringify(h.slice(0, 30)));
}

function buildContinueRow() {
    const old = document.querySelector('[data-rowid="continue"]');
    if (old) old.remove();
    const h = JSON.parse(localStorage.getItem('vk_hist') || '[]');
    if (!h.length) return;
    const main = document.getElementById('main-rows');
    main.insertBefore(makeRow({ id: 'continue', title: 'Tiếp tục xem dành cho bạn', mediaType: 'all' }, h), main.firstChild);
}


function saveProgress(data) {
    const payload = {
        id: String(data.id), mediaType: data.mediaType,
        currentTime: data.currentTime || 0, duration: data.duration || 0,
        progress: data.progress || 0, season: data.season || null,
        episode: data.episode || null, updatedAt: Date.now()
    };
    const showKey = `vk_p_${data.mediaType}_${data.id}`;
    localStorage.setItem(showKey, JSON.stringify(payload));
    if (data.mediaType === 'tv' && data.season && data.episode) {
        const epKey = `vk_p_tv_${data.id}_s${data.season}_e${data.episode}`;
        localStorage.setItem(epKey, JSON.stringify(payload));
    }
}

function getProgress(id, type, season, episode) {
    const key = type === 'tv' && season && episode
        ? `vk_p_tv_${id}_s${season}_e${episode}`
        : `vk_p_${type}_${id}`;
    const r = localStorage.getItem(key);
    return r ? JSON.parse(r) : null;
}


function isMobileLayout() {
    return window.matchMedia('(max-width: 768px)').matches;
}

function updateSheetBackdrop() {
    const backdrop = document.getElementById('sheet-backdrop');
    if (!backdrop) return;
    const filterOpen = document.getElementById('filter-dropdown')?.classList.contains('open');
    const accountOpen = document.getElementById('account-dropdown')?.classList.contains('open');
    const searchOpen = document.getElementById('search-wrapper')?.classList.contains('open');
    backdrop.classList.toggle('active', isMobileLayout() && (filterOpen || accountOpen || searchOpen));
}

function positionFilterDropdown() {
    const drop = document.getElementById('filter-dropdown');
    const btn = document.getElementById('filter-btn');
    if (!drop || !btn) return;
    if (isMobileLayout()) {
        drop.style.left = '';
        drop.style.top = '';
        drop.style.transform = '';
        return;
    }
    if (!drop.classList.contains('open')) {
        drop.style.left = '';
        drop.style.top = '';
        drop.style.transform = '';
        return;
    }
    const rect = btn.getBoundingClientRect();
    drop.style.left = `${rect.left + rect.width / 2}px`;
    drop.style.top = `${rect.bottom + 12}px`;
    drop.style.transform = 'translateX(-50%) translateY(0)';
}

function setFilterDropdown(open) {
    const drop = document.getElementById('filter-dropdown');
    if (!drop) return;
    drop.classList.toggle('open', open);
    if (open) positionFilterDropdown();
    else positionFilterDropdown();
    updateSheetBackdrop();
}

function closeSearch() {
    const sw = document.getElementById('search-wrapper');
    const si = document.getElementById('search-input');
    if (!sw || !si) return;
    sw.classList.remove('open');
    si.value = '';
    doSearch('');
    hideSuggestions();
    updateSheetBackdrop();
}

function closeMobileSheets() {
    setFilterDropdown(false);
    const accDrop = document.getElementById('account-dropdown');
    const avatar = document.getElementById('nav-avatar');
    if (accDrop?.classList.contains('open')) {
        accDrop.classList.remove('open');
        avatar?.classList.remove('open');
        resetConfirmStates();
    }
    const sw = document.getElementById('search-wrapper');
    if (sw?.classList.contains('open')) closeSearch();
    else updateSheetBackdrop();
}

function navTo(page, updateUrl = true) {
    currentPage = page;
    if (updateUrl) {
        if (page === 'home') {
            history.pushState(null, '', window.location.pathname + window.location.search);
        } else {
            history.pushState(null, '', '#' + page);
        }
    }
    document.querySelectorAll('.nav-link').forEach(el => el.classList.toggle('active', el.dataset.page === page));
    document.querySelectorAll('.mobile-dropdown-item').forEach(el => el.classList.toggle('active', el.dataset.page === page));
    document.querySelectorAll('.bottom-nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === page));

    if (page === 'home') filterCurrent = null;

    document.getElementById('mobile-dropdown').classList.remove('open');
    setFilterDropdown(false);

    const he = document.getElementById('hero'), mr = document.getElementById('main-rows');
    const sp = document.getElementById('search-page'), ml = document.getElementById('mylist-page');
    const si = document.getElementById('search-input');

    if (page !== 'filter') {
        si.value = '';
        sp.classList.remove('active');
    }

    if (page === 'mylist') {
        he.style.display = 'none'; mr.style.display = 'none';
        ml.classList.add('active'); showMyList();
        closeSearch();
        return;
    }

    if (page === 'filter') {
        he.style.display = 'none';
        mr.style.display = 'none';
        ml.classList.remove('active');
        if (filterCurrent) sp.classList.add('active');
        else {
            sp.classList.remove('active');
            he.style.display = '';
            mr.style.display = '';
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }

    ml.classList.remove('active');
    he.style.display = '';
    mr.style.display = '';
    document.querySelectorAll('.content-row').forEach(r => {
        const t = r.dataset.type;
        r.classList.toggle('hidden', page !== 'home' && t !== 'all' && t !== (page === 'movies' ? 'movie' : 'tv'));
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
}


function makeInteractive(el) {
    if (!el) return;
    el.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            el.click();
        }
    });
}

function wireListeners() {
    createAudioEngine();
    updateAudioLabel();
    function setVh() {
        const vh = (window.visualViewport ? window.visualViewport.height : window.innerHeight) * 0.01;
        document.documentElement.style.setProperty('--vh', vh + 'px');
    }
    setVh();
    window.addEventListener('resize', setVh, { passive: true });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', setVh, { passive: true });
    window.addEventListener('orientationchange', () => setTimeout(setVh, 150));
    window.addEventListener('resize', () => positionFilterDropdown(), { passive: true });

    const sheetBackdrop = document.getElementById('sheet-backdrop');
    if (sheetBackdrop) sheetBackdrop.onclick = closeMobileSheets;

    let scrollTicking = false;
    window.addEventListener('scroll', () => {
        if (!scrollTicking) {
            requestAnimationFrame(() => {
                document.getElementById('navbar').classList.toggle('solid', window.scrollY > 10);
                scrollTicking = false;
            });
            scrollTicking = true;
        }
    }, { passive: true });

    document.querySelectorAll('.nav-link').forEach(el => {
        el.onclick = () => { playUiSound('move', -0.25); navTo(el.dataset.page); };
        makeInteractive(el);
    });
    document.querySelectorAll('.mobile-dropdown-item').forEach(el => {
        el.onclick = () => { playUiSound('move', 0.1); navTo(el.dataset.page); };
        makeInteractive(el);
    });
    document.querySelectorAll('.bottom-nav-item').forEach(el => {
        if (el.id === 'mobile-filter-trigger') return;
        el.onclick = () => { playUiSound('move', 0.2); navTo(el.dataset.page); };
        makeInteractive(el);
    });
    const logoBtn = document.getElementById('logo-btn');
    if (logoBtn) {
        logoBtn.onclick = () => navTo('home');
        makeInteractive(logoBtn);
    }

    window.addEventListener('popstate', (e) => {
        const hash = window.location.hash.slice(1) || 'home';

        if (hash.startsWith('movie/') || hash.startsWith('tv/')) {
            const [type, id] = hash.split('/');
            loadDetailFromUrl(type, id);
        } else {
            if (document.getElementById('detail-overlay').classList.contains('active')) {
                closeDetail(false);
            }
            if (['home', 'movies', 'tv', 'mylist'].includes(hash) && currentPage !== hash) {
                navTo(hash, false);
            }
        }
    });

    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    if (mobileMenuBtn) {
        mobileMenuBtn.onclick = () => document.getElementById('mobile-dropdown').classList.toggle('open');
        makeInteractive(mobileMenuBtn);
    }

    const filterBtn = document.getElementById('filter-btn');
    const filterDrop = document.getElementById('filter-dropdown');
    if (filterBtn) {
        filterBtn.onclick = (e) => {
            e.stopPropagation();
            setFilterDropdown(!filterDrop.classList.contains('open'));
        };
    }

    const mobileFilterTrigger = document.getElementById('mobile-filter-trigger');
    if (mobileFilterTrigger) {
        mobileFilterTrigger.onclick = (e) => {
            e.stopPropagation();
            playUiSound('move', 0.2);
            setFilterDropdown(!filterDrop.classList.contains('open'));
        };
        makeInteractive(mobileFilterTrigger);
    }

    const sw = document.getElementById('search-wrapper'), si = document.getElementById('search-input');
    document.getElementById('search-btn').onclick = () => {
        if (sw.classList.contains('open')) closeSearch();
        else {
            sw.classList.add('open');
            si.focus();
            updateSheetBackdrop();
        }
    };
    document.getElementById('search-clear').onclick = (e) => {
        e.stopPropagation();
        if (si.value.trim()) {
            si.value = '';
            doSearch('');
            hideSuggestions();
            si.focus();
        } else {
            closeSearch();
        }
    };
    si.oninput = () => {
        clearTimeout(searchDebounce);
        clearTimeout(suggestDebounce);
        const val = si.value;
        suggestDebounce = setTimeout(() => fetchSuggestions(val), 250);
        searchDebounce = setTimeout(() => { hideSuggestions(); doSearch(val); }, 3000);
    };
    si.onkeydown = e => {
        if (e.key === 'Escape') closeSearch();
        if (e.key === 'Enter') { e.preventDefault(); clearTimeout(searchDebounce); clearTimeout(suggestDebounce); hideSuggestions(); doSearch(si.value); }
    };

    document.getElementById('detail-close-btn').onclick = closeDetail;
    document.getElementById('detail-overlay').onclick = e => { if (e.target === e.currentTarget) closeDetail(); };

    document.getElementById('player-back-btn').onclick = () => { playUiSound('close', -0.4); closePlayer(); };

    document.onkeydown = e => {
        if (e.key !== 'Escape') return;
        if (document.getElementById('player-overlay').classList.contains('active')) closePlayer();
        else if (document.getElementById('detail-overlay').classList.contains('active')) closeDetail();
    };

    window.addEventListener('message', ev => {
        if (ignoreProgress) return;

        try {
            const msg = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
            if (msg?.type === 'PLAYER_EVENT' && msg.data) saveProgress(msg.data);
        } catch (_) { }
    });

    const avatar = document.getElementById('nav-avatar');
    const accDrop = document.getElementById('account-dropdown');
    if (avatar) {
        avatar.onclick = e => {
            e.stopPropagation();
            const opening = !accDrop.classList.contains('open');
            accDrop.classList.toggle('open', opening);
            avatar.classList.toggle('open', opening);
            if (opening) setFilterDropdown(false);
            updateSheetBackdrop();
        };
        makeInteractive(avatar);
    }

    wireSettingsActions();

    document.addEventListener('click', e => {
        if (filterDrop.classList.contains('open') && !filterDrop.contains(e.target) && !filterBtn.contains(e.target) && (!mobileFilterTrigger || !mobileFilterTrigger.contains(e.target))) {
            setFilterDropdown(false);
        }

        const dd = document.getElementById('mobile-dropdown');
        const btn = document.getElementById('mobile-menu-btn');
        if (dd.classList.contains('open') && !dd.contains(e.target) && !btn.contains(e.target)) dd.classList.remove('open');

        const swEl = document.getElementById('search-wrapper');
        if (swEl?.classList.contains('open') && isMobileLayout() && !swEl.contains(e.target) && !sheetBackdrop?.contains(e.target)) {
            closeSearch();
        }

        if (accDrop.classList.contains('open') && !avatar.contains(e.target) && !accDrop.contains(e.target)) {
            accDrop.classList.remove('open');
            avatar.classList.remove('open');
            resetConfirmStates();
            updateSheetBackdrop();
        }
    });
}

function showToast(msg) {
    const t = document.getElementById('account-toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
}

function resetConfirmStates() {
    document.querySelectorAll('.account-item.confirm').forEach(el => {
        el.classList.remove('confirm');
        el.querySelector('span').textContent = el.dataset.label;
    });
}

function settingsConfirm(btn, action) {
    if (btn.classList.contains('confirm')) {
        btn.classList.remove('confirm');
        btn.classList.add('done');
        action();
        btn.querySelector('span').textContent = 'Xong!';
        setTimeout(() => {
            btn.classList.remove('done');
            btn.querySelector('span').textContent = btn.dataset.label;
        }, 1500);
        return;
    }
    resetConfirmStates();
    btn.dataset.label = btn.dataset.label || btn.querySelector('span').textContent;
    btn.classList.add('confirm');
    btn.querySelector('span').textContent = 'Nhấn lại để xác nhận';
}

function wireSettingsActions() {
    document.getElementById('settings-clear-history').onclick = e => {
        e.stopPropagation();
        settingsConfirm(e.currentTarget, () => {
            localStorage.removeItem('vk_hist');
            const old = document.querySelector('[data-rowid="continue"]');
            if (old) old.remove();
            showToast('Đã xóa lịch sử xem');
        });
    };

    document.getElementById('settings-clear-progress').onclick = e => {
        e.stopPropagation();
        settingsConfirm(e.currentTarget, () => {
            Object.keys(localStorage).filter(k => k.startsWith('vk_p_')).forEach(k => localStorage.removeItem(k));
            showToast('Đã đặt lại toàn bộ tiến độ');
        });
    };

    document.getElementById('settings-clear-list').onclick = e => {
        e.stopPropagation();
        settingsConfirm(e.currentTarget, () => {
            localStorage.removeItem('vk_mylist');
            showToast('Đã xóa danh sách');
        });
    };

    document.getElementById('settings-clear-cache').onclick = e => {
        e.stopPropagation();
        settingsConfirm(e.currentTarget, () => {
            try { sessionStorage.clear(); } catch (_) { }
            showToast('Đã xóa bộ nhớ đệm');
        });
    };

    document.getElementById('settings-about').onclick = e => {
        e.stopPropagation();
        const dd = document.getElementById('account-dropdown');
        dd.classList.remove('open');
        document.getElementById('nav-avatar').classList.remove('open');
        showToast('Vert v1.1.0 - Made by namdev and based on hnrie/Vert');
    };

    document.getElementById('settings-sync').onclick = e => {
        e.stopPropagation();
        document.getElementById('account-dropdown').classList.remove('open');
        document.getElementById('nav-avatar').classList.remove('open');
        openSyncModal();
    };

    const playerText = document.getElementById('player-source-text');
    if (playerText) playerText.textContent = `Trình phát: ${getPlayerName(playerSource)}`;

    const playerToggleBtn = document.getElementById('settings-toggle-player');
    if (playerToggleBtn) {
        playerToggleBtn.onclick = e => {
            e.stopPropagation();
            const players = ['videasy', 'vidking', 'vyla'];
            const idx = players.indexOf(playerSource);
            playerSource = players[(idx + 1) % players.length];
            localStorage.setItem('vk_player', playerSource);
            playerText.textContent = `Trình phát: ${getPlayerName(playerSource)}`;
            showToast(`Đã chuyển trình phát sang ${getPlayerName(playerSource)}`);
        };
    }

    const audioPanelBtn = document.getElementById('settings-audio-panel');
    if (audioPanelBtn) {
        audioPanelBtn.onclick = e => {
            e.stopPropagation();
            const panel = document.getElementById('audio-panel');
            const playerOverlay = document.getElementById('player-overlay');
            playerOverlay.classList.add('active', 'show-audio-panel');
            panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        };
    }

    const enabledEl = document.getElementById('audio-enabled');
    const spatialEl = document.getElementById('audio-spatial');
    const volEl = document.getElementById('audio-volume');
    const widthEl = document.getElementById('audio-width');
    const depthEl = document.getElementById('audio-depth');
    enabledEl.checked = !!audioSettings.enabled;
    spatialEl.checked = !!audioSettings.spatial;
    volEl.value = Math.round(audioSettings.volume * 100);
    widthEl.value = Math.round(audioSettings.width * 100);
    depthEl.value = Math.round(audioSettings.depth * 100);

    const syncAudioState = () => {
        audioSettings.enabled = enabledEl.checked;
        audioSettings.spatial = spatialEl.checked;
        audioSettings.volume = Number(volEl.value) / 100;
        audioSettings.width = Number(widthEl.value) / 100;
        audioSettings.depth = Number(depthEl.value) / 100;
        saveAudioSettings();
        updateAudioLabel();
        applyAudioScene();
        playUiSound('move', (audioSettings.width * 2) - 1);
    };

    [enabledEl, spatialEl].forEach(el => el.addEventListener('change', syncAudioState));
    [volEl, widthEl, depthEl].forEach(el => el.addEventListener('input', syncAudioState));

    window.addEventListener('pointermove', (e) => {
        if (!audioSettings.enabled || !audioSettings.spatial || !audioEngine || !audioEngine.hum.playing()) return;
        const xNorm = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
        const pan = xNorm * audioSettings.width;
        try { audioEngine.hum.stereo(Math.max(-1, Math.min(1, pan))); } catch (_) { }
    }, { passive: true });
}

let syncTimerInterval = null;

function openSyncModal() {
    const ov = document.getElementById('sync-overlay');
    const pinDisplay = document.getElementById('sync-pin-display');
    pinDisplay.textContent = '------';
    pinDisplay.classList.remove('active', 'copied');
    pinDisplay.removeAttribute('title');
    pinDisplay.onclick = null;
    pinDisplay.onkeydown = null;
    document.getElementById('sync-pin-timer').textContent = '';
    document.getElementById('sync-import-code').value = '';
    document.getElementById('sync-export-status').textContent = '';
    document.getElementById('sync-export-status').className = 'sync-status';
    document.getElementById('sync-import-status').textContent = '';
    document.getElementById('sync-import-status').className = 'sync-status';
    document.getElementById('sync-generate').disabled = false;
    document.getElementById('sync-generate').textContent = 'Tạo mã PIN';
    if (syncTimerInterval) { clearInterval(syncTimerInterval); syncTimerInterval = null; }
    switchSyncTab('export');
    ov.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeSyncModal() {
    document.getElementById('sync-overlay').classList.remove('active');
    document.body.style.overflow = '';
    if (syncTimerInterval) { clearInterval(syncTimerInterval); syncTimerInterval = null; }
}

function switchSyncTab(tab) {
    document.querySelectorAll('.sync-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.getElementById('sync-export-panel').classList.toggle('hidden', tab !== 'export');
    document.getElementById('sync-import-panel').classList.toggle('hidden', tab !== 'import');
}

function getSyncData() {
    const data = {};
    const prefixes = ['vk_hist', 'vk_mylist', 'vk_p_'];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (prefixes.some(p => key.startsWith(p))) {
            try { data[key] = JSON.parse(localStorage.getItem(key)); } catch (_) { data[key] = localStorage.getItem(key); }
        }
    }
    return data;
}

async function generateSyncCode() {
    const status = document.getElementById('sync-export-status');
    const pinDisplay = document.getElementById('sync-pin-display');
    const timerEl = document.getElementById('sync-pin-timer');
    const btn = document.getElementById('sync-generate');

    if (IS_LOCAL) {
        status.textContent = 'Cloud sync requires deployment to Vercel';
        status.className = 'sync-status error';
        return;
    }

    const data = getSyncData();
    const keys = Object.keys(data);
    if (keys.length === 0) {
        status.textContent = 'No data to export';
        status.className = 'sync-status error';
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner btn-spinner"></div> Uploading...';
    status.textContent = '';
    status.className = 'sync-status';

    try {
        const payload = JSON.stringify({ v: 1, t: Date.now(), d: data });
        const r = await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: payload })
        });
        const result = await r.json();
        if (!r.ok) throw new Error(result.error || 'Upload failed');

        pinDisplay.textContent = result.pin;
        pinDisplay.classList.add('active');
        pinDisplay.title = 'Click to copy';
        pinDisplay.onclick = () => {
            navigator.clipboard.writeText(result.pin).then(() => {
                const orig = pinDisplay.textContent;
                pinDisplay.textContent = 'COPIED';
                pinDisplay.classList.add('copied');
                showToast('PIN copied to clipboard!');
                setTimeout(() => {
                    if (pinDisplay.classList.contains('active')) {
                        pinDisplay.textContent = result.pin;
                        pinDisplay.classList.remove('copied');
                    }
                }, 1500);
            }).catch(() => {
                showToast('Failed to copy PIN');
            });
        };
        pinDisplay.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                pinDisplay.click();
            }
        };
        status.textContent = `${keys.length} item${keys.length > 1 ? 's' : ''} ready to sync`;
        status.className = 'sync-status success';
        btn.textContent = 'Generate New PIN';
        btn.disabled = false;

        if (syncTimerInterval) clearInterval(syncTimerInterval);
        let remaining = 600;
        timerEl.textContent = 'Expires in 10:00';
        syncTimerInterval = setInterval(() => {
            remaining--;
            if (remaining <= 0) {
                clearInterval(syncTimerInterval);
                syncTimerInterval = null;
                timerEl.textContent = 'PIN expired';
                pinDisplay.textContent = '------';
                pinDisplay.classList.remove('active', 'copied');
                pinDisplay.removeAttribute('title');
                pinDisplay.onclick = null;
                pinDisplay.onkeydown = null;
                status.textContent = 'PIN expired — generate a new one';
                status.className = 'sync-status error';
                return;
            }
            const m = Math.floor(remaining / 60);
            const s = String(remaining % 60).padStart(2, '0');
            timerEl.textContent = `Expires in ${m}:${s}`;
        }, 1000);
    } catch (e) {
        status.textContent = e.message || 'Failed to upload sync data';
        status.className = 'sync-status error';
        btn.textContent = 'Tạo mã PIN';
        btn.disabled = false;
    }
}

async function importSyncCode() {
    const code = document.getElementById('sync-import-code').value.trim();
    const status = document.getElementById('sync-import-status');
    const btn = document.getElementById('sync-import-btn');

    if (IS_LOCAL) {
        status.textContent = 'Cloud sync requires deployment to Vercel';
        status.className = 'sync-status error';
        return;
    }

    if (!code || !/^\d{6}$/.test(code)) {
        status.textContent = 'Enter a 6-digit PIN';
        status.className = 'sync-status error';
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner btn-spinner"></div> Syncing...';
    status.textContent = '';

    try {
        const r = await fetch(`/api/sync?code=${code}`);
        const result = await r.json();
        if (!r.ok) throw new Error(result.error || 'Sync failed');

        const parsed = JSON.parse(result.data);
        if (!parsed.d || typeof parsed.d !== 'object') throw new Error('Invalid data');

        let count = 0;
        Object.entries(parsed.d).forEach(([key, val]) => {
            if (key.startsWith('vk_')) {
                localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val));
                count++;
            }
        });

        status.textContent = `Synced ${count} item${count > 1 ? 's' : ''} successfully!`;
        status.className = 'sync-status success';
        showToast('Data synced successfully!');
        setTimeout(() => { closeSyncModal(); buildContinueRow(); }, 1500);
    } catch (e) {
        const msg = e.message === 'Code not found or expired'
            ? 'PIN not found or expired — try again'
            : (e.message || 'Sync failed');
        status.textContent = msg;
        status.className = 'sync-status error';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Sync';
    }
}

(function wireSyncModal() {
    document.getElementById('sync-close').onclick = closeSyncModal;
    document.getElementById('sync-overlay').onclick = e => { if (e.target === e.currentTarget) closeSyncModal(); };
    document.querySelectorAll('.sync-tab').forEach(t => t.onclick = () => switchSyncTab(t.dataset.tab));
    document.getElementById('sync-generate').onclick = generateSyncCode;
    document.getElementById('sync-import-btn').onclick = importSyncCode;
    const codeInput = document.getElementById('sync-import-code');
    codeInput.oninput = () => { codeInput.value = codeInput.value.replace(/\D/g, '').slice(0, 6); };
})();

function hideLoader() { setTimeout(() => document.getElementById('loader-screen').classList.add('hidden'), 800); }


// --- Desktop Window Controls ---
if (window.__TAURI__) {
    document.body.classList.add('is-electron'); // Keep class name so CSS still works
    const { appWindow } = window.__TAURI__.window;
    
    document.getElementById('min-btn')?.addEventListener('click', () => {
        appWindow.minimize();
    });
    document.getElementById('max-btn')?.addEventListener('click', () => {
        appWindow.toggleMaximize();
    });
    document.getElementById('close-btn')?.addEventListener('click', () => {
        appWindow.close();
    });
}
