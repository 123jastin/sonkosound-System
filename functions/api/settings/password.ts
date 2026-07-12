// functions/api/settings/password.ts
export const onRequestPut = async (context: any) => {
  const { currentPin, newPin } = await context.request.json();
  
  const cleanCurrentPin = currentPin.trim();
  const cleanNewPin = newPin.trim();
  
  const setting = await context.env.DB.prepare(
    'SELECT password_hash FROM settings WHERE id = 1'
  ).first();
  
  if (setting.password_hash !== cleanCurrentPin) {
    return new Response(JSON.stringify({ error: 'PIN ya sasa si sahihi' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  await context.env.DB.prepare(
    'UPDATE settings SET password_hash = ?, updated_at = datetime("now") WHERE id = 1'
  ).bind(cleanNewPin).run();
  
  return Response.json({ success: true });
};
