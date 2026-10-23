// functions/api/auth/login.ts
export const onRequestPost = async (context: any) => {
  const { pin } = await context.request.json();
  const cleanPin = (pin || '').trim();
  
  const setting: any = await context.DB.prepare(
    'SELECT password_hash, admin_pin FROM settings WHERE id = 1'
  ).first();
  
  if (!setting) {
    return Response.json({ error: 'Settings not found' }, { status: 500 });
  }

  // 1. Check if it's the Admin PIN
  if (setting.admin_pin && setting.admin_pin === cleanPin) {
    return Response.json({ 
      success: true, 
      token: 'admin-session',
      role: 'admin' // 👈 Role: admin
    });
  }

  // 2. Check if it's the Staff/Manager PIN
  if (setting.password_hash === cleanPin) {
    return Response.json({ 
      success: true, 
      token: 'staff-session',
      role: 'staff' // 👈 Role: staff
    });
  }
  
  return new Response(JSON.stringify({ error: 'PIN si sahihi' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' }
  });
};
