// functions/api/check-sms-queue.ts
import type { PagesFunction } from '@cloudflare/workers-types';

type Env = {
  DB: D1Database;
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    // Get all messages from queue
    const { results: allMessages } = await env.DB.prepare(`
      SELECT * FROM sms_queue 
      ORDER BY created_at DESC 
      LIMIT 20
    `).all();

    // Get pending messages
    const { results: pendingMessages } = await env.DB.prepare(`
      SELECT * FROM sms_queue 
      WHERE status = 'pending' 
      ORDER BY created_at DESC
    `).all();

    // Get sent messages
    const { results: sentMessages } = await env.DB.prepare(`
      SELECT * FROM sms_queue 
      WHERE status = 'sent' 
      ORDER BY created_at DESC
    `).all();

    return json({
      success: true,
      totalMessages: allMessages?.length || 0,
      pendingMessages: pendingMessages?.length || 0,
      sentMessages: sentMessages?.length || 0,
      allMessages: allMessages || [],
      pending: pendingMessages || [],
      sent: sentMessages || [],
    });
  } catch (error: any) {
    console.error('❌ Check Queue Error:', error);
    return json({ success: false, error: error?.message }, 500);
  }
};
