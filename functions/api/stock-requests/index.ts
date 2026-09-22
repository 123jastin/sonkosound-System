// functions/api/stock-requests/index.ts
import type { PagesFunction } from '@cloudflare/workers-types';

type Env = {
  DB: D1Database;
};

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

// GET - List all workers and items
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const workersResult = await env.DB.prepare(`
      SELECT id, name, phone, created_at
      FROM stock_workers
      ORDER BY datetime(created_at) DESC, rowid DESC
    `).all();

    const itemsResult = await env.DB.prepare(`
      SELECT id, worker_id, worker_name, product_name, quantity, notes, status, created_at, completed_at
      FROM stock_items
      ORDER BY datetime(created_at) DESC, rowid DESC
    `).all();

    return json({
      success: true,
      workers: workersResult.results || [],
      items: itemsResult.results || []
    });
  } catch (error: any) {
    console.error('Failed to load stock requests:', error);
    return json({ success: false, error: error?.message }, 500);
  }
};

// POST - Add new stock item
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await request.json().catch(() => null);
    
    if (!body) {
      return json({ success: false, error: 'No data provided' }, 400);
    }

    const { workerId, workerName, productName, quantity, notes } = body;

    if (!workerId || !productName) {
      return json({ success: false, error: 'Missing required fields' }, 400);
    }

    const itemId = 'item-' + Date.now();

    await env.DB.prepare(`
      INSERT INTO stock_items (id, worker_id, worker_name, product_name, quantity, notes, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'Pending', datetime('now'))
    `).bind(
      itemId,
      workerId,
      workerName || '',
      productName,
      quantity || '',
      notes || ''
    ).run();

    const item = await env.DB.prepare(
      `SELECT id, worker_id, worker_name, product_name, quantity, notes, status, created_at
       FROM stock_items WHERE id = ? LIMIT 1`
    ).bind(itemId).first();

    return json({
      success: true,
      item,
      message: 'Bidhaa imeongezwa'
    });
  } catch (error: any) {
    console.error('Failed to add stock item:', error);
    return json({ success: false, error: error?.message }, 500);
  }
};
