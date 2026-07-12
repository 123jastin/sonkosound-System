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

  auth: {
    login: (pin: string) => safeFetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ pin: pin.trim() })
    })
  },

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

  payments: {
    list: () => safeFetch(`${API_BASE}/payments`),
    create: (data: any) => safeFetch(`${API_BASE}/payments`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

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

  supplierProducts: {
    create: (data: any) => safeFetch(`${API_BASE}/supplier-products`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  supplierPayments: {
    create: (data: any) => safeFetch(`${API_BASE}/supplier-payments`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },

  ocr: {
    scan: (image: string) => safeFetch(`${API_BASE}/ocr`, {
      method: 'POST',
      body: JSON.stringify({ image })
    })
  },

  export: {
    data: () => safeFetch(`${API_BASE}/export`)
  }
};
