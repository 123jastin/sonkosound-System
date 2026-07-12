// functions/api/auth/login.ts
export const onRequestPost = async (context: any) => {
  const { pin } = await context.request.json();
  
  // Trim whitespace
  const cleanPin = pin.trim();
  
  const setting = await context.env.DB.prepare(
    'SELECT password_hash FROM settings WHERE id = 1'
  ).first();
  
  // Simple direct comparison
  if (setting && setting.password_hash === cleanPin) {
    return Response.json({ success: true, token: 'authenticated' });
  }
  
  return new Response(JSON.stringify({ error: 'PIN si sahihi' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' }
  });
};
