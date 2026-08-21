const API_BASE_URL = '/api/installment';

export const installmentApi = {
  // Get all data
  getAll: async () => {
    const response = await fetch(`${API_BASE_URL}`);
    return response.json();
  },

  // Customer operations
  customers: {
    list: async () => {
      const response = await fetch(`${API_BASE_URL}/customers`);
      return response.json();
    },
    
    create: async (data: any) => {
      const response = await fetch(`${API_BASE_URL}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return response.json();
    },
    
    update: async (id: string, data: any) => {
      const response = await fetch(`${API_BASE_URL}/customers?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return response.json();
    },
    
    delete: async (id: string) => {
      const response = await fetch(`${API_BASE_URL}/customers?id=${id}`, {
        method: 'DELETE'
      });
      return response.json();
    }
  },

  // Product operations
  products: {
    list: async (customerId?: string) => {
      const url = customerId 
        ? `${API_BASE_URL}/products?customer_id=${customerId}`
        : `${API_BASE_URL}/products`;
      const response = await fetch(url);
      return response.json();
    },
    
    create: async (data: any) => {
      const response = await fetch(`${API_BASE_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return response.json();
    },
    
    update: async (id: string, data: any) => {
      const response = await fetch(`${API_BASE_URL}/products?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return response.json();
    },
    
    delete: async (id: string) => {
      const response = await fetch(`${API_BASE_URL}/products?id=${id}`, {
        method: 'DELETE'
      });
      return response.json();
    }
  },

  // Payment operations
  payments: {
    list: async (filters?: { productId?: string; customerId?: string }) => {
      let url = `${API_BASE_URL}/payments`;
      if (filters?.productId) {
        url += `?product_id=${filters.productId}`;
      } else if (filters?.customerId) {
        url += `?customer_id=${filters.customerId}`;
      }
      const response = await fetch(url);
      return response.json();
    },
    
    create: async (data: any) => {
      const response = await fetch(`${API_BASE_URL}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return response.json();
    },
    
    delete: async (id: string) => {
      const response = await fetch(`${API_BASE_URL}/payments?id=${id}`, {
        method: 'DELETE'
      });
      return response.json();
    }
  },

  // Statistics
  stats: {
    get: async () => {
      const response = await fetch(`${API_BASE_URL}/stats`);
      return response.json();
    }
  }
};
