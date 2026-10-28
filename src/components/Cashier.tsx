/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, AlertCircle, Check, X, Wallet, Coins,
  ChevronDown, ChevronRight, Search, Clock, CheckCircle2,
  User, FileText, TrendingUp, Sparkles, Send
} from 'lucide-react';
import { api } from '../services/api';

interface CashierEntry {
  id: string;
  name: string;
  amount: number;
  taarifa: string;
  status: 'Pending' | 'Completed';
  createdBy: string;
  approvedBy: string;
  approvedAt: string | null;
  createdAt: string;
}

interface CashierProps {
  userRole?: 'admin' | 'staff' | 'cashier' | null;
}

const API_BASE = '/api/cashier';

const formatDate = (s: string) => {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('sw-TZ', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return s; }
};

const formatTime = (s: string) => {
  if (!s) return '';
  try {
    return new Date(s).toLocaleTimeString('sw-TZ', {
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return ''; }
};

export default function Cashier({ userRole }: CashierProps) {
  const [entries, setEntries] = useState<CashierEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [tab, setTab] = useState<'pending' | 'completed'>('pending');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Expandable form fields
  const [editName, setEditName] = useState('');
  const [editTaarifa, setEditTaarifa] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ============================================
  // LOAD
  // ============================================
  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(API_BASE);
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || 'Imeshindwa kupata rekodi');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ============================================
  // FILTERS
  // ============================================
  const filtered = useMemo(() => {
    const list = entries.filter(e => {
      if (tab === 'pending') return e.status === 'Pending';
      return e.status === 'Completed';
    });
    if (!search.trim()) return list;
    const term = search.toLowerCase();
    return list.filter(e =>
      e.name.toLowerCase().includes(term) ||
      e.taarifa.toLowerCase().includes(term) ||
      String(e.amount).includes(term)
    );
  }, [entries, tab, search]);

  const stats = useMemo(() => {
    const pending = entries.filter(e => e.status === 'Pending');
    const completed = entries.filter(e => e.status === 'Completed');
    const pendingTotal = pending.reduce((s, e) => s + e.amount, 0);
    const completedTotal = completed.reduce((s, e) => s + e.amount, 0);
    return {
      pendingCount: pending.length,
      completedCount: completed.length,
      pendingTotal,
      completedTotal,
    };
  }, [entries]);

  // ============================================
  // EXPAND / COLLAPSE
  // ============================================
  const toggleExpand = (entry: CashierEntry) => {
    if (expandedId === entry.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(entry.id);
    setEditName(entry.name);
    setEditTaarifa(entry.taarifa);
  };

  // ============================================
  // PITISHA (APPROVE)
  // ============================================
  const handleApprove = async (entry: CashierEntry) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/${entry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          taarifa: editTaarifa.trim(),
          status: 'Completed',
          approvedBy: userRole || 'cashier',
        }),
      });
      const data = await res.json();
      if (data.success && data.entry) {
        setEntries(prev => prev.map(e => e.id === entry.id ? data.entry : e));
        setExpandedId(null);
        setSuccessMsg('✅ Imepitishwa kikamilifu!');
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        throw new Error(data.error || 'Failed');
      }
    } catch (e: any) {
      setError(e?.message || 'Imeshindwa kupitisha');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================
  // DELETE
  // ============================================
  const handleDelete = async (entry: CashierEntry) => {
    if (!confirm('Futa rekodi hii?')) return;
    try {
      await fetch(`${API_BASE}/${entry.id}`, { method: 'DELETE' });
      setEntries(prev => prev.filter(e => e.id !== entry.id));
      setSuccessMsg('Rekodi imefutwa');
      setTimeout(() => setSuccessMsg(null), 2000);
    } catch (e: any) {
      setError('Imeshindwa kufuta');
    }
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="space-y-5 text-xs">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-700 rounded-3xl p-6 md:p-8 text-white shadow-xl">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur border border-white/30 flex items-center justify-center">
              <Wallet size={26} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">Cashier</h1>
              <p className="text-xs text-white/80 mt-1">Pitisha malipo na rekodi taarifa</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <Sparkles size={20} className="text-amber-300" />
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-white/70">Jumla ya Pending</p>
              <p className="text-lg font-black">TSh {stats.pendingTotal.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Success */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-2 text-emerald-700">
          <CheckCircle2 size={16} /> <span>{successMsg}</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center justify-between gap-3 text-rose-700">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} /> <span>{error}</span>
          </div>
          <button onClick={() => setError(null)}><X size={16} /></button>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-4 text-white shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">Pending</span>
            <Clock size={16} className="text-white/80" />
          </div>
          <p className="text-2xl font-black mt-1">{stats.pendingCount}</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-4 text-white shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">Approved</span>
            <CheckCircle2 size={16} className="text-white/80" />
          </div>
          <p className="text-2xl font-black mt-1">{stats.completedCount}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pending (TSh)</span>
            <Coins size={16} className="text-amber-500" />
          </div>
          <p className="text-lg font-black text-slate-800 mt-1">{stats.pendingTotal.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Approved (TSh)</span>
            <TrendingUp size={16} className="text-emerald-500" />
          </div>
          <p className="text-lg font-black text-slate-800 mt-1">{stats.completedTotal.toLocaleString()}</p>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex flex-col md:flex-row gap-3">
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          <button
            onClick={() => setTab('pending')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
              tab === 'pending' ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm' : 'text-slate-500'
            }`}
          >
            ⏳ Pending ({stats.pendingCount})
          </button>
          <button
            onClick={() => setTab('completed')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
              tab === 'completed' ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm' : 'text-slate-500'
            }`}
          >
            ✅ Approved ({stats.completedCount})
          </button>
        </div>
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tafuta jina, kiasi..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs"
          />
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-100 text-center">
          <Loader2 size={28} className="animate-spin mx-auto text-indigo-500" />
          <p className="text-sm font-bold text-slate-600 mt-3">Inapakia...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-slate-100 text-center text-slate-400">
          <Wallet size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-semibold">
            {tab === 'pending' ? 'Hakuna maombi ya pending' : 'Hakuna historia ya approved'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(entry => {
            const isExpanded = expandedId === entry.id;
            const isPending = entry.status === 'Pending';
            return (
              <div
                key={entry.id}
                className={`bg-white rounded-2xl border-2 overflow-hidden shadow-sm transition-all ${
                  isPending ? 'border-amber-200' : 'border-emerald-200'
                }`}
              >
                {/* Header row */}
                <button
                  onClick={() => toggleExpand(entry)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-slate-50/50 transition text-left"
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                    isPending
                      ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white'
                      : 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white'
                  }`}>
                    {isPending ? <Clock size={22} /> : <CheckCircle2 size={22} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-extrabold text-slate-800 truncate">
                        {entry.name || <span className="text-slate-400 italic">Hakuna jina</span>}
                      </h3>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                        isPending ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {isPending ? 'PENDING' : 'APPROVED'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
                      <span>📅 {formatDate(entry.createdAt)}</span>
                      <span>⏰ {formatTime(entry.createdAt)}</span>
                      <span className="text-[10px] text-slate-500">na {entry.createdBy}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-black text-slate-800">TSh {entry.amount.toLocaleString()}</p>
                  </div>
                  <div className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                    <ChevronRight size={18} className="text-slate-400" />
                  </div>
                </button>

                {/* Expanded area */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/40 p-4 space-y-3">
                    {isPending ? (
                      <>
                        {/* Name field */}
                        <div>
                          <label className="block font-bold text-slate-500 uppercase tracking-wide mb-1 text-[10px]">
                            <User size={11} className="inline mr-1" /> Jina
                          </label>
                          <input
                            type="text"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            placeholder="Weka jina..."
                            className="w-full p-2.5 border-2 border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none"
                          />
                        </div>

                        {/* Taarifa */}
                        <div>
                          <label className="block font-bold text-slate-500 uppercase tracking-wide mb-1 text-[10px]">
                            <FileText size={11} className="inline mr-1" /> Taarifa
                          </label>
                          <textarea
                            value={editTaarifa}
                            onChange={e => setEditTaarifa(e.target.value)}
                            placeholder="Andika taarifa / risiti / maelezo..."
                            className="w-full p-2.5 border-2 border-slate-200 rounded-xl h-24 text-xs resize-none focus:border-indigo-400 focus:outline-none"
                          />
                        </div>

                        {/* Amount read-only */}
                        <div>
                          <label className="block font-bold text-slate-500 uppercase tracking-wide mb-1 text-[10px]">
                            <Coins size={11} className="inline mr-1" /> Kiasi
                          </label>
                          <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-3 text-lg font-black text-indigo-700">
                            TSh {entry.amount.toLocaleString()}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => handleApprove(entry)}
                            disabled={isSubmitting}
                            className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
                          >
                            {isSubmitting ? <><Loader2 size={14} className="animate-spin" /> Inapitisha...</> : <><Send size={14} /> Pitisha</>}
                          </button>
                          <button
                            onClick={() => setExpandedId(null)}
                            className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold"
                          >
                            Funga
                          </button>
                          {userRole === 'admin' && (
                            <button
                              onClick={() => handleDelete(entry)}
                              className="px-4 py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-bold"
                              title="Futa"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Jina</p>
                            <p className="text-sm font-bold text-slate-800">{entry.name || '—'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Kiasi</p>
                            <p className="text-sm font-black text-emerald-700">TSh {entry.amount.toLocaleString()}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Taarifa</p>
                          <p className="text-xs text-slate-700 bg-white border border-slate-100 rounded-xl p-3 leading-relaxed">
                            {entry.taarifa || <span className="italic text-slate-400">Hakuna taarifa</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400">
                          <span className="flex items-center gap-1">
                            <CheckCircle2 size={11} className="text-emerald-500" />
                            Ilipitishwa na <strong className="text-slate-600">{entry.approvedBy || 'cashier'}</strong>
                          </span>
                          {entry.approvedAt && <span>• {formatDate(entry.approvedAt)}</span>}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
