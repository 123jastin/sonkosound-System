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
      .prepare('SELECT id, full_name FROM kopesha_customers WHERE id = ?')
      .bind(customerId).first();
    if (!customer) return json({ error: 'Mkopaji haipatikani' }, 404);

    // ✅ Check China balance has enough
    const inRow: any = await env.DB.prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM kubandika_payments
       WHERE region = 'China' AND (type = 'IN' OR type IS NULL)`
    ).first();
    const outRow: any = await env.DB.prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM kubandika_payments
       WHERE region = 'China' AND type = 'OUT'`
    ).first();

    const chinaBalance = Number(inRow?.total || 0) - Number(outRow?.total || 0);
    if (amount > chinaBalance) {
      return json({
        error: `Salio la China halitoshi. Lililopo: TSh ${chinaBalance.toLocaleString()}, unahitaji: TSh ${amount.toLocaleString()}`
      }, 400);
    }

    const loanId = `kloan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const kubId = `kub-kopesha-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // ✅ 1. Insert loan
    await env.DB.prepare(
      `INSERT INTO kopesha_loans
         (id, customer_id, amount, paid_amount, lend_date, return_date, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(loanId, customerId, amount, paidAmount, lendDate, returnDate, status, notes).run();

    // ✅ 2. Auto-insert kubandika OUT (China) with ref_id = loanId
    await env.DB.prepare(
      `INSERT INTO kubandika_payments
         (id, region, type, amount, date, method, received_from, notes, ref_id, created_at, updated_at)
       VALUES (?, 'China', 'OUT', ?, ?, 'Kopesha', ?, ?, ?, datetime('now'), datetime('now'))`
    ).bind(
      kubId,
      amount,
      lendDate,
      customer.full_name,
      `Kopesha: mkopo kwa ${customer.full_name} - TSh ${amount.toLocaleString()}`,
      loanId
    ).run();

    const loan: any = await env.DB
      .prepare('SELECT * FROM kopesha_loans WHERE id = ?')
      .bind(loanId).first();

    return json({ success: true, loan });
  } catch (error: any) {
    console.error('Kopesha create loan error:', error);
    return json({ error: error?.message || 'Failed to create loan' }, 500);
  }
};
