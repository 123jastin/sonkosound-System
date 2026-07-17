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
    const suppliers = Array.isArray(body?.suppliers) ? body.suppliers : []; // NEW

    const BEEM_API_KEY = env.BEEM_API_KEY || '4594d67f9df36874';
    const BEEM_SECRET_KEY = env.BEEM_SECRET_KEY || 'YzRmMjU0OTlhZmFlNTdkODI2ZDAyNWY1YmJkMWYyMWNmZDQ0MDllZGI5MTg2YzE1ZTg5YmE4YTI4NmI1ZTY2Mw==';
    const MY_PHONE = env.MY_PHONE_NUMBER || '255656738253';

    const today = new Date().toISOString().split('T')[0];

    console.log('========================================');
    console.log('📨 SEND REMINDERS -', today);
    console.log('👥 Customers:', customers.length, '| 🚚 Suppliers:', suppliers.length);
    console.log('========================================');

    const results: any[] = [];
    let customerSent = 0;
    let customerFailed = 0;
    let supplierSent = 0;
    let supplierFailed = 0;
    let ownerSent = 0;

    // ============================================
    // 1. CUSTOMER DEBTS
    // ============================================
    for (const debt of debts) {
      const customer = customers.find((c: any) => c.id === debt.customerId);
      if (!customer || !customer.phoneNumber) continue;

      const debtPayments = payments.filter((p: any) => p.debtId === debt.id);
      const totalPaid = debtPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
      const remaining = (debt.amount || 0) - totalPaid;

      if (remaining <= 0) continue;
      if (debt.dueDate !== today) continue;

      const customerPhone = normalizePhone(customer.phoneNumber);

      // Message to Customer
      const customerMessage = `Habari ${customer.fullName}, leo ni siku ya mwisho kulipa TSh ${remaining.toLocaleString()} ya "${debt.description}". Asante.`;

      // Send to Customer
      const custResult = await sendSingleSMS({
        apiKey: BEEM_API_KEY,
        secretKey: BEEM_SECRET_KEY,
        message: customerMessage,
        phone: customerPhone,
        source_addr: 'Sonko Sound',
      });

      results.push({
        type: 'customer',
        name: customer.fullName,
        phone: customerPhone,
        message: customerMessage,
        success: custResult.success,
      });

      if (custResult.success) customerSent++;
      else customerFailed++;

      // Owner copy
      const ownerMsg = `Imekukumbushwa ${customer.fullName} (${customer.phoneNumber}) kulipa TSh ${remaining.toLocaleString()} ya "${debt.description}".`;
      const ownerResult = await sendSingleSMS({
        apiKey: BEEM_API_KEY,
        secretKey: BEEM_SECRET_KEY,
        message: ownerMsg,
        phone: normalizePhone(MY_PHONE),
        source_addr: 'Sonko Sound',
      });
      if (ownerResult.success) ownerSent++;

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // ============================================
    // 2. SUPPLIER PAYMENTS (NEW)
    // ============================================
    for (const supplier of suppliers) {
      const remaining = (supplier.amount || 0) - (supplier.paidAmount || 0);

      if (remaining <= 0) continue;
      if (supplier.dueDate !== today) continue;

      const ownerPhone = normalizePhone(MY_PHONE);

      // Message to Owner ONLY (not to supplier)
      const ownerMessage = `⏰ Leo ni siku ya mwisho kumlipa ${supplier.name}. Deni: TSh ${remaining.toLocaleString()} ya "${supplier.notes || 'Bidhaa'}". Simu: ${supplier.phoneNumber || 'Haina'}.`;

      const result = await sendSingleSMS({
        apiKey: BEEM_API_KEY,
        secretKey: BEEM_SECRET_KEY,
        message: ownerMessage,
        phone: ownerPhone,
        source_addr: 'Sonko Sound',
      });

      results.push({
        type: 'supplier',
        name: supplier.name,
        phone: ownerPhone,
        message: ownerMessage,
        success: result.success,
      });

      if (result.success) supplierSent++;
      else supplierFailed++;

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('========================================');
    console.log(`✅ Customers: ${customerSent} | ❌ Failed: ${customerFailed}`);
    console.log(`✅ Suppliers: ${supplierSent} | ❌ Failed: ${supplierFailed}`);
    console.log(`📋 Owner copies: ${ownerSent}`);
    console.log('========================================');

    return json({
      success: true,
      data: {
        date: today,
        customerSent,
        customerFailed,
        supplierSent,
        supplierFailed,
        ownerSent,
        results,
      },
      message: `✅ Wateja: ${customerSent} | 🚚 Wauzaji: ${supplierSent} | 📋 Nakala: ${ownerSent}`,
    });
  } catch (error: any) {
    console.error('❌ Error:', error);
    return json({ success: false, error: error?.message }, 500);
  }
};
