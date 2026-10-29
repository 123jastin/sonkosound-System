// functions/api/malipo/jobs/index.ts
import type { PagesFunction } from '@cloudflare/workers-types';

type Env = { DB: D1Database };

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

const genId = (p: string) =>
  `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const todayISO = () => new Date().toISOString().slice(0, 10);

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body: any = await request.json().catch(() => null);
    const {
      workerId, jobName, amount, paidAmount = 0,
      startDate, dueDate, status = 'Active', notes = '',
    } = body || {};

    const amt = Number(amount);
    if (!workerId || !jobName?.trim() || !(amt > 0)) {
      return json({ error: 'Taarifa za kazi si sahihi' }, 400);
    }

    const w = await env.DB.prepare(`SELECT id FROM malipo_workers WHERE id = ?`).bind(workerId).first();
    if (!w) return json({ error: 'Mfanyakazi hapatikani' }, 404);

    const id = genId('mjob');
    await env.DB
      .prepare(
        `INSERT INTO malipo_jobs
          (id, worker_id, job_name, amount, paid_amount, start_date, due_date, status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, workerId, jobName.trim(), amt, Number(paidAmount) || 0,
            startDate || todayISO(), dueDate || '', status, notes)
      .run();

    const job = await env.DB.prepare(`SELECT * FROM malipo_jobs WHERE id = ?`).bind(id).first();
    return json({ job });
  } catch (err: any) {
    console.error('POST /api/malipo/jobs', err);
    return json({ error: 'Imeshindwa kuongeza kazi' }, 500);
  }
};
