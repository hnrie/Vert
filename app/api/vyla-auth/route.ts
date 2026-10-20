import { NextResponse } from 'next/server';
import { isrecord } from '../../../lib/utils';

export async function POST() {
    try {
        let r = await fetch('https://player.vyla.cc/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        if (!r.ok) {
            if (r.status === 403) {
                r = await fetch('https://player.vyla.cc/_https/api/auth', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ _https: true })
                });
            }
        }

        if (!r.ok) {
            return NextResponse.json({ error: 'Vyla auth failed: ' + r.status }, { status: r.status });
        }

        const data: unknown = await r.json();
        if (!isrecord(data)) {
            return NextResponse.json({ error: 'Invalid Vyla auth response' }, { status: 502 });
        }
        return NextResponse.json(data, {
            status: 200,
            headers: { 'Cache-Control': 'no-store' }
        });
    } catch {
        return NextResponse.json({ error: 'Failed to authenticate with Vyla' }, { status: 502 });
    }
}
