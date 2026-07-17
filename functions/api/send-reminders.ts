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

const makeId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const normalizePhone = (value: any) => {
  let v = String(value || '').trim();
  v = v.replace(/[^\d+]/g, '');
  if (!v) return '';
  if (v.startsWith('00')) v = `+${v.slice(2)}`;
  if (!v.startsWith('+') && v.startsWith('0') && v.length >= 10) v = `+255${v.slice(1)}`;
  if (!v.startsWith('+') && /^\d+$/.test(v)) {
    if (v.startsWith('255')) v = `+${v}`;
    else if (v.length >= 9) v = `+${v}`;
  }
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
  try { parsed = JSON.parse(rawText); } catch { parsed = { raw: rawText }; }

  if (!response.ok) {
    throw new Error(parsed?.message || parsed?.error || `Beem HTTP ${response.status}`);
  }

  return parsed;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await request.json().catch(() => null);
    
    const debts = Array.isArray(body?.debts) ? body.debts : [];
    const customers = Array.isArray(body?.customers) ? body.customers : [];
    const payments = Array.isArray(body?.payments) ? body.payments : [];

    // Beem credentials
    const BEEM_API_KEY = env.BEEM_API_KEY || '4594d67f9df36874';
    const BEEM_SECRET_KEY = env.BEEM_SECRET_KEY || 'YzRmMjU0OTlhZmFlNTdkODI2ZDAyNWY1YmJkMWYyMWNmZDQ0MDllZGI5MTg2YzE1ZTg5YmE4YTI4NmI1ZTY2Mw==';
    const MY_PHONE = env.MY_PHONE_NUMBER || '255656738253';

    const today = new Date().toISOString().split('T')[0];
    
    const messagesSent: Array<{ customer: string; phone: string; message: string; success: boolean }> = [];
    let customerSent = 0;
    let ownerSent = 0;

    // Process debts due TODAY only
    for (const debt of debts) {
      const customer = customers.find((c: any) => c.id === debt.customerId);
      if (!customer || !customer.phoneNumber) continue;

      const debtPayments = payments.filter((p: any) => p.debtId === debt.id);
      const totalPaid = debtPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
      const remaining = (debt.amount || 0) - totalPaid;

      // ONLY debts due TODAY with remaining balance
      if (remaining <= 0) continue;
      if (debt.dueDate !== today) continue;

      const customerPhone = normalizePhone(customer.phoneNumber);
      if (!customerPhone) continue;

      // Message to Customer
      const customerMessage = `Leo ni siku ya mwisho kulipa TSh ${remaining.toLocaleString()} ya "${debt.description}".`;
      
      // Message to Owner (includes supplier/customer name)
      const ownerMessage = `Leo ni siku ya mwisho kulipa TSh ${remaining.toLocaleString()} ya "${debt.description}" Kwa ${customer.fullName}.`;

      try {
        // Send to Customer
        await sendViaBeem({
          apiKey: BEEM_API_KEY,
          secretKey: BEEM_SECRET_KEY,
          message: customerMessage,
          recipients: [{ recipient_id: 1, dest_addr: customerPhone }],
          source_addr: 'Sonko Sound',
        });

        messagesSent.push({
          customer: customer.fullName,
          phone: customerPhone,
          message: customerMessage,
          success: true,
        });
        customerSent++;
      } catch (err: any) {
        console.error(`Failed to send to ${customer.fullName}:`, err.message);
        messagesSent.push({
          customer: customer.fullName,
          phone: customerPhone,
          message: customerMessage,
          success: false,
        });
      }

      // Send copy to Owner (MY number)
      try {
        const ownerPhone = normalizePhone(MY_PHONE);
        await sendViaBeem({
          apiKey: BEEM_API_KEY,
          secretKey: BEEM_SECRET_KEY,
          message: ownerMessage,
          recipients: [{ recipient_id: 1, dest_addr: ownerPhone }],
          source_addr: 'Sonko Sound',
        });
        ownerSent++;
      } catch (err: any) {
        console.error('Failed to send to owner:', err.message);
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return json({
      success: true,
      data: {
        date: today,
        totalDueToday: messagesSent.length,
        customerSent,
        ownerNotifications: ownerSent,
        messages: messagesSent,
      },
      message: `Sent ${customerSent} reminders for ${today}`,
    });
  } catch (error: any) {
    console.error('send-reminders error:', error);
    return json({ success: false, error: error?.message || 'Failed to send reminders' }, 500);
  }
};
