import type { PagesFunction } from '@cloudflare/workers-types';

type Env = {
  DB: D1Database;
  BEEM_API_KEY: string;
  BEEM_SECRET_KEY: string;
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const toBase64 = (value: string) => btoa(value);

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const BEEM_API_KEY = env.BEEM_API_KEY || '4594d67f9df36874';
    const BEEM_SECRET_KEY = env.BEEM_SECRET_KEY || 'YzRmMjU0OTlhZmFlNTdkODI2ZDAyNWY1YmJkMWYyMWNmZDQ0MDllZGI5MTg2YzE1ZTg5YmE4YTI4NmI1ZTY2Mw==';

    const { results: pending } = await env.DB.prepare(`
      SELECT * FROM sms_queue 
      WHERE LOWER(status) = 'pending' 
      LIMIT 5
    `).all();

    console.log(`📬 Found ${pending?.length || 0} pending`);

    if (!pending || pending.length === 0) {
      return json({ success: true, processed: 0 });
    }

    let sent = 0;
    const auth = toBase64(`${BEEM_API_KEY}:${BEEM_SECRET_KEY}`);

    for (const msg of pending as any[]) {
      const payload = {
        source_addr: 'Sonko Sound',
        schedule_time: '',
        encoding: 0,
        message: msg.message,
        recipients: [{ recipient_id: 1, dest_addr: msg.recipient_phone }],
      };

      const response = await fetch('https://apisms.beem.africa/v1/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      let result: any = {};
      try { result = JSON.parse(text); } catch { result = { raw: text }; }

      if (response.ok && result.successful) {
        await env.DB.prepare(`UPDATE sms_queue SET status = 'sent' WHERE id = ?`).bind(msg.id).run();
        sent++;
      }

      await new Promise(r => setTimeout(r, 2000));
    }

    return json({ success: true, processed: pending.length, sent });
  } catch (error: any) {
    return json({ success: false, error: error?.message }, 500);
  }
};
