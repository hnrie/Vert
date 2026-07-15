
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

    // Only allow subtitle CDN hosts
    const ALLOWED_HOSTS = ['cache.vdrk.site', 'sub.vdrk.site'];
    if (!ALLOWED_HOSTS.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h))) {
        return res.status(403).json({ error: 'Host not allowed' });
    }

    try {
        const r = await fetch(parsed.toString(), {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });

        if (!r.ok) {
            return res.status(r.status).json({ error: `Upstream ${r.status}` });
        }

        const text = await r.text();
        res.setHeader('Content-Type', r.headers.get('content-type') || 'text/vtt; charset=utf-8');
        res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).send(text);
    } catch (err) {
        console.error('Vyla subtitle proxy error:', err);
        return res.status(502).json({ error: 'Failed to fetch subtitle' });
    }
}
