// functions/api/send-payment-sms.ts
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
    console.log('Payment SMS Request:', JSON.stringify(body));

    if (!body) {
      return json({ success: false, error: 'No data provided' }, 400);
    }

    const { customerName, customerPhone, paidAmount, remainingAmount } = body;

    if (!customerName || !customerPhone || !paidAmount) {
      return json({ success: false, error: 'Missing required fields' }, 400);
    }

    const BEEM_API_KEY = env.BEEM_API_KEY || '4594d67f9df36874';
    const BEEM_SECRET_KEY = env.BEEM_SECRET_KEY || 'YzRmMjU0OTlhZmFlNTdkODI2ZDAyNWY1YmJkMWYyMWNmZDQ0MDllZGI5MTg2YzE1ZTg5YmE4YTI4NmI1ZTY2Mw==';
    const MY_PHONE = env.MY_PHONE_NUMBER || '255656738253';

    const customerPhoneNormalized = normalizePhone(customerPhone);
    const ownerPhoneNormalized = normalizePhone(MY_PHONE);

    // Customer message (NO EMOJI)
    const customerMessage = `Habari, ${customerName} Malipo yako yamepokelewa Sh ${Number(paidAmount).toLocaleString()}. Bado sh ${Number(remainingAmount).toLocaleString()} Kukamilisha. Asante Kwa kutuamini\n\nDuka la mziki Sonko Sound Morogoro\nTel: 0688423753`;

    // Admin message (NO EMOJI)
    const adminMessage = `${customerName} Amepunguza sh ${Number(paidAmount).toLocaleString()} bado ${Number(remainingAmount).toLocaleString()}. Asante`;

    const auth = toBase64(`${BEEM_API_KEY}:${BEEM_SECRET_KEY}`);

    // Send to Customer
    console.log('Sending to customer:', customerPhoneNormalized);
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
    console.log('Customer SMS Response:', custText);

    // Wait 1 second
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Send to Admin
    console.log('Sending to admin:', ownerPhoneNormalized);
    const adminPayload = {
      source_addr: 'Sonko Sound',
      schedule_time: '',
      encoding: 0,
      message: adminMessage,
      recipients: [{ recipient_id: 1, dest_addr: ownerPhoneNormalized }],
    };

    const adminResponse = await fetch('https://apisms.beem.africa/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
      body: JSON.stringify(adminPayload),
    });

    const adminText = await adminResponse.text();
    console.log('Admin SMS Response:', adminText);

    return json({
      success: true,
      data: {
        customerSent: custResponse.ok,
        adminSent: adminResponse.ok,
        customerMessage,
        adminMessage,
      },
      message: `Customer: ${custResponse.ok ? 'OK' : 'FAIL'} | Admin: ${adminResponse.ok ? 'OK' : 'FAIL'}`,
    });
  } catch (error: any) {
    console.error('Payment SMS Error:', error);
    return json({ success: false, error: error?.message }, 500);
  }
};
