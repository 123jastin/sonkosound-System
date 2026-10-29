// functions/api/malipo/payments/index.ts
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
    const { jobId, amount, paymentDate, paymentMethod = 'Cash', notes = '' } = body || {};
    const amt = Number(amount);

    if (!jobId || !(amt > 0)) {
      return json({ error: 'Taarifa za malipo si sahihi' }, 400);
    }

    // Read job (D1 doesn't have FOR UPDATE — this is fine for single-writer
    // scenarios; if you need locking, use a Durable Object or check race separately)
    const job = await env.DB
      .prepare(`SELECT amount, paid_amount FROM malipo_jobs WHERE id = ?`)
      .bind(jobId)
      .first<{ amount: number; paid_amount: number }>();

    if (!job) return json({ error: 'Kazi hapatikani' }, 404);

    const jobAmount = Number(job.amount);
    const paidBefore = Number(job.paid_amount);
    const remaining = Math.max(0, jobAmount - paidBefore);

    if (amt > remaining) {
      return json({ error: `Kiasi kinazidi baki (TSh ${remaining.toLocaleString()})` }, 400);
    }

    const payId = genId('mpay');
    const paidAfter = paidBefore + amt;
    const newStatus = paidAfter >= jobAmount ? 'Cleared' : 'Active';

    // D1 supports batch() — atomic sequential execution
    await env.DB.batch([
      env.DB
        .prepare(
          `INSERT INTO malipo_payments
            (id, job_id, amount, payment_date, payment_method, notes)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(payId, jobId, amt, paymentDate || todayISO(), paymentMethod, notes),
      env.DB
        .prepare(
          `UPDATE malipo_jobs
           SET paid_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        )
        .bind(paidAfter, newStatus, jobId),
    ]);

    const payment = await env.DB.prepare(`SELECT * FROM malipo_payments WHERE id = ?`).bind(payId).first();
    const updatedJob = await env.DB.prepare(`SELECT * FROM malipo_jobs WHERE id = ?`).bind(jobId).first();

    return json({ payment, job: updatedJob });
  } catch (err: any) {
    console.error('POST /api/malipo/payments', err);
    return json({ error: 'Imeshindwa kurekodi malipo' }, 500);
  }
};
