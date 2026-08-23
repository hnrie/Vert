import { NextRequest, NextResponse } from 'next/server';

const memstore = new Map<string, { data: string; expires: number }>();
const ttlms = 600000;
const maxentries = 5000;

function useupstash() {
    return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function callredis(cmd: any[]) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return null;
    const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(cmd)
    });
    if (!res.ok) throw new Error('Redis ' + res.status);
    return res.json();
}

function sweep() {
    const now = Date.now();
    memstore.forEach((v, k) => {
        if (v.expires < now) memstore.delete(k);
    });
    if (memstore.size <= maxentries) return;
    const ordered = Array.from(memstore.entries()).sort((a, b) => a[1].expires - b[1].expires);
    for (const [k] of ordered.slice(0, memstore.size - maxentries)) {
        memstore.delete(k);
    }
}

function newpin() {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return String(100000 + (buf[0] % 900000));
}

export async function POST(req: NextRequest) {
    let data: unknown;
    try {
        const body = await req.json();
        data = body?.data;
    } catch (_) {
        return NextResponse.json({ error: 'Thiếu dữ liệu' }, { status: 400 });
    }

    if (!data || typeof data !== 'string') {
        return NextResponse.json({ error: 'Thiếu dữ liệu' }, { status: 400 });
    }
    if (data.length > 500000) {
        return NextResponse.json({ error: 'Dữ liệu quá lớn' }, { status: 413 });
    }

    const remote = useupstash();
    if (!remote) sweep();

    try {
        let pin = '';
        let free = false;

        for (let i = 0; i < 10 && !free; i++) {
            pin = newpin();
            if (remote) {
                const exists = await callredis(['EXISTS', 'sync:' + pin]);
                free = Boolean(exists && exists.result === 0);
            } else {
                const item = memstore.get(pin);
                free = !item || item.expires < Date.now();
            }
        }

        if (!free) {
            return NextResponse.json({ error: 'Không thể tạo mã PIN, vui lòng thử lại' }, { status: 503 });
        }

        if (remote) {
            await callredis(['SET', 'sync:' + pin, data, 'EX', Math.floor(ttlms / 1000)]);
        } else {
            memstore.set(pin, { data, expires: Date.now() + ttlms });
        }

        return NextResponse.json({ pin }, { status: 200 });
    } catch (err) {
        return NextResponse.json({ error: 'Máy chủ đồng bộ không phản hồi' }, { status: 502 });
    }
}

export async function GET(req: NextRequest) {
    const code = req.nextUrl.searchParams.get('code');
    if (!code || !/^\d{6}$/.test(code)) {
        return NextResponse.json({ error: 'Mã không hợp lệ' }, { status: 400 });
    }

    const notfound = NextResponse.json({ error: 'Không tìm thấy mã hoặc mã đã hết hạn' }, { status: 404 });

    if (useupstash()) {
        try {
            const result = await callredis(['GET', 'sync:' + code]);
            if (!result || !result.result) return notfound;
            await callredis(['DEL', 'sync:' + code]);
            return NextResponse.json({ data: result.result }, { status: 200 });
        } catch (err) {
            return NextResponse.json({ error: 'Máy chủ đồng bộ không phản hồi' }, { status: 502 });
        }
    }

    sweep();
    const item = memstore.get(code);
    if (!item || item.expires < Date.now()) {
        memstore.delete(code);
        return notfound;
    }
    memstore.delete(code);
    return NextResponse.json({ data: item.data }, { status: 200 });
}
