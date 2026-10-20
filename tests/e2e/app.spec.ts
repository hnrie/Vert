import { test, expect, Page } from '@playwright/test';

const movie = {
  id: 550,
  media_type: 'movie',
  title: 'Vert Movie',
  overview: 'Một bộ phim dùng cho kiểm thử giao diện.',
  poster_path: null,
  backdrop_path: null,
  vote_average: 8.7,
  release_date: '2024-05-01',
  genre_ids: [28]
};

const show = {
  id: 1399,
  media_type: 'tv',
  name: 'Vert Series',
  overview: 'Một loạt phim dùng cho kiểm thử giao diện.',
  poster_path: null,
  backdrop_path: null,
  vote_average: 9.1,
  first_air_date: '2023-01-01',
  genre_ids: [18]
};

async function mocktmdb(page: Page) {
  await page.route('**/api/tmdb?**', async route => {
    const ep = new URL(route.request().url()).searchParams.get('ep') || '';
    let body: unknown = { results: [] };

    if (ep.startsWith('/search/multi')) {
      const query = new URL(route.request().url()).searchParams.get('query') || '';
      body = { results: query === 'none' ? [] : [movie, show] };
    } else if (ep.startsWith('/trending/')) {
      body = { results: [movie, show] };
    } else if (ep.startsWith('/movie/popular') || ep.startsWith('/movie/top_rated')) {
      body = { results: [movie] };
    } else if (ep.startsWith('/tv/popular') || ep.startsWith('/tv/top_rated')) {
      body = { results: [show] };
    } else if (ep.startsWith('/discover/movie')) {
      body = { results: [movie] };
    } else if (ep.startsWith('/discover/tv')) {
      body = { results: [show] };
    } else if (ep.endsWith('/credits')) {
      body = { cast: [{ id: 1, name: 'Diễn viên Kiểm Thử', character: 'Nhân vật' }] };
    } else if (ep.endsWith('/similar')) {
      body = { results: [ep.startsWith('/tv/') ? show : movie] };
    } else if (/^\/tv\/\d+$/.test(ep)) {
      body = { number_of_seasons: 2 };
    } else if (/^\/tv\/\d+\/season\/\d+$/.test(ep)) {
      const season = Number(ep.split('/').at(-1));
      body = {
        episodes: [
          { episode_number: 1, name: `Tập 1 mùa ${season}`, overview: 'Mở đầu', still_path: null },
          { episode_number: 2, name: `Tập 2 mùa ${season}`, overview: 'Tiếp theo', still_path: null }
        ]
      };
    }

    await route.fulfill({ json: body });
  });
}

test.beforeEach(async ({ page }) => {
  await mocktmdb(page);
  await page.goto('/');
  await expect(page.locator('#loader-screen')).toHaveClass(/hidden/);
});

test('desktop navigation reaches movie and series browsing', async ({ page }) => {
  await expect(page.getByText('Xu Hướng Phim Hôm Nay')).toBeVisible();

  await page.getByText('Phim lẻ', { exact: true }).first().click();
  await expect(page.getByText('Phim Chiếu Rạp Phổ Biến')).toBeVisible();

  await page.getByText('Phim bộ', { exact: true }).first().click();
  await expect(page.getByText('Loạt Phim Truyền Hình Phổ Biến')).toBeVisible();
});

