// functions/api/kopesha/customers/index.ts
import type { PagesFunction } from '@cloudflare/workers-types';

type Env = { DB: D1Database };

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body: any = await request.json().catch(() => null);
    if (!body) return json({ error: 'No data' }, 400);

    const fullName = String(body.fullName || '').trim();
    const phoneNumber = String(body.phoneNumber || '').trim();
    const address = String(body.address || '').trim();
    const notes = String(body.notes || '').trim();

    if (!fullName) return json({ error: 'Jina linahitajika' }, 400);
    if (!phoneNumber) return json({ error: 'Namba ya simu inahitajika' }, 400);

    const id = `kcust-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    await env.DB.prepare(
      `INSERT INTO kopesha_customers (id, full_name, phone_number, address, notes)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(id, fullName, phoneNumber, address, notes).run();

    const customer: any = await env.DB
      .prepare('SELECT * FROM kopesha_customers WHERE id = ?')
      .bind(id).first();

    return json({ success: true, customer });
  } catch (error: any) {
    console.error('Kopesha create customer error:', error);
    return json({ error: error?.message || 'Failed to create customer' }, 500);
  }
};
