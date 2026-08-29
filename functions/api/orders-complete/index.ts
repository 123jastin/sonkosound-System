// functions/api/orders-complete/index.ts
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
    const body = await request.json().catch(() => null);
    
    console.log('📦 Complete order request:', JSON.stringify(body));

    if (!body) {
      return json({ success: false, error: 'No data provided' }, 400);
    }

    const { orderId, method, bodaName, bodaPhone, bodaPlateNumber, busName, busNumber, driverName, driverPhone } = body;

    if (!orderId) {
      return json({ success: false, error: 'Order ID required' }, 400);
    }

    const shippingInfo = {
      method: method || 'BodaBoda',
      bodaName: bodaName || '',
      bodaPhone: bodaPhone || '',
      bodaPlateNumber: bodaPlateNumber || '',
      busName: busName || '',
      busNumber: busNumber || '',
      driverName: driverName || '',
      driverPhone: driverPhone || ''
    };

    const shippingDetails = JSON.stringify(shippingInfo);

    await env.DB.prepare(`
      UPDATE orders 
      SET status = 'Completed', 
          shipping_method = ?, 
          shipping_details = ?
      WHERE id = ?
    `).bind(shippingInfo.method, shippingDetails, orderId).run();

    return json({
      success: true,
      message: 'Oda imekamilika kikamilifu',
      order: {
        id: orderId,
        status: 'Completed',
        shipping_info: shippingInfo
      }
    });
  } catch (error: any) {
    console.error('Failed to complete order:', error);
    return json({ success: false, error: error?.message }, 500);
  }
};
