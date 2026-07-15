
export const config = { runtime: 'edge' };

export default async function handler(req) {
    const url = new URL(req.url);
    const targetUrl = url.searchParams.get('url');
    const clientToken = url.searchParams.get('token');
    if (!targetUrl) {
        return new Response(JSON.stringify({ error: 'Missing url parameter' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    let parsed;
    try {
        parsed = new URL(targetUrl);
    } catch {
        return new Response(JSON.stringify({ error: 'Invalid url' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Allow api.vyla.cc and upstream CDN hosts
    const isVylaApi = parsed.hostname === 'api.vyla.cc';
    const allowedHostSuffixes = [
        'ironbubble.site', 'fsharetv.co', 'vidrock.baby',
        'mbx.notorrent2.workers.dev', 'source.heistotron.uk',
        'mapple.club', 'vdrk.site'
    ];
    const isAllowedCdn = allowedHostSuffixes.some(h =>
        parsed.hostname === h || parsed.hostname.endsWith('.' + h)
    );

    if (!isVylaApi && !isAllowedCdn) {
        return new Response(JSON.stringify({ error: 'Host not allowed: ' + parsed.hostname }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    try {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': '*/*'
        };

        // Send token for api.vyla.cc if provided by client
        if (isVylaApi && clientToken) {
            headers['X-Session-Token'] = clientToken;
        }

        const r = await fetch(parsed.toString(), { headers, redirect: 'follow' });

        if (!r.ok) {
            return new Response(JSON.stringify({ error: `Upstream ${r.status}` }), { status: r.status, headers: { 'Content-Type': 'application/json' } });
        }

        return handleResponse(r, parsed, clientToken);

    } catch (err) {
        return new Response(JSON.stringify({ error: 'Failed: ' + (err.message || 'unknown') }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    }
}

async function handleResponse(r, fetchUrl, token) {
    const contentType = (r.headers.get('content-type') || '').toLowerCase();
    const isManifest = contentType.includes('mpegurl') || contentType.includes('m3u8') || contentType.includes('text/plain');

    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 's-maxage=300, stale-while-revalidate=600'
    };

    // Binary segments - stream directly
    if (!isManifest) {
        return new Response(r.body, {
            status: 200,
            headers: { 'Content-Type': contentType || 'video/mp2t', ...corsHeaders }
        });
    }

    let text = await r.text();

    if (!text.includes('#EXTM3U') && !text.includes('#EXT-X')) {
        return new Response(text, {
            status: 200,
            headers: { 'Content-Type': contentType || 'text/plain', ...corsHeaders }
        });
    }

    // Rewrite ALL URLs to go through this proxy, passing the token along
    const proxyBase = '/api/vyla-proxy?url=';
    const tokenParam = token ? '&token=' + encodeURIComponent(token) : '';
    const baseUrlStr = fetchUrl ? fetchUrl.toString() : '';
    const apiOrigin = 'https://api.vyla.cc';

    function rewriteUrl(rawUrl) {
        if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
            return `${proxyBase}${encodeURIComponent(rawUrl)}${tokenParam}`;
        }
        if (rawUrl.startsWith('/')) {
            const origin = fetchUrl && fetchUrl.hostname === 'api.vyla.cc' ? apiOrigin : baseUrlStr.replace(/\/[^/]*$/, '');
            return `${proxyBase}${encodeURIComponent(origin + rawUrl)}${tokenParam}`;
        }
        // Relative
        if (baseUrlStr) {
            try {
                const resolved = new URL(rawUrl, baseUrlStr).toString();
                return `${proxyBase}${encodeURIComponent(resolved)}${tokenParam}`;
            } catch (_) {}
        }
        return rawUrl;
    }

    text = text.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed) return line;

        // Rewrite URI="..." in EXT tags
        if (trimmed.startsWith('#EXT')) {
            return line.replace(/URI="([^"]+)"/g, (match, uri) => `URI="${rewriteUrl(uri)}"`);
        }

        // Skip other comments
        if (trimmed.startsWith('#')) return line;

        // Segment/variant URL lines
        return rewriteUrl(trimmed);
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
