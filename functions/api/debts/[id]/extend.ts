// functions/api/debts/[id]/extend.ts
// POST — extend a single debt's due date

export const onRequestPost = async (context: any) => {
  try {
    const id = context.params.id;
    const body = await context.request.json();
    const { newDueDate, reason } = body;

    if (!id) {
      return Response.json(
        { success: false, error: 'Debt ID required' },
        { status: 400 }
      );
    }

    if (!newDueDate) {
      return Response.json(
        { success: false, error: 'Tarehe mpya inahitajika' },
        { status: 400 }
      );
    }

    // Fetch current debt
    const debt: any = await context.env.DB.prepare(
      `SELECT * FROM debts WHERE id = ? LIMIT 1`
    ).bind(id).first();

    if (!debt) {
      return Response.json(
        { success: false, error: 'Deni halikupatikana' },
        { status: 404 }
      );
    }

    // Validate: new date must be after current
    if (new Date(newDueDate) <= new Date(debt.due_date)) {
      return Response.json(
        { success: false, error: 'Tarehe mpya lazima iwe baada ya ukomo wa sasa' },
        { status: 400 }
      );
    }

    // ✅ Derive original_due_date from DB (not from request)
    const originalDueDate = debt.original_due_date || debt.due_date;

    // Build extension entry
    const extension = {
      id: `ext-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      oldDueDate: debt.due_date,
      newDueDate: newDueDate,
      reason: (reason || '').trim(),
      extendedAt: new Date().toISOString(),
    };

    // Parse existing extensions safely
    let existingExtensions: any[] = [];
    try {
      existingExtensions = debt.extensions ? JSON.parse(debt.extensions) : [];
      if (!Array.isArray(existingExtensions)) existingExtensions = [];
    } catch {
      existingExtensions = [];
    }

    const newExtensions = [...existingExtensions, extension];

    // Update
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

    // Log transaction
    try {
      await context.env.DB.prepare(
        `INSERT INTO transactions (id, action_type, description, amount, timestamp)
         VALUES (?, ?, ?, ?, datetime('now'))`
      ).bind(
        `tx-${Date.now()}`,
        'Debt Extended',
        `Extended due date for ${debt.description}: ${debt.due_date} → ${newDueDate}`,
        Number(debt.amount) || 0
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
        extensions: updated.extensions ? JSON.parse(updated.extensions) : [],
      },
      message: `Ukomo umeongezwa hadi ${newDueDate}`,
    });
  } catch (error: any) {
    console.error('❌ Failed to extend debt:', error);
    return Response.json(
      { success: false, error: error?.message || 'Imeshindwa kuongeza muda' },
      { status: 500 }
    );
  }
};
