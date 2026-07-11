import { useState } from 'react';
import { NotificationItem, Customer } from '../types';
import { Bell, ArrowLeft, Trash2, Calendar, Phone, CheckCircle2, AlertTriangle, AlertCircle, Sparkles, MessageCircle } from 'lucide-react';

interface NotificationsViewProps {
  notifications: NotificationItem[];
  customers: Customer[];
  setCurrentTab: (tab: string) => void;
  setSelectedCustomerId: (id: string | null) => void;
  onClearAll?: () => void;
}

export default function NotificationsView({
  notifications,
  customers,
  setCurrentTab,
  setSelectedCustomerId,
  onClearAll
}: NotificationsViewProps) {
  const [filterType, setFilterType] = useState<string>('All');

  const filteredNotifications = notifications.filter(item => {
    if (filterType === 'All') return true;
    if (filterType === 'Overdue') return item.type === 'Overdue';
    if (filterType === 'Due Today') return item.type === 'Due Today' || item.type === 'Due Tomorrow';
    if (filterType === 'Paid') return item.type === 'Fully Paid' || item.type === 'Payment Received';
    return true;
  });

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
              Arifu na Vikumbusho Leo (Notifications Hub)
            </h2>
            <p className="text-xs text-slate-400 mt-1">Angalia vikumbusho vyote vya malipo, madeni yaliyopitisha muda na updates za biashara yako.</p>
          </div>
        </div>

        {onClearAll && notifications.length > 0 && (
          <button
            onClick={onClearAll}
            className="bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[11px] py-2 px-3 rounded-xl flex items-center gap-1.5 transition-colors self-start md:self-auto"
          >
            <Trash2 size={13} /> Futa Zote (Clear All)
          </button>
        )}
      </div>

      {/* Tabs / Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 select-none">
        {[
          { id: 'All', label: `Zote (${notifications.length})` },
          { id: 'Overdue', label: `Zilizopitisha Muda (${notifications.filter(n => n.type === 'Overdue').length})` },
          { id: 'Due Today', label: `Leo & Kesho (${notifications.filter(n => n.type === 'Due Today' || n.type === 'Due Tomorrow').length})` },
          { id: 'Paid', label: `Malipo ya Hivi Karibuni (${notifications.filter(n => n.type === 'Fully Paid' || n.type === 'Payment Received').length})` }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilterType(tab.id)}
            className={`py-1.5 px-3 rounded-lg border text-[11px] font-bold whitespace-nowrap transition-colors ${
              filterType === tab.id
                ? 'bg-slate-900 border-slate-900 text-white'
                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredNotifications.length > 0 ? (
          filteredNotifications.map(item => {
            // Get appropriate styles & icon depending on type
            let bgClass = 'bg-slate-50 border-slate-100 text-slate-700';
            let iconColor = 'text-slate-500';
            let badgeText = 'Taarifa';
            let badgeClass = 'bg-slate-200/60 text-slate-600';
            let IconComponent = Bell;

            if (item.type === 'Overdue') {
              bgClass = 'bg-rose-50/70 border-rose-100 text-rose-950';
              iconColor = 'text-rose-600';
              badgeText = 'IMEKITHIRI (Overdue)';
              badgeClass = 'bg-rose-100 text-rose-800';
              IconComponent = AlertCircle;
            } else if (item.type === 'Due Today') {
              bgClass = 'bg-amber-50/70 border-amber-100 text-amber-950';
              iconColor = 'text-amber-600';
              badgeText = 'LEO (Due Today)';
              badgeClass = 'bg-amber-100 text-amber-800';
              IconComponent = AlertTriangle;
            } else if (item.type === 'Due Tomorrow') {
              bgClass = 'bg-amber-50/40 border-amber-100/60 text-slate-800';
              iconColor = 'text-amber-500';
              badgeText = 'KESHO (Due Tomorrow)';
              badgeClass = 'bg-amber-100/60 text-amber-800';
              IconComponent = Calendar;
            } else if (item.type === 'Fully Paid' || item.type === 'Payment Received') {
              bgClass = 'bg-emerald-50/70 border-emerald-100 text-emerald-950';
              iconColor = 'text-emerald-600';
              badgeText = 'MALIPO (Paid)';
              badgeClass = 'bg-emerald-100 text-emerald-800';
              IconComponent = CheckCircle2;
            } else if (item.type === 'New Customer Added') {
              bgClass = 'bg-teal-50/70 border-teal-100 text-teal-950';
              iconColor = 'text-teal-600';
              badgeText = 'MTEJA MPYA';
              badgeClass = 'bg-teal-100 text-teal-800';
              IconComponent = Sparkles;
            }

            return (
              <div
                key={item.id}
                className={`p-4 rounded-2xl border flex items-start gap-3.5 transition-all shadow-sm ${bgClass}`}
              >
                <div className={`p-2 rounded-xl bg-white shadow-sm mt-0.5 ${iconColor}`}>
                  <IconComponent size={18} />
                </div>
                
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${badgeClass}`}>
                      {badgeText}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Tarehe: {item.date}
                    </span>
                  </div>
                  
                  <p className="text-xs font-semibold leading-relaxed text-slate-800">
                    {item.message}
                  </p>

                  {item.customerId && (() => {
                    const customer = customers.find(c => c.id === item.customerId);
                    if (!customer) return null;

                    const formatWhatsAppNumber = (phone: string): string => {
                      let cleaned = phone.trim().replace(/\s+/g, '');
                      if (cleaned.startsWith('0')) {
                        return '+255' + cleaned.slice(1);
                      }
                      if (!cleaned.startsWith('+') && !cleaned.startsWith('255')) {
                        return '+255' + cleaned;
                      }
                      if (cleaned.startsWith('255')) {
                        return '+' + cleaned;
                      }
                      return cleaned;
                    };

                    const phoneFormattedForWa = formatWhatsAppNumber(customer.phoneNumber).replace('+', '');
                    const isFinished = item.type === 'Fully Paid' || item.type === 'Payment Received';
                    const waMessage = isFinished 
                      ? "Habari, asante sana kwa kumaliza deni kalibu tena 🙏"
                      : "Habari, Ningependa kukukumbusha kwamba leo ndio siku ya kulipa";
                    const waUrl = `https://wa.me/${phoneFormattedForWa}?text=${encodeURIComponent(waMessage)}`;

                    return (
                      <div className="pt-2.5 flex items-center justify-between flex-wrap gap-2 border-t border-slate-100/50 mt-2">
                        <span className="text-[10px] text-slate-400 font-medium font-mono">
                          Simu: {customer.phoneNumber}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {/* Call Icon Button */}
                          <a
                            href={`tel:${customer.phoneNumber}`}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition border border-slate-200"
                            title="Piga Simu"
                          >
                            <Phone size={13} className="stroke-[2.5]" />
                          </a>

                          {/* WhatsApp Icon Button */}
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl transition border border-emerald-100 text-[10px] font-extrabold"
                            title="Tuma Ujumbe WhatsApp"
                          >
                            <MessageCircle size={13} className="stroke-[2.5]" />
                            <span>WhatsApp</span>
                          </a>

                          {/* Profile Button */}
                          <button
                            onClick={() => {
                              setSelectedCustomerId(item.customerId!);
                              setCurrentTab('customers');
                            }}
                            className="text-[10px] font-extrabold text-slate-900 hover:text-accent bg-white hover:bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl transition shadow-sm"
                          >
                            Wasifu (Profile) →
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
