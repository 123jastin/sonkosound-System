// functions/api/kopesha-send-sms.ts
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

// ✅ YYYY-MM-DD → DD/MM/YYYY
const formatDateDMY = (dateStr: string): string => {
  const s = String(dateStr || '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return s;
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await request.json().catch(() => null);
    console.log('Kopesha SMS Request:', JSON.stringify(body));

    if (!body) {
      return json({ success: false, error: 'No data provided' }, 400);
    }

    const { event, customerName, customerPhone } = body;

    if (!event || !customerName || !customerPhone) {
      return json({ success: false, error: 'Missing required fields' }, 400);
    }

    const BEEM_API_KEY = env.BEEM_API_KEY || '4594d67f9df36874';
    const BEEM_SECRET_KEY = env.BEEM_SECRET_KEY || 'YzRmMjU0OTlhZmFlNTdkODI2ZDAyNWY1YmJkMWYyMWNmZDQ0MDllZGI5MTg2YzE1ZTg5YmE4YTI4NmI1ZTY2Mw==';
    const MY_PHONE = env.MY_PHONE_NUMBER || '255656738253';

    const customerPhoneNormalized = normalizePhone(customerPhone);
    const ownerPhoneNormalized = normalizePhone(MY_PHONE);

    const auth = toBase64(`${BEEM_API_KEY}:${BEEM_SECRET_KEY}`);

    const sendOne = async (phone: string, message: string) => {
      if (!phone) return { ok: false, skipped: true };
      const payload = {
        source_addr: 'Sonko Sound',
        schedule_time: '',
        encoding: 0,
        message,
        recipients: [{ recipient_id: 1, dest_addr: phone }],
      };
      const res = await fetch('https://apisms.beem.africa/v1/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      console.log(`SMS to ${phone} →`, res.ok, text);
      return { ok: res.ok, response: text };
    };

    const results: any[] = [];
    let customerMessage = '';
    let adminMessage = '';

    // ============================================
    // EVENT 1: LOAN CREATED
    // ============================================
    if (event === 'loan_created') {
      const amount = Number(body.amount) || 0;
      const returnDate = String(body.returnDate || '').trim();

      if (amount <= 0 || !returnDate) {
        return json({ success: false, error: 'Missing amount or returnDate' }, 400);
      }

      const dateDMY = formatDateDMY(returnDate);

      // Borrower message (exactly as requested)
      customerMessage =
        `Habari ${customerName}, Umepokea Shilingi ${amount.toLocaleString()}.  ` +
        `Tarehe ya kurejesha ni ${dateDMY}.  Asante`;

      // Admin message
      adminMessage =
        `${customerName} Kakopeshwa Sh ${amount.toLocaleString()} hadi tarehe ${dateDMY}`;

      // 1a. Primary customer
      console.log('Sending to customer:', customerPhoneNormalized);
      const custRes = await sendOne(customerPhoneNormalized, customerMessage);
      results.push({ to: customerPhoneNormalized, role: 'primary', ok: custRes.ok });

      await new Promise(resolve => setTimeout(resolve, 1000));

      // 1b. Admin
      console.log('Sending to admin:', ownerPhoneNormalized);
      const adminRes = await sendOne(ownerPhoneNormalized, adminMessage);
      results.push({ to: ownerPhoneNormalized, role: 'admin', ok: adminRes.ok });

      return json({
        success: true,
        data: {
          customerSent: custRes.ok,
          adminSent: adminRes.ok,
          results,
          customerMessage,
          adminMessage,
          sentLog: results.map(r => ({
            to: r.to,
            role: r.role,
            ok: r.ok,
            message: r.role === 'admin' ? adminMessage : customerMessage,
          })),
        },
        message: `Customer: ${custRes.ok ? 'OK' : 'FAIL'} | Admin: ${adminRes.ok ? 'OK' : 'FAIL'}`,
      });
    }

    // ============================================
    // EVENT 2: LOAN PAID
    // ============================================
    if (event === 'loan_paid') {
      const paidAmount = Number(body.paidAmount) || 0;
      const remaining = Number(body.remaining) || 0;
      const isCompleted = !!body.isCompleted || remaining <= 0;

      if (paidAmount <= 0) {
        return json({ success: false, error: 'Missing paidAmount' }, 400);
      }

      // Borrower message
      if (isCompleted) {
        customerMessage = `Hongera, Umekamilisha mkopo wako wote . Asante`;
      } else {
        customerMessage =
          `Umepunguza mkopo wako, kiasi kilicho baki ni sh ${remaining.toLocaleString()}`;
      }

      // Admin message
      if (isCompleted) {
        adminMessage =
          `${customerName} Amemaliza mkopo wote. Alirejesha Sh ${paidAmount.toLocaleString()}. Asante`;
      } else {
        adminMessage =
          `${customerName} Amepunguza mkopo Sh ${paidAmount.toLocaleString()}, bado Sh ${remaining.toLocaleString()}. Asante`;
      }

      // 2a. Primary customer
      console.log('Sending to customer:', customerPhoneNormalized);
      const custRes = await sendOne(customerPhoneNormalized, customerMessage);
      results.push({ to: customerPhoneNormalized, role: 'primary', ok: custRes.ok });

      await new Promise(resolve => setTimeout(resolve, 1000));

      // 2b. Admin
      console.log('Sending to admin:', ownerPhoneNormalized);
      const adminRes = await sendOne(ownerPhoneNormalized, adminMessage);
      results.push({ to: ownerPhoneNormalized, role: 'admin', ok: adminRes.ok });

      return json({
        success: true,
        data: {
          customerSent: custRes.ok,
          adminSent: adminRes.ok,
          isCompleted,
          results,
          customerMessage,
          adminMessage,
          sentLog: results.map(r => ({
            to: r.to,
            role: r.role,
            ok: r.ok,
            message: r.role === 'admin' ? adminMessage : customerMessage,
          })),
        },
        message: `Customer: ${custRes.ok ? 'OK' : 'FAIL'} | Admin: ${adminRes.ok ? 'OK' : 'FAIL'}`,
      });
    }

    return json({ success: false, error: 'Unknown event. Use "loan_created" or "loan_paid".' }, 400);
  } catch (error: any) {
    console.error('Kopesha SMS Error:', error);
    return json({ success: false, error: error?.message }, 500);
  }
};
