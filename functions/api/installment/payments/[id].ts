export const onRequestGet = async (context: any) => {
  try {
    const paymentId = context.params.id;
    
    const payment = await context.env.DB.prepare(
      'SELECT * FROM installment_payments WHERE id = ?'
    ).bind(paymentId).first();
    
    if (!payment) {
      return Response.json({ error: 'Payment not found' }, { status: 404 });
    }
    
    return Response.json(payment);
  } catch (error) {
    console.error('Error fetching installment payment:', error);
    return Response.json({ error: 'Failed to fetch payment' }, { status: 500 });
  }
};

export const onRequestDelete = async (context: any) => {
  try {
    const paymentId = context.params.id;
    
    await context.env.DB.prepare(
      'DELETE FROM installment_payments WHERE id = ?'
    ).bind(paymentId).run();
    
    return Response.json({ success: true });
  } catch (error) {
    console.error('Error deleting installment payment:', error);
    return Response.json({ error: 'Failed to delete payment' }, { status: 500 });
  }
};
