/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Debt, Customer, Payment, DebtStatus, PaymentMethod } from '../types';
import { api } from '../services/api';
import FormAIOCR from './FormAIOCR';
import { 
  Plus, Search, Filter, Trash2, Edit2, Calendar, 
  ArrowRight, CreditCard, ChevronRight, Check, X, AlertTriangle, HelpCircle, 
  Tag, Download, Loader2
} from 'lucide-react';

interface DebtManagementProps {
  debts: Debt[];
  customers: Customer[];
  payments: Payment[];
  onUpdate: () => void;
  setCurrentTab: (tab: string) => void;
  setSelectedCustomerId: (id: string | null) => void;
}

export default function DebtManagement({
  debts,
  customers,
  payments,
  onUpdate,
  setCurrentTab,
  setSelectedCustomerId
}: DebtManagementProps) {
  // Filters & search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<
    'All' | 'Active' | 'Paid' | 'Unpaid' | 'Due Today' | 'Due Tomorrow' | 'Overdue' | 'This Week' | 'This Month' | 'Custom'
  >('All');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Modals
  const [isAddDebtOpen, setIsAddDebtOpen] = useState(false);
  const [isEditDebtOpen, setIsEditDebtOpen] = useState(false);
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  
  // Selected targets
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);

  // Form states - Debt
  const [selectedCustomerIdForm, setSelectedCustomerIdForm] = useState('');
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [debtAmount, setDebtAmount] = useState('');
  const [debtDueDate, setDebtDueDate] = useState('');
  const [debtDescription, setDebtDescription] = useState('');
  const [debtCategory, setDebtCategory] = useState<string>('Mizigo/Products');
  const [debtNotes, setDebtNotes] = useState('');

  // Form states - Payment
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('M-Pesa');
  const [payNotes, setPayNotes] = useState('');

  // Helper: Get days difference
  const getDaysDiff = (currentDate: string, dueDate: string): number => {
    const current = new Date(currentDate);
    const due = new Date(dueDate);
    const diffTime = current.getTime() - due.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Dynamic Debt Calculations and Status Updates
  const processedDebts = useMemo(() => {
    const currentDate = '2026-07-10';
    return debts.map(debt => {
      const debtPayments = payments.filter(p => p.debtId === debt.id);
      const paid = debtPayments.reduce((acc, p) => acc + p.amount, 0);
      const remaining = debt.amount - paid;
      const customer = customers.find(c => c.id === debt.customerId);

      let status: DebtStatus = 'Active';
      if (remaining <= 0) {
        status = 'Paid';
      } else {
        const daysDiff = getDaysDiff(currentDate, debt.dueDate);
        if (daysDiff > 0) {
          status = 'Overdue';
        } else if (daysDiff === 0) {
          status = 'Due Today';
        } else if (daysDiff >= -2 && daysDiff < 0) {
          status = 'Due Soon';
        } else {
          status = 'Active';
        }
      }

      return {
        ...debt,
        status,
        paidAmount: paid,
        remainingAmount: remaining,
        customerName: customer ? customer.fullName : 'Mteja Asiyejulikana',
        customerPhone: customer ? customer.phoneNumber : ''
      };
    });
  }, [debts, customers, payments]);

  // Advanced searching + filtering
  const filteredDebts = useMemo(() => {
    const todayStr = '2026-07-10';
    const today = new Date(todayStr);

    return processedDebts.filter(debt => {
      // Search Query
      const matchesSearch = 
        debt.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        debt.customerPhone.includes(searchQuery) ||
        debt.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        debt.amount.toString().includes(searchQuery);

      if (!matchesSearch) return false;

      // Tab Filter
      if (filterType === 'All') return true;
      if (filterType === 'Paid') return debt.status === 'Paid';
      if (filterType === 'Unpaid') return debt.status !== 'Paid';
      if (filterType === 'Active') return debt.status === 'Active' || debt.status === 'Due Soon';
      if (filterType === 'Due Today') return debt.status === 'Due Today';
      if (filterType === 'Overdue') return debt.status === 'Overdue';
      
      if (filterType === 'Due Tomorrow') {
        return getDaysDiff(todayStr, debt.dueDate) === -1 && debt.remainingAmount > 0;
      }

      if (filterType === 'This Week') {
        const dDate = new Date(debt.dueDate);
        const diffDays = Math.abs((dDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays <= 7;
      }

      if (filterType === 'This Month') {
        return debt.dueDate.startsWith('2026-07');
      }

      if (filterType === 'Custom') {
        if (!customStart || !customEnd) return true;
        return debt.dueDate >= customStart && debt.dueDate <= customEnd;
      }

      return true;
    });
  }, [processedDebts, searchQuery, filterType, customStart, customEnd]);

  // ============================================
  // API HANDLERS
  // ============================================

  const handleCreateDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let customerIdToUse = selectedCustomerIdForm;

    // Create new customer if needed
    if (isNewCustomer) {
      if (!newCustomerName) return;
      
      setIsLoading(true);
      try {
        const newCustId = 'cust-' + Date.now();
        await api.customers.create({
          id: newCustId,
          fullName: newCustomerName,
          phoneNumber: newCustomerPhone || '-',
          address: '-',
          businessName: '',
          notes: 'Sajiliwa kupitia Debt Book',
          photoUrl: ''
        });
        
        customerIdToUse = newCustId;
      } catch (err: any) {
        console.error('Failed to create customer:', err);
        alert('Imeshindwa kumsajili mteja mpya: ' + err.message);
        setIsLoading(false);
        return;
      }
    }

    if (!customerIdToUse || !debtAmount || !debtDueDate) return;

    setIsLoading(true);
    try {
      const customer = isNewCustomer 
        ? { fullName: newCustomerName } 
        : customers.find(c => c.id === customerIdToUse);
      
      await api.debts.create({
        id: 'debt-' + Date.now(),
        customerId: customerIdToUse,
        amount: Number(debtAmount),
        dateBorrowed: new Date().toISOString().split('T')[0],
        dueDate: debtDueDate,
        description: debtDescription || 'Deni',
        category: debtCategory,
        notes: debtNotes,
        status: 'Active'
      });
      
      onUpdate();
      setIsAddDebtOpen(false);
      resetDebtForm();
    } catch (err: any) {
      console.error('Failed to create debt:', err);
      alert('Imeshindwa kusajili deni: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebt || !debtAmount || !debtDueDate) return;

    setIsLoading(true);
    try {
      await api.debts.update(selectedDebt.id, {
        amount: Number(debtAmount),
        dueDate: debtDueDate,
        description: debtDescription,
        category: debtCategory,
        notes: debtNotes
      });
      
      onUpdate();
      setIsEditDebtOpen(false);
      setSelectedDebt(null);
    } catch (err: any) {
      console.error('Failed to update debt:', err);
      alert('Imeshindwa kuhariri deni: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDebt = async (debtId: string) => {
    if (!confirm("Je, una uhakika unataka kufuta deni hili? Kitendo hiki pia kitafuta kumbukumbu za malipo husika.")) return;

    setIsLoading(true);
    try {
      await api.debts.delete(debtId);
      onUpdate();
    } catch (err: any) {
      console.error('Failed to delete debt:', err);
      alert('Imeshindwa kufuta deni: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebt || !payAmount) return;

    setIsLoading(true);
    try {
      await api.payments.create({
        id: 'pay-' + Date.now(),
        debtId: selectedDebt.id,
        amount: Number(payAmount),
        date: new Date().toISOString().split('T')[0],
        paymentMethod: payMethod,
        notes: payNotes
      });

      onUpdate();
      setIsAddPaymentOpen(false);
      resetPaymentForm();
      setSelectedDebt(null);
    } catch (err: any) {
      console.error('Failed to record payment:', err);
      alert('Imeshindwa kurekodi malipo: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const resetDebtForm = () => {
    setSelectedCustomerIdForm('');
    setIsNewCustomer(false);
    setNewCustomerName('');
    setNewCustomerPhone('');
    setDebtAmount('');
    setDebtDueDate('');
    setDebtDescription('');
    setDebtCategory('Mizigo/Products');
    setDebtNotes('');
  };

  const resetPaymentForm = () => {
    setPayAmount('');
    setPayNotes('');
    setPayMethod('M-Pesa');
  };

  const openEditModal = (debt: Debt) => {
    setSelectedDebt(debt);
    setDebtAmount(debt.amount.toString());
    setDebtDueDate(debt.dueDate);
    setDebtDescription(debt.description);
    setDebtCategory(debt.category);
    setDebtNotes(debt.notes);
    setIsEditDebtOpen(true);
  };

  const openPaymentModal = (debt: Debt) => {
    setSelectedDebt(debt);
    setIsAddPaymentOpen(true);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-white p-5 rounded-3xl border border-slate-100 shadow-sm gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Usimamizi wa Madeni (Debt Book)</h2>
          <p className="text-xs text-slate-400 mt-1">Orodha kamili ya madeni yote yaliyosajiliwa katika biashara yako.</p>
        </div>
        
        <button 
          onClick={() => { resetDebtForm(); setIsAddDebtOpen(true); }}
          disabled={isLoading}
          className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
        >
          <Plus size={15} /> Sajili Deni Jipya
        </button>
      </div>

      {/* Filter and custom dates section */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
        
        {/* Quick Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 border-b border-slate-50">
          {(['All', 'Active', 'Paid', 'Unpaid', 'Due Today', 'Due Tomorrow', 'Overdue', 'This Week', 'This Month', 'Custom'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilterType(tab)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition ${
                filterType === tab 
                  ? 'bg-accent text-white' 
                  : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
              }`}
            >
              {tab === 'All' ? 'Yote' : 
               tab === 'Active' ? 'Active' : 
               tab === 'Paid' ? 'Paid' : 
               tab === 'Unpaid' ? 'Haijalipwa' : 
               tab === 'Due Today' ? 'Leo' :
               tab === 'Due Tomorrow' ? 'Kesho' : 
               tab === 'Overdue' ? 'Overdue' :
               tab === 'This Week' ? 'Wiki Hii' :
               tab === 'This Month' ? 'Mwezi Huu' : 'Tarehe Maalum'}
            </button>
          ))}
        </div>

        {/* Search + Custom date range inputs */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
              <Search size={16} />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tafuta deni kwa mteja, kiasi, au maelezo..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs focus:bg-white focus:ring-accent focus:border-accent"
            />
          </div>

          {filterType === 'Custom' && (
            <div className="flex items-center gap-2 animate-fade-in text-xs">
              <span className="text-slate-400 font-medium">Kuanzia:</span>
              <input 
                type="date" 
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="p-1.5 border border-slate-200 rounded-lg" 
              />
              <span className="text-slate-400 font-medium">Hadi:</span>
              <input 
                type="date" 
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="p-1.5 border border-slate-200 rounded-lg" 
              />
            </div>
          )}
        </div>

      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 text-xs text-slate-400 py-2">
          <Loader2 size={14} className="animate-spin" />
          <span>Inasasisha data...</span>
        </div>
      )}

      {/* Debts Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs text-slate-600">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                <th className="py-4 px-6">Mteja</th>
                <th className="py-4 px-6">Bidhaa / Maelezo</th>
                <th className="py-4 px-6">Jamii</th>
                <th className="py-4 px-6">Ukomo (Due)</th>
                <th className="py-4 px-6 text-right">Kiasi Kamili</th>
                <th className="py-4 px-6 text-right">Kilicholipwa</th>
                <th className="py-4 px-6 text-right">Salio</th>
                <th className="py-4 px-6">Hali</th>
                <th className="py-4 px-6 text-center">Matendo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredDebts.length > 0 ? (
                filteredDebts.map(debt => (
                  <tr key={debt.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-4 px-6">
                      <div 
                        onClick={() => { setSelectedCustomerId(debt.customerId); setCurrentTab('customers'); }}
                        className="font-bold text-slate-800 hover:underline cursor-pointer flex flex-col"
                      >
                        <span>{debt.customerName}</span>
                        <span className="text-[10px] text-slate-400 font-normal">{debt.customerPhone}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 font-medium text-slate-700">{debt.description}</td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1 font-semibold text-[10px] text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                        <Tag size={10} />
                        {debt.category}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-mono text-slate-400">{debt.dueDate}</td>
                    <td className="py-4 px-6 text-right font-bold text-slate-800">TSh {debt.amount.toLocaleString()}</td>
                    <td className="py-4 px-6 text-right font-medium text-success">TSh {debt.paidAmount.toLocaleString()}</td>
                    <td className="py-4 px-6 text-right font-bold text-rose-600">TSh {debt.remainingAmount.toLocaleString()}</td>
                    <td className="py-4 px-6">
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        debt.status === 'Paid' ? 'bg-success/10 text-success' :
                        debt.status === 'Overdue' ? 'bg-rose-100 text-rose-700' :
                        debt.status === 'Due Today' ? 'bg-orange-100 text-orange-700' :
                        debt.status === 'Due Soon' ? 'bg-amber-100 text-amber-700' :
                        'bg-sky-100 text-sky-700'
                      }`}>
                        {debt.status}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-center gap-2">
                        {debt.status !== 'Paid' && (
                          <button
                            onClick={() => openPaymentModal(debt)}
                            disabled={isLoading}
                            className="p-1 text-success hover:bg-success/10 rounded-lg transition disabled:opacity-50"
                            title="Rekodi malipo"
                          >
                            <CreditCard size={15} />
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(debt)}
                          disabled={isLoading}
                          className="p-1 text-slate-500 hover:bg-slate-100 rounded-lg transition disabled:opacity-50"
                          title="Hariri"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDeleteDebt(debt.id)}
                          disabled={isLoading}
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg transition disabled:opacity-50"
                          title="Futa deni"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Calendar size={36} className="mx-auto text-slate-200 mb-3" />
                    <p className="text-sm font-semibold">Hakuna madeni yoyote yaliyopatikana.</p>
                    <p className="text-xs mt-1">Hariri filter au sajili deni mpya hapo juu.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Create Debt */}
      {isAddDebtOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-scale-in">
            <button 
              onClick={() => setIsAddDebtOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition"
            >
              <X size={18} />
            </button>
            
            <h3 className="text-md font-bold text-slate-850">Sajili Deni Jipya</h3>
            
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
                
                if (data.name) {
                  const foundCustomer = customers.find(c => 
                    c.fullName.toLowerCase().includes(data.name!.toLowerCase()) || 
                    data.name!.toLowerCase().includes(c.fullName.toLowerCase())
                  );
                  if (foundCustomer) {
                    setIsNewCustomer(false);
                    setSelectedCustomerIdForm(foundCustomer.id);
                  } else {
                    setIsNewCustomer(true);
                    setNewCustomerName(data.name);
                    if (data.number) setNewCustomerPhone(data.number);
                  }
                }
              }}
            />
            
            <form onSubmit={handleCreateDebt} className="space-y-4 text-xs text-left">
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Mteja (Customer) *</label>
                
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => { setIsNewCustomer(false); setSelectedCustomerIdForm(''); }}
                    className={`flex-1 py-1.5 px-3 text-center font-bold rounded-lg border text-[11px] transition ${
                      !isNewCustomer
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    Chagua Mteja
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsNewCustomer(true); setSelectedCustomerIdForm(''); }}
                    className={`flex-1 py-1.5 px-3 text-center font-bold rounded-lg border text-[11px] transition ${
                      isNewCustomer
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    Andika Mpya
                  </button>
                </div>

                {!isNewCustomer ? (
                  <select
                    required={!isNewCustomer}
                    value={selectedCustomerIdForm}
                    onChange={(e) => setSelectedCustomerIdForm(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="">Chagua mteja...</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.fullName} ({c.phoneNumber})</option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Jina la Mteja Mpya *</label>
                      <input
                        type="text"
                        required={isNewCustomer}
                        value={newCustomerName}
                        onChange={(e) => setNewCustomerName(e.target.value)}
                        placeholder="Mfano: John Doe"
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Nambari ya Simu</label>
                      <input
                        type="tel"
                        value={newCustomerPhone}
                        onChange={(e) => setNewCustomerPhone(e.target.value)}
                        placeholder="Mfano: 07XXXXXXXX"
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Kiasi cha deni (TSh) *</label>
                <input 
                  type="number" 
                  required 
                  value={debtAmount} 
                  onChange={(e) => setDebtAmount(e.target.value)}
                  placeholder="Kiasi kwa Shilingi"
                  className="w-full p-2.5 border border-slate-200 rounded-xl" 
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
                    placeholder="Mfano: Mizigo/Products"
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-white"
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
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Maelezo/Bidhaa Iliyokopwa *</label>
                <input 
                  type="text" 
                  required
                  value={debtDescription} 
                  onChange={(e) => setDebtDescription(e.target.value)}
                  placeholder="Mfano: Mashati 3 ya kiume"
                  className="w-full p-2.5 border border-slate-200 rounded-xl" 
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Notes za Ziada</label>
                <textarea 
                  value={debtNotes} 
                  onChange={(e) => setDebtNotes(e.target.value)}
                  placeholder="Notes nyingine yoyote..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl h-20" 
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setIsAddDebtOpen(false)}
                  disabled={isLoading}
                  className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600 transition disabled:opacity-50"
                >
                  Ghairi
                </button>
                <button 
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Inasajili...
                    </>
                  ) : (
                    'Sajili Deni'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Debt */}
      {isEditDebtOpen && selectedDebt && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-scale-in">
            <button 
              onClick={() => { setIsEditDebtOpen(false); setSelectedDebt(null); }}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition"
            >
              <X size={18} />
            </button>
            
            <h3 className="text-md font-bold text-slate-850">Hariri Maelezo ya Deni</h3>
            
            <form onSubmit={handleEditDebt} className="space-y-4 text-xs text-left">
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Kiasi cha deni (TSh) *</label>
                <input 
                  type="number" 
                  required 
                  value={debtAmount} 
                  onChange={(e) => setDebtAmount(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl" 
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Bidhaa *</label>
                  <input
                    type="text"
                    required
                    value={debtCategory}
                    onChange={(e) => setDebtCategory(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Ukomo *</label>
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
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Maelezo *</label>
                <input 
                  type="text" 
                  required
                  value={debtDescription} 
                  onChange={(e) => setDebtDescription(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl" 
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Notes</label>
                <textarea 
                  value={debtNotes} 
                  onChange={(e) => setDebtNotes(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl h-20" 
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => { setIsEditDebtOpen(false); setSelectedDebt(null); }}
                  disabled={isLoading}
                  className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600 transition disabled:opacity-50"
                >
                  Ghairi
                </button>
                <button 
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Inahifadhi...
                    </>
                  ) : (
                    'Hifadhi Mabadiliko'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Record Payment */}
      {isAddPaymentOpen && selectedDebt && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-scale-in">
            <button 
              onClick={() => { setIsAddPaymentOpen(false); setSelectedDebt(null); }}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition"
            >
              <X size={18} />
            </button>
            
            <h3 className="text-md font-bold text-slate-850">Rekodi Malipo ya Deni</h3>
            <p className="text-xs text-slate-400">
              Deni: {selectedDebt.description}. Salio: TSh {(selectedDebt.amount - (payments.filter(p => p.debtId === selectedDebt.id).reduce((s, p) => s + p.amount, 0))).toLocaleString()}
            </p>
            
            <form onSubmit={handleAddPayment} className="space-y-4 text-xs text-left">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Kiasi (TSh) *</label>
                  <input 
                    type="number" 
                    required 
                    value={payAmount} 
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="Mfano: 20000"
                    className="w-full p-2.5 border border-slate-200 rounded-xl" 
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
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Kumbukumbu / Maelezo</label>
                <textarea 
                  value={payNotes} 
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="Notes nyingine yoyote..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl h-20" 
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => { setIsAddPaymentOpen(false); setSelectedDebt(null); }}
                  disabled={isLoading}
                  className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600 transition disabled:opacity-50"
                >
                  Ghairi
                </button>
                <button 
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2 bg-accent hover:bg-accent/90 text-white rounded-xl font-semibold shadow-sm transition disabled:opacity-50 flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Inarekodi...
                    </>
                  ) : (
                    'Hifadhi Malipo'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
