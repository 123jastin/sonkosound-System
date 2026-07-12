/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
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
import CalendarView from './components/CalendarView';
import ReportsView from './components/ReportsView';
import SettingsView from './components/SettingsView';
import NotificationsView from './components/NotificationsView';
import { 
  LayoutDashboard, Users, BookOpen, Truck, Calendar, 
  FileSpreadsheet, Settings, LogOut, Menu, X, Shield, 
  MapPin, Phone, Bell, Loader2, AlertTriangle, RefreshCw 
} from 'lucide-react';

// Utility: Get days difference
function getDaysDiff(currentDate: string, dueDate: string): number {
  const current = new Date(currentDate);
  const due = new Date(dueDate);
  const diffTime = current.getTime() - due.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Utility: Generate notifications from data
function generateNotificationsFromData(
  customers: Customer[],
  debts: Debt[],
  payments: Payment[],
  currentDate: string = '2026-07-10'
): NotificationItem[] {
  const notifications: NotificationItem[] = [];

  debts.forEach(debt => {
    const customer = customers.find(c => c.id === debt.customerId);
    const debtPayments = payments.filter(p => p.debtId === debt.id);
    const totalPaid = debtPayments.reduce((sum, p) => sum + p.amount, 0);
    const remaining = debt.amount - totalPaid;
    
    if (remaining <= 0) return;

    const daysDiff = getDaysDiff(currentDate, debt.dueDate);
    
    if (daysDiff > 0) {
      notifications.push({
        id: `overdue-${debt.id}`,
        type: 'Overdue',
        message: `${customer?.fullName || 'Mteja'} amechelewa kulipa TSh ${remaining.toLocaleString()} kwa deni la "${debt.description}". Siku ${daysDiff} zimepita.`,
        date: currentDate,
        customerId: debt.customerId,
        debtId: debt.id
      });
    } else if (daysDiff === 0) {
      notifications.push({
        id: `due-today-${debt.id}`,
        type: 'Due Today',
        message: `Leo ni siku ya mwisho kwa ${customer?.fullName || 'Mteja'} kulipa TSh ${remaining.toLocaleString()} kwa "${debt.description}".`,
        date: currentDate,
        customerId: debt.customerId,
        debtId: debt.id
      });
    } else if (daysDiff === -1) {
      notifications.push({
        id: `due-tomorrow-${debt.id}`,
        type: 'Due Tomorrow',
        message: `Kesho ${customer?.fullName || 'Mteja'} anatakiwa kulipa TSh ${remaining.toLocaleString()} kwa "${debt.description}".`,
        date: currentDate,
        customerId: debt.customerId,
        debtId: debt.id
      });
    }
  });

  // Add payment received notifications
  const recentPayments = payments
    .filter(p => p.date === currentDate || p.date === new Date(new Date(currentDate).getTime() - 86400000).toISOString().split('T')[0])
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
        customerId: payment.debtId ? debt?.customerId : undefined
      });
    }
  });

  // Sort by priority
  const priority: Record<string, number> = { 'Overdue': 0, 'Due Today': 1, 'Due Tomorrow': 2, 'Payment Received': 3 };
  notifications.sort((a, b) => (priority[a.type] || 99) - (priority[b.type] || 99));

  return notifications.slice(0, 20);
}

