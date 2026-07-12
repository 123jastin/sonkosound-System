// src/services/api.ts - Add safe JSON parsing
const API_BASE = '/api';

async function safeFetch(url: string, options?: RequestInit) {
  try {
    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    } else {
      // Return empty data instead of throwing
      console.warn(`Non-JSON response from ${url}`);
      return options?.method === 'GET' ? [] : { success: false, error: 'Invalid response' };
    }
  } catch (err) {
    console.error(`Fetch failed for ${url}:`, err);
    return options?.method === 'GET' ? [] : { success: false, error: 'Network error' };
  }
}

export const api = {
  settings: {
    get: () => safeFetch(`${API_BASE}/settings`),
    update: (data: any) => safeFetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }),
    changePassword: (currentPin: string, newPin: string) => safeFetch(`${API_BASE}/settings/password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPin, newPin })
    })
  },

  auth: {
    login: (pin: string) => safeFetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: pin.trim() })
    })
  },

  customers: {
    list: () => safeFetch(`${API_BASE}/customers`),
    // ... rest same as before
  },
  
  // ... rest of API methods using safeFetch
};
