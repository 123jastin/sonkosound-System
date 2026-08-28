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

async function getAccessToken(apiKey: string, secretKey: string) {
  try {
    const auth = btoa(`${apiKey}:${secretKey}`);
    
    const response = await fetch('https://apisms.beem.africa/v1/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: JSON.stringify({
        source_addr: 'INFO',
        schedule_time: '',
        encoding: 0,
        message: 'Test message',
        recipients: [{ recipient_id: 1, dest_addr: '255000000000' }]
      })
    });

    console.log('📱 Test Response Status:', response.status);
    const text = await response.text();
    console.log('📱 Test Response Body:', text);
    
    return response.ok;
  } catch (error) {
    console.error('📱 Test failed:', error);
    return false;
  }
}

async function sendSingleSMS(params: {
  apiKey: string;
  secretKey: string;
  message: string;
  phone: string;
  source_addr?: string;
}) {
  console.log('📱 Starting SMS send...');
  console.log('📱 API Key:', params.apiKey ? params.apiKey.substring(0, 10) + '...' : 'MISSING');
  console.log('📱 Secret Key:', params.secretKey ? 'Present (length: ' + params.secretKey.length + ')' : 'MISSING');
  console.log('📱 Phone:', params.phone);
  console.log('📱 Message:', params.message);
  
  const payload = {
    source_addr: params.source_addr || 'Sonko Sound',
    schedule_time: '',
    encoding: 0,
    message: params.message,
    recipients: [{ recipient_id: 1, dest_addr: params.phone }],
  };

  // Try Basic Auth approach
  const auth = btoa(`${params.apiKey}:${params.secretKey}`);
  console.log('📱 Auth header length:', auth.length);

  try {
    // First attempt with Basic Auth
    const response = await fetch('https://apisms.beem.africa/v1/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: JSON.stringify(payload),
    });

    console.log('📱 Response status:', response.status);
    const rawText = await response.text();
    console.log('📱 Response body:', rawText);

    let parsed: any = null;
    try { 
      parsed = JSON.parse(rawText); 
    } catch { 
      parsed = { raw: rawText }; 
    }

    if (response.ok && parsed && parsed.successful && parsed.successful.length > 0) {
      console.log('✅ SMS sent successfully!');
      return { 
        success: true, 
        status: response.status, 
        data: parsed,
        messageId: parsed.successful[0]?.message_id 
      };
    } else {
      console.error('❌ SMS failed:', parsed);
      
      // Try alternative approach - Beem Africa may need different auth
      console.log('📱 Trying alternative auth method...');
      
      const altResponse = await fetch('https://apisms.beem.africa/v1/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${params.apiKey}`,
          'X-Secret-Key': params.secretKey,
        },
        body: JSON.stringify(payload),
      });
      
      const altText = await altResponse.text();
      console.log('📱 Alternative response:', altText);
      
      let altParsed: any = null;
      try { altParsed = JSON.parse(altText); } catch { altParsed = { raw: altText }; }
      
      return {
        success: altResponse.ok && altParsed?.successful?.length > 0,
        status: altResponse.status,
        data: altParsed,
        error: !altResponse.ok ? (altParsed?.message || altText) : null,
      };
    }
  } catch (err: any) {
    console.error('📱 SMS Error:', err);
    return { success: false, status: 0, data: null, error: err.message };
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await request.json().catch(() => null);
    console.log('📱 Installment SMS Request received');
    console.log('📱 Body:', JSON.stringify(body));

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

    // Get credentials - check both env and fallback
    const BEEM_API_KEY = env.BEEM_API_KEY || '4594d67f9df36874';
    const BEEM_SECRET_KEY = env.BEEM_SECRET_KEY || 'YzRmMjU0OTlhZmFlNTdkODI2ZDAyNWY1YmJkMWYyMWNmZDQ0MDllZGI5MTg2YzE1ZTg5YmE4YTI4NmI1ZTY2Mw==';
    const MY_PHONE = env.MY_PHONE_NUMBER || '255656738253';

    console.log('📱 Credentials check:');
    console.log('📱 API Key:', BEEM_API_KEY.substring(0, 8) + '...');
    console.log('📱 Secret Key length:', BEEM_SECRET_KEY.length);
    console.log('📱 Admin phone:', MY_PHONE);

    const remaining = Math.max(0, totalAmount - paidAmount);
    const customerPhoneNormalized = normalizePhone(customerPhone);
    const ownerPhoneNormalized = normalizePhone(MY_PHONE);

    console.log('📱 Customer phone:', customerPhoneNormalized);
    console.log('📱 Owner phone:', ownerPhoneNormalized);

    let customerMessage = '';
    let ownerMessage = '';

    if (isCompleted) {
      customerMessage = `Hongera ${customerName}! Umemaliza malipo ya ${productName} ya TSh ${totalAmount.toLocaleString()}. Bidhaa iko tayari kukabidhiwa. Asante kwa kuaminiana nasi!\n\nUnaweza kutazama bidhaa nyingine kupitia App yetu\nBofya Hapa 👉 https://tinyurl.com/398d47wa`;
      ownerMessage = `🎉 HONGERA! ${customerName} amekamilisha malipo ya ${productName} TSh ${totalAmount.toLocaleString()}. Bidhaa iko tayari kukabidhiwa. Simu: ${customerPhone}.`;
    } else {
      customerMessage = `Habari ${customerName}, malipo ya TSh ${paymentAmount.toLocaleString()} ya ${productName} yamepokelewa. Umelipa jumla TSh ${paidAmount.toLocaleString()}, kiwango kilicho baki ni TSh ${remaining.toLocaleString()}.`;
      ownerMessage = `💰 ${customerName} amelipa TSh ${paymentAmount.toLocaleString()} ya ${productName} kupitia ${paymentMethod || 'Cash'}. Jumla: TSh ${paidAmount.toLocaleString()}, Baki: TSh ${remaining.toLocaleString()}.`;
    }

    // Send to Customer
    console.log('📱 Sending SMS to customer...');
    const custResult = await sendSingleSMS({
      apiKey: BEEM_API_KEY,
      secretKey: BEEM_SECRET_KEY,
      message: customerMessage,
      phone: customerPhoneNormalized,
      source_addr: 'Sonko Sound',
    });

    console.log('📱 Customer SMS complete:', custResult.success ? 'SUCCESS' : 'FAILED');

    // Wait 2 seconds before sending to owner
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Send to Owner (Admin)
    console.log('📱 Sending SMS to owner...');
    const ownerResult = await sendSingleSMS({
      apiKey: BEEM_API_KEY,
      secretKey: BEEM_SECRET_KEY,
      message: ownerMessage,
      phone: ownerPhoneNormalized,
      source_addr: 'Sonko Sound',
    });

    console.log('📱 Owner SMS complete:', ownerResult.success ? 'SUCCESS' : 'FAILED');

    return json({
      success: custResult.success || ownerResult.success,
      data: {
        customerSent: custResult.success,
        ownerSent: ownerResult.success,
        customerMessage,
        ownerMessage,
        customerPhone: customerPhoneNormalized,
        ownerPhone: ownerPhoneNormalized,
        customerResult: custResult,
        ownerResult: ownerResult,
      },
      message: `Customer SMS: ${custResult.success ? '✅' : '❌'} | Owner SMS: ${ownerResult.success ? '✅' : '❌'}`,
    });
  } catch (error: any) {
    console.error('📱 Installment SMS Error:', error);
    return json({ success: false, error: error?.message }, 500);
  }
};
