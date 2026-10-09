// functions/api/debts/bulk-extend.ts
export const onRequestPost = async (context: any) => {
  try {
    const { debtIds, newDueDate, reason } = await context.request.json();

    if (!Array.isArray(debtIds) || !newDueDate) {
      return Response.json(
        { success: false, error: 'debtIds na newDueDate zinahitajika' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    let updatedCount = 0;

    for (const id of debtIds) {
      const debt: any = await context.env.DB
        .prepare('SELECT due_date, original_due_date, extensions FROM debts WHERE id = ?')
        .bind(id).first();

      if (!debt) continue;
      if (debt.due_date === newDueDate) continue;

      const extension = {
        id: `ext-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        oldDueDate: debt.due_date,
        newDueDate,
        reason: reason || '',
        extendedAt: now,
      };

      const existingExts = debt.extensions ? JSON.parse(debt.extensions) : [];
      const newExts = [...existingExts, extension];

      await context.env.DB.prepare(
        `UPDATE debts SET 
          due_date = ?, 
          original_due_date = COALESCE(original_due_date, ?),
          extensions = ?,
          status = 'Active',
          updated_at = datetime('now')
        WHERE id = ?`
      ).bind(
        newDueDate,
        debt.due_date,
        JSON.stringify(newExts),
        id
      ).run();

      updatedCount++;
    }

    return Response.json({
      success: true,
      updated: updatedCount,
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
