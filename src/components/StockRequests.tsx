/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { 
  Plus, X, Trash2, Check, Loader2, AlertCircle,
  Package, Search, CheckCircle2, Clock,
  ListChecks, Phone, UserPlus, ChevronRight, LogOut,
  TrendingUp, Calendar, Users, ShoppingBag, RefreshCw,
  CheckSquare, Square, CalendarDays, Filter, MoreVertical,
  Download, FileText, FileDown, Edit2, Camera, Image as ImageIcon,
  UserCog, Save, ChevronLeft
} from 'lucide-react';
import { compressProfilePicture, compressProductImage } from '../utils/imageCompression';

// Interfaces
interface Worker {
  id: string;
  name: string;
  phone?: string;
  photo?: string;
  created_at: string;
}

interface StockItem {
  id: string;
  worker_id: string;
  worker_name: string;
  product_name: string;
  quantity?: string;
  notes: string;
  image1?: string;
  image2?: string;
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
  const [isEditWorkerModalOpen, setIsEditWorkerModalOpen] = useState(false);
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  
  // ============================================
  // IMAGE GALLERY STATE (NEW)
  // ============================================
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [galleryTitle, setGalleryTitle] = useState('');
  
  const [downloadWorkerId, setDownloadWorkerId] = useState<string | null>(null);
  
  // Three-dot menu
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Worker form (add)
  const [workerName, setWorkerName] = useState('');
  const [workerPhone, setWorkerPhone] = useState('');
  const [workerPhoto, setWorkerPhoto] = useState<string>('');
  
  // Worker form (edit)
  const [editWorkerName, setEditWorkerName] = useState('');
  const [editWorkerPhone, setEditWorkerPhone] = useState('');
  const [editWorkerPhoto, setEditWorkerPhoto] = useState<string>('');
  
  // Product form
  const [productName, setProductName] = useState('');
  const [productQuantity, setProductQuantity] = useState('');
  const [productNotes, setProductNotes] = useState('');
  const [productImage1, setProductImage1] = useState<string>('');
  const [productImage2, setProductImage2] = useState<string>('');
  const [isCompressing, setIsCompressing] = useState(false);
  
  const file1Ref = useRef<HTMLInputElement>(null);
  const file2Ref = useRef<HTMLInputElement>(null);
  const profileFileRef = useRef<HTMLInputElement>(null);
  const editProfileFileRef = useRef<HTMLInputElement>(null);
  
  // Admin filters
  const [searchTerm, setSearchTerm] = useState('');
  const [adminFilter, setAdminFilter] = useState<'All' | 'Pending' | 'Purchased'>('Pending');
  const [workerFilter, setWorkerFilter] = useState<string>('All');
  const [expandedWorkers, setExpandedWorkers] = useState<Set<string>>(new Set());
  const [dateFilter, setDateFilter] = useState<'All' | 'Today' | 'Yesterday' | 'Week' | 'Month' | 'Custom'>('All');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // ============================================
  // OUTSIDE CLICK FOR MENU
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
  // KEYBOARD NAVIGATION FOR GALLERY
  // ============================================
  useEffect(() => {
    if (!isGalleryOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsGalleryOpen(false);
      if (e.key === 'ArrowLeft') setGalleryIndex(i => i > 0 ? i - 1 : galleryImages.length - 1);
      if (e.key === 'ArrowRight') setGalleryIndex(i => i < galleryImages.length - 1 ? i + 1 : 0);
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGalleryOpen, galleryImages.length]);

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
          setWorkers(parsed.workers || []);
          setStockItems(parsed.items || []);
        } catch (e) {}
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ============================================
  // BROWSER MEMORY (NO BACK ARROW - LOCKED)
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

