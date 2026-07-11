/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { Debt, Customer, Payment, Supplier } from '../types';
import { ChevronLeft, ChevronRight, Calendar, AlertTriangle, ArrowRight, DollarSign, Clock } from 'lucide-react';

interface CalendarViewProps {
  debts: Debt[];
  customers: Customer[];
  payments: Payment[];
  suppliers: Supplier[];
  setCurrentTab: (tab: string) => void;
  setSelectedCustomerId: (id: string | null) => void;
}

export default function CalendarView({
  debts,
  customers,
  payments,
  suppliers,
  setCurrentTab,
  setSelectedCustomerId
}: CalendarViewProps) {
  // Calendar active state: 2026-07 (July 2026 is our reference month)
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(6); // 0-indexed, so 6 is July

  const [selectedDateStr, setSelectedDateStr] = useState<string>('2026-07-10');

  const monthNames = [
    'Januari', 'Februari', 'Machi', 'Aprili', 'Mei', 'Juni', 
    'Julai', 'Agosti', 'Septemba', 'Oktoba', 'Novemba', 'Desemba'
  ];

  const daysOfWeek = ['Jp', 'Jt', 'Jn', 'Jt', 'Al', 'Ij', 'Jm'];

  // Total days in the active month
  const totalDaysInMonth = useMemo(() => {
    return new Date(currentYear, currentMonth + 1, 0).getDate();
  }, [currentYear, currentMonth]);

  // First day offset (e.g. Wednesday = 3)
  const firstDayOffset = useMemo(() => {
    return new Date(currentYear, currentMonth, 1).getDay();
  }, [currentYear, currentMonth]);

  // Next and Prev Month Handlers
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  // Convert day number to YYYY-MM-DD string
  const getDateString = (day: number) => {
    const yStr = currentYear.toString();
    const mStr = (currentMonth + 1).toString().padStart(2, '0');
    const dStr = day.toString().padStart(2, '0');
    return `${yStr}-${mStr}-${dStr}`;
  };

  // Pre-calculate month events for fast rendering on calendar grid
  const monthEventsMap = useMemo(() => {
    const map: { [dateStr: string]: { hasDebt: boolean; hasPayment: boolean; hasSupplier: boolean } } = {};

    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dateStr = getDateString(d);
      
      const dayDebts = debts.filter(debt => debt.dueDate === dateStr);
      const dayPayments = payments.filter(pay => pay.date === dateStr);
      const daySuppliers = suppliers.filter(sup => sup.dueDate === dateStr);

      if (dayDebts.length > 0 || dayPayments.length > 0 || daySuppliers.length > 0) {
        map[dateStr] = {
          hasDebt: dayDebts.length > 0,
          hasPayment: dayPayments.length > 0,
          hasSupplier: daySuppliers.length > 0
        };
      }
    }

    return map;
  }, [debts, payments, suppliers, currentYear, currentMonth, totalDaysInMonth]);

  // Get active items on selected date
  const selectedDateDetails = useMemo(() => {
    if (!selectedDateStr) return { debts: [], payments: [], suppliers: [] };

    const dateDebts = debts.map(debt => {
      const customer = customers.find(c => c.id === debt.customerId);
      const debtPayments = payments.filter(p => p.debtId === debt.id);
      const paid = debtPayments.reduce((acc, p) => acc + p.amount, 0);
      return {
        ...debt,
        remaining: debt.amount - paid,
        customerName: customer ? customer.fullName : 'Mteja Asiyejulikana'
      };
    }).filter(d => d.dueDate === selectedDateStr);

    const datePayments = payments.map(pay => {
      const debt = debts.find(d => d.id === pay.debtId);
      const customer = debt ? customers.find(c => c.id === debt.customerId) : null;
      return {
        ...pay,
        customerName: customer ? customer.fullName : 'Mteja',
        debtDesc: debt ? debt.description : ''
      };
    }).filter(p => p.date === selectedDateStr);

    const dateSuppliers = suppliers.filter(s => s.dueDate === selectedDateStr);

    return {
      debts: dateDebts,
      payments: datePayments,
      suppliers: dateSuppliers
    };
  }, [selectedDateStr, debts, customers, payments, suppliers]);

  return (
    <div className="space-y-6">
      
      {/* Upper description */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Calendar size={20} className="text-accent" />
          Kalenda ya Madeni na Mzunguko wa Fedha (TSh)
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Kagua ukomo wa kulipa (Due dates), malipo yaliyofanyika, na mikopo ya wauzaji kwa mwezi mzima kwa urahisi kabisa.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Calendar Grid Container */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 p-6 shadow-sm flex flex-col justify-between">
          
          {/* Header Month Navigation */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
            <h3 className="text-md font-bold text-slate-800">
              {monthNames[currentMonth]} {currentYear}
            </h3>
            <div className="flex items-center gap-1">
              <button 
                onClick={handlePrevMonth}
                className="p-1.5 rounded-xl border border-slate-100 hover:bg-slate-50 text-slate-500 transition"
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                onClick={handleNextMonth}
                className="p-1.5 rounded-xl border border-slate-100 hover:bg-slate-50 text-slate-500 transition"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Days of Week Grid */}
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-400 mb-3">
            {daysOfWeek.map(day => (
              <div key={day} className="py-1">{day}</div>
            ))}
          </div>

          {/* Monthly Days Grid */}
          <div className="grid grid-cols-7 gap-3">
            {/* 1. First Days offset offset empty items */}
            {Array.from({ length: firstDayOffset }).map((_, idx) => (
              <div key={`empty-${idx}`} className="h-14"></div>
            ))}

            {/* 2. Month Dates */}
            {Array.from({ length: totalDaysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const dateStr = getDateString(day);
              const events = monthEventsMap[dateStr];
              const isSelected = selectedDateStr === dateStr;
              
              // Highlight today (Reference is July 10, 2026)
              const isToday = dateStr === '2026-07-10';

              return (
                <button
                  key={`day-${day}`}
                  onClick={() => setSelectedDateStr(dateStr)}
                  className={`h-14 rounded-2xl border flex flex-col justify-between p-1.5 hover:bg-accent/5 hover:border-accent/20 transition relative ${
                    isSelected 
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm shadow-slate-900/10' 
                      : isToday 
                        ? 'bg-accent/5 border-accent text-accent font-bold'
                        : 'bg-slate-50/50 border-slate-100/50 text-slate-800'
                  }`}
                >
                  <span className="text-xs font-bold">{day}</span>
                  
                  {/* Event indicators */}
                  {events && (
                    <div className="flex justify-center gap-1 w-full mt-1.5">
                      {events.hasDebt && (
                        <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-rose-400' : 'bg-rose-500'}`} title="Deni linaisha muda leo"></span>
                      )}
                      {events.hasPayment && (
                        <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-accent/40' : 'bg-accent'}`} title="Malipo yamefanyika leo"></span>
                      )}
                      {events.hasSupplier && (
                        <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-sky-300' : 'bg-sky-500'}`} title="Deni la muuzaji (Creditor)"></span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legenda details */}
          <div className="flex items-center gap-6 border-t border-slate-50 pt-5 mt-6 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-500"></span>
              Due Dates (Ukomo Mteja)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-accent"></span>
              Malipo Mapokezi
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-sky-500"></span>
              Malipo kwa Wauzaji
            </span>
          </div>

        </div>

        {/* Date Details Drawer */}
        <div className="lg:col-span-1 bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-6">
          <div>
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Matukio ya Tarehe</h3>
            <p className="text-sm font-bold text-slate-800 mt-1">{new Date(selectedDateStr).toLocaleDateString('sw-TZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>

          <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
            
            {/* 1. Debts due today */}
            {selectedDateDetails.debts.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1">
                  <Clock size={11} /> Ukomo wa Kulipa (Wateja)
                </h4>
                {selectedDateDetails.debts.map(debt => (
                  <div key={debt.id} className="p-3 bg-rose-50/50 border border-rose-100 rounded-2xl text-xs flex justify-between items-center">
                    <div>
                      <p className="font-bold text-slate-800 hover:underline cursor-pointer" onClick={() => { setSelectedCustomerId(debt.customerId); setCurrentTab('customers'); }}>
                        {debt.customerName}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{debt.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-rose-700">TSh {debt.remaining.toLocaleString()}</p>
                      <span className="text-[9px] text-slate-400">Inasubiriwa</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 2. Payments recorded today */}
            {selectedDateDetails.payments.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-success uppercase tracking-wider flex items-center gap-1">
                  <DollarSign size={11} /> Malipo Yaliyopokelewa
                </h4>
                {selectedDateDetails.payments.map(pay => (
                  <div key={pay.id} className="p-3 bg-success/5 border border-success/15 rounded-2xl text-xs flex justify-between items-center">
                    <div>
                      <p className="font-bold text-slate-800">{pay.customerName}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Kwa: {pay.debtDesc}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-success">TSh {pay.amount.toLocaleString()}</p>
                      <span className="text-[9px] text-slate-500 font-semibold">{pay.paymentMethod}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 3. Supplier payments due today */}
            {selectedDateDetails.suppliers.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-sky-600 uppercase tracking-wider flex items-center gap-1">
                  <AlertTriangle size={11} /> Madeni kwa Wauzaji (I Owe Others)
                </h4>
                {selectedDateDetails.suppliers.map(sup => (
                  <div key={sup.id} className="p-3 bg-sky-50/50 border border-sky-100 rounded-2xl text-xs flex justify-between items-center">
                    <div>
                      <p className="font-bold text-slate-800">{sup.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{sup.phoneNumber}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sky-700">TSh {(sup.amount - sup.paidAmount).toLocaleString()}</p>
                      <span className="text-[9px] text-slate-400">Nje (Owed)</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedDateDetails.debts.length === 0 && 
             selectedDateDetails.payments.length === 0 && 
             selectedDateDetails.suppliers.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <Calendar size={28} className="mx-auto text-slate-200 mb-2" />
                <p className="text-xs">Hakuna vikumbusho wala malipo yaliyopangwa kwenye tarehe hii 🍃</p>
              </div>
            )}

          </div>
        </div>

      </div>

    </div>
  );
}
