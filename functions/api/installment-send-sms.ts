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
  // Use Buffer for Node.js environment (Cloudflare Workers)
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value).toString('base64');
  }
  // Fallback to btoa for browser environment
  return btoa(value);
};

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
    console.log('📱 Installment SMS Request:', JSON.stringify(body));

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

    if (!customerName || !customerPhone || !productName) {
      return json({ success: false, error: 'Missing required fields' }, 400);
    }

    const BEEM_API_KEY = env.BEEM_API_KEY || '4594d67f9df36874';
    const BEEM_SECRET_KEY = env.BEEM_SECRET_KEY || 'YzRmMjU0OTlhZmFlNTdkODI2ZDAyNWY1YmJkMWYyMWNmZDQ0MDllZGI5MTg2YzE1ZTg5YmE4YTI4NmI1ZTY2Mw==';
    const MY_PHONE = env.MY_PHONE_NUMBER || '255656738253';

    // Convert to numbers to ensure proper comparison
    const numTotalAmount = Number(totalAmount);
    const numPaidAmount = Number(paidAmount);
    const numPaymentAmount = Number(paymentAmount);
    
    const remaining = Math.max(0, numTotalAmount - numPaidAmount);
    const customerPhoneNormalized = normalizePhone(customerPhone);
    const ownerPhoneNormalized = normalizePhone(MY_PHONE);

    // Check if this payment completes the installment
    // The payment is complete if:
    // 1. The isCompleted flag is true, OR
    // 2. The remaining amount is 0 or less, OR
    // 3. The progress percentage is 100
    const paymentCompletes = isCompleted || remaining <= 0 || (numTotalAmount > 0 && numPaidAmount >= numTotalAmount);
    
    console.log('📱 Payment details:');
    console.log('  Total Amount:', numTotalAmount);
    console.log('  Paid Amount:', numPaidAmount);
    console.log('  Payment Amount:', numPaymentAmount);
    console.log('  Remaining:', remaining);
    console.log('  Is Completed flag:', isCompleted);
    console.log('  Payment Completes:', paymentCompletes);
    console.log('  Progress:', progressPercentage + '%');

    let customerMessage = '';
    let ownerMessage = '';

    if (paymentCompletes) {
      console.log('🎉 Sending COMPLETION messages...');
      customerMessage = `Hongera ${customerName}! Umemaliza malipo ya ${productName} ya TSh ${numTotalAmount.toLocaleString()}. Bidhaa iko tayari kukabidhiwa. Asante kwa kuaminiana nasi!\n\nUnaweza kutazama bidhaa nyingine kupitia App yetu\nBofya Hapa 👉 https://tinyurl.com/398d47wa`;
      ownerMessage = `🎉 HONGERA! ${customerName} amekamilisha malipo ya ${productName} TSh ${numTotalAmount.toLocaleString()}. Bidhaa iko tayari kukabidhiwa. Simu: ${customerPhone}.`;
    } else {
      console.log('💰 Sending PARTIAL payment messages...');
      customerMessage = `Habari ${customerName}, malipo ya TSh ${numPaymentAmount.toLocaleString()} ya ${productName} yamepokelewa. Umelipa jumla TSh ${numPaidAmount.toLocaleString()}, kiwango kilicho baki ni TSh ${remaining.toLocaleString()}.`;
      ownerMessage = `💰 ${customerName} amelipa TSh ${numPaymentAmount.toLocaleString()} ya ${productName} kupitia ${paymentMethod || 'Cash'}. Jumla: TSh ${numPaidAmount.toLocaleString()}, Baki: TSh ${remaining.toLocaleString()}.`;
    }

    console.log('📱 Sending to customer:', customerPhoneNormalized);
    console.log('📱 Customer message:', customerMessage);
    console.log('📱 Sending to owner:', ownerPhoneNormalized);
    console.log('📱 Owner message:', ownerMessage);

    // Send to Customer
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
        paymentCompletes,
        isCompleted,
        remaining,
      },
      message: `Customer SMS: ${custResult.success ? '✅' : '❌'} | Owner SMS: ${ownerResult.success ? '✅' : '❌'}`,
    });
  } catch (error: any) {
    console.error('📱 Installment SMS Error:', error);
    return json({ success: false, error: error?.message }, 500);
  }
};