export default function App() {
  // ============================================
  // AUTHENTICATION STATE
  // ============================================
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('ledger_authenticated') === 'true';
  });

  // ============================================
  // NAVIGATION STATE
  // ============================================
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // ============================================
  // DATA STATE
  // ============================================
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);

  // ============================================
  // LOADING & ERROR STATE
  // ============================================
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // ============================================
  // SYNC DATA FROM D1 BACKEND
  // ============================================
  const syncDatabaseStates = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [
        customersData,
        debtsData,
        paymentsData,
        suppliersData,
        settingsData
      ] = await Promise.all([
        api.customers.list(),
        api.debts.list(),
        api.payments.list(),
        api.suppliers.list(),
        api.settings.get()
      ]);

      // Transform API data to match frontend types
      const transformedCustomers: Customer[] = customersData.map((c: any) => ({
        id: c.id,
        fullName: c.full_name,
        phoneNumber: c.phone_number,
        address: c.address || '',
        businessName: c.business_name || '',
        notes: c.notes || '',
        photoUrl: c.photo_url || '',
        createdAt: c.created_at || new Date().toISOString().split('T')[0]
      }));

      const transformedDebts: Debt[] = debtsData.map((d: any) => ({
        id: d.id,
        customerId: d.customer_id,
        amount: d.amount,
        dateBorrowed: d.date_borrowed,
        dueDate: d.due_date,
        description: d.description,
        category: d.category || 'Mizigo/Products',
        notes: d.notes || '',
        status: d.status || 'Active',
        createdAt: d.created_at || new Date().toISOString()
      }));

      const transformedPayments: Payment[] = paymentsData.map((p: any) => ({
        id: p.id,
        debtId: p.debt_id,
        amount: p.amount,
        date: p.date,
        paymentMethod: p.payment_method,
        notes: p.notes || '',
        createdAt: p.created_at || new Date().toISOString()
      }));

      const transformedSuppliers: Supplier[] = suppliersData.map((s: any) => ({
        id: s.id,
        name: s.name,
        phoneNumber: s.phone_number,
        amount: s.amount,
        paidAmount: s.paid_amount,
        dueDate: s.due_date,
        notes: s.notes || '',
        createdAt: s.created_at || new Date().toISOString().split('T')[0],
        products: (s.products || []).map((p: any) => ({
          id: p.id,
          description: p.description,
          amount: p.amount,
          dueDate: p.due_date,
          notes: p.notes || '',
          createdAt: p.created_at || new Date().toISOString().split('T')[0]
        })),
        payments: (s.payments || []).map((p: any) => ({
          id: p.id,
          amount: p.amount,
          date: p.date,
          notes: p.notes || '',
          createdAt: p.created_at || new Date().toISOString()
        }))
      }));

      const transformedSettings: BusinessSettings = {
        businessName: settingsData?.business_name || 'My Business',
        businessAddress: settingsData?.business_address || '',
        businessPhone: settingsData?.business_phone || ''
      };

      setCustomers(transformedCustomers);
      setDebts(transformedDebts);
      setPayments(transformedPayments);
      setSuppliers(transformedSuppliers);
      setSettings(transformedSettings);

      // Generate notifications from synced data
      const generatedNotifications = generateNotificationsFromData(
        transformedCustomers,
        transformedDebts,
        transformedPayments
      );
      setNotifications(generatedNotifications);

      // Generate transaction log summary
      const recentTransactions: TransactionRecord[] = [
        {
          id: 'tx-sync-' + Date.now(),
          actionType: 'Sync',
          description: `Data synced successfully at ${new Date().toLocaleString('sw-TZ')}`,
          amount: 0,
          timestamp: new Date().toISOString()
        }
      ];
      setTransactions(recentTransactions);

    } catch (err: any) {
      console.error('Failed to sync data:', err);
      setError(err.message || 'Imeshindwa kupakia data. Jaribu tena.');
      
      // If offline or API fails, try loading from localStorage fallback
      tryLoadFromLocalStorage();
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ============================================
  // LOCAL STORAGE FALLBACK
  // ============================================
  const tryLoadFromLocalStorage = () => {
    try {
      const cached = localStorage.getItem('ledger_cached_data');
      if (cached) {
        const data = JSON.parse(cached);
        if (data.customers) setCustomers(data.customers);
        if (data.debts) setDebts(data.debts);
        if (data.payments) setPayments(data.payments);
        if (data.suppliers) setSuppliers(data.suppliers);
        if (data.settings) setSettings(data.settings);
        console.log('Loaded data from cache');
      }
    } catch (e) {
      console.error('Failed to load cache:', e);
    }
  };

  // ============================================
  // CACHE DATA TO LOCAL STORAGE
  // ============================================
  const cacheDataToLocalStorage = useCallback(() => {
    try {
      const cacheData = {
        customers,
        debts,
        payments,
        suppliers,
        settings,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('ledger_cached_data', JSON.stringify(cacheData));
    } catch (e) {
      console.error('Failed to cache data:', e);
    }
  }, [customers, debts, payments, suppliers, settings]);

  // Cache data whenever it changes
  useEffect(() => {
    if (customers.length > 0 || debts.length > 0 || suppliers.length > 0) {
      cacheDataToLocalStorage();
    }
  }, [customers, debts, payments, suppliers, cacheDataToLocalStorage]);

  // ============================================
  // INITIAL LOAD
  // ============================================
  useEffect(() => {
    if (isAuthenticated) {
      syncDatabaseStates();
    }
  }, [isAuthenticated, syncDatabaseStates]);

  // ============================================
  // AUTH HANDLERS
  // ============================================
  const handleAuthenticated = () => {
    setIsAuthenticated(true);
    localStorage.setItem('ledger_authenticated', 'true');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('ledger_authenticated');
    // Clear cached data on logout for security
    localStorage.removeItem('ledger_cached_data');
  };

  // ============================================
  // RETRY HANDLER
  // ============================================
  const handleRetry = () => {
    syncDatabaseStates();
  };

  // ============================================
  // NAVIGATION ITEMS
  // ============================================
  const navigationItems = [
    { id: 'dashboard', label: 'Bao Kuu (Dashboard)', icon: LayoutDashboard },
    { id: 'customers', label: 'Wateja (Customers)', icon: Users },
    { id: 'debts', label: 'Madeni ya Wateja (Debt Book)', icon: BookOpen },
    { id: 'suppliers', label: 'Wauzaji (Suppliers)', icon: Truck },
    { id: 'calendar', label: 'Kalenda (Calendar)', icon: Calendar },
    { id: 'reports', label: 'Ripoti (Reports)', icon: FileSpreadsheet },
    { id: 'settings', label: 'Mipangilio (Settings)', icon: Settings },
  ];

  // ============================================
  // RENDER: AUTH SCREEN
  // ============================================
  if (!isAuthenticated) {
    return <AuthScreen onAuthenticated={handleAuthenticated} />;
  }

  // ============================================
  // RENDER: LOADING SCREEN
  // ============================================
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
          <div className="w-48 h-1.5 bg-slate-200 rounded-full mx-auto overflow-hidden">
            <div className="h-full bg-accent rounded-full animate-pulse" style={{ width: '60%' }}></div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: ERROR BANNER
  // ============================================
  const ErrorBanner = error && (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-lg w-full mx-4">
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 shadow-lg flex items-center justify-between gap-3 animate-fade-in">
        <div className="flex items-center gap-2 text-rose-700">
          <AlertTriangle size={18} />
          <div>
            <p className="text-xs font-bold">Hitilafu ya Mtandao</p>
            <p className="text-[10px] text-rose-600 mt-0.5">{error}</p>
          </div>
        </div>
        <button
          onClick={handleRetry}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition"
        >
          <RefreshCw size={12} />
          Jaribu Tena
        </button>
      </div>
    </div>
  );

  // ============================================
  // RENDER: MAIN APP
  // ============================================
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col md:flex-row font-sans transition-colors duration-250">
      
      {ErrorBanner}

      {/* SIDEBAR NAVIGATION (Desktop) */}
      <aside className="hidden md:flex md:w-64 flex-col bg-slate-900 text-slate-300 min-h-screen p-5 justify-between border-r border-slate-800 shrink-0 select-none">
        <div className="space-y-8">
          
          {/* Logo / Brand Header */}
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 rounded-md bg-accent flex items-center justify-center text-white font-bold shadow-md shadow-accent/20">
                <Shield size={14} />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-white leading-tight truncate w-32">
                  {settings?.businessName || 'Sonko Sound'}
                </h2>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Sonko Sound</span>
              </div>
            </div>

            {/* Desktop Bell icon with badge */}
            <button
              onClick={() => {
                setCurrentTab('notifications');
                setSelectedCustomerId(null);
              }}
              className={`relative p-1.5 rounded-xl border transition-colors ${
                currentTab === 'notifications'
                  ? 'bg-accent border-accent text-white'
                  : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Arifu na Vikumbusho Leo"
            >
              <Bell size={18} />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-600 text-white font-extrabold text-[8px] h-4 w-4 rounded-full flex items-center justify-center border-2 border-slate-900 animate-pulse">
                  {notifications.filter(n => n.type === 'Overdue' || n.type === 'Due Today').length}
                </span>
              )}
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {navigationItems.map(item => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentTab(item.id);
                    if (item.id !== 'customers') setSelectedCustomerId(null);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all border-l-3 ${
                    isActive 
                      ? 'bg-white/5 border-accent text-white shadow-sm' 
                      : 'border-transparent hover:bg-slate-800 hover:text-white text-slate-400'
                  }`}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User logout section bottom */}
        <div className="border-t border-slate-800 pt-4 mt-6">
          <div className="px-2 mb-3">
            <p className="text-[10px] text-slate-500 flex items-center gap-1">
              <MapPin size={10} /> {settings?.businessAddress || 'Haijawekwa'}
            </p>
            <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-1">
              <Phone size={10} /> {settings?.businessPhone || 'Haijawekwa'}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-all"
          >
            <LogOut size={16} />
            <span>Ondoka (Logout)</span>
          </button>
        </div>
      </aside>

      {/* MOBILE HEADER (Sticky) */}
      <header className="md:hidden bg-slate-900 text-slate-300 flex items-center justify-between p-4 sticky top-0 z-40 border-b border-slate-800 select-none">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-accent flex items-center justify-center text-white font-bold">
            <Shield size={12} />
          </div>
          <span className="text-xs font-bold text-white truncate max-w-[150px]">
            {settings?.businessName || 'Sonko Sound'}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Mobile Bell icon with badge */}
          <button
            onClick={() => {
              setCurrentTab('notifications');
              setSelectedCustomerId(null);
              setIsMobileMenuOpen(false);
            }}
            className={`relative p-1.5 rounded-lg transition-colors ${
              currentTab === 'notifications'
                ? 'bg-accent text-white'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Arifu na Vikumbusho Leo"
          >
            <Bell size={18} />
            {notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-600 text-white font-extrabold text-[8px] h-4 w-4 rounded-full flex items-center justify-center border-2 border-slate-900 animate-pulse">
                {notifications.filter(n => n.type === 'Overdue' || n.type === 'Due Today').length}
              </span>
            )}
          </button>

          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* MOBILE DRAWER LINKLIST */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-[57px] bg-slate-900 z-30 flex flex-col p-5 justify-between animate-fade-in select-none">
          <nav className="space-y-2">
            {navigationItems.map(item => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentTab(item.id);
                    setIsMobileMenuOpen(false);
                    if (item.id !== 'customers') setSelectedCustomerId(null);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-xs font-bold transition-all border-l-3 ${
                    isActive 
                      ? 'bg-white/5 border-accent text-white' 
                      : 'border-transparent hover:bg-slate-800 hover:text-white text-slate-400'
                  }`}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <button
            onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 transition-all"
          >
            <LogOut size={16} />
            <span>Ondoka kwenye Mfumo (Logout)</span>
          </button>
        </div>
      )}

      {/* MAIN VIEWPORT WORKSPACE */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full transition-all duration-300">
        
        {/* Offline indicator */}
        {error && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center gap-2 text-amber-700 text-xs">
            <AlertTriangle size={14} />
            <span>Unaangalia data ya awali (cached). Data mpya haipatikani kwa sasa.</span>
            <button onClick={handleRetry} className="ml-auto text-amber-800 font-bold hover:underline">
              Jaribu Tena
            </button>
          </div>
        )}

        {currentTab === 'dashboard' && (
          <Dashboard 
            customers={customers} 
            debts={debts} 
            payments={payments} 
            suppliers={suppliers} 
            transactions={transactions}
            notifications={notifications}
            setCurrentTab={setCurrentTab}
            setSelectedCustomerId={setSelectedCustomerId}
          />
        )}

        {currentTab === 'customers' && (
          <CustomerManagement 
            customers={customers}
            debts={debts}
            payments={payments}
            onUpdate={syncDatabaseStates}
            selectedCustomerId={selectedCustomerId}
            setSelectedCustomerId={setSelectedCustomerId}
          />
        )}

        {currentTab === 'debts' && (
          <DebtManagement 
            debts={debts}
            customers={customers}
            payments={payments}
            onUpdate={syncDatabaseStates}
            setCurrentTab={setCurrentTab}
            setSelectedCustomerId={setSelectedCustomerId}
          />
        )}

        {currentTab === 'suppliers' && (
          <SupplierManagement 
            suppliers={suppliers}
            onUpdate={syncDatabaseStates}
          />
        )}

        {currentTab === 'calendar' && (
          <CalendarView 
            debts={debts}
            customers={customers}
            payments={payments}
            suppliers={suppliers}
            setCurrentTab={setCurrentTab}
            setSelectedCustomerId={setSelectedCustomerId}
          />
        )}

        {currentTab === 'reports' && (
          <ReportsView 
            customers={customers}
            debts={debts}
            payments={payments}
            suppliers={suppliers}
          />
        )}

        {currentTab === 'settings' && (
          <SettingsView 
            onUpdate={syncDatabaseStates} 
            onLogout={handleLogout} 
          />
        )}

        {currentTab === 'notifications' && (
          <NotificationsView
            notifications={notifications}
            customers={customers}
            setCurrentTab={setCurrentTab}
            setSelectedCustomerId={setSelectedCustomerId}
            onClearAll={() => setNotifications([])}
          />
        )}
      </main>

    </div>
  );
}
