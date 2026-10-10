// functions/api/kubandika/index.ts
// GET  /api/kubandika         — list all (optional ?region=Tz|China, ?start, ?end)
// POST /api/kubandika         — create new payment
// ============================================================

interface Env {
  DB: D1Database;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function rowToPayment(row: any) {
  return {
    id: row.id,
    region: row.region,
    amount: row.amount,
    date: row.date,
    method: row.method || 'Cash',
    receivedFrom: row.received_from || '',
    notes: row.notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================
// GET — list payments
// ============================================================
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const url = new URL(request.url);
    const region = url.searchParams.get('region');
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');

    let query = 'SELECT * FROM kubandika_payments';
    const conditions: string[] = [];
    const bindings: any[] = [];

    if (region) {
      conditions.push('region = ?');
      bindings.push(region);
    }
    if (start) {
      conditions.push('date >= ?');
      bindings.push(start);
    }
    if (end) {
      conditions.push('date <= ?');
      bindings.push(end);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY date DESC, created_at DESC';

    const stmt = bindings.length > 0
      ? env.DB.prepare(query).bind(...bindings)
      : env.DB.prepare(query);

    const { results } = await stmt.all();
    const payments = (results || []).map(rowToPayment);

    return jsonResponse(payments);
  } catch (error: any) {
    console.error('❌ Failed to list kubandika payments:', error);
    return jsonResponse(
      { success: false, error: error?.message || 'Failed to load payments' },
      500
    );
  }
};

// ============================================================
// POST — create payment
// ============================================================
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const body: any = await request.json();

    console.log('📝 Create kubandika payment:', body);

    // Validation
    if (!body.region || !['Tz', 'China'].includes(body.region)) {
      return jsonResponse(
        { success: false, error: 'Eneo (Tz/China) linahitajika' },
        400
      );
    }

    if (!body.amount || Number(body.amount) <= 0) {
      return jsonResponse(
        { success: false, error: 'Kiasi kinahitajika' },
        400
      );
    }

    if (!body.date) {
      return jsonResponse(
        { success: false, error: 'Tarehe inahitajika' },
        400
      );
    }

    const id = body.id || `kub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    await env.DB.prepare(
      `INSERT INTO kubandika_payments (
        id, region, amount, date, method, received_from, notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).bind(
      id,
      body.region,
      Number(body.amount),
      body.date,
      body.method || 'Cash',
      body.receivedFrom || body.received_from || '',
      body.notes || ''
    ).run();

    const row: any = await env.DB.prepare(
      'SELECT * FROM kubandika_payments WHERE id = ? LIMIT 1'
    ).bind(id).first();

    return jsonResponse({
      success: true,
      payment: rowToPayment(row),
      message: 'Pesa imeongezwa',
    }, 201);
  } catch (error: any) {
    console.error('❌ Failed to create kubandika payment:', error);
    return jsonResponse(
      { success: false, error: error?.message || 'Imeshindwa kuongeza pesa' },
      500
    );
  }
};
