// functions/api/orders/customers/[id].ts
import type { PagesFunction } from '@cloudflare/workers-types';

type Env = {
  DB: D1Database;
};

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

// DELETE: Delete customer and related orders
export const onRequestDelete: PagesFunction<Env> = async ({ env, params }) => {
  try {
    const customerId = params.id;
    console.log('🗑️ Delete customer:', customerId);

    // Delete related orders first
    await env.DB.prepare(`
      DELETE FROM orders WHERE customer_id = ?
    `).bind(customerId).run();

    // Delete customer
    await env.DB.prepare(`
      DELETE FROM order_customers WHERE id = ?
    `).bind(customerId).run();

    return json({ success: true, message: 'Customer deleted' });
  } catch (error: any) {
    console.error('Delete customer error:', error);
    return json({ success: false, error: error?.message }, 500);
  }
};

// PUT: Update customer
export const onRequestPut: PagesFunction<Env> = async ({ request, env, params }) => {
  try {
    const customerId = params.id;
    const body = await request.json();
    const { fullName, phoneNumber, address } = body;

    await env.DB.prepare(`
      UPDATE order_customers 
      SET full_name = ?, phone_number = ?, address = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(fullName, phoneNumber, address || '', customerId).run();

    const customer = await env.DB.prepare(`
      SELECT * FROM order_customers WHERE id = ?
    `).bind(customerId).first();

    return json({ success: true, customer });
  } catch (error: any) {
    return json({ success: false, error: error?.message }, 500);
  }
};
