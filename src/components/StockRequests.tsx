/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Plus, User, X, Trash2, Check, Loader2, AlertCircle,
  Package, Search, ArrowLeft, CheckCircle2, Clock,
  ListChecks, Phone, UserPlus, ChevronRight, FileText
} from 'lucide-react';

// Interfaces
interface Worker {
  id: string;
  name: string;
  phone?: string;
  created_at: string;
}

interface StockItem {
  id: string;
  worker_id: string;
  worker_name: string;
  product_name: string;
  quantity?: string;
  notes: string;
  status: 'Pending' | 'Completed';
  created_at: string;
  completed_at?: string;
}

interface StockRequestsProps {
  onUpdate?: () => void;
}

const API_BASE_URL = '/api/stock-requests';

export default function StockRequests({ onUpdate }: StockRequestsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [isAdminView, setIsAdminView] = useState(false);
  
  // Modals
  const [isAddWorkerModalOpen, setIsAddWorkerModalOpen] = useState(false);
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [isViewAllModalOpen, setIsViewAllModalOpen] = useState(false);
  
  // Worker form
  const [workerName, setWorkerName] = useState('');
  const [workerPhone, setWorkerPhone] = useState('');
  
  // Product form
  const [productName, setProductName] = useState('');
  const [productQuantity, setProductQuantity] = useState('');
  const [productNotes, setProductNotes] = useState('');
  
  // Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [adminFilter, setAdminFilter] = useState<'All' | 'Pending' | 'Completed'>('Pending');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}`);
      const data = await response.json();
      
      if (data.success) {
        setWorkers(Array.isArray(data.workers) ? data.workers : []);
        setStockItems(Array.isArray(data.items) ? data.items : []);
      }
    } catch (err) {
      console.error('Failed to load stock requests:', err);
      // localStorage fallback
      const savedData = localStorage.getItem('stock_requests_data');
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          setWorkers(parsed.workers || []);
          setStockItems(parsed.items || []);
        } catch (e) {
          console.error('Failed to parse saved data:', e);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeWorker = useMemo(() => {
    if (!selectedWorkerId) return null;
    return workers.find(w => w.id === selectedWorkerId) || null;
  }, [workers, selectedWorkerId]);

  const activeWorkerItems = useMemo(() => {
    if (!selectedWorkerId) return [];
    return stockItems
      .filter(item => item.worker_id === selectedWorkerId)
      .sort((a, b) => {
        if (a.status === 'Pending' && b.status === 'Completed') return -1;
        if (a.status === 'Completed' && b.status === 'Pending') return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [stockItems, selectedWorkerId]);

  // Worker stats
  const activeWorkerStats = useMemo(() => {
    const items = activeWorkerItems;
    const pending = items.filter(i => i.status === 'Pending').length;
    const completed = items.filter(i => i.status === 'Completed').length;
    return { total: items.length, pending, completed };
  }, [activeWorkerItems]);

  // Admin stats
  const adminStats = useMemo(() => {
    const pending = stockItems.filter(i => i.status === 'Pending').length;
    const completed = stockItems.filter(i => i.status === 'Completed').length;
    return { total: stockItems.length, pending, completed };
  }, [stockItems]);

  // Admin filtered items
  const adminFilteredItems = useMemo(() => {
    let items = stockItems;
    
    if (adminFilter !== 'All') {
      items = items.filter(i => i.status === adminFilter);
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      items = items.filter(i => 
        i.product_name.toLowerCase().includes(term) ||
        i.worker_name.toLowerCase().includes(term) ||
        (i.notes && i.notes.toLowerCase().includes(term))
      );
    }
    
    return items.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [stockItems, adminFilter, searchTerm]);

  // ============================================
  // WORKER HANDLERS
  // ============================================

  const handleAddWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerName.trim()) return;
    
    // Check if worker already exists
    const existing = workers.find(w => 
      w.name.toLowerCase() === workerName.trim().toLowerCase()
    );
    
    if (existing) {
      setError('Jina hili tayari lipo. Chagua jina lingine.');
      setTimeout(() => setError(null), 5000);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/workers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: workerName.trim(),
          phone: workerPhone.trim()
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setWorkers(prev => [...prev, result.worker]);
        setIsAddWorkerModalOpen(false);
        setWorkerName('');
        setWorkerPhone('');
        
        // Auto-select the new worker
        setSelectedWorkerId(result.worker.id);
        
        setSuccessMessage('Jina lako limesajiliwa!');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(result.error || 'Imeshindwa kusajili jina');
      }
    } catch (err: any) {
      console.error('Failed to add worker:', err);
      // Fallback - save locally
      const newWorker: Worker = {
        id: 'worker-' + Date.now(),
        name: workerName.trim(),
        phone: workerPhone.trim(),
        created_at: new Date().toISOString()
      };
      setWorkers(prev => [...prev, newWorker]);
      setIsAddWorkerModalOpen(false);
      setWorkerName('');
      setWorkerPhone('');
      setSelectedWorkerId(newWorker.id);
      
      // Save to localStorage
      const savedData = localStorage.getItem('stock_requests_data');
      const parsed = savedData ? JSON.parse(savedData) : { workers: [], items: [] };
      parsed.workers = [...(parsed.workers || []), newWorker];
      localStorage.setItem('stock_requests_data', JSON.stringify(parsed));
      
      setSuccessMessage('Jina lako limesajiliwa!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================
  // PRODUCT HANDLERS
  // ============================================

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkerId || !productName.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    const worker = workers.find(w => w.id === selectedWorkerId);
    if (!worker) {
      setError('Mfanyakazi hakupatikana');
      setIsLoading(false);
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId: selectedWorkerId,
          workerName: worker.name,
          productName: productName.trim(),
          quantity: productQuantity.trim(),
          notes: productNotes.trim()
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setStockItems(prev => [result.item, ...prev]);
        setIsAddProductModalOpen(false);
        setProductName('');
        setProductQuantity('');
        setProductNotes('');
        
        setSuccessMessage('Bidhaa imeongezwa kwenye orodha!');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(result.error || 'Imeshindwa kuongeza bidhaa');
      }
    } catch (err: any) {
      console.error('Failed to add product:', err);
      // Fallback - save locally
      const newItem: StockItem = {
        id: 'item-' + Date.now(),
        worker_id: selectedWorkerId,
        worker_name: worker.name,
        product_name: productName.trim(),
        quantity: productQuantity.trim(),
        notes: productNotes.trim(),
        status: 'Pending',
        created_at: new Date().toISOString()
      };
      setStockItems(prev => [newItem, ...prev]);
      setIsAddProductModalOpen(false);
      setProductName('');
      setProductQuantity('');
      setProductNotes('');
      
      // Save to localStorage
      const savedData = localStorage.getItem('stock_requests_data');
      const parsed = savedData ? JSON.parse(savedData) : { workers: [], items: [] };
      parsed.items = [newItem, ...(parsed.items || [])];
      localStorage.setItem('stock_requests_data', JSON.stringify(parsed));
      
      setSuccessMessage('Bidhaa imeongezwa!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStatus = async (itemId: string, currentStatus: 'Pending' | 'Completed') => {
    const newStatus = currentStatus === 'Pending' ? 'Completed' : 'Pending';
    
    setIsLoading(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setStockItems(prev => prev.map(item => 
          item.id === itemId 
            ? { 
                ...item, 
                status: newStatus,
                completed_at: newStatus === 'Completed' ? new Date().toISOString() : undefined
              } 
            : item
        ));
        
        setSuccessMessage(newStatus === 'Completed' ? 'Imewekwa kama imefanyika!' : 'Imerejeshwa kwenye pending');
        setTimeout(() => setSuccessMessage(null), 2000);
      }
    } catch (err: any) {
      console.error('Failed to toggle status:', err);
      // Update locally
      setStockItems(prev => prev.map(item => 
        item.id === itemId 
          ? { 
              ...item, 
              status: newStatus,
              completed_at: newStatus === 'Completed' ? new Date().toISOString() : undefined
            } 
          : item
      ));
      
      // Update localStorage
      const savedData = localStorage.getItem('stock_requests_data');
      if (savedData) {
        const parsed = JSON.parse(savedData);
        parsed.items = (parsed.items || []).map((item: StockItem) => 
          item.id === itemId 
            ? { 
                ...item, 
                status: newStatus,
                completed_at: newStatus === 'Completed' ? new Date().toISOString() : undefined
              } 
            : item
        );
        localStorage.setItem('stock_requests_data', JSON.stringify(parsed));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Je, una uhakika unataka kufuta bidhaa hii?')) return;
    
    setIsLoading(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/${itemId}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        setStockItems(prev => prev.filter(item => item.id !== itemId));
        setSuccessMessage('Bidhaa imefutwa');
        setTimeout(() => setSuccessMessage(null), 2000);
      }
    } catch (err: any) {
      console.error('Failed to delete item:', err);
      // Update locally
      setStockItems(prev => prev.filter(item => item.id !== itemId));
      
      // Update localStorage
      const savedData = localStorage.getItem('stock_requests_data');
      if (savedData) {
        const parsed = JSON.parse(savedData);
        parsed.items = (parsed.items || []).filter((item: StockItem) => item.id !== itemId);
        localStorage.setItem('stock_requests_data', JSON.stringify(parsed));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('sw-TZ', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('sw-TZ', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      
      {/* Error Banner */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-rose-700 text-xs">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Success Banner */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-2 text-emerald-700 text-xs">
          <CheckCircle2 size={16} />
          <span>{successMessage}</span>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center gap-2 text-xs text-slate-400 py-2">
          <Loader2 size={14} className="animate-spin" />
          <span>Inasasisha...</span>
        </div>
      )}

      {/* MAIN VIEW */}
      {activeWorker ? (
        /* WORKER'S PERSONAL LIST */
        <div className="space-y-6 text-xs text-left">
          {/* Worker Header */}
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setSelectedWorkerId(null)}
                  className="p-2.5 hover:bg-slate-50 text-slate-500 hover:text-slate-700 rounded-2xl border border-slate-100 transition-colors"
                >
                  <ArrowLeft size={16} />
                </button>
                <div className="h-16 w-16 rounded-2xl bg-accent/10 text-accent font-extrabold text-xl flex items-center justify-center shadow-sm">
                  {getInitials(activeWorker.name)}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">{activeWorker.name}</h3>
                  <p className="text-xs text-slate-400 mt-1">Orodha ya Bidhaa Zisizopo</p>
                </div>
              </div>
              <button 
                onClick={() => setIsAddProductModalOpen(true)}
                className="bg-accent hover:bg-accent/90 text-white font-bold py-2.5 px-5 rounded-xl flex items-center gap-2 shadow-sm transition"
              >
                <Plus size={16} /> Ongeza Bidhaa
              </button>
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 pt-4 mt-4 border-t border-slate-100">
              <div className="text-center">
                <p className="text-xs text-slate-400">Jumla</p>
                <p className="text-lg font-bold text-slate-800">{activeWorkerStats.total}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400">Bado</p>
                <p className="text-lg font-bold text-amber-600">{activeWorkerStats.pending}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400">Zimefanyika</p>
                <p className="text-lg font-bold text-emerald-600">{activeWorkerStats.completed}</p>
              </div>
            </div>
          </div>

          {/* Product List */}
          <div className="space-y-4">
            {activeWorkerItems.length > 0 ? activeWorkerItems.map(item => (
              <div key={item.id} className={`bg-white rounded-3xl border p-5 shadow-sm transition ${
                item.status === 'Completed' ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-100'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                      item.status === 'Completed' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                    }`}>
                      {item.status === 'Completed' ? <CheckCircle2 size={18} /> : <Clock size={18} />}
                    </div>
                    <div className="flex-1">
                      <h4 className={`text-sm font-bold ${item.status === 'Completed' ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                        {item.product_name}
                      </h4>
                      {item.quantity && (
                        <p className="text-xs text-slate-500 mt-1">Idadi: {item.quantity}</p>
                      )}
                      {item.notes && (
                        <p className="text-xs text-slate-400 mt-1 italic">{item.notes}</p>
                      )}
                      <p className="text-[10px] text-slate-400 mt-2">
                        {formatDate(item.created_at)} • {formatTime(item.created_at)}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDeleteItem(item.id)}
                    className="p-2 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-600 transition shrink-0"
                    title="Futa"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )) : (
              <div className="bg-white p-12 text-center rounded-3xl border border-slate-100 shadow-sm text-slate-400">
                <Package size={40} className="mx-auto text-slate-300 mb-3" />
                <p className="text-sm font-semibold">Hakuna bidhaa bado.</p>
                <p className="text-xs mt-1">Bonyeza "Ongeza Bidhaa" kuongeza bidhaa ya kwanza.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* WORKER SELECTION LIST */
        <>
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-white p-5 rounded-3xl border border-slate-100 shadow-sm gap-4">
            <div>
              <h2 className="text-md font-bold text-slate-800 flex items-center gap-2">
                <Package className="text-accent" size={20} />
                Orodha ya Bidhaa Zisizopo
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Chagua jina lako ili kuona au kuongeza bidhaa
              </p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setIsViewAllModalOpen(true)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5 shadow-sm transition"
              >
                <ListChecks size={15} /> Orodha Yote (Admin)
              </button>
              <button 
                onClick={() => setIsAddWorkerModalOpen(true)}
                className="bg-accent hover:bg-accent/90 text-white font-semibold text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5 shadow-sm transition"
              >
                <Plus size={15} /> Ongeza Jina Lako
              </button>
            </div>
          </div>

          {/* Workers Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {workers.length > 0 ? workers.map(worker => {
              const workerItems = stockItems.filter(i => i.worker_id === worker.id);
              const pendingCount = workerItems.filter(i => i.status === 'Pending').length;
              const completedCount = workerItems.filter(i => i.status === 'Completed').length;
              
              return (
                <div 
                  key={worker.id}
                  onClick={() => setSelectedWorkerId(worker.id)}
                  className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm hover:shadow-md hover:border-accent/50 cursor-pointer transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-accent/10 text-accent font-bold flex items-center justify-center">
                        {getInitials(worker.name)}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">{worker.name}</h3>
                        {worker.phone && (
                          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                            <Phone size={10} /> {worker.phone}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      pendingCount > 0 ? 'bg-amber-100 text-amber-700' : 
                      workerItems.length > 0 ? 'bg-emerald-100 text-emerald-700' : 
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {pendingCount > 0 ? `${pendingCount} Bado` : 
                       workerItems.length > 0 ? 'Zote Zimefanyika' : 
                       'Hakuna'}
                    </span>
                  </div>
                  
                  <div className="mt-4 pt-3 border-t border-slate-50 flex justify-between items-center">
                    <div className="flex gap-4">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Jumla</p>
                        <p className="text-sm font-bold text-slate-800">{workerItems.length}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Bado</p>
                        <p className="text-sm font-bold text-amber-600">{pendingCount}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Zimefanyika</p>
                        <p className="text-sm font-bold text-emerald-600">{completedCount}</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-400" />
                  </div>
                </div>
              );
            }) : (
              <div className="col-span-full bg-white p-12 text-center rounded-3xl border border-slate-100 shadow-sm text-slate-400">
                <UserPlus size={40} className="mx-auto text-slate-300 mb-3" />
                <p className="text-sm font-semibold">Hakuna majina bado.</p>
                <p className="text-xs mt-1">Bonyeza "Ongeza Jina Lako" kuanza.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* MODAL: Add Worker */}
      {isAddWorkerModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <button 
              onClick={() => setIsAddWorkerModalOpen(false)} 
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition"
            >
              <X size={18} />
            </button>
            <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
              <UserPlus className="text-accent" size={18} />
              Ongeza Jina Lako
            </h3>
            <p className="text-xs text-slate-400">
              Andika jina lako ili kuweza kuweka bidhaa zisizopo
            </p>
            <form onSubmit={handleAddWorker} className="space-y-4 text-xs text-left">
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Jina Lako *
                </label>
                <input 
                  type="text" 
                  required 
                  value={workerName} 
                  onChange={(e) => setWorkerName(e.target.value)} 
                  placeholder="Mfano: Juma"
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-accent text-base" 
                  autoFocus
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Namba ya Simu (Hiari)
                </label>
                <input 
                  type="tel" 
                  value={workerPhone} 
                  onChange={(e) => setWorkerPhone(e.target.value)} 
                  placeholder="0712345678"
                  className="w-full p-3 border border-slate-200 rounded-xl" 
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setIsAddWorkerModalOpen(false)} 
                  disabled={isLoading}
                  className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600 transition disabled:opacity-50"
                >
                  Ghairi
                </button>
                <button 
                  type="submit" 
                  disabled={isLoading || !workerName.trim()}
                  className="px-5 py-2.5 bg-accent hover:bg-accent/90 text-white rounded-xl font-semibold shadow-sm transition disabled:opacity-50 flex items-center gap-2"
                >
                  {isLoading ? (
                    <><Loader2 size={14} className="animate-spin" /> Inasajili...</>
                  ) : (
                    <>Endelea</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Product */}
      {isAddProductModalOpen && activeWorker && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <button 
              onClick={() => setIsAddProductModalOpen(false)} 
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition"
            >
              <X size={18} />
            </button>
            <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
              <Package className="text-amber-500" size={18} />
              Ongeza Bidhaa
            </h3>
            <p className="text-xs text-slate-400">
              Bidhaa iliyoongezwa na <strong>{activeWorker.name}</strong>
            </p>
            <form onSubmit={handleAddProduct} className="space-y-4 text-xs text-left">
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Jina la Bidhaa *
                </label>
                <input 
                  type="text" 
                  required 
                  value={productName} 
                  onChange={(e) => setProductName(e.target.value)} 
                  placeholder="Mfano: Speaker ya Sony"
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-accent text-base" 
                  autoFocus
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Idadi Inayohitajika (Hiari)
                </label>
                <input 
                  type="text" 
                  value={productQuantity} 
                  onChange={(e) => setProductQuantity(e.target.value)} 
                  placeholder="Mfano: 5 pieces"
                  className="w-full p-2.5 border border-slate-200 rounded-xl" 
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Maelezo ya Ziada (Hiari)
                </label>
                <textarea 
                  value={productNotes} 
                  onChange={(e) => setProductNotes(e.target.value)} 
                  placeholder="Maelezo yoyote..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl h-20" 
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setIsAddProductModalOpen(false)} 
                  disabled={isLoading}
                  className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600 transition disabled:opacity-50"
                >
                  Ghairi
                </button>
                <button 
                  type="submit" 
                  disabled={isLoading || !productName.trim()}
                  className="px-5 py-2 bg-accent hover:bg-accent/90 text-white rounded-xl font-semibold shadow-sm transition disabled:opacity-50 flex items-center gap-2"
                >
                  {isLoading ? (
                    <><Loader2 size={14} className="animate-spin" /> Inaongeza...</>
                  ) : (
                    <><Plus size={14} /> Ongeza</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Admin View All */}
      {isViewAllModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-hidden flex flex-col">
            <button 
              onClick={() => setIsViewAllModalOpen(false)} 
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition z-10"
            >
              <X size={18} />
            </button>
            
            <h3 className="text-md font-bold text-slate-800 flex items-center gap-2 mb-4">
              <ListChecks className="text-accent" size={20} />
              Orodha ya Bidhaa Zote (Admin)
            </h3>
            
            {/* Admin Stats */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-slate-50 rounded-2xl p-4 text-center">
                <p className="text-xs text-slate-400">Jumla</p>
                <p className="text-xl font-black text-slate-800">{adminStats.total}</p>
              </div>
              <div className="bg-amber-50 rounded-2xl p-4 text-center">
                <p className="text-xs text-amber-600">Bado Hazijafanyika</p>
                <p className="text-xl font-black text-amber-700">{adminStats.pending}</p>
              </div>
              <div className="bg-emerald-50 rounded-2xl p-4 text-center">
                <p className="text-xs text-emerald-600">Zimefanyika</p>
                <p className="text-xl font-black text-emerald-700">{adminStats.completed}</p>
              </div>
            </div>
            
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="flex gap-2">
                {(['Pending', 'Completed', 'All'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setAdminFilter(tab)}
                    className={`px-4 py-2 text-xs font-semibold rounded-xl transition ${
                      adminFilter === tab 
                        ? 'bg-slate-900 text-white' 
                        : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {tab === 'Pending' ? 'Bado' : tab === 'Completed' ? 'Zimefanyika' : 'Zote'}
                  </button>
                ))}
              </div>
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tafuta bidhaa au mfanyakazi..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs"
                />
              </div>
            </div>
            
            {/* Items List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {adminFilteredItems.length > 0 ? adminFilteredItems.map(item => (
                <div 
                  key={item.id} 
                  className={`rounded-2xl border p-4 transition ${
                    item.status === 'Completed' 
                      ? 'border-emerald-200 bg-emerald-50/30' 
                      : 'border-slate-100 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => handleToggleStatus(item.id, item.status)}
                      className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 transition ${
                        item.status === 'Completed'
                          ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                          : 'border-2 border-slate-300 text-transparent hover:border-emerald-500 hover:text-emerald-500 bg-white'
                      }`}
                      title={item.status === 'Completed' ? 'Rejesha' : 'Weka kama imefanyika'}
                    >
                      <Check size={16} strokeWidth={3} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className={`text-sm font-bold ${
                            item.status === 'Completed' ? 'text-slate-500 line-through' : 'text-slate-800'
                          }`}>
                            {item.product_name}
                          </h4>
                          <div className="flex flex-wrap items-center gap-3 mt-1">
                            <span className="text-[11px] font-semibold text-accent flex items-center gap-1">
                              <User size={11} /> {item.worker_name}
                            </span>
                            {item.quantity && (
                              <span className="text-[11px] text-slate-500">
                                Idadi: {item.quantity}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400">
                              {formatDate(item.created_at)} • {formatTime(item.created_at)}
                            </span>
                          </div>
                          {item.notes && (
                            <p className="text-[11px] text-slate-500 mt-1 italic">{item.notes}</p>
                          )}
                          {item.status === 'Completed' && item.completed_at && (
                            <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">
                              <CheckCircle2 size={10} /> Imefanyika: {formatDate(item.completed_at)} • {formatTime(item.completed_at)}
                            </p>
                          )}
                        </div>
                        <button 
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition shrink-0"
                          title="Futa"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="text-center py-12 text-slate-400">
                  <Package size={40} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-sm font-semibold">Hakuna bidhaa zilizopatikana.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
