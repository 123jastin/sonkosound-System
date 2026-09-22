// functions/api/stock-requests/workers/[id].ts
import type { PagesFunction } from '@cloudflare/workers-types';

type Env = {
  DB: D1Database;
};

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

// DELETE /api/stock-requests/workers/:id
export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const workerId = parts[parts.length - 1];

    console.log('🗑️ Delete worker request for ID:', workerId);

    if (!workerId) {
      return json({ success: false, error: 'Worker ID required' }, 400);
    }

    // Verify worker exists
    const worker = await env.DB.prepare(
      `SELECT id, name FROM stock_workers WHERE id = ? LIMIT 1`
    ).bind(workerId).first();

    if (!worker) {
      return json({ success: false, error: 'Mfanyakazi hakupatikana' }, 404);
    }

    console.log('🗑️ Deleting worker:', (worker as any).name);

    // Delete all items belonging to this worker first
    const deleteItemsResult = await env.DB.prepare(
      `DELETE FROM stock_items WHERE worker_id = ?`
    ).bind(workerId).run();

    console.log('🗑️ Deleted items:', deleteItemsResult.meta?.changes || 0);

    // Delete the worker
    await env.DB.prepare(
      `DELETE FROM stock_workers WHERE id = ?`
    ).bind(workerId).run();

    console.log('✅ Worker deleted successfully');

    return json({
      success: true,
      message: 'Mfanyakazi amefutwa kikamilifu',
      deletedItems: deleteItemsResult.meta?.changes || 0
    });
  } catch (error: any) {
    console.error('❌ Failed to delete worker:', error);
    return json({ success: false, error: error?.message }, 500);
  }
};
