export const onRequestGet = async (context: any) => {
  try {
    const stats = await context.env.DB.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM installment_customers) as total_customers,
        (SELECT COUNT(*) FROM installment_products) as total_products,
        (SELECT COALESCE(SUM(total_amount), 0) FROM installment_products) as total_expected,
        (SELECT COALESCE(SUM(paid_amount), 0) FROM installment_products) as total_collected,
        (SELECT COALESCE(SUM(total_amount - paid_amount), 0) 
         FROM installment_products 
         WHERE paid_amount < total_amount) as total_remaining,
        (SELECT COUNT(*) 
         FROM installment_products 
         WHERE status = 'Active' AND paid_amount < total_amount) as active_installments,
        (SELECT COUNT(*) 
         FROM installment_products 
         WHERE status = 'Completed' OR paid_amount >= total_amount) as completed_installments
    `).first();
    
    return Response.json(stats || {});
  } catch (error) {
    console.error('Error fetching installment stats:', error);
    return Response.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
};
