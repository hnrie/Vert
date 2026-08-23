import { NextRequest, NextResponse } from 'next/server';

const allowed = ['/trending/', '/movie/', '/tv/', '/search/', '/genre/', '/discover/'];

function safepath(raw: string) {
    let decoded = raw;
    for (let i = 0; i < 3; i++) {
        let next: string;
        try {
            next = decodeURIComponent(decoded);
        } catch {
            return null;
        }
        if (next === decoded) break;
        decoded = next;
    }
    if (!decoded.startsWith('/')) return null;
    if (decoded.includes('\\') || decoded.includes('//')) return null;
    if (decoded.split('/').some(seg => seg === '.' || seg === '..')) return null;
    if (!allowed.some(p => decoded.startsWith(p))) return null;
    return decoded;
}

export async function GET(req: NextRequest) {
    const searchparams = req.nextUrl.searchParams;
    const ep = searchparams.get('ep');
    if (!ep) {
        return NextResponse.json({ error: 'Thiếu tham số truy vấn "ep"' }, { status: 400 });
    }

    const path = safepath(ep);
    if (!path) {
        return NextResponse.json({ error: 'Endpoint không được phép' }, { status: 403 });
    }

    const apikey = process.env.TMDB_API_KEY;
    if (!apikey) {
        return NextResponse.json({ error: 'TMDB_API_KEY chưa được cấu hình' }, { status: 500 });
    }

    const [rawpath, rawquery] = path.split('?');
    const targeturl = new URL('https://api.themoviedb.org/3' + rawpath);
    if (rawquery) {
        new URLSearchParams(rawquery).forEach((v, k) => {
            targeturl.searchParams.set(k, v);
        });
    }
    searchparams.forEach((v, k) => {
        if (k !== 'ep') targeturl.searchParams.set(k, v);
    });
    targeturl.searchParams.set('language', 'vi-VN');
    targeturl.searchParams.set('api_key', apikey);

    try {
        const tmdbres = await fetch(targeturl.toString());
        const data = await tmdbres.json();

        return NextResponse.json(data, {
            status: tmdbres.status,
            headers: {
                'Cache-Control': tmdbres.ok ? 's-maxage=600, stale-while-revalidate=3600' : 'no-store'
            }
        });
    } catch (err) {
        return NextResponse.json({ error: 'Không thể lấy dữ liệu từ TMDB' }, { status: 502 });
    }
}
