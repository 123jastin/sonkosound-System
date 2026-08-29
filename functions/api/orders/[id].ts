// functions/api/orders/[id].ts
import type { PagesFunction } from '@cloudflare/workers-types';

type Env = {
  DB: D1Database;
};

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const orderId = url.pathname.split('/').pop();

    if (!orderId) {
      return json({ success: false, error: 'Order ID required' }, 400);
    }

    // Delete order items first
    await env.DB.prepare(
      `DELETE FROM order_items WHERE order_id = ?`
    ).bind(orderId).run();

    // Delete order
    await env.DB.prepare(
      `DELETE FROM orders WHERE id = ?`
    ).bind(orderId).run();

    return json({ success: true, message: 'Oda imefutwa' });
  } catch (error: any) {
    console.error('Failed to delete order:', error);
    return json({ success: false, error: error?.message }, 500);
  }
};
