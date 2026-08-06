import { NextResponse } from 'next/server';

export async function POST() {
    try {
        const r = await fetch('https://player.vyla.cc/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        if (!r.ok) {
            return NextResponse.json({ error: 'Vyla auth failed: ' + r.status }, { status: r.status });
        }

        const data = await r.json();
        return NextResponse.json(data, {
            status: 200,
            headers: { 'Cache-Control': 'no-store' }
        });
    } catch (err) {
        return NextResponse.json({ error: 'Failed to authenticate with Vyla' }, { status: 502 });
    }
}
