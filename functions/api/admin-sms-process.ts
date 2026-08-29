// functions/api/admin-sms-process.ts
import type { PagesFunction } from '@cloudflare/workers-types';

type Env = {
  DB: D1Database;
  BEEM_API_KEY: string;
  BEEM_SECRET_KEY: string;
};

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

const toBase64 = (value: string) => btoa(value);

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const BEEM_API_KEY = env.BEEM_API_KEY || '4594d67f9df36874';
    const BEEM_SECRET_KEY = env.BEEM_SECRET_KEY || 'YzRmMjU0OTlhZmFlNTdkODI2ZDAyNWY1YmJkMWYyMWNmZDQ0MDllZGI5MTg2YzE1ZTg5YmE4YTI4NmI1ZTY2Mw==';

    // Get pending admin messages
    const { results: pendingMessages } = await env.DB.prepare(`
      SELECT * FROM sms_queue 
      WHERE recipient_type = 'admin' 
      AND status = 'pending' 
      AND attempts < max_attempts 
      ORDER BY created_at ASC 
      LIMIT 5
    `).all();

    console.log(`📬 Found ${pendingMessages?.length || 0} pending admin messages`);

    if (!pendingMessages || pendingMessages.length === 0) {
      return json({ success: true, processed: 0, message: 'No pending admin messages' });
    }

    let sentCount = 0;
    let failedCount = 0;
    const results = [];

    for (const msg of pendingMessages as any[]) {
      console.log(`📤 Sending admin message ${msg.id} to ${msg.recipient_phone}`);
      
      // Update attempts
      await env.DB.prepare(`
        UPDATE sms_queue SET attempts = attempts + 1, last_attempt_at = datetime('now') WHERE id = ?
      `).bind(msg.id).run();

      const payload = {
        source_addr: 'Sonko Sound',
        schedule_time: '',
        encoding: 0,
        message: msg.message,
        recipients: [{ recipient_id: 1, dest_addr: msg.recipient_phone }],
      };

      const auth = toBase64(`${BEEM_API_KEY}:${BEEM_SECRET_KEY}`);

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
        console.log(`📱 Admin SMS Response for ${msg.id}:`, rawText);

        let parsed: any = null;
        try { parsed = JSON.parse(rawText); } catch { parsed = { raw: rawText }; }

        if (response.ok && !parsed?.error) {
          // Mark as sent
          await env.DB.prepare(`
            UPDATE sms_queue SET status = 'sent', sent_at = datetime('now') WHERE id = ?
          `).bind(msg.id).run();
          
          sentCount++;
          results.push({ id: msg.id, success: true });
          console.log(`✅ Admin SMS sent: ${msg.id}`);
        } else {
          await env.DB.prepare(`
            UPDATE sms_queue SET status = 'failed', error_message = ? WHERE id = ?
          `).bind(parsed?.message || rawText, msg.id).run();
          
          failedCount++;
          results.push({ id: msg.id, success: false, error: parsed?.message });
          console.log(`❌ Admin SMS failed: ${msg.id}`);
        }
      } catch (err: any) {
        await env.DB.prepare(`
          UPDATE sms_queue SET status = 'failed', error_message = ? WHERE id = ?
        `).bind(err.message, msg.id).run();
        
        failedCount++;
        results.push({ id: msg.id, success: false, error: err.message });
      }

      // Wait 2 seconds between messages
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return json({
      success: true,
      processed: pendingMessages.length,
      sent: sentCount,
      failed: failedCount,
      results,
    });
  } catch (error: any) {
    console.error('❌ Admin SMS Processor Error:', error);
    return json({ success: false, error: error?.message }, 500);
  }
};
