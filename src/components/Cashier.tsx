/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Banknote, Search, Loader2, AlertCircle, CheckCircle2,
  ChevronDown, ChevronRight, X, User, FileText, Clock,
  CheckSquare, ArrowLeft, Save, Sparkles
} from 'lucide-react';
import { api } from '../services/api';

interface CashierTransfer {
  id: string;
  name: string;
  amount: number;
  notes: string;
  status: 'pending' | 'approved';
  sent_by: string;
  sent_at: string;
  approved_by: string;
  approved_at: string | null;
}

interface CashierProps {
  onUpdate?: () => void;
  userRole?: 'admin' | 'staff' | 'cashier' | null;
}

const formatDate = (s: string) => {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleString('sw-TZ', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return s; }
};

export default function Cashier({ onUpdate, userRole }: CashierProps) {
  const [transfers, setTransfers] = useState<CashierTransfer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Local editable state per expanded row
  const [editingName, setEditingName] = useState('');
  const [editingNotes, setEditingNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res: any = await api.cashier.list();
      setTransfers(res?.transfers || []);
    } catch (err: any) {
      setError(err?.message || 'Imeshindwa kupata rekodi');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const expandRow = (t: CashierTransfer) => {
    if (expandedId === t.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(t.id);
    setEditingName(t.name || '');
    setEditingNotes(t.notes || '');
  };

  const handleApprove = async (t: CashierTransfer) => {
    setIsSaving(true);
    setError(null);
    try {
      const res: any = await api.cashier.update(t.id, {
        name: editingName.trim(),
        notes: editingNotes.trim(),
        status: 'approved',
        approvedBy: userRole || 'cashier',
      });
      if (res?.success && res.transfer) {
        setTransfers(prev => prev.map(x => x.id === t.id ? res.transfer : x));
        setSuccess('Taarifa imepitishwa!');
        setTimeout(() => setSuccess(null), 3000);
        setExpandedId(null);
        onUpdate?.();
      }
    } catch (err: any) {
      setError(err?.message || 'Imeshindwa kupitisha');
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = transfers.filter(t => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      t.name.toLowerCase().includes(term) ||
      t.notes.toLowerCase().includes(term) ||
      String(t.amount).includes(term)
    );
  });

  const pendingCount = transfers.filter(t => t.status === 'pending').length;
  const approvedCount = transfers.filter(t => t.status === 'approved').length;
  const totalApproved = transfers
    .filter(t => t.status === 'approved')
    .reduce((s, t) => s + Number(t.amount), 0);

  return (
    <div className="space-y-5 text-xs text-left">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-700 rounded-3xl p-6 md:p-8 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur border border-white/30 flex items-center justify-center">
              <Banknote size={26} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold">Cashier</h1>
              <p className="text-xs text-indigo-100 mt-1">Pokea na pitisha taarifa za malipo</p>
            </div>
          </div>
          <button
            onClick={load}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl bg-white/20 backdrop-blur border border-white/30 text-white font-bold hover:bg-white/30 transition disabled:opacity-50"
          >
            {isLoading ? 'Inapakia...' : 'Sasisha'}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-white/20">
          <div className="text-center">
            <p className="text-[10px] uppercase font-bold text-indigo-100 tracking-wider">Zinasubiri</p>
            <p className="text-2xl font-black mt-1">{pendingCount}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase font-bold text-indigo-100 tracking-wider">Zilizopitishwa</p>
            <p className="text-2xl font-black mt-1">{approvedCount}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase font-bold text-indigo-100 tracking-wider">Jumla</p>
            <p className="text-lg font-black mt-1">TSh {totalApproved.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-rose-700">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-500"><X size={16} /></button>
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-2 text-emerald-700">
          <Sparkles size={16} />
          <span>{success}</span>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tafuta jina, kiasi au maelezo..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Transfers list */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-slate-100 shadow-sm">
            <Loader2 size={28} className="text-indigo-500 animate-spin mx-auto mb-2" />
            <p className="text-slate-500">Inapakia...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-slate-100 shadow-sm text-slate-400">
            <Banknote size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="font-semibold">Hakuna taarifa bado.</p>
            <p className="mt-1">Admin atakapotuma, zitaonekana hapa.</p>
          </div>
        ) : (
          filtered.map(t => {
            const isExpanded = expandedId === t.id;
            const isApproved = t.status === 'approved';

            return (
              <div
                key={t.id}
                className={`bg-white rounded-2xl border-2 shadow-sm overflow-hidden transition ${
                  isApproved ? 'border-emerald-200'
                  : isExpanded ? 'border-indigo-300'
                  : 'border-slate-100 hover:border-indigo-200'
                }`}
              >
                {/* Row header */}
                <button
                  onClick={() => expandRow(t)}
                  className="w-full flex items-center justify-between gap-3 p-4 text-left"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isApproved ? 'bg-emerald-100 text-emerald-600'
                      : 'bg-indigo-100 text-indigo-600'
                    }`}>
                      {isApproved ? <CheckCircle2 size={20} /> : <Clock size={20} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-extrabold text-slate-800 truncate">
                          {t.name || <span className="italic text-slate-400">Bila jina</span>}
                        </h3>
                        {isApproved ? (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">IMEPITISHWA</span>
                        ) : (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">INASUBIRI</span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(t.sent_at)}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-black text-slate-800">TSh {Number(t.amount).toLocaleString()}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Kiasi</p>
                  </div>
                  {isExpanded ? (
                    <ChevronDown size={16} className="text-slate-400 shrink-0" />
                  ) : (
                    <ChevronRight size={16} className="text-slate-400 shrink-0" />
                  )}
                </button>

                {/* Expanded area */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-gradient-to-br from-indigo-50/50 to-white p-4 space-y-4">
                    {isApproved ? (
                      /* Approved — read-only */
                      <div className="space-y-3">
                        <div className="flex items-start gap-2">
                          <User size={14} className="text-indigo-500 mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Jina</p>
                            <p className="text-sm font-bold text-slate-800">{t.name || '—'}</p>
                          </div>
                        </div>
                        {t.notes && (
                          <div className="flex items-start gap-2">
                            <FileText size={14} className="text-indigo-500 mt-0.5 shrink-0" />
                            <div className="flex-1">
                              <p className="text-[10px] font-bold text-slate-400 uppercase">Taarifa</p>
                              <p className="text-sm text-slate-700">{t.notes}</p>
                            </div>
                          </div>
                        )}
                        <div className="pt-2 border-t border-emerald-100">
                          <p className="text-[10px] text-emerald-700">
                            ✅ Ilipitishwa na <strong>{t.approved_by || 'Cashier'}</strong> tarehe {formatDate(t.approved_at || '')}
                          </p>
                        </div>
                      </div>
                    ) : (
                      /* Pending — editable form */
                      <>
                        <div>
                          <label className="block font-bold text-slate-500 uppercase tracking-wide mb-1.5 text-[10px]">
                            Jina la Mtu {!t.name && <span className="text-amber-600">(lazima)</span>}
                          </label>
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            placeholder="Mfano: Juma Hassan"
                            className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-indigo-400 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-500 uppercase tracking-wide mb-1.5 text-[10px]">
                            Taarifa / Maelezo
                          </label>
                          <textarea
                            value={editingNotes}
                            onChange={(e) => setEditingNotes(e.target.value)}
                            placeholder="Maelezo yoyote..."
                            className="w-full p-2.5 border-2 border-slate-200 rounded-xl h-20 focus:border-indigo-400 focus:outline-none resize-none"
                          />
                        </div>
                        <button
                          onClick={() => handleApprove(t)}
                          disabled={isSaving || !editingName.trim()}
                          className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold py-3 rounded-xl shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {isSaving ? (
                            <><Loader2 size={14} className="animate-spin" /> Inapitisha...</>
                          ) : (
                            <><CheckSquare size={14} /> Pitisha</>
                          )}
                        </button>
                        {!editingName.trim() && (
                          <p className="text-[10px] text-amber-600 text-center">Weka jina ili kupitisha</p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
