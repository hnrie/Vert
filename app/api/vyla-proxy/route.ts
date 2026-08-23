export const runtime = 'edge';

let cachedtoken: string | null = null;
let tokenexpiresat = 0;

const allowedcdns = ['ironbubble.site', 'fsharetv.co', 'vidrock.baby', 'mbx.notorrent2.workers.dev', 'source.heistotron.uk', 'mapple.club', 'vdrk.site'];
const maxhops = 5;

function jsonerror(msg: string, status: number) {
    return new Response(JSON.stringify({ error: msg }), { status, headers: { 'Content-Type': 'application/json' } });
}

function allowedhost(h: string) {
    return h === 'api.vyla.cc' || allowedcdns.some(c => h === c || h.endsWith('.' + c));
}

async function gettoken(): Promise<string> {
    if (cachedtoken && Date.now() < tokenexpiresat) return cachedtoken;
    const r = await fetch('https://player.vyla.cc/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
    });
    if (!r.ok) throw new Error('Auth failed: ' + r.status);
    const data = await r.json();
    const tok = String(data.token || '');
    if (!tok) throw new Error('Auth returned no token');
    cachedtoken = tok;
    tokenexpiresat = Date.now() + 25 * 60 * 1000;
    return tok;
}

async function fetchallowed(start: URL, range: string | null) {
    let current = start;

    for (let hop = 0; hop < maxhops; hop++) {
        if (!allowedhost(current.hostname)) throw new Error('redirect host not allowed');

        const headers: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': '*/*'
        };
        if (range) headers['Range'] = range;
        if (current.hostname === 'api.vyla.cc') {
            try {
                headers['X-Session-Token'] = await gettoken();
            } catch (_) {}
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
            try { await res.body?.cancel(); } catch (_) {}
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
        const { res, finalurl } = await fetchallowed(parsed, req.headers.get('range'));
        if (!res.ok) return jsonerror('Upstream ' + res.status, res.status);
        return handleresponse(res, finalurl);
    } catch (err: any) {
        return jsonerror('Failed: ' + (err?.message || 'unknown'), 502);
    }
}

async function handleresponse(r: Response, fetchurl: URL) {
    const contenttype = (r.headers.get('content-type') || '').toLowerCase();
    const buf = await r.arrayBuffer();

    const head = new Uint8Array(buf, 0, Math.min(buf.byteLength, 512));
    const ismanifest = new TextDecoder('utf-8', { fatal: false }).decode(head).trimStart().startsWith('#EXTM3U');

    if (!ismanifest) {
        const headers: Record<string, string> = {
            'Content-Type': contenttype || 'video/mp2t',
            'Access-Control-Allow-Origin': '*',
            'Accept-Ranges': r.headers.get('accept-ranges') || 'bytes',
            'Cache-Control': 's-maxage=300, stale-while-revalidate=600'
        };
        const contentrange = r.headers.get('content-range');
        if (contentrange) headers['Content-Range'] = contentrange;

        return new Response(buf, { status: r.status === 206 ? 206 : 200, headers });
    }

    const text = new TextDecoder().decode(buf);
    const proxybase = '/api/vyla-proxy?url=';

    function rewriteurl(rawurl: string): string {
        try {
            return proxybase + encodeURIComponent(new URL(rawurl, fetchurl).toString());
        } catch (_) {
            return rawurl;
        }
    }

    const rewritten = text.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed) return line;
        if (trimmed.startsWith('#EXT')) {
            return line.replace(/URI="([^"]+)"/g, (_, uri) => 'URI="' + rewriteurl(uri) + '"');
        }
        if (trimmed.startsWith('#')) return line;
        return rewriteurl(trimmed);
    }).join('\n');

    return new Response(rewritten, {
        status: 200,
        headers: {
            'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
            'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
            'Access-Control-Allow-Origin': '*'
        }
    });
}
