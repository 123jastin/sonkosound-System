// functions/api/kopesha/loans/index.ts
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

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body: any = await request.json().catch(() => null);
    if (!body) return json({ error: 'No data' }, 400);

    const customerId = String(body.customerId || '').trim();
    const amount = Number(body.amount) || 0;
    const paidAmount = Number(body.paidAmount) || 0;
    const lendDate = String(body.lendDate || '').trim();
    const returnDate = String(body.returnDate || '').trim();
    const status = String(body.status || 'Active');
    const notes = String(body.notes || '').trim();

    if (!customerId) return json({ error: 'Mkopaji anahitajika' }, 400);
    if (!amount || amount <= 0) return json({ error: 'Kiasi si sahihi' }, 400);
    if (!lendDate) return json({ error: 'Tarehe ya kukopesha inahitajika' }, 400);
    if (!returnDate) return json({ error: 'Tarehe ya kurejesha inahitajika' }, 400);

    // Verify customer exists
    const customer: any = await env.DB
      .prepare('SELECT id FROM kopesha_customers WHERE id = ?')
      .bind(customerId).first();
    if (!customer) return json({ error: 'Mkopaji haipatikani' }, 404);

    const id = `kloan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    await env.DB.prepare(
      `INSERT INTO kopesha_loans
         (id, customer_id, amount, paid_amount, lend_date, return_date, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, customerId, amount, paidAmount, lendDate, returnDate, status, notes).run();

    const loan: any = await env.DB
      .prepare('SELECT * FROM kopesha_loans WHERE id = ?')
      .bind(id).first();

    return json({ success: true, loan });
  } catch (error: any) {
    console.error('Kopesha create loan error:', error);
    return json({ error: error?.message || 'Failed to create loan' }, 500);
  }
};