  // If worker selects a name (first time), remember it
  useEffect(() => {
    if (isWorkerMode && selectedWorkerId && !rememberedWorkerId) {
      localStorage.setItem(WORKER_DEVICE_KEY, selectedWorkerId);
      setRememberedWorkerId(selectedWorkerId);
    }
  }, [isWorkerMode, selectedWorkerId, rememberedWorkerId]);

  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setIsInitializing(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  // ============================================
  // IMAGE HANDLERS
  // ============================================
  const handleProfileImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Chagua picha tu');
      setTimeout(() => setError(null), 3000);
      return;
    }
    setIsCompressing(true);
    try {
      const compressed = await compressProfilePicture(file);
      setWorkerPhoto(compressed);
    } catch (err) {
      setError('Imeshindwa kusindika picha');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleEditProfileImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Chagua picha tu');
      setTimeout(() => setError(null), 3000);
      return;
    }
    setIsCompressing(true);
    try {
      const compressed = await compressProfilePicture(file);
      setEditWorkerPhoto(compressed);
    } catch (err) {
      setError('Imeshindwa kusindika picha');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleProductImageChange = async (e: React.ChangeEvent<HTMLInputElement>, slot: 1 | 2) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Chagua picha tu');
      setTimeout(() => setError(null), 3000);
      return;
    }
    setIsCompressing(true);
    try {
      const compressed = await compressProductImage(file);
      if (slot === 1) setProductImage1(compressed);
      else setProductImage2(compressed);
    } catch (err) {
      setError('Imeshindwa kusindika picha');
    } finally {
      setIsCompressing(false);
    }
  };

  // ============================================
  // GALLERY OPENER (NEW)
  // ============================================
  const openGallery = (item: StockItem, startIndex: number = 0) => {
    const images: string[] = [];
    if (item.image1) images.push(item.image1);
    if (item.image2) images.push(item.image2);
    
    if (images.length === 0) return;
    
    setGalleryImages(images);
    setGalleryIndex(Math.min(startIndex, images.length - 1));
    setGalleryTitle(item.product_name);
    setIsGalleryOpen(true);
  };

  const nextImage = () => setGalleryIndex(i => i < galleryImages.length - 1 ? i + 1 : 0);
  const prevImage = () => setGalleryIndex(i => i > 0 ? i - 1 : galleryImages.length - 1);

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
    return {
      total: items.length,
      pending: items.filter(i => i.status === 'Pending').length,
      purchased: items.filter(i => i.status === 'Purchased').length
    };
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
      
      if (adminFilter !== 'All') filteredItems = filteredItems.filter(i => i.status === adminFilter);
      
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
          items: filteredItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
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

  // NO handleSwitchWorker — removed back arrow function

  const openEditWorkerModal = () => {
    if (!activeWorker) return;
    setEditWorkerName(activeWorker.name);
    setEditWorkerPhone(activeWorker.phone || '');
    setEditWorkerPhoto(activeWorker.photo || '');
    setIsEditWorkerModalOpen(true);
  };

  const handleUpdateWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorker || !editWorkerName.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/workers/${activeWorker.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editWorkerName.trim(),
          phone: editWorkerPhone.trim(),
          photo: editWorkerPhoto
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setWorkers(prev => prev.map(w => 
          w.id === activeWorker.id 
            ? { ...w, name: result.worker.name, phone: result.worker.phone, photo: result.worker.photo }
            : w
        ));
        setStockItems(prev => prev.map(i => 
          i.worker_id === activeWorker.id ? { ...i, worker_name: result.worker.name } : i
        ));
        
        setIsEditWorkerModalOpen(false);
        setSuccessMessage('Wasifu umehifadhiwa!');
        setTimeout(() => setSuccessMessage(null), 3000);
        if (onUpdate) onUpdate();
      } else {
        setError(result.error || 'Imeshindwa kuhifadhi wasifu');
        setTimeout(() => setError(null), 5000);
      }
    } catch (err: any) {
      setWorkers(prev => prev.map(w => 
        w.id === activeWorker.id 
          ? { ...w, name: editWorkerName.trim(), phone: editWorkerPhone.trim(), photo: editWorkerPhoto }
          : w
      ));
      setStockItems(prev => prev.map(i => 
        i.worker_id === activeWorker.id ? { ...i, worker_name: editWorkerName.trim() } : i
      ));
      setIsEditWorkerModalOpen(false);
      setSuccessMessage('Wasifu umehifadhiwa!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteWorker = async (workerId: string) => {
    const worker = workers.find(w => w.id === workerId);
    const workerItems = stockItems.filter(i => i.worker_id === workerId);
    
    if (!confirm(`Je, una uhakika unataka kumfuta "${worker?.name}" pamoja na bidhaa zake ${workerItems.length}?`)) return;
    
    setOpenMenuId(null);
    setIsLoading(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/workers/${workerId}`, { method: 'DELETE' });
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
      setWorkers(prev => prev.filter(w => w.id !== workerId));
      setStockItems(prev => prev.filter(i => i.worker_id !== workerId));
      if (selectedWorkerId === workerId) setSelectedWorkerId(null);
      if (rememberedWorkerId === workerId) {
        localStorage.removeItem(WORKER_DEVICE_KEY);
        setRememberedWorkerId(null);
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
    
    const existing = workers.find(w => w.name.toLowerCase() === workerName.trim().toLowerCase());
    if (existing) {
      setError('Jina hili tayari lipo.');
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
          phone: workerPhone.trim(),
          photo: workerPhoto
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setWorkers(prev => [...prev, result.worker]);
        setIsAddWorkerModalOpen(false);
        resetWorkerForm();
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
        photo: workerPhoto,
        created_at: new Date().toISOString()
      };
      setWorkers(prev => [...prev, newWorker]);
      setIsAddWorkerModalOpen(false);
      resetWorkerForm();
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
          notes: productNotes.trim(),
          image1: productImage1,
          image2: productImage2
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setStockItems(prev => [result.item, ...prev]);
        setIsAddProductModalOpen(false);
        resetProductForm();
        setSuccessMessage('Bidhaa imeongezwa!');
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
        image1: productImage1,
        image2: productImage2,
        status: 'Pending',
        created_at: new Date().toISOString()
      };
      setStockItems(prev => [newItem, ...prev]);
      setIsAddProductModalOpen(false);
      resetProductForm();
      
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

  const resetWorkerForm = () => {
    setWorkerName('');
    setWorkerPhone('');
    setWorkerPhoto('');
  };

  const resetProductForm = () => {
    setProductName('');
    setProductQuantity('');
    setProductNotes('');
    setProductImage1('');
    setProductImage2('');
    if (file1Ref.current) file1Ref.current.value = '';
    if (file2Ref.current) file2Ref.current.value = '';
  };

  const handleToggleStatus = async (itemId: string, currentStatus: 'Pending' | 'Purchased') => {
    const newStatus = currentStatus === 'Pending' ? 'Purchased' : 'Pending';
    const previousStatus = currentStatus;
    
    setStockItems(prev => prev.map(item => 
      item.id === itemId 
        ? { ...item, status: newStatus, purchased_at: newStatus === 'Purchased' ? new Date().toISOString() : undefined }
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
        if (onUpdate) onUpdate();
      } else throw new Error(result.error);
    } catch (err) {
      setStockItems(prev => prev.map(item => 
        item.id === itemId ? { ...item, status: previousStatus } : item
      ));
      setError('Imeshindwa kuhifadhi');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleBulkTick = async (itemIds: string[], targetStatus: 'Purchased' | 'Pending') => {
    if (itemIds.length === 0) return;
    if (!confirm(targetStatus === 'Purchased' ? `Weka bidhaa ${itemIds.length} kama Zimenunuliwa?` : `Rejesha bidhaa ${itemIds.length}?`)) return;
    
    const previousItems = [...stockItems];
    setStockItems(prev => prev.map(item => 
      itemIds.includes(item.id) ? { ...item, status: targetStatus } : item
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
      if (results.every(r => r.ok)) {
        setSuccessMessage(targetStatus === 'Purchased' ? `✅ Bidhaa ${itemIds.length} zimewekwa!` : 'Zimerejeshwa');
        setTimeout(() => setSuccessMessage(null), 3000);
        if (onUpdate) onUpdate();
      } else throw new Error('Failed');
    } catch (err) {
      setStockItems(previousItems);
      setError('Imeshindwa kuhifadhi');
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
    } catch (err) {
      setStockItems(previousItems);
    }
  };

  // ============================================
  // PDF (same as before, with images)
  // ============================================
  const generatePDF = (workerId: string | null, filterType: 'All' | 'Today' | 'Week' | 'Month') => {
    let itemsToReport: StockItem[] = [];
    if (workerId) itemsToReport = stockItems.filter(i => i.worker_id === workerId);
    else itemsToReport = [...stockItems];
    
    const range = getDateRange(filterType);
    if (range) {
      itemsToReport = itemsToReport.filter(item => {
        const dateToCheck = item.status === 'Purchased' && item.purchased_at 
          ? new Date(item.purchased_at) 
          : new Date(item.created_at);
        return dateToCheck >= range.start && dateToCheck < range.end;
      });
    }
    
    const purchased = itemsToReport.filter(i => i.status === 'Purchased');
    const pending = itemsToReport.filter(i => i.status === 'Pending');
    const filterLabels: Record<string, string> = { 'All': 'Zote', 'Today': 'Leo', 'Week': 'Wiki Hii', 'Month': 'Mwezi Huu' };
    const now = new Date();
    const reportId = `STK-${Date.now().toString(36).toUpperCase()}`;

    const htmlContent = `<!DOCTYPE html>
<html><head><title>Ripoti ya Bidhaa</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
@page { size: A4; margin: 12mm; }
body { font-family: 'Segoe UI', sans-serif; background: white; color: #1e293b; padding: 20px; }
.container { max-width: 190mm; margin: 0 auto; }
.header { background: linear-gradient(135deg, #1e3a5f, #3b82f6, #22c55e); color: white; padding: 24px; border-radius: 12px; margin-bottom: 20px; }
.business-name { font-size: 22px; font-weight: 900; }
.business-slogan { font-size: 11px; opacity: 0.9; margin-top: 3px; }
.report-title { font-size: 15px; font-weight: bold; margin: 12px 0 5px; }
.report-meta { font-size: 11px; opacity: 0.9; display: flex; gap: 20px; flex-wrap: wrap; }
.summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
.summary-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; text-align: center; }
.summary-card.purchased { background: #f0fdf4; border-color: #bbf7d0; }
.summary-card.pending { background: #fef3c7; border-color: #fde68a; }
.summary-label { font-size: 9px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 6px; }
.summary-value { font-size: 26px; font-weight: 900; color: #1e293b; }
.summary-card.purchased .summary-value { color: #059669; }
.summary-card.pending .summary-value { color: #d97706; }
.section { margin-bottom: 24px; page-break-inside: avoid; }
.section-header { padding: 10px 16px; background: #1e3a5f; color: white; border-radius: 8px 8px 0 0; font-size: 13px; font-weight: bold; display: flex; justify-content: space-between; }
.section-header.purchased { background: #059669; }
.section-header.pending { background: #d97706; }
table { width: 100%; border-collapse: collapse; background: white; border: 1px solid #e2e8f0; border-top: none; }
thead th { background: #f1f5f9; color: #475569; padding: 10px 12px; text-align: left; font-size: 10px; text-transform: uppercase; font-weight: 800; }
thead th:first-child { text-align: center; width: 40px; }
tbody td { padding: 11px 12px; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
tbody td:first-child { text-align: center; font-weight: bold; color: #94a3b8; }
.product-img-thumb { width: 60px; height: 60px; object-fit: cover; border-radius: 6px; border: 1px solid #e2e8f0; margin-right: 5px; }
.badge { display: inline-block; padding: 3px 10px; border-radius: 10px; font-size: 9px; font-weight: 800; text-transform: uppercase; }
.badge-purchased { background: #d1fae5; color: #059669; }
.badge-pending { background: #fef3c7; color: #d97706; }
.footer { margin-top: 30px; padding: 16px; background: #f8fafc; border-radius: 10px; text-align: center; font-size: 10px; color: #64748b; border: 1px solid #e2e8f0; }
.no-print { text-align: center; padding: 20px; }
.no-print button { background: #3b82f6; color: white; border: none; padding: 12px 28px; border-radius: 22px; font-size: 13px; font-weight: bold; cursor: pointer; margin: 0 5px; }
.no-print button.close { background: #64748b; }
@media print { .no-print { display: none !important; } }
</style></head><body>
<div class="container">
<div class="header">
<div class="business-name">SONKO SOUND</div>
<div class="business-slogan">Electronics & Appliances • Morogoro, Tanzania</div>
<div class="report-title">Bidhaa Zisizokuepo - ${filterLabels[filterType]}</div>
<div class="report-meta">
<span><strong>Tarehe:</strong> ${now.toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
<span><strong>Ripoti ID:</strong> ${reportId}</span>
</div>
</div>
<div class="summary-grid">
<div class="summary-card"><div class="summary-label">Jumla</div><div class="summary-value">${itemsToReport.length}</div></div>
<div class="summary-card purchased"><div class="summary-label">Zimenunuliwa</div><div class="summary-value">${purchased.length}</div></div>
<div class="summary-card pending"><div class="summary-label">Bado</div><div class="summary-value">${pending.length}</div></div>
</div>
${purchased.length > 0 ? `
<div class="section">
<div class="section-header purchased"><span>✓ BIDHAA ZIMENUNULIWA</span><span>${purchased.length}</span></div>
<table><thead><tr><th>#</th><th>Picha</th><th>Jina la Bidhaa</th><th>Idadi</th><th>Tarehe</th></tr></thead>
<tbody>${purchased.map((item, idx) => `
<tr>
<td>${idx + 1}</td>
<td>${item.image1 ? `<img src="${item.image1}" class="product-img-thumb" />` : ''}${item.image2 ? `<img src="${item.image2}" class="product-img-thumb" />` : ''}</td>
<td><strong>${item.product_name}</strong>${item.notes ? `<br><em style="color:#94a3b8;font-size:10px">${item.notes}</em>` : ''}</td>
<td>${item.quantity || '-'}</td>
<td>${item.purchased_at ? new Date(item.purchased_at).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short' }) : '-'}</td>
</tr>`).join('')}</tbody></table>
</div>` : ''}
${pending.length > 0 ? `
<div class="section">
<div class="section-header pending"><span>⏳ BIDHAA BADO</span><span>${pending.length}</span></div>
<table><thead><tr><th>#</th><th>Picha</th><th>Jina la Bidhaa</th><th>Idadi</th><th>Tarehe</th></tr></thead>
<tbody>${pending.map((item, idx) => `
<tr>
<td>${idx + 1}</td>
<td>${item.image1 ? `<img src="${item.image1}" class="product-img-thumb" />` : ''}${item.image2 ? `<img src="${item.image2}" class="product-img-thumb" />` : ''}</td>
<td><strong>${item.product_name}</strong>${item.notes ? `<br><em style="color:#94a3b8;font-size:10px">${item.notes}</em>` : ''}</td>
<td>${item.quantity || '-'}</td>
<td>${new Date(item.created_at).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short' })}</td>
</tr>`).join('')}</tbody></table>
</div>` : ''}
${itemsToReport.length === 0 ? '<div class="section"><div class="section-header">HAKUNA BIDHAA</div></div>' : ''}
<div class="footer"><strong>Sonko Sound</strong> • Morogoro, Tanzania • 0688423753</div>
<div class="no-print"><button onclick="window.print()">🖨️ Chapisha / Save as PDF</button><button class="close" onclick="window.close()">Funga</button></div>
</div>
<script>window.onload = function() { setTimeout(function() { window.print(); }, 300); };</script>
</body></html>`;

    const printWindow = window.open('', '_blank', 'width=900,height=800');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    } else {
      alert('Tafadhali ruhusu pop-ups');
    }
    
    setIsDownloadModalOpen(false);
    setDownloadWorkerId(null);
  };

  const openDownloadModal = (workerId: string | null = null) => {
    setDownloadWorkerId(workerId);
    setIsDownloadModalOpen(true);
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short', year: 'numeric' });
  const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' });

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
      
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-rose-700 text-xs">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-500"><X size={16} /></button>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-2 text-emerald-700 text-xs">
          <CheckCircle2 size={16} />
          <span>{successMessage}</span>
        </div>
      )}

      {/* ============================================
          WORKER MODE (NO BACK ARROW)
          ============================================ */}
      {isWorkerMode ? (
        activeWorker ? (
          <div className="space-y-6 text-xs text-left">
            {/* Worker Header (NO BACK BUTTON) */}
            <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  {/* Profile Photo */}
                  {activeWorker.photo ? (
                    <img 
                      src={activeWorker.photo} 
                      alt={activeWorker.name}
                      className="h-16 w-16 rounded-2xl object-cover border-2 border-accent/20 shadow-sm cursor-pointer"
                      onClick={() => {
                        setGalleryImages([activeWorker.photo!]);
                        setGalleryIndex(0);
                        setGalleryTitle(activeWorker.name);
                        setIsGalleryOpen(true);
                      }}
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-2xl bg-accent/10 text-accent font-extrabold text-xl flex items-center justify-center shadow-sm">
                      {getInitials(activeWorker.name)}
                    </div>
                  )}
                  
                  <div>
                    <h3 className="text-base font-extrabold text-slate-800">{activeWorker.name}</h3>
                    {activeWorker.phone && (
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        <Phone size={11} /> {activeWorker.phone}
                      </p>
                    )}
                    <p className="text-xs text-slate-400 mt-1">Orodha yako ya Bidhaa Zisizokuepo</p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button 
                    onClick={() => setIsAddProductModalOpen(true)}
                    className="bg-accent hover:bg-accent/90 text-white font-bold py-2.5 px-5 rounded-xl flex items-center justify-center gap-2 shadow-sm transition"
                  >
                    <Plus size={16} /> Ongeza Bidhaa
                  </button>
                  <button 
                    onClick={openEditWorkerModal}
                    className="border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 transition text-[11px]"
                  >
                    <UserCog size={14} /> Hariri Wasifu
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

            {/* Product List with BOTH Images */}
            <div className="space-y-3">
              {activeWorkerItems.length > 0 ? activeWorkerItems.map(item => {
                const imageCount = (item.image1 ? 1 : 0) + (item.image2 ? 1 : 0);
                
                return (
                  <div key={item.id} className={`bg-white rounded-2xl border p-4 shadow-sm transition ${
                    item.status === 'Purchased' ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-100'
                  }`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        {/* BOTH Images side by side */}
                        {imageCount > 0 ? (
                          <div className="flex gap-2 shrink-0">
                            {item.image1 && (
                              <img 
                                src={item.image1} 
                                alt={item.product_name}
                                className="h-16 w-16 rounded-xl object-cover border border-slate-200 cursor-pointer hover:scale-105 transition"
                                onClick={() => openGallery(item, 0)}
                              />
                            )}
                            {item.image2 && (
                              <img 
                                src={item.image2} 
                                alt={`${item.product_name} 2`}
                                className="h-16 w-16 rounded-xl object-cover border border-slate-200 cursor-pointer hover:scale-105 transition"
                                onClick={() => openGallery(item, 1)}
                              />
                            )}
                          </div>
                        ) : (
                          <div className={`h-16 w-16 rounded-xl flex items-center justify-center shrink-0 ${
                            item.status === 'Purchased' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                          }`}>
                            {item.status === 'Purchased' ? <ShoppingBag size={22} /> : <Clock size={22} />}
                          </div>
                        )}
                        
                        <div className="flex-1">
                          <h4 className={`text-sm font-bold ${item.status === 'Purchased' ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                            {item.product_name}
                          </h4>
                          {item.quantity && <p className="text-xs text-slate-500 mt-1">Idadi: {item.quantity}</p>}
                          {item.notes && <p className="text-xs text-slate-400 mt-1 italic">{item.notes}</p>}
                          
                          {/* Image count indicator */}
                          {imageCount > 1 && (
                            <p className="text-[10px] text-blue-600 mt-1 flex items-center gap-1 font-semibold">
                              <ImageIcon size={10} /> Picha {imageCount} - bonyeza kuona zote
                            </p>
                          )}
                          
                          <p className="text-[10px] text-slate-400 mt-2">
                            {formatDate(item.created_at)} • {formatTime(item.created_at)}
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-2 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-600 transition shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              }) : (
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
                  Chagua jina lako ili kuanza
                </p>
              </div>
              <button 
                onClick={() => { resetWorkerForm(); setIsAddWorkerModalOpen(true); }}
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
                      isRemembered ? 'border-emerald-300 ring-2 ring-emerald-500/20 bg-emerald-50/30' : 'border-slate-100 hover:border-accent/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {worker.photo ? (
                        <img src={worker.photo} alt={worker.name} className="h-12 w-12 rounded-xl object-cover border-2 border-accent/20" />
                      ) : (
                        <div className={`h-12 w-12 rounded-xl font-bold flex items-center justify-center ${
                          isRemembered ? 'bg-emerald-100 text-emerald-700' : 'bg-accent/10 text-accent'
                        }`}>
                          {getInitials(worker.name)}
                        </div>
                      )}
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
                  placeholder="Tafuta bidhaa..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs"
                />
              </div>
              <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
                {(['Pending', 'Purchased', 'All'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setAdminFilter(tab)}
                    className={`px-3 py-2 text-xs font-bold rounded-lg transition ${
                      adminFilter === tab 
                        ? tab === 'Pending' ? 'bg-amber-500 text-white' : tab === 'Purchased' ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white'
                        : 'text-slate-500'
                    }`}
                  >
                    {tab === 'Pending' ? `Bado (${adminStats.pending})` : tab === 'Purchased' ? `Zimenunuliwa (${adminStats.purchased})` : `Zote (${adminStats.total})`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Items List - Admin sees BOTH images */}
          {Object.keys(itemsByWorker).length > 0 ? (
            <div className="space-y-3">
              {Object.values(itemsByWorker).map(({ worker, items, pending, purchased }) => {
                const isExpanded = expandedWorkers.has(worker.id) || workerFilter !== 'All' || searchTerm.length > 0 || dateFilter !== 'All';
                const workerPendingIds = items.filter(i => i.status === 'Pending').map(i => i.id);
                
                return (
                  <div key={worker.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between p-3 hover:bg-slate-50/70 transition">
                      <button onClick={() => toggleWorkerExpanded(worker.id)} className="flex items-center gap-3 flex-1 text-left">
                        {worker.photo ? (
                          <img src={worker.photo} alt={worker.name} className="h-9 w-9 rounded-lg object-cover border border-slate-200" />
                        ) : (
                          <div className={`h-9 w-9 rounded-lg font-bold text-xs flex items-center justify-center ${
                            pending > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {getInitials(worker.name)}
                          </div>
                        )}
                        <div className="flex-1">
                          <h3 className="text-sm font-bold text-slate-800">{worker.name}</h3>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[10px] font-semibold text-amber-600">{pending} Bado</span>
                            <span className="text-[10px] font-semibold text-emerald-600">{purchased} Zimenunuliwa</span>
                          </div>
                        </div>
                        <ChevronRight size={16} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </button>
                      
                      <div className="relative ml-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === `admin-${worker.id}` ? null : `admin-${worker.id}`); }}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"
                        >
                          <MoreVertical size={16} />
                        </button>
                        
                        {openMenuId === `admin-${worker.id}` && (
                          <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-100 py-1 min-w-[200px] z-20">
                            <button
                              onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); openDownloadModal(worker.id); }}
                              className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              <FileDown size={14} className="text-blue-500" />
                              Pakua Ripoti
                            </button>
                            <div className="border-t border-slate-100 my-1"></div>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteWorker(worker.id); }}
                              className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 size={14} />
                              Futa {worker.name}
                            </button>
                          </div>
                        )}
                      </div>
                      
                      {workerPendingIds.length > 0 && isExpanded && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleBulkTick(workerPendingIds, 'Purchased'); }}
                          className="ml-2 px-3 py-1.5 text-[10px] font-bold rounded-lg bg-emerald-600 text-white flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <CheckSquare size={11} />
                          Weka Zote ({workerPendingIds.length})
                        </button>
                      )}
                    </div>
                    
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/40">
                        {items.length > 0 ? (
                          <div className="divide-y divide-slate-100">
                            {items.map(item => {
                              const imageCount = (item.image1 ? 1 : 0) + (item.image2 ? 1 : 0);
                              
                              return (
                                <div key={item.id} className={`flex items-center gap-3 p-3 ${item.status === 'Purchased' ? 'bg-emerald-50/40' : 'bg-white'}`}>
                                  <button
                                    onClick={() => handleToggleStatus(item.id, item.status)}
                                    className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                                      item.status === 'Purchased'
                                        ? 'bg-emerald-500 text-white shadow-md'
                                        : 'border-2 border-slate-300 text-slate-300 hover:border-emerald-500 hover:text-emerald-500 bg-white'
                                    }`}
                                  >
                                    {item.status === 'Purchased' ? <CheckSquare size={20} strokeWidth={3} /> : <Square size={20} />}
                                  </button>
                                  
                                  {/* BOTH Images - admin sees side by side */}
                                  {imageCount > 0 && (
                                    <div className="flex gap-1.5 shrink-0">
                                      {item.image1 && (
                                        <img 
                                          src={item.image1} 
                                          alt={item.product_name}
                                          className="h-14 w-14 rounded-lg object-cover border border-slate-200 cursor-pointer hover:scale-110 hover:shadow-md transition"
                                          onClick={() => openGallery(item, 0)}
                                        />
                                      )}
                                      {item.image2 && (
                                        <img 
                                          src={item.image2} 
                                          alt={`${item.product_name} 2`}
                                          className="h-14 w-14 rounded-lg object-cover border border-slate-200 cursor-pointer hover:scale-110 hover:shadow-md transition"
                                          onClick={() => openGallery(item, 1)}
                                        />
                                      )}
                                    </div>
                                  )}
                                  
                                  <div className="flex-1 min-w-0">
                                    <h4 className={`text-sm font-bold ${item.status === 'Purchased' ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                                      {item.product_name}
                                    </h4>
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                      {item.quantity && (
                                        <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                          Idadi: {item.quantity}
                                        </span>
                                      )}
                                      <span className="text-[10px] text-slate-400">
                                        {formatDate(item.created_at)} • {formatTime(item.created_at)}
                                      </span>
                                      {imageCount > 1 && (
                                        <span className="text-[10px] text-blue-600 font-semibold flex items-center gap-1">
                                          <ImageIcon size={9} /> Picha {imageCount}
                                        </span>
                                      )}
                                    </div>
                                    {item.notes && <p className="text-[11px] text-slate-500 mt-1 italic">{item.notes}</p>}
                                  </div>
                                  
                                  <button 
                                    onClick={() => handleDeleteItem(item.id)}
                                    className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 shrink-0"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-slate-400">
                            <p className="text-xs">Hakuna bidhaa</p>
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
              <Package size={36} className="text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-600">Hakuna bidhaa zilizopatikana</p>
            </div>
          )}
        </div>
      )}

      {/* ============================================
          ADD WORKER MODAL
          ============================================ */}
      {isAddWorkerModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setIsAddWorkerModalOpen(false)} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50">
              <X size={18} />
            </button>
            <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
              <UserPlus className="text-accent" size={18} />
              Ongeza Jina Lako
            </h3>
            
            <form onSubmit={handleAddWorker} className="space-y-4 text-xs text-left">
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  {workerPhoto ? (
                    <img src={workerPhoto} alt="Profile" className="h-24 w-24 rounded-2xl object-cover border-4 border-accent/20 shadow-md" />
                  ) : (
                    <div className="h-24 w-24 rounded-2xl bg-slate-100 border-4 border-slate-200 flex items-center justify-center">
                      <Camera size={28} className="text-slate-400" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => profileFileRef.current?.click()}
                    disabled={isCompressing}
                    className="absolute -bottom-2 -right-2 h-9 w-9 rounded-full bg-accent hover:bg-accent/90 text-white flex items-center justify-center shadow-lg transition disabled:opacity-50"
                  >
                    {isCompressing ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">Picha ya wasifu (hiari)</p>
                <input ref={profileFileRef} type="file" accept="image/*" onChange={handleProfileImageChange} className="hidden" />
              </div>
              
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
                  className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600 disabled:opacity-50">
                  Ghairi
                </button>
                <button type="submit" disabled={isLoading || isCompressing || !workerName.trim()}
                  className="px-5 py-2.5 bg-accent hover:bg-accent/90 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center gap-2">
                  {isLoading ? <><Loader2 size={14} className="animate-spin" /> Inasajili...</> : <>Endelea</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================
          EDIT WORKER MODAL
          ============================================ */}
      {isEditWorkerModalOpen && activeWorker && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setIsEditWorkerModalOpen(false)} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50">
              <X size={18} />
            </button>
            <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
              <UserCog className="text-accent" size={18} />
              Hariri Wasifu
            </h3>
            
            <form onSubmit={handleUpdateWorker} className="space-y-4 text-xs text-left">
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  {editWorkerPhoto ? (
                    <img src={editWorkerPhoto} alt="Profile" className="h-24 w-24 rounded-2xl object-cover border-4 border-accent/20 shadow-md" />
                  ) : (
                    <div className="h-24 w-24 rounded-2xl bg-slate-100 border-4 border-slate-200 flex items-center justify-center">
                      <Camera size={28} className="text-slate-400" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => editProfileFileRef.current?.click()}
                    disabled={isCompressing}
                    className="absolute -bottom-2 -right-2 h-9 w-9 rounded-full bg-accent hover:bg-accent/90 text-white flex items-center justify-center shadow-lg disabled:opacity-50"
                  >
                    {isCompressing ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                  </button>
                </div>
                <input ref={editProfileFileRef} type="file" accept="image/*" onChange={handleEditProfileImageChange} className="hidden" />
              </div>
              
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Jina Lako *</label>
                <input 
                  type="text" 
                  required 
                  value={editWorkerName} 
                  onChange={(e) => setEditWorkerName(e.target.value)} 
                  className="w-full p-3 border border-slate-200 rounded-xl text-base" 
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Namba ya Simu</label>
                <input 
                  type="tel" 
                  value={editWorkerPhone} 
                  onChange={(e) => setEditWorkerPhone(e.target.value)} 
                  placeholder="0712345678"
                  className="w-full p-3 border border-slate-200 rounded-xl" 
                />
              </div>
              
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsEditWorkerModalOpen(false)} disabled={isLoading}
                  className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600">
                  Ghairi
                </button>
                <button type="submit" disabled={isLoading || isCompressing || !editWorkerName.trim()}
                  className="px-5 py-2.5 bg-accent hover:bg-accent/90 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center gap-2">
                  {isLoading ? <><Loader2 size={14} className="animate-spin" /> Inahifadhi...</> : <><Save size={14} /> Hifadhi</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================
          ADD PRODUCT MODAL
          ============================================ */}
      {isAddProductModalOpen && activeWorker && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => { setIsAddProductModalOpen(false); resetProductForm(); }} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50">
              <X size={18} />
            </button>
            <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
              <Package className="text-amber-500" size={18} />
              Ongeza Bidhaa
            </h3>
            
            <form onSubmit={handleAddProduct} className="space-y-4 text-xs text-left">
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Jina la Bidhaa *</label>
                <input 
                  type="text" 
                  required 
                  value={productName} 
                  onChange={(e) => setProductName(e.target.value)} 
                  placeholder="Mfano: Speaker ya Sony"
                  className="w-full p-3 border border-slate-200 rounded-xl text-base" 
                  autoFocus
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Idadi (Hiari)</label>
                <input 
                  type="text" 
                  value={productQuantity} 
                  onChange={(e) => setProductQuantity(e.target.value)} 
                  placeholder="Mfano: 5 pieces"
                  className="w-full p-2.5 border border-slate-200 rounded-xl" 
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Maelezo (Hiari)</label>
                <textarea 
                  value={productNotes} 
                  onChange={(e) => setProductNotes(e.target.value)} 
                  placeholder="Maelezo yoyote..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl h-20" 
                />
              </div>
              
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <ImageIcon size={12} /> Picha za Bidhaa (Hiari - 2 Max)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    {productImage1 ? (
                      <div className="relative">
                        <img src={productImage1} alt="Product 1" className="w-full h-28 rounded-xl object-cover border-2 border-emerald-300" />
                        <button
                          type="button"
                          onClick={() => { setProductImage1(''); if (file1Ref.current) file1Ref.current.value = ''; }}
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-md"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => file1Ref.current?.click()}
                        disabled={isCompressing}
                        className="w-full h-28 rounded-xl border-2 border-dashed border-slate-300 hover:border-accent hover:bg-accent/5 flex flex-col items-center justify-center gap-1 transition disabled:opacity-50"
                      >
                        <Camera size={20} className="text-slate-400" />
                        <span className="text-[10px] text-slate-500 font-semibold">Picha 1</span>
                      </button>
                    )}
                    <input ref={file1Ref} type="file" accept="image/*" onChange={(e) => handleProductImageChange(e, 1)} className="hidden" />
                  </div>
                  
                  <div>
                    {productImage2 ? (
                      <div className="relative">
                        <img src={productImage2} alt="Product 2" className="w-full h-28 rounded-xl object-cover border-2 border-emerald-300" />
                        <button
                          type="button"
                          onClick={() => { setProductImage2(''); if (file2Ref.current) file2Ref.current.value = ''; }}
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-md"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => file2Ref.current?.click()}
                        disabled={isCompressing}
                        className="w-full h-28 rounded-xl border-2 border-dashed border-slate-300 hover:border-accent hover:bg-accent/5 flex flex-col items-center justify-center gap-1 transition disabled:opacity-50"
                      >
                        <Camera size={20} className="text-slate-400" />
                        <span className="text-[10px] text-slate-500 font-semibold">Picha 2</span>
                      </button>
                    )}
                    <input ref={file2Ref} type="file" accept="image/*" onChange={(e) => handleProductImageChange(e, 2)} className="hidden" />
                  </div>
                </div>
                {isCompressing && (
                  <p className="text-[10px] text-accent mt-2 flex items-center gap-1">
                    <Loader2 size={10} className="animate-spin" /> Inasindika picha...
                  </p>
                )}
              </div>
              
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => { setIsAddProductModalOpen(false); resetProductForm(); }} disabled={isLoading}
                  className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600">
                  Ghairi
                </button>
                <button type="submit" disabled={isLoading || isCompressing || !productName.trim()}
                  className="px-5 py-2 bg-accent hover:bg-accent/90 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center gap-2">
                  {isLoading ? <><Loader2 size={14} className="animate-spin" /> Inaongeza...</> : <><Plus size={14} /> Ongeza</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================
          DOWNLOAD MODAL
          ============================================ */}
      {isDownloadModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
            <button onClick={() => { setIsDownloadModalOpen(false); setDownloadWorkerId(null); }} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50">
              <X size={18} />
            </button>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
                <FileText size={22} />
              </div>
              <div>
                <h3 className="text-md font-bold text-slate-800">Pakua Ripoti</h3>
                <p className="text-xs text-slate-500">
                  {downloadWorkerId ? 'Ripoti ya mfanyakazi' : 'Ripoti ya Wote'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(['Today', 'Week', 'Month', 'All'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => generatePDF(downloadWorkerId, f)}
                  className="p-4 rounded-2xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition text-left"
                >
                  <p className="text-sm font-bold text-slate-800">
                    {f === 'Today' ? 'Leo' : f === 'Week' ? 'Wiki Hii' : f === 'Month' ? 'Mwezi Huu' : 'Zote'}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {f === 'Today' ? 'Bidhaa za leo' : f === 'Week' ? 'Siku 7' : f === 'Month' ? 'Siku 30' : 'Muda wote'}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================
          FULL-SCREEN IMAGE GALLERY
          ============================================ */}
      {isGalleryOpen && galleryImages.length > 0 && (
        <div 
          className="fixed inset-0 z-[70] bg-black/95 flex flex-col"
          onClick={() => setIsGalleryOpen(false)}
        >
          {/* Gallery Header */}
          <div 
            className="flex items-center justify-between p-4 border-b border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-white">
              <h3 className="text-sm font-bold">{galleryTitle}</h3>
              <p className="text-[11px] text-white/60 mt-0.5">
                Picha {galleryIndex + 1} ya {galleryImages.length}
              </p>
            </div>
            <button 
              onClick={() => setIsGalleryOpen(false)}
              className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
            >
              <X size={20} />
            </button>
          </div>
          
          {/* Gallery Main Image */}
          <div 
            className="flex-1 flex items-center justify-center p-4 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {galleryImages.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition z-10"
                >
                  <ChevronLeft size={24} />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition z-10"
                >
                  <ChevronRight size={24} />
                </button>
              </>
            )}
            
            <img 
              src={galleryImages[galleryIndex]} 
              alt={`${galleryTitle} ${galleryIndex + 1}`} 
              className="max-w-full max-h-full object-contain rounded-xl"
            />
          </div>
          
          {/* Thumbnail Strip */}
          {galleryImages.length > 1 && (
            <div 
              className="p-4 flex items-center justify-center gap-3 border-t border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              {galleryImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setGalleryIndex(idx)}
                  className={`h-16 w-16 rounded-lg overflow-hidden border-2 transition ${
                    idx === galleryIndex 
                      ? 'border-white scale-110' 
                      : 'border-white/20 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img 
                    src={img} 
                    alt={`Thumbnail ${idx + 1}`} 
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
