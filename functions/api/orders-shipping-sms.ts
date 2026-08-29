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
      driverPhone
    } = body;

    if (!customerName || !customerPhone) {
      return json({ success: false, error: 'Missing required fields' }, 400);
    }

    const BEEM_API_KEY = env.BEEM_API_KEY || '4594d67f9df36874';
    const BEEM_SECRET_KEY = env.BEEM_SECRET_KEY || 'YzRmMjU0OTlhZmFlNTdkODI2ZDAyNWY1YmJkMWYyMWNmZDQ0MDllZGI5MTg2YzE1ZTg5YmE4YTI4NmI1ZTY2Mw==';
    
    // Admin phone: 0616069692
    const MY_PHONE = env.MY_PHONE_NUMBER || '0616069692';

    const customerPhoneNormalized = normalizePhone(customerPhone);
    const ownerPhoneNormalized = normalizePhone(MY_PHONE);

    console.log('📱 Customer phone:', customerPhoneNormalized);
    console.log('📱 Admin phone:', ownerPhoneNormalized);

    // Build messages
    let customerShippingMessage = '';
    let adminShippingMessage = '';

    if (shippingMethod === 'BodaBoda') {
      customerShippingMessage = `Habari ${customerName}, Tayari Mzigo wako umepakiwa!\n\nBoda: ${bodaName || 'Haijatolewa'}\nNamba: ${bodaPhone}`;
      adminShippingMessage = `🚚 Mzigo wa ${customerName} wa Sh ${Number(totalAmount).toLocaleString()} umefanikiwa kutumwa kwa Boda ${bodaPhone}${bodaName ? ` (${bodaName})` : ''}${bodaPlateNumber ? `, Pikipiki: ${bodaPlateNumber}` : ''}`;
    } else if (shippingMethod === 'Bus' && busName) {
      customerShippingMessage = `Habari ${customerName}, Tayari Mzigo wako umepakiwa!\n\nJina la Bus: ${busName}${busNumber ? `\nNamba ya Bus: ${busNumber}` : ''}${cargoNumber ? `\nNamba ya Mzigo: ${cargoNumber}` : ''}`;
      adminShippingMessage = `🚌 Mzigo wa ${customerName} wa Sh ${Number(totalAmount).toLocaleString()} umefanikiwa kutumwa kwa Bus ${busName}${busNumber ? `, Namba: ${busNumber}` : ''}${cargoNumber ? `, Mzigo No: ${cargoNumber}` : ''}`;
    } else if (shippingMethod === 'Bus' && driverName) {
      customerShippingMessage = `Habari ${customerName}, Tayari Mzigo wako umepakiwa!\n\nJina la Dreva: ${driverName}\nNamba ya Dreva: ${driverPhone}${cargoNumber ? `\nNamba ya Mzigo: ${cargoNumber}` : ''}`;
      adminShippingMessage = `🚌 Mzigo wa ${customerName} wa Sh ${Number(totalAmount).toLocaleString()} umefanikiwa kutumwa kwa Dreva ${driverName}, Simu: ${driverPhone}${cargoNumber ? `, Mzigo No: ${cargoNumber}` : ''}`;
    } else {
      customerShippingMessage = `Habari ${customerName}, Mzigo wako uko tayari kutumwa.`;
      adminShippingMessage = `📦 Mzigo wa ${customerName} wa Sh ${Number(totalAmount).toLocaleString()} uko tayari kutumwa.`;
    }

    // Send to Customer
    console.log('📱 Sending to customer:', customerPhoneNormalized);
    console.log('📱 Customer message:', customerShippingMessage);
    
    const custResult = await sendSingleSMS({
      apiKey: BEEM_API_KEY,
      secretKey: BEEM_SECRET_KEY,
      message: customerShippingMessage,
      phone: customerPhoneNormalized,
      source_addr: 'Sonko Sound',
    });

    console.log('📱 Customer SMS Result:', JSON.stringify(custResult));

    // Wait 1 second
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Send to Admin (Owner)
    console.log('📱 Sending to admin:', ownerPhoneNormalized);
    console.log('📱 Admin message:', adminShippingMessage);
    
    const adminResult = await sendSingleSMS({
      apiKey: BEEM_API_KEY,
      secretKey: BEEM_SECRET_KEY,
      message: adminShippingMessage,
      phone: ownerPhoneNormalized,
      source_addr: 'Sonko Sound',
    });

    console.log('📱 Admin SMS Result:', JSON.stringify(adminResult));

    return json({
      success: custResult.success || adminResult.success,
      data: {
        customerSent: custResult.success,
        adminSent: adminResult.success,
        customerMessage: customerShippingMessage,
        adminMessage: adminShippingMessage,
        customerPhone: customerPhoneNormalized,
        adminPhone: ownerPhoneNormalized,
      },
      message: `Customer SMS: ${custResult.success ? '✅' : '❌'} | Admin SMS: ${adminResult.success ? '✅' : '❌'}`,
    });
  } catch (error: any) {
    console.error('📱 Shipping SMS Error:', error);
    return json({ success: false, error: error?.message }, 500);
  }
};
