// functions/api/malipo/workers/[id].ts
import type { PagesFunction } from '@cloudflare/workers-types';

type Env = { DB: D1Database };

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

export const onRequestPut: PagesFunction<Env> = async ({ request, env, params }) => {
  const id = params.id as string;
  try {
    const body: any = await request.json().catch(() => null);
    const { fullName, phoneNumber, address = '', businessName = '', notes = '' } = body || {};

    if (!fullName?.trim() || !phoneNumber?.trim()) {
      return json({ error: 'Jina na simu vinahitajika' }, 400);
    }

    await env.DB
      .prepare(
        `UPDATE malipo_workers
         SET full_name = ?, phone_number = ?, address = ?, business_name = ?, notes = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .bind(fullName.trim(), phoneNumber.trim(), address, businessName, notes, id)
      .run();

    const worker = await env.DB
      .prepare(`SELECT * FROM malipo_workers WHERE id = ?`)
      .bind(id)
      .first();

    if (!worker) return json({ error: 'Mfanyakazi hapatikani' }, 404);
    return json({ worker });
  } catch (err: any) {
    console.error('PUT /api/malipo/workers/:id', err);
    return json({ error: 'Imeshindwa kuhariri mfanyakazi' }, 500);
  }
};

export const onRequestDelete: PagesFunction<Env> = async ({ env, params }) => {
  const id = params.id as string;
  try {
    // D1 does not enforce FK CASCADE by default — delete children first
    const jobRows = await env.DB
      .prepare(`SELECT id FROM malipo_jobs WHERE worker_id = ?`)
      .bind(id)
      .all();

    const jobIds = (jobRows.results || []).map((r: any) => r.id);
    for (const jobId of jobIds) {
      await env.DB.prepare(`DELETE FROM malipo_payments WHERE job_id = ?`).bind(jobId).run();
    }
    await env.DB.prepare(`DELETE FROM malipo_jobs WHERE worker_id = ?`).bind(id).run();
    await env.DB.prepare(`DELETE FROM malipo_workers WHERE id = ?`).bind(id).run();

    return json({ success: true });
  } catch (err: any) {
    console.error('DELETE /api/malipo/workers/:id', err);
    return json({ error: 'Imeshindwa kufuta mfanyakazi' }, 500);
  }
};
