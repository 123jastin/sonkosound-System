/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, Plus, Phone, Calendar, 
  Trash2, CreditCard, ChevronRight, Check, X, AlertCircle, Edit2,
  ArrowLeft, History, Printer, MapPin, Loader2, Wallet,
  TrendingUp, CheckCircle2, Clock, Banknote, AlertTriangle
} from 'lucide-react';

// ============================================
// TYPES
// ============================================
interface KopeshaCustomer {
  id: string;
  full_name: string;
  phone_number: string;
  address: string;
  notes: string;
  created_at: string;
}

interface KopeshaLoan {
  id: string;
  customer_id: string;
  amount: number;              // principal
  paid_amount: number;         // running total
  lend_date: string;           // YYYY-MM-DD
  return_date: string;         // YYYY-MM-DD (deadline)
  status: string;              // 'Active' | 'Cleared'
  notes: string;
  created_at: string;
}

interface KopeshaPayment {
  id: string;
  loan_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  notes: string;
  created_at: string;
}

interface KopeshaProps {
  onUpdate?: () => void;
}

const API_BASE_URL = '/api/kopesha';

// ============================================
// HELPERS
// ============================================
const todayISO = () => new Date().toISOString().split('T')[0];

const daysUntil = (dateStr: string): number => {
  if (!dateStr) return 0;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86400000);
};

const formatDate = (s: string) => {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return s; }
};

