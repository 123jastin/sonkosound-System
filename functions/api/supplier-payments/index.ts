export const onRequestPost = async (context: any) => {
  const payment = await context.request.json();
  
  await context.env.DB.prepare(
    `INSERT INTO supplier_payments (id, supplier_id, amount, date, notes, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`
  ).bind(
    payment.id || `spay-${Date.now()}`,
    payment.supplierId,
    payment.amount,
    payment.date,
    payment.notes || ''
  ).run();
  
  // Update supplier paid amount
  await context.env.DB.prepare(
    'UPDATE suppliers SET paid_amount = MIN(amount, paid_amount + ?), updated_at = datetime("now") WHERE id = ?'
  ).bind(payment.amount, payment.supplierId).run();
  
  return Response.json({ success: true });
};
