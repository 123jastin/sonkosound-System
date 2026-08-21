import { query } from './_shared/db';

// Helper function to handle CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

// Main handler for installment API
export default async function handler(req: Request, res: Response) {
  // Handle OPTIONS for CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace('/api/installment', '');
  const method = req.method;

  try {
    // Route based on path and method
    if (path.startsWith('/customers')) {
      return handleCustomers(req, method, path.replace('/customers', ''));
    } else if (path.startsWith('/products')) {
      return handleProducts(req, method, path.replace('/products', ''));
    } else if (path.startsWith('/payments')) {
      return handlePayments(req, method, path.replace('/payments', ''));
    } else if (path === '/stats') {
      return handleStats();
    } else if (path === '' || path === '/') {
      // Return all data
      return handleGetAllData();
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
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

  switch (method) {
    case 'GET':
      if (customerId) {
        // Get single customer with details
        const customers = await query(
          'SELECT * FROM installment_customers WHERE id = ?',
          [customerId]
        );
        
        if (customers.length === 0) {
          return new Response(JSON.stringify({ error: 'Customer not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        // Get customer's products
        const products = await query(
          'SELECT * FROM installment_products WHERE customer_id = ? ORDER BY created_at DESC',
          [customerId]
        );

        // Get customer's payments
        const payments = await query(
          `SELECT ip.*, p.product_name 
           FROM installment_payments ip
           JOIN installment_products p ON ip.product_id = p.id
           WHERE p.customer_id = ?
           ORDER BY ip.payment_date DESC`,
          [customerId]
        );

        return new Response(JSON.stringify({
          ...customers[0],
          products,
          payments
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } else {
        // List all customers
        const customers = await query(
          'SELECT * FROM installment_customers ORDER BY created_at DESC'
        );
        
        // Get stats for each customer
        const customersWithStats = await query(`
          SELECT 
            c.*,
            COUNT(DISTINCT p.id) as total_products,
            COALESCE(SUM(p.total_amount), 0) as total_value,
            COALESCE(SUM(p.paid_amount), 0) as paid_value,
            COALESCE(SUM(p.total_amount - p.paid_amount), 0) as remaining_value,
            SUM(CASE WHEN p.paid_amount >= p.total_amount THEN 1 ELSE 0 END) as completed_products
          FROM installment_customers c
          LEFT JOIN installment_products p ON c.id = p.customer_id
          GROUP BY c.id
          ORDER BY c.created_at DESC
        `);

        return new Response(JSON.stringify(customersWithStats), {
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
      
      // Log transaction
      await query(
        'INSERT INTO installment_transactions (id, customer_id, transaction_type, description) VALUES (?, ?, ?, ?)',
        ['itrans-' + Date.now(), newCustomerId, 'Customer Created', `New installment customer: ${fullName}`]
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
        // Get single product with payments
        const products = await query(
          'SELECT * FROM installment_products WHERE id = ?',
          [productId]
        );
        
        if (products.length === 0) {
          return new Response(JSON.stringify({ error: 'Product not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const payments = await query(
          'SELECT * FROM installment_payments WHERE product_id = ? ORDER BY payment_date DESC',
          [productId]
        );

        return new Response(JSON.stringify({
          ...products[0],
          payments
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } else if (customerId) {
        // List products for a customer
        const products = await query(
          'SELECT * FROM installment_products WHERE customer_id = ? ORDER BY created_at DESC',
          [customerId]
        );
        
        return new Response(JSON.stringify(products), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } else {
        // List all products with customer info
        const products = await query(`
          SELECT 
            p.*,
            c.full_name as customer_name,
            c.phone_number as customer_phone
          FROM installment_products p
          JOIN installment_customers c ON p.customer_id = c.id
          ORDER BY p.created_at DESC
        `);
        
        return new Response(JSON.stringify(products), {
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
      
      // Log transaction
      await query(`
        INSERT INTO installment_transactions (
          id, customer_id, product_id, transaction_type, amount, description
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        'itrans-' + Date.now(), prodCustomerId, newProductId,
        'Product Added', totalAmount, `New installment product: ${productName}`
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

    case 'PUT':
      const updateData = await req.json();
      const {
        productName: updateProductName,
        description: updateDescription,
        totalAmount: updateTotalAmount,
        expectedCompletionDate: updateCompletionDate,
        notes: updateProductNotes
      } = updateData;
      
      if (!productId) {
        return new Response(JSON.stringify({ error: 'Product ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      
      await query(`
        UPDATE installment_products 
        SET product_name = ?, 
            description = ?, 
            total_amount = ?,
            expected_completion_date = ?,
            notes = ?
        WHERE id = ?
      `, [
        updateProductName, updateDescription || '', 
        updateTotalAmount, updateCompletionDate || '', 
        updateProductNotes || '', productId
      ]);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    case 'DELETE':
      if (!productId) {
        return new Response(JSON.stringify({ error: 'Product ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      
      await query('DELETE FROM installment_products WHERE id = ?', [productId]);

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

// Handle Payment routes
async function handlePayments(req: Request, method: string, path: string) {
  const url = new URL(req.url);
  const paymentId = url.searchParams.get('id') || path.replace('/', '');
  const productId = url.searchParams.get('product_id');
  const customerId = url.searchParams.get('customer_id');

  switch (method) {
    case 'GET':
      if (paymentId) {
        // Get single payment
        const payments = await query(
          'SELECT * FROM installment_payments WHERE id = ?',
          [paymentId]
        );
        
        return new Response(JSON.stringify(payments[0] || null), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } else if (productId) {
        // List payments for a product
        const payments = await query(
          'SELECT * FROM installment_payments WHERE product_id = ? ORDER BY payment_date DESC',
          [productId]
        );
        
        return new Response(JSON.stringify(payments), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } else if (customerId) {
        // List payments for a customer
        const payments = await query(`
          SELECT 
            ip.*,
            p.product_name
          FROM installment_payments ip
          JOIN installment_products p ON ip.product_id = p.id
          WHERE p.customer_id = ?
          ORDER BY ip.payment_date DESC
        `, [customerId]);
        
        return new Response(JSON.stringify(payments), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } else {
        // List all payments with details
        const payments = await query(`
          SELECT 
            ip.*,
            p.product_name,
            p.customer_id,
            c.full_name as customer_name
          FROM installment_payments ip
          JOIN installment_products p ON ip.product_id = p.id
          JOIN installment_customers c ON p.customer_id = c.id
          ORDER BY ip.payment_date DESC
        `);
        
        return new Response(JSON.stringify(payments), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

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
      
      // Insert payment
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
      
      // Update product paid amount and status
      await query(`
        UPDATE installment_products 
        SET paid_amount = paid_amount + ?,
            status = CASE 
              WHEN paid_amount + ? >= total_amount THEN 'Completed' 
              ELSE status 
            END
        WHERE id = ?
      `, [amount, amount, payProductId]);
      
      // Get updated product info
      const products = await query(
        'SELECT * FROM installment_products WHERE id = ?',
        [payProductId]
      );
      
      const product = products[0];
      
      // Log payment transaction
      await query(`
        INSERT INTO installment_transactions (
          id, customer_id, product_id, transaction_type, amount, description
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        'itrans-' + Date.now(), product?.customer_id, payProductId,
        'Payment Received', amount, `Payment of ${amount} for ${product?.product_name || 'product'}`
      ]);
      
      // If completed, log completion
      if (product?.paid_amount >= product?.total_amount) {
        await query(`
          INSERT INTO installment_transactions (
            id, customer_id, product_id, transaction_type, description
          )
          VALUES (?, ?, ?, ?, ?)
        `, [
          'itrans-' + Date.now() + '-complete',
          product.customer_id,
          payProductId,
          'Product Completed',
          `Product completed: ${product.product_name}`
        ]);
      }

      return new Response(JSON.stringify({
        id: newPaymentId,
        product_id: payProductId,
        amount: amount,
        payment_date: payDate,
        payment_method: paymentMethod || 'Cash',
        notes: notes || '',
        receipt_number: receiptNumber || '',
        product_status: product?.status,
        created_at: new Date().toISOString()
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });

    case 'DELETE':
      if (!paymentId) {
        return new Response(JSON.stringify({ error: 'Payment ID is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      
      await query('DELETE FROM installment_payments WHERE id = ?', [paymentId]);

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
       WHERE paid_amount < total_amount) as total_remaining,
      (SELECT COUNT(*) 
       FROM installment_products 
       WHERE status = 'Active' AND paid_amount < total_amount) as active_installments,
      (SELECT COUNT(*) 
       FROM installment_products 
       WHERE status = 'Completed' OR paid_amount >= total_amount) as completed_installments,
      (SELECT COALESCE(SUM(amount), 0) 
       FROM installment_payments 
       WHERE strftime('%Y-%m', payment_date) = strftime('%Y-%m', 'now')) as collected_this_month
  `);

  return new Response(JSON.stringify(stats[0] || {}), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

// Handle Get All Data
async function handleGetAllData() {
  const [customers, products, payments] = await Promise.all([
    query('SELECT * FROM installment_customers ORDER BY created_at DESC'),
    query('SELECT * FROM installment_products ORDER BY created_at DESC'),
    query('SELECT * FROM installment_payments ORDER BY payment_date DESC')
  ]);

  return new Response(JSON.stringify({
    customers,
    products,
    payments
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}
