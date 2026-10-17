// functions/api/send-payment-sms.ts
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

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await request.json().catch(() => null);
    console.log('Payment SMS Request:', JSON.stringify(body));

    if (!body) {
      return json({ success: false, error: 'No data provided' }, 400);
    }

    const { customerName, customerPhone, paidAmount, remainingAmount, contacts = [] } = body;

    if (!customerName || !customerPhone || !paidAmount) {
      return json({ success: false, error: 'Missing required fields' }, 400);
    }

    const BEEM_API_KEY = env.BEEM_API_KEY || '4594d67f9df36874';
    const BEEM_SECRET_KEY = env.BEEM_SECRET_KEY || 'YzRmMjU0OTlhZmFlNTdkODI2ZDAyNWY1YmJkMWYyMWNmZDQ0MDllZGI5MTg2YzE1ZTg5YmE4YTI4NmI1ZTY2Mw==';
    const MY_PHONE = env.MY_PHONE_NUMBER || '255656738253';

    const customerPhoneNormalized = normalizePhone(customerPhone);
    const ownerPhoneNormalized = normalizePhone(MY_PHONE);

    const numPaid = Number(paidAmount) || 0;
    const numRemaining = Number(remainingAmount) || 0;

    // ── PRIMARY customer message — WITH name (unchanged) ──
    let customerMessage = '';
    if (numRemaining <= 0) {
      customerMessage = `Habari, ${customerName} Malipo yako yamepokelewa Sh ${numPaid.toLocaleString()}. Umemaliza malipo yote. Asante Kwa kutuamini\n\nDuka la mziki Sonko Sound Morogoro\nKwa mawasiliano Piga: 0688423753`;
    } else {
      customerMessage = `Habari, ${customerName} Malipo yako yamepokelewa Sh ${numPaid.toLocaleString()}. Bado sh ${numRemaining.toLocaleString()} Kukamilisha. Asante Kwa kutuamini\n\nDuka la mziki Sonko Sound Morogoro\nKwa mawasiliano Piga: 0688423753`;
    }

    // ── ✅ WAWAKILISHI message — SAME wording, name stripped ──
    let contactsMessage = '';
    if (numRemaining <= 0) {
      contactsMessage = `Habari, Malipo yako yamepokelewa Sh ${numPaid.toLocaleString()}. Umemaliza malipo yote. Asante Kwa kutuamini\n\nDuka la mziki Sonko Sound Morogoro\nKwa mawasiliano Piga: 0688423753`;
    } else {
      contactsMessage = `Habari, Malipo yako yamepokelewa Sh ${numPaid.toLocaleString()}. Bado sh ${numRemaining.toLocaleString()} Kukamilisha. Asante Kwa kutuamini\n\nDuka la mziki Sonko Sound Morogoro\nKwa mawasiliano Piga: 0688423753`;
    }

    // ── Admin message (unchanged) ──
    const adminMessage = `${customerName} Amepunguza sh ${numPaid.toLocaleString()} bado ${numRemaining.toLocaleString()}. Asante`;

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

    // ── 1. Primary customer (name included) ──
    console.log('Sending to customer:', customerPhoneNormalized);
    const custRes = await sendOne(customerPhoneNormalized, customerMessage);
    results.push({ to: customerPhoneNormalized, role: 'primary', ok: custRes.ok });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // ── 2. ✅ Wawakilishi — no name mentioned ──
    if (Array.isArray(contacts) && contacts.length > 0) {
      console.log(`Sending to ${contacts.length} wawakilishi (no name)...`);
      for (const contact of contacts) {
        const phone = normalizePhone(contact?.phone);
        if (!phone) continue;

        const res = await sendOne(phone, contactsMessage);   // 👈 no name
        results.push({
          to: phone,
          role: contact?.role || 'wawakilishi',
          name: contact?.name || '',
          ok: res.ok,
        });

        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // ── 3. Admin (unchanged) ──
    console.log('Sending to admin:', ownerPhoneNormalized);
    const adminRes = await sendOne(ownerPhoneNormalized, adminMessage);
    results.push({ to: ownerPhoneNormalized, role: 'admin', ok: adminRes.ok });

    return json({
      success: true,
      data: {
        customerSent: custRes.ok,
        adminSent: adminRes.ok,
        contactsSent: results.filter(r => r.role !== 'primary' && r.role !== 'admin').length,
        results,
        customerMessage,
        wawakilishiMessage: contactsMessage,   // ✅ what wawakilishi received
        adminMessage,
        sentLog: results.map(r => ({
          to: r.to,
          role: r.role,
          name: r.name || '',
          ok: r.ok,
          message:
            r.role === 'admin' ? adminMessage :
            r.role === 'primary' ? customerMessage :
            contactsMessage,
        })),
      },
      message: `Customer: ${custRes.ok ? 'OK' : 'FAIL'} | Wawakilishi: ${results.filter(r => r.role !== 'primary' && r.role !== 'admin').filter(r => r.ok).length}/${results.filter(r => r.role !== 'primary' && r.role !== 'admin').length} | Admin: ${adminRes.ok ? 'OK' : 'FAIL'}`,
    });
  } catch (error: any) {
    console.error('Payment SMS Error:', error);
    return json({ success: false, error: error?.message }, 500);
  }
};
