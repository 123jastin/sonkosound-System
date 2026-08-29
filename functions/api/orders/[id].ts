// functions/api/orders/[id].ts
import type { PagesFunction } from '@cloudflare/workers-types';

type Env = {
  DB: D1Database;
};

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

// PUT: Update order
export const onRequestPut: PagesFunction<Env> = async ({ request, env, params }) => {
  try {
    const orderId = params.id;
    const body = await request.json();
    
    console.log('✏️ Update order:', orderId, body);

    const { customerId, items, notes } = body;

    if (!customerId || !items || !Array.isArray(items)) {
      return json({ success: false, error: 'Missing required fields' }, 400);
    }

    // Get customer info
    const customer = await env.DB.prepare(`
      SELECT id, full_name, phone_number FROM order_customers WHERE id = ?
    `).bind(customerId).first();

    if (!customer) {
      return json({ success: false, error: 'Customer not found' }, 404);
    }

    // Calculate total
    const totalAmount = items.reduce((sum: number, item: any) => sum + (Number(item.total_price) || 0), 0);

    // Update order
    await env.DB.prepare(`
      UPDATE orders 
      SET customer_id = ?, items = ?, total_amount = ?, notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(
      customerId,
      JSON.stringify(items),
      totalAmount,
      notes || '',
      orderId
    ).run();

    // Get updated order
    const updatedOrder = await env.DB.prepare(`
      SELECT * FROM orders WHERE id = ?
    `).bind(orderId).first();

    return json({
      success: true,
      order: {
        ...updatedOrder,
        items: JSON.parse(updatedOrder.items || '[]'),
        customer_name: customer.full_name,
        customer_phone: customer.phone_number,
      },
    });
  } catch (error: any) {
    console.error('Update error:', error);
    return json({ success: false, error: error?.message }, 500);
  }
};

// DELETE: Delete order
export const onRequestDelete: PagesFunction<Env> = async ({ env, params }) => {
  try {
    const orderId = params.id;
    console.log('🗑️ Delete order:', orderId);

    await env.DB.prepare(`
      DELETE FROM orders WHERE id = ?
    `).bind(orderId).run();

    return json({ success: true, message: 'Order deleted' });
  } catch (error: any) {
    console.error('Delete error:', error);
    return json({ success: false, error: error?.message }, 500);
  }
};
