export const onRequestGet = async (context: any) => {
  try {
    const url = new URL(context.request.url);
    const productId = url.searchParams.get('product_id');
    const customerId = url.searchParams.get('customer_id');
    
    if (productId) {
      const { results } = await context.env.DB.prepare(
        'SELECT * FROM installment_payments WHERE product_id = ? ORDER BY payment_date DESC'
      ).bind(productId).all();
      
      return Response.json(results || []);
    } else if (customerId) {
      const { results } = await context.env.DB.prepare(
        `SELECT ip.*, p.product_name, c.full_name as customer_name
         FROM installment_payments ip
         JOIN installment_products p ON ip.product_id = p.id
         JOIN installment_customers c ON p.customer_id = c.id
         WHERE p.customer_id = ?
         ORDER BY ip.payment_date DESC`
      ).bind(customerId).all();
      
      return Response.json(results || []);
    } else {
      const { results } = await context.env.DB.prepare(
        `SELECT ip.*, p.product_name, c.full_name as customer_name
         FROM installment_payments ip
         JOIN installment_products p ON ip.product_id = p.id
         JOIN installment_customers c ON p.customer_id = c.id
         ORDER BY ip.payment_date DESC`
      ).all();
      
      return Response.json(results || []);
    }
  } catch (error) {
    console.error('Error fetching installment payments:', error);
    return Response.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
};

export const onRequestPost = async (context: any) => {
  try {
    const payment = await context.request.json();
    
    if (!payment.productId || !payment.amount || payment.amount <= 0) {
      return Response.json({ error: 'Product ID and valid amount are required' }, { status: 400 });
    }
    
    const paymentId = payment.id || `ipay-${Date.now()}`;
    const paymentDate = payment.paymentDate || new Date().toISOString().split('T')[0];
    
    // Insert payment
    await context.env.DB.prepare(
      `INSERT INTO installment_payments (
        id, product_id, amount, payment_date, payment_method, notes, receipt_number, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(
      paymentId,
      payment.productId,
      payment.amount,
      paymentDate,
      payment.paymentMethod || 'Cash',
      payment.notes || '',
      payment.receiptNumber || ''
    ).run();
    
    // Update product paid amount and status
    await context.env.DB.prepare(
      `UPDATE installment_products 
       SET paid_amount = paid_amount + ?,
           status = CASE 
             WHEN paid_amount + ? >= total_amount THEN 'Completed' 
             ELSE status 
           END
       WHERE id = ?`
    ).bind(payment.amount, payment.amount, payment.productId).run();
    
    // Get updated product info
    const product = await context.env.DB.prepare(
      'SELECT * FROM installment_products WHERE id = ?'
    ).bind(payment.productId).first();
    
    // Log payment transaction
    await context.env.DB.prepare(
      `INSERT INTO installment_transactions (
        id, customer_id, product_id, transaction_type, amount, description, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(
      `itrans-${Date.now()}`,
      product?.customer_id || null,
      payment.productId,
      'Payment Received',
      payment.amount,
      `Payment of ${payment.amount} for ${product?.product_name || 'product'}`
    ).run();
    
    return Response.json({
      success: true,
      payment: {
        id: paymentId,
        product_id: payment.productId,
        amount: payment.amount,
        payment_date: paymentDate,
        payment_method: payment.paymentMethod || 'Cash',
        notes: payment.notes || '',
        receipt_number: payment.receiptNumber || '',
        created_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error creating installment payment:', error);
    return Response.json({ error: 'Failed to create payment' }, { status: 500 });
  }
};
