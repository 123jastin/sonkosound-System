// functions/api/cashier/[id].ts
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

export const onRequestPut: PagesFunction<Env> = async ({ params, request, env }) => {
  try {
    const id = String(params.id || '');
    if (!id) return json({ success: false, error: 'ID required' }, 400);

    const body: any = await request.json().catch(() => null);
    if (!body) return json({ success: false, error: 'No data' }, 400);

    const existing: any = await env.DB.prepare(
      'SELECT * FROM cashier_entries WHERE id = ?'
    ).bind(id).first();
    if (!existing) return json({ success: false, error: 'Haipatikani' }, 404);

    const name = body.name !== undefined ? String(body.name || '').trim() : existing.name;
    const taarifa = body.taarifa !== undefined ? String(body.taarifa || '').trim() : existing.taarifa;
    const status = body.status !== undefined ? String(body.status || 'Pending') : existing.status;
    const approvedBy = body.approvedBy !== undefined ? String(body.approvedBy || '') : existing.approved_by;

    await env.DB.prepare(
      `UPDATE cashier_entries
         SET name = ?, taarifa = ?, status = ?, approved_by = ?,
             approved_at = CASE WHEN ? = 'Completed' THEN datetime('now') ELSE approved_at END,
             updated_at = datetime('now')
       WHERE id = ?`
    ).bind(name, taarifa, status, approvedBy, status, id).run();

    const updated: any = await env.DB.prepare(
      'SELECT * FROM cashier_entries WHERE id = ?'
    ).bind(id).first();

    return json({ success: true, entry: rowToEntry(updated) });
  } catch (error: any) {
    console.error('Cashier PUT error:', error);
    return json({ success: false, error: error?.message || 'Failed to update' }, 500);
  }
};

export const onRequestDelete: PagesFunction<Env> = async ({ params, env }) => {
  try {
    const id = String(params.id || '');
    if (!id) return json({ success: false, error: 'ID required' }, 400);
    await env.DB.prepare('DELETE FROM cashier_entries WHERE id = ?').bind(id).run();
    return json({ success: true });
  } catch (error: any) {
    return json({ success: false, error: error?.message || 'Failed to delete' }, 500);
  }
};
