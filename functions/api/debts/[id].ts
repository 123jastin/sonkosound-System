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

    // ✅ NEW: parse extensions + normalize originalDueDate
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
// PUT - Update debt (also handles due-date extension)
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

    if (!data.amount || Number(data.amount) <= 0) {
      return Response.json(
        { success: false, error: 'Kiasi cha deni kinahitajika' },
        { status: 400 }
      );
    }

    if (!data.dueDate) {
      return Response.json(
        { success: false, error: 'Tarehe ya ukomo inahitajika' },
        { status: 400 }
      );
    }

    if (!data.description || !data.description.trim()) {
      return Response.json(
        { success: false, error: 'Maelezo ya deni yanahitajika' },
        { status: 400 }
      );
    }

    // Verify debt exists + grab current extensions/original_due_date for merge
    const existing: any = await context.env.DB.prepare(
      `SELECT id, original_due_date, extensions FROM debts WHERE id = ? LIMIT 1`
    ).bind(id).first();

    if (!existing) {
      return Response.json(
        { success: false, error: 'Deni halikupatikana' },
        { status: 404 }
      );
    }

    // ✅ NEW: original_due_date — preserve if already set, never overwrite
    const originalDueDate =
      existing.original_due_date ||    // keep first-ever date
      data.originalDueDate ||          // fallback: what frontend sent
      data.dueDate;                    // fallback: current due date

    // ✅ NEW: extensions — array in, JSON string stored
    // If frontend sends extensions → use it. Otherwise keep existing.
    const extensionsJson = Array.isArray(data.extensions)
      ? JSON.stringify(data.extensions)
      : (existing.extensions || '[]');

    // Update all fields
    await context.env.DB.prepare(
      `UPDATE debts SET 
        amount = ?, 
        date_borrowed = ?, 
        due_date = ?, 
        description = ?, 
        category = ?, 
        notes = ?, 
        status = ?,
        original_due_date = ?,
        extensions = ?,
        updated_at = datetime('now')
      WHERE id = ?`
    ).bind(
      Number(data.amount),
      data.dateBorrowed || null,
      data.dueDate,
      data.description.trim(),
      data.category || 'Mizigo/Products',
      data.notes || '',
      data.status || 'Active',
      originalDueDate,                 // ✅ NEW
      extensionsJson,                  // ✅ NEW
      id
    ).run();

    // Log transaction
    try {
      await context.env.DB.prepare(
        `INSERT INTO transactions (id, action_type, description, amount, timestamp)
         VALUES (?, ?, ?, ?, datetime('now'))`
      ).bind(
        `tx-${Date.now()}`,
        'Debt Updated',
        `Updated debt: ${data.description}`,
        Number(data.amount)
      ).run();
    } catch (e) {
      console.error('⚠️ Transaction log failed:', e);
    }

    const updated: any = await context.env.DB.prepare(
      `SELECT * FROM debts WHERE id = ? LIMIT 1`
    ).bind(id).first();

    // ✅ NEW: parse extensions back to array for the response
    return Response.json({
      success: true,
      debt: {
        ...updated,
        originalDueDate: updated.original_due_date || updated.due_date,
        extensions: updated.extensions ? safeParseJSON(updated.extensions, []) : [],
      },
      message: 'Deni limehaririwa'
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
      deletedPayments: paymentsResult.meta?.changes || 0
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
