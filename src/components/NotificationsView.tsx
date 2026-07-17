import { useState, useEffect } from 'react';
import { NotificationItem, Customer } from '../types';
import { api } from '../services/api';
import { 
  Bell, ArrowLeft, Trash2, Calendar, Phone, CheckCircle2, 
  AlertTriangle, AlertCircle, Sparkles, MessageCircle, 
  Send, Loader2, Check
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
  const [autoSent, setAutoSent] = useState(false);

  // Auto-send SMS when notifications page loads with due today items
  useEffect(() => {
    if (autoSent) return;
    
    const todayNotifications = notifications.filter(n => n.type === 'Due Today');
    if (todayNotifications.length > 0) {
      handleSendAllReminders();
      setAutoSent(true);
    }
  }, [notifications]);

  const filteredNotifications = notifications.filter(item => {
    if (filterType === 'All') return true;
    if (filterType === 'Overdue') return item.type === 'Overdue';
    if (filterType === 'Due Today') return item.type === 'Due Today' || item.type === 'Due Tomorrow';
    if (filterType === 'Paid') return item.type === 'Fully Paid' || item.type === 'Payment Received';
    return true;
  });

  const todayDueCount = notifications.filter(n => n.type === 'Due Today').length;

  // Send all reminders (auto or manual)
  const handleSendAllReminders = async () => {
    if (todayDueCount === 0) return;

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
          message: `✅ Vikumbusho vimetumwa kwa wateja ${result.data.customerSent} na wauzaji ${result.data.supplierSent || 0}.`,
        });
        const todayIds = notifications.filter(n => n.type === 'Due Today').map(n => n.id);
        setSentIds(new Set(todayIds));
      } else {
        setReminderResult({
          success: false,
          message: `❌ ${result.error || 'Imeshindwa kutuma.'}`,
        });
      }
    } catch (err: any) {
      setReminderResult({
        success: false,
        message: `❌ ${err.message || 'Hitilafu ya mtandao.'}`,
      });
    } finally {
      setIsSendingAll(false);
    }
  };

  // Send individual SMS for a specific notification
  const handleSendSingleReminder = async (item: NotificationItem) => {
    if (sendingIds.has(item.id) || sentIds.has(item.id)) return;

    setSendingIds(prev => new Set(prev).add(item.id));

    try {
      const relevantDebts = item.debtId 
        ? debts.filter((d: any) => d.id === item.debtId)
        : [];
      
      const relevantSuppliers = !item.debtId && item.type === 'Due Today'
        ? suppliers.filter((s: any) => {
            const remaining = (s.amount || 0) - (s.paidAmount || 0);
            return remaining > 0 && s.dueDate === new Date().toISOString().split('T')[0];
          })
        : [];

      const result = await api.reminders.send({
        debts: relevantDebts,
        customers,
        payments,
        suppliers: relevantSuppliers,
      });

      if (result.success) {
        setSentIds(prev => new Set(prev).add(item.id));
      }
    } catch (err: any) {
      console.error('Failed to send single reminder:', err);
    } finally {
      setSendingIds(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  return (
    <div className="space-y-6 text-xs text-left">
      {/* Header with Back button */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-white p-5 rounded-3xl border border-slate-100 shadow-sm gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentTab('dashboard')}
            className="p-2 hover:bg-slate-50 text-slate-500 hover:text-slate-700 rounded-xl border border-slate-100 transition-colors"
            title="Rudi"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 className="text-md font-extrabold text-slate-800 flex items-center gap-2">
              <Bell size={18} className="text-rose-500 animate-bounce" />
              Arifu na Vikumbusho Leo
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Vikumbusho vya malipo, madeni yaliyopitisha muda na updates za biashara yako.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {todayDueCount > 0 && (
            <button
              onClick={handleSendAllReminders}
              disabled={isSendingAll}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] py-2 px-3 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
            >
              {isSendingAll ? (
                <><Loader2 size={13} className="animate-spin" /> Inatuma...</>
              ) : (
                <><Send size={13} /> Tuma Zote ({todayDueCount})</>
              )}
            </button>
          )}

          {onClearAll && notifications.length > 0 && (
            <button onClick={onClearAll} className="bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[11px] py-2 px-3 rounded-xl flex items-center gap-1.5 transition-colors">
              <Trash2 size={13} /> Futa Zote
            </button>
          )}
        </div>
      </div>

      {/* Result Message */}
      {reminderResult && (
        <div className={`p-4 rounded-2xl border text-xs font-medium ${reminderResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-emerald-700'}`}>
          <div className="flex items-center gap-2">
            {reminderResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{reminderResult.message}</span>
            <button onClick={() => setReminderResult(null)} className="ml-auto text-current opacity-50 hover:opacity-100">✕</button>
          </div>
        </div>
      )}

      {/* Auto-send info */}
      {autoSent && todayDueCount > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 text-[11px] text-blue-700 flex items-center gap-2">
          <CheckCircle2 size={14} />
          <span>Vikumbusho vya leo vimetumwa kiotomatiki. Unaweza kutuma tena kwa kubofya ikoni ya <Send size={10} className="inline" />.</span>
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
            let bgClass = 'bg-slate-50 border-slate-100 text-slate-700';
            let iconColor = 'text-slate-500';
            let badgeText = 'Taarifa';
            let badgeClass = 'bg-slate-200/60 text-slate-600';
            let IconComponent = Bell;

            if (item.type === 'Overdue') {
              bgClass = 'bg-rose-50/70 border-rose-100 text-rose-950';
              iconColor = 'text-rose-600';
              badgeText = 'IMEKITHIRI';
              badgeClass = 'bg-rose-100 text-rose-800';
              IconComponent = AlertCircle;
            } else if (item.type === 'Due Today') {
              bgClass = 'bg-amber-50/70 border-amber-100 text-amber-950';
              iconColor = 'text-amber-600';
              badgeText = 'LEO';
              badgeClass = 'bg-amber-100 text-amber-800';
              IconComponent = AlertTriangle;
            } else if (item.type === 'Due Tomorrow') {
              bgClass = 'bg-amber-50/40 border-amber-100/60 text-slate-800';
              iconColor = 'text-amber-500';
              badgeText = 'KESHO';
              badgeClass = 'bg-amber-100/60 text-amber-800';
              IconComponent = Calendar;
            } else if (item.type === 'Fully Paid' || item.type === 'Payment Received') {
              bgClass = 'bg-emerald-50/70 border-emerald-100 text-emerald-950';
              iconColor = 'text-emerald-600';
              badgeText = 'MALIPO';
              badgeClass = 'bg-emerald-100 text-emerald-800';
              IconComponent = CheckCircle2;
            } else if (item.type === 'New Customer Added') {
              bgClass = 'bg-teal-50/70 border-teal-100 text-teal-950';
              iconColor = 'text-teal-600';
              badgeText = 'MTEJA MPYA';
              badgeClass = 'bg-teal-100 text-teal-800';
              IconComponent = Sparkles;
            }

            const isSending = sendingIds.has(item.id);
            const isSent = sentIds.has(item.id);
            const canSend = (item.type === 'Due Today' || item.type === 'Overdue') && !isSent;

            return (
              <div key={item.id} className={`p-4 rounded-2xl border flex items-start gap-3.5 transition-all shadow-sm ${bgClass}`}>
                <div className={`p-2 rounded-xl bg-white shadow-sm mt-0.5 ${iconColor}`}>
                  <IconComponent size={18} />
                </div>
                
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${badgeClass}`}>{badgeText}</span>
                    <span className="text-[10px] text-slate-400 font-mono">Tarehe: {item.date}</span>
                    {isSent && (
                      <span className="text-[9px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                        <Check size={10} /> Imetumwa
                      </span>
                    )}
                  </div>
                  
                  <p className="text-xs font-semibold leading-relaxed text-slate-800">{item.message}</p>

                  {item.customerId && (() => {
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
                    const isFinished = item.type === 'Fully Paid' || item.type === 'Payment Received';
                    const waMessage = isFinished 
                      ? "Habari, asante sana kwa kumaliza deni karibu tena 🙏"
                      : "Habari, ningependa kukukumbusha kwamba leo ndio siku ya kulipa deni lako.";
                    const waUrl = `https://wa.me/${phoneFormattedForWa}?text=${encodeURIComponent(waMessage)}`;

                    return (
                      <div className="pt-2.5 flex items-center justify-between flex-wrap gap-2 border-t border-slate-100/50 mt-2">
                        <span className="text-[10px] text-slate-400 font-medium font-mono">Simu: {customer.phoneNumber}</span>
                        <div className="flex items-center gap-1.5">
                          <a href={`tel:${customer.phoneNumber}`} className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition border border-slate-200" title="Piga Simu">
                            <Phone size={13} className="stroke-[2.5]" />
                          </a>
                          <a href={waUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl transition border border-emerald-100 text-[10px] font-extrabold" title="Tuma Ujumbe WhatsApp">
                            <MessageCircle size={13} className="stroke-[2.5]" />
                            <span>WhatsApp</span>
                          </a>
                          {/* Individual Send SMS Button */}
                          {canSend && (
                            <button onClick={() => handleSendSingleReminder(item)} disabled={isSending}
                              className={`p-1.5 rounded-xl transition border text-[10px] font-extrabold flex items-center gap-1 ${isSending ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200'}`}
                              title="Tuma SMS kwa mteja huyu">
                              {isSending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} className="stroke-[2.5]" />}
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
