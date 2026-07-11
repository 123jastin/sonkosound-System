/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { LocalDatabase } from './db';
import { Customer, Debt, Payment, Supplier, NotificationItem, TransactionRecord, BusinessSettings } from './types';
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
  FileSpreadsheet, Settings, LogOut, Menu, X, Shield, MapPin, Phone, Bell
} from 'lucide-react';

export default function App() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('ledger_authenticated') === 'true';
  });

  // Navigation State
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Mobile Drawer State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Core Ledgers States (Synchronized on CRUD actions)
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);

  // Synchronize memory states from Local Storage Database
  const syncDatabaseStates = () => {
    LocalDatabase.init();
    setCustomers(LocalDatabase.getCustomers());
    
    // Auto calculate status based on reference date 2026-07-10
    const updatedDebts = LocalDatabase.getUpdatedDebts('2026-07-10');
    setDebts(updatedDebts);
    
    setPayments(LocalDatabase.getPayments());
    setSuppliers(LocalDatabase.getSuppliers());
    setTransactions(LocalDatabase.getTransactions());
    
    // Auto generate Swahili business reminders
    setNotifications(LocalDatabase.getNotifications('2026-07-10'));
    setSettings(LocalDatabase.getSettings());
  };

  useEffect(() => {
    syncDatabaseStates();
  }, []);

  const handleAuthenticated = () => {
    setIsAuthenticated(true);
    localStorage.setItem('ledger_authenticated', 'true');
    syncDatabaseStates();
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('ledger_authenticated');
  };

  // Nav items configuration
  const navigationItems = [
    { id: 'dashboard', label: 'Bao Kuu (Dashboard)', icon: LayoutDashboard },
    { id: 'customers', label: 'Wateja (Customers)', icon: Users },
    { id: 'debts', label: 'Madeni ya Wateja (Debt Book)', icon: BookOpen },
    { id: 'suppliers', label: 'Wauzaji (Suppliers)', icon: Truck },
    { id: 'calendar', label: 'Kalenda (Calendar)', icon: Calendar },
    { id: 'reports', label: 'Ripoti (Reports)', icon: FileSpreadsheet },
    { id: 'settings', label: 'Mipangilio (Settings)', icon: Settings },
  ];

  if (!isAuthenticated) {
    return <AuthScreen onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col md:flex-row font-sans transition-colors duration-250">
      
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

            {/* Desktop Facebook-like Bell icon with badge */}
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
                  {notifications.length}
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
              <MapPin size={10} /> {settings?.businessAddress}
            </p>
            <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-1">
              <Phone size={10} /> {settings?.businessPhone}
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
          <span className="text-xs font-bold text-white truncate max-w-[150px]">{settings?.businessName}</span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Mobile Facebook-like Bell icon with badge */}
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
              <span className="absolute -top-1 -right-1 bg-rose-600 text-white font-extrabold text-[8px] h-4.5 w-4.5 rounded-full flex items-center justify-center border-2 border-slate-900 animate-pulse">
                {notifications.length}
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
