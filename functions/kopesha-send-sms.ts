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

// YYYY-MM-DD → DD/MM/YYYY
const formatDateDMY = (dateStr: string): string => {
  const s = String(dateStr || '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return s;
};

async function sendSingleSMS(params: {
  apiKey: string;
  secretKey: string;
  message: string;
  phone: string;
}) {
  const payload = {
    source_addr: 'Sonko Sound',
    schedule_time: '',
    encoding: 0,
    message: params.message,
    recipients: [{ recipient_id: 1, dest_addr: params.phone }],
  };
  const auth = toBase64(`${params.apiKey}:${params.secretKey}`);

  try {
    const res = await fetch('https://apisms.beem.africa/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    return { success: res.ok, response: text };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Send failed' };
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body: any = await request.json().catch(() => null);
    if (!body) return json({ error: 'No data' }, 400);

    const BEEM_API_KEY = env.BEEM_API_KEY || '4594d67f9df36874';
    const BEEM_SECRET_KEY = env.BEEM_SECRET_KEY || 'YzRmMjU0OTlhZmFlNTdkODI2ZDAyNWY1YmJkMWYyMWNmZDQ0MDllZGI5MTg2YzE1ZTg5YmE4YTI4NmI1ZTY2Mw==';
    const MY_PHONE = env.MY_PHONE_NUMBER || '255656738253';
    const adminPhone = normalizePhone(MY_PHONE);

    // ============================================
    // CASE 1: NEW LOAN
    // ============================================
    if (body.event === 'loan_created') {
      const customerName = String(body.customerName || '').trim();
      const customerPhone = normalizePhone(body.customerPhone);
      const amount = Number(body.amount) || 0;
      const returnDate = String(body.returnDate || '').trim();

      if (!customerName || !customerPhone || amount <= 0 || !returnDate) {
        return json({ error: 'Missing loan fields' }, 400);
      }

      const dateDMY = formatDateDMY(returnDate);

      // Borrower message (exactly as requested)
      const borrowerMsg =
        `Habari ${customerName}, Umepokea Shilingi ${amount.toLocaleString()}.  ` +
        `Tarehe ya kurejesha ni ${dateDMY}.  Asante`;

      // Admin message
      const adminMsg =
        `${customerName} Kakopeshwa Sh ${amount.toLocaleString()} hadi tarehe ${dateDMY}`;

      const borrowerRes = await sendSingleSMS({
        apiKey: BEEM_API_KEY,
        secretKey: BEEM_SECRET_KEY,
        phone: customerPhone,
        message: borrowerMsg,
      });

      await new Promise(r => setTimeout(r, 1000));

      const adminRes = await sendSingleSMS({
        apiKey: BEEM_API_KEY,
        secretKey: BEEM_SECRET_KEY,
        phone: adminPhone,
        message: adminMsg,
      });

      return json({
        success: true,
        data: {
          borrowerSent: borrowerRes.success,
          adminSent: adminRes.success,
          borrowerMessage: borrowerMsg,
          adminMessage: adminMsg,
        },
      });
    }

    // ============================================
    // CASE 2: REPAYMENT
    // ============================================
    if (body.event === 'loan_paid') {
      const customerName = String(body.customerName || '').trim();
      const customerPhone = normalizePhone(body.customerPhone);
      const paidAmount = Number(body.paidAmount) || 0;
      const remaining = Number(body.remaining) || 0;
      const isCompleted = !!body.isCompleted || remaining <= 0;

      if (!customerName || !customerPhone || paidAmount <= 0) {
        return json({ error: 'Missing payment fields' }, 400);
      }

      // Borrower message
      let borrowerMsg = '';
      if (isCompleted) {
        borrowerMsg = `Hongera, Umekamilisha mkopo wako wote . Asante`;
      } else {
        borrowerMsg =
          `Umepunguza mkopo wako, kiasi kilicho baki ni sh ${remaining.toLocaleString()}`;
      }

      // Admin message (your format — same pattern as lending)
      const adminMsg = isCompleted
        ? `${customerName} Amemaliza mkopo wote. Alirejesha Sh ${paidAmount.toLocaleString()}.`
        : `${customerName} Amepunguza mkopo Sh ${paidAmount.toLocaleString()}, baki Sh ${remaining.toLocaleString()}.`;

      const borrowerRes = await sendSingleSMS({
        apiKey: BEEM_API_KEY,
        secretKey: BEEM_SECRET_KEY,
        phone: customerPhone,
        message: borrowerMsg,
      });

      await new Promise(r => setTimeout(r, 1000));

      const adminRes = await sendSingleSMS({
        apiKey: BEEM_API_KEY,
        secretKey: BEEM_SECRET_KEY,
        phone: adminPhone,
        message: adminMsg,
      });

      return json({
        success: true,
        data: {
          borrowerSent: borrowerRes.success,
          adminSent: adminRes.success,
          borrowerMessage: borrowerMsg,
          adminMessage: adminMsg,
        },
      });
    }

    return json({ error: 'Unknown event. Use "loan_created" or "loan_paid".' }, 400);
  } catch (error: any) {
    console.error('Kopesha SMS error:', error);
    return json({ error: error?.message || 'SMS failed' }, 500);
  }
};
