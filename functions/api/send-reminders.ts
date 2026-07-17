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

  // Remove + prefix
  if (v.startsWith('+')) v = v.slice(1);
  // Remove 00 prefix
  if (v.startsWith('00')) v = v.slice(2);
  // Convert 0XXXX to 255XXXX
  if (v.startsWith('0')) v = '255' + v.slice(1);
  // Add 255 if not present
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
    source_addr: params.source_addr || 'INFO',
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

  console.log('📤 Sending SMS:');
  console.log('   Phone:', params.phone);
  console.log('   Message:', params.message);
  console.log('   Sender:', payload.source_addr);

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
    console.log('📥 Beem Status:', response.status);
    console.log('📥 Beem Response:', rawText);

    let parsed: any = null;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = { raw: rawText };
    }

    return {
      success: response.ok,
      status: response.status,
      data: parsed,
      error: !response.ok ? (parsed?.message || parsed?.error_description || rawText) : null,
    };
  } catch (err: any) {
    console.error('📥 Beem Network Error:', err.message);
    return {
      success: false,
      status: 0,
      data: null,
      error: err.message,
    };
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await request.json().catch(() => null);

    const debts = Array.isArray(body?.debts) ? body.debts : [];
    const customers = Array.isArray(body?.customers) ? body.customers : [];
    const payments = Array.isArray(body?.payments) ? body.payments : [];

    // Beem credentials - from environment variables
    const BEEM_API_KEY = env.BEEM_API_KEY || '4594d67f9df36874';
    const BEEM_SECRET_KEY = env.BEEM_SECRET_KEY || 'YzRmMjU0OTlhZmFlNTdkODI2ZDAyNWY1YmJkMWYyMWNmZDQ0MDllZGI5MTg2YzE1ZTg5YmE4YTI4NmI1ZTY2Mw==';
    const MY_PHONE = env.MY_PHONE_NUMBER || '255656738253';

    const today = new Date().toISOString().split('T')[0];

    console.log('========================================');
    console.log('📨 SEND REMINDERS STARTED');
    console.log('========================================');
    console.log('📅 Today:', today);
    console.log('📊 Total debts:', debts.length);
    console.log('👥 Total customers:', customers.length);
    console.log('💳 Total payments:', payments.length);
    console.log('📱 Owner phone:', MY_PHONE);
    console.log('========================================');

    const results: any[] = [];
    let customerSent = 0;
    let customerFailed = 0;
    let ownerSent = 0;
    let skippedNoPhone = 0;
    let skippedPaid = 0;
    let skippedNotToday = 0;

    for (const debt of debts) {
      // Find customer for this debt
      const customer = customers.find((c: any) => c.id === debt.customerId);
      
      if (!customer) {
        console.log(`⏭️ Debt "${debt.description}": No customer found`);
        continue;
      }

      if (!customer.phoneNumber || customer.phoneNumber.trim() === '') {
        console.log(`⏭️ ${customer.fullName}: No phone number on profile`);
        skippedNoPhone++;
        continue;
      }

      // Calculate remaining balance
      const debtPayments = payments.filter((p: any) => p.debtId === debt.id);
      const totalPaid = debtPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
      const remaining = (debt.amount || 0) - totalPaid;

      console.log(`📋 ${customer.fullName}: "${debt.description}" | Amount: ${debt.amount} | Paid: ${totalPaid} | Remaining: ${remaining} | Due: ${debt.dueDate}`);

      // Skip if fully paid
      if (remaining <= 0) {
        console.log(`   ✅ Already fully paid - skipping`);
        skippedPaid++;
        continue;
      }

      // Skip if not due today
      if (debt.dueDate !== today) {
        console.log(`   ⏭️ Due date ${debt.dueDate} != today ${today} - skipping`);
        skippedNotToday++;
        continue;
      }

      // Normalize phone number
      const customerPhone = normalizePhone(customer.phoneNumber);
      const ownerPhone = normalizePhone(MY_PHONE);

      console.log(`   📱 Customer phone: ${customer.phoneNumber} → ${customerPhone}`);
      console.log(`   📱 Owner phone: ${MY_PHONE} → ${ownerPhone}`);

      if (!customerPhone) {
        console.log(`   ❌ Invalid phone number after normalization`);
        skippedNoPhone++;
        continue;
      }

      // Build messages
      const customerMessage = `Leo ni siku ya mwisho kulipa TSh ${remaining.toLocaleString()} ya "${debt.description}".`;
      const ownerMessage = `Leo ni siku ya mwisho kulipa TSh ${remaining.toLocaleString()} ya "${debt.description}" Kwa ${customer.fullName}.`;

      // Send to Customer
      console.log(`   📤 Sending to CUSTOMER: ${customer.fullName}`);
      const customerResult = await sendSingleSMS({
        apiKey: BEEM_API_KEY,
        secretKey: BEEM_SECRET_KEY,
        message: customerMessage,
        phone: customerPhone,
        source_addr: 'Sonko Sound',
      });

      results.push({
        customer: customer.fullName,
        phone: customerPhone,
        type: 'customer',
        message: customerMessage,
        success: customerResult.success,
        status: customerResult.status,
        error: customerResult.error,
      });

      if (customerResult.success) {
        console.log(`   ✅ Customer SMS sent successfully`);
        customerSent++;
      } else {
        console.log(`   ❌ Customer SMS failed: ${customerResult.error}`);
        customerFailed++;
      }

      // Small delay between customer and owner send
      await new Promise(resolve => setTimeout(resolve, 500));

      // Send copy to Owner
      console.log(`   📤 Sending copy to OWNER`);
      const ownerResult = await sendSingleSMS({
        apiKey: BEEM_API_KEY,
        secretKey: BEEM_SECRET_KEY,
        message: ownerMessage,
        phone: ownerPhone,
        source_addr: 'Sonko Sound',
      });

      results.push({
        customer: 'OWNER',
        phone: ownerPhone,
        type: 'owner',
        message: ownerMessage,
        success: ownerResult.success,
        status: ownerResult.status,
        error: ownerResult.error,
      });

      if (ownerResult.success) {
        console.log(`   ✅ Owner copy sent successfully`);
        ownerSent++;
      } else {
        console.log(`   ❌ Owner copy failed: ${ownerResult.error}`);
      }

      // Delay between different customers
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('========================================');
    console.log('📨 SEND REMINDERS COMPLETED');
    console.log('========================================');
    console.log('📊 Summary:');
    console.log(`   ✅ Customer SMS sent: ${customerSent}`);
    console.log(`   ❌ Customer SMS failed: ${customerFailed}`);
    console.log(`   📋 Owner copies sent: ${ownerSent}`);
    console.log(`   ⏭️ Skipped (no phone): ${skippedNoPhone}`);
    console.log(`   ⏭️ Skipped (paid): ${skippedPaid}`);
    console.log(`   ⏭️ Skipped (not today): ${skippedNotToday}`);
    console.log('========================================');

    return json({
      success: true,
      data: {
        date: today,
        totalDueToday: results.filter(r => r.type === 'customer').length,
        customerSent,
        customerFailed,
        ownerNotifications: ownerSent,
        skipped: {
          noPhone: skippedNoPhone,
          paid: skippedPaid,
          notToday: skippedNotToday,
        },
        results,
      },
      message: `✅ Sent ${customerSent} reminders. Failed: ${customerFailed}. Owner copies: ${ownerSent}.`,
    });
  } catch (error: any) {
    console.error('❌ send-reminders error:', error);
    return json({ 
      success: false, 
      error: error?.message || 'Failed to send reminders' 
    }, 500);
  }
};
