// functions/api/kopesha/index.ts
import type { PagesFunction } from '@cloudflare/workers-types';

type Env = { DB: D1Database };

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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
    const [customersRes, loansRes, paymentsRes] = await Promise.all([
      env.DB.prepare(`SELECT * FROM kopesha_customers ORDER BY created_at DESC`).all(),
      env.DB.prepare(`SELECT * FROM kopesha_loans ORDER BY created_at DESC`).all(),
      env.DB.prepare(`SELECT * FROM kopesha_payments ORDER BY created_at DESC`).all(),
    ]);

    return json({
      customers: customersRes.results || [],
      loans: loansRes.results || [],
      payments: paymentsRes.results || [],
    });
  } catch (error: any) {
    console.error('Kopesha GET error:', error);
    return json({ error: error?.message || 'Failed to load kopesha data' }, 500);
  }
};
