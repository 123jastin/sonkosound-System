export const onRequestPut = async (context: any) => {
  const { currentPin, newPin } = await context.request.json();
  
  const hashedCurrent = await hashPassword(currentPin);
  
  const setting = await context.env.DB.prepare(
    'SELECT password_hash FROM settings WHERE id = 1'
  ).first();
  
  if (setting.password_hash !== hashedCurrent) {
    return new Response(JSON.stringify({ error: 'PIN ya sasa si sahihi' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const hashedNew = await hashPassword(newPin);
  await context.env.DB.prepare(
    'UPDATE settings SET password_hash = ?, updated_at = datetime("now") WHERE id = 1'
  ).bind(hashedNew).run();
  
  return Response.json({ success: true });
};

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
