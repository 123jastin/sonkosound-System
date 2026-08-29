// functions/api/order-link.ts
import type { PagesFunction } from '@cloudflare/workers-types';

type Env = {
  DB: D1Database;
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

// Generate short code
function generateShortCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// POST: Create short link
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await request.json().catch(() => null);
    
    if (!body) {
      return json({ success: false, error: 'No data provided' }, 400);
    }

    const { orderId, customerName, customerPhone, totalAmount, items, shippingInfo, notes } = body;

    if (!orderId || !customerName || !items) {
      return json({ success: false, error: 'Missing required fields' }, 400);
    }

    // Create table if not exists
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS order_links (
        id TEXT PRIMARY KEY,
        short_code TEXT UNIQUE NOT NULL,
        order_id TEXT NOT NULL,
        customer_name TEXT,
        customer_phone TEXT,
        total_amount REAL,
        items_json TEXT,
        shipping_info_json TEXT,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        clicks INTEGER DEFAULT 0
      )
    `).run();

    // Generate unique short code
    let shortCode = generateShortCode();
    let exists = true;
    
    while (exists) {
      const existing = await env.DB.prepare(`
        SELECT id FROM order_links WHERE short_code = ?
      `).bind(shortCode).first();
      
      if (!existing) {
        exists = false;
      } else {
        shortCode = generateShortCode();
      }
    }

    const id = 'link-' + Date.now();

    // Save link
    await env.DB.prepare(`
      INSERT INTO order_links (id, short_code, order_id, customer_name, customer_phone, total_amount, items_json, shipping_info_json, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      shortCode,
      orderId,
      customerName,
      customerPhone,
      totalAmount,
      JSON.stringify(items),
      shippingInfo ? JSON.stringify(shippingInfo) : null,
      notes || null
    ).run();

    const baseUrl = 'https://deni.sonkosound.store';
    const shortUrl = `${baseUrl}/${shortCode}`;

    return json({
      success: true,
      data: {
        id,
        shortCode,
        shortUrl,
      },
      message: 'Short link created',
    });
  } catch (error: any) {
    console.error('Link creation error:', error);
    return json({ success: false, error: error?.message }, 500);
  }
};

// GET: Redirect or show order
export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  try {
    const url = new URL(request.url);
    const shortCode = url.pathname.split('/').pop();

    if (!shortCode) {
      return json({ success: false, error: 'No short code provided' }, 400);
    }

    const link = await env.DB.prepare(`
      SELECT * FROM order_links WHERE short_code = ?
    `).bind(shortCode).first();

    if (!link) {
      return new Response('Link not found', { status: 404, headers: { 'Content-Type': 'text/html' } });
    }

    // Increment clicks
    await env.DB.prepare(`
      UPDATE order_links SET clicks = clicks + 1 WHERE id = ?
    `).bind(link.id).run();

    // Parse data
    const items = JSON.parse(link.items_json || '[]');
    const shippingInfo = link.shipping_info_json ? JSON.parse(link.shipping_info_json) : null;

    // Generate HTML page
    const html = generateOrderHTML(link, items, shippingInfo);

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' },
    });
  } catch (error: any) {
    return new Response('Error: ' + error.message, { status: 500 });
  }
};

