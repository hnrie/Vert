import { test, expect } from '@playwright/test';

test('API routes enforce input contracts and one-time sync reads', async ({ request }) => {
  const missingtmdb = await request.get('/api/tmdb');
  expect(missingtmdb.status()).toBe(400);

  const blockedtmdb = await request.get('/api/tmdb?ep=../private');
  expect(blockedtmdb.status()).toBe(403);

  const missingproxy = await request.get('/api/vyla-proxy');
  expect(missingproxy.status()).toBe(400);

  const blockedproxy = await request.get('/api/vyla-proxy?url=https%3A%2F%2Fexample.com%2Fvideo');
  expect(blockedproxy.status()).toBe(403);

  const blockedsubtitle = await request.get('/api/vyla-sub?url=https%3A%2F%2Fexample.com%2Fcaptions.vtt');
  expect(blockedsubtitle.status()).toBe(403);

  const badpin = await request.get('/api/sync?code=nope');
  expect(badpin.status()).toBe(400);

  const create = await request.post('/api/sync', { data: { data: JSON.stringify({ mylist: [] }) } });
  expect(create.status()).toBe(200);
  const { pin } = await create.json() as { pin: string };
  expect(pin).toMatch(/^\d{6}$/);

  const read = await request.get(`/api/sync?code=${pin}`);
  expect(read.status()).toBe(200);
  await expect(read.json()).resolves.toEqual({ data: JSON.stringify({ mylist: [] }) });

  const consumed = await request.get(`/api/sync?code=${pin}`);
  expect(consumed.status()).toBe(404);

  const oversized = await request.post('/api/sync', { data: { data: 'x'.repeat(500001) } });
  expect(oversized.status()).toBe(413);
});
