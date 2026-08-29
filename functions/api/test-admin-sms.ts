// functions/api/test-admin-sms.ts
import type { PagesFunction } from '@cloudflare/workers-types';

type Env = {
  DB: D1Database;
  BEEM_API_KEY: string;
  BEEM_SECRET_KEY: string;
  MY_PHONE_NUMBER: string;
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const toBase64 = (value: string) => btoa(value);

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const results: any = {};
  
  try {
    const BEEM_API_KEY = env.BEEM_API_KEY || '4594d67f9df36874';
    const BEEM_SECRET_KEY = env.BEEM_SECRET_KEY || 'YzRmMjU0OTlhZmFlNTdkODI2ZDAyNWY1YmJkMWYyMWNmZDQ0MDllZGI5MTg2YzE1ZTg5YmE4YTI4NmI1ZTY2Mw==';
    const MY_PHONE = env.MY_PHONE_NUMBER || '255616069692';

    const auth = toBase64(`${BEEM_API_KEY}:${BEEM_SECRET_KEY}`);
    results.auth = `Basic ${auth.substring(0, 30)}...`;
    results.adminPhone = MY_PHONE;

    // Test 1: Check Balance
    console.log('💰 Checking Beem balance...');
    try {
      const balanceResponse = await fetch('https://apisms.beem.africa/v1/vendors/balance', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${auth}`,
        },
      });
      const balanceText = await balanceResponse.text();
      results.balanceStatus = balanceResponse.status;
      results.balanceResponse = balanceText;
      console.log('💰 Balance:', balanceText);
    } catch (err: any) {
      results.balanceError = err.message;
    }

    // Test 2: Send test SMS to admin with DIFFERENT phone formats
    const phoneFormats = [
      '255616069692',    // International format
      '0616069692',      // Local format with 0
      '616069692',       // Without 0 and 255
      '+255616069692',   // With + sign
    ];

    results.testResults = [];

    for (const phone of phoneFormats) {
      console.log(`\n📱 Testing with phone format: ${phone}`);
      
      const payload = {
        source_addr: 'Sonko Sound',
        schedule_time: '',
        encoding: 0,
        message: `Test SMS to admin - Format: ${phone}`,
        recipients: [{ recipient_id: 1, dest_addr: phone }],
      };

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
        console.log(`📱 Response for ${phone}:`, rawText);
        
        let parsed: any = null;
        try { parsed = JSON.parse(rawText); } catch { parsed = { raw: rawText }; }

        results.testResults.push({
          phone: phone,
          status: response.status,
          success: response.ok && !parsed?.error,
          response: parsed,
          rawText: rawText
        });

        // Wait 2 seconds between tests
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (err: any) {
        results.testResults.push({
          phone: phone,
          error: err.message
        });
      }
    }

    // Test 3: Check if sender ID is approved
    console.log('\n🔍 Checking sender ID...');
    try {
      const senderResponse = await fetch('https://apisms.beem.africa/v1/vendors/sender-id', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${auth}`,
        },
      });
      const senderText = await senderResponse.text();
      results.senderIdResponse = senderText;
      console.log('🔍 Sender ID:', senderText);
    } catch (err: any) {
      results.senderIdError = err.message;
    }

    return json(results);
  } catch (error: any) {
    return json({ error: error?.message }, 500);
  }
};
