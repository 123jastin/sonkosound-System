// functions/api/auth/login.ts
export const onRequestPost = async (context: any) => {
  try {
    const body: any = await context.request.json().catch(() => null);
    const pin = body?.pin;
    const cleanPin = (pin || '').trim();

    if (!cleanPin) {
      return Response.json(
        { success: false, error: 'PIN inahitajika' },
        { status: 400 }
      );
    }

    // ✅ FIX: context.env.DB (not context.DB)
    const setting: any = await context.env.DB.prepare(
      'SELECT password_hash, admin_pin FROM settings WHERE id = 1'
    ).first();

    if (!setting) {
      return Response.json(
        { success: false, error: 'Settings not found. Weka PIN kwenye database.' },
        { status: 500 }
      );
    }

    // 1. Check Admin PIN
    if (setting.admin_pin && setting.admin_pin === cleanPin) {
      return Response.json({
        success: true,
        token: 'admin-session',
        role: 'admin',
      });
    }

    // 2. Check Staff PIN
    if (setting.password_hash && setting.password_hash === cleanPin) {
      return Response.json({
        success: true,
        token: 'staff-session',
        role: 'staff',
      });
    }

    return Response.json(
      { success: false, error: 'PIN si sahihi' },
      { status: 401 }
    );
  } catch (error: any) {
    console.error('Login error:', error);
    return Response.json(
      { success: false, error: error?.message || 'Server error' },
      { status: 500 }
    );
  }
};