function generateOrderHTML(link: any, items: any[], shippingInfo: any) {
  const itemsHTML = items.map((item: any, index: number) => `
    <tr>
      <td>${index + 1}</td>
      <td>${item.product_name}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:right">TSh ${Number(item.unit_price).toLocaleString()}</td>
      <td style="text-align:right">TSh ${Number(item.total_price).toLocaleString()}</td>
    </tr>
  `).join('');

  const shippingHTML = shippingInfo ? `
    <div class="shipping-box">
      <h3>Taarifa za Usafirishaji</h3>
      <p><strong>Njia:</strong> ${shippingInfo.method === 'BodaBoda' ? 'BodaBoda' : 'Bus'}</p>
      ${shippingInfo.method === 'BodaBoda' ? `
        <p><strong>Jina:</strong> ${shippingInfo.bodaName || '-'}</p>
        <p><strong>Namba:</strong> ${shippingInfo.bodaPhone || '-'}</p>
        ${shippingInfo.bodaPlateNumber ? `<p><strong>Pikipiki:</strong> ${shippingInfo.bodaPlateNumber}</p>` : ''}
      ` : shippingInfo.busName ? `
        <p><strong>Bus/Kampuni:</strong> ${shippingInfo.busName}</p>
        ${shippingInfo.busNumber ? `<p><strong>Namba ya Bus:</strong> ${shippingInfo.busNumber}</p>` : ''}
        ${shippingInfo.cargoNumber ? `<p><strong>Namba ya Mzigo:</strong> ${shippingInfo.cargoNumber}</p>` : ''}
      ` : `
        <p><strong>Dreva:</strong> ${shippingInfo.driverName || '-'}</p>
        <p><strong>Simu ya Dreva:</strong> ${shippingInfo.driverPhone || '-'}</p>
        ${shippingInfo.cargoNumber ? `<p><strong>Namba ya Mzigo:</strong> ${shippingInfo.cargoNumber}</p>` : ''}
      `}
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html>
<head>
  <title>Oda - ${link.customer_name}</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #f8fafc; padding: 20px; color: #1e293b; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden; }
    .header { background: linear-gradient(135deg, #1e3a5f, #3b82f6, #22c55e); color: white; padding: 25px; text-align: center; }
    .business-name { font-size: 24px; font-weight: 900; }
    .business-slogan { font-size: 12px; opacity: 0.9; margin: 5px 0 10px; }
    .order-badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 5px 20px; border-radius: 20px; font-size: 13px; font-weight: bold; }
    .content { padding: 25px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
    .info-card { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 12px; }
    .info-label { color: #0284c7; font-size: 9px; font-weight: 800; text-transform: uppercase; }
    .info-value { font-size: 14px; font-weight: bold; margin-top: 3px; }
    .shipping-box { background: #f0fdf4; border: 1.5px solid #22c55e; border-radius: 8px; padding: 15px; margin: 15px 0; }
    .shipping-box h3 { color: #16a34a; font-size: 14px; margin-bottom: 10px; }
    .shipping-box p { font-size: 13px; margin: 5px 0; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    thead th { background: #1e3a5f; color: white; padding: 10px; text-align: left; font-size: 10px; text-transform: uppercase; }
    tbody td { padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
    .total-section { background: linear-gradient(135deg, #1e3a5f, #3b82f6); color: white; padding: 15px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; margin-top: 15px; }
    .total-amount { font-size: 20px; font-weight: 900; }
    .signature-section { display: flex; justify-content: space-between; margin-top: 30px; gap: 30px; }
    .signature-box { text-align: center; flex: 1; }
    .signature-name { font-size: 13px; font-style: italic; font-weight: 600; color: #1e3a5f; }
    .signature-line { border-top: 1.5px solid #1e3a5f; padding-top: 5px; font-size: 9px; font-weight: bold; color: #64748b; margin-top: 3px; }
    .footer { background: #f8fafc; padding: 15px; text-align: center; font-size: 11px; color: #64748b; }
    .print-btn { display: block; margin: 20px auto; padding: 12px 30px; background: #3b82f6; color: white; border: none; border-radius: 25px; font-size: 14px; font-weight: bold; cursor: pointer; }
    @media print { .print-btn { display: none; } body { background: white; padding: 0; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="business-name">SONKO SOUND</div>
      <div class="business-slogan">Electronics & Appliances</div>
      <div class="order-badge">ODA YA BIDHAA</div>
    </div>
    <div class="content">
      <div class="info-grid">
        <div class="info-card">
          <div class="info-label">Oda ID</div>
          <div class="info-value">${link.order_id}</div>
        </div>
        <div class="info-card">
          <div class="info-label">Tarehe</div>
          <div class="info-value">${new Date(link.created_at).toLocaleDateString('sw-TZ')}</div>
        </div>
        <div class="info-card">
          <div class="info-label">Mteja</div>
          <div class="info-value">${link.customer_name}</div>
        </div>
        <div class="info-card">
          <div class="info-label">Simu</div>
          <div class="info-value">${link.customer_phone}</div>
        </div>
      </div>
      ${shippingHTML}
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Bidhaa</th>
            <th>Idadi</th>
            <th>Bei</th>
            <th>Jumla</th>
          </tr>
        </thead>
        <tbody>${itemsHTML}</tbody>
      </table>
      <div class="total-section">
        <span>JUMLA KUU</span>
        <span class="total-amount">TSh ${Number(link.total_amount).toLocaleString()}</span>
      </div>
      <div class="signature-section">
        <div class="signature-box">
          <div class="signature-name">${link.customer_name}</div>
          <div class="signature-line">Sahihi ya Mteja</div>
        </div>
        <div class="signature-box">
          <div class="signature-name">Sonko Sound</div>
          <div class="signature-line">Sahihi ya Mmiliki</div>
        </div>
      </div>
      <button class="print-btn" onclick="window.print()">Chapisha / Save as PDF</button>
    </div>
    <div class="footer">
      <p>Morogoro, Tanzania | 0656738253</p>
      <p>Asante kwa kufanya biashara nasi!</p>
    </div>
  </div>
</body>
</html>`;
}
