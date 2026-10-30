/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from './services/api';
import { 
  Customer, Debt, Payment, Supplier, 
  NotificationItem, TransactionRecord, BusinessSettings 
} from './types';
import AuthScreen from './components/AuthScreen';
import Dashboard from './components/Dashboard';
import CustomerManagement from './components/CustomerManagement';
import DebtManagement from './components/DebtManagement';
import SupplierManagement from './components/SupplierManagement';
import InstallmentManagement, { InstallmentNotification } from './components/InstallmentManagement';
import OrdersPage from './components/OrdersPage';
import StockRequests from './components/StockRequests';
import CalendarView from './components/CalendarView';
import ReportsView from './components/ReportsView';
import SettingsView from './components/SettingsView';
import NotificationsView from './components/NotificationsView';
import MemoryPage from './components/MemoryPage';
import KubandikaPage from './components/KubandikaPage';
import Kopesha from './components/Kopesha';
import Cashier from './components/Cashier';
import Malipo from './components/Malipo';
import { 
  LayoutDashboard, Users, BookOpen, Truck, Calendar, 
  FileSpreadsheet, Settings, LogOut, Menu, X, Shield, 
  MapPin, Phone, Bell, Loader2, AlertTriangle, RefreshCw,
  FolderOpen, Download, Wallet, ShoppingCart, Package, Globe, Banknote, Coins
} from 'lucide-react';

