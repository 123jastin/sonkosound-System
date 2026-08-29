// functions/api/orders-send-sms.ts
import type { PagesFunction } from '@cloudflare/workers-types';

type Env = {
  DB: D1Database;
  BEEM_API_KEY: string;
  BEEM_SECRET_KEY: string;
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

const normalizePhone = (value: any) => {
  let v = String(value || '').trim();
  v = v.replace(/[^\d+]/g, '');
  if (!v) return '';
  if (v.startsWith('+')) v = v.slice(1);
  if (v.startsWith('00')) v = v.slice(2);
  if (v.startsWith('0')) v = '255' + v.slice(1);
  if (!v.startsWith('255')) v = '255' + v;
  return v;
};

const toBase64 = (value: string) => btoa(value);

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await request.json().catch(() => null);
    console.log('📱 Order SMS Request:', JSON.stringify(body));

    if (!body) {
      return json({ success: false, error: 'No data provided' }, 400);
    }

    const { customerName, customerPhone, orderId, items, totalAmount } = body;

    if (!customerName || !customerPhone || !items || !Array.isArray(items)) {
      return json({ success: false, error: 'Missing required fields' }, 400);
    }

    const BEEM_API_KEY = env.BEEM_API_KEY || '4594d67f9df36874';
    const BEEM_SECRET_KEY = env.BEEM_SECRET_KEY || 'YzRmMjU0OTlhZmFlNTdkODI2ZDAyNWY1YmJkMWYyMWNmZDQ0MDllZGI5MTg2YzE1ZTg5YmE4YTI4NmI1ZTY2Mw==';

    const customerPhoneNormalized = normalizePhone(customerPhone);

    console.log('📱 Customer phone:', customerPhoneNormalized);

    // Build order items list
    const itemsList = items.map((item: any, index: number) => 
      `${index + 1}. ${item.product_name} ~ TSh ${Number(item.total_price || item.unit_price * item.quantity).toLocaleString()}`
    ).join('\n');

    // Customer message
    const customerMessage = `Habari ${customerName}, tumepokea oda yako, tumeanza kuifanyia kazi\n\nOda:\n${itemsList}\n\nJumla Kuu = TSh ${Number(totalAmount).toLocaleString()}`;

    // Admin message to queue
    const adminMessage = `📋 ODA MPYA!\nMteja: ${customerName}\nSimu: ${customerPhone}\n\nOda:\n${itemsList}\n\nJumla: TSh ${Number(totalAmount).toLocaleString()}`;

    const payload = {
      source_addr: 'Sonko Sound',
      schedule_time: '',
      encoding: 0,
      message: customerMessage,
      recipients: [{ recipient_id: 1, dest_addr: customerPhoneNormalized }],
    };

    const auth = toBase64(`${BEEM_API_KEY}:${BEEM_SECRET_KEY}`);

    console.log('📱 Sending to customer:', customerPhoneNormalized);

    const response = await fetch('https://apisms.beem.africa/v1/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(payload),
    });

    const rawText = await response.text();
    console.log('📱 Customer SMS Response:', rawText);

    let parsed: any = null;
    try { parsed = JSON.parse(rawText); } catch { parsed = { raw: rawText }; }

    const customerSmsSuccess = response.ok && !parsed?.error;

    // Save admin message to queue table
    if (customerSmsSuccess) {
      try {
        const queueId = 'sms-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
        
        await env.DB.prepare(`
          INSERT INTO sms_queue (id, recipient_type, recipient_phone, message, status, metadata)
          VALUES (?, 'admin', ?, ?, 'pending', ?)
        `).bind(
          queueId,
          '255616069692', // Admin phone
          adminMessage,
          JSON.stringify({ orderId, customerName, type: 'order_creation' })
        ).run();
        
        console.log('📝 Admin message queued:', queueId);
      } catch (queueErr: any) {
        console.error('Failed to queue admin message:', queueErr);
      }
    }

    return json({
      success: customerSmsSuccess,
      data: {
        customerSent: customerSmsSuccess,
        adminQueued: customerSmsSuccess,
        customerMessage,
        adminMessage,
      },
      message: customerSmsSuccess ? '✅ Customer SMS sent, Admin queued' : '❌ Failed',
    });
  } catch (error: any) {
    console.error('📱 Order SMS Error:', error);
    return json({ success: false, error: error?.message }, 500);
  }
};
