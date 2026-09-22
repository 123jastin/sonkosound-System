/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { 
  Plus, User, X, Trash2, Check, Loader2, AlertCircle,
  Package, Search, ArrowLeft, CheckCircle2, Clock,
  ListChecks, Phone, UserPlus, ChevronRight, LogOut,
  TrendingUp, Calendar, Users, ShoppingBag, RefreshCw,
  CheckSquare, Square, CalendarDays, Filter, MoreVertical,
  Download, FileText, FileDown
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
  status: 'Pending' | 'Purchased';
  created_at: string;
  purchased_at?: string;
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
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [downloadWorkerId, setDownloadWorkerId] = useState<string | null>(null);
  
  // Three-dot menu
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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
  
  // Date range filter
  const [dateFilter, setDateFilter] = useState<'All' | 'Today' | 'Yesterday' | 'Week' | 'Month' | 'Custom'>('All');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // ============================================
  // CLOSE MENU ON OUTSIDE CLICK
  // ============================================
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
  // BROWSER MEMORY
  // ============================================
  useEffect(() => {
    if (isWorkerMode) {
      const savedWorkerId = localStorage.getItem(WORKER_DEVICE_KEY);
      if (savedWorkerId) setRememberedWorkerId(savedWorkerId);
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
  // DATE FILTER
  // ============================================
  const getDateRange = useCallback((filterType = dateFilter) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (filterType) {
      case 'Today':
        return { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
      case 'Yesterday': {
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        return { start: yesterday, end: today };
      }
      case 'Week': {
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        return { start: weekAgo, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
      }
      case 'Month': {
        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        return { start: monthAgo, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
      }
      case 'Custom': {
        const start = customStartDate ? new Date(customStartDate) : new Date(0);
        const end = customEndDate 
          ? new Date(new Date(customEndDate).getTime() + 24 * 60 * 60 * 1000) 
          : new Date();
        return { start, end };
      }
      default:
        return null;
    }
  }, [dateFilter, customStartDate, customEndDate]);

  const isItemInDateRange = useCallback((item: StockItem, filterType?: typeof dateFilter) => {
    const range = getDateRange(filterType);
    if (!range) return true;
    
    const dateToCheck = item.status === 'Purchased' && item.purchased_at 
      ? new Date(item.purchased_at) 
      : new Date(item.created_at);
    
    return dateToCheck >= range.start && dateToCheck < range.end;
  }, [getDateRange]);

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
    const dateFiltered = stockItems.filter(i => isItemInDateRange(i));
    const pending = dateFiltered.filter(i => i.status === 'Pending').length;
    const purchased = dateFiltered.filter(i => i.status === 'Purchased').length;
    return { 
      total: dateFiltered.length, 
      pending, 
      purchased, 
      workers: workers.length,
      purchaseRate: dateFiltered.length > 0 
        ? Math.round((purchased / dateFiltered.length) * 100) 
        : 0
    };
  }, [stockItems, workers, isItemInDateRange]);

  const itemsByWorker = useMemo(() => {
    const grouped: Record<string, { worker: Worker; items: StockItem[]; pending: number; purchased: number }> = {};
    
    workers.forEach(worker => {
      const workerItems = stockItems.filter(i => i.worker_id === worker.id);
      let filteredItems = workerItems.filter(i => isItemInDateRange(i));
      
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
      if (grouped[workerFilter]) filtered[workerFilter] = grouped[workerFilter];
      return filtered;
    }
    
    return grouped;
  }, [workers, stockItems, adminFilter, searchTerm, workerFilter, isItemInDateRange]);

  // ============================================
  // WORKER HANDLERS
  // ============================================
  const handleSelectWorker = (workerId: string) => {
    setSelectedWorkerId(workerId);
    localStorage.setItem(WORKER_DEVICE_KEY, workerId);
    setRememberedWorkerId(workerId);
  };

  const handleSwitchWorker = () => setSelectedWorkerId(null);

  const handleForgetWorker = () => {
    if (!confirm('Je, una uhakika unataka kuondoa kumbukumbu ya jina lako kwenye kifaa hiki?')) return;
    localStorage.removeItem(WORKER_DEVICE_KEY);
    setRememberedWorkerId(null);
    setSelectedWorkerId(null);
    setSuccessMessage('Kumbukumbu imeondolewa');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleDeleteWorker = async (workerId: string) => {
    const worker = workers.find(w => w.id === workerId);
    const workerItems = stockItems.filter(i => i.worker_id === workerId);
    
    const confirmMsg = `Je, una uhakika unataka kumfuta "${worker?.name}" pamoja na bidhaa zake ${workerItems.length}?`;
    if (!confirm(confirmMsg)) return;
    
    setOpenMenuId(null);
    setIsLoading(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/workers/${workerId}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        setWorkers(prev => prev.filter(w => w.id !== workerId));
        setStockItems(prev => prev.filter(i => i.worker_id !== workerId));
        
        if (selectedWorkerId === workerId) setSelectedWorkerId(null);
        if (rememberedWorkerId === workerId) {
          localStorage.removeItem(WORKER_DEVICE_KEY);
          setRememberedWorkerId(null);
        }
        
        setSuccessMessage('Mfanyakazi amefutwa');
        setTimeout(() => setSuccessMessage(null), 3000);
        if (onUpdate) onUpdate();
      } else {
        setError(result.error || 'Imeshindwa kumfuta mfanyakazi');
        setTimeout(() => setError(null), 5000);
      }
    } catch (err: any) {
      // Fallback - delete locally
      setWorkers(prev => prev.filter(w => w.id !== workerId));
      setStockItems(prev => prev.filter(i => i.worker_id !== workerId));
      
      if (selectedWorkerId === workerId) setSelectedWorkerId(null);
      if (rememberedWorkerId === workerId) {
        localStorage.removeItem(WORKER_DEVICE_KEY);
        setRememberedWorkerId(null);
      }
      
      const savedData = localStorage.getItem('stock_requests_data');
      if (savedData) {
        const parsed = JSON.parse(savedData);
        parsed.workers = (parsed.workers || []).filter((w: Worker) => w.id !== workerId);
        parsed.items = (parsed.items || []).filter((i: StockItem) => i.worker_id !== workerId);
        localStorage.setItem('stock_requests_data', JSON.stringify(parsed));
      }
      
      setSuccessMessage('Mfanyakazi amefutwa');
      setTimeout(() => setSuccessMessage(null), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleWorkerExpanded = (workerId: string) => {
    setExpandedWorkers(prev => {
      const next = new Set(prev);
      if (next.has(workerId)) next.delete(workerId);
      else next.add(workerId);
      return next;
    });
  };

  const expandAllWorkers = () => setExpandedWorkers(new Set(Object.keys(itemsByWorker)));
  const collapseAllWorkers = () => setExpandedWorkers(new Set());

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
        setWorkers(prev => [...prev, result.worker]);
        setIsAddWorkerModalOpen(false);
        setWorkerName('');
        setWorkerPhone('');
        handleSelectWorker(result.worker.id);
        setSuccessMessage('Jina lako limesajiliwa!');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(result.error || 'Imeshindwa kusajili jina');
      }
    } catch (err: any) {
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

  // ============================================
  // TOGGLE STATUS
  // ============================================
  const handleToggleStatus = async (itemId: string, currentStatus: 'Pending' | 'Purchased') => {
    const newStatus = currentStatus === 'Pending' ? 'Purchased' : 'Pending';
    const previousStatus = currentStatus;
    
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
        setSuccessMessage(newStatus === 'Purchased' ? '✅ Imewekwa kama Zimenunuliwa!' : 'Imerejeshwa kwenye Bado');
        setTimeout(() => setSuccessMessage(null), 1500);
        if (onUpdate) onUpdate();
      } else {
        throw new Error(result.error || 'Failed');
      }
    } catch (err: any) {
      console.error('Failed to toggle status:', err);
      setStockItems(prev => prev.map(item => 
        item.id === itemId 
          ? { 
              ...item, 
              status: previousStatus,
              purchased_at: previousStatus === 'Purchased' ? item.purchased_at : undefined
            } 
          : item
      ));
      setError('Imeshindwa kuhifadhi. Jaribu tena.');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleBulkTick = async (itemIds: string[], targetStatus: 'Purchased' | 'Pending') => {
    if (itemIds.length === 0) return;
    
    const confirmMsg = targetStatus === 'Purchased'
      ? `Weka bidhaa ${itemIds.length} kama Zimenunuliwa?`
      : `Rejesha bidhaa ${itemIds.length} kwenye Bado?`;
    
    if (!confirm(confirmMsg)) return;
    
    const previousItems = [...stockItems];
    setStockItems(prev => prev.map(item => 
      itemIds.includes(item.id)
        ? { 
            ...item, 
            status: targetStatus,
            purchased_at: targetStatus === 'Purchased' ? new Date().toISOString() : undefined
          } 
        : item
    ));
    
    try {
      const promises = itemIds.map(itemId =>
        fetch(`${API_BASE_URL}/${itemId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: targetStatus })
        })
      );
      
      const results = await Promise.all(promises);
      const allSuccess = results.every(r => r.ok);
      
      if (allSuccess) {
        setSuccessMessage(
          targetStatus === 'Purchased' 
            ? `✅ Bidhaa ${itemIds.length} zimewekwa kama Zimenunuliwa!`
            : `Bidhaa ${itemIds.length} zimerejeshwa`
        );
        setTimeout(() => setSuccessMessage(null), 3000);
        if (onUpdate) onUpdate();
      } else {
        throw new Error('Some updates failed');
      }
    } catch (err: any) {
      console.error('Bulk tick failed:', err);
      setStockItems(previousItems);
      setError('Imeshindwa kuhifadhi baadhi ya bidhaa. Jaribu tena.');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Je, una uhakika unataka kufuta bidhaa hii?')) return;
    
    const previousItems = [...stockItems];
    setStockItems(prev => prev.filter(item => item.id !== itemId));
    
    try {
      await fetch(`${API_BASE_URL}/${itemId}`, { method: 'DELETE' });
      setSuccessMessage('Bidhaa imefutwa');
      setTimeout(() => setSuccessMessage(null), 2000);
      if (onUpdate) onUpdate();
    } catch (err: any) {
      console.error('Failed to delete item:', err);
      setStockItems(previousItems);
    }
  };

  // ============================================
  // PDF GENERATION
  // ============================================
  const generatePDF = (
    workerId: string | null, 
    filterType: 'All' | 'Today' | 'Week' | 'Month'
  ) => {
    // Get items to include
    let itemsToReport: StockItem[] = [];
    let workerName = 'All Workers';
    
    if (workerId) {
      const worker = workers.find(w => w.id === workerId);
      workerName = worker?.name || 'Worker';
      itemsToReport = stockItems.filter(i => i.worker_id === workerId);
    } else {
      itemsToReport = [...stockItems];
    }
    
    // Apply date filter
    const range = getDateRange(filterType);
    if (range) {
      itemsToReport = itemsToReport.filter(item => {
        const dateToCheck = item.status === 'Purchased' && item.purchased_at 
          ? new Date(item.purchased_at) 
          : new Date(item.created_at);
        return dateToCheck >= range.start && dateToCheck < range.end;
      });
    }
    
    // Separate purchased vs pending
    const purchased = itemsToReport
      .filter(i => i.status === 'Purchased')
      .sort((a, b) => new Date(b.purchased_at || b.created_at).getTime() - new Date(a.purchased_at || a.created_at).getTime());
    
    const pending = itemsToReport
      .filter(i => i.status === 'Pending')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    // Date labels
    const filterLabels: Record<string, string> = {
      'All': 'Zote (All Time)',
      'Today': 'Leo (Today)',
      'Week': 'Wiki Hii (This Week)',
      'Month': 'Mwezi Huu (This Month)'
    };
    
    // Date range text
    const getDateRangeText = () => {
      if (filterType === 'All') return 'Muda wote';
      if (filterType === 'Today') {
        return new Date().toLocaleDateString('sw-TZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      }
      if (filterType === 'Week') {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return `${weekAgo.toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short' })} - ${now.toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      }
      if (filterType === 'Month') {
        const now = new Date();
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return `${monthAgo.toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short' })} - ${now.toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      }
      return '';
    };

    const now = new Date();
    const reportId = `STK-${Date.now().toString(36).toUpperCase()}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Ripoti ya Bidhaa - ${filterLabels[filterType]}</title>
          <meta charset="UTF-8">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            @page { size: A4; margin: 12mm; }
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              background: white; 
              color: #1e293b;
              padding: 20px;
            }
            .container {
              max-width: 190mm;
              margin: 0 auto;
              background: white;
            }
            .header {
              background: linear-gradient(135deg, #1e3a5f 0%, #3b82f6 50%, #22c55e 100%);
              color: white;
              padding: 24px 28px;
              border-radius: 12px;
              margin-bottom: 20px;
            }
            .header-top {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 12px;
            }
            .business-name {
              font-size: 22px;
              font-weight: 900;
              letter-spacing: 1px;
            }
            .business-slogan {
              font-size: 11px;
              opacity: 0.9;
              margin-top: 3px;
            }
            .report-badge {
              background: rgba(255,255,255,0.2);
              padding: 5px 14px;
              border-radius: 20px;
              font-size: 10px;
              font-weight: bold;
              letter-spacing: 1px;
            }
            .report-title {
              font-size: 15px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .report-meta {
              font-size: 11px;
              opacity: 0.9;
              display: flex;
              gap: 20px;
              flex-wrap: wrap;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 12px;
              margin-bottom: 24px;
            }
            .summary-card {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 10px;
              padding: 14px;
              text-align: center;
            }
            .summary-card.purchased {
              background: #f0fdf4;
              border-color: #bbf7d0;
            }
            .summary-card.pending {
              background: #fef3c7;
              border-color: #fde68a;
            }
            .summary-label {
              font-size: 9px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #64748b;
              margin-bottom: 6px;
            }
            .summary-value {
              font-size: 26px;
              font-weight: 900;
              color: #1e293b;
            }
            .summary-card.purchased .summary-value { color: #059669; }
            .summary-card.pending .summary-value { color: #d97706; }
            .section {
              margin-bottom: 24px;
              page-break-inside: avoid;
            }
            .section-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 10px 16px;
              background: #1e3a5f;
              color: white;
              border-radius: 8px 8px 0 0;
              font-size: 13px;
              font-weight: bold;
            }
            .section-header.purchased {
              background: #059669;
            }
            .section-header.pending {
              background: #d97706;
            }
            .section-count {
              background: rgba(255,255,255,0.25);
              padding: 3px 10px;
              border-radius: 12px;
              font-size: 11px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              background: white;
              border: 1px solid #e2e8f0;
              border-top: none;
            }
            thead th {
              background: #f1f5f9;
              color: #475569;
              padding: 10px 12px;
              text-align: left;
              font-size: 10px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              font-weight: 800;
              border-bottom: 1px solid #e2e8f0;
            }
            thead th:first-child { text-align: center; width: 40px; }
            thead th:last-child { text-align: center; width: 90px; }
            tbody td {
              padding: 11px 12px;
              border-bottom: 1px solid #f1f5f9;
              font-size: 12px;
              color: #334155;
            }
            tbody td:first-child { 
              text-align: center; 
              font-weight: bold; 
              color: #94a3b8;
              font-size: 11px;
            }
            tbody td:last-child { 
              text-align: center; 
              font-weight: bold; 
              color: #059669;
              font-size: 11px;
            }
            tbody tr:nth-child(even) {
              background: #f8fafc;
            }
            tbody tr:last-child td {
              border-bottom: none;
            }
            .product-name {
              font-weight: 600;
              color: #1e293b;
            }
            .product-notes {
              font-size: 10px;
              color: #94a3b8;
              font-style: italic;
              margin-top: 2px;
            }
            .badge {
              display: inline-block;
              padding: 3px 10px;
              border-radius: 10px;
              font-size: 9px;
              font-weight: 800;
              letter-spacing: 0.3px;
              text-transform: uppercase;
            }
            .badge-purchased {
              background: #d1fae5;
              color: #059669;
            }
            .badge-pending {
              background: #fef3c7;
              color: #d97706;
            }
            .empty-state {
              padding: 30px;
              text-align: center;
              color: #94a3b8;
              font-size: 12px;
              font-style: italic;
              background: white;
              border: 1px solid #e2e8f0;
              border-top: none;
              border-radius: 0 0 8px 8px;
            }
            .footer {
              margin-top: 30px;
              padding: 16px;
              background: #f8fafc;
              border-radius: 10px;
              text-align: center;
              font-size: 10px;
              color: #64748b;
              border: 1px solid #e2e8f0;
            }
            .footer-line {
              margin-bottom: 6px;
            }
            .page-break {
              page-break-before: always;
            }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            
            <!-- Header -->
            <div class="header">
              <div class="header-top">
                <div>
                  <div class="business-name">SONKO SOUND</div>
                  <div class="business-slogan">Electronics & Appliances • Morogoro, Tanzania</div>
                </div>
                <div class="report-badge">RIPOTI YA BIDHAA</div>
              </div>
              <div class="report-title">Bidhaa Zisizokuepo - ${filterLabels[filterType]}</div>
              <div class="report-meta">
                <span><strong>Kipindi:</strong> ${getDateRangeText()}</span>
                <span><strong>Tarehe:</strong> ${now.toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                <span><strong>Ripoti ID:</strong> ${reportId}</span>
              </div>
            </div>

            <!-- Summary -->
            <div class="summary-grid">
              <div class="summary-card">
                <div class="summary-label">Jumla ya Bidhaa</div>
                <div class="summary-value">${itemsToReport.length}</div>
              </div>
              <div class="summary-card purchased">
                <div class="summary-label">Zimenunuliwa</div>
                <div class="summary-value">${purchased.length}</div>
              </div>
              <div class="summary-card pending">
                <div class="summary-label">Bado</div>
                <div class="summary-value">${pending.length}</div>
              </div>
            </div>

            <!-- Purchased Section -->
            ${purchased.length > 0 ? `
              <div class="section">
                <div class="section-header purchased">
                  <span>✓ BIDHAA ZIMENUNULIWA</span>
                  <span class="section-count">${purchased.length}</span>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Jina la Bidhaa</th>
                      <th>Idadi</th>
                      <th>Tarehe</th>
                      <th>Hali</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${purchased.map((item, idx) => `
                      <tr>
                        <td>${idx + 1}</td>
                        <td>
                          <div class="product-name">${item.product_name}</div>
                          ${item.notes ? `<div class="product-notes">${item.notes}</div>` : ''}
                        </td>
                        <td>${item.quantity || '-'}</td>
                        <td>${item.purchased_at ? new Date(item.purchased_at).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}</td>
                        <td><span class="badge badge-purchased">✓ Imenunuliwa</span></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : ''}

            <!-- Pending Section -->
            ${pending.length > 0 ? `
              <div class="section">
                <div class="section-header pending">
                  <span>⏳ BIDHAA BADO</span>
                  <span class="section-count">${pending.length}</span>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Jina la Bidhaa</th>
                      <th>Idadi</th>
                      <th>Tarehe</th>
                      <th>Hali</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${pending.map((item, idx) => `
                      <tr>
                        <td>${idx + 1}</td>
                        <td>
                          <div class="product-name">${item.product_name}</div>
                          ${item.notes ? `<div class="product-notes">${item.notes}</div>` : ''}
                        </td>
                        <td>${item.quantity || '-'}</td>
                        <td>${new Date(item.created_at).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td><span class="badge badge-pending">⏳ Bado</span></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : ''}

            ${itemsToReport.length === 0 ? `
              <div class="section">
                <div class="section-header">
                  <span>HAKUNA BIDHAA</span>
                  <span class="section-count">0</span>
                </div>
                <div class="empty-state">
                  Hakuna bidhaa zilizopatikana kwa kipindi hiki.
                </div>
              </div>
            ` : ''}

            <!-- Footer -->
            <div class="footer">
              <div class="footer-line">
                <strong>Sonko Sound</strong> • Morogoro, Tanzania • 0688423753
              </div>
              <div class="footer-line">
                Ripoti hii ilitengenezwa ${now.toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })} saa ${now.toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div class="footer-line" style="margin-top: 8px; font-size: 9px; color: #94a3b8;">
                Ripoti hii ni ya siri na inaonyesha muhtasari wa bidhaa zisizokuepo.
              </div>
            </div>

            <!-- Print Buttons -->
            <div class="no-print" style="text-align: center; padding: 20px 0; margin-top: 20px;">
              <button onclick="window.print()" style="background: #3b82f6; color: white; border: none; padding: 12px 28px; border-radius: 22px; font-size: 13px; font-weight: bold; cursor: pointer; margin-right: 10px;">
                🖨️ Chapisha / Save as PDF
              </button>
              <button onclick="window.close()" style="background: #64748b; color: white; border: none; padding: 12px 28px; border-radius: 22px; font-size: 13px; font-weight: bold; cursor: pointer;">
                Funga
              </button>
            </div>
          </div>
          
          <script>
            window.onload = function() {
              setTimeout(function() { window.print(); }, 300);
            };
          </script>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'width=900,height=800');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    } else {
      alert('Tafadhali ruhusu pop-ups kwa ajili ya kuchapisha ripoti');
    }
    
    setIsDownloadModalOpen(false);
    setDownloadWorkerId(null);
  };

  const openDownloadModal = (workerId: string | null = null) => {
    setDownloadWorkerId(workerId);
    setIsDownloadModalOpen(true);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' });
  };

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
      
      {/* Alerts */}
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
                  {rememberedWorkerId === activeWorker.id && (
                    <button 
                      onClick={handleForgetWorker}
                      className="border border-slate-200 hover:bg-slate-50 text-slate-500 font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 transition text-[11px]"
                    >
                      <LogOut size={13} /> Ondoa Kumbukumbu
                    </button>
                  )}
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

            <div className="space-y-3">
              {activeWorkerItems.length > 0 ? activeWorkerItems.map(item => (
                <div key={item.id} className={`bg-white rounded-2xl border p-4 shadow-sm transition ${
                  item.status === 'Purchased' ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-100'
                }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                        item.status === 'Purchased' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                      }`}>
                        {item.status === 'Purchased' ? <ShoppingBag size={16} /> : <Clock size={16} />}
                      </div>
                      <div className="flex-1">
                        <h4 className={`text-sm font-bold ${item.status === 'Purchased' ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                          {item.product_name}
                        </h4>
                        {item.quantity && <p className="text-xs text-slate-500 mt-1">Idadi: {item.quantity}</p>}
                        {item.notes && <p className="text-xs text-slate-400 mt-1 italic">{item.notes}</p>}
                        <p className="text-[10px] text-slate-400 mt-2">
                          {formatDate(item.created_at)} • {formatTime(item.created_at)}
                        </p>
                        {item.status === 'Purchased' && item.purchased_at && (
                          <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1 font-semibold">
                            <ShoppingBag size={10} /> Ilinunuliwa: {formatDate(item.purchased_at)}
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
          /* Worker Selection */
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
                    className={`bg-white rounded-3xl border p-5 shadow-sm hover:shadow-md transition relative ${
                      isRemembered ? 'border-emerald-300 ring-2 ring-emerald-500/20 bg-emerald-50/30' : 'border-slate-100 hover:border-accent/50'
                    }`}
                  >
                    {/* Three-dot menu */}
                    <div className="absolute top-3 right-3" ref={openMenuId === worker.id ? menuRef : null}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === worker.id ? null : worker.id);
                        }}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
                        title="Chaguo"
                      >
                        <MoreVertical size={16} />
                      </button>
                      
                      {openMenuId === worker.id && (
                        <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-100 py-1 min-w-[200px] z-20">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(null);
                              openDownloadModal(worker.id);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                          >
                            <FileDown size={14} className="text-blue-500" />
                            Pakua Ripoti ya {worker.name}
                          </button>
                          <div className="border-t border-slate-100 my-1"></div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteWorker(worker.id);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
                          >
                            <Trash2 size={14} />
                            Futa {worker.name}
                          </button>
                        </div>
                      )}
                    </div>

                    <div 
                      onClick={() => handleSelectWorker(worker.id)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-start justify-between pr-8">
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
            ADMIN MODE
            ============================================ */
        <div className="space-y-4">
          
          {/* Admin Header */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center shadow-md">
                  <Package size={20} className="text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-extrabold text-slate-800">Paneli ya Bidhaa</h1>
                  <p className="text-xs text-slate-500">Fuatilia na thibitisha bidhaa zisizokuepo</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openDownloadModal(null)}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-2 shadow-sm"
                >
                  <Download size={14} />
                  Pakua Ripoti Yote
                </button>
                <button
                  onClick={loadData}
                  disabled={isLoading}
                  className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition disabled:opacity-50"
                  title="Sasisha"
                >
                  <RefreshCw size={14} className={isLoading ? 'animate-spin text-accent' : 'text-slate-600'} />
                </button>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl border border-slate-100 p-4">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                <ListChecks size={12} /> Jumla
              </div>
              <p className="text-2xl font-black text-slate-800">{adminStats.total}</p>
            </div>
            
            <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4">
              <div className="flex items-center gap-2 text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">
                <Clock size={12} /> Bado
              </div>
              <p className="text-2xl font-black text-amber-700">{adminStats.pending}</p>
            </div>
            
            <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4">
              <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">
                <ShoppingBag size={12} /> Zimenunuliwa
              </div>
              <p className="text-2xl font-black text-emerald-700">{adminStats.purchased}</p>
            </div>
            
            <div className="bg-blue-50 rounded-2xl border border-blue-200 p-4">
              <div className="flex items-center gap-2 text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">
                <TrendingUp size={12} /> Ufanisi
              </div>
              <p className="text-2xl font-black text-blue-700">{adminStats.purchaseRate}%</p>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
            <div className="flex flex-col lg:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tafuta bidhaa au maelezo..."
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
                        ? tab === 'Pending' ? 'bg-amber-500 text-white shadow-sm'
                          : tab === 'Purchased' ? 'bg-emerald-500 text-white shadow-sm'
                          : 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-500 hover:bg-white/50'
                    }`}
                  >
                    {tab === 'Pending' ? <><Clock size={12} /> Bado ({adminStats.pending})</>
                     : tab === 'Purchased' ? <><ShoppingBag size={12} /> Zimenunuliwa ({adminStats.purchased})</>
                     : <><ListChecks size={12} /> Zote ({adminStats.total})</>}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-3 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <CalendarDays size={11} /> Kipindi:
                </span>
                {(['All', 'Today', 'Yesterday', 'Week', 'Month'] as const).map(range => (
                  <button
                    key={range}
                    onClick={() => setDateFilter(range)}
                    className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition ${
                      dateFilter === range 
                        ? 'bg-slate-900 text-white shadow-sm' 
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {range === 'All' ? 'Zote' 
                     : range === 'Today' ? 'Leo' 
                     : range === 'Yesterday' ? 'Jana' 
                     : range === 'Week' ? 'Wiki Hii' 
                     : 'Mwezi Huu'}
                  </button>
                ))}
                <button
                  onClick={() => setDateFilter('Custom')}
                  className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition flex items-center gap-1 ${
                    dateFilter === 'Custom' 
                      ? 'bg-slate-900 text-white shadow-sm' 
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Filter size={11} /> Siku Maalum
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                <Users size={14} className="text-slate-400" />
                <select
                  value={workerFilter}
                  onChange={(e) => setWorkerFilter(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-accent/20"
                >
                  <option value="All">Wafanyakazi Wote ({workers.length})</option>
                  {workers.map(w => {
                    const count = stockItems.filter(i => i.worker_id === w.id).length;
                    return <option key={w.id} value={w.id}>{w.name} ({count})</option>;
                  })}
                </select>
              </div>
            </div>

            {dateFilter === 'Custom' && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kuanzia:</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hadi:</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-accent/20"
                  />
                </div>
                <button
                  onClick={() => {
                    setCustomStartDate('');
                    setCustomEndDate('');
                    setDateFilter('All');
                  }}
                  className="px-3 py-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-800 transition"
                >
                  Safisha
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                {workerFilter === 'All' && Object.keys(itemsByWorker).length > 0 && (
                  <>
                    <button
                      onClick={expandAllWorkers}
                      className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 transition"
                    >
                      Fungua Zote
                    </button>
                    <button
                      onClick={collapseAllWorkers}
                      className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 transition"
                    >
                      Funga Zote
                    </button>
                  </>
                )}
              </div>

              {(() => {
                const allPendingIds = Object.values(itemsByWorker)
                  .flatMap(({ items }) => items.filter(i => i.status === 'Pending').map(i => i.id));
                
                if (allPendingIds.length === 0) return null;
                
                return (
                  <button
                    onClick={() => handleBulkTick(allPendingIds, 'Purchased')}
                    className="px-4 py-2 text-[11px] font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition flex items-center gap-1.5"
                  >
                    <CheckSquare size={13} />
                    Weka Zote Kama Zimenunuliwa ({allPendingIds.length})
                  </button>
                );
              })()}
            </div>
          </div>

          {/* Items */}
          {Object.keys(itemsByWorker).length > 0 ? (
            <div className="space-y-3">
              {Object.values(itemsByWorker).map(({ worker, items, pending, purchased }) => {
                const isExpanded = expandedWorkers.has(worker.id) || workerFilter !== 'All' || searchTerm.length > 0 || dateFilter !== 'All';
                const hasItems = items.length > 0;
                const workerPendingIds = items.filter(i => i.status === 'Pending').map(i => i.id);
                
                return (
                  <div key={worker.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between p-3 hover:bg-slate-50/70 transition">
                      <button
                        onClick={() => toggleWorkerExpanded(worker.id)}
                        className="flex items-center gap-3 flex-1 text-left"
                      >
                        <div className={`h-9 w-9 rounded-lg font-bold text-xs flex items-center justify-center ${
                          pending > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {getInitials(worker.name)}
                        </div>
                        <div className="flex-1">
                          <h3 className="text-sm font-bold text-slate-800">{worker.name}</h3>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[10px] font-semibold text-amber-600 flex items-center gap-1">
                              <Clock size={10} /> {pending} Bado
                            </span>
                            <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-1">
                              <ShoppingBag size={10} /> {purchased} Zimenunuliwa
                            </span>
                          </div>
                        </div>
                        <ChevronRight 
                          size={16} 
                          className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                        />
                      </button>
                      
                      {/* Three-dot menu for admin */}
                      <div className="relative ml-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === `admin-${worker.id}` ? null : `admin-${worker.id}`);
                          }}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
                          title="Chaguo"
                        >
                          <MoreVertical size={16} />
                        </button>
                        
                        {openMenuId === `admin-${worker.id}` && (
                          <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-100 py-1 min-w-[200px] z-20">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(null);
                                openDownloadModal(worker.id);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                            >
                              <FileDown size={14} className="text-blue-500" />
                              Pakua Ripoti ya {worker.name}
                            </button>
                            <div className="border-t border-slate-100 my-1"></div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteWorker(worker.id);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
                            >
                              <Trash2 size={14} />
                              Futa {worker.name}
                            </button>
                          </div>
                        )}
                      </div>
                      
                      {workerPendingIds.length > 0 && isExpanded && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBulkTick(workerPendingIds, 'Purchased');
                          }}
                          className="ml-2 px-3 py-1.5 text-[10px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <CheckSquare size={11} />
                          Weka Zote ({workerPendingIds.length})
                        </button>
                      )}
                    </div>
                    
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/40">
                        {hasItems ? (
                          <div className="divide-y divide-slate-100">
                            {items.map(item => (
                              <div 
                                key={item.id} 
                                className={`flex items-center gap-3 p-3 transition ${
                                  item.status === 'Purchased' 
                                    ? 'bg-emerald-50/40 hover:bg-emerald-50/60' 
                                    : 'bg-white hover:bg-slate-50/70'
                                }`}
                              >
                                <button
                                  onClick={() => handleToggleStatus(item.id, item.status)}
                                  className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-all shadow-sm ${
                                    item.status === 'Purchased'
                                      ? 'bg-emerald-500 text-white shadow-emerald-500/30 hover:bg-emerald-600'
                                      : 'border-2 border-slate-300 text-slate-300 hover:border-emerald-500 hover:text-emerald-500 hover:bg-emerald-50 bg-white'
                                  }`}
                                  title={item.status === 'Purchased' ? 'Rejesha' : 'Weka kama amenunua'}
                                >
                                  {item.status === 'Purchased' ? (
                                    <CheckSquare size={20} strokeWidth={3} />
                                  ) : (
                                    <Square size={20} strokeWidth={2} />
                                  )}
                                </button>
                                
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <h4 className={`text-sm font-bold ${
                                        item.status === 'Purchased' ? 'text-slate-500 line-through' : 'text-slate-800'
                                      }`}>
                                        {item.product_name}
                                      </h4>
                                      
                                      <div className="flex flex-wrap items-center gap-2 mt-1">
                                        {item.quantity && (
                                          <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                            Idadi: {item.quantity}
                                          </span>
                                        )}
                                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                          <Clock size={9} /> {formatDate(item.created_at)} • {formatTime(item.created_at)}
                                        </span>
                                        {item.status === 'Purchased' && item.purchased_at && (
                                          <span className="text-[10px] text-emerald-600 flex items-center gap-1 font-semibold">
                                            <ShoppingBag size={9} /> Ilinunuliwa: {formatDate(item.purchased_at)}
                                          </span>
                                        )}
                                      </div>
                                      
                                      {item.notes && (
                                        <p className="text-[11px] text-slate-500 mt-1 italic">
                                          {item.notes}
                                        </p>
                                      )}
                                    </div>
                                    
                                    <button 
                                      onClick={() => handleDeleteItem(item.id)}
                                      className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition shrink-0"
                                      title="Futa"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-slate-400">
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
            <div className="bg-white p-16 text-center rounded-2xl border border-slate-100 shadow-sm">
              <div className="h-20 w-20 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4">
                <Package size={36} className="text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-600">Hakuna bidhaa zilizopatikana</p>
              <p className="text-xs text-slate-400 mt-1">
                {searchTerm || adminFilter !== 'All' || workerFilter !== 'All' || dateFilter !== 'All'
                  ? 'Jaribu kubadilisha vichujio au tafuta kwa maneno mengine'
                  : 'Wafanyakazi hawajaongeza bidhaa zisizokuepo bado'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ============================================
          DOWNLOAD MODAL
          ============================================ */}
      {isDownloadModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
            <button 
              onClick={() => { setIsDownloadModalOpen(false); setDownloadWorkerId(null); }} 
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition"
            >
              <X size={18} />
            </button>
            
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
                <FileText size={22} />
              </div>
              <div>
                <h3 className="text-md font-bold text-slate-800">Pakua Ripoti ya Bidhaa</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {downloadWorkerId 
                    ? `Ripoti ya ${workers.find(w => w.id === downloadWorkerId)?.name || 'Mfanyakazi'}`
                    : 'Ripoti ya Wote'}
                </p>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <p className="text-xs text-blue-800 leading-relaxed">
                <strong>Kumbuka:</strong> Ripoti hii itaonyesha bidhaa tu (majina ya wafanyakazi hayataonekana).
                Itakuwa na sehemu mbili: Zimenunuliwa na Bado.
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Chagua Kipindi:</p>
              
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => generatePDF(downloadWorkerId, 'Today')}
                  className="p-4 rounded-2xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar size={16} className="text-blue-600" />
                    <span className="text-sm font-bold text-slate-800">Leo</span>
                  </div>
                  <p className="text-[10px] text-slate-500 text-left">Bidhaa za leo tu</p>
                </button>
                
                <button
                  onClick={() => generatePDF(downloadWorkerId, 'Week')}
                  className="p-4 rounded-2xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <CalendarDays size={16} className="text-emerald-600" />
                    <span className="text-sm font-bold text-slate-800">Wiki Hii</span>
                  </div>
                  <p className="text-[10px] text-slate-500 text-left">Siku 7 zilizopita</p>
                </button>
                
                <button
                  onClick={() => generatePDF(downloadWorkerId, 'Month')}
                  className="p-4 rounded-2xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp size={16} className="text-purple-600" />
                    <span className="text-sm font-bold text-slate-800">Mwezi Huu</span>
                  </div>
                  <p className="text-[10px] text-slate-500 text-left">Siku 30 zilizopita</p>
                </button>
                
                <button
                  onClick={() => generatePDF(downloadWorkerId, 'All')}
                  className="p-4 rounded-2xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <ListChecks size={16} className="text-slate-700" />
                    <span className="text-sm font-bold text-slate-800">Zote</span>
                  </div>
                  <p className="text-[10px] text-slate-500 text-left">Muda wote</p>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD WORKER MODAL */}
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
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Jina Lako *</label>
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
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Namba ya Simu (Hiari)</label>
                <input 
                  type="tel" 
                  value={workerPhone} 
                  onChange={(e) => setWorkerPhone(e.target.value)} 
                  placeholder="0712345678"
                  className="w-full p-3 border border-slate-200 rounded-xl" 
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsAddWorkerModalOpen(false)} disabled={isLoading}
                  className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600 transition disabled:opacity-50">
                  Ghairi
                </button>
                <button type="submit" disabled={isLoading || !workerName.trim()}
                  className="px-5 py-2.5 bg-accent hover:bg-accent/90 text-white rounded-xl font-semibold shadow-sm transition disabled:opacity-50 flex items-center gap-2">
                  {isLoading ? <><Loader2 size={14} className="animate-spin" /> Inasajili...</> : <>Endelea</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD PRODUCT MODAL */}
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
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Jina la Bidhaa *</label>
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
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Idadi Inayohitajika (Hiari)</label>
                <input 
                  type="text" 
                  value={productQuantity} 
                  onChange={(e) => setProductQuantity(e.target.value)} 
                  placeholder="Mfano: 5 pieces"
                  className="w-full p-2.5 border border-slate-200 rounded-xl" 
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Maelezo ya Ziada (Hiari)</label>
                <textarea 
                  value={productNotes} 
                  onChange={(e) => setProductNotes(e.target.value)} 
                  placeholder="Maelezo yoyote..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl h-20" 
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsAddProductModalOpen(false)} disabled={isLoading}
                  className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600 transition disabled:opacity-50">
                  Ghairi
                </button>
                <button type="submit" disabled={isLoading || !productName.trim()}
                  className="px-5 py-2 bg-accent hover:bg-accent/90 text-white rounded-xl font-semibold shadow-sm transition disabled:opacity-50 flex items-center gap-2">
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
