/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Supplier } from '../types';
import { api } from '../services/api';
import FormAIOCR from './FormAIOCR';
import { 
  Users, Plus, Phone, Calendar, Clipboard, 
  Trash2, CreditCard, ChevronRight, Check, X, AlertCircle, Edit2,
  ArrowLeft, History, Printer, Building, Loader2
} from 'lucide-react';

interface SupplierManagementProps {
  suppliers: Supplier[];
  onUpdate: () => void;
}

export default function SupplierManagement({
  suppliers,
  onUpdate
}: SupplierManagementProps) {
  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  // Active supplier state
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const activeSupplier = useMemo(() => {
    return suppliers.find(s => s.id === selectedSupplierId) || null;
  }, [suppliers, selectedSupplierId]);

  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [isStatementOpen, setIsStatementOpen] = useState(false);

  // Form states - Supplier
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [productType, setProductType] = useState('');

  // Form states - Pay supplier
  const [payAmount, setPayAmount] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');

  // Form states - Supplier New Product/Debt
  const [newProductDesc, setNewProductDesc] = useState('');
  const [newProductAmount, setNewProductAmount] = useState('');
  const [newProductDueDate, setNewProductDueDate] = useState('');
  const [newProductNotes, setNewProductNotes] = useState('');

  // Active Supplier statistics & records memoized
  const activeSupplierStats = useMemo(() => {
    if (!activeSupplier) return null;
    const totalOwed = activeSupplier.amount;
    const totalPaid = activeSupplier.paidAmount;
    const remainingOwed = totalOwed - totalPaid;
    const percentagePaid = totalOwed > 0 ? (totalPaid / totalOwed) * 100 : 0;
    return {
      totalOwed,
      totalPaid,
      remainingOwed,
      percentagePaid
    };
  }, [activeSupplier]);

  const activeSupplierProducts = useMemo(() => {
    if (!activeSupplier) return [];
    if (activeSupplier.products && activeSupplier.products.length > 0) {
      return activeSupplier.products;
    }
    // Fallback virtual product
    return [{
      id: 'initial-' + activeSupplier.id,
      description: activeSupplier.productType || activeSupplier.notes || 'Mzigo / Bidhaa za Kwanza (Initial Order)',
      amount: activeSupplier.amount,
      dueDate: activeSupplier.dueDate,
      notes: activeSupplier.notes,
      createdAt: activeSupplier.createdAt
    }];
  }, [activeSupplier]);

  const activeSupplierPayments = useMemo(() => {
    if (!activeSupplier) return [];
    if (activeSupplier.payments && activeSupplier.payments.length > 0) {
      return activeSupplier.payments;
    }
    // Fallback virtual payment
    if (activeSupplier.paidAmount > 0) {
      return [{
        id: 'initial-pay-' + activeSupplier.id,
        amount: activeSupplier.paidAmount,
        date: activeSupplier.createdAt,
        notes: 'Malipo ya kwanza yaliyorekodiwa',
        createdAt: activeSupplier.createdAt
      }];
    }
    return [];
  }, [activeSupplier]);

  // Calculations
  const stats = useMemo(() => {
    let totalOwed = 0;
    let totalPaid = 0;
    
    suppliers.forEach(s => {
      totalOwed += s.amount;
      totalPaid += s.paidAmount;
    });

    return {
      totalOwed,
      totalPaid,
      remainingOwed: totalOwed - totalPaid
    };
  }, [suppliers]);

  // ============================================
  // API HANDLERS
  // ============================================

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phoneNumber || !amount || !dueDate || !productType) return;

    setIsLoading(true);
    setError(null);
    try {
      await api.suppliers.create({
        id: 'sup-' + Date.now(),
        name,
        phoneNumber,
        amount: Number(amount),
        paidAmount: 0,
        dueDate,
        productType,
        notes: notes || productType,
        createdAt: new Date().toISOString().split('T')[0]
      });
      
      onUpdate();
      setIsAddModalOpen(false);
      resetForm();
    } catch (err: any) {
      setError('Imeshindwa kumsajili msambazaji: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier || !name || !phoneNumber || !amount || !dueDate) return;

    setIsLoading(true);
    setError(null);
    try {
      await api.suppliers.update(selectedSupplier.id, {
        name,
        phoneNumber,
        amount: Number(amount),
        paidAmount: selectedSupplier.paidAmount,
        dueDate,
        productType,
        notes
      });
      
      onUpdate();
      setIsEditModalOpen(false);
      setSelectedSupplier(null);
    } catch (err: any) {
      setError('Imeshindwa kuhariri msambazaji: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaySupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier || !payAmount) return;

    setIsLoading(true);
    setError(null);
    try {
      // Build payment notes with product info
      let paymentNotes = payNotes || 'Malipo ya deni la msambazaji';
      
      // If a specific product was selected, include it in notes
      if (selectedProductId && selectedProductId !== 'jumla') {
        const product = activeSupplierProducts.find(p => p.id === selectedProductId);
        if (product) {
          paymentNotes = `Malipo kwa: ${product.description}${payNotes ? ' - ' + payNotes : ''}`;
        }
      }

      await api.supplierPayments.create({
        id: 'spay-' + Date.now(),
        supplierId: selectedSupplier.id,
        amount: Number(payAmount),
        date: new Date().toISOString().split('T')[0],
        notes: paymentNotes
      });
      
      onUpdate();
      setIsPayModalOpen(false);
      setPayAmount('');
      setPayNotes('');
      setSelectedProductId('');
      setSelectedSupplier(null);
    } catch (err: any) {
      setError('Imeshindwa kurekodi malipo: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSupplierProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSupplier || !newProductDesc || !newProductAmount || !newProductDueDate) return;

    setIsLoading(true);
    setError(null);
    try {
      await api.supplierProducts.create({
        id: 'prod-' + Date.now(),
        supplierId: activeSupplier.id,
        description: newProductDesc,
        amount: Number(newProductAmount),
        dueDate: newProductDueDate,
        notes: newProductNotes
      });
      
      onUpdate();
      setIsAddProductModalOpen(false);
      
      setNewProductDesc('');
      setNewProductAmount('');
      setNewProductDueDate('');
      setNewProductNotes('');
    } catch (err: any) {
      setError('Imeshindwa kuongeza mzigo: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSupplier = async (id: string, sName: string) => {
    if (!confirm(`Je, una uhakika unataka kumfuta ${sName}?`)) return;

    setIsLoading(true);
    try {
      await api.suppliers.delete(id);
      onUpdate();
      if (selectedSupplierId === id) setSelectedSupplierId('');
    } catch (err: any) {
      alert('Imeshindwa kumfuta: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setPhoneNumber('');
    setAmount('');
    setDueDate('');
    setNotes('');
    setProductType('');
  };

  const openEditModal = (sup: Supplier) => {
    setSelectedSupplier(sup);
    setName(sup.name);
    setPhoneNumber(sup.phoneNumber);
    setAmount(sup.amount.toString());
    setDueDate(sup.dueDate);
    setNotes(sup.notes);
    setProductType(sup.productType || '');
    setIsEditModalOpen(true);
  };

  const openPayModal = (sup: Supplier) => {
    setSelectedSupplier(sup);
    setPayAmount('');
    setPayNotes('');
    setSelectedProductId('');
    setIsPayModalOpen(true);
  };

  // Fetch settings
  const settings = useMemo(() => {
    return {
      businessName: 'Sonko Sound',
      businessAddress: 'Dar es Salaam, Tanzania',
      businessPhone: '255XXXXXXXXX'
    };
  }, []);

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

      {activeSupplier && activeSupplierStats ? (
        /* SUPPLIER PROFILE FULL PAGE VIEW */
        <div className="space-y-6 text-xs text-left animate-fade-in">
          {/* Profile Header Block */}
          <div className="bg-white rounded-3xl border border-slate-100 p-6 md:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setSelectedSupplierId('')}
                  className="p-2.5 hover:bg-slate-50 text-slate-500 hover:text-slate-700 rounded-2xl border border-slate-100 transition-colors mr-1"
                  title="Rudi kwenye Orodha"
                >
                  <ArrowLeft size={16} />
                </button>
                <div className="h-16 w-16 rounded-2xl bg-amber-100 text-amber-800 font-extrabold text-xl flex items-center justify-center shadow-sm uppercase">
                  {activeSupplier.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">{activeSupplier.name}</h3>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                    <Phone size={12} /> {activeSupplier.phoneNumber}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1 font-mono">
                    <Calendar size={12} /> Usajili: {activeSupplier.createdAt}
                  </p>
                  {activeSupplier.productType && (
                    <span className="inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                      {activeSupplier.productType}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center">
                <button 
                  onClick={() => openEditModal(activeSupplier)}
                  disabled={isLoading}
                  className="py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors flex items-center gap-1.5 font-bold disabled:opacity-50"
                  title="Hariri Maelezo"
                >
                  <Edit2 size={14} /> Hariri (Edit)
                </button>
                <button 
                  onClick={() => handleDeleteSupplier(activeSupplier.id, activeSupplier.name)}
                  disabled={isLoading}
                  className="py-2.5 px-4 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-600 transition-colors flex items-center gap-1.5 font-bold disabled:opacity-50"
                  title="Futa"
                >
                  <Trash2 size={14} /> Futa
                </button>
                <button 
                  onClick={() => setSelectedSupplierId('')}
                  className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors font-bold"
                >
                  Orodha (Back)
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
                  <span className="text-slate-400 font-medium">Baki ya Kulipa</span>
                  <span className="font-extrabold text-rose-600 text-sm">TSh {activeSupplierStats.remainingOwed.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-100 pt-2.5">
                  <span className="text-slate-400 font-medium">Jumla ya Gharama</span>
                  <span className="font-bold text-slate-700">TSh {activeSupplierStats.totalOwed.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-100 pt-2.5">
                  <span className="text-slate-400 font-medium">Zilizolipwa</span>
                  <span className="font-bold text-emerald-600">TSh {activeSupplierStats.totalPaid.toLocaleString()}</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-3">
                  <div 
                    className="bg-emerald-600 h-full rounded-full transition-all"
                    style={{ width: `${activeSupplierStats.percentagePaid}%` }}
                  ></div>
                </div>
                <p className="text-[10px] text-right text-slate-400 font-bold">{Math.round(activeSupplierStats.percentagePaid)}% Lipwa</p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="md:col-span-2 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4 flex flex-col justify-between">
              <div className="space-y-2 text-xs">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2">Notes za Msambazaji</h4>
                <p className="text-slate-500 italic mt-2 leading-relaxed bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                  {activeSupplier.notes || 'Hakuna maelezo ya ziada yaliyosajiliwa kwake.'}
                </p>
              </div>

              <div className="pt-4 flex flex-wrap gap-2">
                <button 
                  onClick={() => setIsAddProductModalOpen(true)}
                  disabled={isLoading}
                  className="bg-accent hover:bg-accent/90 text-white font-bold py-2.5 px-4 rounded-xl flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
                >
                  <Plus size={14} /> Deni Jipya / Ongeza Mzigo
                </button>
                {activeSupplierStats.remainingOwed > 0 && (
                  <button 
                    onClick={() => openPayModal(activeSupplier)}
                    disabled={isLoading}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
                  >
                    <CreditCard size={14} /> Lipa Deni (Record Payment)
                  </button>
                )}
                <button 
                  onClick={() => setIsStatementOpen(true)}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl flex items-center gap-1.5 shadow-sm transition"
                >
                  <Printer size={14} /> Taarifa (Statement)
                </button>
              </div>
            </div>
          </div>

          {/* Products & Payments Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* PRODUCTS LIST */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Clipboard size={14} className="text-amber-500" /> Bidhaa na Mizigo ({activeSupplierProducts.length})
                </h4>
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto">
                {activeSupplierProducts.map((p, idx) => {
                  // Calculate remaining for this product
                  const productPayments = activeSupplierPayments.filter(pay => 
                    pay.notes && pay.notes.includes(p.description)
                  );
                  const totalPaidForProduct = productPayments.reduce((sum, pay) => sum + pay.amount, 0);
                  const remainingForProduct = Math.max(0, p.amount - totalPaidForProduct);
                  
                  return (
                    <div key={p.id} className="p-4 bg-slate-50/60 rounded-2xl border border-slate-100 flex justify-between items-start text-xs">
                      <div className="flex-1">
                        <h5 className="font-bold text-slate-800">{p.description}</h5>
                        <div className="mt-1 flex items-center gap-3 text-[10px] text-slate-400">
                          <span className="flex items-center gap-0.5"><Calendar size={10} /> Tarehe: {p.createdAt}</span>
                          <span className="flex items-center gap-0.5"><Calendar size={10} className="text-rose-500" /> Ukomo: {p.dueDate}</span>
                        </div>
                        {p.notes && <p className="text-[10px] text-slate-500 italic mt-1">Notes: {p.notes}</p>}
                        
                        {/* Progress bar for this product */}
                        {p.amount > 0 && (
                          <div className="mt-2 space-y-1">
                            <div className="flex justify-between text-[10px]">
                              <span className="text-slate-400">Lipwa: TSh {totalPaidForProduct.toLocaleString()}</span>
                              <span className={remainingForProduct > 0 ? 'text-rose-500 font-bold' : 'text-emerald-500 font-bold'}>
                                {remainingForProduct > 0 ? `Salio: TSh ${remainingForProduct.toLocaleString()}` : 'Imelipwa Kabisa ✓'}
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all ${remainingForProduct > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                style={{ width: `${Math.min(100, (totalPaidForProduct / p.amount) * 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="text-right ml-3">
                        <span className="font-extrabold text-slate-700 block">TSh {p.amount.toLocaleString()}</span>
                        <span className="text-[10px] text-slate-400 font-medium">Mzigo #{idx + 1}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* PAYMENTS HISTORY */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <History size={14} className="text-emerald-500" /> Historia ya Malipo ({activeSupplierPayments.length})
                </h4>
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto">
                {activeSupplierPayments.map((p, idx) => (
                  <div key={p.id} className="p-4 bg-slate-50/60 rounded-2xl border border-slate-100 flex justify-between items-start text-xs">
                    <div className="flex-1">
                      <h5 className="font-bold text-slate-800">{p.notes}</h5>
                      <span className="text-[10px] text-slate-400 flex items-center gap-0.5 mt-1">
                        <Calendar size={10} /> Tarehe: {p.date}
                      </span>
                    </div>
                    <div className="text-right ml-3">
                      <span className="font-extrabold text-emerald-600 block">TSh {p.amount.toLocaleString()}</span>
                      <span className="text-[10px] text-slate-400 font-medium">Malipo #{idx + 1}</span>
                    </div>
                  </div>
                ))}

                {activeSupplierPayments.length === 0 && (
                  <p className="text-xs text-slate-400 italic text-center py-6">Hakuna malipo yoyote yaliyorekodiwa bado.</p>
                )}
              </div>
            </div>

          </div>
        </div>
      ) : (
        /* DEFAULT LIST VIEW */
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Jumla ya Madeni kwa Wauzaji</span>
              <h3 className="text-2xl font-black text-slate-800 mt-2">TSh {stats.totalOwed.toLocaleString()}</h3>
              <p className="text-[10px] text-slate-400 mt-1">Gharama zote zilizokopwa</p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Kiasi Kilicholipwa</span>
              <h3 className="text-2xl font-black text-success mt-2">TSh {stats.totalPaid.toLocaleString()}</h3>
              <p className="text-[10px] text-success mt-1">Umelipa kwa uaminifu</p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Baki ya Kulipa</span>
              <h3 className="text-2xl font-black text-rose-600 mt-2">TSh {stats.remainingOwed.toLocaleString()}</h3>
              <p className="text-[10px] text-rose-500 mt-1">Madeni yaliyosalia</p>
            </div>
          </div>

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-white p-5 rounded-3xl border border-slate-100 shadow-sm gap-4">
            <div>
              <h2 className="text-md font-bold text-slate-850">Suppliers (Wauzaji)</h2>
              <p className="text-xs text-slate-400 mt-1">Dhibiti wauzaji wa huduma au watu uliokopa fedha.</p>
            </div>
            <button 
              onClick={() => { resetForm(); setIsAddModalOpen(true); }}
              disabled={isLoading}
              className="bg-accent hover:bg-accent/90 text-white font-semibold text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
            >
              <Plus size={15} /> Sajili Msambazaji
            </button>
          </div>

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex items-center justify-center gap-2 text-xs text-slate-400 py-2">
              <Loader2 size={14} className="animate-spin" />
              <span>Inasasisha data...</span>
            </div>
          )}

          {/* Suppliers Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {suppliers.length > 0 ? (
              suppliers.map(sup => {
                const rem = sup.amount - sup.paidAmount;
                return (
                  <div 
                    key={sup.id} 
                    onClick={() => setSelectedSupplierId(sup.id)}
                    className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm hover:shadow-md hover:border-slate-300 cursor-pointer transition flex flex-col justify-between space-y-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">{sup.name}</h3>
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                          <Phone size={12} /> {sup.phoneNumber}
                        </p>
                        {sup.productType && (
                          <span className="inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                            {sup.productType}
                          </span>
                        )}
                      </div>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                        rem <= 0 ? 'bg-success/10 text-success' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {rem <= 0 ? 'Safi' : 'Unpaid'}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-2">
                      <div className="flex justify-between font-medium">
                        <span className="text-slate-400">Jumla:</span>
                        <span className="font-bold text-slate-700">TSh {sup.amount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span className="text-slate-400">Lipwa:</span>
                        <span className="font-bold text-success">TSh {sup.paidAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between font-medium border-t border-slate-200/50 pt-1.5 mt-1.5">
                        <span className="text-slate-400">Inayobaki:</span>
                        <span className="font-bold text-rose-600">TSh {rem.toLocaleString()}</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 bg-slate-50/30 p-2 rounded-xl border border-dashed border-slate-100 truncate">
                      Notes: {sup.notes || 'Hakuna notes'}
                    </p>

                    <div className="flex items-center gap-2 border-t border-slate-50 pt-3">
                      <p className="text-[10px] text-slate-400 flex items-center gap-0.5 font-mono">
                        <Calendar size={10} /> Due: {sup.dueDate}
                      </p>
                      
                      <div className="ml-auto flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {rem > 0 && (
                          <button
                            onClick={() => openPayModal(sup)}
                            disabled={isLoading}
                            className="bg-accent/10 hover:bg-accent/20 text-accent p-2 rounded-xl transition disabled:opacity-50"
                            title="Lipa deni"
                          >
                            <CreditCard size={13} />
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(sup)}
                          disabled={isLoading}
                          className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-50 transition disabled:opacity-50"
                          title="Hariri"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteSupplier(sup.id, sup.name)}
                          disabled={isLoading}
                          className="text-rose-500 hover:text-rose-600 p-2 rounded-xl hover:bg-rose-50 transition disabled:opacity-50"
                          title="Futa"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full bg-white p-12 text-center rounded-3xl border border-slate-100 shadow-sm text-slate-400">
                <Users size={40} className="mx-auto text-slate-300 mb-3" />
                <p className="text-sm font-semibold">Hakuna wauzaji bado.</p>
                <p className="text-xs mt-1">Bonyeza "Sajili Msambazaji" kuanza.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* MODAL 1: Add Supplier - WITH PRODUCT TYPE FIELD */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-scale-in">
            <button onClick={() => setIsAddModalOpen(false)} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition">
              <X size={18} />
            </button>
            
            <h3 className="text-md font-bold text-slate-850">Sajili Msambazaji Mpya</h3>
            
            <FormAIOCR 
              label="Changanua Karatasi kwa AI Camera"
              onSuccess={(data) => {
                if (data.name) setName(data.name);
                if (data.number) setPhoneNumber(data.number);
                if (data.deni) setAmount(data.deni.toString());
                const combinedNotes = [data.maelezo_ya_bidhaa, data.notes].filter(Boolean).join('. ');
                if (combinedNotes) setNotes(combinedNotes);
                if (data.maelezo_ya_bidhaa) setProductType(data.maelezo_ya_bidhaa);
              }}
            />
            
            <form onSubmit={handleAddSupplier} className="space-y-4 text-xs text-left">
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Jina Kamili *</label>
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Mfano: Ally Said" className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-accent focus:border-accent" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Namba ya Simu *</label>
                  <input type="tel" required value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="0715332211" className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-accent focus:border-accent" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Kiasi Unachodaiwa *</label>
                  <input type="number" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="TSh" className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-accent focus:border-accent" />
                </div>
              </div>

              {/* PRODUCT TYPE - Same as customer debt form */}
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Bidhaa (Product Type) *</label>
                <input
                  type="text"
                  required
                  value={productType}
                  onChange={(e) => setProductType(e.target.value)}
                  placeholder="Mfano: Mizigo/Products, Huduma, Mkopo n.k."
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-white focus:ring-accent focus:border-accent"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Ukomo wa Malipo *</label>
                <input type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-accent focus:border-accent" />
              </div>

              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Maelezo ya Ziada (Optional)</label>
                <textarea 
                  value={notes} 
                  onChange={(e) => setNotes(e.target.value)} 
                  placeholder="Maelezo mengineyo ya bidhaa..." 
                  className="w-full p-2.5 border border-slate-200 rounded-xl h-20 focus:ring-accent focus:border-accent" 
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsAddModalOpen(false)} disabled={isLoading} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600 transition disabled:opacity-50">
                  Ghairi
                </button>
                <button type="submit" disabled={isLoading} className="px-5 py-2 bg-accent hover:bg-accent/90 text-white rounded-xl font-semibold shadow-sm transition disabled:opacity-50 flex items-center gap-2">
                  {isLoading ? <><Loader2 size={14} className="animate-spin" /> Inasajili...</> : 'Hifadhi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Supplier - UPDATED WITH PRODUCT TYPE */}
      {isEditModalOpen && selectedSupplier && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-scale-in">
            <button onClick={() => { setIsEditModalOpen(false); setSelectedSupplier(null); }} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition">
              <X size={18} />
            </button>
            <h3 className="text-md font-bold text-slate-850">Hariri Maelezo</h3>
            <form onSubmit={handleEditSupplier} className="space-y-4 text-xs text-left">
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Jina Kamili *</label>
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-accent focus:border-accent" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Namba ya Simu *</label>
                  <input type="tel" required value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-accent focus:border-accent" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Kiasi Kamili *</label>
                  <input type="number" required value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-accent focus:border-accent" />
                </div>
              </div>
              
              {/* Product Type Field */}
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Bidhaa (Product Type) *</label>
                <input
                  type="text"
                  required
                  value={productType}
                  onChange={(e) => setProductType(e.target.value)}
                  placeholder="Mfano: Mizigo/Products, Huduma, Mkopo n.k."
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-white focus:ring-accent focus:border-accent"
                />
              </div>
              
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Ukomo wa Malipo *</label>
                <input type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-accent focus:border-accent" />
              </div>
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Maelezo ya Ziada (Optional)</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl h-20 focus:ring-accent focus:border-accent" />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => { setIsEditModalOpen(false); setSelectedSupplier(null); }} disabled={isLoading} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600 transition disabled:opacity-50">Ghairi</button>
                <button type="submit" disabled={isLoading} className="px-5 py-2 bg-accent hover:bg-accent/90 text-white rounded-xl font-semibold shadow-sm transition disabled:opacity-50 flex items-center gap-2">
                  {isLoading ? <><Loader2 size={14} className="animate-spin" /> Inahifadhi...</> : 'Hifadhi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Pay Supplier - UPDATED WITH PRODUCT SELECTION */}
      {isPayModalOpen && selectedSupplier && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-scale-in">
            <button 
              onClick={() => { setIsPayModalOpen(false); setSelectedSupplier(null); setSelectedProductId(''); }}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition"
            >
              <X size={18} />
            </button>
            
            <h3 className="text-md font-bold text-slate-850">Rekodi Malipo ya Msambazaji</h3>
            <p className="text-xs text-slate-400">
              Lipa <strong>{selectedSupplier.name}</strong>. Chagua bidhaa/mzigo unaolipia.
            </p>
            
            <form onSubmit={handlePaySupplier} className="space-y-4 text-xs text-left">
              
              {/* Select Product to Pay */}
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Bidhaa / Mzigo Unayolipia *
                </label>
                <select
                  required
                  value={selectedProductId}
                  onChange={(e) => {
                    setSelectedProductId(e.target.value);
                    const selectedProduct = activeSupplierProducts.find(p => p.id === e.target.value);
                    if (selectedProduct) {
                      // Calculate remaining for this product
                      const productPayments = activeSupplierPayments.filter(pay => 
                        pay.notes && pay.notes.includes(selectedProduct.description)
                      );
                      const totalPaidForProduct = productPayments.reduce((sum, pay) => sum + pay.amount, 0);
                      const remainingForProduct = Math.max(0, selectedProduct.amount - totalPaidForProduct);
                      
                      setPayAmount(remainingForProduct.toString());
                      setPayNotes(`Malipo kwa: ${selectedProduct.description}`);
                    } else if (e.target.value === 'jumla') {
                      // Pay total remaining
                      const totalRemaining = selectedSupplier.amount - selectedSupplier.paidAmount;
                      setPayAmount(totalRemaining.toString());
                      setPayNotes('');
                    }
                  }}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-white focus:ring-accent focus:border-accent"
                >
                  <option value="">Chagua bidhaa/mzigo...</option>
                  {activeSupplierProducts.map(product => {
                    // Calculate remaining amount for this product
                    const productPayments = activeSupplierPayments.filter(pay => 
                      pay.notes && pay.notes.includes(product.description)
                    );
                    const totalPaidForProduct = productPayments.reduce((sum, pay) => sum + pay.amount, 0);
                    const remainingForProduct = Math.max(0, product.amount - totalPaidForProduct);
                    
                    if (remainingForProduct <= 0) return null;
                    
                    return (
                      <option key={product.id} value={product.id}>
                        {product.description} (Salio: TSh {remainingForProduct.toLocaleString()})
                      </option>
                    );
                  })}
                  <option value="jumla">
                    💰 Malipo ya Jumla (Salio lote: TSh {(selectedSupplier.amount - selectedSupplier.paidAmount).toLocaleString()})
                  </option>
                </select>
              </div>

              {/* Payment Amount */}
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Kiasi unacholipa leo (TSh) *
                </label>
                <input 
                  type="number" 
                  required 
                  value={payAmount} 
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="Mfano: 50000"
                  min="1"
                  max={selectedSupplier.amount - selectedSupplier.paidAmount}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-accent focus:border-accent" 
                />
              </div>

              {/* Quick amount buttons */}
              <div className="flex gap-2">
                {(() => {
                  const totalRemaining = selectedSupplier.amount - selectedSupplier.paidAmount;
                  const amounts = [
                    Math.min(10000, totalRemaining),
                    Math.min(50000, totalRemaining),
                    Math.min(100000, totalRemaining),
                    totalRemaining
                  ].filter((v, i, a) => v > 0 && a.indexOf(v) === i).slice(0, 4);
                  
                  return amounts.map(amount => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setPayAmount(amount.toString())}
                      className={`flex-1 py-2 px-2 rounded-xl text-[10px] font-bold border transition ${
                        payAmount === amount.toString()
                          ? 'bg-accent text-white border-accent'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      TSh {amount >= 1000 ? `${(amount/1000).toFixed(0)}k` : amount.toLocaleString()}
                    </button>
                  );
                })()}
              </div>

              {/* Notes */}
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Maelezo ya Ziada
                </label>
                <input 
                  type="text" 
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="Mfano: Malipo ya m-pesa au pesa taslimu"
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-accent focus:border-accent" 
                />
              </div>

              {/* Summary */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Jumla ya Deni:</span>
                  <span className="font-bold text-slate-700">TSh {selectedSupplier.amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Tayari Kulipwa:</span>
                  <span className="font-bold text-emerald-600">TSh {selectedSupplier.paidAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[11px] border-t border-slate-200 pt-1.5">
                  <span className="text-slate-400">Baki Baada ya Malipo Hili:</span>
                  <span className={`font-bold ${selectedSupplier.amount - selectedSupplier.paidAmount - Number(payAmount || 0) <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    TSh {Math.max(0, selectedSupplier.amount - selectedSupplier.paidAmount - Number(payAmount || 0)).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => { setIsPayModalOpen(false); setSelectedSupplier(null); setSelectedProductId(''); }}
                  disabled={isLoading}
                  className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600 transition disabled:opacity-50"
                >
                  Ghairi
                </button>
                <button 
                  type="submit"
                  disabled={isLoading || !payAmount || Number(payAmount) <= 0}
                  className="px-5 py-2 bg-accent hover:bg-accent/90 text-white rounded-xl font-semibold shadow-sm transition disabled:opacity-50 flex items-center gap-2"
                >
                  {isLoading ? (
                    <><Loader2 size={14} className="animate-spin" /> Inarekodi...</>
                  ) : (
                    'Hifadhi Malipo'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Add Supplier Product */}
      {isAddProductModalOpen && activeSupplier && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-scale-in">
            <button onClick={() => setIsAddProductModalOpen(false)} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition">
              <X size={18} />
            </button>
            <h3 className="text-md font-bold text-slate-850">Ongeza Mzigo Mpya / Deni Jipya</h3>
            <p className="text-xs text-slate-400">Msambazaji: {activeSupplier.name}</p>

            <FormAIOCR 
              label="Changanua Risiti kwa AI Camera"
              onSuccess={(data) => {
                if (data.maelezo_ya_bidhaa) setNewProductDesc(data.maelezo_ya_bidhaa);
                if (data.deni) setNewProductAmount(data.deni.toString());
                if (data.notes) setNewProductNotes(data.notes);
              }}
            />

            <form onSubmit={handleCreateSupplierProduct} className="space-y-4 text-xs text-left">
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Maelezo ya Mzigo/Bidhaa *</label>
                <input type="text" required value={newProductDesc} onChange={(e) => setNewProductDesc(e.target.value)} placeholder="Mfano: Fresh Groceries Supply" className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-accent focus:border-accent" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Kiasi (TSh) *</label>
                  <input type="number" required value={newProductAmount} onChange={(e) => setNewProductAmount(e.target.value)} placeholder="30000" className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-accent focus:border-accent" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Ukomo *</label>
                  <input type="date" required value={newProductDueDate} onChange={(e) => setNewProductDueDate(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-accent focus:border-accent" />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Notes</label>
                <textarea value={newProductNotes} onChange={(e) => setNewProductNotes(e.target.value)} placeholder="Notes yoyote..." className="w-full p-2.5 border border-slate-200 rounded-xl h-20 focus:ring-accent focus:border-accent" />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsAddProductModalOpen(false)} disabled={isLoading} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600 transition disabled:opacity-50">Ghairi</button>
                <button type="submit" disabled={isLoading} className="px-5 py-2 bg-accent hover:bg-accent/90 text-white rounded-xl font-semibold shadow-sm transition disabled:opacity-50 flex items-center gap-2">
                  {isLoading ? <><Loader2 size={14} className="animate-spin" /> Inahifadhi...</> : 'Hifadhi Mzigo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Statement */}
      {isStatementOpen && activeSupplier && activeSupplierStats && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto animate-scale-in" id="printable-statement-container">
            <div className="absolute top-6 right-6 flex items-center gap-2 print:hidden">
              <button onClick={() => window.print()} className="bg-slate-900 text-white flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold hover:bg-slate-800 transition">
                <Printer size={14} /> Chapisha / PDF
              </button>
              <button onClick={() => setIsStatementOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-6 pt-4 text-slate-700">
              <div className="flex justify-between items-start border-b border-slate-200 pb-6">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-800 uppercase">{settings.businessName}</h2>
                  <p className="text-xs text-slate-500 mt-1">Anuani: {settings.businessAddress}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Simu: {settings.businessPhone}</p>
                </div>
                <div className="text-right">
                  <span className="inline-block text-[10px] uppercase tracking-wider font-extrabold px-3 py-1 bg-slate-100 text-slate-600 rounded-full">Taarifa ya Msambazaji</span>
                  <p className="text-[11px] text-slate-400 mt-2">Muda: {new Date().toLocaleDateString('sw-TZ')}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-8 py-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase">MSAMBAZAJI:</h4>
                  <h3 className="text-sm font-bold text-slate-800 mt-1">{activeSupplier.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Simu: {activeSupplier.phoneNumber}</p>
                  {activeSupplier.productType && (
                    <p className="text-[10px] text-slate-500 mt-0.5">Bidhaa: {activeSupplier.productType}</p>
                  )}
                </div>
                <div className="text-right">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase">SALIO (TSh):</h4>
                  <h3 className="text-lg font-black text-rose-600 mt-1">TSh {activeSupplierStats.remainingOwed.toLocaleString()}</h3>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-1.5 uppercase">Historia ya Bidhaa</h4>
                <table className="w-full text-left text-xs text-slate-600">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold">
                      <th className="py-2.5 px-3 rounded-l-lg">Bidhaa</th>
                      <th className="py-2.5 px-3">Tarehe</th>
                      <th className="py-2.5 px-3">Ukomo</th>
                      <th className="py-2.5 px-3 text-right rounded-r-lg">Gharama (TSh)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSupplierProducts.map(prod => (
                      <tr key={prod.id} className="border-b border-slate-100/50">
                        <td className="py-2 px-3 font-semibold">{prod.description}</td>
                        <td className="py-2 px-3 font-mono text-slate-400">{prod.createdAt}</td>
                        <td className="py-2 px-3 font-mono text-slate-400">{prod.dueDate}</td>
                        <td className="py-2 px-3 text-right font-bold">TSh {prod.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-1.5 uppercase">Historia ya Malipo</h4>
                <table className="w-full text-left text-xs text-slate-600">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold">
                      <th className="py-2.5 px-3 rounded-l-lg">Maelezo</th>
                      <th className="py-2.5 px-3">Tarehe</th>
                      <th className="py-2.5 px-3 text-right rounded-r-lg">Kiasi (TSh)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSupplierPayments.length > 0 ? (
                      activeSupplierPayments.map(pay => (
                        <tr key={pay.id} className="border-b border-slate-100/50">
                          <td className="py-2 px-3">{pay.notes || 'Malipo'}</td>
                          <td className="py-2 px-3 font-mono text-slate-400">{pay.date}</td>
                          <td className="py-2 px-3 text-right font-bold text-success">TSh {pay.amount.toLocaleString()}</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={3} className="py-4 text-center text-slate-400">Hakuna malipo bado.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="pt-12 grid grid-cols-2 gap-12 text-xs">
                <div className="border-t border-slate-200 pt-3 text-center">
                  <p className="font-bold text-slate-800">Sahihi ya Msambazaji</p>
                  <p className="text-slate-400 mt-1">{activeSupplier.name}</p>
                </div>
                <div className="border-t border-slate-200 pt-3 text-center">
                  <p className="font-bold text-slate-800">Sahihi ya Mpokeaji</p>
                  <p className="text-slate-400 mt-1">{settings.businessName}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
