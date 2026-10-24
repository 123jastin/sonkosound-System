/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Plus, Download, Calendar, X, Check, AlertCircle,
  Loader2, TrendingUp, Wallet, ArrowLeft, Trash2,
  ChevronRight, CalendarClock, MinusCircle, ArrowDownRight
} from 'lucide-react';
import { api } from '../services/api';

// ============================================================
// WEBVIEW-SAFE PRINT HELPER (Solves blank PDFs)
// ============================================================
function printHtml(htmlContent: string) {
  const existing = document.getElementById('print-iframe');
  if (existing) existing.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'print-iframe';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    alert('Imeshindwa kuandaa taarifa. Jaribu tena.');
    return;
  }

  doc.open();
  doc.write(htmlContent);
  doc.close();

  const doPrint = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error('Print failed:', e);
    }
    setTimeout(() => { try { iframe.remove(); } catch {} }, 2000);
  };

  setTimeout(doPrint, 600);
}

// ============================================================
// TYPES
// ============================================================
type KubandikaRegion = 'Tz' | 'China';
type FilterMode = 'day' | 'week' | 'month' | 'custom';
type TransactionType = 'IN' | 'OUT';

interface ReceivedPayment {
  id: string;
  region: KubandikaRegion;
  type: TransactionType;
  amount: number;
  date: string;
  method: string;
  receivedFrom?: string;
  notes?: string;
  createdAt: string;
}

interface KubandikaPageProps {
  onBack?: () => void;
  userRole?: 'admin' | 'staff' | null; // ✅ NEW: Role for delete permissions
}

// ============================================================
// HELPER: Date ranges
// ============================================================
function getDateRange(mode: FilterMode, customStart?: string, customEnd?: string) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  if (mode === 'day') return { start: today, end: today };

  if (mode === 'week') {
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      start: monday.toISOString().split('T')[0],
      end: sunday.toISOString().split('T')[0],
    };
  }

  if (mode === 'month') {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      start: first.toISOString().split('T')[0],
      end: last.toISOString().split('T')[0],
    };
  }

  return { start: customStart || today, end: customEnd || today };
}

