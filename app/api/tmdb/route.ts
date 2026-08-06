import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const searchparams = req.nextUrl.searchParams;
    const ep = searchparams.get('ep');
    if (!ep) {
        return NextResponse.json({ error: 'Thiếu tham số truy vấn "ep"' }, { status: 400 });
    }

    const allowed = ['/trending/', '/movie/', '/tv/', '/search/', '/genre/', '/discover/'];
    if (!allowed.some(p => ep.startsWith(p))) {
        return NextResponse.json({ error: 'Endpoint không được phép' }, { status: 403 });
    }

    const apikey = process.env.TMDB_API_KEY || '2d2b528a49c661efc0a767e7275f1068';
    if (!apikey) {
        return NextResponse.json({ error: 'TMDB_API_KEY chưa được cấu hình' }, { status: 500 });
    }

    try {
        const sep = ep.includes('?') ? '&' : '?';
        let targeturl = 'https://api.themoviedb.org/3' + ep + sep + 'api_key=' + apikey + '&language=vi-VN';

        searchparams.forEach((v, k) => {
            if (k !== 'ep') {
                targeturl += '&' + k + '=' + encodeURIComponent(v);
            }
        });

        const tmdbres = await fetch(targeturl);
        const data = await tmdbres.json();

        return NextResponse.json(data, {
            status: tmdbres.status,
            headers: {
                'Cache-Control': 's-maxage=600, stale-while-revalidate=3600'
            }
        });
    } catch (err) {
        return NextResponse.json({ error: 'Không thể lấy dữ liệu từ TMDB' }, { status: 502 });
    }
}
