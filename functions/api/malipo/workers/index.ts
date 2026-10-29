// functions/api/malipo/workers/index.ts
import type { PagesFunction } from '@cloudflare/workers-types';

type Env = { DB: D1Database };

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

const genId = (p: string) =>
  `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body: any = await request.json().catch(() => null);
    const { fullName, phoneNumber, address = '', businessName = '', notes = '' } = body || {};

    if (!fullName?.trim() || !phoneNumber?.trim()) {
      return json({ error: 'Jina na simu vinahitajika' }, 400);
    }

    const id = genId('mwork');
    await env.DB
      .prepare(
        `INSERT INTO malipo_workers (id, full_name, phone_number, address, business_name, notes)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(id, fullName.trim(), phoneNumber.trim(), address, businessName, notes)
      .run();

    const worker = await env.DB
      .prepare(`SELECT * FROM malipo_workers WHERE id = ?`)
      .bind(id)
      .first();

    return json({ worker });
  } catch (err: any) {
    console.error('POST /api/malipo/workers', err);
    return json({ error: 'Imeshindwa kumsajili mfanyakazi' }, 500);
  }
};
