/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Users, Plus, Phone, Calendar, 
  Trash2, CreditCard, ChevronRight, Check, X, AlertCircle, Edit2,
  ArrowLeft, History, Printer, MapPin, Loader2, Wallet,
  TrendingUp, CheckCircle2, Clock, Banknote, AlertTriangle,
  Globe2, ArrowDownRight, ArrowUpRight, Coins, Sparkles
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
  amount: number;
  paid_amount: number;
  lend_date: string;
  return_date: string;
  status: string;
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

interface KubandikaPayment {
  id: string;
  region: 'Tz' | 'China';
  type: 'IN' | 'OUT';
  amount: number;
  date: string;
}

interface KopeshaProps {
  onUpdate?: () => void;
  userRole?: 'admin' | 'staff' | null;
}

const API_BASE_URL = '/api/kopesha';
const KUBANDIKA_API = '/api/kubandika';

// ============================================
// CONSTANTS
// ============================================
const LOGO_URL = 'https://pics.sonkosound.store/file_0000000018a881f4bef28aaff0866bbd.png';

const BUSINESS = {
  name: 'Sonko Sound',
  slogan: 'Electronics & Appliances',
  address: 'Morogoro, Tanzania',
  phone: '0688423753',
};

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
export default function Kopesha({ onUpdate, userRole }: KopeshaProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [customers, setCustomers] = useState<KopeshaCustomer[]>([]);
  const [loans, setLoans] = useState<KopeshaLoan[]>([]);
  const [payments, setPayments] = useState<KopeshaPayment[]>([]);
  const [chinaBalance, setChinaBalance] = useState<number>(0);

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
  const loadChinaBalance = useCallback(async () => {
    try {
      const res = await fetch(KUBANDIKA_API);
      const data = await res.json();
      const list: KubandikaPayment[] = Array.isArray(data) ? data : (data?.payments || []);
      
      let inSum = 0, outSum = 0;
      list.forEach(p => {
        if (p.region !== 'China') return;
        const t = p.type || 'IN';
        if (t === 'IN') inSum += Number(p.amount) || 0;
        else outSum += Number(p.amount) || 0;
      });
      setChinaBalance(inSum - outSum);
    } catch (err) {
      console.error('Failed to load China balance:', err);
    }
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [kopeshaRes] = await Promise.all([
        fetch(API_BASE_URL),
        loadChinaBalance(),
      ]);
      const data = await kopeshaRes.json();
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

  useEffect(() => { loadData(); }, []);

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

  const globalStats = useMemo(() => {
    let totalLent = 0, totalRepaid = 0, outstanding = 0, overdueCount = 0;
    loans.forEach(l => {
      const remaining = Math.max(0, Number(l.amount) - Number(l.paid_amount));
      totalLent += Number(l.amount);
      totalRepaid += Number(l.paid_amount);
      outstanding += remaining;
      if (remaining > 0 && daysUntil(l.return_date) < 0) overdueCount++;
    });
    return { totalLent, totalRepaid, outstanding, overdueCount, totalBorrowers: customers.length };
  }, [loans, customers]);

  // ============================================
  // SMS
  // ============================================
  const sendKopeshaSMS = async (payload: any) => {
    try {
      const res = await fetch('/api/kopesha-send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (err) {
      console.error('SMS error:', err);
      return { success: false };
    }
  };

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
    if (userRole !== 'admin') {
      setError('Huna ruhusa ya kufuta. Wasiliana na Admin.');
      setTimeout(() => setError(null), 3000);
      return;
    }
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
    if (amt > chinaBalance) {
      setError(`Salio la China halitoshi. Lililopo: TSh ${chinaBalance.toLocaleString()}, unahitaji: TSh ${amt.toLocaleString()}`);
      setTimeout(() => setError(null), 5000);
      return;
    }
    setIsLoading(true);

    let createdLoan: KopeshaLoan | null = null;

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
      createdLoan = result.loan;
      setLoans(prev => [result.loan, ...prev]);
      await loadChinaBalance();
    } catch (err: any) {
      setError(err.message || 'Imeshindwa kukopesha');
      setTimeout(() => setError(null), 5000);
      setIsLoading(false);
      return;
    }

    if (createdLoan && activeCustomer) {
      await sendKopeshaSMS({
        event: 'loan_created',
        customerName: activeCustomer.full_name,
        customerPhone: activeCustomer.phone_number,
        amount: amt,
        returnDate,
      });
    }

    setIsAddLoanOpen(false);
    resetLoanForm();
    setIsLoading(false);
    setSuccessMessage(`Mkopo wa TSh ${amt.toLocaleString()} umetolewa kutoka China!`);
    setTimeout(() => setSuccessMessage(null), 4000);
    onUpdate?.();
  };

  // ============================================
  // PAYMENT
  // ============================================
  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;

    if (userRole !== 'admin') {
      setError('Huna ruhusa ya kurekodi malipo. Wasiliana na Admin.');
      setTimeout(() => setError(null), 3000);
      return;
    }

    const amt = Number(payAmount);
    const remainingBefore = Math.max(0, Number(selectedLoan.amount) - Number(selectedLoan.paid_amount));
    if (!amt || amt <= 0 || amt > remainingBefore) {
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
      if (!res.ok) throw new Error(result.error || 'Failed');
      
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
      await loadChinaBalance();
    } catch (err: any) {
      setError(err.message || 'Imeshindwa kurekodi malipo');
      setTimeout(() => setError(null), 5000);
      setIsLoading(false);
      return;
    }

    const newPaid = Number(selectedLoan.paid_amount) + amt;
    const remainingAfter = Math.max(0, Number(selectedLoan.amount) - newPaid);
    const isCompleted = remainingAfter <= 0;

    setLoans(prev => prev.map(l =>
      l.id === selectedLoan.id
        ? { ...l, paid_amount: newPaid, status: isCompleted ? 'Cleared' : 'Active' }
        : l
    ));

    if (activeCustomer) {
      await sendKopeshaSMS({
        event: 'loan_paid',
        customerName: activeCustomer.full_name,
        customerPhone: activeCustomer.phone_number,
        paidAmount: amt,
        remaining: remainingAfter,
        isCompleted,
      });
    }

    setIsPayModalOpen(false);
    resetPaymentForm();
    setIsLoading(false);
    setSuccessMessage(
      isCompleted
        ? `Malipo ya TSh ${amt.toLocaleString()} yamerejeshwa China! Mkopo umekamilika.`
        : `Malipo ya TSh ${amt.toLocaleString()} yamerejeshwa China!`
    );
    setTimeout(() => setSuccessMessage(null), 4000);
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
    if (userRole !== 'admin') {
      setError('Huna ruhusa ya kurekodi malipo. Wasiliana na Admin.');
      setTimeout(() => setError(null), 3000);
      return;
    }
    setSelectedLoan(loan);
    setPayAmount('');
    setPayNotes('');
    setIsPayModalOpen(true);
  };

  // ============================================
  // PRINT
  // ============================================
  const handlePrintStatement = () => {
    if (!activeCustomer) return;
    const now = new Date();
    const statementId = `KPS-${Date.now().toString(36).toUpperCase()}`;
    const totalLent = activeCustomerLoans.reduce((s, l) => s + Number(l.amount), 0);
    const totalPaid = activeCustomerLoans.reduce((s, l) => s + Number(l.paid_amount), 0);
    const totalRemaining = Math.max(0, totalLent - totalPaid);
    const allCustomerPayments = payments.filter(p =>
      activeCustomerLoans.some(l => l.id === p.loan_id)
    ).sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());

    const htmlContent = `<!DOCTYPE html>
<html><head><title>Taarifa ya Mikopo - ${activeCustomer.full_name}</title><meta charset="UTF-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
@page { size: A4; margin: 12mm; }
body { font-family: 'Segoe UI', Tahoma, sans-serif; background: white; color: #1e293b; padding: 20px; }
.container { max-width: 190mm; margin: 0 auto; }
.header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; background: linear-gradient(135deg, #0f766e 0%, #059669 50%, #10b981 100%); color: white; border-radius: 12px; margin-bottom: 24px; gap: 20px; }
.header-left { display: flex; align-items: center; gap: 16px; }
.logo-box { width: 70px; height: 70px; border-radius: 14px; background: white; display: flex; align-items: center; justify-content: center; padding: 6px; box-shadow: 0 4px 15px rgba(0,0,0,0.15); flex-shrink: 0; overflow: hidden; }
.logo-box img { width: 100%; height: 100%; object-fit: contain; }
.business-name { font-size: 22px; font-weight: 900; letter-spacing: 1px; }
.business-slogan { font-size: 11px; opacity: 0.9; margin-top: 4px; }
.business-contact { font-size: 10px; opacity: 0.85; margin-top: 3px; }
.statement-badge { display: inline-block; background: rgba(255,255,255,0.25); padding: 6px 14px; border-radius: 20px; font-size: 10px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; }
.statement-id { font-size: 10px; opacity: 0.85; margin-top: 8px; font-family: monospace; }
.section { margin-bottom: 22px; }
.section-title { font-size: 13px; font-weight: 800; color: #065f46; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid #6ee7b7; }
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 16px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; }
.info-card { display: flex; flex-direction: column; gap: 3px; }
.info-label { font-size: 9px; font-weight: 800; text-transform: uppercase; color: #047857; letter-spacing: 0.5px; }
.info-value { font-size: 13px; font-weight: bold; color: #1e293b; }
.stat-strip { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 20px; }
.stat-item { border-radius: 12px; padding: 14px; text-align: center; }
.stat-item.lent { background: #d1fae5; border: 1px solid #6ee7b7; }
.stat-item.paid { background: #ede9fe; border: 1px solid #c4b5fd; }
.stat-item.balance { background: #fee2e2; border: 1px solid #fca5a5; }
.stat-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
.stat-item.lent .stat-label { color: #065f46; }
.stat-item.paid .stat-label { color: #5b21b6; }
.stat-item.balance .stat-label { color: #991b1b; }
.stat-value { font-size: 18px; font-weight: 900; }
.stat-item.lent .stat-value { color: #047857; }
.stat-item.paid .stat-value { color: #7c3aed; }
.stat-item.balance .stat-value { color: #dc2626; }
table { width: 100%; border-collapse: collapse; background: white; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; }
thead th { background: linear-gradient(135deg, #0f766e 0%, #059669 100%); color: white; padding: 10px 12px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 800; }
thead th:last-child { text-align: right; }
tbody td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 11px; color: #334155; }
tbody td:last-child { text-align: right; font-weight: bold; }
tbody tr:nth-child(even) { background: #ecfdf5; }
.empty-row { text-align: center !important; padding: 20px !important; color: #94a3b8; font-style: italic; }
.payment-amount { color: #059669; font-weight: bold; }
.status-badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 9px; font-weight: 800; text-transform: uppercase; }
.status-cleared { background: #d1fae5; color: #065f46; }
.status-active { background: #fef3c7; color: #92400e; }
.status-overdue { background: #fee2e2; color: #991b1b; }
.signatures { display: flex; justify-content: space-between; gap: 40px; margin-top: 50px; padding: 0 20px; }
.signature-box { flex: 1; text-align: center; }
.signature-line { border-top: 1.5px solid #0f766e; padding-top: 8px; font-size: 11px; font-weight: bold; color: #0f766e; }
.signature-sub { font-size: 9px; color: #94a3b8; margin-top: 3px; }
.footer { margin-top: 30px; padding: 14px; background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 10px; text-align: center; font-size: 10px; color: #065f46; border: 1px solid #a7f3d0; }
.footer strong { color: #065f46; }
.no-print { text-align: center; padding: 20px; margin-top: 10px; }
.no-print button { background: #059669; color: white; border: none; padding: 12px 28px; border-radius: 22px; font-size: 13px; font-weight: bold; cursor: pointer; margin: 0 5px; }
.no-print button.close { background: #64748b; }
@media print { .no-print { display: none !important; } body { padding: 0; } }
</style></head><body>
<div class="container">
<div class="header">
<div class="header-left">
<div class="logo-box"><img src="${LOGO_URL}" alt="Logo" /></div>
<div>
<div class="business-name">${BUSINESS.name.toUpperCase()}</div>
<div class="business-slogan">${BUSINESS.slogan}</div>
<div class="business-contact">${BUSINESS.address} • ${BUSINESS.phone}</div>
</div></div>
<div style="text-align: right;">
<div class="statement-badge">Taarifa ya Mikopo</div>
<div class="statement-id">${statementId}</div>
</div></div>

<div class="section">
<div class="section-title">Taarifa za Mkopaji</div>
<div class="info-grid">
<div class="info-card"><span class="info-label">Jina Kamili</span><span class="info-value">${activeCustomer.full_name}</span></div>
<div class="info-card"><span class="info-label">Namba ya Simu</span><span class="info-value">${activeCustomer.phone_number}</span></div>
<div class="info-card"><span class="info-label">Anuani</span><span class="info-value">${activeCustomer.address || '—'}</span></div>
<div class="info-card"><span class="info-label">Tarehe ya Taarifa</span><span class="info-value">${now.toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
</div>
<div class="stat-strip">
<div class="stat-item lent"><div class="stat-label">Jumla Iliyokopeshwa</div><div class="stat-value">TSh ${totalLent.toLocaleString()}</div></div>
<div class="stat-item paid"><div class="stat-label">Iliyorejeshwa</div><div class="stat-value">TSh ${totalPaid.toLocaleString()}</div></div>
<div class="stat-item balance"><div class="stat-label">Baki</div><div class="stat-value">TSh ${totalRemaining.toLocaleString()}</div></div>
</div></div>

<div class="section">
<div class="section-title">Historia ya Mikopo (${activeCustomerLoans.length})</div>
<table><thead><tr><th>Mkopo #</th><th>Tarehe</th><th>Deadline</th><th>Kiasi</th><th>Imerejeshwa</th><th>Baki</th><th>Hali</th></tr></thead>
<tbody>${activeCustomerLoans.length > 0
  ? activeCustomerLoans.map((loan, idx) => {
      const remaining = Math.max(0, Number(loan.amount) - Number(loan.paid_amount));
      const isCleared = remaining <= 0;
      const isOverdue = !isCleared && daysUntil(loan.return_date) < 0;
      const statusClass = isCleared ? 'status-cleared' : isOverdue ? 'status-overdue' : 'status-active';
      const statusText = isCleared ? 'Imekamilika' : isOverdue ? 'Imechelewa' : 'Inaendelea';
      return `<tr><td>#${idx + 1}</td><td>${formatDate(loan.lend_date)}</td><td>${formatDate(loan.return_date)}</td><td>TSh ${Number(loan.amount).toLocaleString()}</td><td class="payment-amount">TSh ${Number(loan.paid_amount).toLocaleString()}</td><td style="color:#dc2626;font-weight:bold;">TSh ${remaining.toLocaleString()}</td><td><span class="status-badge ${statusClass}">${statusText}</span></td></tr>`;
    }).join('')
  : '<tr><td colspan="7" class="empty-row">Hakuna mikopo bado</td></tr>'}</tbody></table></div>