// ============================================================
// COMPONENT: Region Menu
// ============================================================
function RegionMenu({
  onSelect,
  totals,
  isLoading,
}: {
  onSelect: (region: KubandikaRegion) => void;
  totals: Record<KubandikaRegion, { allTime: number; balance: number }>;
  isLoading?: boolean;
}) {
  const renderCard = (region: KubandikaRegion, title: string, subtitle: string, code: string, isTz: boolean) => {
    const accent = isTz ? 'emerald' : 'rose';
    const stats = totals[region];

    return (
      <button
        onClick={() => onSelect(region)}
        disabled={isLoading}
        className={`group relative bg-white rounded-3xl p-6 md:p-8 border-2 border-slate-100 hover:border-${accent}-400 hover:shadow-xl transition-all text-left overflow-hidden disabled:opacity-60`}
      >
        <div className={`absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-${accent}-100 to-${accent}-50 rounded-full blur-3xl opacity-60 -mr-10 -mt-10 group-hover:opacity-90 transition-opacity`} />
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br from-${accent}-500 to-${accent}-600 flex items-center justify-center shadow-lg shadow-${accent}-500/30`}>
              <span className="text-2xl font-black text-white">{code}</span>
            </div>
            <ChevronRight size={24} className={`text-slate-300 group-hover:text-${accent}-500 group-hover:translate-x-1 transition-all`} />
          </div>
          <h2 className="text-lg md:text-xl font-extrabold text-slate-800 mb-1">{title}</h2>
          <p className="text-xs text-slate-500 font-medium mb-5">{subtitle}</p>

          <div className="grid grid-cols-2 gap-2 pt-4 border-t border-slate-100">
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Jumla Iliyopokelewa</p>
              <p className={`text-sm font-extrabold text-${accent}-700 mt-0.5`}>TSh {stats.allTime.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Salio Lililobaki</p>
              <p className="text-sm font-extrabold text-slate-900 mt-0.5">TSh {stats.balance.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Wallet size={24} className="text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">Kubandika Pesa</h1>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Chagua eneo la fedha zilizopokelewa</p>
            </div>
          </div>
          {isLoading && <Loader2 size={20} className="text-amber-400 animate-spin" />}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {renderCard('Tz', 'Pesa ya Tanzania', 'Fedha zilizopokelewa na kulipwa Tanzania', 'TZ', true)}
        {renderCard('China', 'Pesa ya China', 'Fedha zilizopokelewa na kulipwa China', 'CN', false)}
      </div>
    </div>
  );
}

// ============================================================
// COMPONENT: Filter Tabs
// ============================================================
function FilterTabs({
  mode, onChange, customStart, customEnd, onCustomChange,
}: {
  mode: FilterMode;
  onChange: (mode: FilterMode) => void;
  customStart: string;
  customEnd: string;
  onCustomChange: (start: string, end: string) => void;
}) {
  const tabs: { id: FilterMode; label: string }[] = [
    { id: 'day', label: 'Leo' },
    { id: 'week', label: 'Wiki' },
    { id: 'month', label: 'Mwezi' },
    { id: 'custom', label: 'Chagua' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-2">
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => onChange(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${mode === tab.id ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
            {tab.label}
          </button>
        ))}
        {mode === 'custom' && (
          <div className="flex items-center gap-2 ml-auto">
            <input type="date" value={customStart} onChange={e => onCustomChange(e.target.value, customEnd)} className="px-3 py-2 border border-slate-200 rounded-xl text-xs" />
            <span className="text-xs text-slate-400 font-bold">→</span>
            <input type="date" value={customEnd} onChange={e => onCustomChange(customStart, e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-xs" />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// COMPONENT: Add Payment/Punguza Modal
// ============================================================
function AddPaymentModal({
  region, type, onClose, onSave, isLoading,
}: {
  region: KubandikaRegion;
  type: TransactionType;
  onClose: () => void;
  onSave: (payment: Omit<ReceivedPayment, 'id' | 'createdAt'>) => Promise<void>;
  isLoading: boolean;
}) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [method, setMethod] = useState('Cash');
  const [receivedFrom, setReceivedFrom] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isTz = region === 'Tz';
  const isOut = type === 'OUT';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!amount || Number(amount) <= 0) { setError('Kiasi kinahitajika'); return; }
    await onSave({ region, type, amount: Number(amount), date, method, receivedFrom: receivedFrom.trim() || undefined, notes: notes.trim() });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl relative animate-scale-in">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition"><X size={18} /></button>

        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${isOut ? 'bg-gradient-to-br from-orange-500 to-red-500' : (isTz ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' : 'bg-gradient-to-br from-rose-500 to-rose-600')}`}>
            {isOut ? <ArrowDownRight size={22} className="text-white" /> : <Plus size={22} className="text-white" />}
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-800">
              {isOut ? 'Punguza / Toa Pesa' : 'Ongeza Pesa Iliyopokelewa'}
            </h3>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Eneo: {region === 'Tz' ? 'Tanzania' : 'China'}</p>
          </div>
        </div>

        {error && <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center gap-2 text-xs text-rose-700"><AlertCircle size={14} /><span>{error}</span></div>}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-500 uppercase tracking-wide mb-1.5">Kiasi (TSh) *</label>
            <input type="number" required min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className={`w-full p-3 border-2 border-slate-200 rounded-xl text-lg font-extrabold focus:ring-2 transition ${isOut ? 'focus:ring-orange-500/30 focus:border-orange-500' : (isTz ? 'focus:ring-emerald-500/30 focus:border-emerald-500' : 'focus:ring-rose-500/30 focus:border-rose-500')}`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-500 uppercase tracking-wide mb-1.5">Tarehe *</label>
              <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl" />
            </div>
            <div>
              <label className="block font-bold text-slate-500 uppercase tracking-wide mb-1.5">Njia *</label>
              <select value={method} onChange={e => setMethod(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl bg-white">
                <option value="Cash">Cash</option>
                <option value="M-Pesa">M-Pesa</option>
                <option value="Tigo Pesa">Tigo Pesa</option>
                <option value="Airtel Money">Airtel Money</option>
                <option value="HaloPesa">HaloPesa</option>
                <option value="Bank Transfer">Bank Transfer</option>
                {region === 'China' && <><option value="WeChat Pay">WeChat Pay</option><option value="Alipay">Alipay</option></>}
                <option value="Other">Nyinginezo</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block font-bold text-slate-500 uppercase tracking-wide mb-1.5">{isOut ? 'Imelipwa kwa (Mtu/Kampuni)' : 'Imetoka kwa (Aliyetuma)'}</label>
            <input type="text" value={receivedFrom} onChange={e => setReceivedFrom(e.target.value)} placeholder={isOut ? "Mf. Supplier China" : "Mf. Juma Hassan"} className="w-full p-2.5 border border-slate-200 rounded-xl" />
          </div>
          <div>
            <label className="block font-bold text-slate-500 uppercase tracking-wide mb-1.5">Maelezo / Risiti</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder={isOut ? "Mf. Nimelipa supplier..." : "Namba ya risiti..."} className="w-full p-2.5 border border-slate-200 rounded-xl h-20 resize-none" />
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={isLoading} className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl font-bold text-slate-600">Ghairi</button>
            <button type="submit" disabled={isLoading} className={`px-5 py-2.5 rounded-xl font-bold text-white flex items-center gap-2 ${isOut ? 'bg-orange-600 hover:bg-orange-700' : (isTz ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700')}`}>
              {isLoading ? <><Loader2 size={14} className="animate-spin" /> Inahifadhi...</> : <><Check size={14} /> {isOut ? 'Punguza' : 'Hifadhi'}</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function KubandikaPage({ onBack, userRole }: KubandikaPageProps) {
  const [activeRegion, setActiveRegion] = useState<KubandikaRegion | null>(null);
  const [payments, setPayments] = useState<ReceivedPayment[]>([]);
  const [filterMode, setFilterMode] = useState<FilterMode>('day');
  const [customStart, setCustomStart] = useState(new Date().toISOString().split('T')[0]);
  const [customEnd, setCustomEnd] = useState(new Date().toISOString().split('T')[0]);
  
  const [modalState, setModalState] = useState<{ open: boolean; type: TransactionType }>({ open: false, type: 'IN' });
  
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ============================================================
  // LOAD
  // ============================================================
  const loadPayments = useCallback(async () => {
    try {
      setIsInitialLoading(true);
      setErrorMsg(null);
      const data: any = await api.kubandika.list();
      const list = Array.isArray(data) ? data : (data?.payments || []);
      
      const mapped: ReceivedPayment[] = list.map((p: any) => ({
        id: p.id,
        region: p.region,
        type: p.type || 'IN',
        amount: Number(p.amount) || 0,
        date: p.date,
        method: p.method || 'Cash',
        receivedFrom: p.receivedFrom || p.received_from || '',
        notes: p.notes || '',
        createdAt: p.createdAt || p.created_at || new Date().toISOString(),
      }));
      setPayments(mapped);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Imeshindwa kupata rekodi');
      try {
        const raw = localStorage.getItem('kubandika_payments');
        if (raw) setPayments(JSON.parse(raw));
      } catch {}
    } finally {
      setIsInitialLoading(false);
    }
  }, []);

  useEffect(() => { loadPayments(); }, [loadPayments]);

  useEffect(() => {
    if (!isInitialLoading) {
      try { localStorage.setItem('kubandika_payments', JSON.stringify(payments)); } catch {}
    }
  }, [payments, isInitialLoading]);

  // ============================================================
  // TOTALS
  // ============================================================
  const regionTotals = useMemo(() => {
    const calc = (region: KubandikaRegion) => {
      const rp = payments.filter(p => p.region === region);
      
      const allIn = rp.filter(p => (p.type || 'IN') === 'IN').reduce((s, p) => s + p.amount, 0);
      const allOut = rp.filter(p => (p.type || 'IN') === 'OUT').reduce((s, p) => s + p.amount, 0);

      return {
        allTime: allIn,
        allOut: allOut,
        balance: allIn - allOut
      };
    };
    return { Tz: calc('Tz'), China: calc('China') };
  }, [payments]);

  // ============================================================
  // FILTERED
  // ============================================================
  const filteredPayments = useMemo(() => {
    if (!activeRegion) return [];
    const { start, end } = getDateRange(filterMode, customStart, customEnd);
    return payments
      .filter(p => p.region === activeRegion && p.date >= start && p.date <= end)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [payments, activeRegion, filterMode, customStart, customEnd]);

  const filteredTotals = useMemo(() => {
    let inSum = 0, outSum = 0;
    filteredPayments.forEach(p => {
      if ((p.type || 'IN') === 'IN') inSum += p.amount;
      else outSum += p.amount;
    });
    return { in: inSum, out: outSum, balance: inSum - outSum };
  }, [filteredPayments]);

  const activeRegionTotals = activeRegion ? regionTotals[activeRegion] : null;
  const isTz = activeRegion === 'Tz';

  // ============================================================
  // SAVE
  // ============================================================
  const handleSavePayment = async (payment: Omit<ReceivedPayment, 'id' | 'createdAt'>) => {
    setIsLoading(true);
    try {
      const result: any = await api.kubandika.create({
        region: payment.region,
        type: payment.type,
        amount: payment.amount,
        date: payment.date,
        method: payment.method,
        receivedFrom: payment.receivedFrom || '',
        notes: payment.notes || '',
      });

      if (result?.success && result.payment) {
        setPayments(prev => [{
          id: result.payment.id,
          region: result.payment.region,
          type: result.payment.type || payment.type,
          amount: result.payment.amount,
          date: result.payment.date,
          method: result.payment.method,
          receivedFrom: result.payment.receivedFrom || '',
          notes: result.payment.notes || '',
          createdAt: result.payment.createdAt,
        }, ...prev]);
      } else {
        await loadPayments();
      }
      setModalState({ open: false, type: 'IN' });
      setSuccessMsg(payment.type === 'OUT' ? 'Punguza imerekodiwa!' : 'Pesa imeongezwa!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Imeshindwa kuhifadhi');
      setTimeout(() => setErrorMsg(null), 4000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    // ✅ Only admins can delete
    if (userRole !== 'admin') {
      setErrorMsg('Huna ruhusa ya kufuta. Wasiliana na Admin.');
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }

    if (!confirm('Futa rekodi hii?')) return;
    const previous = payments;
    setPayments(prev => prev.filter(p => p.id !== id));
    try {
      await api.kubandika.delete(id);
      setSuccessMsg('Rekodi imefutwa');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e: any) {
      setPayments(previous);
      setErrorMsg('Imeshindwa kufuta');
    }
  };

  // ============================================================
  // PDF EXPORT
  // ============================================================
  const handleDownloadPDF = () => {
    if (!activeRegion || !activeRegionTotals) return;
    const now = new Date();
    const { start, end } = getDateRange(filterMode, customStart, customEnd);
    const filterLabel = filterMode === 'day' ? `Leo (${start})` : filterMode === 'week' ? `Wiki (${start} → ${end})` : filterMode === 'month' ? `Mwezi (${start} → ${end})` : `Custom (${start} → ${end})`;

    const isTzTheme = activeRegion === 'Tz';
    const primaryColor = isTzTheme ? '#059669' : '#e11d48';
    const primaryLight = isTzTheme ? '#d1fae5' : '#ffe4e6';
    const primaryDark = isTzTheme ? '#065f46' : '#9f1239';

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Taarifa ya Kubandika - ${activeRegion}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: A4; margin: 12mm; }
    body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #fff; color: #1e293b; padding: 20px; }
    .container { max-width: 190mm; margin: 0 auto; }
    .header { background: linear-gradient(135deg, ${primaryDark} 0%, ${primaryColor} 100%); color: white; padding: 24px 28px; border-radius: 14px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
    .header-title { font-size: 22px; font-weight: 900; }
    .header-sub { font-size: 11px; opacity: 0.9; margin-top: 4px; }
    .header-badge { background: rgba(255,255,255,0.2); padding: 6px 14px; border-radius: 20px; font-size: 10px; font-weight: 800; text-transform: uppercase; }
    .filter-badge { display: inline-block; background: ${primaryLight}; color: ${primaryDark}; padding: 8px 16px; border-radius: 10px; font-size: 12px; font-weight: 800; margin-bottom: 16px; border-left: 4px solid ${primaryColor}; }
    
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
    .stat-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; text-align: center; }
    .stat-card.primary { background: ${primaryLight}; border-color: ${primaryColor}; }
    .stat-label { font-size: 9px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
    .stat-value { font-size: 18px; font-weight: 900; color: #1e293b; }
    .stat-card.primary .stat-value { color: ${primaryDark}; font-size: 22px; }
    .stat-value.out { color: #ea580c; }

    table { width: 100%; border-collapse: collapse; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
    thead th { background: ${primaryDark}; color: white; padding: 12px 14px; text-align: left; font-size: 10px; text-transform: uppercase; font-weight: 800; }
    thead th:last-child { text-align: right; }
    tbody td { padding: 11px 14px; border-bottom: 1px solid #f1f5f9; font-size: 11px; color: #334155; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    tbody td:last-child { text-align: right; font-weight: 800; }
    
    .amt-in { color: ${primaryColor}; }
    .amt-out { color: #ea580c; }
    .type-badge { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 9px; font-weight: 800; }
    .type-in { background: ${primaryLight}; color: ${primaryDark}; }
    .type-out { background: #ffedd5; color: #9a3412; }

    .day-separator { background: #f1f5f9; border-left: 4px solid ${primaryColor}; padding: 10px 16px; border-radius: 8px; margin: 16px 0 8px; display: flex; justify-content: space-between; align-items: center; }
    .day-separator-date { font-size: 13px; font-weight: 900; color: #1e293b; }
    
    .grand-total { background: linear-gradient(135deg, ${primaryDark} 0%, ${primaryColor} 100%); color: white; padding: 18px 24px; border-radius: 12px; margin-top: 20px; display: flex; justify-content: space-between; align-items: center; }
    .grand-total-label { font-size: 14px; font-weight: 700; }
    .grand-total-value { font-size: 22px; font-weight: 900; }

    .footer { margin-top: 30px; padding: 14px; background: #f8fafc; border-radius: 10px; text-align: center; font-size: 10px; color: #64748b; border: 1px solid #e2e8f0; }
    .no-print { text-align: center; padding: 20px; margin-top: 10px; }
    .no-print button { background: ${primaryColor}; color: white; border: none; padding: 12px 28px; border-radius: 22px; font-size: 13px; font-weight: bold; cursor: pointer; margin: 0 5px; }
    .no-print button.close { background: #64748b; }
    @media print { .no-print { display: none !important; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <div class="header-title">Kubandika Pesa ya ${activeRegion === 'Tz' ? 'Tanzania' : 'China'}</div>
        <div class="header-sub">SONKO SOUND — Morogoro, Tanzania • 0688423753</div>
      </div>
      <div style="text-align:right;">
        <div class="header-badge">${activeRegion === 'Tz' ? '🇹🇿 TZ' : '🇨🇳 CHINA'}</div>
      </div>
    </div>

    <div class="filter-badge">📅 ${filterLabel}</div>

    <div class="stats-grid">
      <div class="stat-card primary">
        <div class="stat-label">Salio la Kipindi Hiki</div>
        <div class="stat-value">TSh ${filteredTotals.balance.toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Jumla Iliyoingia (In)</div>
        <div class="stat-value amt-in">TSh ${filteredTotals.in.toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Jumla Iliyotoka (Out)</div>
        <div class="stat-value out">TSh ${filteredTotals.out.toLocaleString()}</div>
      </div>
    </div>

    ${filteredPayments.length === 0
      ? '<div style="text-align:center;padding:40px;color:#94a3b8;font-style:italic;">Hakuna rekodi katika kipindi hiki</div>'
      : `<table>
          <thead>
            <tr>
              <th>Tarehe</th>
              <th>Maelezo / Mtu</th>
              <th>Njia</th>
              <th>Hali</th>
              <th>Kiasi</th>
            </tr>
          </thead>
          <tbody>
            ${filteredPayments.map(p => {
              const isOut = p.type === 'OUT';
              return `
              <tr>
                <td>${p.date}</td>
                <td>${p.receivedFrom || p.notes || '—'}</td>
                <td><span class="type-badge ${isOut ? 'type-out' : 'type-in'}">${p.method}</span></td>
                <td><span class="type-badge ${isOut ? 'type-out' : 'type-in'}">${isOut ? 'ALILIPA' : 'ALIPOKEA'}</span></td>
                <td class="${isOut ? 'amt-out' : 'amt-in'}">${isOut ? '-' : '+'} TSh ${p.amount.toLocaleString()}</td>
              </tr>
            `}).join('')}
          </tbody>
        </table>`
    }

    <div class="grand-total">
      <span class="grand-total-label">SALIO LILILOBAKI (${filterLabel})</span>
      <span class="grand-total-value">TSh ${filteredTotals.balance.toLocaleString()}</span>
    </div>

    <div class="footer">
      <strong>SONKO SOUND</strong> • Morogoro, Tanzania • 0688423753<br>
      Taarifa hii ilitengenezwa ${now.toLocaleDateString('sw-TZ')} saa ${now.toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' })}
    </div>

    <div class="no-print">
      <button onclick="window.print()">🖨️ Chapisha / Save as PDF</button>
      <button class="close" onclick="window.close()">Funga</button>
    </div>
  </div>
</body>
</html>`;

    printHtml(html);
  };

  // ============================================================
  // RENDER: REGION MENU
  // ============================================================
  if (!activeRegion) {
    return (
      <div className="space-y-6">
        {successMsg && <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-2 text-emerald-700 text-xs"><Check size={16} /><span>{successMsg}</span></div>}
        {errorMsg && <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center gap-2 text-rose-700 text-xs"><AlertCircle size={16} /><span>{errorMsg}</span></div>}
        <RegionMenu onSelect={setActiveRegion} totals={regionTotals} isLoading={isInitialLoading} />
      </div>
    );
  }

  // ============================================================
  // RENDER: FULL PAGE
  // ============================================================
  return (
    <div className="space-y-5 text-xs">
      {successMsg && <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-2 text-emerald-700 text-xs"><Check size={16} /><span>{successMsg}</span></div>}
      {errorMsg && <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center gap-2 text-rose-700 text-xs"><AlertCircle size={16} /><span>{errorMsg}</span></div>}

      {/* Region header */}
      <div className={`rounded-3xl p-6 md:p-8 text-white shadow-lg ${isTz ? 'bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-800' : 'bg-gradient-to-br from-rose-600 via-rose-700 to-rose-800'}`}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => setActiveRegion(null)} className="p-2.5 rounded-2xl bg-white/15 hover:bg-white/25 transition-colors"><ArrowLeft size={18} /></button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{isTz ? '🇹🇿' : '🇨🇳'}</span>
                <h1 className="text-lg md:text-2xl font-extrabold">Pesa ya {isTz ? 'Tanzania' : 'China'}</h1>
              </div>
              <p className="text-[11px] text-white/80 font-medium mt-1">Rekodi za fedha zilizopokelewa & kulipwa</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setModalState({ open: true, type: 'OUT' })} className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-5 rounded-2xl transition-colors flex items-center gap-2 shadow-lg">
              <MinusCircle size={16} /> Punguza / Toa
            </button>
            <button onClick={() => setModalState({ open: true, type: 'IN' })} className="bg-white text-slate-900 font-bold py-3 px-5 rounded-2xl hover:bg-white/95 transition-colors flex items-center gap-2 shadow-lg">
              <Plus size={16} /> Ongeza Pesa
            </button>
          </div>
        </div>
      </div>

      {/* Dashboard stats */}
      {activeRegionTotals && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className={`rounded-3xl p-5 border shadow-sm ${isTz ? 'bg-gradient-to-br from-emerald-50 to-white border-emerald-200' : 'bg-gradient-to-br from-rose-50 to-white border-rose-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[10px] font-extrabold uppercase tracking-wider ${isTz ? 'text-emerald-700' : 'text-rose-700'}`}>Salio la Kipindi Hiki</span>
              <TrendingUp size={16} className={isTz ? 'text-emerald-500' : 'text-rose-500'} />
            </div>
            <p className="text-2xl font-black text-slate-800">TSh {filteredTotals.balance.toLocaleString()}</p>
            <div className="flex gap-3 mt-1">
              <p className="text-[10px] text-emerald-600 font-bold">In: +{filteredTotals.in.toLocaleString()}</p>
              <p className="text-[10px] text-orange-600 font-bold">Out: -{filteredTotals.out.toLocaleString()}</p>
            </div>
          </div>

          <div className="rounded-3xl p-5 bg-white border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Jumla Iliyoingia (All Time)</span>
              <Wallet size={16} className="text-slate-400" />
            </div>
            <p className={`text-2xl font-black ${isTz ? 'text-emerald-600' : 'text-rose-600'}`}>TSh {activeRegionTotals.allTime.toLocaleString()}</p>
          </div>

          <div className="rounded-3xl p-5 bg-white border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Jumla Iliyotoka (All Time)</span>
              <ArrowDownRight size={16} className="text-orange-400" />
            </div>
            <p className="text-2xl font-black text-orange-600">TSh {activeRegionTotals.allOut.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Filter + download row */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex-1">
          <FilterTabs mode={filterMode} onChange={setFilterMode} customStart={customStart} customEnd={customEnd} onCustomChange={(s, e) => { setCustomStart(s); setCustomEnd(e); }} />
        </div>
        <button onClick={handleDownloadPDF} disabled={filteredPayments.length === 0} className={`shrink-0 py-3 px-5 rounded-2xl font-bold text-white flex items-center gap-2 disabled:opacity-50 ${isTz ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
          <Download size={15} /> Pakua PDF
        </button>
      </div>

      {/* Payments list */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {isInitialLoading ? (
          <div className="p-12 text-center"><Loader2 size={28} className="animate-spin mx-auto mb-3 text-slate-400" /><p className="text-sm font-bold text-slate-600">Inapakia...</p></div>
        ) : filteredPayments.length === 0 ? (
          <div className="p-12 text-center"><Wallet size={28} className="mx-auto mb-3 text-slate-300" /><p className="text-sm font-bold text-slate-600">Hakuna rekodi katika kipindi hiki</p></div>
        ) : (
          <div>
            <table className="w-full">
              <thead>
                <tr className={isTz ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}>
                  <th className="text-left px-5 py-3 text-[10px] uppercase font-extrabold">Tarehe</th>
                  <th className="text-left px-5 py-3 text-[10px] uppercase font-extrabold">Maelezo / Mtu</th>
                  <th className="text-left px-5 py-3 text-[10px] uppercase font-extrabold">Njia</th>
                  <th className="text-left px-5 py-3 text-[10px] uppercase font-extrabold">Hali</th>
                  <th className="text-right px-5 py-3 text-[10px] uppercase font-extrabold">Kiasi (TSh)</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((p, i) => {
                  const isOut = p.type === 'OUT';
                  return (
                    <tr key={p.id} className={`border-b border-slate-100 hover:bg-slate-50/60 ${i % 2 === 1 ? 'bg-slate-50/30' : ''}`}>
                      <td className="px-5 py-3 font-bold text-slate-700 whitespace-nowrap">{p.date}</td>
                      <td className="px-5 py-3 font-semibold text-slate-700">
                        {p.receivedFrom || p.notes || <span className="text-slate-400 italic font-normal">—</span>}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase ${isOut ? 'bg-orange-100 text-orange-800' : (isTz ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800')}`}>
                          {p.method}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase ${isOut ? 'bg-orange-100 text-orange-800' : (isTz ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800')}`}>
                          {isOut ? 'Alilipa' : 'Alipokea'}
                        </span>
                      </td>
                      <td className={`px-5 py-3 text-right font-black ${isOut ? 'text-orange-600' : (isTz ? 'text-emerald-700' : 'text-rose-700')}`}>
                        {isOut ? '-' : '+'} {p.amount.toLocaleString()}
                      </td>
                      <td className="px-3 py-3">
                        {/* ✅ Admin-only Delete Button */}
                        {userRole === 'admin' && (
                          <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {filteredPayments.length > 0 && (
          <div className={`px-5 py-4 flex items-center justify-between text-white ${isTz ? 'bg-gradient-to-r from-emerald-600 to-emerald-700' : 'bg-gradient-to-r from-rose-600 to-rose-700'}`}>
            <span className="text-xs font-extrabold uppercase tracking-wider">Salio la Kipindi Hiki</span>
            <span className="text-lg font-black">TSh {filteredTotals.balance.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalState.open && activeRegion && (
        <AddPaymentModal
          region={activeRegion}
          type={modalState.type}
          onClose={() => setModalState({ open: false, type: 'IN' })}
          onSave={handleSavePayment}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}
