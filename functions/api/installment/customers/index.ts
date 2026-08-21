export const onRequestGet = async (context: any) => {
  try {
    const { results } = await context.env.DB.prepare(
      'SELECT * FROM installment_customers ORDER BY created_at DESC'
    ).all();
    
    return Response.json(results || []);
  } catch (error) {
    console.error('Error fetching installment customers:', error);
    return Response.json({ error: 'Failed to fetch customers' }, { status: 500 });
  }
};

export const onRequestPost = async (context: any) => {
  try {
    const customer = await context.request.json();
    
    if (!customer.fullName || !customer.phoneNumber) {
      return Response.json({ error: 'Full name and phone number are required' }, { status: 400 });
    }
    
    const customerId = customer.id || `icust-${Date.now()}`;
    
    await context.env.DB.prepare(
      `INSERT INTO installment_customers (id, full_name, phone_number, address, notes, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`
    ).bind(
      customerId,
      customer.fullName,
      customer.phoneNumber,
      customer.address || '',
      customer.notes || ''
    ).run();
    
    await logInstallmentTransaction(context.env.DB, 'Customer Created', `Registered installment customer: ${customer.fullName}`);
    
    return Response.json({ 
      success: true,
      customer: {
        id: customerId,
        full_name: customer.fullName,
        phone_number: customer.phoneNumber,
        address: customer.address || '',
        notes: customer.notes || '',
        created_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error creating installment customer:', error);
    return Response.json({ error: 'Failed to create customer' }, { status: 500 });
  }
};

// Helper function
async function logInstallmentTransaction(db: any, actionType: string, description: string, amount: number = 0, customerId?: string, productId?: string) {
  await db.prepare(
    `INSERT INTO installment_transactions (id, customer_id, product_id, transaction_type, amount, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
  ).bind(
    `itrans-${Date.now()}`,
    customerId || null,
    productId || null,
    actionType,
    amount,
    description
  ).run();
}
