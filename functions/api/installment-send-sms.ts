// functions/api/installment-send-sms.ts
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

const toBase64 = (value: string) => {
  try {
    // For Cloudflare Workers - use btoa
    return btoa(value);
  } catch (e) {
    // Fallback
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    const bytes = new TextEncoder().encode(value);
    for (let i = 0; i < bytes.length; i += 3) {
      const b1 = bytes[i];
      const b2 = i + 1 < bytes.length ? bytes[i + 1] : 0;
      const b3 = i + 2 < bytes.length ? bytes[i + 2] : 0;
      const bitmap = (b1 << 16) | (b2 << 8) | b3;
      result += chars[(bitmap >> 18) & 63] + chars[(bitmap >> 12) & 63] + 
                (i + 1 < bytes.length ? chars[(bitmap >> 6) & 63] : '=') + 
                (i + 2 < bytes.length ? chars[bitmap & 63] : '=');
    }
    return result;
  }
};

async function sendSingleSMS(params: {
  apiKey: string;
  secretKey: string;
  message: string;
  phone: string;
  source_addr?: string;
}) {
  console.log('📱 === SENDING SMS ===');
  console.log('📱 Phone:', params.phone);
  console.log('📱 Message:', params.message);
  console.log('📱 API Key (first 10):', params.apiKey.substring(0, 10));
  console.log('📱 Secret Key (first 10):', params.secretKey.substring(0, 10));
  
  const payload = {
    source_addr: params.source_addr || 'Sonko Sound',
    schedule_time: '',
    encoding: 0,
    message: params.message,
    recipients: [{ recipient_id: 1, dest_addr: params.phone }],
  };

  const auth = toBase64(`${params.apiKey}:${params.secretKey}`);
  console.log('📱 Auth (first 20):', auth.substring(0, 20));

  try {
    const response = await fetch('https://apisms.beem.africa/v1/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: JSON.stringify(payload),
    });

    console.log('📱 Response Status:', response.status);
    const rawText = await response.text();
    console.log('📱 Response Body:', rawText);

    let parsed: any = null;
    try { parsed = JSON.parse(rawText); } catch { parsed = { raw: rawText }; }

    const success = response.ok && parsed && (parsed.successful?.length > 0 || parsed.code === 100);
    
    console.log('📱 Success:', success);
    
    return {
      success,
      status: response.status,
      data: parsed,
      error: !success ? (parsed?.message || parsed?.error_description || rawText) : null,
    };
  } catch (err: any) {
    console.error('📱 SMS Error:', err);
    return { success: false, status: 0, data: null, error: err.message };
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  console.log('📱 === INSTALLMENT SMS ENDPOINT CALLED ===');
  
  try {
    const body = await request.json().catch(() => null);
    console.log('📱 Request Body:', JSON.stringify(body));

    if (!body) {
      return json({ success: false, error: 'No data provided' }, 400);
    }

    const {
      customerName,
      customerPhone,
      productName,
      totalAmount,
      paidAmount,
      paymentAmount,
      isCompleted,
      progressPercentage,
      paymentMethod
    } = body;

    console.log('📱 Parsed Data:');
    console.log('  customerName:', customerName);
    console.log('  customerPhone:', customerPhone);
    console.log('  productName:', productName);
    console.log('  totalAmount:', totalAmount);
    console.log('  paidAmount:', paidAmount);
    console.log('  paymentAmount:', paymentAmount);
    console.log('  isCompleted:', isCompleted);
    console.log('  progressPercentage:', progressPercentage);
    console.log('  paymentMethod:', paymentMethod);

    if (!customerName || !customerPhone || !productName) {
      console.error('❌ Missing required fields');
      return json({ success: false, error: 'Missing required fields' }, 400);
    }

    // Use environment variables or fallback
    const BEEM_API_KEY = env.BEEM_API_KEY || '4594d67f9df36874';
    const BEEM_SECRET_KEY = env.BEEM_SECRET_KEY || 'YzRmMjU0OTlhZmFlNTdkODI2ZDAyNWY1YmJkMWYyMWNmZDQ0MDllZGI5MTg2YzE1ZTg5YmE4YTI4NmI1ZTY2Mw==';
    const MY_PHONE = env.MY_PHONE_NUMBER || '255656738253';

    console.log('📱 Using API Key:', BEEM_API_KEY.substring(0, 10) + '...');
    console.log('📱 Admin Phone:', MY_PHONE);

    const numTotalAmount = Number(totalAmount);
    const numPaidAmount = Number(paidAmount);
    const numPaymentAmount = Number(paymentAmount);
    
    const remaining = Math.max(0, numTotalAmount - numPaidAmount);
    const customerPhoneNormalized = normalizePhone(customerPhone);
    const ownerPhoneNormalized = normalizePhone(MY_PHONE);

    console.log('📱 Normalized customer phone:', customerPhoneNormalized);
    console.log('📱 Normalized owner phone:', ownerPhoneNormalized);

    const isPaymentComplete = isCompleted === true || 
                             remaining <= 0 || 
                             (numTotalAmount > 0 && numPaidAmount >= numTotalAmount) ||
                             progressPercentage >= 100;
    
    console.log('📱 Is Payment Complete:', isPaymentComplete);

    let customerMessage = '';
    let ownerMessage = '';

    if (isPaymentComplete) {
      console.log('🎉 COMPLETION MESSAGE');
      customerMessage = `Hongera ${customerName}! Umemaliza malipo ya ${productName} ya TSh ${numTotalAmount.toLocaleString()}. Bidhaa iko tayari kukabidhiwa. Asante kwa kuaminiana nasi!\n\nUnaweza kutazama bidhaa nyingine kupitia App yetu\nBofya Hapa 👉 https://tinyurl.com/398d47wa`;
      ownerMessage = `🎉 HONGERA! ${customerName} amekamilisha malipo ya ${productName} TSh ${numTotalAmount.toLocaleString()}. Bidhaa iko tayari kukabidhiwa. Simu: ${customerPhone}.`;
    } else {
      console.log('💰 PARTIAL PAYMENT MESSAGE');
      customerMessage = `Habari ${customerName}, malipo ya TSh ${numPaymentAmount.toLocaleString()} ya ${productName} yamepokelewa. Umelipa jumla TSh ${numPaidAmount.toLocaleString()}, kiwango kilicho baki ni TSh ${remaining.toLocaleString()}.`;
      ownerMessage = `💰 ${customerName} amelipa TSh ${numPaymentAmount.toLocaleString()} ya ${productName} kupitia ${paymentMethod || 'Cash'}. Jumla: TSh ${numPaidAmount.toLocaleString()}, Baki: TSh ${remaining.toLocaleString()}.`;
    }

    // Send to Customer
    console.log('📱 Sending to CUSTOMER...');
    const custResult = await sendSingleSMS({
      apiKey: BEEM_API_KEY,
      secretKey: BEEM_SECRET_KEY,
      message: customerMessage,
      phone: customerPhoneNormalized,
      source_addr: 'Sonko Sound',
    });

    console.log('📱 Customer SMS Result:', JSON.stringify(custResult));

    // Small delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Send to Owner
    console.log('📱 Sending to OWNER...');
    const ownerResult = await sendSingleSMS({
      apiKey: BEEM_API_KEY,
      secretKey: BEEM_SECRET_KEY,
      message: ownerMessage,
      phone: ownerPhoneNormalized,
      source_addr: 'Sonko Sound',
    });

    console.log('📱 Owner SMS Result:', JSON.stringify(ownerResult));

    return json({
      success: custResult.success || ownerResult.success,
      data: {
        customerSent: custResult.success,
        ownerSent: ownerResult.success,
        customerMessage,
        ownerMessage,
        isPaymentComplete,
        remaining,
      },
      message: `Customer SMS: ${custResult.success ? '✅' : '❌'} | Owner SMS: ${ownerResult.success ? '✅' : '❌'}`,
    });
  } catch (error: any) {
    console.error('📱 Installment SMS Error:', error);
    return json({ success: false, error: error?.message }, 500);
  }
};
