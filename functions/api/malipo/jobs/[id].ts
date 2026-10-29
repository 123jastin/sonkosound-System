// functions/api/malipo/jobs/[id].ts
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
    const { jobName, amount, startDate, dueDate, notes = '' } = body || {};
    const amt = Number(amount);

    if (!jobName?.trim() || !(amt > 0)) {
      return json({ error: 'Taarifa za kazi si sahihi' }, 400);
    }

    const existing = await env.DB
      .prepare(`SELECT paid_amount FROM malipo_jobs WHERE id = ?`)
      .bind(id)
      .first<{ paid_amount: number }>();

    if (!existing) return json({ error: 'Kazi hapatikani' }, 404);

    const paid = Number(existing.paid_amount);
    if (amt < paid) {
      return json(
        { error: `Kiasi hakiwezi kuwa chini ya malipo yaliyofanywa (TSh ${paid.toLocaleString()})` },
        400
      );
    }

    const newStatus = amt <= paid ? 'Cleared' : 'Active';

    await env.DB
      .prepare(
        `UPDATE malipo_jobs
         SET job_name = ?, amount = ?, start_date = ?, due_date = ?, notes = ?, status = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      )
      .bind(jobName.trim(), amt, startDate || '', dueDate || '', notes, newStatus, id)
      .run();

    const job = await env.DB.prepare(`SELECT * FROM malipo_jobs WHERE id = ?`).bind(id).first();
    return json({ job });
  } catch (err: any) {
    console.error('PUT /api/malipo/jobs/:id', err);
    return json({ error: 'Imeshindwa kuhariri kazi' }, 500);
  }
};

export const onRequestDelete: PagesFunction<Env> = async ({ env, params }) => {
  const id = params.id as string;
  try {
    await env.DB.prepare(`DELETE FROM malipo_payments WHERE job_id = ?`).bind(id).run();
    await env.DB.prepare(`DELETE FROM malipo_jobs WHERE id = ?`).bind(id).run();
    return json({ success: true });
  } catch (err: any) {
    console.error('DELETE /api/malipo/jobs/:id', err);
    return json({ error: 'Imeshindwa kufuta kazi' }, 500);
  }
};
