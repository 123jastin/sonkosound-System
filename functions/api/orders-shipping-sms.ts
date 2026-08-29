// functions/api/orders-shipping-sms.ts
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

function generateShortCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

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

async function createShortLink(env: Env, data: {
  orderId: string;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  items: any[];
  shippingInfo: any;
  notes?: string;
}) {
  try {
    // Create table if not exists
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS order_links (
        id TEXT PRIMARY KEY,
        short_code TEXT UNIQUE NOT NULL,
        order_id TEXT NOT NULL,
        customer_name TEXT,
        customer_phone TEXT,
        total_amount REAL,
        items_json TEXT,
        shipping_info_json TEXT,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        clicks INTEGER DEFAULT 0
      )
    `).run();

    // Generate unique short code
    let shortCode = generateShortCode();
    let exists = true;
    
    while (exists) {
      const existing = await env.DB.prepare(`
        SELECT id FROM order_links WHERE short_code = ?
      `).bind(shortCode).first();
      
      if (!existing) {
        exists = false;
      } else {
        shortCode = generateShortCode();
      }
    }

    const id = 'link-' + Date.now();

    await env.DB.prepare(`
      INSERT INTO order_links (id, short_code, order_id, customer_name, customer_phone, total_amount, items_json, shipping_info_json, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      shortCode,
      data.orderId,
      data.customerName,
      data.customerPhone,
      data.totalAmount,
      JSON.stringify(data.items),
      JSON.stringify(data.shippingInfo),
      data.notes || null
    ).run();

    const shortUrl = `https://deni.sonkosound.store/${shortCode}`;
    console.log('🔗 Short link created:', shortUrl);

    return { success: true, shortUrl, shortCode };
  } catch (err: any) {
    console.error('Link creation error:', err);
    return { success: false, error: err.message };
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await request.json().catch(() => null);
    console.log('📱 Shipping SMS Request:', JSON.stringify(body));

    if (!body) {
      return json({ success: false, error: 'No data provided' }, 400);
    }

    const { 
      customerName, 
      customerPhone, 
      orderId, 
      totalAmount,
      shippingMethod,
      bodaName,
      bodaPhone,
      bodaPlateNumber,
      busName,
      busNumber,
      cargoNumber,
      driverName,
      driverPhone,
      items,
      notes
    } = body;

    if (!customerName || !customerPhone) {
      return json({ success: false, error: 'Missing required fields' }, 400);
    }

    const BEEM_API_KEY = env.BEEM_API_KEY || '4594d67f9df36874';
    const BEEM_SECRET_KEY = env.BEEM_SECRET_KEY || 'YzRmMjU0OTlhZmFlNTdkODI2ZDAyNWY1YmJkMWYyMWNmZDQ0MDllZGI5MTg2YzE1ZTg5YmE4YTI4NmI1ZTY2Mw==';
    const MY_PHONE = env.MY_PHONE_NUMBER || '255616069692';

    const customerPhoneNormalized = normalizePhone(customerPhone);
    const ownerPhoneNormalized = normalizePhone(MY_PHONE);

    // Build shipping info object
    const shippingInfo = {
      method: shippingMethod,
      bodaName,
      bodaPhone,
      bodaPlateNumber,
      busName,
      busNumber,
      cargoNumber,
      driverName,
      driverPhone
    };

    // Build messages (NO EMOJI)
    let customerMessage = '';
    let adminMessage = '';

    if (shippingMethod === 'BodaBoda') {
      customerMessage = `Habari ${customerName}, Tayari Mzigo wako umepakiwa!\n\nBoda: ${bodaName || 'Haijatolewa'}\nNamba: ${bodaPhone}`;
      adminMessage = `Mzigo wa ${customerName} wa Sh ${Number(totalAmount).toLocaleString()} umefanikiwa kutumwa kwa Boda ${bodaPhone}${bodaName ? ` (${bodaName})` : ''}${bodaPlateNumber ? `, Pikipiki: ${bodaPlateNumber}` : ''}`;
    } else if (shippingMethod === 'Bus' && busName) {
      customerMessage = `Habari ${customerName}, Tayari Mzigo wako umepakiwa!\n\nJina la Bus: ${busName}${busNumber ? `\nNamba ya Bus: ${busNumber}` : ''}${cargoNumber ? `\nNamba ya Mzigo: ${cargoNumber}` : ''}`;
      adminMessage = `Mzigo wa ${customerName} wa Sh ${Number(totalAmount).toLocaleString()} umefanikiwa kutumwa kwa Bus ${busName}${busNumber ? `, Namba: ${busNumber}` : ''}${cargoNumber ? `, Mzigo No: ${cargoNumber}` : ''}`;
    } else if (shippingMethod === 'Bus' && driverName) {
      customerMessage = `Habari ${customerName}, Tayari Mzigo wako umepakiwa!\n\nJina la Dreva: ${driverName}\nNamba ya Dreva: ${driverPhone}${cargoNumber ? `\nNamba ya Mzigo: ${cargoNumber}` : ''}`;
      adminMessage = `Mzigo wa ${customerName} wa Sh ${Number(totalAmount).toLocaleString()} umefanikiwa kutumwa kwa Dreva ${driverName}, Simu: ${driverPhone}${cargoNumber ? `, Mzigo No: ${cargoNumber}` : ''}`;
    } else {
      customerMessage = `Habari ${customerName}, Mzigo wako uko tayari kutumwa.`;
      adminMessage = `Mzigo wa ${customerName} wa Sh ${Number(totalAmount).toLocaleString()} uko tayari kutumwa.`;
    }

    // 1. Send shipping SMS to Customer
    console.log('📱 Sending shipping SMS to customer...');
    const custResult = await sendSingleSMS({
      apiKey: BEEM_API_KEY,
      secretKey: BEEM_SECRET_KEY,
      message: customerMessage,
      phone: customerPhoneNormalized,
      source_addr: 'Sonko Sound',
    });

    console.log('📱 Customer Shipping Result:', JSON.stringify(custResult));

    // 2. Create short link
    console.log('🔗 Creating short link...');
    const linkResult = await createShortLink(env, {
      orderId,
      customerName,
      customerPhone,
      totalAmount: Number(totalAmount),
      items: items || [],
      shippingInfo,
      notes: notes || ''
    });

    // 3. Send short link SMS to Customer
    if (linkResult.success && linkResult.shortUrl) {
      console.log('📱 Sending short link to customer...');
      
      const linkMessage = `Tazama oda yako hapa:\n${linkResult.shortUrl}`;
      
      const linkSMSResult = await sendSingleSMS({
        apiKey: BEEM_API_KEY,
        secretKey: BEEM_SECRET_KEY,
        message: linkMessage,
        phone: customerPhoneNormalized,
        source_addr: 'Sonko Sound',
      });

      console.log('📱 Link SMS Result:', JSON.stringify(linkSMSResult));
    }

    // Wait 1 second
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 4. Send to Admin
    console.log('📱 Sending to admin...');
    const adminResult = await sendSingleSMS({
      apiKey: BEEM_API_KEY,
      secretKey: BEEM_SECRET_KEY,
      message: adminMessage,
      phone: ownerPhoneNormalized,
      source_addr: 'Sonko Sound',
    });

    console.log('📱 Admin Result:', JSON.stringify(adminResult));

    return json({
      success: custResult.success || adminResult.success,
      data: {
        customerSent: custResult.success,
        adminSent: adminResult.success,
        shortLink: linkResult.success ? linkResult.shortUrl : null,
        customerMessage,
        adminMessage,
        customerResult: custResult,
        adminResult: adminResult,
      },
      message: `Customer: ${custResult.success ? 'OK' : 'FAIL'} | Admin: ${adminResult.success ? 'OK' : 'FAIL'} | Link: ${linkResult.success ? 'OK' : 'FAIL'}`,
    });
  } catch (error: any) {
    console.error('📱 Shipping SMS Error:', error);
    return json({ success: false, error: error?.message }, 500);
  }
};
