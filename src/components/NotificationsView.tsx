import { useState, useMemo } from 'react';
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

// Priority order for picking the "dominant" status when grouping
const STATUS_PRIORITY: Record<string, number> = {
  'Overdue': 0,
  'Due Today': 1,
  'Due Tomorrow': 2,
  'Installment Halfway': 3,
  'Installment Completed': 4,
  'Fully Paid': 5,
  'Payment Received': 6,
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

  const allNotifications = useMemo(
    () => [...notifications, ...installmentNotifications],
    [notifications, installmentNotifications]
  );

  // ============================================================
  // ✅ GROUP NOTIFICATIONS BY CUSTOMER
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
      if (!item.customerId) continue;   // orphans are dropped (shouldn't happen)
      if (!byCustomer.has(item.customerId)) byCustomer.set(item.customerId, []);
      byCustomer.get(item.customerId)!.push(item);
    }

    const rows: any[] = [];

    byCustomer.forEach((items, customerId) => {
      const customer = customers.find(c => c.id === customerId);

      // Sort by priority → dominant status is items[0]
      const sorted = [...items].sort(
        (a, b) => (STATUS_PRIORITY[a.type] ?? 99) - (STATUS_PRIORITY[b.type] ?? 99)
      );
      const dominant = sorted[0];

      // Build product/debt bullet lines
      const productLines = items.map((it: any) => ({
        id: it.id,
        type: it.type,
        message: it.message,
        debtId: it.debtId,
        amount: it.amount ?? 0,
        description: it.description ?? it.productName ?? '',
      }));

      // Total = sum of any amount-like fields we can find
      const total = items.reduce((sum, it: any) => {
        // Prefer explicit amount fields
        if (typeof it.amount === 'number') return sum + it.amount;
        if (typeof it.remaining === 'number') return sum + it.remaining;
        return sum;
      }, 0);

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
        rawItems: items,
      });
    });

    // Sort grouped rows by status priority
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
  // SEND — ALL
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
      const result = await api.reminders.send({
        debts,
        customers,
        payments,
        suppliers,
      });

      if (result.success) {
        setReminderResult({
          success: true,
          message: `✅ Wateja: ${result.data.customerSent} | Wauzaji: ${result.data.supplierSent || 0}`,
        });

        // Mark all underlying notification IDs as sent
        const ids = groupedRows
          .filter(n => n.type === 'Due Today' || n.type === 'Overdue')
          .flatMap(n => n.itemIds);
        setSentIds(new Set(ids));
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
  // SEND — SINGLE CUSTOMER (sends ALL their debts in one call)
  // ============================================================
  const handleSendSingleReminder = async (group: any) => {
    const groupKey = group.id;
    if (sendingIds.has(groupKey)) return;
    // Already sent if every underlying id is in sentIds
    const allSent = group.itemIds.every((id: string) => sentIds.has(id));
    if (allSent) return;

    setSendingIds(prev => new Set(prev).add(groupKey));

    try {
      // ✅ Send ALL debts for this customer (not just one)
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

  const formatWhatsAppNumber = (phone: string): string => {
    let cleaned = phone.trim().replace(/\s+/g, '');
    if (cleaned.startsWith('0')) return '+255' + cleaned.slice(1);
    if (!cleaned.startsWith('+') && !cleaned.startsWith('255')) return '+255' + cleaned;
    if (cleaned.startsWith('255')) return '+' + cleaned;
    return cleaned;
  };

  // ✅ One consolidated WhatsApp message per customer
  const getWhatsAppMessage = (group: any): string => {
    const name = group.customerName?.split(' ')[0] || 'Mteja';
    const lines = (group.productLines || []).map((p: any) => p.message).filter(Boolean);

    if (group.type === 'Installment Completed') {
      return `Habari ${name}, Hongera kwa kumaliza malipo yote ya bidhaa zako:\n${lines.map((l: string) => '• ' + l).join('\n')}\n\nAsante kwa kuaminiana nasi!`;
    }
    if (group.type === 'Installment Halfway') {
      return `Habari ${name}, umefika nusu ya malipo ya bidhaa zako:\n${lines.map((l: string) => '• ' + l).join('\n')}\n\nEndelea hivyo hivyo!`;
    }
    return `Habari ${name}, Tunakukumbusha Madeni ya\n${lines.map((l: string) => '• ' + l).join('\n')}\n\nAsante`;
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
                    {isGrouped && item.count > 1 && (
                      <span className="text-[9px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded-full">
                        Bidhaa {item.count}
                      </span>
                    )}
                    {isSent && (
                      <span className="text-[9px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                        <Check size={10} /> Imetumwa
                      </span>
                    )}
                    {isSupplier && (
                      <span className="text-[9px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">SMS kwako tu</span>
                    )}
                  </div>

                  {/* Customer name (only for grouped) */}
                  {isGrouped && (
                    <p className="text-[11px] font-bold text-slate-700">{item.customerName}</p>
                  )}

                  {/* Body — bullet list if multiple, single message if one */}
                  {isGrouped && item.count > 1 ? (
                    <ul className="list-disc list-inside space-y-0.5 mt-1">
                      {item.productLines.map((line: any, i: number) => (
                        <li key={i} className="text-xs font-medium leading-relaxed text-slate-700">{line.message}</li>
                      ))}
                      {item.total > 0 && (
                        <li className="list-none mt-1 text-xs font-bold text-slate-900">
                          Jumla: TSh {item.total.toLocaleString()}
                        </li>
                      )}
                    </ul>
                  ) : (
                    <p className="text-xs font-semibold leading-relaxed text-slate-800">
                      {isGrouped ? item.productLines[0]?.message : item.message}
                    </p>
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
                          <button onClick={() => handleSendSingleReminder(item)} disabled={isSending}
                            className={`p-1.5 rounded-xl transition border ${isSending ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200'}`}
                            title="Tuma SMS moja kwa mteja (bidhaa zake zote)">
                            {isSending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                          </button>
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
