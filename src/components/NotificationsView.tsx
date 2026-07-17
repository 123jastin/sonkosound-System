import { useState, useEffect, useRef } from 'react';
import { NotificationItem, Customer } from '../types';
import { api } from '../services/api';
import { 
  Bell, ArrowLeft, Trash2, Calendar, Phone, CheckCircle2, 
  AlertTriangle, AlertCircle, Sparkles, MessageCircle, 
  Send, Loader2, Check, Truck
} from 'lucide-react';

interface NotificationsViewProps {
  notifications: NotificationItem[];
  customers: Customer[];
  suppliers?: any[];
  setCurrentTab: (tab: string) => void;
  setSelectedCustomerId: (id: string | null) => void;
  onClearAll?: () => void;
  debts?: any[];
  payments?: any[];
}

export default function NotificationsView({
  notifications,
  customers,
  suppliers = [],
  setCurrentTab,
  setSelectedCustomerId,
  onClearAll,
  debts = [],
  payments = []
}: NotificationsViewProps) {
  const [filterType, setFilterType] = useState<string>('All');
  const [isSendingAll, setIsSendingAll] = useState(false);
  const [reminderResult, setReminderResult] = useState<{ success: boolean; message: string } | null>(null);
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const autoSentRef = useRef(false);
  const initializedRef = useRef(false);

  // Auto-send ONCE per day - only runs on first load
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const lastSentDate = localStorage.getItem('ledger_last_auto_send_date');
    const today = new Date().toISOString().split('T')[0];
    
    const todayNotifications = notifications.filter(n => n.type === 'Due Today');
    
    // Only auto-send if not already sent today AND there are due items
    if (lastSentDate !== today && todayNotifications.length > 0 && !autoSentRef.current) {
      autoSentRef.current = true;
      handleAutoSend(today);
    } else if (lastSentDate === today && todayNotifications.length > 0) {
      // Already sent today - just mark as sent
      setSentIds(new Set(todayNotifications.map(n => n.id)));
    }
  }, []); // Empty dependency - runs only once on mount

  const handleAutoSend = async (today: string) => {
    setIsSendingAll(true);

    try {
      const result = await api.reminders.send({
        debts,
        customers,
        payments,
        suppliers,
      });

      if (result.success) {
        localStorage.setItem('ledger_last_auto_send_date', today);
        
        setReminderResult({
          success: true,
          message: `✅ Vikumbusho vya leo vimetumwa kiotomatiki (Wateja: ${result.data.customerSent}, Wauzaji: ${result.data.supplierSent || 0}).`,
        });
        
        const todayIds = notifications.filter(n => n.type === 'Due Today').map(n => n.id);
        setSentIds(new Set(todayIds));
      }
    } catch (err: any) {
      console.error('Auto-send failed:', err);
    } finally {
      setIsSendingAll(false);
    }
  };

  const filteredNotifications = notifications.filter(item => {
    if (filterType === 'All') return true;
    if (filterType === 'Overdue') return item.type === 'Overdue';
    if (filterType === 'Due Today') return item.type === 'Due Today' || item.type === 'Due Tomorrow';
    if (filterType === 'Paid') return item.type === 'Fully Paid' || item.type === 'Payment Received';
    return true;
  });

  const todayDueCount = notifications.filter(n => n.type === 'Due Today').length;

  // Manual send all
  const handleSendAllReminders = async () => {
    if (todayDueCount === 0) {
      setReminderResult({ success: false, message: 'Hakuna vikumbusho vya leo.' });
      return;
    }

    if (!confirm(`Tuma vikumbusho vyote vya leo (${todayDueCount})?`)) return;

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
        const today = new Date().toISOString().split('T')[0];
        localStorage.setItem('ledger_last_auto_send_date', today);
        
        setReminderResult({
          success: true,
          message: `✅ Wateja: ${result.data.customerSent} | Wauzaji: ${result.data.supplierSent || 0}`,
        });
        const todayIds = notifications.filter(n => n.type === 'Due Today').map(n => n.id);
        setSentIds(new Set(todayIds));
      } else {
        setReminderResult({ success: false, message: `❌ ${result.error || 'Imeshindwa kutuma.'}` });
      }
    } catch (err: any) {
      setReminderResult({ success: false, message: `❌ ${err.message}` });
    } finally {
      setIsSendingAll(false);
    }
  };

  // Send individual SMS
  const handleSendSingleReminder = async (item: NotificationItem) => {
    if (sendingIds.has(item.id) || sentIds.has(item.id)) return;

    setSendingIds(prev => new Set(prev).add(item.id));

    try {
      // For customer debt
      const relevantDebts = item.debtId 
        ? debts.filter((d: any) => d.id === item.debtId)
        : [];
      
      // For supplier (only sends to admin, not supplier)
      const isSupplierNotification = item.id.startsWith('supplier-');
      
      const result = await api.reminders.send({
        debts: relevantDebts,
        customers,
        payments,
        suppliers: isSupplierNotification ? suppliers : [],
      });

      if (result.success) {
        setSentIds(prev => new Set(prev).add(item.id));
      }
    } catch (err: any) {
      console.error('Send failed:', err);
    } finally {
      setSendingIds(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  // Get icon for notification type
  const getNotificationStyle = (item: NotificationItem) => {
    const isSupplier = item.id.startsWith('supplier-');
    
    if (item.type === 'Overdue') {
      return {
        bgClass: 'bg-rose-50/70 border-rose-100 text-rose-950',
        iconColor: 'text-rose-600',
        badgeText: 'IMEKITHIRI',
        badgeClass: 'bg-rose-100 text-rose-800',
        IconComponent: AlertCircle,
        label: isSupplier ? '🚚 Mlipaji' : '👤 Mteja'
      };
    }
    if (item.type === 'Due Today') {
      return {
        bgClass: 'bg-amber-50/70 border-amber-100 text-amber-950',
        iconColor: 'text-amber-600',
        badgeText: 'LEO',
        badgeClass: 'bg-amber-100 text-amber-800',
        IconComponent: AlertTriangle,
        label: isSupplier ? '🚚 Mlipaji' : '👤 Mteja'
      };
    }
    if (item.type === 'Due Tomorrow') {
      return {
        bgClass: 'bg-amber-50/40 border-amber-100/60 text-slate-800',
        iconColor: 'text-amber-500',
        badgeText: 'KESHO',
        badgeClass: 'bg-amber-100/60 text-amber-800',
        IconComponent: Calendar,
        label: isSupplier ? '🚚 Mlipaji' : '👤 Mteja'
      };
    }
    if (item.type === 'Fully Paid' || item.type === 'Payment Received') {
      return {
        bgClass: 'bg-emerald-50/70 border-emerald-100 text-emerald-950',
        iconColor: 'text-emerald-600',
        badgeText: 'MALIPO',
        badgeClass: 'bg-emerald-100 text-emerald-800',
        IconComponent: CheckCircle2,
        label: '👤 Mteja'
      };
    }
    return {
      bgClass: 'bg-slate-50 border-slate-100 text-slate-700',
      iconColor: 'text-slate-500',
      badgeText: 'TAARIFA',
      badgeClass: 'bg-slate-200/60 text-slate-600',
      IconComponent: Bell,
      label: ''
    };
  };

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
            <p className="text-xs text-slate-400 mt-1">Wateja wanaodaiwa na wauzaji wanaotakiwa kulipwa.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {todayDueCount > 0 && (
            <button onClick={handleSendAllReminders} disabled={isSendingAll}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] py-2 px-3 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50">
              {isSendingAll ? <><Loader2 size={13} className="animate-spin" /> Inatuma...</> : <><Send size={13} /> Tuma Zote ({todayDueCount})</>}
            </button>
          )}
          {onClearAll && notifications.length > 0 && (
            <button onClick={onClearAll} className="bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[11px] py-2 px-3 rounded-xl flex items-center gap-1.5 transition-colors">
              <Trash2 size={13} /> Futa
            </button>
          )}
        </div>
      </div>

      {/* Result */}
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
          { id: 'All', label: `Zote (${notifications.length})` },
          { id: 'Overdue', label: `Zilizopitisha (${notifications.filter(n => n.type === 'Overdue').length})` },
          { id: 'Due Today', label: `Leo & Kesho (${notifications.filter(n => n.type === 'Due Today' || n.type === 'Due Tomorrow').length})` },
          { id: 'Paid', label: `Malipo (${notifications.filter(n => n.type === 'Fully Paid' || n.type === 'Payment Received').length})` }
        ].map(tab => (
          <button key={tab.id} onClick={() => setFilterType(tab.id)}
            className={`py-1.5 px-3 rounded-lg border text-[11px] font-bold whitespace-nowrap transition-colors ${filterType === tab.id ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredNotifications.length > 0 ? (
          filteredNotifications.map(item => {
            const isSupplier = item.id.startsWith('supplier-');
            const { bgClass, iconColor, badgeText, badgeClass, IconComponent, label } = getNotificationStyle(item);
            const isSending = sendingIds.has(item.id);
            const isSent = sentIds.has(item.id);
            // Show send button for Due Today & Overdue (both customer and supplier)
            const canSend = (item.type === 'Due Today' || item.type === 'Overdue') && !isSent;

            return (
              <div key={item.id} className={`p-4 rounded-2xl border flex items-start gap-3.5 transition-all shadow-sm ${bgClass}`}>
                <div className={`p-2 rounded-xl bg-white shadow-sm mt-0.5 ${iconColor}`}>
                  {isSupplier ? <Truck size={18} /> : <IconComponent size={18} />}
                </div>
                
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${badgeClass}`}>{badgeText}</span>
                    {label && (
                      <span className="text-[9px] text-slate-500 font-medium">{label}</span>
                    )}
                    <span className="text-[10px] text-slate-400 font-mono">{item.date}</span>
                    {isSent && (
                      <span className="text-[9px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                        <Check size={10} /> Imetumwa
                      </span>
                    )}
                    {isSupplier && (
                      <span className="text-[9px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">
                        SMS kwako tu
                      </span>
                    )}
                  </div>
                  
                  <p className="text-xs font-semibold leading-relaxed text-slate-800">{item.message}</p>

                  {/* Action buttons for CUSTOMER notifications */}
                  {item.customerId && !isSupplier && (() => {
                    const customer = customers.find(c => c.id === item.customerId);
                    if (!customer) return null;

                    const formatWhatsAppNumber = (phone: string): string => {
                      let cleaned = phone.trim().replace(/\s+/g, '');
                      if (cleaned.startsWith('0')) return '+255' + cleaned.slice(1);
                      if (!cleaned.startsWith('+') && !cleaned.startsWith('255')) return '+255' + cleaned;
                      if (cleaned.startsWith('255')) return '+' + cleaned;
                      return cleaned;
                    };

                    const phoneFormattedForWa = formatWhatsAppNumber(customer.phoneNumber).replace('+', '');
                    const waMessage = "Habari, ningependa kukukumbusha kuhusu deni lako.";
                    const waUrl = `https://wa.me/${phoneFormattedForWa}?text=${encodeURIComponent(waMessage)}`;

                    return (
                      <div className="pt-2.5 flex items-center justify-between flex-wrap gap-2 border-t border-slate-100/50 mt-2">
                        <span className="text-[10px] text-slate-400 font-mono">📱 {customer.phoneNumber}</span>
                        <div className="flex items-center gap-1.5">
                          <a href={`tel:${customer.phoneNumber}`} className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition border border-slate-200" title="Piga">
                            <Phone size={13} />
                          </a>
                          <a href={waUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl transition border border-emerald-100 text-[10px] font-extrabold" title="WhatsApp">
                            <MessageCircle size={13} /><span>WhatsApp</span>
                          </a>
                          {canSend && (
                            <button onClick={() => handleSendSingleReminder(item)} disabled={isSending}
                              className={`p-1.5 rounded-xl transition border ${isSending ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200'}`}
                              title="Tuma SMS">
                              {isSending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                            </button>
                          )}
                          <button onClick={() => { setSelectedCustomerId(item.customerId!); setCurrentTab('customers'); }}
                            className="text-[10px] font-extrabold text-slate-900 hover:text-accent bg-white hover:bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl transition shadow-sm">
                            Wasifu →
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Action buttons for SUPPLIER notifications */}
                  {isSupplier && (
                    <div className="pt-2.5 flex items-center justify-between flex-wrap gap-2 border-t border-slate-100/50 mt-2">
                      <span className="text-[10px] text-slate-400">⚠️ Vikumbusho vinakwenda kwako (admin)</span>
                      <div className="flex items-center gap-1.5">
                        {canSend && (
                          <button onClick={() => handleSendSingleReminder(item)} disabled={isSending}
                            className={`px-2.5 py-1.5 rounded-xl transition border text-[10px] font-extrabold flex items-center gap-1 ${isSending ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200'}`}
                            title="Tuma SMS kwako">
                            {isSending ? <Loader2 size={13} className="animate-spin" /> : <><Send size={13} /> Tuma SMS</>}
                          </button>
                        )}
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
