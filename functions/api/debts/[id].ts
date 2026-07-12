export const onRequestPut = async (context: any) => {
  const id = context.params.id;
  const data = await context.request.json();
  
  await context.env.DB.prepare(
    `UPDATE debts SET 
      amount = ?, due_date = ?, description = ?, 
      category = ?, notes = ?, updated_at = datetime('now')
    WHERE id = ?`
  ).bind(data.amount, data.dueDate, data.description, data.category, data.notes || '', id).run();
  
  return Response.json({ success: true });
};

export const onRequestDelete = async (context: any) => {
  const id = context.params.id;
  
  // Delete associated payments first
  await context.env.DB.prepare('DELETE FROM payments WHERE debt_id = ?').bind(id).run();
  await context.env.DB.prepare('DELETE FROM debts WHERE id = ?').bind(id).run();
  
  return Response.json({ success: true });
};
