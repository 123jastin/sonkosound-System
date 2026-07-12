// src/services/api.ts

const API_BASE = '/api';

async function safeFetch(url: string, options?: RequestInit): Promise<any> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {})
      }
    });
    
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Request failed');
      }
      return data;
    } else {
      console.warn(`Non-JSON response from ${url}`);
      if (options?.method === 'GET' || !options?.method) {
        return [];
      }
      return { success: false, error: 'Invalid server response' };
    }
  } catch (err: any) {
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      console.warn(`Network error for ${url}`);
      return options?.method === 'GET' || !options?.method ? [] : { success: false, error: 'Network error' };
    }
    throw err;
  }
}

// ============================================
// TYPE DEFINITIONS FOR API
// ============================================
interface CustomerData {
  id: string;
  fullName: string;
  phoneNumber: string;
  address?: string;
  businessName?: string;
  notes?: string;
  photoUrl?: string;
}

interface DebtData {
  id: string;
  customerId: string;
  amount: number;
  dateBorrowed: string;
  dueDate: string;
  description: string;
  category?: string;
  notes?: string;
  status?: string;
}

interface PaymentData {
  id: string;
  debtId: string;
  amount: number;
  date: string;
  paymentMethod?: string;
  notes?: string;
}

interface SupplierData {
  id: string;
  name: string;
  phoneNumber: string;
  amount: number;
  paidAmount?: number;
  dueDate: string;
  productType?: string;
  notes?: string;
  createdAt?: string;
}

interface SupplierProductData {
  id: string;
  supplierId: string;
  description: string;
  amount: number;
  dueDate: string;
  notes?: string;
}

interface SupplierPaymentData {
  id: string;
  supplierId: string;
  amount: number;
  date: string;
  notes?: string;
}

interface SettingsData {
  businessName: string;
  businessAddress: string;
  businessPhone: string;
}

// ============================================
// API SERVICE
// ============================================
export const api = {
  // ============================================
  // SETTINGS
  // ============================================
  settings: {
    get: (): Promise<any> => safeFetch(`${API_BASE}/settings`),
    
    update: (data: SettingsData): Promise<any> => safeFetch(`${API_BASE}/settings`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    
    changePassword: (currentPin: string, newPin: string): Promise<any> => safeFetch(`${API_BASE}/settings/password`, {
      method: 'PUT',
      body: JSON.stringify({ currentPin, newPin })
    })
  },

  // ============================================
  // AUTH
  // ============================================
  auth: {
    login: (pin: string): Promise<any> => safeFetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ pin: pin.trim() })
    })
  },

  // ============================================
  // CUSTOMERS
  // ============================================
  customers: {
    list: (): Promise<any[]> => safeFetch(`${API_BASE}/customers`),
    
    create: (data: CustomerData): Promise<any> => safeFetch(`${API_BASE}/customers`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    
    update: (id: string, data: Partial<CustomerData>): Promise<any> => safeFetch(`${API_BASE}/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    
    delete: (id: string): Promise<any> => safeFetch(`${API_BASE}/customers/${id}`, {
      method: 'DELETE'
    })
  },

  // ============================================
  // DEBTS
  // ============================================
  debts: {
    list: (): Promise<any[]> => safeFetch(`${API_BASE}/debts`),
    
    create: (data: DebtData): Promise<any> => safeFetch(`${API_BASE}/debts`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    
    update: (id: string, data: Partial<DebtData>): Promise<any> => safeFetch(`${API_BASE}/debts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    
    delete: (id: string): Promise<any> => safeFetch(`${API_BASE}/debts/${id}`, {
      method: 'DELETE'
    })
  },

  // ============================================
  // PAYMENTS
  // ============================================
  payments: {
    list: (): Promise<any[]> => safeFetch(`${API_BASE}/payments`),
    
    create: (data: PaymentData): Promise<any> => safeFetch(`${API_BASE}/payments`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  // ============================================
  // SUPPLIERS
  // ============================================
  suppliers: {
    list: (): Promise<any[]> => safeFetch(`${API_BASE}/suppliers`),
    
    create: (data: SupplierData): Promise<any> => safeFetch(`${API_BASE}/suppliers`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    
    update: (id: string, data: Partial<SupplierData>): Promise<any> => safeFetch(`${API_BASE}/suppliers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    
    delete: (id: string): Promise<any> => safeFetch(`${API_BASE}/suppliers/${id}`, {
      method: 'DELETE'
    })
  },

  // ============================================
  // SUPPLIER PRODUCTS
  // ============================================
  supplierProducts: {
    create: (data: SupplierProductData): Promise<any> => safeFetch(`${API_BASE}/supplier-products`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  // ============================================
  // SUPPLIER PAYMENTS
  // ============================================
  supplierPayments: {
    create: (data: SupplierPaymentData): Promise<any> => safeFetch(`${API_BASE}/supplier-payments`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  // ============================================
  // OCR
  // ============================================
  ocr: {
    scan: (image: string): Promise<any> => safeFetch(`${API_BASE}/ocr`, {
      method: 'POST',
      body: JSON.stringify({ image })
    })
  },

  // ============================================
  // EXPORT
  // ============================================
  export: {
    data: (): Promise<any> => safeFetch(`${API_BASE}/export`)
  }
};