test('search, detail, list persistence and player overlay work together', async ({ page }) => {
  await page.locator('#search-btn').click();
  await page.locator('#search-input').fill('vert');
  await expect(page.locator('.suggest-item').first()).toBeVisible();
  await page.locator('#search-input').press('Enter');

  await expect(page.getByText('Kết quả tìm kiếm cho "vert"')).toBeVisible();
  await page.locator('#search-grid .card').first().click();

  await expect(page.locator('#detail-title')).toHaveText('Vert Movie');
  await expect(page.locator('#detail-cast-line')).toContainText('Diễn viên Kiểm Thử');
  await page.locator('#detail-list-btn').click();
  await page.locator('#detail-close-btn').click();

  await page.getByText('Danh sách của tôi', { exact: true }).first().click();
  await expect(page.locator('#mylist-grid')).toContainText('Vert Movie');

  await page.reload();
  await page.getByText('Danh sách của tôi', { exact: true }).first().click();
  await expect(page.locator('#mylist-grid')).toContainText('Vert Movie');

  await page.getByText('Trang chủ', { exact: true }).first().click();
  await page.locator('#search-btn').click();
  await page.locator('#search-input').fill('vert');
  await page.locator('#search-input').press('Enter');
  await page.locator('#search-grid .card').first().locator('.play-c').click();

  await expect(page.locator('#player-overlay')).toBeVisible();
  await expect(page.locator('#player-frame iframe')).toHaveAttribute('src', 'https://player.videasy.net/movie/550');
  await page.evaluate(() => {
    window.dispatchEvent(new MessageEvent('message', {
      data: {
        type: 'PLAYER_EVENT',
        data: {
          id: 550,
          mediaType: 'movie',
          currentTime: 10,
          duration: 100,
          progress: 10
        }
      },
      origin: 'https://attacker.example'
    }));
  });
  await expect.poll(() => page.evaluate(() => localStorage.getItem('vk_p_movie_550'))).toBeNull();
  await page.locator('#player-back-btn').click();
  await expect(page.locator('#player-overlay')).toHaveCount(0);
});

test('watchlist distinguishes movies and TV with the same ID', async ({ page }) => {
  const twinshow = { ...show, id: movie.id, name: 'Vert Twin Series' };

  await page.route('**/api/tmdb?**', async route => {
    const ep = new URL(route.request().url()).searchParams.get('ep') || '';
    if (ep.startsWith('/search/multi')) {
      await route.fulfill({ json: { results: [movie, twinshow] } });
      return;
    }
    await route.fallback();
  });

  await page.locator('#search-btn').click();
  await page.locator('#search-input').fill('collision');
  await page.locator('#search-input').press('Enter');

  const moviecard = page.locator('#search-grid .card').filter({ hasText: 'Vert Movie' });
  const tvcard = page.locator('#search-grid .card').filter({ hasText: 'Vert Twin Series' });
  await expect(moviecard).toHaveCount(1);
  await expect(tvcard).toHaveCount(1);

  await moviecard.getByTitle('Thêm vào danh sách').click();
  await expect(tvcard.getByTitle('Thêm vào danh sách')).toHaveCount(1);
  await tvcard.getByTitle('Thêm vào danh sách').click();

  await page.getByText('Danh sách của tôi', { exact: true }).first().click();
  await expect(page.locator('#mylist-grid')).toContainText('Vert Movie');
  await expect(page.locator('#mylist-grid')).toContainText('Vert Twin Series');
});

test('renders TMDB posters through the image pipeline', async ({ page }) => {
  const postermovie = { ...movie, id: 551, title: 'Vert Poster', poster_path: '/jSziioSwPVrOy9Yow3XhWIBDjq1.jpg' };

  await page.route('**/api/tmdb?**', async route => {
    const ep = new URL(route.request().url()).searchParams.get('ep') || '';
    if (ep.startsWith('/search/multi')) {
      await route.fulfill({ json: { results: [postermovie] } });
      return;
    }
    await route.fallback();
  });

  await page.locator('#search-btn').click();
  await page.locator('#search-input').fill('poster');
  await page.locator('#search-input').press('Enter');

  const image = page.locator('#search-grid .card img[alt="Vert Poster"]');
  await expect(image).toHaveCount(1);
  await expect(image).toHaveAttribute('src', /\/_next\/image\?url=https%3A%2F%2Fimage\.tmdb\.org%2Ft%2Fp%2Fw500%2FjSziioSwPVrOy9Yow3XhWIBDjq1\.jpg/);
});

test('TV detail loads seasons and episodes', async ({ page }) => {
  await page.locator('#search-btn').click();
  await page.locator('#search-input').fill('vert');
  await page.locator('#search-input').press('Enter');
  await page.getByText('Vert Series', { exact: true }).last().click();

  await expect(page.locator('#detail-title')).toHaveText('Vert Series');
  await expect(page.locator('#season-picker option')).toHaveCount(2);
  await expect(page.locator('#episodes-list')).toContainText('Tập 1 mùa 1');
});

test('mobile menu exposes movie and series pages', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#mobile-bottom-nav').getByText('Phim bộ', { exact: true }).click();
  await expect(page.getByText('Loạt Phim Truyền Hình Phổ Biến')).toBeVisible();
});
