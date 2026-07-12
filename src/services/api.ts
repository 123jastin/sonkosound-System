// ============================================
// API SERVICE - FRONTEND CLIENT
// ============================================

const API_BASE = '/api';

export const api = {
  // Settings
  settings: {
    get: () => fetch(`${API_BASE}/settings`).then(r => r.json()),
    update: (data: any) => fetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json()),
    changePassword: (currentPin: string, newPin: string) => fetch(`${API_BASE}/settings/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPin, newPin })
    }).then(r => r.json())
  },

  // Auth
  auth: {
    login: (pin: string) => fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    }).then(r => r.json())
  },

  // Customers
  customers: {
    list: () => fetch(`${API_BASE}/customers`).then(r => r.json()),
    create: (data: any) => fetch(`${API_BASE}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json()),
    update: (id: string, data: any) => fetch(`${API_BASE}/customers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json()),
    delete: (id: string) => fetch(`${API_BASE}/customers/${id}`, {
      method: 'DELETE'
    }).then(r => r.json())
  },

  // Debts
  debts: {
    list: () => fetch(`${API_BASE}/debts`).then(r => r.json()),
    create: (data: any) => fetch(`${API_BASE}/debts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json()),
    update: (id: string, data: any) => fetch(`${API_BASE}/debts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json()),
    delete: (id: string) => fetch(`${API_BASE}/debts/${id}`, {
      method: 'DELETE'
    }).then(r => r.json())
  },

  // Payments
  payments: {
    list: () => fetch(`${API_BASE}/payments`).then(r => r.json()),
    create: (data: any) => fetch(`${API_BASE}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json())
  },

  // Suppliers
  suppliers: {
    list: () => fetch(`${API_BASE}/suppliers`).then(r => r.json()),
    create: (data: any) => fetch(`${API_BASE}/suppliers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json()),
    update: (id: string, data: any) => fetch(`${API_BASE}/suppliers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json()),
    delete: (id: string) => fetch(`${API_BASE}/suppliers/${id}`, {
      method: 'DELETE'
    }).then(r => r.json())
  },

  // Supplier Products
  supplierProducts: {
    create: (data: any) => fetch(`${API_BASE}/supplier-products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json())
  },

  // Supplier Payments
  supplierPayments: {
    create: (data: any) => fetch(`${API_BASE}/supplier-payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json())
  },

  // OCR
  ocr: {
    scan: (image: string) => fetch(`${API_BASE}/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image })
    }).then(r => r.json())
  },

  // Export
  export: {
    data: () => fetch(`${API_BASE}/export`).then(r => r.json())
  }
};