<div class="section">
<div class="section-title">Historia ya Marejesho (${allCustomerPayments.length})</div>
<table><thead><tr><th>Tarehe</th><th>Mkopo #</th><th>Njia</th><th>Maelezo</th><th>Kiasi</th></tr></thead>
<tbody>${allCustomerPayments.length > 0
  ? allCustomerPayments.map(pay => {
      const loanIdx = activeCustomerLoans.findIndex(l => l.id === pay.loan_id) + 1;
      return `<tr><td>${formatDate(pay.payment_date)}</td><td>#${loanIdx}</td><td>${pay.payment_method}</td><td>${pay.notes || 'Malipo'}</td><td class="payment-amount">TSh ${Number(pay.amount).toLocaleString()}</td></tr>`;
    }).join('')
  : '<tr><td colspan="5" class="empty-row">Hakuna marejesho bado</td></tr>'}</tbody></table></div>

<div class="signatures">
<div class="signature-box"><div class="signature-line">Sahihi ya Mmiliki</div><div class="signature-sub">${BUSINESS.name}</div></div>
<div class="signature-box"><div class="signature-line">Sahihi ya Mkopaji</div><div class="signature-sub">${activeCustomer.full_name}</div></div>
</div>

<div class="footer">
<strong>${BUSINESS.name}</strong> • ${BUSINESS.address} • ${BUSINESS.phone}<br>
Taarifa hii ilitengenezwa ${now.toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })} saa ${now.toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' })}
</div>

<div class="no-print">
<button onclick="window.print()">🖨️ Chapisha / Save as PDF</button>
<button class="close" onclick="window.close()">Funga</button>
</div>
</div>
<script>window.onload = function() { setTimeout(function() { window.print(); }, 400); };</script>
</body></html>`;

    const printWindow = window.open('', '_blank', 'width=900,height=800');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    } else {
      alert('Tafadhali ruhusu pop-ups kwa ajili ya kuchapisha');
    }
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2 text-rose-700 text-xs">
            <AlertCircle size={16} /><span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700"><X size={16} /></button>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-2 text-emerald-700 text-xs animate-fade-in">
          <Sparkles size={16} /><span>{successMessage}</span>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center gap-2 text-xs text-slate-400 py-2">
          <Loader2 size={14} className="animate-spin" />
          <span>Inasasisha...</span>
        </div>
      )}

      {activeCustomer ? (
        <div className="space-y-6 text-xs text-left animate-fade-in">
          {/* Profile header with China balance chip */}
          <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 rounded-3xl p-6 md:p-8 text-white shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSelectedCustomerId('')}
                  className="p-2.5 rounded-2xl bg-white/20 hover:bg-white/30 backdrop-blur border border-white/30 transition"
                >
                  <ArrowLeft size={16} />
                </button>
                <div className="h-16 w-16 rounded-2xl bg-white/25 backdrop-blur border-2 border-white/40 flex items-center justify-center text-white font-extrabold text-xl shadow-lg">
                  {getInitials(activeCustomer.full_name)}
                </div>
                <div>
                  <h3 className="text-base font-extrabold">{activeCustomer.full_name}</h3>
                  <p className="text-xs text-emerald-100 mt-1 flex items-center gap-1">
                    <Phone size={12} /> {activeCustomer.phone_number}
                  </p>
                  {activeCustomer.address && (
                    <p className="text-xs text-emerald-100 mt-1 flex items-center gap-1">
                      <MapPin size={12} /> {activeCustomer.address}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={openEditCustomer} className="py-2.5 px-4 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur border border-white/30 text-white font-bold flex items-center gap-1.5 transition">
                  <Edit2 size={14} /> Hariri
                </button>
                {userRole === 'admin' && (
                  <button onClick={() => handleDeleteCustomer(activeCustomer.id)} className="py-2.5 px-4 rounded-xl bg-rose-500/80 hover:bg-rose-500 text-white font-bold flex items-center gap-1.5 transition">
                    <Trash2 size={14} /> Futa
                  </button>
                )}
                <button onClick={() => setSelectedCustomerId('')} className="py-2.5 px-4 rounded-xl bg-white/90 hover:bg-white text-slate-800 font-bold">
                  Orodha
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 mt-4 border-t border-white/20">
              <div className="text-center">
                <p className="text-[10px] text-emerald-100 uppercase font-bold tracking-wider">Mikopo</p>
                <p className="text-xl font-black mt-1">{activeCustomerLoans.length}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-emerald-100 uppercase font-bold tracking-wider">Jumla</p>
                <p className="text-base font-black mt-1">TSh {activeCustomerLoans.reduce((s, l) => s + Number(l.amount), 0).toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-emerald-100 uppercase font-bold tracking-wider">Imerejeshwa</p>
                <p className="text-base font-black mt-1 text-emerald-200">TSh {activeCustomerLoans.reduce((s, l) => s + Number(l.paid_amount), 0).toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-emerald-100 uppercase font-bold tracking-wider">Baki</p>
                <p className="text-base font-black mt-1 text-rose-200">TSh {activeCustomerLoans.reduce((s, l) => s + Math.max(0, Number(l.amount) - Number(l.paid_amount)), 0).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* China balance chip */}
          <div className="bg-gradient-to-r from-rose-500 via-red-500 to-orange-500 rounded-3xl p-5 text-white shadow-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur border border-white/30 flex items-center justify-center">
                <Globe2 size={22} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-white/80">Salio la Pesa ya China</p>
                <p className="text-2xl font-black mt-0.5">TSh {chinaBalance.toLocaleString()}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-white/80 font-medium">Mikopo yote inatoka China</p>
              <p className="text-[10px] text-white/80 font-medium">Marejesho yanarudi China</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => { resetLoanForm(); setIsAddLoanOpen(true); }}
              disabled={chinaBalance <= 0}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold py-2.5 px-5 rounded-xl flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={16} /> Kopesha Mpya (kutoka China)
            </button>
            <button
              onClick={handlePrintStatement}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-5 rounded-xl flex items-center gap-2 shadow-sm"
            >
              <Printer size={16} /> Taarifa (PDF)
            </button>
          </div>

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
                  className={`bg-white rounded-3xl border-2 p-6 shadow-sm hover:shadow-md transition ${
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
                          : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
                        }`}>
                          {isCleared ? <CheckCircle2 size={22} /> : <Banknote size={22} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-extrabold text-slate-800">
                              TSh {Number(loan.amount).toLocaleString()}
                            </h4>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                              isCleared ? 'bg-emerald-100 text-emerald-700'
                              : isOverdue ? 'bg-rose-100 text-rose-700'
                              : isDueSoon ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {isCleared ? 'IMEKAMILIKA' : isOverdue ? 'IMECHELEWA' : isDueSoon ? 'KARIBU' : 'INATENDEKA'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {loan.notes || 'Mkopo wa China'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                          <p className="text-[9px] text-emerald-700 font-extrabold uppercase">Kiasi</p>
                          <p className="text-sm font-extrabold text-emerald-800 mt-0.5">TSh {Number(loan.amount).toLocaleString()}</p>
                        </div>
                        <div className="bg-teal-50 rounded-xl p-3 border border-teal-100">
                          <p className="text-[9px] text-teal-700 font-extrabold uppercase">Imerejeshwa</p>
                          <p className="text-sm font-extrabold text-teal-800 mt-0.5">TSh {Number(loan.paid_amount).toLocaleString()}</p>
                        </div>
                        <div className="bg-rose-50 rounded-xl p-3 border border-rose-100">
                          <p className="text-[9px] text-rose-700 font-extrabold uppercase">Baki</p>
                          <p className="text-sm font-extrabold text-rose-800 mt-0.5">TSh {remaining.toLocaleString()}</p>
                        </div>
                        <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                          <p className="text-[9px] text-amber-700 font-extrabold uppercase">Deadline</p>
                          <p className={`text-sm font-extrabold mt-0.5 ${isOverdue ? 'text-rose-700' : isDueSoon ? 'text-amber-700' : 'text-slate-800'}`}>
                            {formatDate(loan.return_date)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-2 text-[10px] flex-wrap">
                        <span className="text-slate-400">
                          <Calendar size={10} /> {formatDate(loan.lend_date)}
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
                          <span className="text-slate-400 font-semibold">Maendeleo ya Kurejesha</span>
                          <span className={`font-extrabold ${isCleared ? 'text-emerald-600' : 'text-teal-700'}`}>{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${isCleared ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' : 'bg-gradient-to-r from-teal-400 to-teal-600'}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex md:flex-col gap-2">
                      {!isCleared && userRole === 'admin' && (
                        <button
                          onClick={() => openPay(loan)}
                          className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold py-2 px-4 rounded-xl flex items-center gap-1.5 text-xs shadow-sm"
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
                <p className="text-xs mt-1">Ongeza mkopo wa kwanza kutoka China.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Global stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-6 rounded-3xl shadow-lg text-white">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">Jumla Iliyokopeshwa</span>
                <Banknote size={18} className="text-emerald-100" />
              </div>
              <h3 className="text-2xl font-black mt-2">TSh {globalStats.totalLent.toLocaleString()}</h3>
              <p className="text-[10px] text-emerald-100 mt-1">Kutoka China</p>
            </div>
            <div className="bg-gradient-to-br from-teal-500 to-cyan-600 p-6 rounded-3xl shadow-lg text-white">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-100">Iliyorejeshwa</span>
                <TrendingUp size={18} className="text-teal-100" />
              </div>
              <h3 className="text-2xl font-black mt-2">TSh {globalStats.totalRepaid.toLocaleString()}</h3>
              <p className="text-[10px] text-teal-100 mt-1">Imerudi China</p>
            </div>
            <div className="bg-gradient-to-br from-rose-500 to-red-600 p-6 rounded-3xl shadow-lg text-white">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-100">Baki ya Mikopo</span>
                <Wallet size={18} className="text-rose-100" />
              </div>
              <h3 className="text-2xl font-black mt-2">TSh {globalStats.outstanding.toLocaleString()}</h3>
              <p className="text-[10px] text-rose-100 mt-1">Inasubiri kurudi China</p>
            </div>
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-6 rounded-3xl shadow-lg text-white">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-100">Waliochelewa</span>
                <AlertTriangle size={18} className="text-amber-100" />
              </div>
              <h3 className="text-2xl font-black mt-2">{globalStats.overdueCount}</h3>
              <p className="text-[10px] text-amber-100 mt-1">Mikopo iliyochelewa</p>
            </div>
          </div>

          {/* China balance hero card */}
          <div className="bg-gradient-to-r from-rose-600 via-red-600 to-orange-600 rounded-3xl p-6 text-white shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur border border-white/30 flex items-center justify-center">
                  <Globe2 size={26} />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-white/80">Fedha Zinazopatikana China</p>
                  <p className="text-3xl font-black">TSh {chinaBalance.toLocaleString()}</p>
                  <p className="text-[10px] text-white/80 mt-1">Hii ni kiasi kinachoweza kukopeshwa</p>
                </div>
              </div>
              <div className="bg-white/15 backdrop-blur border border-white/20 rounded-2xl p-3 max-w-xs">
                <p className="text-[10px] font-bold text-white/90 leading-relaxed">
                  <ArrowDownRight size={12} className="inline" /> Kopesha: inatoka China<br/>
                  <ArrowUpRight size={12} className="inline" /> Rejesha: inarudi China
                </p>
              </div>
            </div>
          </div>

          {/* Header with action */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-white p-5 rounded-3xl border border-slate-100 shadow-sm gap-4">
            <div>
              <h2 className="text-md font-extrabold text-slate-800">Kopesha (Mikopo)</h2>
              <p className="text-xs text-slate-400 mt-1">Mikopo yote inatoka China, marejesho yanarudi China</p>
            </div>
            <button
              onClick={() => { resetCustomerForm(); setIsAddCustomerOpen(true); }}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5 shadow-lg"
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
                  className="group bg-white rounded-3xl border border-slate-100 p-5 shadow-sm hover:shadow-xl hover:border-emerald-300 cursor-pointer transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`h-12 w-12 rounded-xl font-bold flex items-center justify-center shadow-sm ${
                        overdue > 0 ? 'bg-gradient-to-br from-rose-400 to-rose-600 text-white'
                        : activeLoans.length > 0 ? 'bg-gradient-to-br from-emerald-400 to-teal-600 text-white'
                        : 'bg-gradient-to-br from-slate-200 to-slate-300 text-slate-600'
                      }`}>
                        {getInitials(customer.full_name)}
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-800">{customer.full_name}</h3>
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                          <Phone size={12} /> {customer.phone_number}
                        </p>
                      </div>
                    </div>
                    {overdue > 0 ? (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 flex items-center gap-1">
                        <AlertTriangle size={9} /> {overdue}
                      </span>
                    ) : activeLoans.length > 0 ? (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        {activeLoans.length} Active
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
                        {cLoans.length ? 'Cleared' : 'Mpya'}
                      </span>
                    )}
                  </div>

                  {cLoans.length > 0 && (
                    <div className="p-3 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100 text-xs space-y-2">
                      <div className="flex justify-between">
                        <span className="text-emerald-700 font-medium">Ilikopeshwa:</span>
                        <span className="font-bold text-emerald-800">TSh {totalLent.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-teal-700 font-medium">Imerejeshwa:</span>
                        <span className="font-bold text-teal-800">TSh {totalPaid.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between border-t border-emerald-200/50 pt-1.5">
                        <span className="text-rose-600 font-medium">Baki:</span>
                        <span className="font-bold text-rose-700">TSh {remaining.toLocaleString()}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between border-t border-slate-50 pt-3">
                    <p className="text-[10px] text-slate-400 font-mono">
                      {nextDue ? <>📅 {formatDate(nextDue)}</> : '—'}
                    </p>
                    <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5 group-hover:text-emerald-700">
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

      {/* ADD CUSTOMER MODAL */}
      {isAddCustomerOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-scale-in">
            <button onClick={() => setIsAddCustomerOpen(false)} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50">
              <X size={18} />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Users size={20} className="text-white" />
              </div>
              <h3 className="text-md font-extrabold text-slate-800">Ongeza Mkopaji</h3>
            </div>
            <form onSubmit={handleAddCustomer} className="space-y-4 text-xs text-left">
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Jina Kamili *</label>
                <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Mfano: Juma Kassim" className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-emerald-400 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Namba ya Simu *</label>
                  <input type="tel" required value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="0712345678" className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-emerald-400 focus:outline-none" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Anuani</label>
                  <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Mtaa, Jiji" className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-emerald-400 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Maelezo</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Maelezo ya ziada..." className="w-full p-2.5 border-2 border-slate-200 rounded-xl h-20 focus:border-emerald-400 focus:outline-none" />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsAddCustomerOpen(false)} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600">Ghairi</button>
                <button type="submit" disabled={isLoading} className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-semibold flex items-center gap-2 disabled:opacity-50">
                  {isLoading ? <><Loader2 size={14} className="animate-spin" /> Inasajili...</> : 'Sajili'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CUSTOMER MODAL */}
      {isEditCustomerOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-scale-in">
            <button onClick={() => setIsEditCustomerOpen(false)} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50">
              <X size={18} />
            </button>
            <h3 className="text-md font-extrabold text-slate-800">Hariri Mkopaji</h3>
            <form onSubmit={handleEditCustomer} className="space-y-4 text-xs text-left">
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Jina Kamili *</label>
                <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)} className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-emerald-400 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Namba ya Simu *</label>
                  <input type="tel" required value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-emerald-400 focus:outline-none" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Anuani</label>
                  <input type="text" value={address} onChange={e => setAddress(e.target.value)} className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-emerald-400 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Maelezo</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-2.5 border-2 border-slate-200 rounded-xl h-20 focus:border-emerald-400 focus:outline-none" />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsEditCustomerOpen(false)} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600">Ghairi</button>
                <button type="submit" disabled={isLoading} className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-semibold disabled:opacity-50">
                  Hifadhi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD LOAN MODAL */}
      {isAddLoanOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-scale-in">
            <button onClick={() => setIsAddLoanOpen(false)} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50">
              <X size={18} />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Coins size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-md font-extrabold text-slate-800">Kopesha (kutoka China)</h3>
                <p className="text-xs text-slate-400">Mkopaji: {activeCustomer?.full_name}</p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-rose-50 to-orange-50 border border-rose-200 rounded-2xl p-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Salio la China</p>
                <p className="text-lg font-black text-rose-800">TSh {chinaBalance.toLocaleString()}</p>
              </div>
              <Globe2 size={24} className="text-rose-500" />
            </div>

            <form onSubmit={handleAddLoan} className="space-y-4 text-xs text-left">
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Kiasi (TSh) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  max={chinaBalance}
                  value={loanAmount}
                  onChange={e => setLoanAmount(e.target.value)}
                  placeholder="50000"
                  className="w-full p-2.5 border-2 border-slate-200 rounded-xl text-lg font-extrabold focus:border-emerald-400 focus:outline-none"
                />
                {loanAmount && Number(loanAmount) > chinaBalance && (
                  <p className="mt-1 text-[10px] text-rose-600 font-bold flex items-center gap-1">
                    <AlertCircle size={10} /> Kiasi kinazidi salio la China
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Tarehe ya Kukopesha *</label>
                  <input type="date" required value={lendDate} onChange={e => setLendDate(e.target.value)} className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-emerald-400 focus:outline-none" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Tarehe ya Kurejesha *</label>
                  <input type="date" required value={returnDate} onChange={e => setReturnDate(e.target.value)} min={lendDate} className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-emerald-400 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Maelezo</label>
                <textarea value={loanNotes} onChange={e => setLoanNotes(e.target.value)} placeholder="Sababu au maelezo ya mkopo..." className="w-full p-2.5 border-2 border-slate-200 rounded-xl h-20 focus:border-emerald-400 focus:outline-none" />
              </div>
              <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-200 text-[11px] text-emerald-800">
                <strong>💡 Kumbuka:</strong> Kiasi hiki kitatolewa moja kwa moja kutoka fedha za China. Mkopo ukirejeshwa, kiasi hicho kitarudi China.
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsAddLoanOpen(false)} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600">Ghairi</button>
                <button type="submit" disabled={isLoading || Number(loanAmount) > chinaBalance} className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-semibold flex items-center gap-2 disabled:opacity-50">
                  {isLoading ? <><Loader2 size={14} className="animate-spin" /> Inahifadhi...</> : 'Hifadhi Mkopo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PAY MODAL */}
      {isPayModalOpen && selectedLoan && userRole === 'admin' && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-scale-in">
            <button onClick={() => setIsPayModalOpen(false)} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50">
              <X size={18} />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <ArrowUpRight size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-md font-extrabold text-slate-800">Rejesha (inarudi China)</h3>
                <p className="text-xs text-slate-400">{activeCustomer?.full_name}</p>
              </div>
            </div>
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
                  className="w-full p-2.5 border-2 border-slate-200 rounded-xl text-lg font-extrabold focus:border-emerald-400 focus:outline-none"
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
                      className={`flex-1 py-2 px-2 rounded-xl text-[10px] font-bold border-2 transition ${
                        payAmount === amount.toString()
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-600'
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
                <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="w-full p-2.5 border-2 border-slate-200 rounded-xl bg-white focus:border-emerald-400 focus:outline-none">
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
                <input type="text" value={payNotes} onChange={e => setPayNotes(e.target.value)} placeholder="Risiti au kumbukumbu..." className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-emerald-400 focus:outline-none" />
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
              <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-200 text-[11px] text-emerald-800">
                <strong>💡 Kumbuka:</strong> Kiasi hiki kitarudi moja kwa moja kwenye salio la China.
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsPayModalOpen(false)} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600">Ghairi</button>
                <button type="submit" disabled={isLoading || !payAmount || Number(payAmount) <= 0} className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-semibold flex items-center gap-2 disabled:opacity-50">
                  {isLoading ? <><Loader2 size={14} className="animate-spin" /> Inarekodi...</> : 'Hifadhi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HISTORY MODAL */}
      {isHistoryOpen && historyLoan && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-scale-in">
            <button onClick={() => setIsHistoryOpen(false)} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50">
              <X size={18} />
            </button>
            <h3 className="text-md font-extrabold text-slate-800">Historia ya Kurejesha</h3>
            <p className="text-xs text-slate-400">
              Mkopo wa TSh {Number(historyLoan.amount).toLocaleString()}
            </p>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {payments.filter(p => p.loan_id === historyLoan.id).map(payment => (
                <div key={payment.id} className="flex items-center justify-between p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
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
