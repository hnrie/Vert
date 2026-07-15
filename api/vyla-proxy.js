
export const config = { runtime: 'edge' };

let cachedToken = null;
let tokenExpiresAt = 0;

async function getToken() {
    if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;
    const r = await fetch('https://player.vyla.cc/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
    });
    if (!r.ok) throw new Error(`Auth failed: ${r.status}`);
    const data = await r.json();
    cachedToken = data.token;
    tokenExpiresAt = Date.now() + 25 * 60 * 1000;
    return cachedToken;
}

export default async function handler(req) {
    const url = new URL(req.url);
    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) {
        return new Response(JSON.stringify({ error: 'Missing url' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    let parsed;
    try {
        parsed = new URL(targetUrl);
    } catch {
        return new Response(JSON.stringify({ error: 'Invalid url' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const isVylaApi = parsed.hostname === 'api.vyla.cc';
    const allowedCdns = ['ironbubble.site', 'fsharetv.co', 'vidrock.baby', 'mbx.notorrent2.workers.dev', 'source.heistotron.uk', 'mapple.club', 'vdrk.site'];
    const isAllowedCdn = allowedCdns.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h));

    if (!isVylaApi && !isAllowedCdn) {
        return new Response(JSON.stringify({ error: 'Host not allowed' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    try {
        const fetchHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': '*/*'
        };
        if (isVylaApi) {
            try {
                fetchHeaders['X-Session-Token'] = await getToken();
            } catch (_) {}
        }

        const r = await fetch(parsed.toString(), { headers: fetchHeaders, redirect: 'follow' });

        if (r.status === 401 && isVylaApi) {
            cachedToken = null;
            try {
                fetchHeaders['X-Session-Token'] = await getToken();
                const retry = await fetch(parsed.toString(), { headers: fetchHeaders, redirect: 'follow' });
                if (!retry.ok) return new Response(JSON.stringify({ error: `Upstream ${retry.status}` }), { status: retry.status, headers: { 'Content-Type': 'application/json' } });
                return handleResponse(retry, parsed);
            } catch (e) {
                return new Response(JSON.stringify({ error: 'Retry failed: ' + e.message }), { status: 502, headers: { 'Content-Type': 'application/json' } });
            }
        }

        if (!r.ok) {
            return new Response(JSON.stringify({ error: `Upstream ${r.status}` }), { status: r.status, headers: { 'Content-Type': 'application/json' } });
        }

        return handleResponse(r, parsed);

    } catch (err) {
        return new Response(JSON.stringify({ error: 'Failed: ' + (err.message || 'unknown') }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    }
}

async function handleResponse(r, fetchUrl) {
    const contentType = (r.headers.get('content-type') || '').toLowerCase();
    const buf = await r.arrayBuffer();
    const text = new TextDecoder().decode(buf);
    const isManifest = text.includes('#EXTM3U') || text.includes('#EXT-X');

    const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' };

    if (!isManifest) {
        return new Response(buf, { status: 200, headers: { 'Content-Type': contentType || 'video/mp2t', ...corsHeaders } });
    }

    // Rewrite manifest URLs through proxy (no token in URL - proxy gets its own)
    const proxyBase = '/api/vyla-proxy?url=';
    const baseUrlStr = fetchUrl.toString();
    const apiOrigin = 'https://api.vyla.cc';

    function rewriteUrl(rawUrl) {
        if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
            return proxyBase + encodeURIComponent(rawUrl);
        }
        if (rawUrl.startsWith('/')) {
            const origin = fetchUrl.hostname === 'api.vyla.cc' ? apiOrigin : baseUrlStr.replace(/\/[^/]*$/, '');
            return proxyBase + encodeURIComponent(origin + rawUrl);
        }
        try {
            return proxyBase + encodeURIComponent(new URL(rawUrl, baseUrlStr).toString());
        } catch (_) {
            return rawUrl;
        }
    }

    const rewritten = text.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed) return line;
        if (trimmed.startsWith('#EXT')) {
            return line.replace(/URI="([^"]+)"/g, (_, uri) => 'URI="' + rewriteUrl(uri) + '"');
        }
        if (trimmed.startsWith('#')) return line;
        return rewriteUrl(trimmed);
    }).join('\n');

    return new Response(rewritten, {
        status: 200,
        headers: { 'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8', 'Cache-Control': 's-maxage=60, stale-while-revalidate=300', 'Access-Control-Allow-Origin': '*' }
    });
}
