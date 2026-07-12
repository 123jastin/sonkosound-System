export const onRequestGet = async (context: any) => {
  const tables = [
    'customers', 'debts', 'payments', 'suppliers',
    'supplier_products', 'supplier_payments', 'transactions'
  ];
  
  const exportData: any = {};
  
  for (const table of tables) {
    const { results } = await context.env.DB.prepare(`SELECT * FROM ${table}`).all();
    exportData[table] = results;
  }
  
  const settings = await context.env.DB.prepare('SELECT * FROM settings WHERE id = 1').first();
  exportData.settings = settings;
  exportData.exportDate = new Date().toISOString();
  
  return Response.json(exportData);
};
