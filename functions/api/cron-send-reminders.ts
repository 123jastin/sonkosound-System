// functions/api/cron-send-reminders.ts
// This runs automatically every day at 8:00 AM East Africa Time

export const onRequest = async (context: any) => {
  // Only allow cron triggers
  const cronHeader = context.request.headers.get('X-Cron-Trigger');
  if (!cronHeader) {
    return new Response('Not allowed', { status: 403 });
  }

  try {
    const BEEM_API_KEY = context.env.BEEM_API_KEY || '4594d67f9df36874';
    const BEEM_SECRET_KEY = context.env.BEEM_SECRET_KEY || 'YzRmMjU0OTlhZmFlNTdkODI2ZDAyNWY1YmJkMWYyMWNmZDQ0MDllZGI5MTg2YzE1ZTg5YmE4YTI4NmI1ZTY2Mw==';
    const MY_PHONE = context.env.MY_PHONE_NUMBER || '255656738253';

    const today = new Date().toISOString().split('T')[0];
    console.log('⏰ CRON JOB STARTED -', today);

    // Get all data from D1
    const { results: customers } = await context.env.DB.prepare('SELECT * FROM customers').all();
    const { results: debts } = await context.env.DB.prepare('SELECT * FROM debts').all();
    const { results: payments } = await context.env.DB.prepare('SELECT * FROM payments').all();
    const { results: suppliers } = await context.env.DB.prepare('SELECT * FROM suppliers').all();

    console.log(`📊 Customers: ${customers.length}, Debts: ${debts.length}, Suppliers: ${suppliers.length}`);

    const results: any[] = [];
    let totalSent = 0;

    // Process customer debts
    for (const debt of debts) {
      const customer = customers.find((c: any) => c.id === debt.customer_id);
      if (!customer || !customer.phone_number) continue;

      const debtPayments = payments.filter((p: any) => p.debt_id === debt.id);
      const totalPaid = debtPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
      const remaining = (debt.amount || 0) - totalPaid;

      if (remaining <= 0) continue;
      if (debt.due_date !== today) continue;

      const customerPhone = normalizePhone(customer.phone_number);
      const ownerPhone = normalizePhone(MY_PHONE);

      // Message to Customer
      const customerMessage = `Habari ${customer.full_name}, leo ni siku ya mwisho kulipa TSh ${remaining.toLocaleString()} ya "${debt.description}". Asante.`;

      // Message to Owner
      const ownerMessage = `Imekukumbushwa ${customer.full_name} (${customer.phone_number}) kulipa TSh ${remaining.toLocaleString()} ya "${debt.description}".`;

      // Send to Customer
      const custResult = await sendSMS({
        apiKey: BEEM_API_KEY,
        secretKey: BEEM_SECRET_KEY,
        message: customerMessage,
        phone: customerPhone,
      });

      if (custResult.success) totalSent++;
      results.push({ type: 'customer', name: customer.full_name, success: custResult.success });

      // Send to Owner
      await sendSMS({
        apiKey: BEEM_API_KEY,
        secretKey: BEEM_SECRET_KEY,
        message: ownerMessage,
        phone: ownerPhone,
      });

      await delay(1000);
    }

    // Process suppliers
    for (const supplier of suppliers) {
      const remaining = (supplier.amount || 0) - (supplier.paid_amount || 0);
      if (remaining <= 0) continue;
      if (supplier.due_date !== today) continue;

      const ownerPhone = normalizePhone(MY_PHONE);
      const ownerMessage = `⏰ Leo ni siku ya mwisho kumlipa ${supplier.name}. Deni: TSh ${remaining.toLocaleString()} ya "${supplier.notes || supplier.product_type || 'Bidhaa'}". Simu: ${supplier.phone_number || 'Haina'}.`;

      const result = await sendSMS({
        apiKey: BEEM_API_KEY,
        secretKey: BEEM_SECRET_KEY,
        message: ownerMessage,
        phone: ownerPhone,
      });

      if (result.success) totalSent++;
      results.push({ type: 'supplier', name: supplier.name, success: result.success });

      await delay(1000);
    }

    console.log('⏰ CRON JOB COMPLETED - Sent:', totalSent);

    return new Response(JSON.stringify({ success: true, sent: totalSent, results }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('⏰ CRON ERROR:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// Helpers
function normalizePhone(value: any) {
  let v = String(value || '').trim().replace(/[^\d+]/g, '');
  if (!v) return '';
  if (v.startsWith('+')) v = v.slice(1);
  if (v.startsWith('00')) v = v.slice(2);
  if (v.startsWith('0')) v = '255' + v.slice(1);
  if (!v.startsWith('255')) v = '255' + v;
  return v;
}

function toBase64(value: string) { return btoa(value); }

function delay(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function sendSMS(params: { apiKey: string; secretKey: string; message: string; phone: string }) {
  const auth = toBase64(`${params.apiKey}:${params.secretKey}`);
  
  try {
    const response = await fetch('https://apisms.beem.africa/v1/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        source_addr: 'Sonko Sound',
        schedule_time: '',
        encoding: 0,
        message: params.message,
        recipients: [{ recipient_id: 1, dest_addr: params.phone }],
      }),
    });

    const rawText = await response.text();
    return { success: response.ok, data: rawText };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
