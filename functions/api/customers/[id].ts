// functions/api/customers/[id].ts

// ============================================
// PUT — update customer
// ============================================
export const onRequestPut = async (context: any) => {
  const id = context.params.id;
  const data = await context.request.json();

  if (!id) {
    return Response.json(
      { success: false, error: 'Customer ID required' },
      { status: 400 }
    );
  }

  if (!data.fullName || !data.fullName.trim()) {
    return Response.json(
      { success: false, error: 'Jina la mteja linahitajika' },
      { status: 400 }
    );
  }

  if (!data.phoneNumber || !data.phoneNumber.trim()) {
    return Response.json(
      { success: false, error: 'Namba ya simu inahitajika' },
      { status: 400 }
    );
  }

  // ✅ Serialize contacts array → JSON string
  const contactsJson = Array.isArray(data.contacts)
    ? JSON.stringify(data.contacts)
    : '[]';

  await context.env.DB.prepare(
    `UPDATE customers SET 
      full_name = ?, phone_number = ?, address = ?, 
      business_name = ?, notes = ?, photo_url = ?,
      contacts = ?,
      updated_at = datetime('now')
    WHERE id = ?`
  ).bind(
    data.fullName.trim(),
    data.phoneNumber.trim(),
    data.address || '',
    data.businessName || '',
    data.notes || '',
    data.photoUrl || '',
    contactsJson,
    id
  ).run();

  return Response.json({ success: true });
};

// ============================================
// DELETE — remove customer
// ============================================
export const onRequestDelete = async (context: any) => {
  const id = context.params.id;

  if (!id) {
    return Response.json(
      { success: false, error: 'Customer ID required' },
      { status: 400 }
    );
  }

  await context.env.DB.prepare('DELETE FROM customers WHERE id = ?').bind(id).run();

  return Response.json({ success: true });
};
