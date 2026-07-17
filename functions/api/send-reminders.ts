// functions/api/send-reminders.ts
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
    recipients: [
      {
        recipient_id: 1,
        dest_addr: params.phone,
      },
    ],
  };

  console.log('📤 Sending to:', params.phone);

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
    console.log('📥 Status:', response.status, '| Response:', rawText);

    let parsed: any = null;
    try { parsed = JSON.parse(rawText); } catch { parsed = { raw: rawText }; }

    return {
      success: response.ok && !parsed?.error,
      status: response.status,
      data: parsed,
      error: !response.ok ? (parsed?.message || parsed?.error_description || rawText) : null,
    };
  } catch (err: any) {
    return { success: false, status: 0, data: null, error: err.message };
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await request.json().catch(() => null);

    const debts = Array.isArray(body?.debts) ? body.debts : [];
    const customers = Array.isArray(body?.customers) ? body.customers : [];
    const payments = Array.isArray(body?.payments) ? body.payments : [];

    const BEEM_API_KEY = env.BEEM_API_KEY || '4594d67f9df36874';
    const BEEM_SECRET_KEY = env.BEEM_SECRET_KEY || 'YzRmMjU0OTlhZmFlNTdkODI2ZDAyNWY1YmJkMWYyMWNmZDQ0MDllZGI5MTg2YzE1ZTg5YmE4YTI4NmI1ZTY2Mw==';
    const MY_PHONE = env.MY_PHONE_NUMBER || '255616069692';

    const today = new Date().toISOString().split('T')[0];

    console.log('========================================');
    console.log('📨 SEND REMINDERS -', today);
    console.log('========================================');

    const results: any[] = [];
    let customerSent = 0;
    let customerFailed = 0;
    let ownerSent = 0;

    for (const debt of debts) {
      const customer = customers.find((c: any) => c.id === debt.customerId);
      
      if (!customer || !customer.phoneNumber) {
        console.log(`⏭️ Skipping: No customer or phone for debt "${debt.description}"`);
        continue;
      }

      const debtPayments = payments.filter((p: any) => p.debtId === debt.id);
      const totalPaid = debtPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
      const remaining = (debt.amount || 0) - totalPaid;

      console.log(`📋 ${customer.fullName}: "${debt.description}" | Remaining: ${remaining} | Due: ${debt.dueDate}`);

      if (remaining <= 0) continue;
      if (debt.dueDate !== today) continue;

      const customerPhone = normalizePhone(customer.phoneNumber);
      const ownerPhone = normalizePhone(MY_PHONE);

      console.log(`📱 Customer: ${customer.phoneNumber} → ${customerPhone}`);
      console.log(`📱 Owner: ${MY_PHONE} → ${ownerPhone}`);

      if (!customerPhone) continue;

      // Message to Customer - SIMPLE AND CLEAN
      const customerMessage = `Habari ${customer.fullName}, leo ni siku ya mwisho kulipa TSh ${remaining.toLocaleString()} ya "${debt.description}". Asante.`;

      // Message to Owner - INCLUDES CUSTOMER NAME
      const ownerMessage = `Imekukumbushwa ${customer.fullName} (${customer.phoneNumber}) kulipa TSh ${remaining.toLocaleString()} ya "${debt.description}".`;

      // Send to CUSTOMER
      console.log(`📤 Sending to CUSTOMER: ${customerPhone}`);
      const custResult = await sendSingleSMS({
        apiKey: BEEM_API_KEY,
        secretKey: BEEM_SECRET_KEY,
        message: customerMessage,
        phone: customerPhone,
        source_addr: 'Sonko Sound',
      });

      results.push({
        to: 'customer',
        name: customer.fullName,
        phone: customerPhone,
        message: customerMessage,
        success: custResult.success,
        error: custResult.error,
      });

      if (custResult.success) {
        customerSent++;
        console.log(`✅ Customer SMS sent to ${customer.fullName}`);
      } else {
        customerFailed++;
        console.log(`❌ Customer SMS failed: ${custResult.error}`);
      }

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Send to OWNER (only if customer message sent successfully, or always)
      console.log(`📤 Sending to OWNER: ${ownerPhone}`);
      const ownerResult = await sendSingleSMS({
        apiKey: BEEM_API_KEY,
        secretKey: BEEM_SECRET_KEY,
        message: ownerMessage,
        phone: ownerPhone,
        source_addr: 'Sonko Sound',
      });

      results.push({
        to: 'owner',
        name: 'Wewe',
        phone: ownerPhone,
        message: ownerMessage,
        success: ownerResult.success,
        error: ownerResult.error,
      });

      if (ownerResult.success) {
        ownerSent++;
        console.log(`✅ Owner copy sent`);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('========================================');
    console.log(`✅ Customer: ${customerSent} | ❌ Failed: ${customerFailed} | 📋 Owner: ${ownerSent}`);
    console.log('========================================');

    return json({
      success: true,
      data: {
        date: today,
        customerSent,
        customerFailed,
        ownerSent,
        results,
      },
      message: `✅ Wateja: ${customerSent} | 📋 Nakala kwako: ${ownerSent}`,
    });
  } catch (error: any) {
    console.error('❌ Error:', error);
    return json({ success: false, error: error?.message }, 500);
  }
};
