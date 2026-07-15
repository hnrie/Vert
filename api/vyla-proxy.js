
export default async function handler(req, res) {
    const { url: targetUrl, token: clientToken } = req.query;
    if (!targetUrl) {
        return res.status(400).json({ error: 'Missing url parameter' });
    }

    let parsed;
    try {
        parsed = new URL(targetUrl);
    } catch {
        return res.status(400).json({ error: 'Invalid url' });
    }

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
        return res.status(403).json({ error: 'Host not allowed: ' + parsed.hostname });
    }

    try {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': '*/*'
        };

        if (isVylaApi && clientToken) {
            headers['X-Session-Token'] = clientToken;
        }

        const r = await fetch(parsed.toString(), { headers, redirect: 'follow' });

        if (!r.ok) {
            return res.status(r.status).json({ error: `Upstream ${r.status}` });
        }

        const contentType = (r.headers.get('content-type') || '').toLowerCase();
        const buf = Buffer.from(await r.arrayBuffer());
        const text = buf.toString('utf8');

        // Detect manifest by content (api.vyla.cc returns application/json for m3u8)
        const isManifest = text.includes('#EXTM3U') || text.includes('#EXT-X');

        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 's-maxage=300, stale-while-revalidate=600'
        };

        if (!isManifest) {
            // Binary segment or JSON - return as-is
            res.setHeader('Content-Type', contentType || 'video/mp2t');
            Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));
            return res.status(200).send(buf);
        }

        // Rewrite ALL URLs in manifest to go through this proxy with token
        const proxyBase = '/api/vyla-proxy?url=';
        const tokenParam = clientToken ? '&token=' + encodeURIComponent(clientToken) : '';
        const baseUrlStr = parsed.toString();
        const apiOrigin = 'https://api.vyla.cc';

        function rewriteUrl(rawUrl) {
            if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
                return `${proxyBase}${encodeURIComponent(rawUrl)}${tokenParam}`;
            }
            if (rawUrl.startsWith('/')) {
                const origin = parsed.hostname === 'api.vyla.cc' ? apiOrigin : baseUrlStr.replace(/\/[^/]*$/, '');
                return `${proxyBase}${encodeURIComponent(origin + rawUrl)}${tokenParam}`;
            }
            if (baseUrlStr) {
                try {
                    const resolved = new URL(rawUrl, baseUrlStr).toString();
                    return `${proxyBase}${encodeURIComponent(resolved)}${tokenParam}`;
                } catch (_) {}
            }
            return rawUrl;
        }

        const rewritten = text.split('\n').map(line => {
            const trimmed = line.trim();
            if (!trimmed) return line;

            if (trimmed.startsWith('#EXT')) {
                return line.replace(/URI="([^"]+)"/g, (match, uri) => `URI="${rewriteUrl(uri)}"`);
            }

            if (trimmed.startsWith('#')) return line;

            return rewriteUrl(trimmed);
        }).join('\n');

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).send(rewritten);

    } catch (err) {
        console.error('Vyla proxy error:', err);
        return res.status(502).json({ error: 'Failed: ' + (err.message || 'unknown') });
    }
}
