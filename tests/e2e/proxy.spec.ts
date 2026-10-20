import { test, expect } from '@playwright/test';
import { GET } from '../../app/api/vyla-proxy/route';

test('proxy streams upstream media without buffering the full response', async () => {
  const chunks = ['video-part-one-', 'video-part-two-', 'video-part-three'];
  let pulls = 0;
  const body = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        pulls += 1;
        const chunk = chunks.shift();
        if (chunk) {
          controller.enqueue(new TextEncoder().encode(chunk));
          return;
        }
        controller.close();
      },
    },
    { highWaterMark: 0 },
  );
  const originalfetch = globalThis.fetch;

  globalThis.fetch = async () =>
    new Response(body, {
      status: 206,
      headers: {
        'Content-Type': 'video/mp2t',
        'Content-Range': 'bytes 0-2/3',
      },
    });

  try {
    const response = await GET(
      new Request(
        'http://localhost/api/vyla-proxy?url=https%3A%2F%2Ffsharetv.co%2Fmedia.ts',
      ),
    );

    expect(pulls).toBe(0);
    expect(response.status).toBe(206);
    expect(response.headers.get('Content-Range')).toBe('bytes 0-2/3');
    await expect(response.text()).resolves.toBe(
      'video-part-one-video-part-two-video-part-three',
    );
  } finally {
    globalThis.fetch = originalfetch;
  }
});

test('proxy rewrites playlists even when upstream uses a generic content type', async () => {
  const originalfetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      ['#EXTM3U', '#EXT-X-KEY:METHOD=AES-128,URI="key.bin"', 'segment.ts'].join(
        '\n',
      ),
      {
        headers: { 'Content-Type': 'application/octet-stream' },
      },
    );

  try {
    const response = await GET(
      new Request(
        'http://localhost/api/vyla-proxy?url=https%3A%2F%2Ffsharetv.co%2Fstream',
      ),
    );
    const body = await response.text();

    expect(body).toContain(
      'URI="/api/vyla-proxy?url=https%3A%2F%2Ffsharetv.co%2Fkey.bin"',
    );
    expect(body).toContain(
      '/api/vyla-proxy?url=https%3A%2F%2Ffsharetv.co%2Fsegment.ts',
    );
  } finally {
    globalThis.fetch = originalfetch;
  }
});
