export const onRequestPut = async (context: any) => {
  const id = context.params.id;
  const data = await context.request.json();
  
  await context.env.DB.prepare(
    `UPDATE customers SET 
      full_name = ?, phone_number = ?, address = ?, 
      business_name = ?, notes = ?, photo_url = ?,
      updated_at = datetime('now')
    WHERE id = ?`
  ).bind(
    data.fullName, data.phoneNumber, data.address || '',
    data.businessName || '', data.notes || '', data.photoUrl || '', id
  ).run();
  
  return Response.json({ success: true });
};

export const onRequestDelete = async (context: any) => {
  const id = context.params.id;
  
  await context.env.DB.prepare('DELETE FROM customers WHERE id = ?').bind(id).run();
  
  return Response.json({ success: true });
};
