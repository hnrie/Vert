
export const config = { runtime: 'edge' };

export default async function handler(req) {
    const url = new URL(req.url);
    const targetUrl = url.searchParams.get('url');
    const clientToken = url.searchParams.get('token');
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
        if (isVylaApi && clientToken) {
            fetchHeaders['X-Session-Token'] = clientToken;
        }

        const r = await fetch(parsed.toString(), { headers: fetchHeaders, redirect: 'follow' });

        if (!r.ok) {
            return new Response(JSON.stringify({ error: `Upstream ${r.status}` }), { status: r.status, headers: { 'Content-Type': 'application/json' } });
        }

        const contentType = (r.headers.get('content-type') || '').toLowerCase();
        const buf = await r.arrayBuffer();
        const text = new TextDecoder().decode(buf);
        const isManifest = text.includes('#EXTM3U') || text.includes('#EXT-X');

        const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' };

        if (!isManifest) {
            return new Response(buf, { status: 200, headers: { 'Content-Type': contentType || 'video/mp2t', ...corsHeaders } });
        }

        // Rewrite manifest URLs
        const proxyBase = '/api/vyla-proxy?url=';
        const tokenParam = clientToken ? '&token=' + encodeURIComponent(clientToken) : '';
        const baseUrlStr = parsed.toString();
        const apiOrigin = 'https://api.vyla.cc';

        function rewriteUrl(rawUrl) {
            if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
                return proxyBase + encodeURIComponent(rawUrl) + tokenParam;
            }
            if (rawUrl.startsWith('/')) {
                const origin = parsed.hostname === 'api.vyla.cc' ? apiOrigin : baseUrlStr.replace(/\/[^/]*$/, '');
                return proxyBase + encodeURIComponent(origin + rawUrl) + tokenParam;
            }
            try {
                return proxyBase + encodeURIComponent(new URL(rawUrl, baseUrlStr).toString()) + tokenParam;
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

    } catch (err) {
        return new Response(JSON.stringify({ error: 'Failed: ' + (err.message || 'unknown') }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    }
}
