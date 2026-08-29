// functions/api/orders/complete/[id].ts
import type { PagesFunction } from '@cloudflare/workers-types';

type Env = {
  DB: D1Database;
};

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

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    const orderId = parts[parts.length - 1];

    console.log('📦 Complete order request for ID:', orderId);

    if (!orderId) {
      return json({ success: false, error: 'Order ID required' }, 400);
    }

    const body = await request.json().catch(() => null);
    console.log('📦 Shipping info received:', JSON.stringify(body));

    if (!body) {
      return json({ success: false, error: 'No data provided' }, 400);
    }

    const shippingInfo = {
      method: body.method || 'BodaBoda',
      bodaName: body.bodaName || '',
      bodaPhone: body.bodaPhone || '',
      bodaPlateNumber: body.bodaPlateNumber || '',
      busName: body.busName || '',
      busNumber: body.busNumber || '',
      driverName: body.driverName || '',
      driverPhone: body.driverPhone || ''
    };

    const shippingDetails = JSON.stringify(shippingInfo);

    console.log('📦 Saving shipping details:', shippingDetails);

    // Update order with shipping info and mark as completed
    await env.DB.prepare(`
      UPDATE orders 
      SET status = 'Completed', 
          shipping_method = ?, 
          shipping_details = ?, 
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(shippingInfo.method, shippingDetails, orderId).run();

    // Fetch updated order
    const order = await env.DB.prepare(
      `SELECT id, customer_id, customer_name, customer_phone, total_amount, status, notes, 
              shipping_method, shipping_details, created_at, updated_at
       FROM orders WHERE id = ? LIMIT 1`
    ).bind(orderId).first();

    if (!order) {
      return json({ success: false, error: 'Order not found' }, 404);
    }

    console.log('📦 Order completed successfully:', order);

    return json({
      success: true,
      order: {
        ...(order as any),
        shipping_info: shippingInfo
      },
      message: 'Oda imekamilika kikamilifu'
    });
  } catch (error: any) {
    console.error('Failed to complete order:', error);
    return json({ success: false, error: error?.message }, 500);
  }
};
