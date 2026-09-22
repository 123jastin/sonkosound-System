// functions/api/stock-requests/workers/[id].ts
import type { PagesFunction } from '@cloudflare/workers-types';

type Env = {
  DB: D1Database;
};

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

// GET - Single worker
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const workerId = parts[parts.length - 1];

    if (!workerId) {
      return json({ success: false, error: 'Worker ID required' }, 400);
    }

    const worker = await env.DB.prepare(
      `SELECT id, name, phone, photo, created_at FROM stock_workers WHERE id = ? LIMIT 1`
    ).bind(workerId).first();

    if (!worker) {
      return json({ success: false, error: 'Mfanyakazi hakupatikana' }, 404);
    }

    return json({ success: true, worker });
  } catch (error: any) {
    return json({ success: false, error: error?.message }, 500);
  }
};

// PUT - Update worker profile (name, phone, photo)
export const onRequestPut: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const workerId = parts[parts.length - 1];

    if (!workerId) {
      return json({ success: false, error: 'Worker ID required' }, 400);
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return json({ success: false, error: 'No data provided' }, 400);
    }

    const { name, phone, photo } = body;

    if (!name || !name.trim()) {
      return json({ success: false, error: 'Jina linahitajika' }, 400);
    }

    // Check if new name conflicts with another worker
    const existing = await env.DB.prepare(
      `SELECT id FROM stock_workers WHERE LOWER(name) = LOWER(?) AND id != ? LIMIT 1`
    ).bind(name.trim(), workerId).first();

    if (existing) {
      return json({ success: false, error: 'Jina hili tayari lipo kwa mfanyakazi mwingine' }, 400);
    }

    // Update worker
    await env.DB.prepare(`
      UPDATE stock_workers 
      SET name = ?, phone = ?, photo = ?
      WHERE id = ?
    `).bind(
      name.trim(), 
      phone || '', 
      photo || '', 
      workerId
    ).run();

    // Also update worker_name in all their items
    await env.DB.prepare(`
      UPDATE stock_items 
      SET worker_name = ?
      WHERE worker_id = ?
    `).bind(name.trim(), workerId).run();

    const worker = await env.DB.prepare(
      `SELECT id, name, phone, photo, created_at FROM stock_workers WHERE id = ? LIMIT 1`
    ).bind(workerId).first();

    return json({
      success: true,
      worker,
      message: 'Wasifu umehifadhiwa'
    });
  } catch (error: any) {
    console.error('Failed to update worker:', error);
    return json({ success: false, error: error?.message }, 500);
  }
};

// DELETE - Delete worker + all items
export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const workerId = parts[parts.length - 1];

    if (!workerId) {
      return json({ success: false, error: 'Worker ID required' }, 400);
    }

    const worker = await env.DB.prepare(
      `SELECT id, name FROM stock_workers WHERE id = ? LIMIT 1`
    ).bind(workerId).first();

    if (!worker) {
      return json({ success: false, error: 'Mfanyakazi hakupatikana' }, 404);
    }

    // Delete items first
    const deleteItemsResult = await env.DB.prepare(
      `DELETE FROM stock_items WHERE worker_id = ?`
    ).bind(workerId).run();

    // Delete worker
    await env.DB.prepare(
      `DELETE FROM stock_workers WHERE id = ?`
    ).bind(workerId).run();

    return json({
      success: true,
      message: 'Mfanyakazi amefutwa kikamilifu',
      deletedItems: deleteItemsResult.meta?.changes || 0
    });
  } catch (error: any) {
    console.error('Failed to delete worker:', error);
    return json({ success: false, error: error?.message }, 500);
  }
};
