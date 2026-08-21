
export const onRequestGet = async (context: any) => {
  try {
    const [customers, products, payments] = await Promise.all([
      context.env.DB.prepare('SELECT * FROM installment_customers ORDER BY created_at DESC').all(),
      context.env.DB.prepare('SELECT * FROM installment_products ORDER BY created_at DESC').all(),
      context.env.DB.prepare('SELECT * FROM installment_payments ORDER BY payment_date DESC').all()
    ]);
    
    return Response.json({
      customers: customers.results || [],
      products: products.results || [],
      payments: payments.results || []
    });
  } catch (error) {
    console.error('Error fetching installment data:', error);
    return Response.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
};
