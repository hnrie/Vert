import { test, expect } from '@playwright/test';
import { NextRequest } from 'next/server';
import { GET, POST } from '../../app/api/sync/route';

test('sync uses atomic Redis commands for PIN creation and consumption', async () => {
  const commands: string[][] = [];
  const originalfetch = globalThis.fetch;
  const originalurl = process.env.UPSTASH_REDIS_REST_URL;
  const originaltoken = process.env.UPSTASH_REDIS_REST_TOKEN;

  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.invalid';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
  globalThis.fetch = async (_input, init) => {
    const command = JSON.parse(String(init?.body)) as string[];
    commands.push(command);
    if (command[0] === 'SET') return Response.json({ result: 'OK' });
    if (command[0] === 'GETDEL') return Response.json({ result: 'payload' });
    if (command[0] === 'EXISTS') return Response.json({ result: 0 });
    if (command[0] === 'GET') return Response.json({ result: 'payload' });
    if (command[0] === 'DEL') return Response.json({ result: 1 });
    throw new Error(`Unexpected Redis command: ${command[0]}`);
  };

  try {
    const create = await POST(new NextRequest('http://localhost/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: 'payload' })
    }));
    expect(create.status).toBe(200);
    const { pin } = await create.json() as { pin: string };
    expect(commands[0]).toEqual(['SET', `sync:${pin}`, 'payload', 'EX', 600, 'NX']);

    commands.length = 0;
    const read = await GET(new NextRequest(`http://localhost/api/sync?code=${pin}`));
    expect(read.status).toBe(200);
    await expect(read.json()).resolves.toEqual({ data: 'payload' });
    expect(commands).toEqual([['GETDEL', `sync:${pin}`]]);
  } finally {
    globalThis.fetch = originalfetch;
    if (originalurl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = originalurl;
    if (originaltoken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = originaltoken;
  }
});
