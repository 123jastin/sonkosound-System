import { query } from './_shared/db';

// Helper function to handle CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

export default async function handler(req: Request) {
  // Handle OPTIONS for CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace('/api/installment', '');
  const method = req.method;
  
  console.log('Installment API called:', method, path);

  try {
    // Route based on path
    if (path === '' || path === '/') {
      return handleGetAllData();
    } else if (path === '/stats') {
      return handleStats();
    } else if (path.startsWith('/customers')) {
      return handleCustomers(req, method, path.replace('/customers', ''));
    } else if (path.startsWith('/products')) {
      return handleProducts(req, method, path.replace('/products', ''));
    } else if (path.startsWith('/payments')) {
      return handlePayments(req, method, path.replace('/payments', ''));
    }

    return new Response(JSON.stringify({ error: 'Route not found', path }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('Installment API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// Handle Customer routes
async function handleCustomers(req: Request, method: string, path: string) {
  const url = new URL(req.url);
  const customerId = url.searchParams.get('id') || path.replace('/', '');

  console.log('Customer route:', method, customerId);

  switch (method) {
    case 'GET':
      if (customerId) {
        // Get single customer
        const customers = await query(
          'SELECT * FROM installment_customers WHERE id = ?',
          [customerId]
        );
        
        if (!customers || customers.length === 0) {
          return new Response(JSON.stringify({ error: 'Customer not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        return new Response(JSON.stringify(customers[0]), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } else {
        // List all customers
        const customers = await query(
          'SELECT * FROM installment_customers ORDER BY created_at DESC'
        );
        
        return new Response(JSON.stringify(customers || []), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

    case 'POST':
      const data = await req.json();
      const { fullName, phoneNumber, address, notes } = data;
      
      if (!fullName || !phoneNumber) {
        return new Response(JSON.stringify({ error: 'Full name and phone number are required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      
      const newCustomerId = 'icust-' + Date.now();
      
      await query(
        'INSERT INTO installment_customers (id, full_name, phone_number, address, notes) VALUES (?, ?, ?, ?, ?)',
        [newCustomerId, fullName, phoneNumber, address || '', notes || '']
      );

      return new Response(JSON.stringify({
        id: newCustomerId,
        full_name: fullName,
        phone_number: phoneNumber,
        address: address || '',
        notes: notes || '',
        created_at: new Date().toISOString()
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    case 'PUT':
      const updateData = await req.json();
      const { fullName: updateName, phoneNumber: updatePhone, address: updateAddress, notes: updateNotes } = updateData;
      
      if (!customerId) {
        return new Response(JSON.stringify({ error: 'Customer ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      
      await query(
        'UPDATE installment_customers SET full_name = ?, phone_number = ?, address = ?, notes = ? WHERE id = ?',
        [updateName, updatePhone, updateAddress || '', updateNotes || '', customerId]
      );

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    case 'DELETE':
      if (!customerId) {
        return new Response(JSON.stringify({ error: 'Customer ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      
      await query('DELETE FROM installment_customers WHERE id = ?', [customerId]);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    default:
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
  }
}

// Handle Product routes
async function handleProducts(req: Request, method: string, path: string) {
  const url = new URL(req.url);
  const productId = url.searchParams.get('id') || path.replace('/', '');
  const customerId = url.searchParams.get('customer_id');

  switch (method) {
    case 'GET':
      if (productId) {
        const products = await query(
          'SELECT * FROM installment_products WHERE id = ?',
          [productId]
        );
        return new Response(JSON.stringify(products[0] || null), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } else if (customerId) {
        const products = await query(
          'SELECT * FROM installment_products WHERE customer_id = ? ORDER BY created_at DESC',
          [customerId]
        );
        return new Response(JSON.stringify(products || []), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } else {
        const products = await query(
          'SELECT * FROM installment_products ORDER BY created_at DESC'
        );
        return new Response(JSON.stringify(products || []), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

    case 'POST':
      const data = await req.json();
      const {
        customerId: prodCustomerId,
        productName,
        description,
        totalAmount,
        paidAmount,
        startDate,
        expectedCompletionDate,
        status,
        notes
      } = data;
      
      if (!prodCustomerId || !productName || !totalAmount) {
        return new Response(JSON.stringify({ error: 'Customer ID, product name, and total amount are required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      
      const newProductId = 'iprod-' + Date.now();
      const start = startDate || new Date().toISOString().split('T')[0];
      
      await query(`
        INSERT INTO installment_products (
          id, customer_id, product_name, description,
          total_amount, paid_amount, start_date,
          expected_completion_date, status, notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        newProductId, prodCustomerId, productName, description || '',
        totalAmount, paidAmount || 0, start,
        expectedCompletionDate || '', status || 'Active', notes || ''
      ]);

      return new Response(JSON.stringify({
        id: newProductId,
        customer_id: prodCustomerId,
        product_name: productName,
        description: description || '',
        total_amount: totalAmount,
        paid_amount: paidAmount || 0,
        start_date: start,
        expected_completion_date: expectedCompletionDate || '',
        status: status || 'Active',
        notes: notes || '',
        created_at: new Date().toISOString()
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    default:
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
  }
}

// Handle Payment routes
async function handlePayments(req: Request, method: string, path: string) {
  const url = new URL(req.url);
  const paymentId = url.searchParams.get('id') || path.replace('/', '');
  const productId = url.searchParams.get('product_id');
  const customerId = url.searchParams.get('customer_id');

  switch (method) {
    case 'GET':
      let sql = 'SELECT * FROM installment_payments';
      const params = [];
      
      if (paymentId) {
        sql += ' WHERE id = ?';
        params.push(paymentId);
      } else if (productId) {
        sql += ' WHERE product_id = ?';
        params.push(productId);
      } else if (customerId) {
        sql = `SELECT ip.* FROM installment_payments ip
               JOIN installment_products p ON ip.product_id = p.id
               WHERE p.customer_id = ?`;
        params.push(customerId);
      }
      
      sql += ' ORDER BY payment_date DESC';
      
      const payments = await query(sql, params);
      
      return new Response(JSON.stringify(payments || []), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    case 'POST':
      const data = await req.json();
      const {
        productId: payProductId,
        amount,
        paymentDate,
        paymentMethod,
        notes,
        receiptNumber
      } = data;
      
      if (!payProductId || !amount || amount <= 0) {
        return new Response(JSON.stringify({ error: 'Product ID and valid amount are required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      
      const newPaymentId = 'ipay-' + Date.now();
      const payDate = paymentDate || new Date().toISOString().split('T')[0];
      
      await query(`
        INSERT INTO installment_payments (
          id, product_id, amount, payment_date,
          payment_method, notes, receipt_number
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        newPaymentId, payProductId, amount, payDate,
        paymentMethod || 'Cash', notes || '', receiptNumber || ''
      ]);
      
      // Update product paid amount
      await query(`
        UPDATE installment_products 
        SET paid_amount = paid_amount + ?,
            status = CASE 
              WHEN paid_amount + ? >= total_amount THEN 'Completed' 
              ELSE status 
            END
        WHERE id = ?
      `, [amount, amount, payProductId]);

      return new Response(JSON.stringify({
        id: newPaymentId,
        product_id: payProductId,
        amount: amount,
        payment_date: payDate,
        payment_method: paymentMethod || 'Cash',
        notes: notes || '',
        receipt_number: receiptNumber || '',
        created_at: new Date().toISOString()
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    default:
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
  }
}

// Handle Get All Data
async function handleGetAllData() {
  const customers = await query('SELECT * FROM installment_customers ORDER BY created_at DESC');
  const products = await query('SELECT * FROM installment_products ORDER BY created_at DESC');
  const payments = await query('SELECT * FROM installment_payments ORDER BY payment_date DESC');

  return new Response(JSON.stringify({
    customers: customers || [],
    products: products || [],
    payments: payments || []
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

// Handle Stats
async function handleStats() {
  const stats = await query(`
    SELECT 
      (SELECT COUNT(*) FROM installment_customers) as total_customers,
      (SELECT COUNT(*) FROM installment_products) as total_products,
      (SELECT COALESCE(SUM(total_amount), 0) FROM installment_products) as total_expected,
      (SELECT COALESCE(SUM(paid_amount), 0) FROM installment_products) as total_collected,
      (SELECT COALESCE(SUM(total_amount - paid_amount), 0) 
       FROM installment_products 
       WHERE paid_amount < total_amount) as total_remaining
  `);

  return new Response(JSON.stringify(stats[0] || {}), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}
