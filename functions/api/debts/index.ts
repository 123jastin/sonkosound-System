export const onRequestGet = async (context: any) => {
  const { results } = await context.env.DB.prepare(
    'SELECT * FROM debts ORDER BY created_at DESC'
  ).all();
  
  return Response.json(results);
};

export const onRequestPost = async (context: any) => {
  const debt = await context.request.json();
  
  await context.env.DB.prepare(
    `INSERT INTO debts (id, customer_id, amount, date_borrowed, due_date, description, category, notes, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).bind(
    debt.id || `debt-${Date.now()}`,
    debt.customerId,
    debt.amount,
    debt.dateBorrowed,
    debt.dueDate,
    debt.description,
    debt.category || 'Mizigo/Products',
    debt.notes || '',
    debt.status || 'Active'
  ).run();
  
  await logTransaction(
    context.env.DB, 
    'Debt Added', 
    `Added debt of TSh ${Number(debt.amount).toLocaleString()}`, 
    debt.amount
  );
  
  return Response.json({ success: true });
};

async function logTransaction(db: any, actionType: string, description: string, amount: number = 0) {
  await db.prepare(
    `INSERT INTO transactions (id, action_type, description, amount, timestamp)
     VALUES (?, ?, ?, ?, datetime('now'))`
  ).bind(`tx-${Date.now()}`, actionType, description, amount).run();
}
