// functions/api/debts/[id].ts

// ============================================
// GET - Fetch single debt
// ============================================
export const onRequestGet = async (context: any) => {
  try {
    const id = context.params.id;

    if (!id) {
      return Response.json(
        { success: false, error: 'Debt ID required' },
        { status: 400 }
      );
    }

    const debt: any = await context.env.DB.prepare(
      `SELECT * FROM debts WHERE id = ? LIMIT 1`
    ).bind(id).first();

    if (!debt) {
      return Response.json(
        { success: false, error: 'Deni halikupatikana' },
        { status: 404 }
      );
    }

    return Response.json({
      ...debt,
      originalDueDate: debt.original_due_date || debt.due_date,
      extensions: debt.extensions ? safeParseJSON(debt.extensions, []) : [],
    });
  } catch (error: any) {
    console.error('❌ Failed to fetch debt:', error);
    return Response.json(
      { success: false, error: error?.message || 'Imeshindwa kupata deni' },
      { status: 500 }
    );
  }
};

// ============================================
// PUT - Update debt (partial — supports edit AND extend)
// ============================================
export const onRequestPut = async (context: any) => {
  try {
    const id = context.params.id;
    const data = await context.request.json();

    console.log('📝 Update debt:', { id, data });

    if (!id) {
      return Response.json(
        { success: false, error: 'Debt ID required' },
        { status: 400 }
      );
    }

    // ✅ Verify debt exists + fetch current values for merge
    const existing: any = await context.env.DB.prepare(
      `SELECT * FROM debts WHERE id = ? LIMIT 1`
    ).bind(id).first();

    if (!existing) {
      return Response.json(
        { success: false, error: 'Deni halikupatikana' },
        { status: 404 }
      );
    }

    // ✅ Only validate fields that were actually sent
    if (data.amount !== undefined) {
      if (!data.amount || Number(data.amount) <= 0) {
        return Response.json(
          { success: false, error: 'Kiasi cha deni kinahitajika' },
          { status: 400 }
        );
      }
    }

    if (data.description !== undefined) {
      if (!data.description || !data.description.trim()) {
        return Response.json(
          { success: false, error: 'Maelezo ya deni yanahitajika' },
          { status: 400 }
        );
      }
    }

    if (data.dueDate !== undefined && !data.dueDate) {
      return Response.json(
        { success: false, error: 'Tarehe ya ukomo inahitajika' },
        { status: 400 }
      );
    }

    // ✅ Build dynamic UPDATE — only touch fields that were sent
    const fields: string[] = [];
    const values: any[] = [];

    if (data.amount !== undefined) {
      fields.push('amount = ?');
      values.push(Number(data.amount));
    }

    if (data.dateBorrowed !== undefined) {
      fields.push('date_borrowed = ?');
      values.push(data.dateBorrowed);
    }

    if (data.dueDate !== undefined) {
      fields.push('due_date = ?');
      values.push(data.dueDate);
    }

    if (data.description !== undefined) {
      fields.push('description = ?');
      values.push(data.description.trim());
    }

    if (data.category !== undefined) {
      fields.push('category = ?');
      values.push(data.category);
    }

    if (data.notes !== undefined) {
      fields.push('notes = ?');
      values.push(data.notes);
    }

    if (data.status !== undefined) {
      fields.push('status = ?');
      values.push(data.status);
    }

    // ✅ original_due_date — only set on first-ever extension
    if (data.originalDueDate !== undefined && !existing.original_due_date) {
      fields.push('original_due_date = ?');
      values.push(data.originalDueDate);
    }

    // ✅ extensions — replace whole array if frontend sent it
    if (Array.isArray(data.extensions)) {
      fields.push('extensions = ?');
      values.push(JSON.stringify(data.extensions));
    }

    // If nothing to update, return existing
    if (fields.length === 0) {
      return Response.json({
        success: true,
        debt: {
          ...existing,
          originalDueDate: existing.original_due_date || existing.due_date,
          extensions: existing.extensions ? safeParseJSON(existing.extensions, []) : [],
        },
        message: 'Hakuna mabadiliko',
      });
    }

    fields.push(`updated_at = datetime('now')`);
    values.push(id);

    const sql = `UPDATE debts SET ${fields.join(', ')} WHERE id = ?`;
    await context.env.DB.prepare(sql).bind(...values).run();

    // Log transaction
    try {
      await context.env.DB.prepare(
        `INSERT INTO transactions (id, action_type, description, amount, timestamp)
         VALUES (?, ?, ?, ?, datetime('now'))`
      ).bind(
        `tx-${Date.now()}`,
        data.extensions ? 'Debt Extended' : 'Debt Updated',
        data.extensions
          ? `Extended due date for debt ${id}`
          : `Updated debt: ${existing.description}`,
        Number(existing.amount) || 0
      ).run();
    } catch (e) {
      console.error('⚠️ Transaction log failed:', e);
    }

    const updated: any = await context.env.DB.prepare(
      `SELECT * FROM debts WHERE id = ? LIMIT 1`
    ).bind(id).first();

    return Response.json({
      success: true,
      debt: {
        ...updated,
        originalDueDate: updated.original_due_date || updated.due_date,
        extensions: updated.extensions ? safeParseJSON(updated.extensions, []) : [],
      },
      message: data.extensions ? 'Ukomo umeongezwa' : 'Deni limehaririwa',
    });
  } catch (error: any) {
    console.error('❌ Failed to update debt:', error);
    return Response.json(
      { success: false, error: error?.message || 'Imeshindwa kuhariri deni' },
      { status: 500 }
    );
  }
};

// ============================================
// DELETE - Delete debt + payments
// ============================================
export const onRequestDelete = async (context: any) => {
  try {
    const id = context.params.id;

    console.log('🗑️ Delete debt:', id);

    if (!id) {
      return Response.json(
        { success: false, error: 'Debt ID required' },
        { status: 400 }
      );
    }

    const existing = await context.env.DB.prepare(
      `SELECT id, description, amount FROM debts WHERE id = ? LIMIT 1`
    ).bind(id).first();

    if (!existing) {
      return Response.json(
        { success: false, error: 'Deni halikupatikana' },
        { status: 404 }
      );
    }

    // Delete associated payments first
    const paymentsResult = await context.env.DB.prepare(
      `DELETE FROM payments WHERE debt_id = ?`
    ).bind(id).run();

    console.log('🗑️ Deleted payments:', paymentsResult.meta?.changes || 0);

    // Delete the debt
    await context.env.DB.prepare(
      `DELETE FROM debts WHERE id = ?`
    ).bind(id).run();

    // Log transaction
    try {
      await context.env.DB.prepare(
        `INSERT INTO transactions (id, action_type, description, amount, timestamp)
         VALUES (?, ?, ?, ?, datetime('now'))`
      ).bind(
        `tx-${Date.now()}`,
        'Debt Deleted',
        `Deleted debt: ${(existing as any).description}`,
        Number((existing as any).amount)
      ).run();
    } catch (e) {
      console.error('⚠️ Transaction log failed:', e);
    }

    return Response.json({
      success: true,
      message: 'Deni limefutwa',
      deletedPayments: paymentsResult.meta?.changes || 0,
    });
  } catch (error: any) {
    console.error('❌ Failed to delete debt:', error);
    return Response.json(
      { success: false, error: error?.message || 'Imeshindwa kufuta deni' },
      { status: 500 }
    );
  }
};

// ============================================
// Helper: Safe JSON parse
// ============================================
function safeParseJSON(raw: string | null, fallback: any) {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}
