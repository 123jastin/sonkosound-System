// functions/api/orders/index.ts
import type { PagesFunction } from '@cloudflare/workers-types';

type Env = {
  DB: D1Database;
};

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: cors });

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const customersResult = await env.DB.prepare(`
      SELECT id, full_name, phone_number, address, created_at, updated_at
      FROM order_customers
      ORDER BY datetime(created_at) DESC, rowid DESC
    `).all();

    const ordersResult = await env.DB.prepare(`
      SELECT id, customer_id, customer_name, customer_phone, total_amount, status, notes, 
             shipping_method, shipping_details, created_at, updated_at
      FROM orders
      ORDER BY datetime(created_at) DESC, rowid DESC
    `).all();

    const itemsResult = await env.DB.prepare(`
      SELECT id, order_id, product_name, quantity, unit_price, total_price, created_at
      FROM order_items
      ORDER BY datetime(created_at) ASC, rowid ASC
    `).all();

    const customers = Array.isArray(customersResult.results) ? customersResult.results : [];
    const orders = Array.isArray(ordersResult.results) ? ordersResult.results : [];
    const items = Array.isArray(itemsResult.results) ? itemsResult.results : [];

    // Parse shipping details and group items
    const ordersWithItems = orders.map((order: any) => {
      let shippingInfo = null;
      try {
        if (order.shipping_details) {
          shippingInfo = JSON.parse(order.shipping_details);
        }
      } catch (e) {
        console.error('Failed to parse shipping details:', e);
      }

      return {
        ...order,
        shipping_info: shippingInfo,
        items: items.filter((item: any) => item.order_id === order.id)
      };
    });

    return json({
      success: true,
      customers,
      orders: ordersWithItems,
      items
    });
  } catch (error: any) {
    console.error('Failed to load orders:', error);
    return json({ success: false, error: error?.message }, 500);
  }
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await request.json().catch(() => null);
    
    if (!body) {
      return json({ success: false, error: 'No data provided' }, 400);
    }

    const { customerId, items, notes } = body;

    if (!customerId || !items || !Array.isArray(items) || items.length === 0) {
      return json({ success: false, error: 'Missing required fields' }, 400);
    }

    const customer = await env.DB.prepare(
      `SELECT id, full_name, phone_number FROM order_customers WHERE id = ? LIMIT 1`
    ).bind(customerId).first();

    if (!customer) {
      return json({ success: false, error: 'Customer not found' }, 404);
    }

    const totalAmount = items.reduce((sum: number, item: any) => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unit_price) || 0;
      return sum + (quantity * unitPrice);
    }, 0);

    const orderId = 'ord-' + Date.now();

    await env.DB.prepare(`
      INSERT INTO orders (id, customer_id, customer_name, customer_phone, total_amount, status, notes, created_at)
      VALUES (?, ?, ?, ?, ?, 'Pending', ?, datetime('now'))
    `).bind(
      orderId,
      customerId,
      (customer as any).full_name,
      (customer as any).phone_number,
      totalAmount,
      notes || ''
    ).run();

    for (const item of items) {
      const itemId = 'oi-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unit_price) || 0;
      const totalPrice = quantity * unitPrice;

      await env.DB.prepare(`
        INSERT INTO order_items (id, order_id, product_name, quantity, unit_price, total_price, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        itemId,
        orderId,
        item.product_name,
        quantity,
        unitPrice,
        totalPrice
      ).run();
    }

    const orderResult = await env.DB.prepare(
      `SELECT id, customer_id, customer_name, customer_phone, total_amount, status, notes, created_at
       FROM orders WHERE id = ? LIMIT 1`
    ).bind(orderId).first();

    const itemsResult = await env.DB.prepare(
      `SELECT id, order_id, product_name, quantity, unit_price, total_price, created_at
       FROM order_items WHERE order_id = ? ORDER BY datetime(created_at) ASC, rowid ASC`
    ).bind(orderId).all();

    const orderWithItems = {
      ...(orderResult as any),
      items: itemsResult.results || []
    };

    return json({
      success: true,
      order: orderWithItems,
      message: 'Oda imehifadhiwa kikamilifu'
    });
  } catch (error: any) {
    console.error('Failed to create order:', error);
    return json({ success: false, error: error?.message }, 500);
  }
};
