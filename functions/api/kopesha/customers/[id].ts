// functions/api/kopesha/customers/[id].ts
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

export const onRequestPut: PagesFunction<Env> = async ({ params, request, env }) => {
  try {
    const id = String(params.id || '');
    if (!id) return json({ error: 'Customer ID required' }, 400);

    const body: any = await request.json().catch(() => null);
    if (!body) return json({ error: 'No data' }, 400);

    const fullName = String(body.fullName || '').trim();
    const phoneNumber = String(body.phoneNumber || '').trim();
    const address = String(body.address || '').trim();
    const notes = String(body.notes || '').trim();

    if (!fullName) return json({ error: 'Jina linahitajika' }, 400);
    if (!phoneNumber) return json({ error: 'Namba ya simu inahitajika' }, 400);

    await env.DB.prepare(
      `UPDATE kopesha_customers
         SET full_name = ?, phone_number = ?, address = ?, notes = ?,
             updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(fullName, phoneNumber, address, notes, id).run();

    return json({ success: true });
  } catch (error: any) {
    return json({ error: error?.message || 'Failed to update customer' }, 500);
  }
};

export const onRequestDelete: PagesFunction<Env> = async ({ params, env }) => {
  try {
    const id = String(params.id || '');
    if (!id) return json({ error: 'Customer ID required' }, 400);

    // Get loan IDs
    const loanIdsRes = await env.DB
      .prepare('SELECT id FROM kopesha_loans WHERE customer_id = ?')
      .bind(id).all();
    const loanIds = (loanIdsRes.results || []).map((r: any) => r.id);

    // Get payment IDs
    let paymentIds: string[] = [];
    if (loanIds.length > 0) {
      const placeholders = loanIds.map(() => '?').join(',');
      const payRes = await env.DB
        .prepare(`SELECT id FROM kopesha_payments WHERE loan_id IN (${placeholders})`)
        .bind(...loanIds).all();
      paymentIds = (payRes.results || []).map((r: any) => r.id);
    }

    // ✅ Cleanup kubandika rows linked to these loans/payments
    if (loanIds.length > 0) {
      const lp = loanIds.map(() => '?').join(',');
      await env.DB
        .prepare(`DELETE FROM kubandika_payments WHERE ref_id IN (${lp})`)
        .bind(...loanIds).run();
    }
    if (paymentIds.length > 0) {
      const pp = paymentIds.map(() => '?').join(',');
      await env.DB
        .prepare(`DELETE FROM kubandika_payments WHERE ref_id IN (${pp})`)
        .bind(...paymentIds).run();
    }

    // Delete Kopesha data
    if (loanIds.length > 0) {
      const placeholders = loanIds.map(() => '?').join(',');
      await env.DB
        .prepare(`DELETE FROM kopesha_payments WHERE loan_id IN (${placeholders})`)
        .bind(...loanIds).run();
      await env.DB
        .prepare('DELETE FROM kopesha_loans WHERE customer_id = ?')
        .bind(id).run();
    }

    await env.DB.prepare('DELETE FROM kopesha_customers WHERE id = ?').bind(id).run();

    return json({ success: true });
  } catch (error: any) {
    console.error('Kopesha delete customer error:', error);
    return json({ error: error?.message || 'Failed to delete customer' }, 500);
  }
};
