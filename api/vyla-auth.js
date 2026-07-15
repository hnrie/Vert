
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const r = await fetch('https://player.vyla.cc/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        if (!r.ok) {
            return res.status(r.status).json({ error: `Vyla auth failed: ${r.status}` });
        }

        const data = await r.json();
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json(data);
    } catch (err) {
        console.error('Vyla auth proxy error:', err);
        return res.status(502).json({ error: 'Failed to authenticate with Vyla' });
    }
}
