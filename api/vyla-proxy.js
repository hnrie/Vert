
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

    if (parsed.hostname !== 'api.vyla.cc') {
        return new Response(JSON.stringify({ error: 'Host not allowed' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    try {
        const token = await getToken();

        const r = await fetch(parsed.toString(), {
            headers: {
                'X-Session-Token': token,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': '*/*'
            }
        });

        if (r.status === 401) {
            // Token expired, refresh and retry
            cachedToken = null;
            const newToken = await getToken();
            const retry = await fetch(parsed.toString(), {
                headers: {
                    'X-Session-Token': newToken,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Accept': '*/*'
                }
            });
            return handleResponse(retry);
        }

        if (!r.ok) {
            return new Response(JSON.stringify({ error: `Upstream ${r.status}` }), { status: r.status, headers: { 'Content-Type': 'application/json' } });
        }

        return handleResponse(r);

    } catch (err) {
        return new Response(JSON.stringify({ error: 'Failed to fetch from Vyla: ' + (err.message || 'unknown') }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    }
}

async function handleResponse(r) {
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

    // For m3u8 manifests, rewrite all URLs to go through this proxy
    let text = await r.text();

    // Check if it's actually a manifest
    if (!text.includes('#EXTM3U') && !text.includes('#EXT-X')) {
        return new Response(text, {
            status: 200,
            headers: { 'Content-Type': contentType || 'text/plain', ...corsHeaders }
        });
    }

    const proxyBase = '/api/vyla-proxy?url=';

    text = text.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed) return line;

        // Handle #EXT-X-KEY:URI="..." and #EXT-X-MEDIA:URI="..."
        if (trimmed.startsWith('#EXT')) {
            return line.replace(/URI="([^"]+)"/g, (match, uri) => {
                if (uri.startsWith('http://') || uri.startsWith('https://')) {
                    return `URI="${proxyBase}${encodeURIComponent(uri)}"`;
                }
                if (uri.startsWith('/')) {
                    return `URI="${proxyBase}${encodeURIComponent('https://api.vyla.cc' + uri)}"`;
                }
                return match;
            });
        }

        // Plain URL lines (segment URLs)
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
            return `${proxyBase}${encodeURIComponent(trimmed)}`;
        }

        // Relative segment URLs
        if (trimmed.startsWith('/')) {
            return `${proxyBase}${encodeURIComponent('https://api.vyla.cc' + trimmed)}`;
        }

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
