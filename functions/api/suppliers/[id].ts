export const onRequestPut = async (context: any) => {
  const id = context.params.id;
  const data = await context.request.json();
  
  await context.env.DB.prepare(
    `UPDATE suppliers SET 
      name = ?, phone_number = ?, amount = ?, 
      paid_amount = ?, due_date = ?, notes = ?,
      updated_at = datetime('now')
    WHERE id = ?`
  ).bind(
    data.name, data.phoneNumber, data.amount,
    data.paidAmount || 0, data.dueDate, data.notes || '', id
  ).run();
  
  return Response.json({ success: true });
};

export const onRequestDelete = async (context: any) => {
  const id = context.params.id;
  
  await context.env.DB.prepare('DELETE FROM supplier_payments WHERE supplier_id = ?').bind(id).run();
  await context.env.DB.prepare('DELETE FROM supplier_products WHERE supplier_id = ?').bind(id).run();
  await context.env.DB.prepare('DELETE FROM suppliers WHERE id = ?').bind(id).run();
  
  return Response.json({ success: true });
};
