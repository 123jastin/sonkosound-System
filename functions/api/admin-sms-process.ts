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
    console.log('📱 Order SMS Request:', body);

    if (!body) {
      return json({ success: false, error: 'No data provided' }, 400);
    }

    const { customerName, customerPhone, orderId, items, totalAmount } = body;

    if (!customerName || !customerPhone || !items || !Array.isArray(items)) {
      return json({ success: false, error: 'Missing required fields' }, 400);
    }

    const BEEM_API_KEY = env.BEEM_API_KEY || '4594d67f9df36874';
    const BEEM_SECRET_KEY = env.BEEM_SECRET_KEY || 'YzRmMjU0OTlhZmFlNTdkODI2ZDAyNWY1YmJkMWYyMWNmZDQ0MDllZGI5MTg2YzE1ZTg5YmE4YTI4NmI1ZTY2Mw==';
    const MY_PHONE = '255616069692';

    const customerPhoneNormalized = normalizePhone(customerPhone);
    const ownerPhoneNormalized = normalizePhone(MY_PHONE);

    console.log('📱 Customer:', customerPhoneNormalized);
    console.log('📱 Admin:', ownerPhoneNormalized);

    const itemsList = items.map((item: any, index: number) => 
      `${index + 1}. ${item.product_name} ~ TSh ${Number(item.total_price || item.unit_price * item.quantity).toLocaleString()}`
    ).join('\n');

    const customerMessage = `Habari ${customerName}, tumepokea oda yako, tumeanza kuifanyia kazi\n\nOda:\n${itemsList}\n\nJumla Kuu = TSh ${Number(totalAmount).toLocaleString()}`;
    const adminMessage = `📋 ODA MPYA!\nMteja: ${customerName}\nSimu: ${customerPhone}\n\nOda:\n${itemsList}\n\nJumla: TSh ${Number(totalAmount).toLocaleString()}`;

    // Send to Customer
    const auth = toBase64(`${BEEM_API_KEY}:${BEEM_SECRET_KEY}`);
    
    const custPayload = {
      source_addr: 'Sonko Sound',
      schedule_time: '',
      encoding: 0,
      message: customerMessage,
      recipients: [{ recipient_id: 1, dest_addr: customerPhoneNormalized }],
    };

    const custResponse = await fetch('https://apisms.beem.africa/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
      body: JSON.stringify(custPayload),
    });

    const custText = await custResponse.text();
    console.log('📱 Customer Response:', custText);
    
    let custParsed: any = {};
    try { custParsed = JSON.parse(custText); } catch { custParsed = { raw: custText }; }
    
    const customerSent = custResponse.ok && custParsed.successful;

    // Create table if not exists and save admin message
    if (env.DB) {
      try {
        // Create table
        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS sms_queue (
            id TEXT PRIMARY KEY,
            recipient_type TEXT NOT NULL,
            recipient_phone TEXT NOT NULL,
            message TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            attempts INTEGER DEFAULT 0,
            max_attempts INTEGER DEFAULT 3,
            created_at TEXT DEFAULT (datetime('now')),
            sent_at TEXT,
            last_attempt_at TEXT,
            error_message TEXT,
            metadata TEXT
          )
        `).run();
        console.log('✅ Table ready');

        // Insert admin message
        const queueId = 'sms-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
        
        await env.DB.prepare(`
          INSERT INTO sms_queue (id, recipient_type, recipient_phone, message, status, metadata)
          VALUES (?, 'admin', ?, ?, 'pending', ?)
        `).bind(
          queueId,
          ownerPhoneNormalized,
          adminMessage,
          JSON.stringify({ orderId, customerName, type: 'order_creation' })
        ).run();
        
        console.log('✅ Admin message queued:', queueId);
      } catch (dbErr: any) {
        console.error('❌ DB Error:', dbErr.message);
      }
    } else {
      console.error('❌ DB binding not available');
    }

    return json({
      success: customerSent,
      data: {
        customerSent,
        adminQueued: true,
      },
      message: customerSent ? '✅ Customer sent, Admin queued' : '❌ Customer failed',
    });
  } catch (error: any) {
    console.error('❌ Error:', error);
    return json({ success: false, error: error?.message }, 500);
  }
};
