// functions/api/debts/index.ts

// ============================================
// GET - List debts (with optional customer filter)
// ============================================
export const onRequestGet = async (context: any) => {
  try {
    const url = new URL(context.request.url);
    const customerId = url.searchParams.get('customerId');

    let query = 'SELECT * FROM debts';
    const bindings: any[] = [];

    if (customerId) {
      query += ' WHERE customer_id = ?';
      bindings.push(customerId);
    }

    query += ' ORDER BY created_at DESC';

    const stmt = bindings.length > 0
      ? context.env.DB.prepare(query).bind(...bindings)
      : context.env.DB.prepare(query);

    const { results } = await stmt.all();

    return Response.json(results || []);
  } catch (error: any) {
    console.error('❌ Failed to list debts:', error);
    return Response.json(
      { success: false, error: error?.message || 'Failed to load debts' },
      { status: 500 }
    );
  }
};

// ============================================
// POST - Create new debt
// ============================================
export const onRequestPost = async (context: any) => {
  try {
    const debt = await context.request.json();

    console.log('📝 Create debt request:', debt);

    // Validation
    if (!debt.customerId) {
      return Response.json(
        { success: false, error: 'Mteja anahitajika' },
        { status: 400 }
      );
    }

    if (!debt.amount || Number(debt.amount) <= 0) {
      return Response.json(
        { success: false, error: 'Kiasi cha deni kinahitajika' },
        { status: 400 }
      );
    }

    if (!debt.dueDate) {
      return Response.json(
        { success: false, error: 'Tarehe ya ukomo inahitajika' },
        { status: 400 }
      );
    }

    if (!debt.description || !debt.description.trim()) {
      return Response.json(
        { success: false, error: 'Maelezo ya deni yanahitajika' },
        { status: 400 }
      );
    }

    const debtId = debt.id || `debt-${Date.now()}`;

    await context.env.DB.prepare(
      `INSERT INTO debts (
        id, customer_id, amount, date_borrowed, due_date, 
        description, category, notes, status, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).bind(
      debtId,
      debt.customerId,
      Number(debt.amount),
      debt.dateBorrowed || new Date().toISOString().split('T')[0],
      debt.dueDate,
      debt.description.trim(),
      debt.category || 'Mizigo/Products',
      debt.notes || '',
      debt.status || 'Active'
    ).run();

    // Log transaction
    await logTransaction(
      context.env.DB,
      'Debt Added',
      `Added debt of TSh ${Number(debt.amount).toLocaleString()} - ${debt.description}`,
      Number(debt.amount)
    );

    // Return created debt
    const created = await context.env.DB.prepare(
      `SELECT * FROM debts WHERE id = ? LIMIT 1`
    ).bind(debtId).first();

    return Response.json({
      success: true,
      debt: created,
      message: 'Deni limeongezwa'
    });
  } catch (error: any) {
    console.error('❌ Failed to create debt:', error);
    return Response.json(
      { success: false, error: error?.message || 'Imeshindwa kuongeza deni' },
      { status: 500 }
    );
  }
};

// ============================================
// Helper: Log transaction
// ============================================
async function logTransaction(
  db: any,
  actionType: string,
  description: string,
  amount: number = 0
) {
  try {
    await db.prepare(
      `INSERT INTO transactions (id, action_type, description, amount, timestamp)
       VALUES (?, ?, ?, ?, datetime('now'))`
    ).bind(`tx-${Date.now()}`, actionType, description, amount).run();
  } catch (error) {
    console.error('⚠️ Failed to log transaction:', error);
  }
}
