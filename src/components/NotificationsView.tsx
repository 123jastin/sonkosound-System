import { useState, useMemo, useEffect } from 'react';
import { NotificationItem, Customer } from '../types';
import { api } from '../services/api';
import { 
  Bell, ArrowLeft, Trash2, Calendar, Phone, CheckCircle2, 
  AlertTriangle, AlertCircle, MessageCircle, 
  Send, Loader2, Check, Truck, Package, Award
} from 'lucide-react';

interface InstallmentNotification {
  id: string;
  type: 'Installment Halfway' | 'Installment Completed';
  message: string;
  date: string;
  customerId?: string;
  productId?: string;
  productName?: string;
  customerName?: string;
  phoneNumber?: string;
  progressPercentage?: number;
  startDate?: string;
  totalAmount?: number;
  paidAmount?: number;
}

interface NotificationsViewProps {
  notifications: NotificationItem[];
  customers: Customer[];
  suppliers?: any[];
  setCurrentTab: (tab: string) => void;
  setSelectedCustomerId: (id: string | null) => void;
  onClearAll?: () => void;
  debts?: any[];
  payments?: any[];
  installmentNotifications?: InstallmentNotification[];
}

const STATUS_PRIORITY: Record<string, number> = {
  'Overdue': 0,
  'Due Today': 1,
  'Due Tomorrow': 2,
  'Installment Halfway': 3,
  'Installment Completed': 4,
  'Fully Paid': 5,
  'Payment Received': 6,
};

// ✅ localStorage key for send counts
const SEND_COUNT_KEY = 'ledger_send_counts_v1';

// ✅ Load send counts from localStorage
const loadSendCounts = (): Record<string, number> => {
  try {
    const raw = localStorage.getItem(SEND_COUNT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
};

// ✅ Save send counts to localStorage
const saveSendCounts = (counts: Record<string, number>) => {
  try {
    localStorage.setItem(SEND_COUNT_KEY, JSON.stringify(counts));
  } catch {}
};

// Clean up a description: strip any leading "Habari X, ..." or
// "Leo ni siku ya mwisho kwa X kulipa TSh ... ya" sentence if present.
const cleanDescription = (raw: string): string => {
  let d = String(raw || '').trim();
  d = d.replace(/\.$/, '');
  const quoted = d.match(/ya\s+"([^"]+)"/i);
  if (quoted) return quoted[1].trim();
  const singleQuoted = d.match(/ya\s+'([^']+)'/i);
  if (singleQuoted) return singleQuoted[1].trim();
  d = d.replace(/^Leo ni siku ya mwisho kwa .+? kulipa\s+TSh\s+[\d,]+\.?\s*ya\s*/i, '');
  d = d.replace(/^Habari\s+\S+,?\s*/i, '');
  d = d.replace(/^Tunakukumbusha Madeni ya\s*/i, '');
  return d.trim() || String(raw || '').trim();
};

