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

async function sendSingleSMS(params: {
  apiKey: string;
  secretKey: string;
  message: string;
  phone: string;
  source_addr?: string;
}) {
  const payload: any = {
    source_addr: params.source_addr || 'Sonko Sound',
    schedule_time: '',
    encoding: 0,
    message: params.message,
    recipients: [{ recipient_id: 1, dest_addr: params.phone }],
  };

  const auth = toBase64(`${params.apiKey}:${params.secretKey}`);

  try {
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

    return {
      success: response.ok && !parsed?.error,
      status: response.status,
      data: parsed,
      error: !response.ok ? (parsed?.message || parsed?.error_description || rawText) : null,
    };
  } catch (err: any) {
    console.error('📱 SMS Error:', err);
    return { success: false, status: 0, data: null, error: err.message };
  }
}

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
    const MY_PHONE = env.MY_PHONE_NUMBER || '255616069692';

    const customerPhoneNormalized = normalizePhone(customerPhone);
    const ownerPhoneNormalized = normalizePhone(MY_PHONE);

    console.log('📱 Customer phone:', customerPhoneNormalized);
    console.log('📱 Admin phone:', ownerPhoneNormalized);

    // Build order items list
    const itemsList = items.map((item: any, index: number) => 
      `${index + 1}. ${item.product_name} ~ TSh ${Number(item.total_price || item.unit_price * item.quantity).toLocaleString()}`
    ).join('\n');

    // Customer message
    const customerMessage = `Habari ${customerName}, tumepokea oda yako, tumeanza kuifanyia kazi\n\nOda:\n${itemsList}\n\nJumla Kuu = TSh ${Number(totalAmount).toLocaleString()}`;

    // Admin message
    const adminMessage = `📋 ODA MPYA!\nMteja: ${customerName}\nSimu: ${customerPhone}\n\nOda:\n${itemsList}\n\nJumla: TSh ${Number(totalAmount).toLocaleString()}`;

    // 1. Send to Customer
    console.log('📱 Sending to customer:', customerPhoneNormalized);
    const custResult = await sendSingleSMS({
      apiKey: BEEM_API_KEY,
      secretKey: BEEM_SECRET_KEY,
      message: customerMessage,
      phone: customerPhoneNormalized,
      source_addr: 'Sonko Sound',
    });

    console.log('📱 Customer SMS Result:', JSON.stringify(custResult));

    // 2. Save admin message to queue
    console.log('📝 Saving admin message to queue...');
    
    try {
      // Check if DB is available
      if (!env.DB) {
        console.error('❌ DB binding not available!');
        throw new Error('DB binding not available');
      }

      // Check if table exists
      const tableCheck = await env.DB.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='sms_queue'
      `).first();
      
      console.log('📋 Table check:', JSON.stringify(tableCheck));

      if (!tableCheck) {
        // Create table if it doesn't exist
        console.log('📋 Creating sms_queue table...');
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
        console.log('✅ Table created');
      }

      const queueId = 'sms-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      
      console.log('📝 Inserting queue entry:', queueId);
      
      const insertResult = await env.DB.prepare(`
        INSERT INTO sms_queue (id, recipient_type, recipient_phone, message, status, metadata)
        VALUES (?, 'admin', ?, ?, 'pending', ?)
      `).bind(
        queueId,
        ownerPhoneNormalized,
        adminMessage,
        JSON.stringify({ orderId, customerName, type: 'order_creation' })
      ).run();
      
      console.log('✅ Queue insert result:', JSON.stringify(insertResult));
      console.log('✅ Admin message queued:', queueId);

    } catch (queueErr: any) {
      console.error('❌ Failed to queue admin message:', queueErr);
      console.error('Error details:', queueErr.message, queueErr.stack);
    }

    return json({
      success: custResult.success,
      data: {
        customerSent: custResult.success,
        adminQueued: true,
        customerMessage,
        adminMessage,
      },
      message: `Customer: ${custResult.success ? '✅' : '❌'} | Admin: Queued 📝`,
    });
  } catch (error: any) {
    console.error('📱 Order SMS Error:', error);
    return json({ success: false, error: error?.message }, 500);
  }
};
