// functions/api/debts/bulk-extend.ts
// POST — extend due date for multiple debts at once

export const onRequestPost = async (context: any) => {
  try {
    const body = await context.request.json();
    const { debtIds, newDueDate, reason } = body;

    if (!Array.isArray(debtIds) || debtIds.length === 0) {
      return Response.json(
        { success: false, error: 'debtIds zinahitajika' },
        { status: 400 }
      );
    }

    if (!newDueDate) {
      return Response.json(
        { success: false, error: 'Tarehe mpya inahitajika' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    let updatedCount = 0;
    const updatedDebts: any[] = [];

    for (const id of debtIds) {
      const debt: any = await context.env.DB.prepare(
        `SELECT * FROM debts WHERE id = ? LIMIT 1`
      ).bind(id).first();

      if (!debt) continue;
      if (debt.due_date === newDueDate) continue;
      if (new Date(newDueDate) <= new Date(debt.due_date)) continue;

      const originalDueDate = debt.original_due_date || debt.due_date;

      let existingExtensions: any[] = [];
      try {
        existingExtensions = debt.extensions ? JSON.parse(debt.extensions) : [];
        if (!Array.isArray(existingExtensions)) existingExtensions = [];
      } catch {
        existingExtensions = [];
      }

      const extension = {
        id: `ext-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        oldDueDate: debt.due_date,
        newDueDate: newDueDate,
        reason: (reason || '').trim() || `Umeongezwa kwa madeni yote`,
        extendedAt: now,
      };

      const newExtensions = [...existingExtensions, extension];

      await context.env.DB.prepare(
        `UPDATE debts SET 
          due_date = ?,
          original_due_date = ?,
          extensions = ?,
          status = 'Active',
          updated_at = datetime('now')
        WHERE id = ?`
      ).bind(
        newDueDate,
        originalDueDate,
        JSON.stringify(newExtensions),
        id
      ).run();

      updatedDebts.push({ id, oldDueDate: debt.due_date, newDueDate });
      updatedCount++;
    }

    return Response.json({
      success: true,
      updated: updatedCount,
      debts: updatedDebts,
      message: `Ukomo umeongezwa kwa madeni ${updatedCount}`,
    });
  } catch (error: any) {
    console.error('❌ Bulk extend failed:', error);
    return Response.json(
      { success: false, error: error?.message || 'Imeshindwa kuongeza muda' },
      { status: 500 }
    );
  }
};