export default function NotificationsView({
  notifications,
  customers,
  suppliers = [],
  setCurrentTab,
  setSelectedCustomerId,
  onClearAll,
  debts = [],
  payments = [],
  installmentNotifications = []
}: NotificationsViewProps) {
  const [filterType, setFilterType] = useState<string>('All');
  const [isSendingAll, setIsSendingAll] = useState(false);
  const [reminderResult, setReminderResult] = useState<{ success: boolean; message: string } | null>(null);
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  // ✅ Send counts persisted in localStorage
  const [sendCounts, setSendCounts] = useState<Record<string, number>>(() => loadSendCounts());

  // Persist on every change
  useEffect(() => {
    saveSendCounts(sendCounts);
  }, [sendCounts]);

  const allNotifications = useMemo(
    () => [...notifications, ...installmentNotifications],
    [notifications, installmentNotifications]
  );

  // ============================================================
  // GROUP NOTIFICATIONS BY CUSTOMER
  // ============================================================
  const { groupedRows, supplierRows } = useMemo(() => {
    const byCustomer = new Map<string, any[]>();
    const supplierItems: any[] = [];

    for (const item of allNotifications) {
      const isSupplier = item.id?.startsWith('supplier-');
      if (isSupplier) {
        supplierItems.push(item);
        continue;
      }
      if (!item.customerId) continue;
      if (!byCustomer.has(item.customerId)) byCustomer.set(item.customerId, []);
      byCustomer.get(item.customerId)!.push(item);
    }

    const rows: any[] = [];

    byCustomer.forEach((items, customerId) => {
      const customer = customers.find(c => c.id === customerId);

      const sorted = [...items].sort(
        (a, b) => (STATUS_PRIORITY[a.type] ?? 99) - (STATUS_PRIORITY[b.type] ?? 99)
      );
      const dominant = sorted[0];

      const productLines = items.map((it: any) => {
        let description = it.description || it.productName || '';
        let amount = typeof it.amount === 'number' ? it.amount
                   : typeof it.remaining === 'number' ? it.remaining
                   : 0;

        if (!description) {
          description = cleanDescription(it.message || '');
        } else {
          description = cleanDescription(description);
        }

        if (!amount && it.message) {
          const m = String(it.message).match(/TSh\s+([\d,]+)/i);
          if (m) amount = Number(m[1].replace(/,/g, ''));
        }

        return {
          id: it.id,
          type: it.type,
          description: description || 'Bidhaa',
          amount,
        };
      });

      const total = productLines.reduce((s: number, p: any) => s + (p.amount || 0), 0);

      rows.push({
        id: `group-${customerId}`,
        customerId,
        customerName: customer?.fullName || items[0]?.customerName || 'Mteja',
        phoneNumber: customer?.phoneNumber || items[0]?.phoneNumber,
        type: dominant.type,
        date: dominant.date,
        itemIds: items.map((i: any) => i.id),
        debtIds: items.map((i: any) => i.debtId).filter(Boolean),
        productLines,
        total,
        count: items.length,
        isSingle: items.length === 1,
      });
    });

    rows.sort((a, b) => (STATUS_PRIORITY[a.type] ?? 99) - (STATUS_PRIORITY[b.type] ?? 99));

    return { groupedRows: rows, supplierRows: supplierItems };
  }, [allNotifications, customers]);

  // ============================================================
  // FILTERS
  // ============================================================
  const filteredNotifications = useMemo(() => {
    const combined = [...groupedRows, ...supplierRows];
    return combined.filter(item => {
      if (filterType === 'All') return true;
      if (filterType === 'Overdue') return item.type === 'Overdue';
      if (filterType === 'Due Today') return item.type === 'Due Today' || item.type === 'Due Tomorrow';
      if (filterType === 'Paid') return item.type === 'Fully Paid' || item.type === 'Payment Received';
      if (filterType === 'Installments') return item.type === 'Installment Halfway' || item.type === 'Installment Completed';
      return true;
    });
  }, [groupedRows, supplierRows, filterType]);

  const todayDueCount = groupedRows.filter(
    n => n.type === 'Due Today' || n.type === 'Overdue'
  ).length;

  const installmentCount = allNotifications.filter(
    n => n.type === 'Installment Halfway' || n.type === 'Installment Completed'
  ).length;

  // ============================================================
  // SEND ALL
  // ============================================================
  const handleSendAllReminders = async () => {
    if (todayDueCount === 0) {
      setReminderResult({ success: false, message: 'Hakuna vikumbusho vya leo.' });
      return;
    }

    if (!confirm(`Tuma vikumbusho vyote vya leo (wateja ${todayDueCount})?`)) return;

    setIsSendingAll(true);
    setReminderResult(null);

    try {
      const result = await api.reminders.send({ debts, customers, payments, suppliers });

      if (result.success) {
        setReminderResult({
          success: true,
          message: `✅ Wateja: ${result.data.customerSent} | 🚚 Wauzaji: ${result.data.supplierSent || 0}`,
        });
        const ids = groupedRows
          .filter(n => n.type === 'Due Today' || n.type === 'Overdue')
          .flatMap(n => n.itemIds);
        setSentIds(new Set(ids));

        // ✅ Bump send count for each customer in the "sent" group
        setSendCounts(prev => {
          const next = { ...prev };
          groupedRows
            .filter(n => n.type === 'Due Today' || n.type === 'Overdue')
            .forEach(n => {
              next[n.customerId] = (next[n.customerId] || 0) + 1;
            });
          return next;
        });
      } else {
        setReminderResult({ success: false, message: `❌ ${result.error || 'Imeshindwa kutuma.'}` });
      }
    } catch (err: any) {
      setReminderResult({ success: false, message: `❌ ${err.message}` });
    } finally {
      setIsSendingAll(false);
    }
  };

  // ============================================================
  // SEND SINGLE (all debts for that customer in one call)
  // ============================================================
  const handleSendSingleReminder = async (group: any) => {
    const groupKey = group.id;
    if (sendingIds.has(groupKey)) return;
    const allSent = group.itemIds.every((id: string) => sentIds.has(id));
    if (allSent) return;

    setSendingIds(prev => new Set(prev).add(groupKey));

    try {
      const relevantDebts = group.debtIds?.length
        ? debts.filter((d: any) => group.debtIds.includes(d.id))
        : [];

      const result = await api.reminders.send({
        debts: relevantDebts,
        customers: customers.filter(c => c.id === group.customerId),
        payments,
        suppliers: [],
      });

      if (result.success) {
        setSentIds(prev => {
          const next = new Set(prev);
          group.itemIds.forEach((id: string) => next.add(id));
          return next;
        });

        // ✅ Increment send count for this customer
        setSendCounts(prev => {
          const next = { ...prev };
          next[group.customerId] = (next[group.customerId] || 0) + 1;
          return next;
        });
      }
    } catch (err: any) {
      console.error('Send failed:', err);
    } finally {
      setSendingIds(prev => {
        const next = new Set(prev);
        next.delete(groupKey);
        return next;
      });
    }
  };

  // ============================================================
  // STYLES
  // ============================================================
  const getNotificationStyle = (item: any) => {
    const isSupplier = item.id?.startsWith('supplier-');
    const base = (overrides: any) => ({
      label: isSupplier ? '🚚 Mlipaji' : '👤 Mteja',
      ...overrides
    });

    switch (item.type) {
      case 'Overdue':
        return base({ bgClass: 'bg-rose-50/70 border-rose-100 text-rose-950', iconColor: 'text-rose-600', badgeText: 'IMEKITHIRI', badgeClass: 'bg-rose-100 text-rose-800', IconComponent: AlertCircle });
      case 'Due Today':
        return base({ bgClass: 'bg-amber-50/70 border-amber-100 text-amber-950', iconColor: 'text-amber-600', badgeText: 'LEO', badgeClass: 'bg-amber-100 text-amber-800', IconComponent: AlertTriangle });
      case 'Due Tomorrow':
        return base({ bgClass: 'bg-amber-50/40 border-amber-100/60 text-slate-800', iconColor: 'text-amber-500', badgeText: 'KESHO', badgeClass: 'bg-amber-100/60 text-amber-800', IconComponent: Calendar });
      case 'Fully Paid':
      case 'Payment Received':
        return base({ bgClass: 'bg-emerald-50/70 border-emerald-100 text-emerald-950', iconColor: 'text-emerald-600', badgeText: 'MALIPO', badgeClass: 'bg-emerald-100 text-emerald-800', IconComponent: CheckCircle2 });
      case 'Installment Halfway':
        return base({ bgClass: 'bg-blue-50/70 border-blue-100 text-blue-950', iconColor: 'text-blue-600', badgeText: 'NUSU YA MALIPO', badgeClass: 'bg-blue-100 text-blue-800', IconComponent: Package });
      case 'Installment Completed':
        return base({ bgClass: 'bg-purple-50/70 border-purple-100 text-purple-950', iconColor: 'text-purple-600', badgeText: 'KAMILIFU', badgeClass: 'bg-purple-100 text-purple-800', IconComponent: Award });
      default:
        return { bgClass: 'bg-slate-50 border-slate-100 text-slate-700', iconColor: 'text-slate-500', badgeText: 'TAARIFA', badgeClass: 'bg-slate-200/60 text-slate-600', IconComponent: Bell, label: '' };
    }
  };

  // Human-readable lead line per status
  const getLeadLine = (type: string, fullName: string) => {
    switch (type) {
      case 'Overdue':
        return `Madeni yamepitisha muda ${fullName} —`;
      case 'Due Today':
        return `Leo ni siku ya mwisho ${fullName} —`;
      case 'Due Tomorrow':
        return `Kesho ni siku ya mwisho ${fullName} —`;
      case 'Installment Halfway':
        return `Nusu ya malipo imefikiwa ${fullName} —`;
      case 'Installment Completed':
        return `Malipo yamekamilika ${fullName} —`;
      case 'Fully Paid':
      case 'Payment Received':
        return `Malipo yamepokelewa ${fullName} —`;
      default:
        return `Taarifa ${fullName} —`;
    }
  };

  const formatWhatsAppNumber = (phone: string): string => {
    let cleaned = phone.trim().replace(/\s+/g, '');
    if (cleaned.startsWith('0')) return '+255' + cleaned.slice(1);
    if (!cleaned.startsWith('+') && !cleaned.startsWith('255')) return '+255' + cleaned;
    if (cleaned.startsWith('255')) return '+' + cleaned;
    return cleaned;
  };

  // Consolidated WhatsApp message — bullet list + Jumla
  const getWhatsAppMessage = (group: any): string => {
    const fullName = group.customerName || 'Mteja';
    const lead = getLeadLine(group.type, fullName).replace(/\s—$/, '');

    const list = group.productLines
      .map((p: any) => `  • ${p.description} - TSh ${p.amount.toLocaleString()}`)
      .join('\n');

    if (group.type === 'Installment Completed') {
      return `${lead}:\n${list}\nJumla: TSh ${group.total.toLocaleString()}.\n\nAsante kwa kuaminiana nasi!`;
    }
    if (group.type === 'Installment Halfway') {
      return `${lead}:\n${list}\nJumla: TSh ${group.total.toLocaleString()}.\n\nEndelea hivyo hivyo!`;
    }
    if (group.type === 'Overdue') {
      return `${lead}:\n${list}\nJumla: TSh ${group.total.toLocaleString()}.\n\nTafadhali lipa haraka iwezekanavyo.\nAsante`;
    }
    return `${lead}:\n${list}\nJumla: TSh ${group.total.toLocaleString()}.\n\nAsante`;
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="space-y-6 text-xs text-left">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-white p-5 rounded-3xl border border-slate-100 shadow-sm gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentTab('dashboard')}
            className="p-2 hover:bg-slate-50 text-slate-500 hover:text-slate-700 rounded-xl border border-slate-100 transition-colors" title="Rudi">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 className="text-md font-extrabold text-slate-800 flex items-center gap-2">
              <Bell size={18} className="text-rose-500" />
              Arifu na Vikumbusho
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Kila mteja anaonekana mara moja tu — bidhaa zake zote zimeunganishwa.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {todayDueCount > 0 && (
            <button onClick={handleSendAllReminders} disabled={isSendingAll}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] py-2 px-3 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50">
              {isSendingAll ? <><Loader2 size={13} className="animate-spin" /> Inatuma...</> : <><Send size={13} /> Tuma Zote ({todayDueCount})</>}
            </button>
          )}
          {onClearAll && allNotifications.length > 0 && (
            <button onClick={onClearAll} className="bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[11px] py-2 px-3 rounded-xl flex items-center gap-1.5 transition-colors">
              <Trash2 size={13} /> Futa
            </button>
          )}
        </div>
      </div>

      {/* Result banner */}
      {reminderResult && (
        <div className={`p-4 rounded-2xl border text-xs font-medium ${reminderResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
          <div className="flex items-center gap-2">
            {reminderResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{reminderResult.message}</span>
            <button onClick={() => setReminderResult(null)} className="ml-auto opacity-50 hover:opacity-100">✕</button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 select-none">
        {[
          { id: 'All', label: `Zote (${groupedRows.length + supplierRows.length})` },
          { id: 'Overdue', label: `Zilizopitisha (${groupedRows.filter(n => n.type === 'Overdue').length})` },
          { id: 'Due Today', label: `Leo & Kesho (${groupedRows.filter(n => n.type === 'Due Today' || n.type === 'Due Tomorrow').length})` },
          { id: 'Paid', label: `Malipo (${groupedRows.filter(n => n.type === 'Fully Paid' || n.type === 'Payment Received').length})` },
          { id: 'Installments', label: `Mafungu (${installmentCount})` }
        ].map(tab => (
          <button key={tab.id} onClick={() => setFilterType(tab.id)}
            className={`py-1.5 px-3 rounded-lg border text-[11px] font-bold whitespace-nowrap transition-colors ${filterType === tab.id ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notification list */}
      <div className="space-y-3">
        {filteredNotifications.length > 0 ? (
          filteredNotifications.map(item => {
            const isSupplier = item.id?.startsWith('supplier-');
            const isGrouped = !isSupplier;
            const { bgClass, iconColor, badgeText, badgeClass, IconComponent, label } = getNotificationStyle(item);

            const isSending = sendingIds.has(item.id);
            const isSent = item.itemIds
              ? item.itemIds.every((id: string) => sentIds.has(id))
              : sentIds.has(item.id);
            const canSend = isGrouped && (item.type === 'Due Today' || item.type === 'Overdue') && !isSent;

            // ✅ Full name for the lead line
            const fullName = item.customerName || 'Mteja';
            const leadLine = isGrouped ? getLeadLine(item.type, fullName) : '';

            // ✅ Send count for this customer (from localStorage)
            const sendCount = item.customerId ? (sendCounts[item.customerId] || 0) : 0;

            return (
              <div key={item.id} className={`p-4 rounded-2xl border flex items-start gap-3.5 transition-all shadow-sm ${bgClass}`}>
                <div className={`p-2 rounded-xl bg-white shadow-sm mt-0.5 ${iconColor}`}>
                  {isSupplier ? <Truck size={18} /> : <IconComponent size={18} />}
                </div>

                <div className="flex-1 space-y-1">
                  {/* Header row */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${badgeClass}`}>{badgeText}</span>
                    {label && <span className="text-[9px] text-slate-500 font-medium">{label}</span>}
                    <span className="text-[10px] text-slate-400 font-mono">{item.date}</span>
                    {isSent && (
                      <span className="text-[9px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                        <Check size={10} /> Imetumwa
                      </span>
                    )}
                    {isSupplier && (
                      <span className="text-[9px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">SMS kwako tu</span>
                    )}
                  </div>

                  {/* ============================================ */}
                  {/* GROUPED CUSTOMER CARD (with products list) */}
                  {/* ============================================ */}
                  {isGrouped && (
                    <div className="mt-1 space-y-1.5">
                      {/* Lead line — full name */}
                      <p className="text-[12px] font-extrabold text-slate-900">
                        {leadLine}
                      </p>

                      {/* Numbered product list */}
                      {item.productLines.length > 0 && (
                        <ol className="list-decimal list-inside space-y-0.5 pl-1">
                          {item.productLines.map((p: any, i: number) => (
                            <li key={i} className="text-xs font-medium leading-relaxed text-slate-700">
                              {p.description}
                              {p.amount > 0 && (
                                <span className="text-slate-500"> — TSh {p.amount.toLocaleString()}</span>
                              )}
                            </li>
                          ))}
                        </ol>
                      )}

                      {/* Total */}
                      {item.total > 0 && item.count > 1 && (
                        <p className="text-xs font-extrabold text-slate-900 pt-0.5">
                          Jumla: TSh {item.total.toLocaleString()}.
                        </p>
                      )}
                    </div>
                  )}

                  {/* SUPPLIER (unchanged — plain message) */}
                  {isSupplier && (
                    <p className="text-xs font-semibold leading-relaxed text-slate-800">{item.message}</p>
                  )}

                  {/* Grouped customer action row */}
                  {isGrouped && (
                    <div className="pt-2.5 flex items-center justify-between flex-wrap gap-2 border-t border-slate-100/50 mt-2">
                      <span className="text-[10px] text-slate-400 font-mono">📱 {item.phoneNumber || 'N/A'}</span>
                      <div className="flex items-center gap-1.5">
                        {item.phoneNumber && (
                          <>
                            <a href={`tel:${item.phoneNumber}`} className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition border border-slate-200" title="Piga">
                              <Phone size={13} />
                            </a>
                            <a
                              href={`https://wa.me/${formatWhatsAppNumber(item.phoneNumber).replace('+', '')}?text=${encodeURIComponent(getWhatsAppMessage(item))}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl transition border border-emerald-100 text-[10px] font-extrabold"
                              title="WhatsApp"
                            >
                              <MessageCircle size={13} /><span>WhatsApp</span>
                            </a>
                          </>
                        )}
                        {canSend && (
                          <div className="relative">
                            <button onClick={() => handleSendSingleReminder(item)} disabled={isSending}
                              className={`p-1.5 rounded-xl transition border ${isSending ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200'}`}
                              title={`Tuma SMS (imetumwa ${sendCount} mara)`}>
                              {isSending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                            </button>
                            {/* ✅ Red send-count badge */}
                            {sendCount > 0 && (
                              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-600 text-white text-[9px] font-extrabold flex items-center justify-center shadow-md">
                                {sendCount}
                              </span>
                            )}
                          </div>
                        )}
                        <button
                          onClick={() => { setSelectedCustomerId(item.customerId!); setCurrentTab('customers'); }}
                          className="text-[10px] font-extrabold text-slate-900 hover:text-accent bg-white hover:bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl transition shadow-sm">
                          Wasifu →
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Supplier action row */}
                  {isSupplier && (
                    <div className="pt-2.5 flex items-center justify-between flex-wrap gap-2 border-t border-slate-100/50 mt-2">
                      <span className="text-[10px] text-slate-400">⚠️ Vikumbusho vinakwenda kwako (admin)</span>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setCurrentTab('suppliers')}
                          className="text-[10px] font-extrabold text-slate-900 hover:text-accent bg-white hover:bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl transition shadow-sm">
                          Wauzaji →
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center text-slate-400 shadow-sm">
            <Bell size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-semibold">Hakuna arifu au vikumbusho vilivyopatikana.</p>
            <p className="text-xs mt-1">Chaguo la kichujio ulichoweka hakina kumbukumbu zozote kwa sasa.</p>
          </div>
        )}
      </div>
    </div>
  );
}
