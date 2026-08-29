// functions/api/admin-sms-process.ts
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

    console.log('🔍 Checking admin SMS queue...');

    // Get pending admin messages
    const { results: pendingMessages } = await env.DB.prepare(`
      SELECT * FROM sms_queue 
      WHERE recipient_type = 'admin' 
      AND status = 'pending' 
      ORDER BY created_at ASC 
      LIMIT 5
    `).all();

    console.log(`📬 Found ${pendingMessages?.length || 0} pending messages`);

    if (!pendingMessages || pendingMessages.length === 0) {
      return json({ 
        success: true, 
        processed: 0, 
        message: 'No pending admin messages',
        queueCount: 0
      });
    }

    let sentCount = 0;
    let failedCount = 0;
    const details = [];

    for (const msg of pendingMessages as any[]) {
      console.log(`\n📤 Processing message: ${msg.id}`);
      console.log(`📱 To: ${msg.recipient_phone}`);
      console.log(`📝 Message: ${msg.message.substring(0, 50)}...`);

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
        console.log('📤 Sending via Beem API...');
        console.log('📦 Payload:', JSON.stringify(payload));

        const response = await fetch('https://apisms.beem.africa/v1/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${auth}`,
          },
          body: JSON.stringify(payload),
        });

        const rawText = await response.text();
        console.log('📱 Beem Response:', rawText);

        let parsed: any = null;
        try { parsed = JSON.parse(rawText); } catch { parsed = { raw: rawText }; }

        if (response.ok && !parsed?.error) {
          await env.DB.prepare(`
            UPDATE sms_queue SET status = 'sent', sent_at = datetime('now') WHERE id = ?
          `).bind(msg.id).run();
          
          sentCount++;
          details.push({ id: msg.id, phone: msg.recipient_phone, success: true });
          console.log(`✅ Sent: ${msg.id}`);
        } else {
          await env.DB.prepare(`
            UPDATE sms_queue SET status = 'failed', error_message = ? WHERE id = ?
          `).bind(parsed?.message || rawText, msg.id).run();
          
          failedCount++;
          details.push({ id: msg.id, phone: msg.recipient_phone, success: false, error: parsed?.message || rawText });
          console.log(`❌ Failed: ${msg.id} - ${parsed?.message || rawText}`);
        }
      } catch (err: any) {
        await env.DB.prepare(`
          UPDATE sms_queue SET status = 'failed', error_message = ? WHERE id = ?
        `).bind(err.message, msg.id).run();
        
        failedCount++;
        details.push({ id: msg.id, phone: msg.recipient_phone, success: false, error: err.message });
        console.log(`❌ Error: ${msg.id} - ${err.message}`);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return json({
      success: true,
      processed: pendingMessages.length,
      sent: sentCount,
      failed: failedCount,
      details,
    });
  } catch (error: any) {
    console.error('❌ Admin SMS Processor Error:', error);
    return json({ success: false, error: error?.message }, 500);
  }
};
