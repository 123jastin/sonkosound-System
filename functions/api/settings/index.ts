export const onRequestGet = async (context: any) => {
  const setting = await context.env.DB.prepare(
    'SELECT * FROM settings WHERE id = 1'
  ).first();
  
  return Response.json(setting);
};

export const onRequestPut = async (context: any) => {
  const data = await context.request.json();
  
  await context.env.DB.prepare(
    `UPDATE settings SET 
      business_name = ?, 
      business_address = ?, 
      business_phone = ?,
      updated_at = datetime('now')
    WHERE id = 1`
  ).bind(data.businessName, data.businessAddress, data.businessPhone).run();
  
  return Response.json({ success: true });
};
