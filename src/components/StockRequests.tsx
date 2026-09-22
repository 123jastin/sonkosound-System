/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Plus, User, X, Trash2, Check, Loader2, AlertCircle,
  Package, Search, ArrowLeft, CheckCircle2, Clock,
  ListChecks, Phone, UserPlus, ChevronRight, LogOut,
  TrendingUp, Calendar, Users, Award, ShoppingBag, RefreshCw
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
  status: 'Pending' | 'Purchased';   // ← Changed from 'Completed' to 'Purchased'
  created_at: string;
  purchased_at?: string;              // ← Changed from completed_at
}

interface StockRequestsProps {
  onUpdate?: () => void;
  isWorkerMode?: boolean;
}

const API_BASE_URL = '/api/stock-requests';
const WORKER_DEVICE_KEY = 'worker_device_id';

export default function StockRequests({ onUpdate, isWorkerMode = false }: StockRequestsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [rememberedWorkerId, setRememberedWorkerId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  
  // Modals
  const [isAddWorkerModalOpen, setIsAddWorkerModalOpen] = useState(false);
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  
  // Worker form
  const [workerName, setWorkerName] = useState('');
  const [workerPhone, setWorkerPhone] = useState('');
  
  // Product form
  const [productName, setProductName] = useState('');
  const [productQuantity, setProductQuantity] = useState('');
  const [productNotes, setProductNotes] = useState('');
  
  // Admin panel filters
  const [searchTerm, setSearchTerm] = useState('');
  const [adminFilter, setAdminFilter] = useState<'All' | 'Pending' | 'Purchased'>('Pending');
  const [workerFilter, setWorkerFilter] = useState<string>('All');
  const [expandedWorkers, setExpandedWorkers] = useState<Set<string>>(new Set());

  // ============================================
  // LOAD DATA
  // ============================================
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}`);
      const data = await response.json();
      
      if (data.success) {
        // Normalize items: convert any legacy 'Completed' status to 'Purchased'
        const normalizedItems = (Array.isArray(data.items) ? data.items : []).map((item: any) => ({
          ...item,
          status: item.status === 'Completed' ? 'Purchased' : item.status,
          purchased_at: item.purchased_at || item.completed_at
        }));
        
        setWorkers(Array.isArray(data.workers) ? data.workers : []);
        setStockItems(normalizedItems);
      }
    } catch (err) {
      console.error('Failed to load stock requests:', err);
      const savedData = localStorage.getItem('stock_requests_data');
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          const normalizedItems = (parsed.items || []).map((item: any) => ({
            ...item,
            status: item.status === 'Completed' ? 'Purchased' : item.status,
            purchased_at: item.purchased_at || item.completed_at
          }));
          setWorkers(parsed.workers || []);
          setStockItems(normalizedItems);
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

  // ============================================
  // BROWSER MEMORY (Remember worker)
  // ============================================
  useEffect(() => {
    if (isWorkerMode) {
      const savedWorkerId = localStorage.getItem(WORKER_DEVICE_KEY);
      if (savedWorkerId) {
        setRememberedWorkerId(savedWorkerId);
      }
    }
  }, [isWorkerMode]);

  useEffect(() => {
    if (isWorkerMode && !isInitializing && rememberedWorkerId && workers.length > 0) {
      const exists = workers.find(w => w.id === rememberedWorkerId);
      if (exists) {
        setSelectedWorkerId(rememberedWorkerId);
      } else {
        localStorage.removeItem(WORKER_DEVICE_KEY);
        setRememberedWorkerId(null);
      }
    }
  }, [rememberedWorkerId, workers, isInitializing, isWorkerMode]);

  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setIsInitializing(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  // ============================================
  // COMPUTED
  // ============================================
  const activeWorker = useMemo(() => {
    if (!selectedWorkerId) return null;
    return workers.find(w => w.id === selectedWorkerId) || null;
  }, [workers, selectedWorkerId]);

  const activeWorkerItems = useMemo(() => {
    if (!selectedWorkerId) return [];
    return stockItems
      .filter(item => item.worker_id === selectedWorkerId)
      .sort((a, b) => {
        if (a.status === 'Pending' && b.status === 'Purchased') return -1;
        if (a.status === 'Purchased' && b.status === 'Pending') return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [stockItems, selectedWorkerId]);

  const activeWorkerStats = useMemo(() => {
    const items = activeWorkerItems;
    const pending = items.filter(i => i.status === 'Pending').length;
    const purchased = items.filter(i => i.status === 'Purchased').length;
    return { total: items.length, pending, purchased };
  }, [activeWorkerItems]);

  const adminStats = useMemo(() => {
    const pending = stockItems.filter(i => i.status === 'Pending').length;
    const purchased = stockItems.filter(i => i.status === 'Purchased').length;
    return { 
      total: stockItems.length, 
      pending, 
      purchased, 
      workers: workers.length,
      purchaseRate: stockItems.length > 0 
        ? Math.round((purchased / stockItems.length) * 100) 
        : 0
    };
  }, [stockItems, workers]);

  // Group items by worker
  const itemsByWorker = useMemo(() => {
    const grouped: Record<string, { worker: Worker; items: StockItem[]; pending: number; purchased: number }> = {};
    
    workers.forEach(worker => {
      const workerItems = stockItems.filter(i => i.worker_id === worker.id);
      
      let filteredItems = workerItems;
      
      if (adminFilter !== 'All') {
        filteredItems = filteredItems.filter(i => i.status === adminFilter);
      }
      
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filteredItems = filteredItems.filter(i => 
          i.product_name.toLowerCase().includes(term) ||
          (i.notes && i.notes.toLowerCase().includes(term))
        );
      }
      
      if (filteredItems.length > 0 || workerItems.length === 0) {
        grouped[worker.id] = {
          worker,
          items: filteredItems.sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          ),
          pending: workerItems.filter(i => i.status === 'Pending').length,
          purchased: workerItems.filter(i => i.status === 'Purchased').length
        };
      }
    });
    
    if (workerFilter !== 'All') {
      const filtered: typeof grouped = {};
      if (grouped[workerFilter]) {
        filtered[workerFilter] = grouped[workerFilter];
      }
      return filtered;
    }
    
    return grouped;
  }, [workers, stockItems, adminFilter, searchTerm, workerFilter]);

  // ============================================
  // HANDLERS
  // ============================================

  const handleSelectWorker = (workerId: string) => {
    setSelectedWorkerId(workerId);
    localStorage.setItem(WORKER_DEVICE_KEY, workerId);
    setRememberedWorkerId(workerId);
  };

  const handleSwitchWorker = () => {
    setSelectedWorkerId(null);
  };

  const handleForgetWorker = () => {
    if (!confirm('Je, una uhakika unataka kuondoa kumbukumbu ya jina lako kwenye kifaa hiki?')) return;
    localStorage.removeItem(WORKER_DEVICE_KEY);
    setRememberedWorkerId(null);
    setSelectedWorkerId(null);
    setSuccessMessage('Kumbukumbu imeondolewa');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const toggleWorkerExpanded = (workerId: string) => {
    setExpandedWorkers(prev => {
      const next = new Set(prev);
      if (next.has(workerId)) {
        next.delete(workerId);
      } else {
        next.add(workerId);
      }
      return next;
    });
  };

  const expandAllWorkers = () => {
    setExpandedWorkers(new Set(Object.keys(itemsByWorker)));
  };

  const collapseAllWorkers = () => {
    setExpandedWorkers(new Set());
  };

  const handleAddWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerName.trim()) return;
    
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
        const newWorker = result.worker;
        setWorkers(prev => [...prev, newWorker]);
        setIsAddWorkerModalOpen(false);
        setWorkerName('');
        setWorkerPhone('');
        
        handleSelectWorker(newWorker.id);
        
        setSuccessMessage('Jina lako limesajiliwa!');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(result.error || 'Imeshindwa kusajili jina');
      }
    } catch (err: any) {
      console.error('Failed to add worker:', err);
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
      
      handleSelectWorker(newWorker.id);
      
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

  const handleToggleStatus = async (itemId: string, currentStatus: 'Pending' | 'Purchased') => {
    const newStatus = currentStatus === 'Pending' ? 'Purchased' : 'Pending';
    
    // Optimistic update
    setStockItems(prev => prev.map(item => 
      item.id === itemId 
        ? { 
            ...item, 
            status: newStatus,
            purchased_at: newStatus === 'Purchased' ? new Date().toISOString() : undefined
          } 
        : item
    ));
    
    try {
      const response = await fetch(`${API_BASE_URL}/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setSuccessMessage(newStatus === 'Purchased' ? '✅ Imewekwa kama Zimenunuliwa!' : 'Imerejeshwa');
        setTimeout(() => setSuccessMessage(null), 1500);
      }
    } catch (err: any) {
      console.error('Failed to toggle status:', err);
      setStockItems(prev => prev.map(item => 
        item.id === itemId 
          ? { ...item, status: currentStatus } 
          : item
      ));
      
      const savedData = localStorage.getItem('stock_requests_data');
      if (savedData) {
        const parsed = JSON.parse(savedData);
        parsed.items = (parsed.items || []).map((item: StockItem) => 
          item.id === itemId 
            ? { ...item, status: newStatus, purchased_at: newStatus === 'Purchased' ? new Date().toISOString() : undefined } 
            : item
        );
        localStorage.setItem('stock_requests_data', JSON.stringify(parsed));
      }
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Je, una uhakika unataka kufuta bidhaa hii?')) return;
    
    setStockItems(prev => prev.filter(item => item.id !== itemId));
    
    try {
      await fetch(`${API_BASE_URL}/${itemId}`, {
        method: 'DELETE'
      });
      setSuccessMessage('Bidhaa imefutwa');
      setTimeout(() => setSuccessMessage(null), 2000);
    } catch (err: any) {
      console.error('Failed to delete item:', err);
      const savedData = localStorage.getItem('stock_requests_data');
      if (savedData) {
        const parsed = JSON.parse(savedData);
        parsed.items = (parsed.items || []).filter((item: StockItem) => item.id !== itemId);
        localStorage.setItem('stock_requests_data', JSON.stringify(parsed));
      }
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('sw-TZ', {
      day: 'numeric',
      month: 'short'
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('sw-TZ', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // ============================================
  // LOADING SCREEN
  // ============================================
  if (isInitializing && rememberedWorkerId && isWorkerMode) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <Loader2 size={32} className="text-accent animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Inakukumbuka...</p>
        </div>
      </div>
    );
  }

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

      {/* ============================================
          WORKER MODE
          ============================================ */}
      {isWorkerMode ? (
        activeWorker ? (
          /* Worker's Personal List */
          <div className="space-y-6 text-xs text-left">
            <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={handleSwitchWorker}
                    className="p-2.5 hover:bg-slate-50 text-slate-500 hover:text-slate-700 rounded-2xl border border-slate-100 transition-colors"
                    title="Badilisha Jina"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <div className="h-16 w-16 rounded-2xl bg-accent/10 text-accent font-extrabold text-xl flex items-center justify-center shadow-sm">
                    {getInitials(activeWorker.name)}
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-800">{activeWorker.name}</h3>
                    <p className="text-xs text-slate-400 mt-1">Orodha yako ya Bidhaa Zisizokuepo</p>
                    {rememberedWorkerId === activeWorker.id && (
                      <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">
                        <CheckCircle2 size={10} /> Imekumbukwa kwenye kifaa hiki
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button 
                    onClick={() => setIsAddProductModalOpen(true)}
                    className="bg-accent hover:bg-accent/90 text-white font-bold py-2.5 px-5 rounded-xl flex items-center justify-center gap-2 shadow-sm transition"
                  >
                    <Plus size={16} /> Ongeza Bidhaa
                  </button>
                </div>
              </div>
              
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
                  <p className="text-xs text-slate-400">Zimenunuliwa</p>
                  <p className="text-lg font-bold text-emerald-600">{activeWorkerStats.purchased}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {activeWorkerItems.length > 0 ? activeWorkerItems.map(item => (
                <div key={item.id} className={`bg-white rounded-3xl border p-5 shadow-sm transition ${
                  item.status === 'Purchased' ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-100'
                }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                        item.status === 'Purchased' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                      }`}>
                        {item.status === 'Purchased' ? <ShoppingBag size={18} /> : <Clock size={18} />}
                      </div>
                      <div className="flex-1">
                        <h4 className={`text-sm font-bold ${item.status === 'Purchased' ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
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
                        {item.status === 'Purchased' && item.purchased_at && (
                          <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">
                            <ShoppingBag size={10} /> Ilinunuliwa: {formatDate(item.purchased_at)} • {formatTime(item.purchased_at)}
                          </p>
                        )}
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
          /* Worker Name Selection */
          <>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-white p-5 rounded-3xl border border-slate-100 shadow-sm gap-4">
              <div>
                <h2 className="text-md font-bold text-slate-800 flex items-center gap-2">
                  <Package className="text-accent" size={20} />
                  Orodha ya Bidhaa Zisizokuepo
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Chagua jina lako ili kuona au kuongeza bidhaa
                </p>
              </div>
              <button 
                onClick={() => setIsAddWorkerModalOpen(true)}
                className="bg-accent hover:bg-accent/90 text-white font-semibold text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5 shadow-sm transition"
              >
                <Plus size={15} /> Ongeza Jina Lako
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {workers.length > 0 ? workers.map(worker => {
                const workerItems = stockItems.filter(i => i.worker_id === worker.id);
                const pendingCount = workerItems.filter(i => i.status === 'Pending').length;
                const purchasedCount = workerItems.filter(i => i.status === 'Purchased').length;
                const isRemembered = rememberedWorkerId === worker.id;
                
                return (
                  <div 
                    key={worker.id}
                    onClick={() => handleSelectWorker(worker.id)}
                    className={`bg-white rounded-3xl border p-5 shadow-sm hover:shadow-md cursor-pointer transition ${
                      isRemembered 
                        ? 'border-emerald-300 ring-2 ring-emerald-500/20 bg-emerald-50/30' 
                        : 'border-slate-100 hover:border-accent/50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`h-12 w-12 rounded-xl font-bold flex items-center justify-center ${
                          isRemembered ? 'bg-emerald-100 text-emerald-700' : 'bg-accent/10 text-accent'
                        }`}>
                          {getInitials(worker.name)}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                            {worker.name}
                            {isRemembered && <CheckCircle2 size={12} className="text-emerald-600" />}
                          </h3>
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
                         workerItems.length > 0 ? 'Zote' : 
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
                          <p className="text-[10px] text-slate-400 uppercase font-bold">Zimenunuliwa</p>
                          <p className="text-sm font-bold text-emerald-600">{purchasedCount}</p>
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
        )
      ) : (
        /* ============================================
            ADMIN MODE - PROFESSIONAL PANEL
            ============================================ */
        <div className="space-y-6">
          
          {/* Admin Header */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 md:p-8 shadow-xl text-white">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                  <Award size={26} className="text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded-full border border-amber-500/30 uppercase tracking-wider">
                      👑 Admin Panel
                    </span>
                  </div>
                  <h1 className="text-xl md:text-2xl font-extrabold mt-1">
                    Paneli ya Bidhaa
                  </h1>
                  <p className="text-slate-300 text-xs mt-1">
                    Fuatilia na thibitisha bidhaa zisizokuepo
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full flex items-center gap-1.5 border border-white/20">
                  <Calendar size={11} />
                  {new Date().toLocaleDateString('sw-TZ', { 
                    weekday: 'long', 
                    day: 'numeric', 
                    month: 'long'
                  })}
                </span>
                <button
                  onClick={loadData}
                  disabled={isLoading}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition disabled:opacity-50"
                  title="Sasisha"
                >
                  <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <ListChecks size={16} className="text-white/70" />
                  <span className="text-[9px] uppercase font-bold text-white/60 tracking-wider">Jumla</span>
                </div>
                <p className="text-2xl md:text-3xl font-black">{adminStats.total}</p>
                <p className="text-[10px] text-white/60 mt-1">Bidhaa zote</p>
              </div>
              
              <div className="bg-amber-500/20 backdrop-blur-sm rounded-2xl p-4 border border-amber-400/30">
                <div className="flex items-center justify-between mb-2">
                  <Clock size={16} className="text-amber-300" />
                  <span className="text-[9px] uppercase font-bold text-amber-200 tracking-wider">Bado</span>
                </div>
                <p className="text-2xl md:text-3xl font-black text-amber-100">{adminStats.pending}</p>
                <p className="text-[10px] text-amber-200/80 mt-1">Zisizonunuliwa</p>
              </div>
              
              <div className="bg-emerald-500/20 backdrop-blur-sm rounded-2xl p-4 border border-emerald-400/30">
                <div className="flex items-center justify-between mb-2">
                  <ShoppingBag size={16} className="text-emerald-300" />
                  <span className="text-[9px] uppercase font-bold text-emerald-200 tracking-wider">Zimenunuliwa</span>
                </div>
                <p className="text-2xl md:text-3xl font-black text-emerald-100">{adminStats.purchased}</p>
                <p className="text-[10px] text-emerald-200/80 mt-1">Zilizonunuliwa</p>
              </div>
              
              <div className="bg-blue-500/20 backdrop-blur-sm rounded-2xl p-4 border border-blue-400/30">
                <div className="flex items-center justify-between mb-2">
                  <TrendingUp size={16} className="text-blue-300" />
                  <span className="text-[9px] uppercase font-bold text-blue-200 tracking-wider">Kiwango</span>
                </div>
                <p className="text-2xl md:text-3xl font-black text-blue-100">{adminStats.purchaseRate}%</p>
                <p className="text-[10px] text-blue-200/80 mt-1">Ufanisi</p>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex flex-col lg:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tafuta bidhaa, mfanyakazi, au maelezo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-accent/20 focus:border-accent transition"
                />
              </div>
              
              <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
                {(['Pending', 'Purchased', 'All'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setAdminFilter(tab)}
                    className={`px-3 py-2 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                      adminFilter === tab 
                        ? tab === 'Pending'
                          ? 'bg-amber-500 text-white shadow-sm'
                          : tab === 'Purchased'
                            ? 'bg-emerald-500 text-white shadow-sm'
                            : 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-500 hover:bg-white/50'
                    }`}
                  >
                    {tab === 'Pending' ? (
                      <><Clock size={12} /> Bado ({adminStats.pending})</>
                    ) : tab === 'Purchased' ? (
                      <><ShoppingBag size={12} /> Zimenunuliwa ({adminStats.purchased})</>
                    ) : (
                      <><ListChecks size={12} /> Zote ({adminStats.total})</>
                    )}
                  </button>
                ))}
              </div>
              
              <div className="flex items-center gap-2">
                <Users size={14} className="text-slate-400" />
                <select
                  value={workerFilter}
                  onChange={(e) => setWorkerFilter(e.target.value)}
                  className="px-3 py-2.5 border border-slate-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-accent/20"
                >
                  <option value="All">Wafanyakazi Wote ({workers.length})</option>
                  {workers.map(w => {
                    const count = stockItems.filter(i => i.worker_id === w.id).length;
                    return (
                      <option key={w.id} value={w.id}>
                        {w.name} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>
              
              {workerFilter === 'All' && (
                <div className="flex gap-1">
                  <button
                    onClick={expandAllWorkers}
                    className="px-3 py-2 text-xs font-bold rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 transition"
                  >
                    Fungua Zote
                  </button>
                  <button
                    onClick={collapseAllWorkers}
                    className="px-3 py-2 text-xs font-bold rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 transition"
                  >
                    Funga Zote
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Items List */}
          {Object.keys(itemsByWorker).length > 0 ? (
            <div className="space-y-4">
              {Object.values(itemsByWorker).map(({ worker, items, pending, purchased }) => {
                const isExpanded = expandedWorkers.has(worker.id) || workerFilter !== 'All' || searchTerm.length > 0;
                const hasItems = items.length > 0;
                
                return (
                  <div key={worker.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <button
                      onClick={() => toggleWorkerExpanded(worker.id)}
                      className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-xl font-bold flex items-center justify-center ${
                          pending > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {getInitials(worker.name)}
                        </div>
                        <div className="text-left">
                          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            {worker.name}
                            {worker.phone && (
                              <span className="text-[10px] font-normal text-slate-400 flex items-center gap-1">
                                <Phone size={10} /> {worker.phone}
                              </span>
                            )}
                          </h3>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[10px] font-semibold text-amber-600 flex items-center gap-1">
                              <Clock size={10} /> {pending} Bado
                            </span>
                            <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-1">
                              <ShoppingBag size={10} /> {purchased} Zimenunuliwa
                            </span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight 
                        size={18} 
                        className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                      />
                    </button>
                    
                    {isExpanded && (
                      <div className="border-t border-slate-100 p-4 space-y-2 bg-slate-50/50">
                        {hasItems ? items.map(item => (
                          <div 
                            key={item.id} 
                            className={`rounded-xl border p-3 transition-all ${
                              item.status === 'Purchased' 
                                ? 'bg-emerald-50/50 border-emerald-200' 
                                : 'bg-white border-slate-200 hover:border-accent/50 hover:shadow-sm'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <button
                                onClick={() => handleToggleStatus(item.id, item.status)}
                                className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                                  item.status === 'Purchased'
                                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30 hover:bg-emerald-600'
                                    : 'border-2 border-slate-300 text-transparent hover:border-emerald-500 hover:text-emerald-500 hover:bg-emerald-50 bg-white'
                                }`}
                                title={item.status === 'Purchased' ? 'Rejesha' : 'Weka kama amenunua'}
                              >
                                <Check size={18} strokeWidth={3.5} />
                              </button>
                              
                              <div className="flex-1 min-w-0">
                                <h4 className={`text-sm font-bold ${
                                  item.status === 'Purchased' ? 'text-slate-500 line-through' : 'text-slate-800'
                                }`}>
                                  {item.product_name}
                                </h4>
                                
                                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                  {item.quantity && (
                                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                      📦 Idadi: {item.quantity}
                                    </span>
                                  )}
                                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                    <Clock size={9} /> {formatDate(item.created_at)} • {formatTime(item.created_at)}
                                  </span>
                                </div>
                                
                                {item.notes && (
                                  <p className="text-[11px] text-slate-500 mt-1.5 italic bg-white/70 rounded-lg p-2 border border-slate-100">
                                    💬 {item.notes}
                                  </p>
                                )}
                                
                                {item.status === 'Purchased' && item.purchased_at && (
                                  <p className="text-[10px] text-emerald-700 mt-1.5 flex items-center gap-1 font-semibold">
                                    <ShoppingBag size={10} /> Ilinunuliwa: {formatDate(item.purchased_at)} • {formatTime(item.purchased_at)}
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
                        )) : (
                          <div className="text-center py-6 text-slate-400">
                            <p className="text-xs">Hakuna bidhaa zinazolingana na kichujio</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white p-16 text-center rounded-3xl border border-slate-100 shadow-sm">
              <div className="h-20 w-20 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4">
                <Package size={36} className="text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-600">Hakuna bidhaa zilizopatikana</p>
              <p className="text-xs text-slate-400 mt-1">
                {searchTerm || adminFilter !== 'All' || workerFilter !== 'All'
                  ? 'Jaribu kubadilisha vichujio au tafuta kwa maneno mengine'
                  : 'Wafanyakazi hawajaongeza bidhaa zisizokuepo bado'}
              </p>
            </div>
          )}

          {/* Progress Summary */}
          {adminStats.total > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Wafanyakazi</p>
                    <p className="text-lg font-black text-slate-800">{adminStats.workers}</p>
                  </div>
                  <div className="h-8 w-px bg-slate-200"></div>
                  <div>
                    <p className="text-[10px] text-amber-500 uppercase font-bold tracking-wider">Zinasubiri</p>
                    <p className="text-lg font-black text-amber-600">{adminStats.pending}</p>
                  </div>
                  <div className="h-8 w-px bg-slate-200"></div>
                  <div>
                    <p className="text-[10px] text-emerald-500 uppercase font-bold tracking-wider">Zimenunuliwa</p>
                    <p className="text-lg font-black text-emerald-600">{adminStats.purchased}</p>
                  </div>
                </div>
                
                <div className="flex-1 min-w-[200px] max-w-md">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1.5">
                    <span>Maendeleo ya Ununuzi</span>
                    <span className="text-emerald-600">{adminStats.purchaseRate}%</span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-500"
                      style={{ width: `${adminStats.purchaseRate}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================
          MODALS
          ============================================ */}

      {/* MODAL: Add Worker */}
      {isAddWorkerModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
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
              Andika jina lako ili kuweza kuweka bidhaa zisizokuepo. Kifaa hiki kitakukumbuka.
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
                  {isLoading ? <><Loader2 size={14} className="animate-spin" /> Inasajili...</> : <>Endelea</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Product */}
      {isAddProductModalOpen && activeWorker && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
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
                  {isLoading ? <><Loader2 size={14} className="animate-spin" /> Inaongeza...</> : <><Plus size={14} /> Ongeza</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
