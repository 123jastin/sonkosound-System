export const onRequestPost = async (context: any) => {
  const product = await context.request.json();
  
  await context.env.DB.prepare(
    `INSERT INTO supplier_products (id, supplier_id, description, amount, due_date, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
  ).bind(
    product.id || `prod-${Date.now()}`,
    product.supplierId,
    product.description,
    product.amount,
    product.dueDate,
    product.notes || ''
  ).run();
  
  // Update supplier total amount and due date
  await context.env.DB.prepare(
    'UPDATE suppliers SET amount = amount + ?, due_date = ?, updated_at = datetime("now") WHERE id = ?'
  ).bind(product.amount, product.dueDate, product.supplierId).run();
  
  return Response.json({ success: true });
};
