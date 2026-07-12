export const onRequestGet = async (context: any) => {
  const { results } = await context.env.DB.prepare(
    'SELECT * FROM payments ORDER BY created_at DESC'
  ).all();
  
  return Response.json(results);
};

export const onRequestPost = async (context: any) => {
  const payment = await context.request.json();
  
  await context.env.DB.prepare(
    `INSERT INTO payments (id, debt_id, amount, date, payment_method, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
  ).bind(
    payment.id || `pay-${Date.now()}`,
    payment.debtId,
    payment.amount,
    payment.date,
    payment.paymentMethod || 'Cash',
    payment.notes || ''
  ).run();
  
  await logTransaction(
    context.env.DB,
    'Payment Added',
    `Recorded payment of TSh ${Number(payment.amount).toLocaleString()}`,
    payment.amount
  );
  
  return Response.json({ success: true });
};

async function logTransaction(db: any, actionType: string, description: string, amount: number = 0) {
  await db.prepare(
    `INSERT INTO transactions (id, action_type, description, amount, timestamp)
     VALUES (?, ?, ?, ?, datetime('now'))`
  ).bind(`tx-${Date.now()}`, actionType, description, amount).run();
}
