export const onRequestGet = async (context: any) => {
  const { results: suppliers } = await context.env.DB.prepare(
    'SELECT * FROM suppliers ORDER BY created_at DESC'
  ).all();
  
  // Get products and payments for each supplier
  const suppliersWithDetails = await Promise.all(
    suppliers.map(async (supplier: any) => {
      const { results: products } = await context.env.DB.prepare(
        'SELECT * FROM supplier_products WHERE supplier_id = ? ORDER BY created_at ASC'
      ).bind(supplier.id).all();
      
      const { results: payments } = await context.env.DB.prepare(
        'SELECT * FROM supplier_payments WHERE supplier_id = ? ORDER BY created_at ASC'
      ).bind(supplier.id).all();
      
      return {
        ...supplier,
        products,
        payments
      };
    })
  );
  
  return Response.json(suppliersWithDetails);
};

export const onRequestPost = async (context: any) => {
  const supplier = await context.request.json();
  
  await context.env.DB.prepare(
    `INSERT INTO suppliers (id, name, phone_number, amount, paid_amount, due_date, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).bind(
    supplier.id || `sup-${Date.now()}`,
    supplier.name,
    supplier.phoneNumber,
    supplier.amount || 0,
    supplier.paidAmount || 0,
    supplier.dueDate,
    supplier.notes || ''
  ).run();
  
  await logTransaction(
    context.env.DB,
    'Supplier Created',
    `Registered supplier: ${supplier.name}`,
    supplier.amount
  );
  
  return Response.json({ success: true });
};

async function logTransaction(db: any, actionType: string, description: string, amount: number = 0) {
  await db.prepare(
    `INSERT INTO transactions (id, action_type, description, amount, timestamp)
     VALUES (?, ?, ?, ?, datetime('now'))`
  ).bind(`tx-${Date.now()}`, actionType, description, amount).run();
}
