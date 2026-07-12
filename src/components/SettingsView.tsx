/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect } from 'react';
import { Customer, Debt, Payment, Supplier, NotificationItem, TransactionRecord } from '../types';
import { api } from '../services/api';
import { 
  TrendingUp, TrendingDown, Users, AlertTriangle, 
  Calendar, CheckCircle, ShieldAlert, ArrowRight, 
  Clock, CreditCard, ChevronRight, Bell, Trash2, CheckCircle2,
  Loader2, RefreshCw
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
  Tooltip, PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid 
} from 'recharts';

interface DashboardProps {
  customers: Customer[];
  debts: Debt[];
  payments: Payment[];
  suppliers: Supplier[];
  transactions: TransactionRecord[];
  notifications: NotificationItem[];
  setCurrentTab: (tab: string) => void;
  setSelectedCustomerId?: (id: string | null) => void;
}

export default function Dashboard({ 
  customers, 
  debts, 
  payments, 
  suppliers, 
  transactions, 
  notifications, 
  setCurrentTab,
  setSelectedCustomerId
}: DashboardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [syncStatus, setSyncStatus] = useState<'connected' | 'offline' | 'syncing'>('connected');

  // Update last sync time when data changes
  useEffect(() => {
    setLastSyncTime(new Date().toLocaleTimeString('sw-TZ'));
    setSyncStatus('connected');
  }, [customers, debts, payments, suppliers]);

  // Helper: Get days difference
  const getDaysDiff = (currentDate: string, dueDate: string): number => {
    const current = new Date(currentDate);
    const due = new Date(dueDate);
    const diffTime = current.getTime() - due.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const unreadNotifications = useMemo(() => {
    return notifications.slice(0, 5);
  }, [notifications]);

  // Calculations for KPI Cards
  const stats = useMemo(() => {
    const currentDate = '2026-07-10';

    let totalOwedByCustomers = 0;
    debts.forEach(debt => {
      const debtPayments = payments.filter(p => p.debtId === debt.id);
      const paid = debtPayments.reduce((acc, p) => acc + p.amount, 0);
      totalOwedByCustomers += Math.max(0, debt.amount - paid);
    });

    let totalOwedToSuppliers = 0;
    suppliers.forEach(sup => {
      totalOwedToSuppliers += Math.max(0, sup.amount - sup.paidAmount);
    });

    const collectedThisMonth = payments
      .filter(p => p.date.startsWith('2026-07'))
      .reduce((acc, p) => acc + p.amount, 0);

    let dueTodayAmount = 0;
    let overdueAmount = 0;

    debts.forEach(debt => {
      const debtPayments = payments.filter(p => p.debtId === debt.id);
      const paid = debtPayments.reduce((acc, p) => acc + p.amount, 0);
      const remaining = debt.amount - paid;

      if (remaining > 0) {
        const daysDiff = getDaysDiff(currentDate, debt.dueDate);
        if (daysDiff === 0) {
          dueTodayAmount += remaining;
        } else if (daysDiff > 0) {
          overdueAmount += remaining;
        }
      }
    });

    return {
      totalOwedByCustomers,
      totalOwedToSuppliers,
      collectedThisMonth,
      outstandingBalance: totalOwedByCustomers - totalOwedToSuppliers,
      dueTodayAmount,
      overdueAmount,
      totalCustomers: customers.length,
      totalSuppliers: suppliers.length
    };
  }, [customers, debts, payments, suppliers]);

  // Chart Data
  const collectionTrendData = useMemo(() => {
    const monthlyData: { [key: string]: { collected: number; paid: number } } = {
      '01': { collected: 0, paid: 0 },
      '02': { collected: 0, paid: 0 },
      '03': { collected: 0, paid: 0 },
      '04': { collected: 0, paid: 0 },
      '05': { collected: 0, paid: 0 },
      '06': { collected: 60000, paid: 20000 },
      '07': { collected: stats.collectedThisMonth, paid: 0 }
    };

    payments.forEach(p => {
      if (p.date.startsWith('2026-')) {
        const month = p.date.split('-')[1];
        if (monthlyData[month]) {
          monthlyData[month].collected += p.amount;
        }
      }
    });

    const monthsSwahili = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul'];
    return monthsSwahili.map((name, idx) => {
      const key = String(idx + 1).padStart(2, '0');
      return {
        name,
        'Makusanyo (TSh)': monthlyData[key]?.collected || 0,
        'Malipo (TSh)': monthlyData[key]?.paid || 0
      };
    });
  }, [payments, stats]);

  const pieData = useMemo(() => {
    let totalDebtAmount = debts.reduce((acc, d) => acc + d.amount, 0);
    let totalPaidAmount = payments.reduce((acc, p) => acc + p.amount, 0);
    let outstanding = Math.max(0, totalDebtAmount - totalPaidAmount);

    return [
      { name: 'Kimelipwa (Paid)', value: totalPaidAmount },
      { name: 'Kimebaki (Owed)', value: outstanding }
    ];
  }, [debts, payments]);

  const PIE_COLORS = ['#2563EB', '#DC2626'];

  const upcomingPayments = useMemo(() => {
    const currentDate = '2026-07-10';
    return debts
      .map(debt => {
        const debtPayments = payments.filter(p => p.debtId === debt.id);
        const paid = debtPayments.reduce((acc, p) => acc + p.amount, 0);
        const remaining = debt.amount - paid;
        const daysLeft = -getDaysDiff(currentDate, debt.dueDate);

        return {
          ...debt,
          remaining,
          daysLeft,
          customerName: customers.find(c => c.id === debt.customerId)?.fullName || 'Wateja Wasiojulikana'
        };
      })
      .filter(d => d.remaining > 0 && d.daysLeft >= 0)
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 4);
  }, [debts, payments, customers]);

  const upcomingSupplierPayments = useMemo(() => {
    const currentDate = '2026-07-10';
    return suppliers
      .map(sup => {
        const remaining = sup.amount - sup.paidAmount;
        const daysLeft = -getDaysDiff(currentDate, sup.dueDate);
        return { ...sup, remaining, daysLeft };
      })
      .filter(s => s.remaining > 0 && s.daysLeft >= 0)
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 4);
  }, [suppliers]);

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-white p-6 rounded-3xl border border-slate-100 shadow-sm gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800" id="dashboard-welcome-heading">
            Habari ya leo! 👋
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Hapa kuna muhtasari wa fedha na madeni ya biashara yako kwa leo.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Sync Status Indicator */}
          <span className={`text-xs font-mono px-3 py-1.5 rounded-full flex items-center gap-1.5 border ${
            syncStatus === 'connected' 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
              : syncStatus === 'syncing'
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}>
            <span className={`h-2 w-2 rounded-full ${
              syncStatus === 'connected' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
            }`}></span>
            {syncStatus === 'connected' ? 'Imeunganishwa' : 'Inasawazisha...'}
            {lastSyncTime && syncStatus === 'connected' && ` • ${lastSyncTime}`}
          </span>
          
          <button 
            onClick={() => setCurrentTab('reports')}
            className="text-xs font-semibold bg-accent/10 text-accent hover:bg-accent/20 transition px-4 py-2 rounded-xl flex items-center gap-1"
          >
            Ripoti <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Grid of KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Total Customers Owe Me */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ninazodai</span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <TrendingUp size={20} />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-800">TSh {stats.totalOwedByCustomers.toLocaleString()}</h3>
            <p className="text-xs text-amber-600 mt-1 font-medium flex items-center gap-1">
              <span>Jumla ya fedha zilizopo nje</span>
            </p>
          </div>
        </div>

        {/* Total Money I Owe Others */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ninazodaiwa (Wauzaji)</span>
            <span className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <TrendingDown size={20} />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-800">TSh {stats.totalOwedToSuppliers.toLocaleString()}</h3>
            <p className="text-xs text-rose-600 mt-1 font-medium">
              Deni kwa wauzaji/huduma
            </p>
          </div>
        </div>

        {/* Money Collected This Month */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Makusanyo ya Mwezi huu</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle size={20} />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-800">TSh {stats.collectedThisMonth.toLocaleString()}</h3>
            <p className="text-xs text-emerald-600 mt-1 font-medium">
              Makusanyo Julai 2026
            </p>
          </div>
        </div>

        {/* Outstanding Balance */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Salio Safi (Net Balance)</span>
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <CreditCard size={20} />
            </span>
          </div>
          <div className="mt-4">
            <h3 className={`text-2xl font-bold ${stats.outstandingBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              TSh {stats.outstandingBalance.toLocaleString()}
            </h3>
            <p className="text-xs text-indigo-500 mt-1 font-medium">
              Utofauti wa madai na madeni
            </p>
          </div>
        </div>

        {/* Due Today */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Zinazotakiwa Kulipwa Leo</span>
            <span className="p-2 rounded-xl bg-orange-50 text-orange-600">
              <Clock size={20} />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-amber-700">TSh {stats.dueTodayAmount.toLocaleString()}</h3>
            <p className="text-xs text-slate-400 mt-1">Ukomo leo tarehe 10 Julai</p>
          </div>
        </div>

        {/* Overdue Debts */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Madeni Yaliyopitiliza</span>
            <span className="p-2 rounded-xl bg-red-50 text-red-600">
              <ShieldAlert size={20} />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-rose-600">TSh {stats.overdueAmount.toLocaleString()}</h3>
            <p className="text-xs text-rose-500 mt-1 font-semibold flex items-center gap-1">
              <AlertTriangle size={12} />
              Inahitaji ufuatiliaji wa karibu
            </p>
          </div>
        </div>

        {/* Total Customers */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Wateja & Wauzaji</span>
            <span className="p-2 rounded-xl bg-sky-50 text-sky-600">
              <Users size={20} />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-800">{stats.totalCustomers} / {stats.totalSuppliers}</h3>
            <p className="text-xs text-slate-400 mt-1">Wateja na wauzaji kwenye mfumo</p>
          </div>
        </div>

        {/* Quick Action Add shortcut */}
        <div 
          className="bg-slate-900 text-white p-6 rounded-3xl hover:bg-slate-850 transition flex flex-col justify-between cursor-pointer shadow-sm" 
          onClick={() => setCurrentTab('customers')}
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Njia ya Mkato</span>
            <span className="h-8 w-8 rounded-full bg-accent flex items-center justify-center text-white font-bold text-lg">+</span>
          </div>
          <div className="mt-4">
            <h3 className="text-lg font-bold">Dhibiti Wateja</h3>
            <p className="text-xs text-accent mt-1 flex items-center gap-1">
              Sajili wateja na weka madeni <ArrowRight size={12} />
            </p>
          </div>
        </div>

      </div>

      {/* Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Collections vs Payments Bar Chart */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm lg:col-span-2">
          <h3 className="text-md font-bold text-slate-800 mb-6">Mwenendo wa Makusanyo na Malipo ya Wauzaji (TSh)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={collectionTrendData}>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `${(v/1000).toLocaleString()}k`} />
                <Tooltip formatter={(v) => `${Number(v).toLocaleString()} TSh`} />
                <Bar dataKey="Makusanyo (TSh)" fill="#2563EB" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Malipo (TSh)" fill="#D97706" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Debt Breakdown (Donut Pie) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-md font-bold text-slate-800 mb-4">Hali ya Jumla ya Madeni</h3>
            <p className="text-xs text-slate-400">Uwiano wa madeni yaliyolipwa dhidi ya yaliyobaki.</p>
          </div>
          <div className="h-44 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `${Number(v).toLocaleString()} TSh`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute text-center">
              <p className="text-xs text-slate-400">Kimelipwa</p>
              <p className="text-lg font-bold text-accent">
                {pieData[0].value > 0 ? `${Math.round((pieData[0].value / (pieData[0].value + pieData[1].value)) * 100)}%` : '0%'}
              </p>
            </div>
          </div>
          <div className="space-y-2 mt-2">
            <div className="flex items-center justify-between text-xs font-medium text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-accent"></span>
                Zilizolipwa (Collected)
              </span>
              <span>TSh {pieData[0].value.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-xs font-medium text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-danger"></span>
                Zilizosalia (Outstanding)
              </span>
              <span>TSh {pieData[1].value.toLocaleString()}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Lower Dashboard Section: Reminders, Upcoming Payments & Recent Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Dynamic Swahili Reminders / Notification Hub */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
              <Bell size={18} className="text-warning" />
              Arifu na Vikumbusho Leo
            </h3>
            <span className="text-xs font-medium text-accent hover:underline cursor-pointer" onClick={() => setCurrentTab('notifications')}>
              Fungua Zote
            </span>
          </div>

          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {unreadNotifications.length > 0 ? (
              unreadNotifications.map(item => (
                <div 
                  key={item.id} 
                  className={`p-3.5 rounded-2xl text-xs font-medium flex items-start gap-2.5 border transition ${
                    item.type === 'Overdue' ? 'bg-danger/10 border-danger/20 text-danger' :
                    item.type === 'Due Today' ? 'bg-warning/10 border-warning/20 text-warning' :
                    item.type === 'Due Tomorrow' ? 'bg-amber-50 border-amber-100 text-amber-800' :
                    item.type === 'Fully Paid' ? 'bg-success/10 border-success/20 text-success' :
                    'bg-slate-50 border-slate-100 text-slate-700'
                  }`}
                >
                  <div className="flex-1">
                    <p className="leading-relaxed">{item.message}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[10px] opacity-70">Siku: {item.date}</span>
                      {item.customerId && (
                        <button
                          onClick={() => {
                            if (setSelectedCustomerId) {
                              setSelectedCustomerId(item.customerId!);
                              setCurrentTab('customers');
                            }
                          }}
                          className="text-[10px] underline font-bold opacity-90 hover:opacity-100 ml-auto"
                        >
                          Fungua Mteja
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-400">
                <p>Hakuna arifu mpya kwa sasa 🎉</p>
              </div>
            )}
          </div>
        </div>

        {/* Upcoming payments stack */}
        <div className="space-y-6">
          {/* Upcoming due payments table (Customers) */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
                <Calendar size={18} className="text-accent" />
                Madeni ya Kulipwa Hivi Karibuni
              </h3>
              <span className="text-xs font-semibold text-accent hover:underline cursor-pointer" onClick={() => setCurrentTab('debts')}>
                Madeni Yote
              </span>
            </div>

            <div className="space-y-3.5">
              {upcomingPayments.length > 0 ? (
                upcomingPayments.map(debt => (
                  <div key={debt.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 transition border border-slate-100">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{debt.customerName}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{debt.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-800">TSh {debt.remaining.toLocaleString()}</p>
                      <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold mt-1 ${
                        debt.daysLeft === 0 ? 'bg-orange-100 text-orange-700' :
                        debt.daysLeft === 1 ? 'bg-amber-100 text-amber-700' :
                        'bg-emerald-100 text-emerald-700'
                      }`}>
                        {debt.daysLeft === 0 ? 'Leo' : debt.daysLeft === 1 ? 'Kesho' : `Siku ${debt.daysLeft} zilizobaki`}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <p>Hakuna madeni yanayotarajiwa kulipwa hivi karibuni.</p>
                </div>
              )}
            </div>
          </div>

          {/* Upcoming payments table (Suppliers) */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-md font-bold text-slate-800 flex items-center gap-2">
                <Calendar size={18} className="text-rose-500" />
                Madeni ya Kulipa Hivi Karibuni (Wauzaji)
              </h3>
              <span className="text-xs font-semibold text-accent hover:underline cursor-pointer" onClick={() => setCurrentTab('suppliers')}>
                Wauzaji Wote
              </span>
            </div>

            <div className="space-y-3.5">
              {upcomingSupplierPayments.length > 0 ? (
                upcomingSupplierPayments.map(sup => (
                  <div key={sup.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 transition border border-slate-100 cursor-pointer" onClick={() => setCurrentTab('suppliers')}>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{sup.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{sup.notes || 'Hajajaza maelezo ya ziada'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-rose-600">TSh {sup.remaining.toLocaleString()}</p>
                      <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold mt-1 ${
                        sup.daysLeft === 0 ? 'bg-rose-100 text-rose-700 font-bold' :
                        sup.daysLeft === 1 ? 'bg-amber-100 text-amber-700 font-bold' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {sup.daysLeft === 0 ? 'Leo' : sup.daysLeft === 1 ? 'Kesho' : `Siku ${sup.daysLeft} zilizobaki`}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <p>Hakuna madeni ya wauzaji yanayotarajiwa kulipwa hivi karibuni.</p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Recent Activity / Action Logs */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-md font-bold text-slate-800">Kumbukumbu ya Matendo (Transaction History)</h3>
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            <div className={`h-1.5 w-1.5 rounded-full ${syncStatus === 'connected' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></div>
            {syncStatus === 'connected' ? 'Imeunganishwa kwenye D1' : 'Inasawazisha...'}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-bold">
                <th className="py-3 px-4">Kitendo</th>
                <th className="py-3 px-4">Maelezo ya Kitendo</th>
                <th className="py-3 px-4">Kiasi (TSh)</th>
                <th className="py-3 px-4">Muda / Tarehe</th>
              </tr>
            </thead>
            <tbody>
              {transactions.slice(0, 5).map(tx => (
                <tr key={tx.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                  <td className="py-3 px-4 font-bold">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] ${
                      tx.actionType.includes('Created') || tx.actionType.includes('Added') ? 'bg-emerald-50 text-emerald-700' :
                      tx.actionType.includes('Deleted') ? 'bg-rose-50 text-rose-700' : 
                      tx.actionType.includes('Sync') ? 'bg-sky-50 text-sky-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {tx.actionType}
                    </span>
                  </td>
                  <td className="py-3 px-4">{tx.description}</td>
                  <td className="py-3 px-4 font-bold">
                    {tx.amount ? `TSh ${tx.amount.toLocaleString()}` : '-'}
                  </td>
                  <td className="py-3 px-4 text-slate-400 font-mono text-[10px]">
                    {new Date(tx.timestamp).toLocaleString('sw-TZ', { hour12: false })}
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">
                    Hakuna kumbukumbu za matendo bado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
