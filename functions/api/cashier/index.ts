// functions/api/cashier/index.ts
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

function rowToEntry(row: any) {
  return {
    id: row.id,
    name: row.name || '',
    amount: Number(row.amount) || 0,
    taarifa: row.taarifa || '',
    status: row.status || 'Pending',
    createdBy: row.created_by || 'admin',
    approvedBy: row.approved_by || '',
    approvedAt: row.approved_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const { results } = await env.DB.prepare(
      `SELECT * FROM cashier_entries ORDER BY created_at DESC`
    ).all();
    return json((results || []).map(rowToEntry));
  } catch (error: any) {
    console.error('Cashier GET error:', error);
    return json({ success: false, error: error?.message || 'Failed to load' }, 500);
  }
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body: any = await request.json().catch(() => null);
    if (!body) return json({ success: false, error: 'No data' }, 400);

    const amount = Number(body.amount) || 0;
    if (!amount || amount <= 0) {
      return json({ success: false, error: 'Kiasi kinahitajika' }, 400);
    }

    const id = `cash-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const name = String(body.name || '').trim();
    const createdBy = String(body.createdBy || 'admin');

    await env.DB.prepare(
      `INSERT INTO cashier_entries (id, name, amount, status, created_by)
       VALUES (?, ?, ?, 'Pending', ?)`
    ).bind(id, name, amount, createdBy).run();

    const row: any = await env.DB.prepare(
      'SELECT * FROM cashier_entries WHERE id = ?'
    ).bind(id).first();

    return json({ success: true, entry: rowToEntry(row) }, 201);
  } catch (error: any) {
    console.error('Cashier POST error:', error);
    return json({ success: false, error: error?.message || 'Failed to create' }, 500);
  }
};
