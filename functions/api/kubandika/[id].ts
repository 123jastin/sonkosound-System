// functions/api/kubandika/[id].ts
// GET    /api/kubandika/:id    — fetch single
// PUT    /api/kubandika/:id    — update
// DELETE /api/kubandika/:id    — delete
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
// GET — fetch single
// ============================================================
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { params, env } = context;

  try {
    const row: any = await env.DB.prepare(
      'SELECT * FROM kubandika_payments WHERE id = ? LIMIT 1'
    ).bind(params.id).first();

    if (!row) return jsonResponse({ success: false, error: 'Haipatikani' }, 404);
    return jsonResponse(rowToPayment(row));
  } catch (error: any) {
    console.error('❌ Failed to fetch kubandika payment:', error);
    return jsonResponse(
      { success: false, error: error?.message || 'Imeshindwa kupata rekodi' },
      500
    );
  }
};

// ============================================================
// PUT — update
// ============================================================
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { request, params, env } = context;

  try {
    const id = params.id as string;
    const body: any = await request.json();

    const existing: any = await env.DB.prepare(
      'SELECT * FROM kubandika_payments WHERE id = ? LIMIT 1'
    ).bind(id).first();

    if (!existing) {
      return jsonResponse({ success: false, error: 'Haipatikani' }, 404);
    }

    const fields: string[] = [];
    const values: any[] = [];

    if (body.region !== undefined) {
      if (!['Tz', 'China'].includes(body.region)) {
        return jsonResponse(
          { success: false, error: 'Eneo linahitajika' },
          400
        );
      }
      fields.push('region = ?');
      values.push(body.region);
    }
    if (body.amount !== undefined) {
      if (Number(body.amount) <= 0) {
        return jsonResponse(
          { success: false, error: 'Kiasi kinahitajika' },
          400
        );
      }
      fields.push('amount = ?');
      values.push(Number(body.amount));
    }
    if (body.date !== undefined) {
      fields.push('date = ?');
      values.push(body.date);
    }
    if (body.method !== undefined) {
      fields.push('method = ?');
      values.push(body.method);
    }
    if (body.receivedFrom !== undefined || body.received_from !== undefined) {
      fields.push('received_from = ?');
      values.push(body.receivedFrom ?? body.received_from ?? '');
    }
    if (body.notes !== undefined) {
      fields.push('notes = ?');
      values.push(body.notes);
    }

    if (fields.length === 0) {
      return jsonResponse(rowToPayment(existing));
    }

    fields.push("updated_at = datetime('now')");
    values.push(id);

    const sql = `UPDATE kubandika_payments SET ${fields.join(', ')} WHERE id = ?`;
    await env.DB.prepare(sql).bind(...values).run();

    const updated: any = await env.DB.prepare(
      'SELECT * FROM kubandika_payments WHERE id = ? LIMIT 1'
    ).bind(id).first();

    return jsonResponse({
      success: true,
      payment: rowToPayment(updated),
      message: 'Imesahihishwa',
    });
  } catch (error: any) {
    console.error('❌ Failed to update kubandika payment:', error);
    return jsonResponse(
      { success: false, error: error?.message || 'Imeshindwa kuhariri' },
      500
    );
  }
};

// ============================================================
// DELETE — remove
// ============================================================
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { params, env } = context;

  try {
    const result = await env.DB.prepare(
      'DELETE FROM kubandika_payments WHERE id = ?'
    ).bind(params.id).run();

    if (!result.success || (result.meta && result.meta.changes === 0)) {
      return jsonResponse({ success: false, error: 'Haipatikani' }, 404);
    }

    return jsonResponse({ success: true, deleted: params.id });
  } catch (error: any) {
    console.error('❌ Failed to delete kubandika payment:', error);
    return jsonResponse(
      { success: false, error: error?.message || 'Imeshindwa kufuta' },
      500
    );
  }
};
