
export default async function handler(req, res) {
    const { url } = req.query;
    if (!url) {
        return res.status(400).json({ error: 'Missing url parameter' });
    }

    let parsed;
    try {
        parsed = new URL(url);
    } catch {
        return res.status(400).json({ error: 'Invalid url' });
    }

    // Only allow api.vyla.cc proxy URLs
    if (parsed.hostname !== 'api.vyla.cc') {
        return res.status(403).json({ error: 'Host not allowed' });
    }

    try {
        // Pass through query params (internal_token, proxyHeaders, etc are in the URL already)
        const fetchUrl = parsed.toString();

        const r = await fetch(fetchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': '*/*'
            },
            // Don't follow redirects automatically - handle them
            redirect: 'follow'
        });

        if (!r.ok) {
            return res.status(r.status).json({ error: `Upstream ${r.status}` });
        }

        const contentType = (r.headers.get('content-type') || '').toLowerCase();
        const isManifest = contentType.includes('mpegurl') || contentType.includes('m3u8') || contentType.includes('text/plain');

        // For binary segments (TS, key files), stream directly
        if (!isManifest) {
            const buf = Buffer.from(await r.arrayBuffer());
            res.setHeader('Content-Type', contentType || 'video/mp2t');
            res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
            res.setHeader('Access-Control-Allow-Origin', '*');
            return res.status(200).send(buf);
        }

        // For m3u8 manifests, rewrite all URLs to go through this proxy
        let text = await r.text();

        // Check if it's actually a manifest
        if (!text.includes('#EXTM3U') && !text.includes('#EXT-X')) {
            // Not a manifest, return as-is
            res.setHeader('Content-Type', contentType || 'text/plain');
            res.setHeader('Access-Control-Allow-Origin', '*');
            return res.status(200).send(text);
        }

        const proxyBase = '/api/vyla-proxy?url=';

        // Rewrite all lines that contain URLs
        text = text.split('\n').map(line => {
            const trimmed = line.trim();

            // Skip empty lines and comments (except #EXT-X-KEY which has URI)
            if (!trimmed) return line;

            // Handle #EXT-X-KEY:URI="..." and #EXT-X-MEDIA:URI="..."
            if (trimmed.startsWith('#EXT')) {
                // Rewrite URI="..." attributes
                return line.replace(/URI="([^"]+)"/g, (match, uri) => {
                    if (uri.startsWith('http://') || uri.startsWith('https://')) {
                        return `URI="${proxyBase}${encodeURIComponent(uri)}"`;
                    }
                    // Relative URL - resolve against the fetchUrl
                    if (uri.startsWith('/')) {
                        const resolved = `https://api.vyla.cc${uri}`;
                        return `URI="${proxyBase}${encodeURIComponent(resolved)}"`;
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
                const resolved = `https://api.vyla.cc${trimmed}`;
                return `${proxyBase}${encodeURIComponent(resolved)}`;
            }

            return line;
        }).join('\n');

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).send(text);

    } catch (err) {
        console.error('Vyla proxy error:', err);
        return res.status(502).json({ error: 'Failed to fetch from Vyla' });
    }
}
