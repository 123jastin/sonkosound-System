// functions/api/kopesha/payments/index.ts
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

    const loanId = String(body.loanId || '').trim();
    const amount = Number(body.amount) || 0;
    const paymentDate = String(body.paymentDate || '').trim();
    const paymentMethod = String(body.paymentMethod || 'Cash').trim();
    const notes = String(body.notes || '').trim();

    if (!loanId) return json({ error: 'Mkopo unahitajika' }, 400);
    if (!amount || amount <= 0) return json({ error: 'Kiasi si sahihi' }, 400);
    if (!paymentDate) return json({ error: 'Tarehe ya malipo inahitajika' }, 400);

    // Load loan
    const loan: any = await env.DB
      .prepare('SELECT * FROM kopesha_loans WHERE id = ?')
      .bind(loanId).first();
    if (!loan) return json({ error: 'Mkopo haipatikani' }, 404);

    const totalAmount = Number(loan.amount) || 0;
    const currentPaid = Number(loan.paid_amount) || 0;
    const remaining = Math.max(0, totalAmount - currentPaid);

    if (amount > remaining) {
      return json({ error: `Kiasi kinazidi baki (TSh ${remaining.toLocaleString()})` }, 400);
    }

    const paymentId = `kpay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // Insert payment
    await env.DB.prepare(
      `INSERT INTO kopesha_payments
         (id, loan_id, amount, payment_date, payment_method, notes)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(paymentId, loanId, amount, paymentDate, paymentMethod, notes).run();

    // Update loan totals + status
    const newPaid = currentPaid + amount;
    const newStatus = newPaid >= totalAmount ? 'Cleared' : 'Active';

    await env.DB.prepare(
      `UPDATE kopesha_loans
         SET paid_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(newPaid, newStatus, loanId).run();

    const payment: any = await env.DB
      .prepare('SELECT * FROM kopesha_payments WHERE id = ?')
      .bind(paymentId).first();

    const updatedLoan: any = await env.DB
      .prepare('SELECT * FROM kopesha_loans WHERE id = ?')
      .bind(loanId).first();

    return json({
      success: true,
      payment,
      loan: updatedLoan,
      remaining: Math.max(0, totalAmount - newPaid),
      isCompleted: newStatus === 'Cleared',
    });
  } catch (error: any) {
    console.error('Kopesha create payment error:', error);
    return json({ error: error?.message || 'Failed to create payment' }, 500);
  }
};
