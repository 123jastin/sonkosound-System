export const onRequestGet = async (context: any) => {
  try {
    const productId = context.params.id;
    
    const product = await context.env.DB.prepare(
      'SELECT * FROM installment_products WHERE id = ?'
    ).bind(productId).first();
    
    if (!product) {
      return Response.json({ error: 'Product not found' }, { status: 404 });
    }
    
    const payments = await context.env.DB.prepare(
      'SELECT * FROM installment_payments WHERE product_id = ? ORDER BY payment_date DESC'
    ).bind(productId).all();
    
    return Response.json({
      ...product,
      payments: payments.results || []
    });
  } catch (error) {
    console.error('Error fetching installment product:', error);
    return Response.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
};

export const onRequestPut = async (context: any) => {
  try {
    const productId = context.params.id;
    const product = await context.request.json();
    
    await context.env.DB.prepare(
      `UPDATE installment_products 
       SET product_name = ?, description = ?, total_amount = ?, 
           expected_completion_date = ?, notes = ?
       WHERE id = ?`
    ).bind(
      product.productName,
      product.description || '',
      product.totalAmount,
      product.expectedCompletionDate || '',
      product.notes || '',
      productId
    ).run();
    
    return Response.json({ success: true });
  } catch (error) {
    console.error('Error updating installment product:', error);
    return Response.json({ error: 'Failed to update product' }, { status: 500 });
  }
};

export const onRequestDelete = async (context: any) => {
  try {
    const productId = context.params.id;
    
    await context.env.DB.prepare(
      'DELETE FROM installment_products WHERE id = ?'
    ).bind(productId).run();
    
    return Response.json({ success: true });
  } catch (error) {
    console.error('Error deleting installment product:', error);
    return Response.json({ error: 'Failed to delete product' }, { status: 500 });
  }
};
