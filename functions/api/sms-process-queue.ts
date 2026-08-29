// functions/api/sms-process-queue.ts
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
      error: !response.ok ? (parsed?.message || rawText) : null,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const BEEM_API_KEY = env.BEEM_API_KEY || '4594d67f9df36874';
    const BEEM_SECRET_KEY = env.BEEM_SECRET_KEY || 'YzRmMjU0OTlhZmFlNTdkODI2ZDAyNWY1YmJkMWYyMWNmZDQ0MDllZGI5MTg2YzE1ZTg5YmE4YTI4NmI1ZTY2Mw==';

    // Get pending messages
    const { results: pendingMessages } = await env.DB.prepare(`
      SELECT * FROM sms_queue 
      WHERE status = 'pending' 
      AND attempts < max_attempts 
      ORDER BY created_at ASC 
      LIMIT 5
    `).all();

    console.log(`📬 Processing ${pendingMessages?.length || 0} pending messages`);

    if (!pendingMessages || pendingMessages.length === 0) {
      return json({ success: true, processed: 0, message: 'No pending messages' });
    }

    let sentCount = 0;

    for (const msg of pendingMessages as any[]) {
      console.log(`📤 Sending message ${msg.id} to ${msg.recipient_phone}`);
      
      await env.DB.prepare(`
        UPDATE sms_queue SET attempts = attempts + 1, last_attempt_at = datetime('now') WHERE id = ?
      `).bind(msg.id).run();

      const result = await sendSingleSMS({
        apiKey: BEEM_API_KEY,
        secretKey: BEEM_SECRET_KEY,
        message: msg.message,
        phone: msg.recipient_phone,
      });

      if (result.success) {
        await env.DB.prepare(`
          UPDATE sms_queue SET status = 'sent', sent_at = datetime('now') WHERE id = ?
        `).bind(msg.id).run();
        sentCount++;
        console.log(`✅ Sent: ${msg.id}`);
      } else {
        await env.DB.prepare(`
          UPDATE sms_queue SET status = 'failed', error_message = ? WHERE id = ?
        `).bind(result.error || 'Unknown error', msg.id).run();
        console.log(`❌ Failed: ${msg.id} - ${result.error}`);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return json({ success: true, processed: pendingMessages.length, sent: sentCount });
  } catch (error: any) {
    console.error('❌ Queue error:', error);
    return json({ success: false, error: error?.message }, 500);
  }
};
