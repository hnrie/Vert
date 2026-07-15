
export const config = { runtime: 'edge' };

// Cache token at module level (shared across edge invocations)
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
        return new Response(JSON.stringify({ error: 'Missing url parameter' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    let parsed;
    try {
        parsed = new URL(targetUrl);
    } catch {
        return new Response(JSON.stringify({ error: 'Invalid url' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Allow api.vyla.cc and upstream CDN hosts that appear in manifests
    const isVylaApi = parsed.hostname === 'api.vyla.cc';
    const allowedHostSuffixes = [
        'ironbubble.site', 'fsharetv.co', 'vidrock.baby', 
        'mbx.notorrent2.workers.dev', 'source.heistotron.uk'
    ];
    const isAllowedCdn = allowedHostSuffixes.some(h => 
        parsed.hostname === h || parsed.hostname.endsWith('.' + h)
    );

    if (!isVylaApi && !isAllowedCdn) {
        return new Response(JSON.stringify({ error: 'Host not allowed: ' + parsed.hostname }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    try {
        // Build headers - only send token for api.vyla.cc URLs that lack internal_token
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': '*/*'
        };

        const hasInternalToken = parsed.searchParams.has('internal_token') || parsed.toString().includes('internal_token=');

        if (isVylaApi && !hasInternalToken) {
            try {
                const token = await getToken();
                headers['X-Session-Token'] = token;
            } catch (_) {}
        }

        let r = await fetch(parsed.toString(), { headers, redirect: 'follow' });

        // Retry with fresh token if 401 on api.vyla.cc (and no internal_token)
        if (r.status === 401 && isVylaApi && !hasInternalToken) {
            cachedToken = null;
            try {
                const newToken = await getToken();
                headers['X-Session-Token'] = newToken;
                r = await fetch(parsed.toString(), { headers, redirect: 'follow' });
            } catch (_) {}
        }

        if (!r.ok) {
            return new Response(JSON.stringify({ error: `Upstream ${r.status}` }), { status: r.status, headers: { 'Content-Type': 'application/json' } });
        }

        return handleResponse(r, parsed);

    } catch (err) {
        return new Response(JSON.stringify({ error: 'Failed to fetch: ' + (err.message || 'unknown') }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    }
}

async function handleResponse(r, fetchUrl) {
    const contentType = (r.headers.get('content-type') || '').toLowerCase();
    const isManifest = contentType.includes('mpegurl') || contentType.includes('m3u8') || contentType.includes('text/plain');

    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 's-maxage=300, stale-while-revalidate=600'
    };

    // For binary segments (TS, key files), stream directly
    if (!isManifest) {
        return new Response(r.body, {
            status: 200,
            headers: {
                'Content-Type': contentType || 'video/mp2t',
                ...corsHeaders
            }
        });
    }

    // For m3u8 manifests, only rewrite KEY/MEDIA URIs (for crypto/alt audio).
    // Segment URLs are left as-is so HLS.js fetches them directly from api.vyla.cc.
    // The QUIC errors are intermittent and HLS.js has built-in retry logic.
    // Proxying every segment through a serverless function adds too much latency.
    let text = await r.text();

    // Check if it's actually a manifest
    if (!text.includes('#EXTM3U') && !text.includes('#EXT-X')) {
        return new Response(text, {
            status: 200,
            headers: { 'Content-Type': contentType || 'text/plain', ...corsHeaders }
        });
    }

    const proxyBase = '/api/vyla-proxy?url=';
    const baseUrlStr = fetchUrl ? fetchUrl.toString() : '';
    const apiOrigin = 'https://api.vyla.cc';

    text = text.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed) return line;

        // Only rewrite URI="..." in #EXT tags (keys, media) - these need proxying for CORS
        if (trimmed.startsWith('#EXT')) {
            return line.replace(/URI="([^"]+)"/g, (match, uri) => {
                if (uri.startsWith('http://') || uri.startsWith('https://')) {
                    return `URI="${proxyBase}${encodeURIComponent(uri)}"`;
                }
                if (uri.startsWith('/')) {
                    const origin = fetchUrl && fetchUrl.hostname === 'api.vyla.cc' ? apiOrigin : baseUrlStr.replace(/\/[^/]*$/, '');
                    return `URI="${proxyBase}${encodeURIComponent(origin + uri)}"`;
                }
                if (baseUrlStr) {
                    try {
                        const resolved = new URL(uri, baseUrlStr).toString();
                        return `URI="${proxyBase}${encodeURIComponent(resolved)}"`;
                    } catch (_) {}
                }
                return match;
            });
        }

        // Leave segment URLs as-is - HLS.js fetches them directly
        return line;
    }).join('\n');

    return new Response(text, {
        status: 200,
        headers: {
            'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
            'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
            'Access-Control-Allow-Origin': '*'
        }
    });
}
