/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Customer, Debt, Payment, CustomerStatus } from '../types';
import FormAIOCR from './FormAIOCR';
import { api } from '../services/api';
import { 
  Users, Search, Plus, Filter, Phone, MapPin, 
  Building, UserPlus, CreditCard, ChevronRight, FileText, 
  History, Calendar, Check, AlertCircle, Printer, X, Trash2, Edit2, 
  ArrowLeft, Loader2, Wallet, ListChecks, Package
} from 'lucide-react';

interface CustomerManagementProps {
  customers: Customer[];
  debts: Debt[];
  payments: Payment[];
  onUpdate: () => void;
  selectedCustomerId: string | null;
  setSelectedCustomerId: (id: string | null) => void;
}

interface ProductItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number | string;
  total_price: number;
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
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

  // Form states - Multi-Product Debt creation
  const [productItems, setProductItems] = useState<ProductItem[]>([
    { id: 'item-' + Date.now(), product_name: '', quantity: 1, unit_price: '', total_price: 0 }
  ]);
  const [debtDueDate, setDebtDueDate] = useState('');
  const [debtCategory, setDebtCategory] = useState<string>('Mizigo/Products');
  const [debtNotes, setDebtNotes] = useState('');

  // Form states - Quick Payment recording
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<string>('Cash');
  const [payNotes, setPayNotes] = useState('');
  const [payDebtId, setPayDebtId] = useState('');
  const [payAllMode, setPayAllMode] = useState<boolean>(false);

  // Active customer details
  const activeCustomer = useMemo(() => {
    if (!selectedCustomerId) return null;
    return customers.find(c => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  // Active customer stats
  const activeCustomerStats = useMemo(() => {
    if (!selectedCustomerId) return null;
    const customerDebts = debts.filter(d => d.customerId === selectedCustomerId);
    const debtIds = customerDebts.map(d => d.id);
    const customerPayments = payments.filter(p => debtIds.includes(p.debtId));
    
    const totalDebt = customerDebts.reduce((sum, d) => sum + d.amount, 0);
    const totalPaid = customerPayments.reduce((sum, p) => sum + p.amount, 0);
    const remainingBalance = Math.max(0, totalDebt - totalPaid);
    
    let status: CustomerStatus = 'Cleared';
    if (remainingBalance > 0) {
      const hasOverdue = customerDebts.some(d => {
        const paid = customerPayments.filter(p => p.debtId === d.id).reduce((s, p) => s + p.amount, 0);
        return d.amount - paid > 0 && new Date(d.dueDate) < new Date('2026-07-10');
      });
      status = hasOverdue ? 'Overdue' : 'Active';
    }

    return {
      totalDebt,
      totalPaid,
      remainingBalance,
      status,
      percentagePaid: totalDebt > 0 ? (totalPaid / totalDebt) * 100 : 0
    };
  }, [selectedCustomerId, debts, payments]);

  // Selected customer's specific debts and payments
  const activeCustomerHistory = useMemo(() => {
    if (!selectedCustomerId) return { debts: [], payments: [] };
    const custDebts = debts.filter(d => d.customerId === selectedCustomerId);
    const debtIds = custDebts.map(d => d.id);
    const custPayments = payments.filter(p => debtIds.includes(p.debtId));
    return { debts: custDebts, payments: custPayments };
  }, [selectedCustomerId, debts, payments]);

  // Unpaid debts
  const unpaidDebts = useMemo(() => {
    return activeCustomerHistory.debts
      .map(d => {
        const dPayments = activeCustomerHistory.payments.filter(p => p.debtId === d.id);
        const paidSum = dPayments.reduce((s, p) => s + p.amount, 0);
        const remaining = Math.max(0, d.amount - paidSum);
        return { ...d, remaining, paidSum };
      })
      .filter(d => d.remaining > 0);
  }, [activeCustomerHistory]);

  // Total remaining for all debts
  const totalRemaining = useMemo(() => {
    return unpaidDebts.reduce((sum, d) => sum + d.remaining, 0);
  }, [unpaidDebts]);

  // Multi-product total
  const productsTotal = useMemo(() => {
    return productItems.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unit_price) || 0;
      return sum + (qty * price);
    }, 0);
  }, [productItems]);

  // All customers with calculated stats
  const customersWithStats = useMemo(() => {
    return customers.map(c => {
      const customerDebts = debts.filter(d => d.customerId === c.id);
      const debtIds = customerDebts.map(d => d.id);
      const customerPayments = payments.filter(p => debtIds.includes(p.debtId));
      
      const totalDebt = customerDebts.reduce((sum, d) => sum + d.amount, 0);
      const totalPaid = customerPayments.reduce((sum, p) => sum + p.amount, 0);
      const remainingBalance = Math.max(0, totalDebt - totalPaid);
      
      let status: CustomerStatus = 'Cleared';
      if (remainingBalance > 0) {
        const hasOverdue = customerDebts.some(d => {
          const paid = customerPayments.filter(p => p.debtId === d.id).reduce((s, p) => s + p.amount, 0);
          return d.amount - paid > 0 && new Date(d.dueDate) < new Date('2026-07-10');
        });
        status = hasOverdue ? 'Overdue' : 'Active';
      }

      return {
        ...c,
        stats: { totalDebt, totalPaid, remainingBalance, status, percentagePaid: totalDebt > 0 ? (totalPaid / totalDebt) * 100 : 0 }
      };
    });
  }, [customers, debts, payments]);

  // Filtered customers
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

  // ============================================
  // MULTI-PRODUCT HANDLERS
  // ============================================

  const updateProductItem = (index: number, field: string, value: any) => {
    const updated = [...productItems];
    updated[index] = { ...updated[index], [field]: value };
    
    if (field === 'quantity' || field === 'unit_price') {
      const qty = Number(updated[index].quantity) || 0;
      const price = Number(updated[index].unit_price) || 0;
      updated[index].total_price = qty * price;
    }
    
    setProductItems(updated);
  };

  const addProductItem = () => {
    setProductItems([
      ...productItems,
      { 
        id: 'item-' + Date.now() + '-' + Math.random(), 
        product_name: '', 
        quantity: 1, 
        unit_price: '',
        total_price: 0 
      }
    ]);
  };

  const removeProductItem = (index: number) => {
    if (productItems.length === 1) return;
    setProductItems(productItems.filter((_, i) => i !== index));
  };

  const resetProductForm = () => {
    setProductItems([
      { id: 'item-' + Date.now(), product_name: '', quantity: 1, unit_price: '', total_price: 0 }
    ]);
    setDebtDueDate('');
    setDebtCategory('Mizigo/Products');
    setDebtNotes('');
  };

  // ============================================
  // API HANDLERS
  // ============================================
  
  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !phoneNumber) return;

    setIsLoading(true);
    setError(null);
    try {
      await api.customers.create({
        id: 'cust-' + Date.now(),
        fullName,
        phoneNumber,
        address,
        businessName: businessName || '',
        notes,
        photoUrl: photoUrl || ''
      });
      
      onUpdate();
      setIsAddModalOpen(false);
      resetCustomerForm();
    } catch (err: any) {
      setError('Imeshindwa kumsajili mteja: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !fullName || !phoneNumber) return;

    setIsLoading(true);
    setError(null);
    try {
      await api.customers.update(selectedCustomerId, {
        fullName,
        phoneNumber,
        address,
        businessName: businessName || '',
        notes,
        photoUrl: photoUrl || ''
      });
      
      onUpdate();
      setIsEditModalOpen(false);
    } catch (err: any) {
      setError('Imeshindwa kuhariri wasifu: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCustomer = async (customerId: string) => {
    if (!confirm('Je, una uhakika unataka kumfuta mteja huyu pamoja na madeni na malipo yake yote?')) return;

    setIsLoading(true);
    try {
      await api.customers.delete(customerId);
      onUpdate();
      if (selectedCustomerId === customerId) setSelectedCustomerId(null);
    } catch (err: any) {
      alert('Imeshindwa kumfuta mteja: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ADD MULTIPLE DEBTS AT ONCE
  const handleAddDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !debtDueDate) return;

    // Validate products
    const validProducts = productItems.filter(
      item => item.product_name && Number(item.unit_price) > 0
    );

    if (validProducts.length === 0) {
      setError('Ongeza bidhaa angalau moja na bei');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const today = new Date().toISOString().split('T')[0];

      // Create a debt for EACH product
      for (const product of validProducts) {
        const quantity = Number(product.quantity) || 1;
        const unitPrice = Number(product.unit_price) || 0;
        const totalAmount = quantity * unitPrice;

        await api.debts.create({
          id: 'debt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          customerId: selectedCustomerId,
          amount: totalAmount,
          dateBorrowed: today,
          dueDate: debtDueDate,
          description: quantity > 1 
            ? `${product.product_name} (${quantity} x TSh ${unitPrice.toLocaleString()})`
            : product.product_name,
          category: debtCategory,
          notes: debtNotes,
          status: 'Active'
        });
      }
      
      onUpdate();
      setIsAddDebtOpen(false);
      resetProductForm();
    } catch (err: any) {
      setError('Imeshindwa kuongeza madeni: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payAmount) return;
    if (!payAllMode && !payDebtId) return;

    setIsLoading(true);
    setError(null);
    
    try {
      const totalPayAmount = Number(payAmount);
      
      if (payAllMode) {
        let remainingToAllocate = totalPayAmount;
        
        for (const debt of unpaidDebts) {
          if (remainingToAllocate <= 0) break;
          
          const amountToPay = Math.min(remainingToAllocate, debt.remaining);
          if (amountToPay <= 0) continue;
          
          await api.payments.create({
            id: 'pay-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            debtId: debt.id,
            amount: amountToPay,
            date: new Date().toISOString().split('T')[0],
            paymentMethod: payMethod,
            notes: payNotes || `Malipo ya ${debt.description} (Lipa Zote)`
          });
          
          remainingToAllocate -= amountToPay;
        }
        
        onUpdate();
        setIsAddPaymentOpen(false);
        resetPaymentForm();
        
        if (activeCustomer) {
          const remainingAfterAll = Math.max(0, totalRemaining - totalPayAmount);
          try {
            await fetch('/api/send-payment-sms', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                customerName: activeCustomer.fullName,
                customerPhone: activeCustomer.phoneNumber,
                paidAmount: totalPayAmount,
                remainingAmount: remainingAfterAll,
                paymentMethod: payMethod
              })
            });
          } catch (smsErr) {
            console.error('SMS error:', smsErr);
          }
        }
      } else {
        const selectedDebt = activeCustomerHistory.debts.find(d => d.id === payDebtId);
        const paymentNotes = payNotes || (selectedDebt ? `Malipo kwa: ${selectedDebt.description}` : 'Malipo ya deni');
        
        const dPayments = activeCustomerHistory.payments.filter(p => p.debtId === payDebtId);
        const paidSum = dPayments.reduce((s, p) => s + p.amount, 0);
        const totalDebtAmount = selectedDebt?.amount || 0;
        const remainingAfterPayment = Math.max(0, totalDebtAmount - paidSum - totalPayAmount);
        
        await api.payments.create({
          id: 'pay-' + Date.now(),
          debtId: payDebtId,
          amount: totalPayAmount,
          date: new Date().toISOString().split('T')[0],
          paymentMethod: payMethod,
          notes: paymentNotes
        });
        
        onUpdate();
        setIsAddPaymentOpen(false);
        resetPaymentForm();
        
        if (activeCustomer) {
          try {
            await fetch('/api/send-payment-sms', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                customerName: activeCustomer.fullName,
                customerPhone: activeCustomer.phoneNumber,
                paidAmount: totalPayAmount,
                remainingAmount: remainingAfterPayment,
                paymentMethod: payMethod
              })
            });
          } catch (smsErr) {
            console.error('SMS error:', smsErr);
          }
        }
      }
      
    } catch (err: any) {
      setError('Imeshindwa kurekodi malipo: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const resetCustomerForm = () => {
    setFullName(''); setPhoneNumber(''); setAddress('');
    setBusinessName(''); setNotes(''); setPhotoUrl('');
  };

  const resetPaymentForm = () => {
    setPayAmount(''); setPayNotes(''); setPayDebtId('');
    setPayAllMode(false);
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

  const settings = {
    businessName: 'Sonko Sound',
    businessAddress: 'Morogoro, Tanzania',
    businessPhone: '0688423753'
  };

  return (
    <div className="space-y-6">
      
      {/* Error Banner */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2 text-rose-700 text-xs">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
            <X size={16} />
          </button>
        </div>
      )}

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
                  <img src={activeCustomer.photoUrl} alt={activeCustomer.fullName} className="h-16 w-16 rounded-2xl object-cover shadow-sm border border-slate-100" referrerPolicy="no-referrer" />
                ) : (
                  <div className="h-16 w-16 rounded-2xl bg-emerald-100 text-emerald-800 font-extrabold text-xl flex items-center justify-center shadow-sm">
                    {getInitials(activeCustomer.fullName)}
                  </div>
                )}
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">{activeCustomer.fullName}</h3>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1"><Phone size={12} /> {activeCustomer.phoneNumber}</p>
                  {activeCustomer.businessName && <p className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-1"><Building size={12} /> {activeCustomer.businessName}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-center">
                <button onClick={openEditModal} disabled={isLoading} className="py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors flex items-center gap-1.5 font-bold disabled:opacity-50">
                  <Edit2 size={14} /> Hariri (Edit)
                </button>
                <button onClick={() => handleDeleteCustomer(activeCustomer.id)} disabled={isLoading} className="py-2.5 px-4 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-600 transition-colors flex items-center gap-1.5 font-bold disabled:opacity-50">
                  <Trash2 size={14} /> Futa
                </button>
                <button onClick={() => setSelectedCustomerId('')} className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors font-bold">
                  Orodha (Back)
                </button>
              </div>
            </div>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2">Hali ya Mizania</h4>
              <div className="space-y-3.5">
                <div className="flex justify-between items-center"><span className="text-slate-400 font-medium">Baki ya sasa</span><span className="font-extrabold text-rose-600 text-sm">TSh {activeCustomerStats.remainingBalance.toLocaleString()}</span></div>
                <div className="flex justify-between items-center border-t border-slate-100 pt-2.5"><span className="text-slate-400 font-medium">Jumla ya Madeni</span><span className="font-bold text-slate-700">TSh {activeCustomerStats.totalDebt.toLocaleString()}</span></div>
                <div className="flex justify-between items-center border-t border-slate-100 pt-2.5"><span className="text-slate-400 font-medium">Zilizolipwa</span><span className="font-bold text-emerald-600">TSh {activeCustomerStats.totalPaid.toLocaleString()}</span></div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-3"><div className="bg-emerald-600 h-full rounded-full transition-all" style={{ width: `${activeCustomerStats.percentagePaid}%` }}></div></div>
                <p className="text-[10px] text-right text-slate-400 font-bold">{Math.round(activeCustomerStats.percentagePaid)}% Lipwa</p>
              </div>
            </div>

            <div className="md:col-span-2 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2">Maelezo na Notes</h4>
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50/50 p-3 rounded-xl border border-slate-100 min-h-[60px]">{activeCustomer.notes || 'Hakuna maelezo yoyote yaliyoandikwa.'}</p>
                {activeCustomer.address && <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-2"><MapPin size={11} /> Mahali: {activeCustomer.address}</p>}
              </div>
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-100">
                <button onClick={() => { resetProductForm(); setIsAddDebtOpen(true); }} disabled={isLoading} className="bg-slate-900 text-white font-bold py-2.5 px-3 rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50">
                  <Plus size={14} /> Deni Jipya
                </button>
                <button onClick={() => {
                  const openDebt = activeCustomerHistory.debts.find(d => {
                    const pSum = payments.filter(p => p.debtId === d.id).reduce((a, x) => a + x.amount, 0);
                    return d.amount - pSum > 0;
                  });
                  if (openDebt) { setPayDebtId(openDebt.id); setIsAddPaymentOpen(true); }
                  else { alert("Mteja huyu hana deni linalohitaji malipo!"); }
                }} disabled={isLoading} className="bg-emerald-600 text-white font-bold py-2.5 px-3 rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50">
                  <CreditCard size={14} /> Lipisha Deni
                </button>
                <button onClick={() => setIsStatementOpen(true)} className="border border-slate-200 text-slate-700 font-bold py-2.5 px-3 rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5">
                  <Printer size={14} /> Taarifa
                </button>
              </div>
            </div>
          </div>

          {/* History section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <FileText size={14} className="text-amber-500" /> Madeni ({activeCustomerHistory.debts.length})
              </h4>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {activeCustomerHistory.debts.map(debt => {
                  const dPayments = activeCustomerHistory.payments.filter(p => p.debtId === debt.id);
                  const paidSum = dPayments.reduce((acc, p) => acc + p.amount, 0);
                  const bal = debt.amount - paidSum;
                  return (
                    <div key={debt.id} className="p-4 bg-slate-50/60 rounded-2xl border border-slate-100 text-xs">
                      <div className="flex justify-between font-bold"><span className="truncate">{debt.description}</span><span>TSh {debt.amount.toLocaleString()}</span></div>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                        <span><Calendar size={10} /> {debt.dateBorrowed}</span>
                        <span><Calendar size={10} className="text-rose-500" /> {debt.dueDate}</span>
                        <span className={bal > 0 ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}>{bal > 0 ? `Salio: TSh ${bal.toLocaleString()}` : '✓ Imelipwa'}</span>
                      </div>
                      {debt.amount > 0 && (
                        <div className="mt-2 space-y-1">
                          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${bal > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, (paidSum / debt.amount) * 100)}%` }}></div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {activeCustomerHistory.debts.length === 0 && <p className="text-xs text-slate-400 text-center py-6">Hakuna madeni bado.</p>}
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <History size={14} className="text-emerald-500" /> Malipo ({activeCustomerHistory.payments.length})
              </h4>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {activeCustomerHistory.payments.map(p => (
                  <div key={p.id} className="p-4 bg-slate-50/60 rounded-2xl border border-slate-100 text-xs flex justify-between items-start">
                    <div>
                      <h5 className="font-bold">{p.notes || 'Malipo ya Deni'}</h5>
                      <span className="text-[10px] text-slate-400"><Calendar size={10} /> {p.date} • {p.paymentMethod}</span>
                    </div>
                    <span className="font-extrabold text-emerald-600">TSh {p.amount.toLocaleString()}</span>
                  </div>
                ))}
                {activeCustomerHistory.payments.length === 0 && <p className="text-xs text-slate-400 text-center py-6">Hakuna malipo bado.</p>}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* CUSTOMERS LIST VIEW */
        <>
          {/* Search and filtering bar */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-white p-4 rounded-3xl border border-slate-100 shadow-sm gap-4">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><Search size={18} /></span>
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Tafuta mteja kwa jina, simu, au biashara..." className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:bg-white focus:ring-emerald-500" />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto">
              {(['All', 'Active', 'Cleared', 'Overdue'] as const).map(tab => (
                <button key={tab} onClick={() => setStatusFilter(tab)} className={`px-4 py-2 text-xs font-semibold rounded-xl transition ${statusFilter === tab ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
                  {tab === 'All' ? 'Wote' : tab === 'Active' ? 'Active' : tab === 'Cleared' ? 'Safi' : 'Overdue'}
                </button>
              ))}
              <button onClick={() => { resetCustomerForm(); setIsAddModalOpen(true); }} disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 ml-2 shadow-sm transition disabled:opacity-50">
                <UserPlus size={15} /> Msajili Mteja
              </button>
            </div>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center gap-2 text-xs text-slate-400 py-2">
              <Loader2 size={14} className="animate-spin" /> Inasasisha...
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCustomers.length > 0 ? (
              filteredCustomers.map(customer => (
                <div key={customer.id} onClick={() => setSelectedCustomerId(customer.id)} className={`p-5 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between h-48 ${selectedCustomerId === customer.id ? 'bg-emerald-50/50 border-emerald-500 ring-2 ring-emerald-500/20' : 'bg-white border-slate-100 hover:border-slate-300 shadow-sm'}`}>
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {customer.photoUrl ? <img src={customer.photoUrl} alt={customer.fullName} className="h-10 w-10 rounded-xl object-cover" referrerPolicy="no-referrer" /> : <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-sm flex items-center justify-center">{getInitials(customer.fullName)}</div>}
                        <div>
                          <h3 className="text-xs font-bold text-slate-800 truncate max-w-[120px]">{customer.fullName}</h3>
                          <p className="text-[10px] text-slate-400 flex items-center gap-0.5 mt-0.5"><Phone size={10} /> {customer.phoneNumber}</p>
                        </div>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${customer.stats.status === 'Overdue' ? 'bg-rose-100 text-rose-700' : customer.stats.status === 'Active' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{customer.stats.status}</span>
                    </div>
                    {customer.businessName && <div className="mt-3.5 flex items-center gap-1 text-[10px] text-slate-500 font-medium bg-slate-50 px-2.5 py-1 rounded-lg w-fit"><Building size={11} /><span>{customer.businessName}</span></div>}
                  </div>
                  <div className="border-t border-slate-50 pt-3 mt-4 flex justify-between items-end">
                    <div><p className="text-[9px] text-slate-400 uppercase font-semibold">Deni</p><p className="text-xs font-bold text-slate-800 mt-0.5">TSh {customer.stats.remainingBalance.toLocaleString()}</p></div>
                    <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-0.5">Fungua <ChevronRight size={12} /></span>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full bg-white p-12 text-center rounded-3xl border border-slate-100 shadow-sm text-slate-400">
                <Users size={40} className="mx-auto text-slate-300 mb-3" />
                <p className="text-sm font-semibold">Hakuna wateja waliopatikana.</p>
                <p className="text-xs mt-1">Sajili wateja kwa kutumia kitufe kilichopo juu.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* MODAL: Add Customer */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-scale-in">
            <button onClick={() => setIsAddModalOpen(false)} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition"><X size={18} /></button>
            <h3 className="text-md font-bold text-slate-850 flex items-center gap-1.5"><UserPlus className="text-emerald-600" size={18} /> Msajili Mteja Mpya</h3>
            <FormAIOCR label="Changanua Karatasi kwa AI Camera" onSuccess={(data) => {
              if (data.name) setFullName(data.name);
              if (data.number) setPhoneNumber(data.number);
              if (data.maelezo_ya_bidhaa || data.notes) setNotes([data.maelezo_ya_bidhaa, data.notes].filter(Boolean).join('. '));
            }} />
            <form onSubmit={handleAddCustomer} className="space-y-4 text-xs">
              <div><label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Jina Kamili *</label><input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Mfano: Jalia Hassan" className="w-full p-2.5 border border-slate-200 rounded-xl" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Nambari ya Simu *</label><input type="tel" required value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="0712345678" className="w-full p-2.5 border border-slate-200 rounded-xl" /></div>
                <div><label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Biashara</label><input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Jalia Boutique" className="w-full p-2.5 border border-slate-200 rounded-xl" /></div>
              </div>
              <div><label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Anuani</label><input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Kariakoo, Dar" className="w-full p-2.5 border border-slate-200 rounded-xl" /></div>
              <div><label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Maelezo/Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Kumbukumbu maalum..." className="w-full p-2.5 border border-slate-200 rounded-xl h-20" /></div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsAddModalOpen(false)} disabled={isLoading} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600 transition disabled:opacity-50">Ghairi</button>
                <button type="submit" disabled={isLoading} className="px-5 py-2 bg-accent hover:bg-accent/90 text-white rounded-xl font-semibold shadow-sm transition disabled:opacity-50 flex items-center gap-2">{isLoading ? <><Loader2 size={14} className="animate-spin" /> Inasajili...</> : 'Sajili Mteja'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Customer */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-scale-in">
            <button onClick={() => setIsEditModalOpen(false)} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition"><X size={18} /></button>
            <h3 className="text-md font-bold text-slate-850">Hariri Wasifu wa Mteja</h3>
            <form onSubmit={handleEditCustomer} className="space-y-4 text-xs">
              <div><label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Jina Kamili *</label><input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Namba ya Simu *</label><input type="tel" required value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl" /></div>
                <div><label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Biashara</label><input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl" /></div>
              </div>
              <div><label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Anuani</label><input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl" /></div>
              <div><label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl h-20" /></div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsEditModalOpen(false)} disabled={isLoading} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600 transition disabled:opacity-50">Ghairi</button>
                <button type="submit" disabled={isLoading} className="px-5 py-2 bg-accent hover:bg-accent/90 text-white rounded-xl font-semibold shadow-sm transition disabled:opacity-50 flex items-center gap-2">{isLoading ? <><Loader2 size={14} className="animate-spin" /> Inahifadhi...</> : 'Hifadhi Wasifu'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Multi-Product Debt */}
      {isAddDebtOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto animate-scale-in">
            <button onClick={() => { setIsAddDebtOpen(false); resetProductForm(); }} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition"><X size={18} /></button>
            
            <h3 className="text-md font-bold text-slate-850 flex items-center gap-1.5">
              <Package className="text-amber-500" size={18} /> 
              Ongeza Bidhaa kwa {activeCustomer?.fullName}
            </h3>
            
            <FormAIOCR label="Changanua Karatasi kwa AI Camera" onSuccess={(data) => {
              if (data.maelezo_ya_bidhaa) {
                // Populate first empty product
                const updated = [...productItems];
                const emptyIdx = updated.findIndex(p => !p.product_name);
                if (emptyIdx >= 0) {
                  updated[emptyIdx].product_name = data.maelezo_ya_bidhaa;
                  if (data.deni) {
                    updated[emptyIdx].unit_price = data.deni.toString();
                    updated[emptyIdx].total_price = Number(data.deni);
                  }
                  setProductItems(updated);
                } else {
                  // Add new product
                  setProductItems([
                    ...updated,
                    {
                      id: 'item-' + Date.now(),
                      product_name: data.maelezo_ya_bidhaa,
                      quantity: 1,
                      unit_price: data.deni ? data.deni.toString() : '',
                      total_price: data.deni ? Number(data.deni) : 0
                    }
                  ]);
                }
              }
              if (data.notes) setDebtNotes(data.notes);
            }} />
            
            <form onSubmit={handleAddDebt} className="space-y-4 text-xs text-left">
              
              {/* Products Section */}
              <div className="space-y-3">
                <label className="block font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Package size={13} /> Bidhaa ({productItems.length})
                </label>
                
                {productItems.map((item, index) => (
                  <div key={item.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Bidhaa {index + 1}</span>
                      {productItems.length > 1 && (
                        <button type="button" onClick={() => removeProductItem(index)} 
                          className="text-rose-500 hover:text-rose-700 p-1">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    
                    <input 
                      type="text" 
                      placeholder="Jina la bidhaa (mf. Generator)" 
                      value={item.product_name}
                      onChange={(e) => updateProductItem(index, 'product_name', e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg bg-white"
                      required
                    />
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 mb-1">Idadi</label>
                        <input 
                          type="number" 
                          min="1" 
                          value={item.quantity}
                          onChange={(e) => updateProductItem(index, 'quantity', Number(e.target.value))}
                          className="w-full p-2 border border-slate-200 rounded-lg bg-white"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 mb-1">Bei (TSh)</label>
                        <input 
                          type="number" 
                          min="0"
                          placeholder="0"
                          value={item.unit_price === '' ? '' : item.unit_price}
                          onChange={(e) => updateProductItem(index, 'unit_price', e.target.value)}
                          className="w-full p-2 border border-slate-200 rounded-lg bg-white"
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-700">
                        Jumla: TSh {((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
                
                <button type="button" onClick={addProductItem} 
                  className="w-full py-2 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:text-accent hover:border-accent transition font-semibold flex items-center justify-center gap-1">
                  <Plus size={14} /> Ongeza Bidhaa Nyingine
                </button>
              </div>

              {/* Products Total */}
              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-800">JUMLA KUU:</span>
                  <span className="text-lg font-black text-amber-700">TSh {productsTotal.toLocaleString()}</span>
                </div>
              </div>

              {/* Category and Due Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Kundi *</label>
                  <input 
                    type="text" 
                    required 
                    value={debtCategory} 
                    onChange={(e) => setDebtCategory(e.target.value)} 
                    placeholder="Mizigo/Products" 
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

              {/* Notes */}
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Maelezo ya Ziada</label>
                <textarea 
                  value={debtNotes} 
                  onChange={(e) => setDebtNotes(e.target.value)} 
                  placeholder="Maelezo yoyote ya ziada..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl h-16" 
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => { setIsAddDebtOpen(false); resetProductForm(); }} 
                  disabled={isLoading} 
                  className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600 transition disabled:opacity-50"
                >
                  Ghairi
                </button>
                <button 
                  type="submit" 
                  disabled={isLoading || productItems.filter(p => p.product_name && Number(p.unit_price) > 0).length === 0} 
                  className="px-5 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-xl font-semibold shadow-sm transition disabled:opacity-50 flex items-center gap-2"
                >
                  {isLoading ? (
                    <><Loader2 size={14} className="animate-spin" /> Inasajili...</>
                  ) : (
                    <>Sajili Bidhaa ({productItems.filter(p => p.product_name && Number(p.unit_price) > 0).length})</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Payment - WITH PAY ALL OPTION */}
      {isAddPaymentOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-scale-in">
            <button onClick={() => { setIsAddPaymentOpen(false); resetPaymentForm(); }} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition">
              <X size={18} />
            </button>
            
            <h3 className="text-md font-bold text-slate-850">Rekodi Malipo kutoka kwa {activeCustomer?.fullName}</h3>
            
            <form onSubmit={handleAddPayment} className="space-y-4 text-xs text-left">
              
              {/* Payment Mode Selector */}
              <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setPayAllMode(false);
                    setPayAmount('');
                  }}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    !payAllMode 
                      ? 'bg-white text-slate-800 shadow-sm' 
                      : 'text-slate-500'
                  }`}
                >
                  <Wallet size={14} /> Deni Moja
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPayAllMode(true);
                    setPayDebtId('');
                    setPayAmount(totalRemaining.toString());
                  }}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    payAllMode 
                      ? 'bg-emerald-600 text-white shadow-sm' 
                      : 'text-slate-500'
                  }`}
                >
                  <ListChecks size={14} /> Lipa Zote
                </button>
              </div>

              {/* Single Debt Selection */}
              {!payAllMode && (
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Deni Unalolipia *
                  </label>
                  <select
                    required={!payAllMode}
                    value={payDebtId}
                    onChange={(e) => {
                      setPayDebtId(e.target.value);
                      const selectedDebt = activeCustomerHistory.debts.find(d => d.id === e.target.value);
                      if (selectedDebt) {
                        const dPayments = activeCustomerHistory.payments.filter(p => p.debtId === selectedDebt.id);
                        const paidSum = dPayments.reduce((s, p) => s + p.amount, 0);
                        const remaining = Math.max(0, selectedDebt.amount - paidSum);
                        setPayAmount(remaining.toString());
                      }
                    }}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-white focus:ring-accent"
                  >
                    <option value="">Chagua deni...</option>
                    {activeCustomerHistory.debts.map(d => {
                      const dPayments = activeCustomerHistory.payments.filter(p => p.debtId === d.id);
                      const paidSum = dPayments.reduce((s, p) => s + p.amount, 0);
                      const remaining = Math.max(0, d.amount - paidSum);
                      if (remaining <= 0) return null;
                      return (
                        <option key={d.id} value={d.id}>
                          {d.description} (Kiporo: TSh {remaining.toLocaleString()})
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Pay All Mode Summary */}
              {payAllMode && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs mb-2">
                    <ListChecks size={14} /> Malipo kwa Madeni Yote ({unpaidDebts.length})
                  </div>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {unpaidDebts.map(d => (
                      <div key={d.id} className="flex justify-between text-[11px] bg-white rounded-lg p-2">
                        <span className="text-slate-600 truncate">{d.description}</span>
                        <span className="font-bold text-emerald-700">TSh {d.remaining.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between border-t border-emerald-200 pt-2 mt-2">
                    <span className="font-bold text-emerald-800">JUMLA:</span>
                    <span className="font-black text-emerald-800 text-sm">TSh {totalRemaining.toLocaleString()}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Kiasi (TSh) *
                  </label>
                  <input 
                    type="number" 
                    required 
                    value={payAmount} 
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="Mfano: 30000"
                    min="1"
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-accent" 
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Njia ya Malipo *
                  </label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="Cash">Cash / Pesa Taslimu</option>
                    <option value="M-Pesa">M-Pesa</option>
                    <option value="Tigo Pesa">Tigo Pesa</option>
                    <option value="Airtel Money">Airtel Money</option>
                    <option value="HaloPesa">HaloPesa</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Other">Nyinginezo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Kumbukumbu / Maelezo ya Malipo
                </label>
                <textarea 
                  value={payNotes} 
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="Andika risiti au kumbukumbu yoyote ya muamala..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl h-20 focus:ring-accent" 
                />
              </div>

              {payAmount && (
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-1.5">
                  {payAllMode ? (
                    <>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">Jumla ya Madeni Yote:</span>
                        <span className="font-bold text-slate-700">TSh {totalRemaining.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-[11px] border-t border-slate-200 pt-1.5">
                        <span className="text-slate-400">Baki Baada ya Malipo:</span>
                        <span className={`font-bold ${totalRemaining - Number(payAmount) <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          TSh {Math.max(0, totalRemaining - Number(payAmount)).toLocaleString()}
                        </span>
                      </div>
                    </>
                  ) : (
                    (() => {
                      const debt = activeCustomerHistory.debts.find(d => d.id === payDebtId);
                      if (!debt) return null;
                      const dPayments = activeCustomerHistory.payments.filter(p => p.debtId === debt.id);
                      const paidSum = dPayments.reduce((s, p) => s + p.amount, 0);
                      return (
                        <>
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-400">Deni Kamili:</span>
                            <span className="font-bold text-slate-700">TSh {debt.amount.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-400">Tayari Kulipwa:</span>
                            <span className="font-bold text-emerald-600">TSh {paidSum.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-[11px] border-t border-slate-200 pt-1.5">
                            <span className="text-slate-400">Baki Baada ya Malipo:</span>
                            <span className={`font-bold ${debt.amount - paidSum - Number(payAmount) <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              TSh {Math.max(0, debt.amount - paidSum - Number(payAmount)).toLocaleString()}
                            </span>
                          </div>
                        </>
                      );
                    })()
                  )}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => { setIsAddPaymentOpen(false); resetPaymentForm(); }} disabled={isLoading} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600 transition disabled:opacity-50">
                  Ghairi
                </button>
                <button type="submit" disabled={isLoading || !payAmount || (!payAllMode && !payDebtId) || Number(payAmount) <= 0} className={`px-5 py-2 text-white rounded-xl font-semibold shadow-sm transition disabled:opacity-50 flex items-center gap-2 ${payAllMode ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-accent hover:bg-accent/90'}`}>
                  {isLoading ? <><Loader2 size={14} className="animate-spin" /> Inarekodi...</> : payAllMode ? 'Lipa Zote' : 'Hifadhi Malipo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINT STATEMENT MODAL */}
      {isStatementOpen && activeCustomer && activeCustomerStats && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto animate-scale-in" id="printable-statement-container">
            <div className="absolute top-6 right-6 flex items-center gap-2 print:hidden">
              <button onClick={() => window.print()} className="bg-slate-900 text-white flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold hover:bg-slate-800 transition"><Printer size={14} /> Chapisha / PDF</button>
              <button onClick={() => setIsStatementOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"><X size={16} /></button>
            </div>
            <div className="space-y-6 pt-4 text-slate-700">
              <div className="flex justify-between items-start border-b border-slate-200 pb-6">
                <div><h2 className="text-xl font-extrabold text-slate-800 uppercase">{settings.businessName}</h2><p className="text-xs text-slate-500 mt-1">Anuani: {settings.businessAddress}</p><p className="text-xs text-slate-500 mt-0.5">Simu: {settings.businessPhone}</p></div>
                <div className="text-right"><span className="inline-block text-[10px] uppercase tracking-wider font-extrabold px-3 py-1 bg-slate-100 text-slate-600 rounded-full">Mizania ya Mteja</span><p className="text-[11px] text-slate-400 mt-2">Muda: {new Date().toLocaleDateString('sw-TZ')}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-8 py-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                <div><h4 className="text-[10px] font-bold text-slate-400 uppercase">MTEJA:</h4><h3 className="text-sm font-bold text-slate-800 mt-1">{activeCustomer.fullName}</h3><p className="text-xs text-slate-500 mt-0.5">Simu: {activeCustomer.phoneNumber}</p></div>
                <div className="text-right"><h4 className="text-[10px] font-bold text-slate-400 uppercase">SALIO (TSh):</h4><h3 className="text-lg font-black text-rose-600 mt-1">TSh {activeCustomerStats.remainingBalance.toLocaleString()}</h3></div>
              </div>
              <div className="space-y-2"><h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-1.5 uppercase">Historia ya Madeni</h4>
                <table className="w-full text-left text-xs text-slate-600"><thead><tr className="bg-slate-50 text-slate-500 font-bold"><th className="py-2.5 px-3 rounded-l-lg">Maelezo</th><th className="py-2.5 px-3">Tarehe</th><th className="py-2.5 px-3">Ukomo</th><th className="py-2.5 px-3 text-right rounded-r-lg">Kiasi (TSh)</th></tr></thead>
                  <tbody>{activeCustomerHistory.debts.map(debt => (<tr key={debt.id} className="border-b border-slate-100/50"><td className="py-2 px-3 font-semibold">{debt.description}</td><td className="py-2 px-3 font-mono text-slate-400">{debt.dateBorrowed}</td><td className="py-2 px-3 font-mono text-slate-400">{debt.dueDate}</td><td className="py-2 px-3 text-right font-bold">TSh {debt.amount.toLocaleString()}</td></tr>))}</tbody></table>
              </div>
              <div className="space-y-2 pt-2"><h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-1.5 uppercase">Historia ya Malipo</h4>
                <table className="w-full text-left text-xs text-slate-600"><thead><tr className="bg-slate-50 text-slate-500 font-bold"><th className="py-2.5 px-3 rounded-l-lg">Maelezo</th><th className="py-2.5 px-3">Tarehe</th><th className="py-2.5 px-3">Njia</th><th className="py-2.5 px-3 text-right rounded-r-lg">Kiasi (TSh)</th></tr></thead>
                  <tbody>{activeCustomerHistory.payments.length > 0 ? activeCustomerHistory.payments.map(pay => (<tr key={pay.id} className="border-b border-slate-100/50"><td className="py-2 px-3">{pay.notes || 'Malipo'}</td><td className="py-2 px-3 font-mono text-slate-400">{pay.date}</td><td className="py-2 px-3 font-bold text-slate-600">{pay.paymentMethod}</td><td className="py-2 px-3 text-right font-bold text-success">TSh {pay.amount.toLocaleString()}</td></tr>)) : (<tr><td colSpan={4} className="py-4 text-center text-slate-400">Hakuna malipo bado.</td></tr>)}</tbody></table>
              </div>
              <div className="pt-12 grid grid-cols-2 gap-12 text-xs">
                <div className="border-t border-slate-200 pt-3 text-center"><p className="font-bold text-slate-800">Sahihi ya Mmiliki</p><p className="text-slate-400 mt-1">{settings.businessName}</p></div>
                <div className="border-t border-slate-200 pt-3 text-center"><p className="font-bold text-slate-800">Sahihi ya Mteja</p><p className="text-slate-400 mt-1">{activeCustomer.fullName}</p></div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
