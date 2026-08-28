// functions/api/installment-send-sms.ts
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

const normalizePhone = (value: any) => {
  let v = String(value || '').trim();
  v = v.replace(/[^\d+]/g, '');

  if (!v) return '';

  if (v.startsWith('00')) v = `+${v.slice(2)}`;

  if (!v.startsWith('+') && v.startsWith('0')) {
    if (v.length >= 10) v = `+255${v.slice(1)}`;
  }

  if (!v.startsWith('+') && /^\d+$/.test(v)) {
    if (v.startsWith('255')) v = `+${v}`;
    else if (v.length >= 9) v = `+${v}`;
  }

  // Beem examples use numbers like 2557XXXXXXXX without +
  if (v.startsWith('+')) v = v.slice(1);

  return v;
};

const toBase64 = (value: string) => btoa(value);

async function sendViaBeem(params: {
  apiKey: string;
  secretKey: string;
  message: string;
  recipients: Array<{ recipient_id: number; dest_addr: string }>;
  source_addr?: string;
}) {
  const payload: any = {
    schedule_time: '',
    encoding: 0,
    message: params.message,
    recipients: params.recipients,
  };

  if (params.source_addr && String(params.source_addr).trim()) {
    payload.source_addr = String(params.source_addr).trim();
  }

  const auth = toBase64(`${params.apiKey}:${params.secretKey}`);

  const response = await fetch('https://apisms.beem.africa/v1/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();

  let parsed: any = null;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    parsed = { raw: rawText };
  }

  if (!response.ok) {
    throw new Error(
      parsed?.message ||
        parsed?.error ||
        parsed?.description ||
        `Beem request failed with HTTP ${response.status}: ${rawText}`
    );
  }

  return parsed;
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

    // Hardcoded credentials - same as working messages/send.ts
    const beemApiKey = '4594d67f9df36874';
    const beemSecretKey = 'YzRmMjU0OTlhZmFlNTdkODI2ZDAyNWY1YmJkMWYyMWNmZDQ0MDllZGI5MTg2YzE1ZTg5YmE4YTI4NmI1ZTY2Mw==';
    const MY_PHONE = env.MY_PHONE_NUMBER || '255656738253';

    console.log('📱 Using API Key:', beemApiKey);
    console.log('📱 Admin Phone:', MY_PHONE);

    const numTotalAmount = Number(totalAmount);
    const numPaidAmount = Number(paidAmount);
    const numPaymentAmount = Number(paymentAmount);
    
    const remaining = Math.max(0, numTotalAmount - numPaidAmount);
    const customerPhoneNormalized = normalizePhone(customerPhone);
    const ownerPhoneNormalized = normalizePhone(MY_PHONE);

    console.log('📱 Normalized customer phone:', customerPhoneNormalized);
    console.log('📱 Normalized owner phone:', ownerPhoneNormalized);

    // Check if payment completes the installment
    const isPaymentComplete = isCompleted === true || 
                             remaining <= 0 || 
                             (numTotalAmount > 0 && numPaidAmount >= numTotalAmount) ||
                             progressPercentage >= 100;
    
    console.log('📱 Is Payment Complete:', isPaymentComplete);
    console.log('📱 Remaining:', remaining);

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

    let customerSent = false;
    let ownerSent = false;
    let customerError = null;
    let ownerError = null;

    // Send to Customer
    console.log('📱 Sending to CUSTOMER:', customerPhoneNormalized);
    try {
      const custResult = await sendViaBeem({
        apiKey: beemApiKey,
        secretKey: beemSecretKey,
        message: customerMessage,
        recipients: [{ recipient_id: 1, dest_addr: customerPhoneNormalized }],
        source_addr: 'Sonko Sound',
      });
      customerSent = true;
      console.log('✅ Customer SMS sent:', JSON.stringify(custResult));
    } catch (err: any) {
      customerError = err.message;
      console.error('❌ Customer SMS failed:', customerError);
    }

    // Small delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Send to Owner (Admin)
    console.log('📱 Sending to OWNER:', ownerPhoneNormalized);
    try {
      const ownerResult = await sendViaBeem({
        apiKey: beemApiKey,
        secretKey: beemSecretKey,
        message: ownerMessage,
        recipients: [{ recipient_id: 1, dest_addr: ownerPhoneNormalized }],
        source_addr: 'Sonko Sound',
      });
      ownerSent = true;
      console.log('✅ Owner SMS sent:', JSON.stringify(ownerResult));
    } catch (err: any) {
      ownerError = err.message;
      console.error('❌ Owner SMS failed:', ownerError);
    }

    return json({
      success: customerSent || ownerSent,
      data: {
        customerSent,
        ownerSent,
        customerMessage,
        ownerMessage,
        isPaymentComplete,
        remaining,
        customerError,
        ownerError,
      },
      message: `Customer SMS: ${customerSent ? '✅' : '❌'} | Owner SMS: ${ownerSent ? '✅' : '❌'}`,
    });
  } catch (error: any) {
    console.error('📱 Installment SMS Error:', error);
    return json({ success: false, error: error?.message }, 500);
  }
};
