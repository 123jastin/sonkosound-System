/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Customer, Debt, Payment, CustomerStatus } from '../types';
import FormAIOCR from './FormAIOCR';
import { LocalDatabase, getDaysDiff } from '../db';
import { 
  Users, Search, Plus, Filter, Phone, MapPin, 
  Building, UserPlus, CreditCard, ChevronRight, FileText, 
  History, Calendar, Check, AlertCircle, Printer, X, Trash2, Edit2, ArrowLeft
} from 'lucide-react';

interface CustomerManagementProps {
  customers: Customer[];
  debts: Debt[];
  payments: Payment[];
  onUpdate: () => void;
  selectedCustomerId: string | null;
  setSelectedCustomerId: (id: string | null) => void;
}

export default function CustomerManagement({
  customers,
  debts,
  payments,
  onUpdate,
  selectedCustomerId,
  setSelectedCustomerId
}: CustomerManagementProps) {
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | 'All'>('All');
  
  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [isAddDebtOpen, setIsAddDebtOpen] = useState(false);
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);

  // Form states - Customer
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  // Form states - Quick Debt creation
  const [debtAmount, setDebtAmount] = useState('');
  const [debtDueDate, setDebtDueDate] = useState('');
  const [debtDescription, setDebtDescription] = useState('');
  const [debtCategory, setDebtCategory] = useState<string>('Mizigo/Products');
  const [debtNotes, setDebtNotes] = useState('');

  // Form states - Quick Payment recording
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'M-Pesa' | 'Tigo Pesa' | 'Airtel Money' | 'HaloPesa' | 'Bank Transfer' | 'Cash' | 'Cheque' | 'Other'>('M-Pesa');
  const [payNotes, setPayNotes] = useState('');
  const [payDebtId, setPayDebtId] = useState('');

  // Active business settings
  const settings = LocalDatabase.getSettings();

  // Selected customer details
  const activeCustomer = useMemo(() => {
    if (!selectedCustomerId) return null;
    return customers.find(c => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  // Aggregate stats of selected customer
  const activeCustomerStats = useMemo(() => {
    if (!selectedCustomerId) return null;
    return LocalDatabase.getCustomerStats(selectedCustomerId);
  }, [selectedCustomerId, debts, payments]);

  // Selected customer's specific debts and payments
  const activeCustomerHistory = useMemo(() => {
    if (!selectedCustomerId) return { debts: [], payments: [] };
    const custDebts = debts.filter(d => d.customerId === selectedCustomerId);
    const debtIds = custDebts.map(d => d.id);
    const custPayments = payments.filter(p => debtIds.includes(p.debtId));
    return {
      debts: custDebts,
      payments: custPayments
    };
  }, [selectedCustomerId, debts, payments]);

  // All customers with calculated statuses & balances
  const customersWithStats = useMemo(() => {
    return customers.map(c => {
      const stats = LocalDatabase.getCustomerStats(c.id);
      return {
        ...c,
        stats
      };
    });
  }, [customers, debts, payments]);

  // Search and Filter customers list
  const filteredCustomers = useMemo(() => {
    return customersWithStats.filter(c => {
      const matchesSearch = 
        c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phoneNumber.includes(searchQuery) ||
        (c.businessName && c.businessName.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesStatus = statusFilter === 'All' || c.stats.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [customersWithStats, searchQuery, statusFilter]);

  // Handlers - Customer
  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !phoneNumber) return;

    const currentCustomers = LocalDatabase.getCustomers();
    const newCust: Customer = {
      id: 'cust-' + Date.now(),
      fullName,
      phoneNumber,
      address,
      businessName: businessName || undefined,
      notes,
      photoUrl: photoUrl || undefined,
      createdAt: new Date().toISOString().split('T')[0]
    };

    currentCustomers.push(newCust);
    LocalDatabase.saveCustomers(currentCustomers);
    LocalDatabase.logTransaction('Customer Created', `Registered new customer: ${fullName}`);
    
    onUpdate();
    setIsAddModalOpen(false);
    resetCustomerForm();
  };

  const handleEditCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !fullName || !phoneNumber) return;

    const currentCustomers = LocalDatabase.getCustomers();
    const updated = currentCustomers.map(c => {
      if (c.id === selectedCustomerId) {
        return {
          ...c,
          fullName,
          phoneNumber,
          address,
          businessName: businessName || undefined,
          notes,
          photoUrl: photoUrl || undefined
        };
      }
      return c;
    });

    LocalDatabase.saveCustomers(updated);
    LocalDatabase.logTransaction('Customer Updated', `Updated profile of customer: ${fullName}`);
    onUpdate();
    setIsEditModalOpen(false);
  };

  // Handlers - Debt creation inside customer details
  const handleAddDebt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !debtAmount || !debtDueDate) return;

    const currentDebts = LocalDatabase.getDebts();
    const newDebt: Debt = {
      id: 'debt-' + Date.now(),
      customerId: selectedCustomerId,
      amount: Number(debtAmount),
      dateBorrowed: new Date().toISOString().split('T')[0],
      dueDate: debtDueDate,
      description: debtDescription || 'Deni jipya',
      category: debtCategory,
      notes: debtNotes,
      status: 'Active',
      createdAt: new Date().toISOString()
    };

    currentDebts.push(newDebt);
    LocalDatabase.saveDebts(currentDebts);
    LocalDatabase.logTransaction('Debt Added', `Added debt of TSh ${Number(debtAmount).toLocaleString()} for ${activeCustomer?.fullName}`, Number(debtAmount));
    
    onUpdate();
    setIsAddDebtOpen(false);
    resetDebtForm();
  };

  // Handlers - Record payment
  const handleAddPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payDebtId || !payAmount) return;

    const currentPayments = LocalDatabase.getPayments();
    const newPay: Payment = {
      id: 'pay-' + Date.now(),
      debtId: payDebtId,
      amount: Number(payAmount),
      date: new Date().toISOString().split('T')[0],
      paymentMethod: payMethod,
      notes: payNotes,
      createdAt: new Date().toISOString()
    };

    currentPayments.push(newPay);
    LocalDatabase.savePayments(currentPayments);
    LocalDatabase.logTransaction('Payment Added', `Recorded payment of TSh ${Number(payAmount).toLocaleString()} via ${payMethod}`, Number(payAmount));

    onUpdate();
    setIsAddPaymentOpen(false);
    resetPaymentForm();
  };

  const resetCustomerForm = () => {
    setFullName('');
    setPhoneNumber('');
    setAddress('');
    setBusinessName('');
    setNotes('');
    setPhotoUrl('');
  };

  const resetDebtForm = () => {
    setDebtAmount('');
    setDebtDueDate('');
    setDebtDescription('');
    setDebtCategory('Mizigo/Products');
    setDebtNotes('');
  };

  const resetPaymentForm = () => {
    setPayAmount('');
    setPayNotes('');
    setPayDebtId('');
  };

  const openEditModal = () => {
    if (!activeCustomer) return;
    setFullName(activeCustomer.fullName);
    setPhoneNumber(activeCustomer.phoneNumber);
    setAddress(activeCustomer.address);
    setBusinessName(activeCustomer.businessName || '');
    setNotes(activeCustomer.notes);
    setPhotoUrl(activeCustomer.photoUrl || '');
    setIsEditModalOpen(true);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-6">
      
      {activeCustomer && activeCustomerStats ? (
        /* CUSTOMER PROFILE FULL PAGE VIEW */
        <div className="space-y-6 text-xs text-left animate-fade-in">
          {/* Profile Header Block */}
          <div className="bg-white rounded-3xl border border-slate-100 p-6 md:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setSelectedCustomerId('')}
                  className="p-2.5 hover:bg-slate-50 text-slate-500 hover:text-slate-700 rounded-2xl border border-slate-100 transition-colors mr-1"
                  title="Rudi kwenye Orodha"
                >
                  <ArrowLeft size={16} />
                </button>
                {activeCustomer.photoUrl ? (
                  <img 
                    src={activeCustomer.photoUrl} 
                    alt={activeCustomer.fullName} 
                    className="h-16 w-16 rounded-2xl object-cover shadow-sm border border-slate-100"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-2xl bg-emerald-100 text-emerald-800 font-extrabold text-xl flex items-center justify-center shadow-sm">
                    {getInitials(activeCustomer.fullName)}
                  </div>
                )}
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">{activeCustomer.fullName}</h3>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                    <Phone size={12} /> {activeCustomer.phoneNumber}
                  </p>
                  {activeCustomer.businessName && (
                    <p className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-1">
                      <Building size={12} /> {activeCustomer.businessName}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center">
                <button 
                  onClick={openEditModal}
                  className="py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors flex items-center gap-1.5 font-bold"
                  title="Hariri Wasifu"
                >
                  <Edit2 size={14} /> Hariri Wasifu (Edit)
                </button>
                <button 
                  onClick={() => setSelectedCustomerId('')}
                  className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-250 text-slate-700 transition-colors font-bold"
                >
                  Orodha (Back to List)
                </button>
              </div>
            </div>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Balances details */}
            <div className="md:col-span-1 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2">Hali ya Mizania</h4>
              <div className="space-y-3.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Baki ya sasa (Outstanding)</span>
                  <span className="font-extrabold text-rose-600 text-sm">TSh {activeCustomerStats.remainingBalance.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-100 pt-2.5">
                  <span className="text-slate-400 font-medium">Jumla ya Madeni yote</span>
                  <span className="font-bold text-slate-700">TSh {activeCustomerStats.totalDebt.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-100 pt-2.5">
                  <span className="text-slate-400 font-medium">Zilizolipwa (Total Paid)</span>
                  <span className="font-bold text-emerald-600">TSh {activeCustomerStats.totalPaid.toLocaleString()}</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-3">
                  <div 
                    className="bg-emerald-600 h-full rounded-full transition-all"
                    style={{ width: `${activeCustomerStats.percentagePaid}%` }}
                  ></div>
                </div>
                <p className="text-[10px] text-right text-slate-400 font-bold">{Math.round(activeCustomerStats.percentagePaid)}% Lipwa</p>
              </div>
            </div>

            {/* Action buttons drawer / Notes */}
            <div className="md:col-span-2 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2">Maelezo na Notes</h4>
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50/50 p-3 rounded-xl border border-slate-100 min-h-[60px]">
                  {activeCustomer.notes || 'Hakuna maelezo yoyote yaliyoandikwa.'}
                </p>
                {activeCustomer.address && (
                  <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-2">
                    <MapPin size={11} className="text-slate-450" /> Mahali: {activeCustomer.address}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-100">
                <button
                  onClick={() => setIsAddDebtOpen(true)}
                  className="bg-slate-900 text-white font-bold py-2.5 px-3 rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Plus size={14} /> Deni Jipya
                </button>
                <button
                  onClick={() => {
                    const openDebt = activeCustomerHistory.debts.find(d => {
                      const pSum = payments.filter(p => p.debtId === d.id).reduce((a, x) => a + x.amount, 0);
                      return d.amount - pSum > 0;
                    });
                    if (openDebt) {
                      setPayDebtId(openDebt.id);
                      setIsAddPaymentOpen(true);
                    } else {
                      alert("Mteja huyu hana deni linalohitaji malipo!");
                    }
                  }}
                  className="bg-emerald-600 text-white font-bold py-2.5 px-3 rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <CreditCard size={14} /> Lipisha Deni
                </button>
                <button
                  onClick={() => setIsStatementOpen(true)}
                  className="border border-slate-200 text-slate-700 font-bold py-2.5 px-3 rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Printer size={14} /> Taarifa (Statement)
                </button>
              </div>
            </div>
          </div>

          {/* Individual History section - list of products demanded */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-slate-750 uppercase flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <History size={14} className="text-slate-400" />
              Mizania ya Madeni & Bidhaa Zinazodaiwa ({activeCustomerHistory.debts.length})
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeCustomerHistory.debts.map(debt => {
                const dPayments = activeCustomerHistory.payments.filter(p => p.debtId === debt.id);
                const paidSum = dPayments.reduce((acc, p) => acc + p.amount, 0);
                const bal = debt.amount - paidSum;

                return (
                  <div key={debt.id} className="p-4 bg-slate-50/60 rounded-2xl border border-slate-100 text-xs flex flex-col justify-between h-40">
                    <div>
                      <div className="flex justify-between font-bold text-slate-850">
                        <span className="truncate max-w-[150px]">{debt.description}</span>
                        <span>TSh {debt.amount.toLocaleString()}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-slate-500 bg-slate-200/50 px-1.5 py-0.5 rounded text-[9px]">
                          Bidhaa: {debt.category || 'Bidhaa'}
                        </span>
                        {bal > 0 ? (
                          <span className="font-semibold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded text-[9px]">
                            Inadaiwa (Outstanding)
                          </span>
                        ) : (
                          <span className="font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded text-[9px]">
                            Imelipwa (Paid)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-slate-100/50 pt-2 mt-3 space-y-1">
                      <div className="flex justify-between items-center text-[10px] text-slate-400">
                        <span>Kiasi Kilichobaki:</span>
                        <span className={bal > 0 ? "font-extrabold text-rose-600" : "font-extrabold text-emerald-600"}>
                          TSh {bal.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[9px] text-slate-400">
                        <span>Ukomo (Due Date):</span>
                        <span>{debt.dueDate}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {activeCustomerHistory.debts.length === 0 && (
                <p className="text-xs text-slate-400 text-center col-span-full py-8">Mteja huyu hana madeni yoyote kwa sasa.</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* CUSTOMERS LIST VIEW */
        <>
          {/* Search and filtering bar */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-white p-4 rounded-3xl border border-slate-100 shadow-sm gap-4">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Search size={18} />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tafuta mteja kwa jina, simu, au biashara..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:bg-white focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto">
              {(['All', 'Active', 'Cleared', 'Overdue'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-4 py-2 text-xs font-semibold rounded-xl transition ${
                    statusFilter === tab 
                      ? 'bg-slate-900 text-white' 
                      : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {tab === 'All' ? 'Wote' : tab === 'Active' ? 'Active' : tab === 'Cleared' ? 'Safi' : 'Overdue'}
                </button>
              ))}
              
              <button
                onClick={() => { resetCustomerForm(); setIsAddModalOpen(true); }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 ml-2 shadow-sm transition"
              >
                <UserPlus size={15} /> Msajili Mteja
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Customers Grid list */}
            <div className="lg:col-span-3 space-y-4">
              <h2 className="text-md font-bold text-slate-800 flex items-center gap-2">
                <Users size={18} className="text-emerald-600" />
                Wateja na Madeni Yao ({filteredCustomers.length})
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCustomers.length > 0 ? (
                  filteredCustomers.map(customer => {
                    const init = getInitials(customer.fullName);
                    return (
                      <div 
                        key={customer.id}
                        onClick={() => setSelectedCustomerId(customer.id)}
                        className={`p-5 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between h-48 ${
                          selectedCustomerId === customer.id 
                            ? 'bg-emerald-50/50 border-emerald-500 ring-2 ring-emerald-500/20' 
                            : 'bg-white border-slate-100 hover:border-slate-300 shadow-sm'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              {customer.photoUrl ? (
                                <img 
                                  src={customer.photoUrl} 
                                  alt={customer.fullName}
                                  className="h-10 w-10 rounded-xl object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-sm flex items-center justify-center">
                                  {init}
                                </div>
                              )}
                              <div>
                                <h3 className="text-xs font-bold text-slate-800 truncate max-w-[120px]">{customer.fullName}</h3>
                                <p className="text-[10px] text-slate-400 flex items-center gap-0.5 mt-0.5">
                                  <Phone size={10} /> {customer.phoneNumber}
                                </p>
                              </div>
                            </div>

                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                              customer.stats.status === 'Overdue' ? 'bg-rose-100 text-rose-700' :
                              customer.stats.status === 'Active' ? 'bg-amber-100 text-amber-700' :
                              'bg-emerald-100 text-emerald-700'
                            }`}>
                              {customer.stats.status}
                            </span>
                          </div>

                          {customer.businessName && (
                            <div className="mt-3.5 flex items-center gap-1 text-[10px] text-slate-500 font-medium bg-slate-50 px-2.5 py-1 rounded-lg w-fit">
                              <Building size={11} />
                              <span>{customer.businessName}</span>
                            </div>
                          )}
                        </div>

                        <div className="border-t border-slate-50 pt-3 mt-4 flex justify-between items-end">
                          <div>
                            <p className="text-[9px] text-slate-400 uppercase font-semibold">Deni</p>
                            <p className="text-xs font-bold text-slate-800 mt-0.5">TSh {customer.stats.remainingBalance.toLocaleString()}</p>
                          </div>
                          <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-0.5">
                            Fungua <ChevronRight size={12} />
                          </span>
                        </div>

                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-full bg-white p-12 text-center rounded-3xl border border-slate-100 shadow-sm text-slate-400">
                    <Users size={40} className="mx-auto text-slate-300 mb-3" />
                    <p className="text-sm font-semibold">Hakuna wateja waliopatikana.</p>
                    <p className="text-xs mt-1">Sajili wateja kwa kutumia kitufe kilichopo juu.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* MODAL 1: Add Customer */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-scale-in">
            <button 
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition"
            >
              <X size={18} />
            </button>
            
            <h3 className="text-md font-bold text-slate-850 flex items-center gap-1.5">
              <UserPlus className="text-emerald-600" size={18} /> Msajili Mteja Mpya
            </h3>
            
            <FormAIOCR 
              label="Changanua Karatasi kwa AI Camera"
              onSuccess={(data) => {
                if (data.name) setFullName(data.name);
                if (data.number) setPhoneNumber(data.number);
                const combinedNotes = [data.maelezo_ya_bidhaa, data.notes].filter(Boolean).join('. ');
                if (combinedNotes) setNotes(combinedNotes);
              }}
            />
            
            <form onSubmit={handleAddCustomer} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Jina Kamili *</label>
                <input 
                  type="text" 
                  required 
                  value={fullName} 
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Mfano: Jalia Hassan"
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-emerald-500" 
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Nambari ya Simu *</label>
                  <input 
                    type="tel" 
                    required 
                    value={phoneNumber} 
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Mfano: 0712345678"
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-accent" 
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Jina la Biashara (Optional)</label>
                  <input 
                    type="text" 
                    value={businessName} 
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Mfano: Jalia Boutique"
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-accent" 
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Anuani ya Mteja (Address)</label>
                <input 
                  type="text" 
                  value={address} 
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Mfano: Kariakoo, Dar es Salaam"
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-accent" 
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Maelezo/Notes</label>
                <textarea 
                  value={notes} 
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Kumbukumbu maalum za mteja huyu..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl h-20 focus:ring-accent" 
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600 transition"
                >
                  Ghairi
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 bg-accent hover:bg-accent/90 text-white rounded-xl font-semibold shadow-sm transition"
                >
                  Sajili Mteja
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Customer */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-scale-in">
            <button 
              onClick={() => setIsEditModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition"
            >
              <X size={18} />
            </button>
            
            <h3 className="text-md font-bold text-slate-850">Hariri Wasifu wa Mteja</h3>
            
            <form onSubmit={handleEditCustomer} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Jina Kamili *</label>
                <input 
                  type="text" 
                  required 
                  value={fullName} 
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-accent" 
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Nambari ya Simu *</label>
                  <input 
                    type="tel" 
                    required 
                    value={phoneNumber} 
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-accent" 
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Biashara</label>
                  <input 
                    type="text" 
                    value={businessName} 
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-accent" 
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Anuani ya Mteja</label>
                <input 
                  type="text" 
                  value={address} 
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-accent" 
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Notes</label>
                <textarea 
                  value={notes} 
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl h-20 focus:ring-accent" 
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600 transition"
                >
                  Ghairi
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 bg-accent hover:bg-accent/90 text-white rounded-xl font-semibold shadow-sm transition"
                >
                  Hifadhi Wasifu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Create Debt inside details */}
      {isAddDebtOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-scale-in">
            <button 
              onClick={() => setIsAddDebtOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition"
            >
              <X size={18} />
            </button>
            
            <h3 className="text-md font-bold text-slate-850">Ongeza Deni Jipya kwa {activeCustomer?.fullName}</h3>
            
            <FormAIOCR 
              label="Changanua Karatasi kwa AI Camera"
              onSuccess={(data) => {
                if (data.deni) setDebtAmount(data.deni.toString());
                if (data.maelezo_ya_bidhaa) {
                  setDebtDescription(data.maelezo_ya_bidhaa);
                  setDebtCategory("Mizigo/Products");
                }
                const combinedNotes = [data.notes].filter(Boolean).join('. ');
                if (combinedNotes) setDebtNotes(combinedNotes);
              }}
            />
            
            <form onSubmit={handleAddDebt} className="space-y-4 text-xs text-left">
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Kiasi cha deni (TSh) *</label>
                <input 
                  type="number" 
                  required 
                  value={debtAmount} 
                  onChange={(e) => setDebtAmount(e.target.value)}
                  placeholder="Mfano: 50000"
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-accent" 
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Bidhaa (Product Type) *</label>
                  <input
                    type="text"
                    required
                    value={debtCategory}
                    onChange={(e) => setDebtCategory(e.target.value)}
                    placeholder="Mfano: Mizigo/Products, Huduma, Mkopo n.k."
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-white focus:ring-accent focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Ukomo (Due Date) *</label>
                  <input 
                    type="date" 
                    required 
                    value={debtDueDate} 
                    onChange={(e) => setDebtDueDate(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl" 
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Kichwa cha Habari/Maelezo mafupi *</label>
                <input 
                  type="text" 
                  required
                  value={debtDescription} 
                  onChange={(e) => setDebtDescription(e.target.value)}
                  placeholder="Mfano: Karatasi za Ofisi au Mkopo mdogo"
                  className="w-full p-2.5 border border-slate-200 rounded-xl" 
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Notes za ziada</label>
                <textarea 
                  value={debtNotes} 
                  onChange={(e) => setDebtNotes(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl h-20" 
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setIsAddDebtOpen(false)}
                  className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600 transition"
                >
                  Ghairi
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-xl font-semibold shadow-sm transition"
                >
                  Sajili Deni
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Record Payment */}
      {isAddPaymentOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-scale-in">
            <button 
              onClick={() => setIsAddPaymentOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition"
            >
              <X size={18} />
            </button>
            
            <h3 className="text-md font-bold text-slate-850">Rekodi Malipo kutoka kwa {activeCustomer?.fullName}</h3>
            
            <form onSubmit={handleAddPayment} className="space-y-4 text-xs text-left">
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Deni Unalolipia *</label>
                <select
                  required
                  value={payDebtId}
                  onChange={(e) => setPayDebtId(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-white focus:ring-accent"
                >
                  <option value="">Chagua deni...</option>
                  {activeCustomerHistory.debts.map(d => {
                    const pd = payments.filter(p => p.debtId === d.id).reduce((s, p) => s + p.amount, 0);
                    const rem = d.amount - pd;
                    if (rem <= 0) return null;
                    return (
                      <option key={d.id} value={d.id}>
                        {d.description} (Kiporo: TSh {rem.toLocaleString()})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Kiasi Kilicholipwa (TSh) *</label>
                  <input 
                    type="number" 
                    required 
                    value={payAmount} 
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="Mfano: 30000"
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-accent" 
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Njia ya Malipo *</label>
                  <select
                    value={payMethod}
                    onChange={(e: any) => setPayMethod(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="M-Pesa">M-Pesa</option>
                    <option value="Tigo Pesa">Tigo Pesa</option>
                    <option value="Airtel Money">Airtel Money</option>
                    <option value="HaloPesa">HaloPesa</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash / Pesa Taslimu</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Other">Nyinginezo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Notes za Malipo</label>
                <textarea 
                  value={payNotes} 
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="Andika risiti au kumbukumbu yoyote ya muamala..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl h-20 focus:ring-accent" 
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setIsAddPaymentOpen(false)}
                  className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600 transition"
                >
                  Ghairi
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 bg-accent hover:bg-accent/90 text-white rounded-xl font-semibold shadow-sm transition"
                >
                  Hifadhi Malipo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINT STATEMENT MODAL (Aesthetic Printable layout styled for invoice look) */}
      {isStatementOpen && activeCustomer && activeCustomerStats && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto animate-scale-in" id="printable-statement-container">
            
            {/* Control buttons */}
            <div className="absolute top-6 right-6 flex items-center gap-2 print:hidden">
              <button 
                onClick={() => window.print()}
                className="bg-slate-900 text-white flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold hover:bg-slate-800 transition"
              >
                <Printer size={14} /> Chapisha / PDF (Print)
              </button>
              <button 
                onClick={() => setIsStatementOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Printable Area */}
            <div className="space-y-6 pt-4 text-slate-700">
              
              {/* Invoice Header */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-6">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                    {settings.businessName}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">Anuani: {settings.businessAddress}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Simu ya Biashara: {settings.businessPhone}</p>
                </div>
                <div className="text-right">
                  <span className="inline-block text-[10px] uppercase tracking-wider font-extrabold px-3 py-1 bg-slate-100 text-slate-600 rounded-full">
                    Mizania ya Hesabu ya Mteja
                  </span>
                  <p className="text-[11px] text-slate-400 mt-2">Muda: {new Date().toLocaleDateString('sw-TZ')}</p>
                </div>
              </div>

              {/* Customers Profile Details in Statement */}
              <div className="grid grid-cols-2 gap-8 py-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase">MTEJA:</h4>
                  <h3 className="text-sm font-bold text-slate-800 mt-1">{activeCustomer.fullName}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Simu: {activeCustomer.phoneNumber}</p>
                  {activeCustomer.businessName && <p className="text-xs text-slate-500 mt-0.5">Biashara: {activeCustomer.businessName}</p>}
                </div>
                <div className="text-right">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase">SALIO LINARIPOTIWA (TSh):</h4>
                  <h3 className="text-lg font-black text-rose-600 mt-1">TSh {activeCustomerStats.remainingBalance.toLocaleString()}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Asilimia Lipwa: {Math.round(activeCustomerStats.percentagePaid)}%</p>
                </div>
              </div>

              {/* Debt list inside Statement */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-1.5 uppercase tracking-wide">
                  Historia ya Madeni (Debt History)
                </h4>
                <table className="w-full text-left text-xs text-slate-600">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold">
                      <th className="py-2.5 px-3 rounded-l-lg">Maelezo</th>
                      <th className="py-2.5 px-3">Tarehe ya Kukopa</th>
                      <th className="py-2.5 px-3">Ukomo (Due Date)</th>
                      <th className="py-2.5 px-3 text-right rounded-r-lg">Kiasi (TSh)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeCustomerHistory.debts.map(debt => (
                      <tr key={debt.id} className="border-b border-slate-100/50">
                        <td className="py-2 px-3 font-semibold text-slate-800">{debt.description}</td>
                        <td className="py-2 px-3 font-mono text-slate-400">{debt.dateBorrowed}</td>
                        <td className="py-2 px-3 font-mono text-slate-400">{debt.dueDate}</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-800">TSh {debt.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Payment list inside Statement */}
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-1.5 uppercase tracking-wide">
                  Historia ya Malipo Yaliyopokewa (Payment History)
                </h4>
                <table className="w-full text-left text-xs text-slate-600">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold">
                      <th className="py-2.5 px-3 rounded-l-lg">Kumbukumbu / Maelezo ya Malipo</th>
                      <th className="py-2.5 px-3">Tarehe Iliyolipwa</th>
                      <th className="py-2.5 px-3">Njia ya Malipo</th>
                      <th className="py-2.5 px-3 text-right rounded-r-lg">Kiasi (TSh)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeCustomerHistory.payments.length > 0 ? (
                      activeCustomerHistory.payments.map(pay => (
                        <tr key={pay.id} className="border-b border-slate-100/50">
                          <td className="py-2 px-3 text-slate-700">{pay.notes || 'Malipo ya Deni'}</td>
                          <td className="py-2 px-3 font-mono text-slate-400">{pay.date}</td>
                          <td className="py-2 px-3 text-slate-600 font-bold">{pay.paymentMethod}</td>
                          <td className="py-2 px-3 text-right font-bold text-success">TSh {pay.amount.toLocaleString()}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-slate-400">Hakuna malipo yoyote yaliyorekodiwa bado.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Signatures */}
              <div className="pt-12 grid grid-cols-2 gap-12 text-xs">
                <div className="border-t border-slate-200 pt-3 text-center">
                  <p className="font-bold text-slate-800">Mhasibu / Sahihi ya Mmiliki</p>
                  <p className="text-slate-400 mt-1">{settings.businessName}</p>
                </div>
                <div className="border-t border-slate-200 pt-3 text-center">
                  <p className="font-bold text-slate-800">Sahihi ya Mteja (Customer Signature)</p>
                  <p className="text-slate-400 mt-1">{activeCustomer.fullName}</p>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
