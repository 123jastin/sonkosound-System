export const onRequestGet = async (context: any) => {
  try {
    const customerId = context.params.id;
    
    const customer = await context.env.DB.prepare(
      'SELECT * FROM installment_customers WHERE id = ?'
    ).bind(customerId).first();
    
    if (!customer) {
      return Response.json({ error: 'Customer not found' }, { status: 404 });
    }
    
    const products = await context.env.DB.prepare(
      'SELECT * FROM installment_products WHERE customer_id = ? ORDER BY created_at DESC'
    ).bind(customerId).all();
    
    const payments = await context.env.DB.prepare(
      `SELECT ip.*, p.product_name 
       FROM installment_payments ip
       JOIN installment_products p ON ip.product_id = p.id
       WHERE p.customer_id = ?
       ORDER BY ip.payment_date DESC`
    ).bind(customerId).all();
    
    return Response.json({
      ...customer,
      products: products.results || [],
      payments: payments.results || []
    });
  } catch (error) {
    console.error('Error fetching installment customer:', error);
    return Response.json({ error: 'Failed to fetch customer' }, { status: 500 });
  }
};

export const onRequestPut = async (context: any) => {
  try {
    const customerId = context.params.id;
    const customer = await context.request.json();
    
    await context.env.DB.prepare(
      `UPDATE installment_customers 
       SET full_name = ?, phone_number = ?, address = ?, notes = ?
       WHERE id = ?`
    ).bind(
      customer.fullName,
      customer.phoneNumber,
      customer.address || '',
      customer.notes || '',
      customerId
    ).run();
    
    return Response.json({ success: true });
  } catch (error) {
    console.error('Error updating installment customer:', error);
    return Response.json({ error: 'Failed to update customer' }, { status: 500 });
  }
};

export const onRequestDelete = async (context: any) => {
  try {
    const customerId = context.params.id;
    
    // Delete customer (cascade will delete products and payments)
    await context.env.DB.prepare(
      'DELETE FROM installment_customers WHERE id = ?'
    ).bind(customerId).run();
    
    return Response.json({ success: true });
  } catch (error) {
    console.error('Error deleting installment customer:', error);
    return Response.json({ error: 'Failed to delete customer' }, { status: 500 });
  }
};
