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

export const api = {
  // ============================================
  // SETTINGS
  // ============================================
  settings: {
    get: () => safeFetch(`${API_BASE}/settings`),
    update: (data: any) => safeFetch(`${API_BASE}/settings`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    changePassword: (currentPin: string, newPin: string) => safeFetch(`${API_BASE}/settings/password`, {
      method: 'PUT',
      body: JSON.stringify({ currentPin, newPin })
    })
  },

  // ============================================
  // AUTH
  // ============================================
  auth: {
    login: (pin: string) => safeFetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ pin: pin.trim() })
    })
  },

  // ============================================
  // CUSTOMERS
  // ============================================
  customers: {
    list: () => safeFetch(`${API_BASE}/customers`),
    create: (data: any) => safeFetch(`${API_BASE}/customers`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    update: (id: string, data: any) => safeFetch(`${API_BASE}/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    delete: (id: string) => safeFetch(`${API_BASE}/customers/${id}`, {
      method: 'DELETE'
    })
  },

  // ============================================
  // DEBTS
  // ============================================
  debts: {
    list: () => safeFetch(`${API_BASE}/debts`),
    create: (data: any) => safeFetch(`${API_BASE}/debts`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    update: (id: string, data: any) => safeFetch(`${API_BASE}/debts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    delete: (id: string) => safeFetch(`${API_BASE}/debts/${id}`, {
      method: 'DELETE'
    })
  },

  // ============================================
  // PAYMENTS
  // ============================================
  payments: {
    list: () => safeFetch(`${API_BASE}/payments`),
    create: (data: any) => safeFetch(`${API_BASE}/payments`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  // ============================================
  // SUPPLIERS
  // ============================================
  suppliers: {
    list: () => safeFetch(`${API_BASE}/suppliers`),
    create: (data: any) => safeFetch(`${API_BASE}/suppliers`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    update: (id: string, data: any) => safeFetch(`${API_BASE}/suppliers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    delete: (id: string) => safeFetch(`${API_BASE}/suppliers/${id}`, {
      method: 'DELETE'
    })
  },

  // ============================================
  // SUPPLIER PRODUCTS
  // ============================================
  supplierProducts: {
    create: (data: any) => safeFetch(`${API_BASE}/supplier-products`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  // ============================================
  // SUPPLIER PAYMENTS
  // ============================================
  supplierPayments: {
    create: (data: any) => safeFetch(`${API_BASE}/supplier-payments`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  // ============================================
  // OCR
  // ============================================
  ocr: {
    scan: (image: string) => safeFetch(`${API_BASE}/ocr`, {
      method: 'POST',
      body: JSON.stringify({ image })
    })
  },

  // ============================================
  // PARSE TEXT (Groq AI)
  // ============================================
  parseText: {
    analyze: (text: string) => safeFetch(`${API_BASE}/parse-text`, {
      method: 'POST',
      body: JSON.stringify({ text })
    })
  },

  // ============================================
  // UPLOAD (R2 Storage)
  // ============================================
  upload: {
    image: async (file: File): Promise<{ success: boolean; url?: string; error?: string }> => {
      const formData = new FormData();
      formData.append('file', file);
      
      try {
        const response = await fetch(`${API_BASE}/upload`, {
          method: 'POST',
          body: formData,
        });
        
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return response.json();
        }
        
        return { success: false, error: 'Invalid server response' };
      } catch (err: any) {
        return { success: false, error: err.message || 'Upload failed' };
      }
    }
  },

  // ============================================
  // SMS REMINDERS (Beem Africa)
  // ============================================
  reminders: {
    send: (data: { debts: any[]; customers: any[]; payments: any[] }) => 
      safeFetch(`${API_BASE}/send-reminders`, {
        method: 'POST',
        body: JSON.stringify(data)
      })
  },

  // ============================================
  // EXPORT
  // ============================================
  export: {
    data: () => safeFetch(`${API_BASE}/export`)
  }
};
