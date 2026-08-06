import { NextRequest, NextResponse } from 'next/server';

const memstore = new Map<string, { data: string; expires: number }>();

async function callredis(cmd: any[]) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return null;
    const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(cmd)
    });
    return res.json();
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const data = body?.data;
        if (!data || typeof data !== 'string') {
            return NextResponse.json({ error: 'Thiếu dữ liệu' }, { status: 400 });
        }
        if (data.length > 500000) {
            return NextResponse.json({ error: 'Dữ liệu quá lớn' }, { status: 413 });
        }

        const useupstash = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

        let pin = '';
        let attempts = 0;

        do {
            pin = String(Math.floor(100000 + Math.random() * 900000));
            if (useupstash) {
                const exists = await callredis(['EXISTS', 'sync:' + pin]);
                if (exists && exists.result === 0) break;
            } else {
                const item = memstore.get(pin);
                if (!item || item.expires < Date.now()) break;
            }
            attempts++;
        } while (attempts < 10);

        if (attempts >= 10) {
            return NextResponse.json({ error: 'Không thể tạo mã PIN, vui lòng thử lại' }, { status: 503 });
        }

        if (useupstash) {
            await callredis(['SET', 'sync:' + pin, data, 'EX', 600]);
        } else {
            memstore.set(pin, { data, expires: Date.now() + 600000 });
        }

        return NextResponse.json({ pin }, { status: 200 });
    } catch (err) {
        return NextResponse.json({ error: 'Thiếu dữ liệu' }, { status: 400 });
    }
}

export async function GET(req: NextRequest) {
    const code = req.nextUrl.searchParams.get('code');
    if (!code || !/^\d{6}$/.test(code)) {
        return NextResponse.json({ error: 'Mã không hợp lệ' }, { status: 400 });
    }

    const useupstash = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

    if (useupstash) {
        const result = await callredis(['GET', 'sync:' + code]);
        if (!result || !result.result) {
            return NextResponse.json({ error: 'Không tìm thấy mã hoặc mã đã hết hạn' }, { status: 404 });
        }
        await callredis(['DEL', 'sync:' + code]);
        return NextResponse.json({ data: result.result }, { status: 200 });
    } else {
        const item = memstore.get(code);
        if (!item || item.expires < Date.now()) {
            memstore.delete(code);
            return NextResponse.json({ error: 'Không tìm thấy mã hoặc mã đã hết hạn' }, { status: 404 });
        }
        memstore.delete(code);
        return NextResponse.json({ data: item.data }, { status: 200 });
    }
}
