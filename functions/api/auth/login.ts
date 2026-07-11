export const onRequestPost = async (context: any) => {
  const { pin } = await context.request.json();
  
  const hashedPin = await hashPassword(pin);
  
  const setting = await context.env.DB.prepare(
    'SELECT password_hash FROM settings WHERE id = 1'
  ).first();
  
  if (setting && setting.password_hash === hashedPin) {
    return Response.json({ success: true, token: 'authenticated' });
  }
  
  return new Response(JSON.stringify({ error: 'PIN si sahihi' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' }
  });
};

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
