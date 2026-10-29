// functions/api/malipo/index.ts
import type { PagesFunction } from '@cloudflare/workers-types';

type Env = { DB: D1Database };

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const [workers, jobs, payments] = await Promise.all([
      env.DB.prepare(`SELECT * FROM malipo_workers ORDER BY created_at DESC`).all(),
      env.DB.prepare(`SELECT * FROM malipo_jobs ORDER BY created_at DESC`).all(),
      env.DB.prepare(`SELECT * FROM malipo_payments ORDER BY payment_date DESC`).all(),
    ]);
    return json({
      workers: workers.results || [],
      jobs: jobs.results || [],
      payments: payments.results || [],
    });
  } catch (err: any) {
    console.error('GET /api/malipo', err);
    return json({ error: 'Failed to load malipo data' }, 500);
  }
};
