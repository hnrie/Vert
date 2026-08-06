export const runtime = 'edge';

let cachedtoken: string | null = null;
let tokenexpiresat = 0;

async function gettoken(): Promise<string> {
    if (cachedtoken && Date.now() < tokenexpiresat) return cachedtoken;
    const r = await fetch('https://player.vyla.cc/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
    });
    if (!r.ok) throw new Error('Auth failed: ' + r.status);
    const data = await r.json();
    cachedtoken = String(data.token || '');
    tokenexpiresat = Date.now() + 25 * 60 * 1000;
    return cachedtoken;
}

export async function GET(req: Request) {
    const url = new URL(req.url);
    const targeturl = url.searchParams.get('url');
    if (!targeturl) {
        return new Response(JSON.stringify({ error: 'Missing url' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    let parsed: URL;
    try {
        parsed = new URL(targeturl);
    } catch {
        return new Response(JSON.stringify({ error: 'Invalid url' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const isvylaapi = parsed.hostname === 'api.vyla.cc';
    const allowedcdns = ['ironbubble.site', 'fsharetv.co', 'vidrock.baby', 'mbx.notorrent2.workers.dev', 'source.heistotron.uk', 'mapple.club', 'vdrk.site'];
    const isallowedcdn = allowedcdns.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h));

    if (!isvylaapi && !isallowedcdn) {
        return new Response(JSON.stringify({ error: 'Host not allowed' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    try {
        const fetchheaders: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': '*/*'
        };
        if (isvylaapi) {
            try {
                fetchheaders['X-Session-Token'] = await gettoken();
            } catch (_) {}
        }

        const r = await fetch(parsed.toString(), { headers: fetchheaders, redirect: 'follow' });

        if (r.status === 401 && isvylaapi) {
            cachedtoken = null;
            try {
                fetchheaders['X-Session-Token'] = await gettoken();
                const retry = await fetch(parsed.toString(), { headers: fetchheaders, redirect: 'follow' });
                if (!retry.ok) return new Response(JSON.stringify({ error: 'Upstream ' + retry.status }), { status: retry.status, headers: { 'Content-Type': 'application/json' } });
                return handleresponse(retry, parsed);
            } catch (e: any) {
                return new Response(JSON.stringify({ error: 'Retry failed: ' + e.message }), { status: 502, headers: { 'Content-Type': 'application/json' } });
            }
        }

        if (!r.ok) {
            return new Response(JSON.stringify({ error: 'Upstream ' + r.status }), { status: r.status, headers: { 'Content-Type': 'application/json' } });
        }

        return handleresponse(r, parsed);

    } catch (err: any) {
        return new Response(JSON.stringify({ error: 'Failed: ' + (err.message || 'unknown') }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    }
}

async function handleresponse(r: Response, fetchurl: URL) {
    const contenttype = (r.headers.get('content-type') || '').toLowerCase();
    const buf = await r.arrayBuffer();
    const text = new TextDecoder().decode(buf);
    const ismanifest = text.includes('#EXTM3U') || text.includes('#EXT-X');

    const corsheaders = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' };

    if (!ismanifest) {
        return new Response(buf, { status: 200, headers: { 'Content-Type': contenttype || 'video/mp2t', ...corsheaders } });
    }

    const proxybase = '/api/vyla-proxy?url=';
    const baseurlstr = fetchurl.toString();
    const apiorigin = 'https://api.vyla.cc';

    function rewriteurl(rawurl: string): string {
        if (rawurl.startsWith('http://') || rawurl.startsWith('https://')) {
            return proxybase + encodeURIComponent(rawurl);
        }
        if (rawurl.startsWith('/')) {
            const origin = fetchurl.hostname === 'api.vyla.cc' ? apiorigin : baseurlstr.replace(/\/[^/]*$/, '');
            return proxybase + encodeURIComponent(origin + rawurl);
        }
        try {
            return proxybase + encodeURIComponent(new URL(rawurl, baseurlstr).toString());
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

        const ismasterplaylist = text.includes('#EXT-X-STREAM-INF');
        if (ismasterplaylist) {
            return rewriteurl(trimmed);
        }
        return line;
    }).join('\n');

    return new Response(rewritten, {
        status: 200,
        headers: { 'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8', 'Cache-Control': 's-maxage=60, stale-while-revalidate=300', 'Access-Control-Allow-Origin': '*' }
    });
}