// Utility: Get days difference
function getDaysDiff(currentDate: string, dueDate: string): number {
  const current = new Date(currentDate);
  const due = new Date(dueDate);
  const diffTime = current.getTime() - due.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Utility: Safe parse contacts JSON string → array
function safeParseContacts(raw: any): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Utility: Generate notifications from data - WITH SUPPLIERS
function generateNotificationsFromData(
  customers: Customer[],
  debts: Debt[],
  payments: Payment[],
  suppliers: Supplier[],
  currentDate?: string
): NotificationItem[] {
  const today = currentDate || new Date().toISOString().split('T')[0];
  const notifications: NotificationItem[] = [];

  // --- CUSTOMER DEBTS ---
  debts.forEach(debt => {
    const customer = customers.find(c => c.id === debt.customerId);
    const debtPayments = payments.filter(p => p.debtId === debt.id);
    const totalPaid = debtPayments.reduce((sum, p) => sum + p.amount, 0);
    const remaining = debt.amount - totalPaid;
    
    if (remaining <= 0) return;

    const daysDiff = getDaysDiff(today, debt.dueDate);
    
    if (daysDiff > 0) {
      notifications.push({
        id: `overdue-${debt.id}`,
        type: 'Overdue',
        message: `${customer?.fullName || 'Mteja'} amechelewa kulipa TSh ${remaining.toLocaleString()} ya "${debt.description}". Siku ${daysDiff} zimepita.`,
        date: today,
        customerId: debt.customerId,
        debtId: debt.id
      });
    } else if (daysDiff === 0) {
      notifications.push({
        id: `due-today-${debt.id}`,
        type: 'Due Today',
        message: `Leo ni siku ya mwisho kwa ${customer?.fullName || 'Mteja'} kulipa TSh ${remaining.toLocaleString()} ya "${debt.description}".`,
        date: today,
        customerId: debt.customerId,
        debtId: debt.id
      });
    } else if (daysDiff === -1) {
      notifications.push({
        id: `due-tomorrow-${debt.id}`,
        type: 'Due Tomorrow',
        message: `Kesho ${customer?.fullName || 'Mteja'} anatakiwa kulipa TSh ${remaining.toLocaleString()} ya "${debt.description}".`,
        date: today,
        customerId: debt.customerId,
        debtId: debt.id
      });
    }
  });

  // --- SUPPLIER PAYMENTS ---
  suppliers.forEach(supplier => {
    const remaining = supplier.amount - supplier.paidAmount;
    
    if (remaining <= 0) return;

    const daysDiff = getDaysDiff(today, supplier.dueDate);
    const supplierName = supplier.name || 'Msambazaji';
    const productDesc = supplier.productType || supplier.notes || 'Bidhaa';
    
    if (daysDiff > 0) {
      notifications.push({
        id: `supplier-overdue-${supplier.id}`,
        type: 'Overdue',
        message: `Umepitisha siku ${daysDiff} bila kumlipa ${supplierName}. Deni: TSh ${remaining.toLocaleString()} ya "${productDesc}".`,
        date: today,
        customerId: undefined,
        debtId: undefined
      });
    } else if (daysDiff === 0) {
      notifications.push({
        id: `supplier-due-today-${supplier.id}`,
        type: 'Due Today',
        message: `Leo ni siku ya mwisho kumlipa ${supplierName}. Deni: TSh ${remaining.toLocaleString()} ya "${productDesc}".`,
        date: today,
        customerId: undefined,
        debtId: undefined
      });
    } else if (daysDiff === -1) {
      notifications.push({
        id: `supplier-due-tomorrow-${supplier.id}`,
        type: 'Due Tomorrow',
        message: `Kesho ni siku ya mwisho kumlipa ${supplierName}. Deni: TSh ${remaining.toLocaleString()} ya "${productDesc}".`,
        date: today,
        customerId: undefined,
        debtId: undefined
      });
    }
  });

  // --- PAYMENT RECEIVED ---
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  const recentPayments = payments
    .filter(p => p.date === today || p.date === yesterdayStr)
    .slice(0, 5);
  
  recentPayments.forEach(payment => {
    const debt = debts.find(d => d.id === payment.debtId);
    const customer = debt ? customers.find(c => c.id === debt.customerId) : null;
    
    if (customer && payment.amount > 0) {
      notifications.push({
        id: `payment-${payment.id}`,
        type: 'Payment Received',
        message: `Malipo ya TSh ${payment.amount.toLocaleString()} yamepokelewa kutoka kwa ${customer.fullName} kupitia ${payment.paymentMethod}.`,
        date: payment.date,
        customerId: debt?.customerId
      });
    }
  });

  const priority: Record<string, number> = { 'Overdue': 0, 'Due Today': 1, 'Due Tomorrow': 2, 'Payment Received': 3 };
  notifications.sort((a, b) => (priority[a.type] || 99) - (priority[b.type] || 99));

  return notifications.slice(0, 30);
}

export default function App() {
  // ============================================
  // URL-based worker mode (?worker=1)
  // ============================================
  const [isWorkerUrl, setIsWorkerUrl] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('worker') === '1';
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('ledger_authenticated') === 'true';
  });

  // ✅ Track user role (admin, staff, or cashier)
  const [userRole, setUserRole] = useState<'admin' | 'staff' | 'cashier' | null>(() => {
    return (localStorage.getItem('ledger_role') as 'admin' | 'staff' | 'cashier') || null;
  });

  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // ✅ Admin Cashier floating modal state
  const [isCashierModalOpen, setIsCashierModalOpen] = useState(false);
  const [cashierName, setCashierName] = useState('');
  const [cashierAmount, setCashierAmount] = useState('');
  const [cashierSubmitting, setCashierSubmitting] = useState(false);
  const [cashierModalMsg, setCashierModalMsg] = useState<string | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [installmentNotifications, setInstallmentNotifications] = useState<InstallmentNotification[]>([]);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [isProcessingAdminSMS, setIsProcessingAdminSMS] = useState(false);

  const totalAlertCount = notifications.filter(n => n.type === 'Overdue' || n.type === 'Due Today').length + 
                          installmentNotifications.filter(n => n.type === 'Installment Halfway' || n.type === 'Installment Completed').length;

  const processAdminSMSQueue = useCallback(async () => {
    if (isProcessingAdminSMS) return;
    
    setIsProcessingAdminSMS(true);
    try {
      console.log('🔄 Checking admin SMS queue...');
      const response = await fetch('/api/admin-sms-process');
      const result = await response.json();
      
      console.log('📬 Admin SMS Queue Result:', result);
      
      if (result.success && result.processed > 0) {
        console.log(`✅ Admin SMS: ${result.sent} sent, ${result.failed} failed`);
      }
    } catch (err) {
      console.error('❌ Failed to process admin SMS:', err);
    } finally {
      setIsProcessingAdminSMS(false);
    }
  }, [isProcessingAdminSMS]);

  useEffect(() => {
    if (isAuthenticated && !isWorkerUrl) {
      processAdminSMSQueue();
      const interval = setInterval(processAdminSMSQueue, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, isWorkerUrl, processAdminSMSQueue]);

  const tryLoadFromLocalStorage = () => {
    try {
      const cached = localStorage.getItem('ledger_cached_data');
      if (cached) {
        const data = JSON.parse(cached);
        if (data.customers && Array.isArray(data.customers)) {
          const restoredCustomers: Customer[] = data.customers.map((c: any) => ({
            ...c,
            contacts: safeParseContacts(c.contacts),
          }));
          setCustomers(restoredCustomers);
        }
        if (data.debts && Array.isArray(data.debts)) setDebts(data.debts);
        if (data.payments && Array.isArray(data.payments)) setPayments(data.payments);
        if (data.suppliers && Array.isArray(data.suppliers)) setSuppliers(data.suppliers);
        if (data.settings) setSettings(data.settings);
      }
    } catch (e) {
      console.error('Failed to load cache:', e);
    }
  };

  const cacheDataToLocalStorage = useCallback(() => {
    try {
      const cacheData = { customers, debts, payments, suppliers, settings, timestamp: new Date().toISOString() };
      localStorage.setItem('ledger_cached_data', JSON.stringify(cacheData));
    } catch (e) {
      console.error('Failed to cache data:', e);
    }
  }, [customers, debts, payments, suppliers, settings]);

  useEffect(() => {
    if (customers.length > 0 || debts.length > 0 || suppliers.length > 0) {
      cacheDataToLocalStorage();
    }
  }, [customers, debts, payments, suppliers, cacheDataToLocalStorage]);

  const syncDatabaseStates = useCallback(async (showLoading: boolean = true) => {
    if (showLoading) setIsLoading(true);
    setIsSyncing(true);
    setError(null);

    try {
      const [customersData, debtsData, paymentsData, suppliersData, settingsData] = await Promise.all([
        api.customers.list(),
        api.debts.list(),
        api.payments.list(),
        api.suppliers.list(),
        api.settings.get()
      ]);

      const transformedCustomers: Customer[] = (Array.isArray(customersData) ? customersData : []).map((c: any) => ({
        id: c.id,
        fullName: c.full_name || '',
        phoneNumber: c.phone_number || '',
        address: c.address || '',
        businessName: c.business_name || '',
        notes: c.notes || '',
        photoUrl: c.photo_url || '',
        createdAt: c.created_at || new Date().toISOString().split('T')[0],
        contacts: safeParseContacts(c.contacts),
      }));

      const transformedDebts: Debt[] = (Array.isArray(debtsData) ? debtsData : []).map((d: any) => ({
        id: d.id, customerId: d.customer_id || '', amount: d.amount || 0,
        dateBorrowed: d.date_borrowed || '', dueDate: d.due_date || '',
        description: d.description || '', category: d.category || 'Mizigo/Products',
        notes: d.notes || '', status: d.status || 'Active',
        createdAt: d.created_at || new Date().toISOString(),
        originalDueDate: d.originalDueDate || d.original_due_date || d.due_date || '',
        extensions: Array.isArray(d.extensions)
          ? d.extensions
          : (typeof d.extensions === 'string' ? safeParseExtensions(d.extensions) : []),
      }));

      const transformedPayments: Payment[] = (Array.isArray(paymentsData) ? paymentsData : []).map((p: any) => ({
        id: p.id, debtId: p.debt_id || '', amount: p.amount || 0,
        date: p.date || '', paymentMethod: p.payment_method || 'Cash',
        notes: p.notes || '', createdAt: p.created_at || new Date().toISOString()
      }));

      const transformedSuppliers: Supplier[] = (Array.isArray(suppliersData) ? suppliersData : []).map((s: any) => ({
        id: s.id, name: s.name || '', phoneNumber: s.phone_number || '',
        amount: s.amount || 0, paidAmount: s.paid_amount || 0,
        dueDate: s.due_date || '', productType: s.product_type || '',
        notes: s.notes || '', createdAt: s.created_at || new Date().toISOString().split('T')[0],
        products: (s.products || []).map((p: any) => ({
          id: p.id, description: p.description || '', amount: p.amount || 0,
          dueDate: p.due_date || '', notes: p.notes || '',
          createdAt: p.created_at || new Date().toISOString().split('T')[0]
        })),
        payments: (s.payments || []).map((p: any) => ({
          id: p.id, amount: p.amount || 0, date: p.date || '',
          notes: p.notes || '', createdAt: p.created_at || new Date().toISOString()
        }))
      }));

      const transformedSettings: BusinessSettings = settingsData && settingsData.business_name ? {
        businessName: settingsData.business_name || 'My Business',
        businessAddress: settingsData.business_address || '',
        businessPhone: settingsData.business_phone || ''
      } : {
        businessName: 'My Business',
        businessAddress: 'Dar es Salaam, Tanzania',
        businessPhone: '255XXXXXXXXX'
      };

      setCustomers(transformedCustomers);
      setDebts(transformedDebts);
      setPayments(transformedPayments);
      setSuppliers(transformedSuppliers);
      setSettings(transformedSettings);

      const generatedNotifications = generateNotificationsFromData(
        transformedCustomers, transformedDebts, transformedPayments, transformedSuppliers
      );
      setNotifications(generatedNotifications);

      cacheDataToLocalStorage();

    } catch (err: any) {
      console.error('Failed to sync data:', err);
      tryLoadFromLocalStorage();
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, [cacheDataToLocalStorage]);

  function safeParseExtensions(raw: any): any[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  useEffect(() => {
    if (isAuthenticated && !isWorkerUrl) {
      tryLoadFromLocalStorage();
      syncDatabaseStates(true);
      processAdminSMSQueue();
    }
  }, [isAuthenticated, isWorkerUrl]);

  const handleAuthenticated = (role: 'admin' | 'staff' | 'cashier') => {
    setIsAuthenticated(true);
    setUserRole(role);
    localStorage.setItem('ledger_authenticated', 'true');
    localStorage.setItem('ledger_role', role);
    if (role === 'cashier') {
      setCurrentTab('cashier');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUserRole(null);
    localStorage.removeItem('ledger_authenticated');
    localStorage.removeItem('ledger_role');
    setCustomers([]); setDebts([]); setPayments([]);
    setSuppliers([]); setNotifications([]); setSettings(null);
    setInstallmentNotifications([]);
    setCurrentTab('dashboard');
  };

  const handleInstallmentNotifications = (notifs: InstallmentNotification[]) => {
    setInstallmentNotifications(prev => {
      const existingIds = new Set(prev.map(n => n.id));
      const newNotifs = notifs.filter(n => !existingIds.has(n.id));
      return [...newNotifs, ...prev];
    });
  };

  const APK_DOWNLOAD_URL = 'https://drive.google.com/uc?export=download&id=1l1GZNupLt4UpPQRJVQoHPoD7b82X3o60';

  const handleDownloadApp = () => {
    window.open(APK_DOWNLOAD_URL, '_blank');
  };

  // ✅ Navigation items — Malipo (admin + staff), Cashier (admin + staff)
  const allNavigationItems = [
    { id: 'dashboard', label: 'Bao Kuu (Dashboard)', icon: LayoutDashboard },
    { id: 'customers', label: 'Wateja (wadaiwa)', icon: Users },
    { id: 'debts', label: 'Madeni ya Wateja (All)', icon: BookOpen },
    { id: 'suppliers', label: 'Ma Suppliers (Wanaotudai)', icon: Truck },
    { id: 'installments', label: 'Kubandika (Installments)', icon: Wallet },
    { id: 'kopesha', label: 'Kopesha (Mikopo)', icon: Banknote, adminOnly: true },
    {
      id: 'malipo',
      label: 'Malipo',
      icon: Coins,
      isNew: true,
      highlight: 'malipo',
    },
    {
      id: 'kubandika',
      label: 'Kubandika Tz/China',
      icon: Globe,
      isNew: true,
      highlight: 'kubandika',
    },
    { id: 'orders', label: 'Oda (Orders)', icon: ShoppingCart },
    { id: 'stock', label: 'Bidhaa Zisizokuepo', icon: Package, adminOnly: true },
    // ✅ Cashier — now visible to admin AND staff
    { id: 'cashier', label: 'Cashier (Malipo)', icon: Coins },
    { id: 'calendar', label: 'Kalenda (Calendar)', icon: Calendar },
    { id: 'reports', label: 'Ripoti (Reports)', icon: FileSpreadsheet },
    { id: 'memory', label: 'Kumbukumbu (Memory)', icon: FolderOpen },
    { id: 'settings', label: 'Mipangilio (Settings)', icon: Settings },
  ];

  const navigationItems = allNavigationItems.filter(item => 
    !(item as any).adminOnly || userRole === 'admin'
  );

  // ✅ Force staff/cashier out of restricted tabs if they somehow get there
  // Staff loses only Kopesha & Stock (Cashier is now allowed)
  useEffect(() => {
    if (userRole === 'staff' && (currentTab === 'kopesha' || currentTab === 'stock')) {
      setCurrentTab('dashboard');
    }
    if (userRole === 'cashier' && currentTab !== 'cashier') {
      setCurrentTab('cashier');
    }
  }, [userRole, currentTab]);

  // ✅ Admin floating "Tuma kwa Cashier" handler
  const handleSendToCashier = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(cashierAmount);
    if (!amt || amt <= 0) {
      setCashierModalMsg('Weka kiasi sahihi');
      return;
    }
    setCashierSubmitting(true);
    setCashierModalMsg(null);
    try {
      const res = await fetch('/api/cashier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cashierName.trim(),
          amount: amt,
          createdBy: 'admin',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCashierModalMsg('✅ Imepitishwa kwa Cashier!');
        setCashierName('');
        setCashierAmount('');
        setTimeout(() => {
          setIsCashierModalOpen(false);
          setCashierModalMsg(null);
        }, 1500);
      } else {
        setCashierModalMsg(data.error || 'Imeshindwa kutuma');
      }
    } catch (err: any) {
      setCashierModalMsg(err.message || 'Imeshindwa kutuma');
    } finally {
      setCashierSubmitting(false);
    }
  };

  // ============================================
  // CASHIER VIEW — locked-down, no sidebar
  // ============================================
  if (isAuthenticated && userRole === 'cashier') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="bg-gradient-to-r from-purple-700 via-indigo-700 to-blue-700 text-white flex items-center justify-between p-4 sticky top-0 z-40 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-white/20 backdrop-blur border border-white/30 flex items-center justify-center">
              <Coins size={16} />
            </div>
            <div>
              <h1 className="text-xs font-extrabold">{settings?.businessName || 'Sonko Sound'}</h1>
              <span className="text-[10px] text-white/70 font-semibold uppercase tracking-wider">Cashier Panel</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-200 hover:text-white hover:bg-white/10 transition"
          >
            <LogOut size={14} /> Logout
          </button>
        </header>
        <main className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full overflow-y-auto">
          <Cashier userRole="cashier" />
        </main>
        <footer className="bg-slate-900 text-slate-400 p-4 text-center border-t border-slate-800">
          <p className="text-[10px] flex items-center justify-center gap-1">
            <MapPin size={10} /> {settings?.businessAddress || 'Morogoro, Tanzania'} • 
            <Phone size={10} /> {settings?.businessPhone || '0688423753'}
          </p>
        </footer>
      </div>
    );
  }

  // ============================================
  // WORKER VIEW (via ?worker=1 URL) — NO RUDI BUTTON
  // ============================================
  if (isWorkerUrl) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="bg-slate-900 text-slate-300 flex items-center justify-between p-4 sticky top-0 z-40 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-accent flex items-center justify-center text-white font-bold shadow-md shadow-accent/20">
              <Package size={14} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-white">Sonko Sound</h2>
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                Bidhaa Zisizokuepo
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full overflow-y-auto">
          <StockRequests onUpdate={() => {}} isWorkerMode={true} />
        </main>

        <footer className="bg-slate-900 text-slate-400 p-4 text-center border-t border-slate-800">
          <p className="text-[10px]">Morogoro, Tanzania • 0688423753</p>
        </footer>
      </div>
    );
  }

  // ============================================
  // AUTH SCREEN
  // ============================================
  if (!isAuthenticated) {
    return (
      <AuthScreen 
        onAuthenticated={handleAuthenticated}
        onWorkerAccess={() => {
          setIsWorkerUrl(true);
          window.history.replaceState({}, '', `${window.location.pathname}?worker=1`);
        }}
      />
    );
  }

  if (isLoading && customers.length === 0 && debts.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto animate-pulse">
            <Loader2 size={32} className="text-accent animate-spin" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">Inapakia Data...</h3>
            <p className="text-sm text-slate-400 mt-1">Tafadhali subiri, inachukua data kutoka kwenye seva.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col md:flex-row font-sans transition-colors duration-250">
      
      {isSyncing && (
        <div className="fixed top-0 left-0 right-0 h-1 bg-slate-200 z-50">
          <div className="h-full bg-accent animate-pulse" style={{ width: '100%' }}></div>
        </div>
      )}

      {error && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-lg w-full mx-4">
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 shadow-lg flex items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center gap-2 text-rose-700">
              <AlertTriangle size={18} />
              <div><p className="text-xs font-bold">Hitilafu ya Mtandao</p><p className="text-[10px] text-rose-600 mt-0.5">{error}</p></div>
            </div>
            <button onClick={() => syncDatabaseStates(false)} className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition">
              <RefreshCw size={12} /> Jaribu Tena
            </button>
          </div>
        </div>
      )}

      {/* SIDEBAR */}
      <aside className="hidden md:flex md:w-64 flex-col bg-slate-900 text-slate-300 min-h-screen p-5 justify-between border-r border-slate-800 shrink-0 select-none">
        <div className="space-y-8">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 rounded-md bg-accent flex items-center justify-center text-white font-bold shadow-md shadow-accent/20"><Shield size={14} /></div>
              <div>
                <h2 className="text-sm font-extrabold text-white leading-tight truncate w-32">{settings?.businessName || 'Sonko Sound'}</h2>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  {userRole === 'admin' ? '👑 Admin' : '👤 Staff'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {userRole === 'admin' && (
                <button
                  onClick={() => setIsCashierModalOpen(true)}
                  className="p-1.5 rounded-xl border border-transparent text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors"
                  title="Tuma kwa Cashier"
                >
                  <Coins size={18} />
                </button>
              )}
              <button onClick={() => { setCurrentTab('notifications'); setSelectedCustomerId(null); }}
                className={`relative p-1.5 rounded-xl border transition-colors ${currentTab === 'notifications' ? 'bg-accent border-accent text-white' : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-800'}`}>
                <Bell size={18} />
                {totalAlertCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-600 text-white font-extrabold text-[8px] h-4 w-4 rounded-full flex items-center justify-center border-2 border-slate-900 animate-pulse">
                    {totalAlertCount}
                  </span>
                )}
              </button>
            </div>
          </div>
          <nav className="space-y-1.5">
            {navigationItems.map(item => {
              const Icon = item.icon;
              const isKubandika = (item as any).highlight === 'kubandika';
              const isMalipo = (item as any).highlight === 'malipo';
              const isHighlighted = isKubandika || isMalipo;
              const isActive = currentTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentTab(item.id);
                    if (item.id !== 'customers') setSelectedCustomerId(null);
                  }}
                  className={`w-full relative flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all border-l-3 ${
                    isActive
                      ? isMalipo
                        ? 'bg-gradient-to-r from-fuchsia-500/30 via-purple-500/20 to-indigo-500/10 border-fuchsia-400 text-white shadow-md shadow-fuchsia-500/10'
                        : isKubandika
                          ? 'bg-gradient-to-r from-amber-500/25 to-orange-500/10 border-amber-400 text-amber-100 shadow-sm'
                          : 'bg-white/5 border-accent text-white shadow-sm'
                      : isMalipo
                        ? 'border-transparent bg-gradient-to-r from-fuchsia-500/10 via-purple-500/5 to-transparent hover:from-fuchsia-500/25 hover:via-purple-500/15 text-fuchsia-300 hover:text-fuchsia-100'
                        : isKubandika
                          ? 'border-transparent bg-gradient-to-r from-amber-500/8 to-transparent hover:from-amber-500/20 text-amber-300 hover:text-amber-100'
                          : 'border-transparent hover:bg-slate-800 hover:text-white text-slate-400'
                  }`}
                >
                  <Icon
                    size={16}
                    className={isMalipo ? 'text-fuchsia-400' : isKubandika ? 'text-amber-400' : ''}
                  />
                  <span className="flex-1 text-left">{item.label}</span>

                  {isMalipo && (item as any).isNew && (
                    <span className="shrink-0 text-[8px] font-black tracking-wider bg-gradient-to-r from-fuchsia-400 via-purple-400 to-indigo-400 text-white px-1.5 py-0.5 rounded-md shadow-sm shadow-fuchsia-500/30 animate-pulse">
                      MPYA
                    </span>
                  )}
                  {isKubandika && (item as any).isNew && (
                    <span className="shrink-0 text-[8px] font-black tracking-wider bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 px-1.5 py-0.5 rounded-md shadow-sm animate-pulse">
                      NEW
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
        <div className="border-t border-slate-800 pt-4 mt-6 space-y-3">
          <button 
            onClick={handleDownloadApp}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30"
          >
            <Download size={16} />
            <span>Download App (APK)</span>
          </button>
          
          <div className="px-2 mb-3">
            <p className="text-[10px] text-slate-500 flex items-center gap-1"><MapPin size={10} /> {settings?.businessAddress || 'Haijawekwa'}</p>
            <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-1"><Phone size={10} /> {settings?.businessPhone || 'Haijawekwa'}</p>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-all">
            <LogOut size={16} /><span>Ondoka (Logout)</span>
          </button>
        </div>
      </aside>

      {/* MOBILE HEADER */}
      <header className="md:hidden bg-slate-900 text-slate-300 flex items-center justify-between p-4 sticky top-0 z-40 border-b border-slate-800 select-none">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-accent flex items-center justify-center text-white font-bold"><Shield size={12} /></div>
          <div>
            <span className="text-xs font-bold text-white truncate max-w-[150px]">{settings?.businessName || 'Sonko Sound'}</span>
            <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider">
              {userRole === 'admin' ? '👑 Admin' : '👤 Staff'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {userRole === 'admin' && (
            <button
              onClick={() => setIsCashierModalOpen(true)}
              className="p-1.5 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-slate-800 transition-colors"
              title="Tuma kwa Cashier"
            >
              <Coins size={18} />
            </button>
          )}
          <button onClick={() => { setCurrentTab('notifications'); setSelectedCustomerId(null); setIsMobileMenuOpen(false); }}
            className={`relative p-1.5 rounded-lg transition-colors ${currentTab === 'notifications' ? 'bg-accent text-white' : 'text-slate-300 hover:text-white hover:bg-slate-800'}`}>
            <Bell size={18} />
            {totalAlertCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-600 text-white font-extrabold text-[8px] h-4 w-4 rounded-full flex items-center justify-center border-2 border-slate-900 animate-pulse">
                {totalAlertCount}
              </span>
            )}
          </button>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition">
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* MOBILE DRAWER */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-[57px] bg-slate-900 z-30 flex flex-col p-5 justify-between animate-fade-in select-none overflow-y-auto">
          <nav className="space-y-2">
            {navigationItems.map(item => {
              const Icon = item.icon;
              const isKubandika = (item as any).highlight === 'kubandika';
              const isMalipo = (item as any).highlight === 'malipo';
              const isActive = currentTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentTab(item.id);
                    setIsMobileMenuOpen(false);
                    if (item.id !== 'customers') setSelectedCustomerId(null);
                  }}
                  className={`w-full relative flex items-center gap-3 px-4 py-3.5 rounded-xl text-xs font-bold transition-all border-l-3 ${
                    isActive
                      ? isMalipo
                        ? 'bg-gradient-to-r from-fuchsia-500/30 via-purple-500/20 to-indigo-500/10 border-fuchsia-400 text-white'
                        : isKubandika
                          ? 'bg-gradient-to-r from-amber-500/25 to-orange-500/10 border-amber-400 text-amber-100'
                          : 'bg-white/5 border-accent text-white'
                      : isMalipo
                        ? 'border-transparent bg-gradient-to-r from-fuchsia-500/10 via-purple-500/5 to-transparent text-fuchsia-300 hover:text-fuchsia-100'
                        : isKubandika
                          ? 'border-transparent bg-gradient-to-r from-amber-500/8 to-transparent text-amber-300 hover:text-amber-100'
                          : 'border-transparent hover:bg-slate-800 hover:text-white text-slate-400'
                  }`}
                >
                  <Icon
                    size={18}
                    className={isMalipo ? 'text-fuchsia-400' : isKubandika ? 'text-amber-400' : ''}
                  />
                  <span className="flex-1 text-left">{item.label}</span>

                  {isMalipo && (item as any).isNew && (
                    <span className="shrink-0 text-[8px] font-black tracking-wider bg-gradient-to-r from-fuchsia-400 via-purple-400 to-indigo-400 text-white px-1.5 py-0.5 rounded-md shadow-sm shadow-fuchsia-500/30 animate-pulse">
                      MPYA
                    </span>
                  )}
                  {isKubandika && (item as any).isNew && (
                    <span className="shrink-0 text-[8px] font-black tracking-wider bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 px-1.5 py-0.5 rounded-md shadow-sm animate-pulse">
                      NEW
                    </span>
                  )}
                </button>
              );
            })}
            <button 
              onClick={() => { handleDownloadApp(); setIsMobileMenuOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-xs font-bold transition-all bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-500/20"
            >
              <Download size={18} />
              <span>Download App (APK)</span>
            </button>
          </nav>
          <button onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 transition-all mt-4">
            <LogOut size={16} /><span>Ondoka kwenye Mfumo (Logout)</span>
          </button>
        </div>
      )}

      {/* MAIN VIEWPORT */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full transition-all duration-300">
        {currentTab === 'dashboard' && (
          <Dashboard customers={customers} debts={debts} payments={payments} suppliers={suppliers} transactions={transactions} notifications={notifications} setCurrentTab={setCurrentTab} setSelectedCustomerId={setSelectedCustomerId} />
        )}
        {currentTab === 'customers' && (
          <CustomerManagement 
            customers={customers} 
            debts={debts} 
            payments={payments} 
            onUpdate={() => syncDatabaseStates(false)} 
            selectedCustomerId={selectedCustomerId} 
            setSelectedCustomerId={setSelectedCustomerId}
            userRole={userRole}
          />
        )}
        {currentTab === 'debts' && (
          <DebtManagement 
            debts={debts} 
            customers={customers} 
            payments={payments} 
            onUpdate={() => syncDatabaseStates(false)} 
            setCurrentTab={setCurrentTab} 
            setSelectedCustomerId={setSelectedCustomerId}
            userRole={userRole}
          />
        )}
        {currentTab === 'suppliers' && (
          <SupplierManagement 
            suppliers={suppliers} 
            onUpdate={() => syncDatabaseStates(false)} 
            userRole={userRole}
          />
        )}
        {currentTab === 'installments' && (
          <InstallmentManagement 
            onUpdate={() => syncDatabaseStates(false)} 
            onNotificationsGenerated={handleInstallmentNotifications}
            userRole={userRole}
          />
        )}
        {/* ✅ Kopesha — Only mounted if user is Admin */}
        {currentTab === 'kopesha' && userRole === 'admin' && (
          <Kopesha 
            onUpdate={() => syncDatabaseStates(false)} 
            userRole={userRole}
          />
        )}
        {/* ✅ Malipo — Mounted for Admin + Staff (blocked for cashier) */}
        {currentTab === 'malipo' && userRole !== 'cashier' && (
          <Malipo 
            onUpdate={() => syncDatabaseStates(false)} 
            userRole={userRole}
          />
        )}
        {currentTab === 'kubandika' && (
          <KubandikaPage userRole={userRole} />
        )}
        {currentTab === 'orders' && (
          <OrdersPage onUpdate={() => {
            syncDatabaseStates(false);
            processAdminSMSQueue();
          }} />
        )}
        {/* ✅ Stock — Only mounted if user is Admin */}
        {currentTab === 'stock' && userRole === 'admin' && (
          <StockRequests 
            onUpdate={() => syncDatabaseStates(false)} 
            userRole={userRole}
          />
        )}
        {/* ✅ Cashier — Mounted for Admin + Staff */}
        {currentTab === 'cashier' && (userRole === 'admin' || userRole === 'staff') && (
          <Cashier userRole={userRole} />
        )}
        {currentTab === 'calendar' && (
          <CalendarView debts={debts} customers={customers} payments={payments} suppliers={suppliers} setCurrentTab={setCurrentTab} setSelectedCustomerId={setSelectedCustomerId} />
        )}
        {currentTab === 'reports' && (
          <ReportsView customers={customers} debts={debts} payments={payments} suppliers={suppliers} />
        )}
        {currentTab === 'memory' && (
          <MemoryPage />
        )}
        {currentTab === 'settings' && (
          <SettingsView onUpdate={() => syncDatabaseStates(false)} onLogout={handleLogout} />
        )}
        {currentTab === 'notifications' && (
          <NotificationsView 
            notifications={notifications} 
            customers={customers}
            suppliers={suppliers}
            debts={debts}
            payments={payments}
            installmentNotifications={installmentNotifications}
            setCurrentTab={setCurrentTab} 
            setSelectedCustomerId={setSelectedCustomerId} 
            onClearAll={() => {
              setNotifications([]);
              setInstallmentNotifications([]);
            }} 
          />
        )}
      </main>

      {/* ✅ Admin Cashier Modal — Tuma kwa Cashier */}
      {isCashierModalOpen && userRole === 'admin' && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => { setIsCashierModalOpen(false); setCashierModalMsg(null); }}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50"
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-md">
                <Coins size={22} className="text-white" />
              </div>
              <div>
                <h3 className="text-md font-extrabold text-slate-800">Tuma kwa Cashier</h3>
                <p className="text-xs text-slate-400">Cashier atapokea ombi la malipo</p>
              </div>
            </div>

            {cashierModalMsg && (
              <div className={`rounded-xl p-3 text-xs font-semibold ${
                cashierModalMsg.startsWith('✅') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}>
                {cashierModalMsg}
              </div>
            )}

            <form onSubmit={handleSendToCashier} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-500 uppercase tracking-wide mb-1">Jina (Hiari)</label>
                <input
                  type="text"
                  value={cashierName}
                  onChange={e => setCashierName(e.target.value)}
                  placeholder="Mf. Juma"
                  className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm focus:border-indigo-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-500 uppercase tracking-wide mb-1">Kiasi (TSh) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={cashierAmount}
                  onChange={e => setCashierAmount(e.target.value)}
                  placeholder="0"
                  className="w-full p-3 border-2 border-slate-200 rounded-xl text-lg font-extrabold focus:border-indigo-400 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsCashierModalOpen(false); setCashierModalMsg(null); }}
                  disabled={cashierSubmitting}
                  className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600 disabled:opacity-50"
                >
                  Ghairi
                </button>
                <button
                  type="submit"
                  disabled={cashierSubmitting || !cashierAmount}
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl font-bold shadow-md disabled:opacity-50 flex items-center gap-2"
                >
                  {cashierSubmitting ? <><Loader2 size={14} className="animate-spin" /> Inatuma...</> : <><Coins size={14} /> Tuma</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
