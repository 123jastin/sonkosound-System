// functions/api/orders-send-sms.ts
import type { PagesFunction } from '@cloudflare/workers-types';

type Env = {
  DB: D1Database;
  BEEM_API_KEY: string;
  BEEM_SECRET_KEY: string;
  MY_PHONE_NUMBER: string;
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
    
    // Admin phone
    const MY_PHONE = env.MY_PHONE_NUMBER || '255616069692';

    const customerPhoneNormalized = normalizePhone(customerPhone);
    const ownerPhoneNormalized = normalizePhone(MY_PHONE);

    console.log('📱 Customer phone:', customerPhoneNormalized);
    console.log('📱 Admin phone:', ownerPhoneNormalized);

    // Build order items list
    const itemsList = items.map((item: any, index: number) => 
      `${index + 1}. ${item.product_name} ~ TSh ${Number(item.total_price || item.unit_price * item.quantity).toLocaleString()}`
    ).join('\n');

    // SAME message for both
    const message = `Habari ${customerName}, tumepokea oda yako, tumeanza kuifanyia kazi\n\nOda:\n${itemsList}\n\nJumla Kuu = TSh ${Number(totalAmount).toLocaleString()}`;

    // Send ONE request with BOTH recipients
    const payload = {
      source_addr: 'Sonko Sound',
      schedule_time: '',
      encoding: 0,
      message: message,
      recipients: [
        { recipient_id: 1, dest_addr: customerPhoneNormalized },
        { recipient_id: 2, dest_addr: ownerPhoneNormalized }
      ],
    };

    const auth = toBase64(`${BEEM_API_KEY}:${BEEM_SECRET_KEY}`);

    console.log('📱 Sending bulk SMS to BOTH numbers...');
    console.log('📱 Payload:', JSON.stringify(payload));

    const response = await fetch('https://apisms.beem.africa/v1/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(payload),
    });

    const rawText = await response.text();
    console.log('📱 BEEM Response:', rawText);

    let parsed: any = null;
    try { parsed = JSON.parse(rawText); } catch { parsed = { raw: rawText }; }

    const success = response.ok && !parsed?.error;

    return json({
      success: success,
      data: {
        sent: success,
        message: message,
        recipients: [customerPhoneNormalized, ownerPhoneNormalized],
        response: parsed,
      },
      message: success ? '✅ SMS sent to both numbers' : '❌ Failed: ' + (parsed?.message || rawText),
    });
  } catch (error: any) {
    console.error('📱 Order SMS Error:', error);
    return json({ success: false, error: error?.message }, 500);
  }
};
