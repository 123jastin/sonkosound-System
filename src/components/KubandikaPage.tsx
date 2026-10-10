/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Plus, Download, Calendar, X, Check, AlertCircle,
  Loader2, TrendingUp, Wallet, ArrowLeft, Trash2,
  ChevronRight, CalendarClock
} from 'lucide-react';
import { api } from '../services/api';

// ============================================================
// TYPES
// ============================================================
type KubandikaRegion = 'Tz' | 'China';
type FilterMode = 'day' | 'week' | 'month' | 'custom';

interface ReceivedPayment {
  id: string;
  region: KubandikaRegion;
  amount: number;
  date: string;
  method: string;
  receivedFrom?: string;
  notes?: string;
  createdAt: string;
}

interface KubandikaPageProps {
  onBack?: () => void;
}

// ============================================================
// HELPER: Date ranges
// ============================================================
function getDateRange(mode: FilterMode, customStart?: string, customEnd?: string) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  if (mode === 'day') {
    return { start: today, end: today };
  }

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

  return {
    start: customStart || today,
    end: customEnd || today,
  };
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
  totals: Record<KubandikaRegion, { today: number; month: number; allTime: number }>;
  isLoading?: boolean;
}) {
  const renderCard = (
    region: KubandikaRegion,
    title: string,
    subtitle: string,
    code: string,
    isTz: boolean
  ) => {
    const accent = isTz ? 'emerald' : 'rose';
    const stats = totals[region];

    return (
      <button
        onClick={() => onSelect(region)}
        disabled={isLoading}
        className={`group relative bg-white rounded-3xl p-6 md:p-8 border-2 border-slate-100 hover:border-${accent}-400 hover:shadow-xl transition-all text-left overflow-hidden disabled:opacity-60`}
      >
        <div
          className={`absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-${accent}-100 to-${accent}-50 rounded-full blur-3xl opacity-60 -mr-10 -mt-10 group-hover:opacity-90 transition-opacity`}
        />

        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <div
              className={`w-14 h-14 rounded-2xl bg-gradient-to-br from-${accent}-500 to-${accent}-600 flex items-center justify-center shadow-lg shadow-${accent}-500/30`}
            >
              <span className="text-2xl font-black text-white">{code}</span>
            </div>
            <ChevronRight
              size={24}
              className={`text-slate-300 group-hover:text-${accent}-500 group-hover:translate-x-1 transition-all`}
            />
          </div>

          <h2 className="text-lg md:text-xl font-extrabold text-slate-800 mb-1">{title}</h2>
          <p className="text-xs text-slate-500 font-medium mb-5">{subtitle}</p>

          <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-100">
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Leo</p>
              <p className={`text-sm font-extrabold text-${accent}-700 mt-0.5`}>
                TSh {stats.today.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Mwezi</p>
              <p className="text-sm font-extrabold text-slate-700 mt-0.5">
                TSh {stats.month.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Jumla</p>
              <p className="text-sm font-extrabold text-slate-900 mt-0.5">
                TSh {stats.allTime.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Wallet size={24} className="text-amber-400" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">
                Kubandika Pesa
              </h1>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Chagua eneo la fedha zilizopokelewa
              </p>
            </div>
          </div>
          {isLoading && (
            <Loader2 size={20} className="text-amber-400 animate-spin" />
          )}
        </div>
      </div>

      {/* Two region cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {renderCard('Tz', 'Kubandika Pesa ya Tz', 'Fedha zilizopokelewa Tanzania', 'TZ', true)}
        {renderCard('China', 'Kubandika Pesa ya China', 'Fedha zilizopokelewa China', 'CN', false)}
      </div>
    </div>
  );
}

// ============================================================
// COMPONENT: Filter Tabs
// ============================================================
function FilterTabs({
  mode,
  onChange,
  customStart,
  customEnd,
  onCustomChange,
}: {
  mode: FilterMode;
  onChange: (mode: FilterMode) => void;
  customStart: string;
  customEnd: string;
  onCustomChange: (start: string, end: string) => void;
}) {
  const tabs: { id: FilterMode; label: string }[] = [
    { id: 'day', label: 'Leo (Day)' },
    { id: 'week', label: 'Wiki (Week)' },
    { id: 'month', label: 'Mwezi (Month)' },
    { id: 'custom', label: 'Chagua (Custom)' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-2">
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              mode === tab.id
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}

        {mode === 'custom' && (
          <div className="flex items-center gap-2 ml-auto">
            <input
              type="date"
              value={customStart}
              onChange={e => onCustomChange(e.target.value, customEnd)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
            <span className="text-xs text-slate-400 font-bold">→</span>
            <input
              type="date"
              value={customEnd}
              onChange={e => onCustomChange(customStart, e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// COMPONENT: Add Payment Modal
// ============================================================
function AddPaymentModal({
  region,
  onClose,
  onSave,
  isLoading,
}: {
  region: KubandikaRegion;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!amount || Number(amount) <= 0) {
      setError('Kiasi kinahitajika');
      return;
    }

    await onSave({
      region,
      amount: Number(amount),
      date,
      method,
      receivedFrom: receivedFrom.trim() || undefined,
      notes: notes.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl relative animate-scale-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${
              isTz
                ? 'bg-gradient-to-br from-emerald-500 to-emerald-600'
                : 'bg-gradient-to-br from-rose-500 to-rose-600'
            }`}
          >
            <Plus size={22} className="text-white" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-800">
              Ongeza Pesa Iliyopokelewa
            </h3>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              Kubandika Pesa ya {region === 'Tz' ? 'Tanzania' : 'China'}
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center gap-2 text-xs text-rose-700">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-500 uppercase tracking-wide mb-1.5">
              Kiasi (TSh) *
            </label>
            <input
              type="number"
              required
              min="1"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0"
              className={`w-full p-3 border-2 border-slate-200 rounded-xl text-lg font-extrabold focus:ring-2 transition ${
                isTz
                  ? 'focus:ring-emerald-500/30 focus:border-emerald-500'
                  : 'focus:ring-rose-500/30 focus:border-rose-500'
              }`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                Tarehe *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-accent/30 focus:border-accent"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                Njia *
              </label>
              <select
                value={method}
                onChange={e => setMethod(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-accent/30 focus:border-accent"
              >
                <option value="Cash">Cash</option>
                <option value="M-Pesa">M-Pesa</option>
                <option value="Tigo Pesa">Tigo Pesa</option>
                <option value="Airtel Money">Airtel Money</option>
                <option value="HaloPesa">HaloPesa</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="WeChat Pay">WeChat Pay</option>
                <option value="Alipay">Alipay</option>
                <option value="Other">Nyinginezo</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-500 uppercase tracking-wide mb-1.5">
              Imetoka kwa (Aliyetuma){' '}
              <span className="text-slate-400 font-medium normal-case tracking-normal">
                — hiari
              </span>
            </label>
            <input
              type="text"
              value={receivedFrom}
              onChange={e => setReceivedFrom(e.target.value)}
              placeholder="Mf. Juma Hassan (si lazima)"
              className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-500 uppercase tracking-wide mb-1.5">
              Kumbukumbu / Maelezo
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Namba ya risiti, maelezo ya ziada..."
              className="w-full p-2.5 border border-slate-200 rounded-xl h-20 resize-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl font-bold text-slate-600 transition disabled:opacity-50"
            >
              Ghairi
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className={`px-5 py-2.5 rounded-xl font-bold shadow-sm transition disabled:opacity-50 flex items-center gap-2 text-white ${
                isTz
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Inahifadhi...
                </>
              ) : (
                <>
                  <Check size={14} /> Hifadhi
                </>
              )}
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
export default function KubandikaPage({ onBack }: KubandikaPageProps) {
  const [activeRegion, setActiveRegion] = useState<KubandikaRegion | null>(null);
  const [payments, setPayments] = useState<ReceivedPayment[]>([]);
  const [filterMode, setFilterMode] = useState<FilterMode>('day');
  const [customStart, setCustomStart] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [customEnd, setCustomEnd] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ============================================================
  // ✅ LOAD FROM BACKEND
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
        amount: Number(p.amount) || 0,
        date: p.date,
        method: p.method || 'Cash',
        receivedFrom: p.receivedFrom || p.received_from || '',
        notes: p.notes || '',
        createdAt: p.createdAt || p.created_at || new Date().toISOString(),
      }));

      setPayments(mapped);
    } catch (e: any) {
      console.error('Failed to load kubandika payments:', e);
      setErrorMsg(e?.message || 'Imeshindwa kupata rekodi kutoka kwenye seva');

      // Fallback: try localStorage
      try {
        const raw = localStorage.getItem('kubandika_payments');
        if (raw) {
          setPayments(JSON.parse(raw));
        }
      } catch {}
    } finally {
      setIsInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  // ✅ Cache to localStorage for offline resilience
  useEffect(() => {
    if (!isInitialLoading && payments.length >= 0) {
      try {
        localStorage.setItem('kubandika_payments', JSON.stringify(payments));
      } catch {}
    }
  }, [payments, isInitialLoading]);

  // ============================================================
  // TOTALS
  // ============================================================
  const regionTotals = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().split('T')[0];

    const calc = (region: KubandikaRegion) => {
      const regionPayments = payments.filter(p => p.region === region);
      return {
        today: regionPayments
          .filter(p => p.date === today)
          .reduce((s, p) => s + p.amount, 0),
        month: regionPayments
          .filter(p => p.date >= monthStartStr)
          .reduce((s, p) => s + p.amount, 0),
        allTime: regionPayments.reduce((s, p) => s + p.amount, 0),
      };
    };

    return { Tz: calc('Tz'), China: calc('China') };
  }, [payments]);

  // ============================================================
  // FILTERED PAYMENTS
  // ============================================================
  const filteredPayments = useMemo(() => {
    if (!activeRegion) return [];
    const { start, end } = getDateRange(filterMode, customStart, customEnd);
    return payments
      .filter(
        p => p.region === activeRegion && p.date >= start && p.date <= end
      )
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [payments, activeRegion, filterMode, customStart, customEnd]);

  const filteredTotal = useMemo(
    () => filteredPayments.reduce((s, p) => s + p.amount, 0),
    [filteredPayments]
  );

  const groupedByDay = useMemo(() => {
    const groups: Record<string, ReceivedPayment[]> = {};
    filteredPayments.forEach(p => {
      if (!groups[p.date]) groups[p.date] = [];
      groups[p.date].push(p);
    });
    return Object.entries(groups).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filteredPayments]);

  const activeRegionTotals = activeRegion ? regionTotals[activeRegion] : null;
  const isTz = activeRegion === 'Tz';

  // ============================================================
  // ✅ ADD PAYMENT — calls POST /api/kubandika
  // ============================================================
  const handleSavePayment = async (
    payment: Omit<ReceivedPayment, 'id' | 'createdAt'>
  ) => {
    setIsLoading(true);
    try {
      const result: any = await api.kubandika.create({
        region: payment.region,
        amount: payment.amount,
        date: payment.date,
        method: payment.method,
        receivedFrom: payment.receivedFrom || '',
        notes: payment.notes || '',
      });

      if (result?.success && result.payment) {
        // ✅ Optimistic: prepend new payment
        const newPayment: ReceivedPayment = {
          id: result.payment.id,
          region: result.payment.region,
          amount: result.payment.amount,
          date: result.payment.date,
          method: result.payment.method,
          receivedFrom: result.payment.receivedFrom || '',
          notes: result.payment.notes || '',
          createdAt: result.payment.createdAt,
        };
        setPayments(prev => [newPayment, ...prev]);
      } else {
        // Fallback: refetch
        await loadPayments();
      }

      setIsAddOpen(false);
      setSuccessMsg('Pesa imeongezwa kikamilifu!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e: any) {
      console.error('Failed to save:', e);
      setErrorMsg(e?.message || 'Imeshindwa kuongeza pesa. Jaribu tena.');
      setTimeout(() => setErrorMsg(null), 4000);
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================================
  // ✅ DELETE — calls DELETE /api/kubandika/:id
  // ============================================================
  const handleDelete = async (id: string) => {
    if (!confirm('Futa rekodi hii?')) return;

    // Optimistic remove
    const previous = payments;
    setPayments(prev => prev.filter(p => p.id !== id));

    try {
      await api.kubandika.delete(id);
      setSuccessMsg('Rekodi imefutwa');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e: any) {
      console.error('Failed to delete:', e);
      // Rollback on failure
      setPayments(previous);
      setErrorMsg(e?.message || 'Imeshindwa kufuta. Jaribu tena.');
      setTimeout(() => setErrorMsg(null), 4000);
    }
  };

  // ============================================================
  // PDF EXPORT
  // ============================================================
  const handleDownloadPDF = () => {
    if (!activeRegion || !activeRegionTotals) return;

    const now = new Date();
    const { start, end } = getDateRange(filterMode, customStart, customEnd);

    const filterLabel =
      filterMode === 'day'
        ? `Leo (${start})`
        : filterMode === 'week'
        ? `Wiki (${start} → ${end})`
        : filterMode === 'month'
        ? `Mwezi (${start} → ${end})`
        : `Custom (${start} → ${end})`;

    const isTzTheme = activeRegion === 'Tz';
    const primaryColor = isTzTheme ? '#059669' : '#e11d48';
    const primaryLight = isTzTheme ? '#d1fae5' : '#ffe4e6';
    const primaryDark = isTzTheme ? '#065f46' : '#9f1239';

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Kubandika Pesa ya ${activeRegion} — ${filterLabel}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: A4; margin: 12mm; }
    body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #fff; color: #1e293b; padding: 20px; }
    .container { max-width: 190mm; margin: 0 auto; }
    .header { background: linear-gradient(135deg, ${primaryDark} 0%, ${primaryColor} 100%); color: white; padding: 24px 28px; border-radius: 14px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; gap: 20px; }
    .header-title { font-size: 24px; font-weight: 900; letter-spacing: 0.5px; }
    .header-sub { font-size: 12px; opacity: 0.9; margin-top: 4px; }
    .header-badge { background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); padding: 8px 16px; border-radius: 20px; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; }
    .header-right { text-align: right; }
    .header-date { font-size: 10px; opacity: 0.85; margin-top: 6px; font-family: monospace; }
    .filter-badge { display: inline-block; background: ${primaryLight}; color: ${primaryDark}; padding: 8px 16px; border-radius: 10px; font-size: 12px; font-weight: 800; margin-bottom: 16px; border-left: 4px solid ${primaryColor}; }
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
    .stat-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; }
    .stat-card.primary { background: ${primaryLight}; border-color: ${primaryColor}; }
    .stat-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 4px; }
    .stat-card.primary .stat-label { color: ${primaryDark}; }
    .stat-value { font-size: 18px; font-weight: 900; color: #1e293b; }
    .stat-card.primary .stat-value { color: ${primaryDark}; }
    table { width: 100%; border-collapse: collapse; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
    thead th { background: ${primaryDark}; color: white; padding: 12px 14px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 800; }
    thead th:last-child { text-align: right; }
    tbody td { padding: 11px 14px; border-bottom: 1px solid #f1f5f9; font-size: 11px; color: #334155; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    tbody tr:last-child td { border-bottom: none; }
    tbody td:last-child { text-align: right; font-weight: 800; color: ${primaryColor}; }
    .date-cell { font-weight: 700; color: #475569; white-space: nowrap; }
    .from-cell { font-weight: 600; color: #64748b; font-style: italic; }
    .method-cell { display: inline-block; background: ${primaryLight}; color: ${primaryDark}; padding: 2px 8px; border-radius: 6px; font-size: 9px; font-weight: 800; text-transform: uppercase; }
    .day-separator { background: linear-gradient(135deg, ${primaryLight} 0%, #f8fafc 100%); border-left: 4px solid ${primaryColor}; padding: 10px 16px; border-radius: 8px; margin: 16px 0 8px; display: flex; justify-content: space-between; align-items: center; }
    .day-separator-date { font-size: 13px; font-weight: 900; color: ${primaryDark}; }
    .day-separator-total { font-size: 13px; font-weight: 900; color: ${primaryColor}; }
    .grand-total { background: linear-gradient(135deg, ${primaryDark} 0%, ${primaryColor} 100%); color: white; padding: 18px 24px; border-radius: 12px; margin-top: 20px; display: flex; justify-content: space-between; align-items: center; font-size: 15px; font-weight: 800; }
    .grand-total-label { letter-spacing: 0.5px; }
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
      <div class="header-right">
        <div class="header-badge">${activeRegion === 'Tz' ? '🇹🇿 TZ' : '🇨🇳 CHINA'}</div>
        <div class="header-date">${now.toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      </div>
    </div>

    <div class="filter-badge">📅 ${filterLabel}</div>

    <div class="stats-grid">
      <div class="stat-card primary">
        <div class="stat-label">Jumla ya Kipindi Hiki</div>
        <div class="stat-value">TSh ${filteredTotal.toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Leo</div>
        <div class="stat-value">TSh ${activeRegionTotals.today.toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Mwezi Huu</div>
        <div class="stat-value">TSh ${activeRegionTotals.month.toLocaleString()}</div>
      </div>
    </div>

    ${filteredPayments.length === 0
      ? '<div style="text-align:center;padding:40px;color:#94a3b8;font-style:italic;">Hakuna malipo katika kipindi hiki</div>'
      : filterMode === 'day'
      ? `<table>
          <thead>
            <tr>
              <th>Tarehe</th>
              <th>Imetoka Kwa</th>
              <th>Njia</th>
              <th>Kumbukumbu</th>
              <th>Kiasi</th>
            </tr>
          </thead>
          <tbody>
            ${filteredPayments.map(p => `
              <tr>
                <td class="date-cell">${p.date}</td>
                <td class="from-cell">${p.receivedFrom || '—'}</td>
                <td><span class="method-cell">${p.method}</span></td>
                <td>${p.notes || '—'}</td>
                <td>TSh ${p.amount.toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>`
      : groupedByDay.map(([date, items]) => {
          const dayTotal = items.reduce((s, p) => s + p.amount, 0);
          return `
            <div class="day-separator">
              <span class="day-separator-date">📅 ${date}</span>
              <span class="day-separator-total">TSh ${dayTotal.toLocaleString()}</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Imetoka Kwa</th>
                  <th>Njia</th>
                  <th>Kumbukumbu</th>
                  <th>Kiasi</th>
                </tr>
              </thead>
              <tbody>
                ${items.map(p => `
                  <tr>
                    <td class="from-cell">${p.receivedFrom || '—'}</td>
                    <td><span class="method-cell">${p.method}</span></td>
                    <td>${p.notes || '—'}</td>
                    <td>TSh ${p.amount.toLocaleString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `;
        }).join('')
    }

    <div class="grand-total">
      <span class="grand-total-label">JUMLA KUU — ${filterLabel}</span>
      <span class="grand-total-value">TSh ${filteredTotal.toLocaleString()}</span>
    </div>

    <div class="footer">
      <strong>SONKO SOUND</strong> • Morogoro, Tanzania • 0688423753<br>
      Taarifa hii ilitengenezwa ${now.toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })} saa ${now.toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' })}
    </div>

    <div class="no-print">
      <button onclick="window.print()">🖨️ Chapisha / Save as PDF</button>
      <button class="close" onclick="window.close()">Funga</button>
    </div>
  </div>
  <script>window.onload = function() { setTimeout(function() { window.print(); }, 400); };</script>
</body>
</html>`;

    const w = window.open('', '_blank', 'width=900,height=800');
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
    } else {
      alert('Tafadhali ruhusu pop-ups kwa ajili ya kuchapisha');
    }
  };

  // ============================================================
  // RENDER: REGION MENU
  // ============================================================
  if (!activeRegion) {
    return (
      <div className="space-y-6">
        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-2 text-emerald-700 text-xs">
            <Check size={16} />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center gap-2 text-rose-700 text-xs">
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}
        <RegionMenu
          onSelect={setActiveRegion}
          totals={regionTotals}
          isLoading={isInitialLoading}
        />
      </div>
    );
  }

  // ============================================================
  // RENDER: FULL PAGE
  // ============================================================
  return (
    <div className="space-y-5 text-xs">
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-2 text-emerald-700 text-xs">
          <Check size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center gap-2 text-rose-700 text-xs">
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Region header */}
      <div
        className={`rounded-3xl p-6 md:p-8 text-white shadow-lg ${
          isTz
            ? 'bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-800'
            : 'bg-gradient-to-br from-rose-600 via-rose-700 to-rose-800'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveRegion(null)}
              className="p-2.5 rounded-2xl bg-white/15 border border-white/25 hover:bg-white/25 transition-colors"
              title="Rudi"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{isTz ? '🇹🇿' : '🇨🇳'}</span>
                <h1 className="text-lg md:text-2xl font-extrabold tracking-tight">
                  Kubandika Pesa ya {isTz ? 'Tanzania' : 'China'}
                </h1>
              </div>
              <p className="text-[11px] text-white/80 font-medium mt-1">
                Rekodi za fedha zilizopokelewa
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsAddOpen(true)}
            className="bg-white text-slate-900 font-bold py-3 px-5 rounded-2xl hover:bg-white/95 transition-colors flex items-center justify-center gap-2 shadow-lg self-start md:self-center"
          >
            <Plus size={16} /> Ongeza Pesa Iliyopokelewa
          </button>
        </div>
      </div>

      {/* Dashboard stats */}
      {activeRegionTotals && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div
            className={`rounded-3xl p-5 border shadow-sm ${
              isTz
                ? 'bg-gradient-to-br from-emerald-50 to-white border-emerald-200'
                : 'bg-gradient-to-br from-rose-50 to-white border-rose-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className={`text-[10px] font-extrabold uppercase tracking-wider ${
                  isTz ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                Kipindi Kilichochaguliwa
              </span>
              <TrendingUp size={16} className={isTz ? 'text-emerald-500' : 'text-rose-500'} />
            </div>
            <p className="text-2xl font-black text-slate-800">
              TSh {filteredTotal.toLocaleString()}
            </p>
            <p className="text-[10px] text-slate-500 font-medium mt-1">
              {filteredPayments.length} malipo
            </p>
          </div>

          <div className="rounded-3xl p-5 bg-white border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                Leo (Today)
              </span>
              <CalendarClock size={16} className="text-slate-400" />
            </div>
            <p className="text-2xl font-black text-slate-800">
              TSh {activeRegionTotals.today.toLocaleString()}
            </p>
          </div>

          <div className="rounded-3xl p-5 bg-white border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                Mwezi Huu (This Month)
              </span>
              <Calendar size={16} className="text-slate-400" />
            </div>
            <p className="text-2xl font-black text-slate-800">
              TSh {activeRegionTotals.month.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Filter + download row */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex-1">
          <FilterTabs
            mode={filterMode}
            onChange={setFilterMode}
            customStart={customStart}
            customEnd={customEnd}
            onCustomChange={(s, e) => {
              setCustomStart(s);
              setCustomEnd(e);
            }}
          />
        </div>

        <button
          onClick={handleDownloadPDF}
          disabled={filteredPayments.length === 0}
          className={`shrink-0 py-3 px-5 rounded-2xl font-bold shadow-sm transition-colors flex items-center justify-center gap-2 text-white disabled:opacity-50 disabled:cursor-not-allowed ${
            isTz
              ? 'bg-emerald-600 hover:bg-emerald-700'
              : 'bg-rose-600 hover:bg-rose-700'
          }`}
        >
          <Download size={15} /> Pakua PDF
        </button>
      </div>

      {/* Payments list */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {isInitialLoading ? (
          <div className="p-12 text-center">
            <Loader2
              size={28}
              className={`animate-spin mx-auto mb-3 ${
                isTz ? 'text-emerald-500' : 'text-rose-500'
              }`}
            />
            <p className="text-sm font-bold text-slate-600">Inapakia rekodi...</p>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="p-12 text-center">
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                isTz ? 'bg-emerald-50' : 'bg-rose-50'
              }`}
            >
              <Wallet size={28} className={isTz ? 'text-emerald-400' : 'text-rose-400'} />
            </div>
            <p className="text-sm font-bold text-slate-600">
              Hakuna malipo katika kipindi hiki
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Ongeza malipo kwa kutumia kitufe cha juu
            </p>
          </div>
        ) : filterMode === 'day' ? (
          <div>
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                Rekodi za Leo — {filteredPayments.length} malipo
              </span>
              <span
                className={`text-xs font-black ${
                  isTz ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                TSh {filteredTotal.toLocaleString()}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr
                    className={
                      isTz
                        ? 'bg-emerald-600 text-white'
                        : 'bg-rose-600 text-white'
                    }
                  >
                    <th className="text-left px-5 py-3 text-[10px] uppercase tracking-wider font-extrabold">
                      Tarehe
                    </th>
                    <th className="text-left px-5 py-3 text-[10px] uppercase tracking-wider font-extrabold">
                      Imetoka Kwa
                    </th>
                    <th className="text-left px-5 py-3 text-[10px] uppercase tracking-wider font-extrabold">
                      Njia
                    </th>
                    <th className="text-left px-5 py-3 text-[10px] uppercase tracking-wider font-extrabold">
                      Kumbukumbu
                    </th>
                    <th className="text-right px-5 py-3 text-[10px] uppercase tracking-wider font-extrabold">
                      Kiasi (TSh)
                    </th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((p, i) => (
                    <tr
                      key={p.id}
                      className={`border-b border-slate-100 hover:bg-slate-50/60 transition-colors ${
                        i % 2 === 1 ? 'bg-slate-50/30' : ''
                      }`}
                    >
                      <td className="px-5 py-3 font-bold text-slate-700 whitespace-nowrap">
                        {p.date}
                      </td>
                      <td className="px-5 py-3 font-semibold text-slate-700">
                        {p.receivedFrom || <span className="text-slate-400 italic font-normal">—</span>}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase ${
                            isTz
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {p.method}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-500 text-[11px]">
                        {p.notes || '—'}
                      </td>
                      <td
                        className={`px-5 py-3 text-right font-black ${
                          isTz ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {p.amount.toLocaleString()}
                      </td>
                      <td className="px-3 py-3">
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                          title="Futa"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-5">
            {groupedByDay.map(([date, items]) => {
              const dayTotal = items.reduce((s, p) => s + p.amount, 0);
              return (
                <div key={date}>
                  <div
                    className={`flex items-center justify-between px-4 py-3 rounded-xl mb-3 ${
                      isTz
                        ? 'bg-gradient-to-r from-emerald-50 to-emerald-100/50 border-l-4 border-emerald-500'
                        : 'bg-gradient-to-r from-rose-50 to-rose-100/50 border-l-4 border-rose-500'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Calendar
                        size={14}
                        className={isTz ? 'text-emerald-700' : 'text-rose-700'}
                      />
                      <span
                        className={`text-sm font-extrabold ${
                          isTz ? 'text-emerald-900' : 'text-rose-900'
                        }`}
                      >
                        {new Date(date).toLocaleDateString('sw-TZ', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    <span
                      className={`text-sm font-black ${
                        isTz ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      TSh {dayTotal.toLocaleString()}
                    </span>
                  </div>

                  <div className="rounded-xl overflow-hidden border border-slate-100">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50">
                          <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider font-extrabold text-slate-500">
                            Imetoka Kwa
                          </th>
                          <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider font-extrabold text-slate-500">
                            Njia
                          </th>
                          <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider font-extrabold text-slate-500">
                            Kumbukumbu
                          </th>
                          <th className="text-right px-4 py-2.5 text-[10px] uppercase tracking-wider font-extrabold text-slate-500">
                            Kiasi (TSh)
                          </th>
                          <th className="w-12"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map(p => (
                          <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                            <td className="px-4 py-2.5 font-semibold text-slate-700">
                              {p.receivedFrom || <span className="text-slate-400 italic font-normal">—</span>}
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase ${
                                  isTz
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {p.method}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-slate-500 text-[11px]">
                              {p.notes || '—'}
                            </td>
                            <td
                              className={`px-4 py-2.5 text-right font-black ${
                                isTz ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {p.amount.toLocaleString()}
                            </td>
                            <td className="px-3 py-2.5">
                              <button
                                onClick={() => handleDelete(p.id)}
                                className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Grand total footer */}
        {filteredPayments.length > 0 && (
          <div
            className={`px-5 py-4 flex items-center justify-between ${
              isTz
                ? 'bg-gradient-to-r from-emerald-600 to-emerald-700'
                : 'bg-gradient-to-r from-rose-600 to-rose-700'
            } text-white`}
          >
            <span className="text-xs font-extrabold uppercase tracking-wider">
              Jumla Kuu —{' '}
              {filterMode === 'day'
                ? 'Leo'
                : filterMode === 'week'
                ? 'Wiki'
                : filterMode === 'month'
                ? 'Mwezi'
                : 'Custom'}
            </span>
            <span className="text-lg font-black">
              TSh {filteredTotal.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* Add Payment Modal */}
      {isAddOpen && activeRegion && (
        <AddPaymentModal
          region={activeRegion}
          onClose={() => setIsAddOpen(false)}
          onSave={handleSavePayment}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}