const getInitials = (name: string) =>
  (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

// ============================================
// COMPONENT
// ============================================
export default function Kopesha({ onUpdate }: KopeshaProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [customers, setCustomers] = useState<KopeshaCustomer[]>([]);
  const [loans, setLoans] = useState<KopeshaLoan[]>([]);
  const [payments, setPayments] = useState<KopeshaPayment[]>([]);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');

  // Modals
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isEditCustomerOpen, setIsEditCustomerOpen] = useState(false);
  const [isAddLoanOpen, setIsAddLoanOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<KopeshaLoan | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyLoan, setHistoryLoan] = useState<KopeshaLoan | null>(null);

  // Form: customer
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  // Form: loan
  const [loanAmount, setLoanAmount] = useState('');
  const [lendDate, setLendDate] = useState(todayISO());
  const [returnDate, setReturnDate] = useState('');
  const [loanNotes, setLoanNotes] = useState('');

  // Form: payment
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [payNotes, setPayNotes] = useState('');

  // ============================================
  // LOAD
  // ============================================
  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(API_BASE_URL);
      const data = await res.json();
      setCustomers(data.customers || []);
      setLoans(data.loans || []);
      setPayments(data.payments || []);
    } catch {
      const cached = localStorage.getItem('kopesha_data');
      if (cached) {
        try {
          const p = JSON.parse(cached);
          setCustomers(p.customers || []);
          setLoans(p.loans || []);
          setPayments(p.payments || []);
        } catch {}
      }
    } finally {
      setIsLoading(false);
    }
  };

  const saveCache = (c: KopeshaCustomer[], l: KopeshaLoan[], p: KopeshaPayment[]) => {
    try { localStorage.setItem('kopesha_data', JSON.stringify({ customers: c, loans: l, payments: p })); } catch {}
  };

  useEffect(() => { if (customers.length || loans.length) saveCache(customers, loans, payments); },
    [customers, loans, payments]);

  // ============================================
  // COMPUTED
  // ============================================
  const activeCustomer = useMemo(
    () => customers.find(c => c.id === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  );

  const activeCustomerLoans = useMemo(() => {
    if (!selectedCustomerId) return [];
    return loans
      .filter(l => l.customer_id === selectedCustomerId)
      .sort((a, b) => new Date(b.lend_date).getTime() - new Date(a.lend_date).getTime());
  }, [loans, selectedCustomerId]);

  // Global stats
  const globalStats = useMemo(() => {
    let totalLent = 0, totalRepaid = 0, outstanding = 0, overdueCount = 0, dueSoonCount = 0;
    loans.forEach(l => {
      const remaining = Math.max(0, Number(l.amount) - Number(l.paid_amount));
      totalLent += Number(l.amount);
      totalRepaid += Number(l.paid_amount);
      outstanding += remaining;
      if (remaining > 0) {
        const d = daysUntil(l.return_date);
        if (d < 0) overdueCount++;
        else if (d <= 3) dueSoonCount++;
      }
    });
    return { totalLent, totalRepaid, outstanding, overdueCount, dueSoonCount, totalBorrowers: customers.length };
  }, [loans, customers]);

  // ============================================
  // CUSTOMER CRUD
  // ============================================
  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !phoneNumber) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, phoneNumber, address, notes })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed');
      setCustomers(prev => [result.customer, ...prev]);
    } catch {
      const fallback: KopeshaCustomer = {
        id: 'kcust-' + Date.now(),
        full_name: fullName,
        phone_number: phoneNumber,
        address, notes,
        created_at: new Date().toISOString()
      };
      setCustomers(prev => [fallback, ...prev]);
    } finally {
      setIsAddCustomerOpen(false);
      resetCustomerForm();
      setIsLoading(false);
      onUpdate?.();
    }
  };

  const handleEditCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/customers/${selectedCustomerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, phoneNumber, address, notes })
      });
      if (!res.ok) throw new Error('Failed');
    } catch {}
    setCustomers(prev => prev.map(c =>
      c.id === selectedCustomerId
        ? { ...c, full_name: fullName, phone_number: phoneNumber, address, notes }
        : c
    ));
    setIsEditCustomerOpen(false);
    setIsLoading(false);
    onUpdate?.();
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!confirm('Futa mteja huyu pamoja na mikopo yake yote?')) return;
    setIsLoading(true);
    try { await fetch(`${API_BASE_URL}/customers/${id}`, { method: 'DELETE' }); } catch {}
    setCustomers(prev => prev.filter(c => c.id !== id));
    setLoans(prev => prev.filter(l => l.customer_id !== id));
    if (selectedCustomerId === id) setSelectedCustomerId('');
    setIsLoading(false);
    onUpdate?.();
  };

  // ============================================
  // LOAN
  // ============================================
  const handleAddLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) return;
    const amt = Number(loanAmount);
    if (!amt || amt <= 0) {
      setError('Weka kiasi sahihi cha mkopo');
      setTimeout(() => setError(null), 3000);
      return;
    }
    if (!returnDate) {
      setError('Weka tarehe ya kurejesha');
      setTimeout(() => setError(null), 3000);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/loans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          amount: amt,
          paidAmount: 0,
          lendDate,
          returnDate,
          status: 'Active',
          notes: loanNotes
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed');
      setLoans(prev => [result.loan, ...prev]);
    } catch {
      const fallback: KopeshaLoan = {
        id: 'kloan-' + Date.now(),
        customer_id: selectedCustomerId,
        amount: amt,
        paid_amount: 0,
        lend_date: lendDate,
        return_date: returnDate,
        status: 'Active',
        notes: loanNotes,
        created_at: new Date().toISOString()
      };
      setLoans(prev => [fallback, ...prev]);
    } finally {
      setIsAddLoanOpen(false);
      resetLoanForm();
      setIsLoading(false);
      setSuccessMessage('Mkopo umeongezwa!');
      setTimeout(() => setSuccessMessage(null), 3000);
      onUpdate?.();
    }
  };

  // ============================================
  // PAYMENT
  // ============================================
  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;
    const amt = Number(payAmount);
    const remaining = Math.max(0, Number(selectedLoan.amount) - Number(selectedLoan.paid_amount));
    if (!amt || amt <= 0 || amt > remaining) {
      setError('Kiasi si sahihi');
      setTimeout(() => setError(null), 3000);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanId: selectedLoan.id,
          amount: amt,
          paymentDate: todayISO(),
          paymentMethod: payMethod,
          notes: payNotes || `Malipo ya mkopo`
        })
      });
      const result = await res.json();
      const newPayment: KopeshaPayment = result.payment || {
        id: 'kpay-' + Date.now(),
        loan_id: selectedLoan.id,
        amount: amt,
        payment_date: todayISO(),
        payment_method: payMethod,
        notes: payNotes || 'Malipo ya mkopo',
        created_at: new Date().toISOString()
      };
      setPayments(prev => [newPayment, ...prev]);
    } catch {
      setPayments(prev => [{
        id: 'kpay-' + Date.now(),
        loan_id: selectedLoan.id,
        amount: amt,
        payment_date: todayISO(),
        payment_method: payMethod,
        notes: payNotes || 'Malipo ya mkopo',
        created_at: new Date().toISOString()
      }, ...prev]);
    }

    // Update loan locally
    setLoans(prev => prev.map(l => {
      if (l.id !== selectedLoan.id) return l;
      const newPaid = Number(l.paid_amount) + amt;
      return {
        ...l,
        paid_amount: newPaid,
        status: newPaid >= Number(l.amount) ? 'Cleared' : 'Active'
      };
    }));

    setIsPayModalOpen(false);
    resetPaymentForm();
    setIsLoading(false);
    setSuccessMessage('Malipo yamerekodiwa!');
    setTimeout(() => setSuccessMessage(null), 3000);
    onUpdate?.();
  };

  // ============================================
  // FORM RESETS
  // ============================================
  const resetCustomerForm = () => { setFullName(''); setPhoneNumber(''); setAddress(''); setNotes(''); };
  const resetLoanForm = () => { setLoanAmount(''); setLendDate(todayISO()); setReturnDate(''); setLoanNotes(''); };
  const resetPaymentForm = () => { setPayAmount(''); setPayNotes(''); };

  const openEditCustomer = () => {
    if (!activeCustomer) return;
    setFullName(activeCustomer.full_name);
    setPhoneNumber(activeCustomer.phone_number);
    setAddress(activeCustomer.address);
    setNotes(activeCustomer.notes);
    setIsEditCustomerOpen(true);
  };

  const openPay = (loan: KopeshaLoan) => {
    setSelectedLoan(loan);
    setPayAmount('');
    setPayNotes('');
    setIsPayModalOpen(true);
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-rose-700 text-xs">
            <AlertCircle size={16} /><span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700"><X size={16} /></button>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-2 text-emerald-700 text-xs">
          <Check size={16} /><span>{successMessage}</span>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center gap-2 text-xs text-slate-400 py-2">
          <Loader2 size={14} className="animate-spin" />
          <span>Inasasisha...</span>
        </div>
      )}

      {activeCustomer ? (
        /* ============================================ */
        /* CUSTOMER DETAIL VIEW                          */
        /* ============================================ */
        <div className="space-y-6 text-xs text-left">
          <div className="bg-white rounded-3xl border border-slate-100 p-6 md:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSelectedCustomerId('')}
                  className="p-2.5 hover:bg-slate-50 text-slate-500 hover:text-slate-700 rounded-2xl border border-slate-100"
                >
                  <ArrowLeft size={16} />
                </button>
                <div className="h-16 w-16 rounded-2xl bg-amber-100 text-amber-800 font-extrabold text-xl flex items-center justify-center shadow-sm">
                  {getInitials(activeCustomer.full_name)}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">{activeCustomer.full_name}</h3>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                    <Phone size={12} /> {activeCustomer.phone_number}
                  </p>
                  {activeCustomer.address && (
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <MapPin size={12} /> {activeCustomer.address}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={openEditCustomer} className="py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold flex items-center gap-1.5">
                  <Edit2 size={14} /> Hariri
                </button>
                <button onClick={() => handleDeleteCustomer(activeCustomer.id)} className="py-2.5 px-4 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-600 font-bold flex items-center gap-1.5">
                  <Trash2 size={14} /> Futa
                </button>
                <button onClick={() => setSelectedCustomerId('')} className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold">
                  Orodha
                </button>
              </div>
            </div>

            {/* Summary strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
              <div className="text-center">
                <p className="text-xs text-slate-400">Mikopo Yote</p>
                <p className="text-lg font-bold text-slate-800">{activeCustomerLoans.length}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400">Jumla Iliyokopeshwa</p>
                <p className="text-lg font-bold text-slate-800">
                  TSh {activeCustomerLoans.reduce((s, l) => s + Number(l.amount), 0).toLocaleString()}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400">Iliyorejeshwa</p>
                <p className="text-lg font-bold text-emerald-600">
                  TSh {activeCustomerLoans.reduce((s, l) => s + Number(l.paid_amount), 0).toLocaleString()}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400">Baki</p>
                <p className="text-lg font-bold text-rose-600">
                  TSh {activeCustomerLoans.reduce((s, l) => s + Math.max(0, Number(l.amount) - Number(l.paid_amount)), 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => { resetLoanForm(); setIsAddLoanOpen(true); }}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 px-5 rounded-xl flex items-center gap-2 shadow-sm"
            >
              <Plus size={16} /> Kopesha Mpya
            </button>
          </div>

          {/* Loans list */}
          <div className="space-y-4">
            {activeCustomerLoans.map(loan => {
              const remaining = Math.max(0, Number(loan.amount) - Number(loan.paid_amount));
              const isCleared = remaining <= 0;
              const days = daysUntil(loan.return_date);
              const isOverdue = !isCleared && days < 0;
              const isDueSoon = !isCleared && days >= 0 && days <= 3;
              const progress = Number(loan.amount) > 0
                ? Math.min(100, (Number(loan.paid_amount) / Number(loan.amount)) * 100)
                : 0;

              return (
                <div
                  key={loan.id}
                  className={`bg-white rounded-3xl border p-6 shadow-sm ${
                    isCleared ? 'border-emerald-200'
                    : isOverdue ? 'border-rose-200'
                    : isDueSoon ? 'border-amber-200'
                    : 'border-slate-100'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-xl ${
                          isCleared ? 'bg-emerald-50 text-emerald-600'
                          : isOverdue ? 'bg-rose-50 text-rose-600'
                          : 'bg-amber-50 text-amber-600'
                        }`}>
                          {isCleared ? <CheckCircle2 size={20} /> : <Banknote size={20} />}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-800">
                            Mkopo wa TSh {Number(loan.amount).toLocaleString()}
                          </h4>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {loan.notes || 'Hakuna maelezo'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-[10px] text-slate-400 font-semibold uppercase">Kiasi</p>
                          <p className="text-sm font-bold text-slate-800 mt-1">TSh {Number(loan.amount).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-semibold uppercase">Imerejeshwa</p>
                          <p className="text-sm font-bold text-emerald-600 mt-1">TSh {Number(loan.paid_amount).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-semibold uppercase">Baki</p>
                          <p className="text-sm font-bold text-rose-600 mt-1">TSh {remaining.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-semibold uppercase">Deadline</p>
                          <p className={`text-sm font-bold mt-1 ${isOverdue ? 'text-rose-600' : isDueSoon ? 'text-amber-600' : 'text-slate-800'}`}>
                            {formatDate(loan.return_date)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-2 text-[10px] flex-wrap">
                        <span className="text-slate-400">
                          <Calendar size={10} /> Ilikopeshwa: {formatDate(loan.lend_date)}
                        </span>
                        {isOverdue && (
                          <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                            <AlertTriangle size={9} /> Imechelewa siku {Math.abs(days)}
                          </span>
                        )}
                        {isDueSoon && (
                          <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                            <Clock size={9} /> Siku {days} zimebaki
                          </span>
                        )}
                        {isCleared && (
                          <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                            <CheckCircle2 size={9} /> Imekamilika
                          </span>
                        )}
                      </div>

                      <div className="mt-4">
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-slate-400">Maendeleo ya Kurejesha</span>
                          <span className="font-bold text-slate-700">{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isCleared ? 'bg-emerald-500' : 'bg-amber-500'}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex md:flex-col gap-2">
                      {!isCleared && (
                        <button
                          onClick={() => openPay(loan)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl flex items-center gap-1.5 text-xs"
                        >
                          <CreditCard size={14} /> Rejesha
                        </button>
                      )}
                      <button
                        onClick={() => { setHistoryLoan(loan); setIsHistoryOpen(true); }}
                        className="border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold py-2 px-4 rounded-xl flex items-center gap-1.5 text-xs"
                      >
                        <History size={14} /> Historia
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {activeCustomerLoans.length === 0 && (
              <div className="bg-white p-12 text-center rounded-3xl border border-slate-100 shadow-sm text-slate-400">
                <Wallet size={40} className="mx-auto text-slate-300 mb-3" />
                <p className="text-sm font-semibold">Hakuna mkopo bado.</p>
                <p className="text-xs mt-1">Ongeza mkopo wa kwanza kwa kutumia "Kopesha Mpya".</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ============================================ */
        /* LIST VIEW                                     */
        /* ============================================ */
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Jumla Iliyokopeshwa</span>
              <h3 className="text-2xl font-black text-slate-800 mt-2">TSh {globalStats.totalLent.toLocaleString()}</h3>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Iliyorejeshwa</span>
              <h3 className="text-2xl font-black text-emerald-600 mt-2">TSh {globalStats.totalRepaid.toLocaleString()}</h3>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Baki ya Mikopo</span>
              <h3 className="text-2xl font-black text-rose-600 mt-2">TSh {globalStats.outstanding.toLocaleString()}</h3>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Waliochelewa</span>
              <h3 className="text-2xl font-black text-amber-600 mt-2">{globalStats.overdueCount}</h3>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-white p-5 rounded-3xl border border-slate-100 shadow-sm gap-4">
            <div>
              <h2 className="text-md font-bold text-slate-800">Kopesha (Mikopo)</h2>
              <p className="text-xs text-slate-400 mt-1">Dhibiti wateja wanaokopeshwa na tarehe za kurejesha.</p>
            </div>
            <button
              onClick={() => { resetCustomerForm(); setIsAddCustomerOpen(true); }}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5 shadow-sm"
            >
              <Plus size={15} /> Ongeza Mkopaji
            </button>
          </div>

          {/* Customer cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {customers.length > 0 ? customers.map(customer => {
              const cLoans = loans.filter(l => l.customer_id === customer.id);
              const totalLent = cLoans.reduce((s, l) => s + Number(l.amount), 0);
              const totalPaid = cLoans.reduce((s, l) => s + Number(l.paid_amount), 0);
              const remaining = Math.max(0, totalLent - totalPaid);
              const activeLoans = cLoans.filter(l => Number(l.paid_amount) < Number(l.amount));
              const overdue = activeLoans.filter(l => daysUntil(l.return_date) < 0).length;
              const nextDue = activeLoans
                .map(l => l.return_date)
                .filter(Boolean)
                .sort()[0];

              return (
                <div
                  key={customer.id}
                  onClick={() => setSelectedCustomerId(customer.id)}
                  className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm hover:shadow-md hover:border-slate-300 cursor-pointer transition flex flex-col justify-between space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-amber-100 text-amber-800 font-bold flex items-center justify-center">
                        {getInitials(customer.full_name)}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">{customer.full_name}</h3>
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                          <Phone size={12} /> {customer.phone_number}
                        </p>
                      </div>
                    </div>
                    {overdue > 0 ? (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 flex items-center gap-1">
                        <AlertTriangle size={9} /> {overdue} Overdue
                      </span>
                    ) : activeLoans.length > 0 ? (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        {activeLoans.length} Active
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
                        {cLoans.length ? 'Cleared' : 'Mpya'}
                      </span>
                    )}
                  </div>

                  {cLoans.length > 0 && (
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Ilikopeshwa:</span>
                        <span className="font-bold text-slate-700">TSh {totalLent.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Imerejeshwa:</span>
                        <span className="font-bold text-emerald-600">TSh {totalPaid.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-200/50 pt-1.5">
                        <span className="text-slate-400">Baki:</span>
                        <span className="font-bold text-rose-600">TSh {remaining.toLocaleString()}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between border-t border-slate-50 pt-3">
                    <p className="text-[10px] text-slate-400 font-mono">
                      {nextDue ? <>📅 Deadline: {formatDate(nextDue)}</> : '—'}
                    </p>
                    <span className="text-[10px] font-semibold text-amber-600 flex items-center gap-0.5">
                      Fungua <ChevronRight size={12} />
                    </span>
                  </div>
                </div>
              );
            }) : (
              <div className="col-span-full bg-white p-12 text-center rounded-3xl border border-slate-100 shadow-sm text-slate-400">
                <Users size={40} className="mx-auto text-slate-300 mb-3" />
                <p className="text-sm font-semibold">Hakuna wakopaji bado.</p>
                <p className="text-xs mt-1">Bonyeza "Ongeza Mkopaji" kuanza.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ============================================ */}
      {/* ADD CUSTOMER MODAL                            */}
      {/* ============================================ */}
      {isAddCustomerOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <button onClick={() => setIsAddCustomerOpen(false)} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50">
              <X size={18} />
            </button>
            <h3 className="text-md font-bold text-slate-800">Ongeza Mkopaji</h3>
            <form onSubmit={handleAddCustomer} className="space-y-4 text-xs text-left">
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Jina Kamili *</label>
                <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Mfano: Juma Kassim" className="w-full p-2.5 border border-slate-200 rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Namba ya Simu *</label>
                  <input type="tel" required value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="0712345678" className="w-full p-2.5 border border-slate-200 rounded-xl" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Anuani</label>
                  <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Mtaa, Jiji" className="w-full p-2.5 border border-slate-200 rounded-xl" />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Maelezo</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Maelezo ya ziada..." className="w-full p-2.5 border border-slate-200 rounded-xl h-20" />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsAddCustomerOpen(false)} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600">Ghairi</button>
                <button type="submit" disabled={isLoading} className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold flex items-center gap-2 disabled:opacity-50">
                  {isLoading ? <><Loader2 size={14} className="animate-spin" /> Inasajili...</> : 'Sajili'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* EDIT CUSTOMER MODAL                           */}
      {/* ============================================ */}
      {isEditCustomerOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <button onClick={() => setIsEditCustomerOpen(false)} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50">
              <X size={18} />
            </button>
            <h3 className="text-md font-bold text-slate-800">Hariri Mkopaji</h3>
            <form onSubmit={handleEditCustomer} className="space-y-4 text-xs text-left">
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Jina Kamili *</label>
                <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Namba ya Simu *</label>
                  <input type="tel" required value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Anuani</label>
                  <input type="text" value={address} onChange={e => setAddress(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl" />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Maelezo</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl h-20" />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsEditCustomerOpen(false)} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600">Ghairi</button>
                <button type="submit" disabled={isLoading} className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold disabled:opacity-50">
                  Hifadhi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* ADD LOAN MODAL                                */}
      {/* ============================================ */}
      {isAddLoanOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <button onClick={() => setIsAddLoanOpen(false)} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50">
              <X size={18} />
            </button>
            <h3 className="text-md font-bold text-slate-800">Kopesha</h3>
            <p className="text-xs text-slate-400">Mkopaji: {activeCustomer?.full_name}</p>
            <form onSubmit={handleAddLoan} className="space-y-4 text-xs text-left">
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Kiasi (TSh) *</label>
                <input type="number" required min="1" value={loanAmount} onChange={e => setLoanAmount(e.target.value)} placeholder="50000" className="w-full p-2.5 border border-slate-200 rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Tarehe ya Kukopesha *</label>
                  <input type="date" required value={lendDate} onChange={e => setLendDate(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Tarehe ya Kurejesha *</label>
                  <input type="date" required value={returnDate} onChange={e => setReturnDate(e.target.value)} min={lendDate} className="w-full p-2.5 border border-slate-200 rounded-xl" />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Maelezo</label>
                <textarea value={loanNotes} onChange={e => setLoanNotes(e.target.value)} placeholder="Sababu au maelezo ya mkopo..." className="w-full p-2.5 border border-slate-200 rounded-xl h-20" />
              </div>
              <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200 text-[11px] text-amber-800">
                <strong>Kumbuka:</strong> Hakikisha umeandika deadline sahihi. Mkopo utaonekana kwenye orodha ya mikopo yote.
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsAddLoanOpen(false)} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600">Ghairi</button>
                <button type="submit" disabled={isLoading} className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold flex items-center gap-2 disabled:opacity-50">
                  {isLoading ? <><Loader2 size={14} className="animate-spin" /> Inahifadhi...</> : 'Hifadhi Mkopo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* PAY MODAL                                     */}
      {/* ============================================ */}
      {isPayModalOpen && selectedLoan && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <button onClick={() => setIsPayModalOpen(false)} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50">
              <X size={18} />
            </button>
            <h3 className="text-md font-bold text-slate-800">Rekodi Kurejesha</h3>
            <p className="text-xs text-slate-400">{activeCustomer?.full_name}</p>
            <form onSubmit={handlePay} className="space-y-4 text-xs text-left">
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Kiasi (TSh) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  max={Math.max(0, Number(selectedLoan.amount) - Number(selectedLoan.paid_amount))}
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  placeholder={`Baki: TSh ${Math.max(0, Number(selectedLoan.amount) - Number(selectedLoan.paid_amount)).toLocaleString()}`}
                  className="w-full p-2.5 border border-slate-200 rounded-xl"
                />
              </div>
              <div className="flex gap-2">
                {(() => {
                  const remaining = Math.max(0, Number(selectedLoan.amount) - Number(selectedLoan.paid_amount));
                  const amounts = [Math.min(10000, remaining), Math.min(20000, remaining), remaining].filter((v, i, a) => v > 0 && a.indexOf(v) === i);
                  return amounts.map(amount => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setPayAmount(amount.toString())}
                      className={`flex-1 py-2 px-2 rounded-xl text-[10px] font-bold border transition ${
                        payAmount === amount.toString()
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      TSh {amount >= 1000 ? `${(amount / 1000).toFixed(0)}k` : amount}
                    </button>
                  ));
                })()}
              </div>
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Njia</label>
                <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl bg-white">
                  <option>Cash</option>
                  <option>M-Pesa</option>
                  <option>Tigo Pesa</option>
                  <option>Airtel Money</option>
                  <option>HaloPesa</option>
                  <option>Bank Transfer</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Maelezo</label>
                <input type="text" value={payNotes} onChange={e => setPayNotes(e.target.value)} placeholder="Risiti au kumbukumbu..." className="w-full p-2.5 border border-slate-200 rounded-xl" />
              </div>
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Kiasi cha Mkopo:</span>
                  <span className="font-bold text-slate-700">TSh {Number(selectedLoan.amount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Imerejeshwa:</span>
                  <span className="font-bold text-emerald-600">TSh {Number(selectedLoan.paid_amount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[11px] border-t border-slate-200 pt-1.5">
                  <span className="text-slate-400">Baki Baada:</span>
                  <span className="font-bold text-rose-600">
                    TSh {Math.max(0, Number(selectedLoan.amount) - Number(selectedLoan.paid_amount) - Number(payAmount || 0)).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsPayModalOpen(false)} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600">Ghairi</button>
                <button type="submit" disabled={isLoading || !payAmount || Number(payAmount) <= 0} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold flex items-center gap-2 disabled:opacity-50">
                  {isLoading ? <><Loader2 size={14} className="animate-spin" /> Inarekodi...</> : 'Hifadhi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* HISTORY MODAL                                 */}
      {/* ============================================ */}
      {isHistoryOpen && historyLoan && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <button onClick={() => setIsHistoryOpen(false)} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50">
              <X size={18} />
            </button>
            <h3 className="text-md font-bold text-slate-800">Historia ya Kurejesha</h3>
            <p className="text-xs text-slate-400">
              Mkopo wa TSh {Number(historyLoan.amount).toLocaleString()}
            </p>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {payments.filter(p => p.loan_id === historyLoan.id).map(payment => (
                <div key={payment.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div>
                    <p className="text-xs font-bold text-slate-800">{payment.notes}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{formatDate(payment.payment_date)} • {payment.payment_method}</p>
                  </div>
                  <span className="text-sm font-extrabold text-emerald-600">
                    TSh {Number(payment.amount).toLocaleString()}
                  </span>
                </div>
              ))}
              {payments.filter(p => p.loan_id === historyLoan.id).length === 0 && (
                <p className="text-xs text-slate-400 text-center py-8">Hakuna malipo bado.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
