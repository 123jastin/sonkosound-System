// functions/api/stock-requests/workers.ts
import type { PagesFunction } from '@cloudflare/workers-types';

type Env = {
  DB: D1Database;
};

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

// POST - Add new worker
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await request.json().catch(() => null);
    
    if (!body) {
      return json({ success: false, error: 'No data provided' }, 400);
    }

    const { name, phone, photo } = body;

    if (!name) {
      return json({ success: false, error: 'Jina linahitajika' }, 400);
    }

    // Check if name already exists
    const existing = await env.DB.prepare(
      `SELECT id FROM stock_workers WHERE LOWER(name) = LOWER(?) LIMIT 1`
    ).bind(name.trim()).first();

    if (existing) {
      return json({ success: false, error: 'Jina hili tayari lipo. Chagua jina lingine.' }, 400);
    }

    const workerId = 'worker-' + Date.now();

    await env.DB.prepare(`
      INSERT INTO stock_workers (id, name, phone, photo, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).bind(workerId, name.trim(), phone || '', photo || '').run();

    const worker = await env.DB.prepare(
      `SELECT id, name, phone, photo, created_at FROM stock_workers WHERE id = ? LIMIT 1`
    ).bind(workerId).first();

    return json({
      success: true,
      worker,
      message: 'Jina limesajiliwa'
    });
  } catch (error: any) {
    console.error('Failed to add worker:', error);
    return json({ success: false, error: error?.message }, 500);
  }
};
