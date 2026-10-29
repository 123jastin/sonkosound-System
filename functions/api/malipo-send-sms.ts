// functions/api/malipo-send-sms.ts
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

const fmt = (n: number) => Number(n || 0).toLocaleString('en-US');

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await request.json().catch(() => null);
    console.log('Malipo SMS Request:', JSON.stringify(body));

    if (!body) {
      return json({ success: false, error: 'No data provided' }, 400);
    }

    const {
      event,                 // 'job_created' | 'job_paid'
      workerName,
      workerPhone,
      jobName,
      amount,                // total agreed for the job
      paidAmount,            // amount just paid (for job_paid)
      remaining,             // remaining after this payment
      dueDate,               // optional, for job_created
    } = body;

    if (!workerName || !workerPhone || !jobName) {
      return json({ success: false, error: 'Missing required fields' }, 400);
    }

    const BEEM_API_KEY = env.BEEM_API_KEY || '4594d67f9df36874';
    const BEEM_SECRET_KEY = env.BEEM_SECRET_KEY || 'YzRmMjU0OTlhZmFlNTdkODI2ZDAyNWY1YmJkMWYyMWNmZDQ0MDllZGI5MTg2YzE1ZTg5YmE4YTI4NmI1ZTY2Mw==';
    const MY_PHONE = env.MY_PHONE_NUMBER || '255656738253';

    const workerPhoneNorm = normalizePhone(workerPhone);
    const ownerPhoneNorm = normalizePhone(MY_PHONE);

    const numAmount    = Number(amount) || 0;
    const numPaid      = Number(paidAmount) || 0;
    const numRemaining = Number(remaining) || 0;
    const isCompleted  = numRemaining <= 0;

    // ── Build worker + admin messages based on event ──
    let workerMessage = '';
    let adminMessage  = '';

    if (event === 'job_created') {
      // Just informing worker the job exists — no payment yet
      workerMessage =
        `Habari ${workerName}, umepangiwa kazi ya ${jobName}. ` +
        `Makubaliano yetu ni shilingi ${fmt(numAmount)}.` +
        (dueDate ? ` Deadline: ${dueDate}.` : '') +
        ` Asante\n\nSonko Sound Morogoro`;

      adminMessage =
        `Umempangia ${workerName} kazi ya ${jobName} ya shilingi ${fmt(numAmount)}.`;

    } else if (event === 'job_paid') {
      if (isCompleted) {
        // ✅ FINAL PAYMENT — all cleared
        workerMessage =
          `Habari ${workerName}, malipo yote yamekamilika ya shilingi ${fmt(numAmount)} kama ilivyo kwenye makubaliano. Asante\n\nSonko Sound Morogoro`;

        adminMessage =
          `${workerName} amemaliza malipo yote ya kazi ya ${jobName} — shilingi ${fmt(numAmount)}. Kazi imekamilika.`;
      } else {
        // Partial payment
        workerMessage =
          `Habari ${workerName}, umepokea malipo ya shilingi ${fmt(numPaid)} kwa ajili ya kazi ya ${jobName}, ` +
          `Bado shilingi ${fmt(numRemaining)} kukamilisha shilingi ${fmt(numAmount)} ya makubaliano yetu. Asante\n\nSonko Sound Morogoro`;

        adminMessage =
          `${workerName} amelipwa sh ${fmt(numPaid)} ya kazi ya ${jobName} bado sh ${fmt(numRemaining)}.`;
      }

    } else {
      return json({ success: false, error: `Unknown event: ${event}` }, 400);
    }

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

    // ── 1. Worker ──
    console.log('Sending to worker:', workerPhoneNorm);
    const workerRes = await sendOne(workerPhoneNorm, workerMessage);
    results.push({ to: workerPhoneNorm, role: 'worker', ok: workerRes.ok });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // ── 2. Admin ──
    console.log('Sending to admin:', ownerPhoneNorm);
    const adminRes = await sendOne(ownerPhoneNorm, adminMessage);
    results.push({ to: ownerPhoneNorm, role: 'admin', ok: adminRes.ok });

    return json({
      success: true,
      data: {
        workerSent: workerRes.ok,
        adminSent: adminRes.ok,
        results,
        workerMessage,
        adminMessage,
        sentLog: [
          { to: workerPhoneNorm, role: 'worker', ok: workerRes.ok, message: workerMessage },
          { to: ownerPhoneNorm,  role: 'admin',  ok: adminRes.ok,  message: adminMessage  },
        ],
      },
      message: `Worker: ${workerRes.ok ? 'OK' : 'FAIL'} | Admin: ${adminRes.ok ? 'OK' : 'FAIL'}`,
    });
  } catch (error: any) {
    console.error('Malipo SMS Error:', error);
    return json({ success: false, error: error?.message }, 500);
  }
};
