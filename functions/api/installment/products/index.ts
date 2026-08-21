export const onRequestGet = async (context: any) => {
  try {
    const url = new URL(context.request.url);
    const customerId = url.searchParams.get('customer_id');
    
    if (customerId) {
      const { results } = await context.env.DB.prepare(
        'SELECT * FROM installment_products WHERE customer_id = ? ORDER BY created_at DESC'
      ).bind(customerId).all();
      
      return Response.json(results || []);
    } else {
      const { results } = await context.env.DB.prepare(
        `SELECT p.*, c.full_name as customer_name, c.phone_number as customer_phone
         FROM installment_products p
         JOIN installment_customers c ON p.customer_id = c.id
         ORDER BY p.created_at DESC`
      ).all();
      
      return Response.json(results || []);
    }
  } catch (error) {
    console.error('Error fetching installment products:', error);
    return Response.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
};

export const onRequestPost = async (context: any) => {
  try {
    const product = await context.request.json();
    
    if (!product.customerId || !product.productName || !product.totalAmount) {
      return Response.json({ error: 'Customer ID, product name, and total amount are required' }, { status: 400 });
    }
    
    const productId = product.id || `iprod-${Date.now()}`;
    const startDate = product.startDate || new Date().toISOString().split('T')[0];
    
    await context.env.DB.prepare(
      `INSERT INTO installment_products (
        id, customer_id, product_name, description, total_amount, 
        paid_amount, start_date, expected_completion_date, status, notes, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(
      productId,
      product.customerId,
      product.productName,
      product.description || '',
      product.totalAmount,
      product.paidAmount || 0,
      startDate,
      product.expectedCompletionDate || '',
      product.status || 'Active',
      product.notes || ''
    ).run();
    
    // Log transaction
    await context.env.DB.prepare(
      `INSERT INTO installment_transactions (id, customer_id, product_id, transaction_type, amount, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(
      `itrans-${Date.now()}`,
      product.customerId,
      productId,
      'Product Added',
      product.totalAmount,
      `New installment product: ${product.productName}`
    ).run();
    
    return Response.json({
      success: true,
      product: {
        id: productId,
        customer_id: product.customerId,
        product_name: product.productName,
        description: product.description || '',
        total_amount: product.totalAmount,
        paid_amount: product.paidAmount || 0,
        start_date: startDate,
        expected_completion_date: product.expectedCompletionDate || '',
        status: product.status || 'Active',
        notes: product.notes || '',
        created_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error creating installment product:', error);
    return Response.json({ error: 'Failed to create product' }, { status: 500 });
  }
};
