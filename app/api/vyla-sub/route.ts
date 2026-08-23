import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const url = req.nextUrl.searchParams.get('url');
    if (!url) {
        return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return NextResponse.json({ error: 'Protocol not allowed' }, { status: 400 });
    }

    const allowedhosts = ['cache.vdrk.site', 'sub.vdrk.site'];
    if (!allowedhosts.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h))) {
        return NextResponse.json({ error: 'Host not allowed' }, { status: 403 });
    }

    try {
        const r = await fetch(parsed.toString(), {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });

        if (!r.ok) {
            return NextResponse.json({ error: 'Upstream ' + r.status }, { status: r.status });
        }

        const text = await r.text();
        return new Response(text, {
            status: 200,
            headers: {
                'Content-Type': r.headers.get('content-type') || 'text/vtt; charset=utf-8',
                'Cache-Control': 's-maxage=86400, stale-while-revalidate=604800',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (err) {
        return NextResponse.json({ error: 'Failed to fetch subtitle' }, { status: 502 });
    }
}
