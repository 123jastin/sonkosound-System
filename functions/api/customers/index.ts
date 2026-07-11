export const onRequestGet = async (context: any) => {
  const { results } = await context.env.DB.prepare(
    'SELECT * FROM customers ORDER BY created_at DESC'
  ).all();
  
  return Response.json(results);
};

export const onRequestPost = async (context: any) => {
  const customer = await context.request.json();
  
  await context.env.DB.prepare(
    `INSERT INTO customers (id, full_name, phone_number, address, business_name, notes, photo_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).bind(
    customer.id || `cust-${Date.now()}`,
    customer.fullName,
    customer.phoneNumber,
    customer.address || '',
    customer.businessName || '',
    customer.notes || '',
    customer.photoUrl || ''
  ).run();
  
  await logTransaction(context.env.DB, 'Customer Created', `Registered customer: ${customer.fullName}`);
  
  return Response.json({ success: true });
};

async function logTransaction(db: any, actionType: string, description: string, amount: number = 0) {
  await db.prepare(
    `INSERT INTO transactions (id, action_type, description, amount, timestamp)
     VALUES (?, ?, ?, ?, datetime('now'))`
  ).bind(`tx-${Date.now()}`, actionType, description, amount).run();
}
