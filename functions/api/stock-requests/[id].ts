// functions/api/stock-requests/[id].ts
import type { PagesFunction } from '@cloudflare/workers-types';

type Env = {
  DB: D1Database;
};

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

// PUT - Update status
export const onRequestPut: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const itemId = parts[parts.length - 1];
    
    const body = await request.json().catch(() => null);
    
    if (!itemId || !body) {
      return json({ success: false, error: 'Missing required fields' }, 400);
    }

    const { status } = body;

    if (!status || !['Pending', 'Completed'].includes(status)) {
      return json({ success: false, error: 'Invalid status' }, 400);
    }

    const completedAt = status === 'Completed' ? new Date().toISOString() : null;

    await env.DB.prepare(`
      UPDATE stock_items 
      SET status = ?, completed_at = ?
      WHERE id = ?
    `).bind(status, completedAt, itemId).run();

    return json({
      success: true,
      message: status === 'Completed' ? 'Imewekwa kama imefanyika' : 'Imerejeshwa'
    });
  } catch (error: any) {
    console.error('Failed to update status:', error);
    return json({ success: false, error: error?.message }, 500);
  }
};

// DELETE - Delete item
export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const itemId = parts[parts.length - 1];

    if (!itemId) {
      return json({ success: false, error: 'Item ID required' }, 400);
    }

    await env.DB.prepare(
      `DELETE FROM stock_items WHERE id = ?`
    ).bind(itemId).run();

    return json({ success: true, message: 'Bidhaa imefutwa' });
  } catch (error: any) {
    console.error('Failed to delete item:', error);
    return json({ success: false, error: error?.message }, 500);
  }
};
