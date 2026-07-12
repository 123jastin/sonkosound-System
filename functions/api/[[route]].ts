// functions/api/[[route]].ts

export const onRequest = async (context: any) => {
  const url = new URL(context.request.url);
  const path = url.pathname;
  const method = context.request.method;
  
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  try {
    // ============================================
    // AUTH
    // ============================================
    if (path === '/api/auth/login' && method === 'POST') {
      const { pin } = await context.request.json();
      const cleanPin = String(pin).trim();
      
      const setting = await context.env.DB.prepare(
        'SELECT password_hash FROM settings WHERE id = 1'
      ).first();
      
      if (setting && setting.password_hash === cleanPin) {
        return new Response(JSON.stringify({ success: true, token: 'authenticated' }), { headers });
      }
      
      return new Response(JSON.stringify({ error: 'PIN si sahihi' }), { status: 401, headers });
    }

    // ============================================
    // SETTINGS
    // ============================================
    if (path === '/api/settings' && method === 'GET') {
      const setting = await context.env.DB.prepare('SELECT * FROM settings WHERE id = 1').first();
      return new Response(JSON.stringify(setting || {}), { headers });
    }

    if (path === '/api/settings' && method === 'PUT') {
      const data = await context.request.json();
      await context.env.DB.prepare(
        `UPDATE settings SET business_name = ?, business_address = ?, business_phone = ?, updated_at = datetime('now') WHERE id = 1`
      ).bind(data.businessName, data.businessAddress, data.businessPhone).run();
      
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    if (path === '/api/settings/password' && method === 'PUT') {
      const { currentPin, newPin } = await context.request.json();
      
      const setting = await context.env.DB.prepare('SELECT password_hash FROM settings WHERE id = 1').first();
      
      if (String(setting.password_hash) !== String(currentPin).trim()) {
        return new Response(JSON.stringify({ error: 'PIN ya sasa si sahihi' }), { status: 400, headers });
      }
      
      await context.env.DB.prepare(
        'UPDATE settings SET password_hash = ?, updated_at = datetime("now") WHERE id = 1'
      ).bind(String(newPin).trim()).run();
      
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // ============================================
    // CUSTOMERS
    // ============================================
    if (path === '/api/customers' && method === 'GET') {
      const { results } = await context.env.DB.prepare('SELECT * FROM customers ORDER BY created_at DESC').all();
      return new Response(JSON.stringify(results || []), { headers });
    }

    if (path === '/api/customers' && method === 'POST') {
      const data = await context.request.json();
      
      await context.env.DB.prepare(
        `INSERT INTO customers (id, full_name, phone_number, address, business_name, notes, photo_url, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        data.id || `cust-${Date.now()}`,
        data.fullName,
        data.phoneNumber,
        data.address || '',
        data.businessName || '',
        data.notes || '',
        data.photoUrl || ''
      ).run();
      
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // Match /api/customers/{id}
    const customerMatch = path.match(/^\/api\/customers\/(.+)$/);
    if (customerMatch && method === 'PUT') {
      const id = customerMatch[1];
      const data = await context.request.json();
      
      await context.env.DB.prepare(
        `UPDATE customers SET full_name = ?, phone_number = ?, address = ?, business_name = ?, notes = ?, photo_url = ?, updated_at = datetime('now') WHERE id = ?`
      ).bind(data.fullName, data.phoneNumber, data.address || '', data.businessName || '', data.notes || '', data.photoUrl || '', id).run();
      
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    if (customerMatch && method === 'DELETE') {
      const id = customerMatch[1];
      await context.env.DB.prepare('DELETE FROM customers WHERE id = ?').bind(id).run();
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // ============================================
    // DEBTS
    // ============================================
    if (path === '/api/debts' && method === 'GET') {
      const { results } = await context.env.DB.prepare('SELECT * FROM debts ORDER BY created_at DESC').all();
      return new Response(JSON.stringify(results || []), { headers });
    }

    if (path === '/api/debts' && method === 'POST') {
      const data = await context.request.json();
      
      await context.env.DB.prepare(
        `INSERT INTO debts (id, customer_id, amount, date_borrowed, due_date, description, category, notes, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        data.id || `debt-${Date.now()}`,
        data.customerId,
        data.amount,
        data.dateBorrowed,
        data.dueDate,
        data.description,
        data.category || 'Mizigo/Products',
        data.notes || '',
        data.status || 'Active'
      ).run();
      
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    const debtMatch = path.match(/^\/api\/debts\/(.+)$/);
    if (debtMatch && method === 'PUT') {
      const id = debtMatch[1];
      const data = await context.request.json();
      
      await context.env.DB.prepare(
        `UPDATE debts SET amount = ?, due_date = ?, description = ?, category = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`
      ).bind(data.amount, data.dueDate, data.description, data.category, data.notes || '', id).run();
      
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    if (debtMatch && method === 'DELETE') {
      const id = debtMatch[1];
      await context.env.DB.prepare('DELETE FROM payments WHERE debt_id = ?').bind(id).run();
      await context.env.DB.prepare('DELETE FROM debts WHERE id = ?').bind(id).run();
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // ============================================
    // PAYMENTS
    // ============================================
    if (path === '/api/payments' && method === 'GET') {
      const { results } = await context.env.DB.prepare('SELECT * FROM payments ORDER BY created_at DESC').all();
      return new Response(JSON.stringify(results || []), { headers });
    }

    if (path === '/api/payments' && method === 'POST') {
      const data = await context.request.json();
      
      await context.env.DB.prepare(
        `INSERT INTO payments (id, debt_id, amount, date, payment_method, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        data.id || `pay-${Date.now()}`,
        data.debtId,
        data.amount,
        data.date,
        data.paymentMethod || 'Cash',
        data.notes || ''
      ).run();
      
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // ============================================
    // SUPPLIERS
    // ============================================
    if (path === '/api/suppliers' && method === 'GET') {
      const { results: suppliers } = await context.env.DB.prepare('SELECT * FROM suppliers ORDER BY created_at DESC').all();
      
      // Get products and payments for each supplier
      const suppliersWithDetails = await Promise.all(
        (suppliers || []).map(async (supplier: any) => {
          const { results: products } = await context.env.DB.prepare(
            'SELECT * FROM supplier_products WHERE supplier_id = ? ORDER BY created_at ASC'
          ).bind(supplier.id).all();
          
          const { results: payments } = await context.env.DB.prepare(
            'SELECT * FROM supplier_payments WHERE supplier_id = ? ORDER BY created_at ASC'
          ).bind(supplier.id).all();
          
          return {
            ...supplier,
            products: products || [],
            payments: payments || []
          };
        })
      );
      
      return new Response(JSON.stringify(suppliersWithDetails || []), { headers });
    }

    if (path === '/api/suppliers' && method === 'POST') {
      const data = await context.request.json();
      console.log('Creating supplier:', data);
      
      await context.env.DB.prepare(
        `INSERT INTO suppliers (id, name, phone_number, amount, paid_amount, due_date, product_type, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        data.id || `sup-${Date.now()}`,
        data.name,
        data.phoneNumber,
        data.amount || 0,
        data.paidAmount || 0,
        data.dueDate,
        data.productType || '',
        data.notes || ''
      ).run();
      
      return new Response(JSON.stringify({ success: true, id: data.id }), { headers });
    }

    const supplierMatch = path.match(/^\/api\/suppliers\/(.+)$/);
    if (supplierMatch && method === 'PUT') {
      const id = supplierMatch[1];
      const data = await context.request.json();
      
      await context.env.DB.prepare(
        `UPDATE suppliers SET name = ?, phone_number = ?, amount = ?, paid_amount = ?, due_date = ?, product_type = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`
      ).bind(
        data.name, 
        data.phoneNumber, 
        data.amount, 
        data.paidAmount || 0, 
        data.dueDate, 
        data.productType || '', 
        data.notes || '', 
        id
      ).run();
      
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    if (supplierMatch && method === 'DELETE') {
      const id = supplierMatch[1];
      await context.env.DB.prepare('DELETE FROM supplier_payments WHERE supplier_id = ?').bind(id).run();
      await context.env.DB.prepare('DELETE FROM supplier_products WHERE supplier_id = ?').bind(id).run();
      await context.env.DB.prepare('DELETE FROM suppliers WHERE id = ?').bind(id).run();
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // ============================================
    // SUPPLIER PRODUCTS
    // ============================================
    if (path === '/api/supplier-products' && method === 'POST') {
      const data = await context.request.json();
      
      await context.env.DB.prepare(
        `INSERT INTO supplier_products (id, supplier_id, description, amount, due_date, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        data.id || `prod-${Date.now()}`,
        data.supplierId,
        data.description,
        data.amount,
        data.dueDate,
        data.notes || ''
      ).run();
      
      // Update supplier total amount
      await context.env.DB.prepare(
        'UPDATE suppliers SET amount = amount + ?, due_date = ?, updated_at = datetime("now") WHERE id = ?'
      ).bind(data.amount, data.dueDate, data.supplierId).run();
      
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // ============================================
    // SUPPLIER PAYMENTS
    // ============================================
    if (path === '/api/supplier-payments' && method === 'POST') {
      const data = await context.request.json();
      
      await context.env.DB.prepare(
        `INSERT INTO supplier_payments (id, supplier_id, amount, date, notes, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        data.id || `spay-${Date.now()}`,
        data.supplierId,
        data.amount,
        data.date,
        data.notes || ''
      ).run();
      
      // Update supplier paid amount
      await context.env.DB.prepare(
        'UPDATE suppliers SET paid_amount = MIN(amount, paid_amount + ?), updated_at = datetime("now") WHERE id = ?'
      ).bind(data.amount, data.supplierId).run();
      
      return new Response(JSON.stringify({ success: true }), { headers });
    }

    // ============================================
    // OCR
    // ============================================
    if (path === '/api/ocr' && method === 'POST') {
      return new Response(JSON.stringify({
        success: true,
        data: { name: '', number: '', deni: 0, maelezo_ya_bidhaa: '', notes: '' }
      }), { headers });
    }

    // ============================================
    // EXPORT
    // ============================================
    if (path === '/api/export' && method === 'GET') {
      const tables = ['customers', 'debts', 'payments', 'suppliers', 'supplier_products', 'supplier_payments', 'transactions'];
      const exportData: any = {};
      
      for (const table of tables) {
        const { results } = await context.env.DB.prepare(`SELECT * FROM ${table}`).all();
        exportData[table] = results || [];
      }
      
      const settings = await context.env.DB.prepare('SELECT * FROM settings WHERE id = 1').first();
      exportData.settings = settings;
      exportData.exportDate = new Date().toISOString();
      
      return new Response(JSON.stringify(exportData), { headers });
    }

    // 404
    return new Response(JSON.stringify({ error: 'Route not found', path }), { status: 404, headers });

  } catch (error: any) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), { 
      status: 500, 
      headers 
    });
  }
};
