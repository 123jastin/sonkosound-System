// functions/api/customers/index.ts

// ============================================
// GET — list all customers
// ============================================
export const onRequestGet = async (context: any) => {
  const { results } = await context.env.DB.prepare(
    'SELECT * FROM customers ORDER BY created_at DESC'
  ).all();

  // ✅ Parse contacts JSON string → array before sending
  const customers = (results || []).map((row: any) => ({
    ...row,
    contacts: (() => {
      if (!row.contacts) return [];
      try {
        const parsed = JSON.parse(row.contacts);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })(),
  }));

  return Response.json(customers);
};

// ============================================
// POST — create customer
// ============================================
export const onRequestPost = async (context: any) => {
  const customer = await context.request.json();

  // ✅ Serialize contacts array → JSON string
  const contactsJson = Array.isArray(customer.contacts)
    ? JSON.stringify(customer.contacts)
    : '[]';

  await context.env.DB.prepare(
    `INSERT INTO customers (
      id, full_name, phone_number, address, business_name, 
      notes, photo_url, contacts, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).bind(
    customer.id || `cust-${Date.now()}`,
    customer.fullName,
    customer.phoneNumber,
    customer.address || '',
    customer.businessName || '',
    customer.notes || '',
    customer.photoUrl || '',
    contactsJson
  ).run();

  await logTransaction(
    context.env.DB,
    'Customer Created',
    `Registered customer: ${customer.fullName}`
  );

  return Response.json({ success: true });
};

// ============================================
// Helper: Log transaction
// ============================================
async function logTransaction(
  db: any,
  actionType: string,
  description: string,
  amount: number = 0
) {
  await db.prepare(
    `INSERT INTO transactions (id, action_type, description, amount, timestamp)
     VALUES (?, ?, ?, ?, datetime('now'))`
  ).bind(`tx-${Date.now()}`, actionType, description, amount).run();
}
