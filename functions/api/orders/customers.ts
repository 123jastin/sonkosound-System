// functions/api/orders/customers.ts
import type { PagesFunction } from '@cloudflare/workers-types';

type Env = {
  DB: D1Database;
};

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
    const body = await request.json().catch(() => null);
    
    if (!body) {
      return json({ success: false, error: 'No data provided' }, 400);
    }

    const { fullName, phoneNumber, address } = body;

    if (!fullName || !phoneNumber) {
      return json({ success: false, error: 'Missing required fields' }, 400);
    }

    const customerId = 'ocust-' + Date.now();

    await env.DB.prepare(`
      INSERT INTO order_customers (id, full_name, phone_number, address, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).bind(customerId, fullName, phoneNumber, address || '').run();

    const customer = await env.DB.prepare(
      `SELECT id, full_name, phone_number, address, created_at FROM order_customers WHERE id = ? LIMIT 1`
    ).bind(customerId).first();

    return json({
      success: true,
      customer,
      message: 'Mteja amesajiliwa kikamilifu'
    });
  } catch (error: any) {
    console.error('Failed to add customer:', error);
    return json({ success: false, error: error?.message }, 500);
  }
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const customerId = url.pathname.split('/').pop();

    if (!customerId) {
      return json({ success: false, error: 'Customer ID required' }, 400);
    }

    // Delete all orders and items for this customer
    const orders = await env.DB.prepare(
      `SELECT id FROM orders WHERE customer_id = ?`
    ).bind(customerId).all();

    if (orders.results && Array.isArray(orders.results)) {
      for (const order of orders.results) {
        await env.DB.prepare(
          `DELETE FROM order_items WHERE order_id = ?`
        ).bind((order as any).id).run();
      }
    }

    await env.DB.prepare(
      `DELETE FROM orders WHERE customer_id = ?`
    ).bind(customerId).run();

    await env.DB.prepare(
      `DELETE FROM order_customers WHERE id = ?`
    ).bind(customerId).run();

    return json({ success: true, message: 'Mteja amefutwa' });
  } catch (error: any) {
    console.error('Failed to delete customer:', error);
    return json({ success: false, error: error?.message }, 500);
  }
};
