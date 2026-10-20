import { test, expect, Page } from '@playwright/test';

const authRequests: { readonly [key: string]: unknown }[] = [];
const movie = {
  id: 550,
  media_type: 'movie',
  title: 'Bug Movie',
  overview: 'Mô tả',
  poster_path: null,
  backdrop_path: null,
  vote_average: 8,
  release_date: '',
  genre_ids: []
};

async function mocktmdb(page: Page) {
  await page.route('**/api/tmdb?**', async route => {
    const ep = new URL(route.request().url()).searchParams.get('ep') || '';
    let body: unknown = { results: [] };
    if (ep.startsWith('/search/multi')) body = { results: [movie] };
    await route.fulfill({ json: body });
  });
}

async function mockauth(page: Page) {
  await page.route('**/api/vyla-auth', route => {
    authRequests.push(route.request().postDataJSON());
    if (authRequests.length === 1) {
      return route.fulfill({ json: { token: 'omnitoken' } });
    }
    return route.fulfill({ json: { token: 'stale' } });
  });
}

test('vyla repro', async ({ page }) => {
  await mocktmdb(page);
  await mockauth(page);
  await page.goto('/');
  await expect(page.locator('#loader-screen')).toHaveClass(/hidden/);
  await page.evaluate(() => localStorage.setItem('vk_player', 'vyla'));
  await page.reload();
  await expect(page.locator('#loader-screen')).toHaveClass(/hidden/);
  await page.locator('#search-btn').click();
  await page.locator('#search-input').fill('bug');
  await page.locator('#search-input').press('Enter');
  await expect(page.locator('#search-grid .card')).toHaveCount(1);
  await page.locator('#search-grid .card').first().locator('.play-c').click();
  await expect(page.locator('#player-overlay')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('mousemove')));
  await page.waitForTimeout(3000);
  console.log(await page.locator('#player-overlay').innerHTML());
});
