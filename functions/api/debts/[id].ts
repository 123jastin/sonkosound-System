// functions/api/payments/[id].ts

// ============================================
// PUT - Update payment (fix Zilizolipwa typos)
// ============================================
export const onRequestPut = async (context: any) => {
  try {
    const id = context.params.id;
    const data = await context.request.json();

    console.log('💵 Update payment:', { id, data });

    if (!id) {
      return Response.json(
        { success: false, error: 'Payment ID required' },
        { status: 400 }
      );
    }

    if (!data.amount || Number(data.amount) <= 0) {
      return Response.json(
        { success: false, error: 'Kiasi cha malipo kinahitajika' },
        { status: 400 }
      );
    }

    // Verify payment exists
    const existing = await context.env.DB.prepare(
      `SELECT id, debt_id, amount FROM payments WHERE id = ? LIMIT 1`
    ).bind(id).first();

    if (!existing) {
      return Response.json(
        { success: false, error: 'Malipo hayakupatikana' },
        { status: 404 }
      );
    }

    // Verify the new amount doesn't exceed the debt total
    const debtId = (existing as any).debt_id;
    const debt = await context.env.DB.prepare(
      `SELECT id, amount FROM debts WHERE id = ? LIMIT 1`
    ).bind(debtId).first();

    if (debt) {
      const debtTotal = Number((debt as any).amount);
      
      // Sum of OTHER payments (excluding this one)
      const otherPaymentsResult = await context.env.DB.prepare(
        `SELECT COALESCE(SUM(amount), 0) as total 
         FROM payments 
         WHERE debt_id = ? AND id != ?`
      ).bind(debtId, id).first();

      const otherPaid = Number((otherPaymentsResult as any)?.total || 0);
      const newTotalPaid = otherPaid + Number(data.amount);

      if (newTotalPaid > debtTotal) {
        return Response.json(
          { 
            success: false, 
            error: `Jumla ya malipo (TSh ${newTotalPaid.toLocaleString()}) haiwezi kuzidi deni la awali (TSh ${debtTotal.toLocaleString()})` 
          },
          { status: 400 }
        );
      }
    }

    // Update the payment
    await context.env.DB.prepare(
      `UPDATE payments SET 
        amount = ?, 
        date = ?, 
        payment_method = ?, 
        notes = ?,
        updated_at = datetime('now')
      WHERE id = ?`
    ).bind(
      Number(data.amount),
      data.date || new Date().toISOString().split('T')[0],
      data.paymentMethod || 'Cash',
      data.notes || '',
      id
    ).run();

    // Log transaction
    try {
      await context.env.DB.prepare(
        `INSERT INTO transactions (id, action_type, description, amount, timestamp)
         VALUES (?, ?, ?, ?, datetime('now'))`
      ).bind(
        `tx-${Date.now()}`,
        'Payment Updated',
        `Updated payment to TSh ${Number(data.amount).toLocaleString()}`,
        Number(data.amount)
      ).run();
    } catch (e) {
      console.error('⚠️ Transaction log failed:', e);
    }

    const updated = await context.env.DB.prepare(
      `SELECT * FROM payments WHERE id = ? LIMIT 1`
    ).bind(id).first();

    return Response.json({
      success: true,
      payment: updated,
      message: 'Malipo yamehaririwa'
    });
  } catch (error: any) {
    console.error('❌ Failed to update payment:', error);
    return Response.json(
      { success: false, error: error?.message || 'Imeshindwa kuhariri malipo' },
      { status: 500 }
    );
  }
};

// ============================================
// DELETE - Delete single payment
// ============================================
export const onRequestDelete = async (context: any) => {
  try {
    const id = context.params.id;

    console.log('🗑️ Delete payment:', id);

    if (!id) {
      return Response.json(
        { success: false, error: 'Payment ID required' },
        { status: 400 }
      );
    }

    const existing = await context.env.DB.prepare(
      `SELECT id, amount FROM payments WHERE id = ? LIMIT 1`
    ).bind(id).first();

    if (!existing) {
      return Response.json(
        { success: false, error: 'Malipo hayakupatikana' },
        { status: 404 }
      );
    }

    await context.env.DB.prepare(
      `DELETE FROM payments WHERE id = ?`
    ).bind(id).run();

    // Log transaction
    try {
      await context.env.DB.prepare(
        `INSERT INTO transactions (id, action_type, description, amount, timestamp)
         VALUES (?, ?, ?, ?, datetime('now'))`
      ).bind(
        `tx-${Date.now()}`,
        'Payment Deleted',
        `Deleted payment of TSh ${Number((existing as any).amount).toLocaleString()}`,
        Number((existing as any).amount)
      ).run();
    } catch (e) {
      console.error('⚠️ Transaction log failed:', e);
    }

    return Response.json({
      success: true,
      message: 'Malipo yamefutwa'
    });
  } catch (error: any) {
    console.error('❌ Failed to delete payment:', error);
    return Response.json(
      { success: false, error: error?.message || 'Imeshindwa kufuta malipo' },
      { status: 500 }
    );
  }
};
