export const runtime = 'nodejs';

import { errormessage, isrecord } from '../../../lib/utils';

let cachedtoken: string | null = null;
let tokenexpiresat = 0;

const allowedcdns = [
  'ironbubble.site',
  'fsharetv.co',
  'vidrock.baby',
  'mbx.notorrent2.workers.dev',
  'source.heistotron.uk',
  'mapple.club',
  'vdrk.site',
];
const maxhops = 5;

function jsonerror(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function allowedhost(h: string) {
  return (
    h === 'api.vyla.cc' ||
    allowedcdns.some((c) => h === c || h.endsWith('.' + c))
  );
}

async function gettoken(): Promise<string> {
  if (cachedtoken && Date.now() < tokenexpiresat) return cachedtoken;
  const r = await fetch('https://player.vyla.cc/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!r.ok) throw new Error('Auth failed: ' + r.status);
  const data: unknown = await r.json();
  const tok =
    isrecord(data) && typeof data.token === 'string' ? data.token : '';
  if (!tok) throw new Error('Auth returned no token');
  cachedtoken = tok;
  tokenexpiresat = Date.now() + 25 * 60 * 1000;
  return tok;
}

async function fetchallowed(start: URL, range: string | null) {
  let current = start;

  for (let hop = 0; hop < maxhops; hop++) {
    if (!allowedhost(current.hostname))
      throw new Error('redirect host not allowed');

    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: '*/*',
    };
    if (range) headers['Range'] = range;
    if (current.hostname === 'api.vyla.cc') {
      try {
        headers['X-Session-Token'] = await gettoken();
      } catch {}
    }

    let res = await fetch(current.toString(), { headers, redirect: 'manual' });

    if (res.status === 401 && current.hostname === 'api.vyla.cc') {
      cachedtoken = null;
      headers['X-Session-Token'] = await gettoken();
      res = await fetch(current.toString(), { headers, redirect: 'manual' });
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) return { res, finalurl: current };
      try {
        await res.body?.cancel();
      } catch {}
      current = new URL(loc, current);
      continue;
    }

    return { res, finalurl: current };
  }

  throw new Error('too many redirects');
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const targeturl = url.searchParams.get('url');
  if (!targeturl) return jsonerror('Missing url', 400);

  let parsed: URL;
  try {
    parsed = new URL(targeturl);
  } catch {
    return jsonerror('Invalid url', 400);
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return jsonerror('Protocol not allowed', 400);
  }
  if (!allowedhost(parsed.hostname)) {
    return jsonerror('Host not allowed', 403);
  }

  try {
    const { res, finalurl } = await fetchallowed(
      parsed,
      req.headers.get('range'),
    );
    if (!res.ok) return jsonerror('Upstream ' + res.status, res.status);
    return handleresponse(res, finalurl);
  } catch (error) {
    return jsonerror('Failed: ' + errormessage(error, 'unknown'), 502);
  }
}

async function handleresponse(r: Response, fetchurl: URL) {
  const contenttype = (r.headers.get('content-type') || '').toLowerCase();
  const ismanifesttype =
    contenttype.includes('mpegurl') ||
    fetchurl.pathname.toLowerCase().endsWith('.m3u8');
  const ismediatype =
    contenttype.startsWith('video/') || contenttype.startsWith('audio/');

  if (ismediatype && !ismanifesttype) {
    return streamresponse(r);
  }

  const reader = r.body?.getReader();
  if (!reader) return streamresponse(r, null);

  const first = await reader.read();
  if (first.done) return streamresponse(r, null);

  const head = first.value.subarray(0, 512);
  const ismanifest = new TextDecoder('utf-8', { fatal: false })
    .decode(head)
    .trimStart()
    .startsWith('#EXTM3U');

  if (!ismanifest && !ismanifesttype) {
    return streamresponse(r, rejoinbody(reader, first.value));
  }

  const buf = await collectbody(reader, first.value);
  const text = new TextDecoder().decode(buf);
  const proxybase = '/api/vyla-proxy?url=';

  function rewriteurl(rawurl: string): string {
    try {
      return (
        proxybase + encodeURIComponent(new URL(rawurl, fetchurl).toString())
      );
    } catch {
      return rawurl;
    }
  }

  const rewritten = text
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith('#EXT')) {
        return line.replace(
          /URI="([^"]+)"/g,
          (_, uri) => 'URI="' + rewriteurl(uri) + '"',
        );
      }
      if (trimmed.startsWith('#')) return line;
      return rewriteurl(trimmed);
    })
    .join('\n');

  return new Response(rewritten, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
      'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function streamresponse(r: Response, body: BodyInit | null = r.body) {
  const headers: Record<string, string> = {
    'Content-Type': r.headers.get('content-type') || 'video/mp2t',
    'Access-Control-Allow-Origin': '*',
    'Accept-Ranges': r.headers.get('accept-ranges') || 'bytes',
    'Cache-Control': 's-maxage=300, stale-while-revalidate=600',
  };
  const contentrange = r.headers.get('content-range');
  if (contentrange) headers['Content-Range'] = contentrange;

  return new Response(body, { status: r.status === 206 ? 206 : 200, headers });
}

function rejoinbody(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  firstchunk: Uint8Array,
) {
  let first: Uint8Array | null = firstchunk;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      if (first) controller.enqueue(first);
      first = null;
    },
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch (error) {
        controller.error(error);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

async function collectbody(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  firstchunk: Uint8Array,
) {
  const chunks: Uint8Array[] = [firstchunk];
  let size = firstchunk.byteLength;
  const maxsize = 10 * 1024 * 1024;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxsize) {
      await reader.cancel();
      throw new Error('Manifest too large');
    }
    chunks.push(value);
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}
