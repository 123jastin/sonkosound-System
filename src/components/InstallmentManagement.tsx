/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { api } from '../services/api';
import FormAIOCR from './FormAIOCR';
import { 
  Users, Plus, Phone, Calendar, Package, 
  Trash2, CreditCard, ChevronRight, Check, X, AlertCircle, Edit2,
  ArrowLeft, History, Printer, MapPin, Loader2, Wallet,
  TrendingUp, CheckCircle2, Clock, ShoppingBag
} from 'lucide-react';

// Types for Installment System
interface InstallmentCustomer {
  id: string;
  fullName: string;
  phoneNumber: string;
  address: string;
  notes: string;
  createdAt: string;
}

interface InstallmentProduct {
  id: string;
  customerId: string;
  productName: string;
  description: string;
  totalAmount: number;
  paidAmount: number;
  startDate: string;
  expectedCompletionDate: string;
  status: 'Active' | 'Completed' | 'Defaulted';
  notes: string;
  createdAt: string;
}

interface InstallmentPayment {
  id: string;
  productId: string;
  amount: number;
  date: string;
  paymentMethod: string;
  notes: string;
  createdAt: string;
}

interface InstallmentManagementProps {
  onUpdate: () => void;
}

export default function InstallmentManagement({ onUpdate }: InstallmentManagementProps) {
  // State Management
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Data states
  const [customers, setCustomers] = useState<InstallmentCustomer[]>([]);
  const [products, setProducts] = useState<InstallmentProduct[]>([]);
  const [payments, setPayments] = useState<InstallmentPayment[]>([]);
  
  // UI States
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [isEditCustomerModalOpen, setIsEditCustomerModalOpen] = useState(false);
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<InstallmentProduct | null>(null);
  const [viewingHistoryProduct, setViewingHistoryProduct] = useState<InstallmentProduct | null>(null);
  
  // Form states - Customer
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  
  // Form states - Product
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [expectedCompletionDate, setExpectedCompletionDate] = useState('');
  const [productNotes, setProductNotes] = useState('');
  
  // Form states - Payment
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [payNotes, setPayNotes] = useState('');

  // Load data on mount
  React.useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // In production, fetch from API
      // const [custData, prodData, payData] = await Promise.all([
      //   api.installmentCustomers.list(),
      //   api.installmentProducts.list(),
      //   api.installmentPayments.list()
      // ]);
      
      // For now, load from localStorage or use empty arrays
      const savedData = localStorage.getItem('installment_data');
      if (savedData) {
        const parsed = JSON.parse(savedData);
        setCustomers(parsed.customers || []);
        setProducts(parsed.products || []);
        setPayments(parsed.payments || []);
      }
    } catch (err) {
      console.error('Failed to load installment data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const saveData = (newCustomers: InstallmentCustomer[], newProducts: InstallmentProduct[], newPayments: InstallmentPayment[]) => {
    localStorage.setItem('installment_data', JSON.stringify({
      customers: newCustomers,
      products: newProducts,
      payments: newPayments
    }));
  };

  // Active customer details
  const activeCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  // Active customer's products
  const activeCustomerProducts = useMemo(() => {
    if (!selectedCustomerId) return [];
    return products.filter(p => p.customerId === selectedCustomerId);
  }, [products, selectedCustomerId]);

  // Calculate stats
  const stats = useMemo(() => {
    let totalExpected = 0;
    let totalCollected = 0;
    let totalRemaining = 0;
    let activeInstallments = 0;
    let completedInstallments = 0;
    
    products.forEach(p => {
      totalExpected += p.totalAmount;
      totalCollected += p.paidAmount;
      const remaining = p.totalAmount - p.paidAmount;
      totalRemaining += Math.max(0, remaining);
      
      if (p.status === 'Active' && remaining > 0) {
        activeInstallments++;
      } else if (p.status === 'Completed' || remaining <= 0) {
        completedInstallments++;
      }
    });
    
    return {
      totalExpected,
      totalCollected,
      totalRemaining,
      activeInstallments,
      completedInstallments,
      totalCustomers: customers.length
    };
  }, [products, customers]);

  // Get customer's product stats
  const getCustomerProductStats = (customerId: string) => {
    const customerProducts = products.filter(p => p.customerId === customerId);
    const totalProducts = customerProducts.length;
    const completedProducts = customerProducts.filter(p => p.paidAmount >= p.totalAmount).length;
    const totalValue = customerProducts.reduce((sum, p) => sum + p.totalAmount, 0);
    const paidValue = customerProducts.reduce((sum, p) => sum + p.paidAmount, 0);
    
    return {
      totalProducts,
      completedProducts,
      totalValue,
      paidValue,
      remainingValue: totalValue - paidValue
    };
  };

  // Handlers
  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !phoneNumber) return;
    
    setIsLoading(true);
    try {
      const newCustomer: InstallmentCustomer = {
        id: 'icust-' + Date.now(),
        fullName,
        phoneNumber,
        address,
        notes,
        createdAt: new Date().toISOString().split('T')[0]
      };
      
      const newCustomers = [...customers, newCustomer];
      setCustomers(newCustomers);
      saveData(newCustomers, products, payments);
      
      setIsAddCustomerModalOpen(false);
      resetCustomerForm();
      onUpdate();
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
    try {
      const updatedCustomers = customers.map(c => 
        c.id === selectedCustomerId 
          ? { ...c, fullName, phoneNumber, address, notes }
          : c
      );
      
      setCustomers(updatedCustomers);
      saveData(updatedCustomers, products, payments);
      
      setIsEditCustomerModalOpen(false);
      onUpdate();
    } catch (err: any) {
      setError('Imeshindwa kuhariri wasifu: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCustomer = async (customerId: string) => {
    if (!confirm('Je, una uhakika unataka kumfuta mteja huyu na bidhaa zake zote?')) return;
    
    setIsLoading(true);
    try {
      const newCustomers = customers.filter(c => c.id !== customerId);
      const newProducts = products.filter(p => p.customerId !== customerId);
      const productIds = products.filter(p => p.customerId === customerId).map(p => p.id);
      const newPayments = payments.filter(p => !productIds.includes(p.productId));
      
      setCustomers(newCustomers);
      setProducts(newProducts);
      setPayments(newPayments);
      saveData(newCustomers, newProducts, newPayments);
      
      if (selectedCustomerId === customerId) setSelectedCustomerId('');
      onUpdate();
    } catch (err: any) {
      alert('Imeshindwa kumfuta: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !productName || !totalAmount) return;
    
    setIsLoading(true);
    try {
      const newProduct: InstallmentProduct = {
        id: 'iprod-' + Date.now(),
        customerId: selectedCustomerId,
        productName,
        description: productDescription,
        totalAmount: Number(totalAmount),
        paidAmount: 0,
        startDate: new Date().toISOString().split('T')[0],
        expectedCompletionDate,
        status: 'Active',
        notes: productNotes,
        createdAt: new Date().toISOString()
      };
      
      const newProducts = [...products, newProduct];
      setProducts(newProducts);
      saveData(customers, newProducts, payments);
      
      setIsAddProductModalOpen(false);
      resetProductForm();
      onUpdate();
    } catch (err: any) {
      setError('Imeshindwa kuongeza bidhaa: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !payAmount) return;
    
    setIsLoading(true);
    try {
      const amount = Number(payAmount);
      const newPayment: InstallmentPayment = {
        id: 'ipay-' + Date.now(),
        productId: selectedProduct.id,
        amount,
        date: new Date().toISOString().split('T')[0],
        paymentMethod: payMethod,
        notes: payNotes || `Malipo ya ${selectedProduct.productName}`,
        createdAt: new Date().toISOString()
      };
      
      const newPayments = [...payments, newPayment];
      const updatedProducts = products.map(p => {
        if (p.id === selectedProduct.id) {
          const newPaidAmount = p.paidAmount + amount;
          return {
            ...p,
            paidAmount: newPaidAmount,
            status: newPaidAmount >= p.totalAmount ? 'Completed' : 'Active'
          };
        }
        return p;
      });
      
      setPayments(newPayments);
      setProducts(updatedProducts);
      saveData(customers, updatedProducts, newPayments);
      
      setIsPayModalOpen(false);
      resetPaymentForm();
      onUpdate();
    } catch (err: any) {
      setError('Imeshindwa kurekodi malipo: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const resetCustomerForm = () => {
    setFullName('');
    setPhoneNumber('');
    setAddress('');
    setNotes('');
  };

  const resetProductForm = () => {
    setProductName('');
    setProductDescription('');
    setTotalAmount('');
    setExpectedCompletionDate('');
    setProductNotes('');
  };

  const resetPaymentForm = () => {
    setPayAmount('');
    setPayNotes('');
  };

  const openEditCustomerModal = () => {
    if (!activeCustomer) return;
    setFullName(activeCustomer.fullName);
    setPhoneNumber(activeCustomer.phoneNumber);
    setAddress(activeCustomer.address);
    setNotes(activeCustomer.notes);
    setIsEditCustomerModalOpen(true);
  };

  const openPayModal = (product: InstallmentProduct) => {
    setSelectedProduct(product);
    setPayAmount('');
    setPayNotes('');
    setIsPayModalOpen(true);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const settings = {
    businessName: 'Sonko Sound',
    businessAddress: 'Dar es Salaam, Tanzania',
    businessPhone: '255XXXXXXXXX'
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

      {activeCustomer ? (
        /* CUSTOMER INSTALLMENT PROFILE */
        <div className="space-y-6 text-xs text-left animate-fade-in">
          
          {/* Profile Header */}
          <div className="bg-white rounded-3xl border border-slate-100 p-6 md:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setSelectedCustomerId('')}
                  className="p-2.5 hover:bg-slate-50 text-slate-500 hover:text-slate-700 rounded-2xl border border-slate-100 transition-colors"
                >
                  <ArrowLeft size={16} />
                </button>
                <div className="h-16 w-16 rounded-2xl bg-indigo-100 text-indigo-800 font-extrabold text-xl flex items-center justify-center shadow-sm">
                  {getInitials(activeCustomer.fullName)}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">{activeCustomer.fullName}</h3>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                    <Phone size={12} /> {activeCustomer.phoneNumber}
                  </p>
                  {activeCustomer.address && (
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <MapPin size={12} /> {activeCustomer.address}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={openEditCustomerModal}
                  disabled={isLoading}
                  className="py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors flex items-center gap-1.5 font-bold disabled:opacity-50"
                >
                  <Edit2 size={14} /> Hariri
                </button>
                <button 
                  onClick={() => handleDeleteCustomer(activeCustomer.id)}
                  disabled={isLoading}
                  className="py-2.5 px-4 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-600 transition-colors flex items-center gap-1.5 font-bold disabled:opacity-50"
                >
                  <Trash2 size={14} /> Futa
                </button>
                <button 
                  onClick={() => setSelectedCustomerId('')}
                  className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors font-bold"
                >
                  Orodha
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
              <div className="text-center">
                <p className="text-xs text-slate-400">Bidhaa Zote</p>
                <p className="text-lg font-bold text-slate-800">{activeCustomerProducts.length}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400">Zilizokamilika</p>
                <p className="text-lg font-bold text-emerald-600">{activeCustomerProducts.filter(p => p.paidAmount >= p.totalAmount).length}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400">Jumla ya Thamani</p>
                <p className="text-lg font-bold text-slate-800">TSh {activeCustomerProducts.reduce((sum, p) => sum + p.totalAmount, 0).toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400">Baki</p>
                <p className="text-lg font-bold text-rose-600">TSh {activeCustomerProducts.reduce((sum, p) => sum + Math.max(0, p.totalAmount - p.paidAmount), 0).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={() => setIsAddProductModalOpen(true)}
              disabled={isLoading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-5 rounded-xl flex items-center gap-2 shadow-sm transition disabled:opacity-50"
            >
              <Plus size={16} /> Ongeza Bidhaa
            </button>
            <button 
              onClick={() => setIsStatementOpen(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-5 rounded-xl flex items-center gap-2 shadow-sm transition"
            >
              <Printer size={16} /> Taarifa
            </button>
          </div>

          {/* Products List */}
          <div className="space-y-4">
            {activeCustomerProducts.map(product => {
              const productPayments = payments.filter(p => p.productId === product.id);
              const remaining = Math.max(0, product.totalAmount - product.paidAmount);
              const progressPercentage = product.totalAmount > 0 ? (product.paidAmount / product.totalAmount) * 100 : 0;
              
              return (
                <div key={product.id} className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600">
                          <Package size={20} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-800">{product.productName}</h4>
                          <p className="text-xs text-slate-400 mt-0.5">{product.description || 'Hakuna maelezo'}</p>
                        </div>
                      </div>
                      
                      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-[10px] text-slate-400 font-semibold uppercase">Bei Kamili</p>
                          <p className="text-sm font-bold text-slate-800 mt-1">TSh {product.totalAmount.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-semibold uppercase">Imelipwa</p>
                          <p className="text-sm font-bold text-emerald-600 mt-1">TSh {product.paidAmount.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-semibold uppercase">Baki</p>
                          <p className="text-sm font-bold text-rose-600 mt-1">TSh {remaining.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-semibold uppercase">Hali</p>
                          <span className={`inline-block mt-1 px-2 py-1 rounded-full text-[10px] font-bold ${
                            remaining <= 0 ? 'bg-emerald-100 text-emerald-700' : 
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {remaining <= 0 ? '✓ Imekamilika' : 'Inaendelea'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-slate-400">Maendeleo ya Malipo</span>
                          <span className="font-bold text-slate-700">{Math.round(progressPercentage)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${remaining <= 0 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                            style={{ width: `${progressPercentage}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex md:flex-col gap-2">
                      {remaining > 0 && (
                        <button 
                          onClick={() => openPayModal(product)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl flex items-center gap-1.5 text-xs transition"
                        >
                          <CreditCard size={14} /> Lipa
                        </button>
                      )}
                      <button 
                        onClick={() => setViewingHistoryProduct(product)}
                        className="border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold py-2 px-4 rounded-xl flex items-center gap-1.5 text-xs transition"
                      >
                        <History size={14} /> Historia
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {activeCustomerProducts.length === 0 && (
              <div className="bg-white p-12 text-center rounded-3xl border border-slate-100 shadow-sm text-slate-400">
                <ShoppingBag size={40} className="mx-auto text-slate-300 mb-3" />
                <p className="text-sm font-semibold">Hakuna bidhaa bado.</p>
                <p className="text-xs mt-1">Ongeza bidhaa ya kwanza kwa kutumia kitufe cha "Ongeza Bidhaa".</p>
              </div>
            )}
          </div>

          {/* Payment History */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-4">Historia ya Malipo</h3>
            <div className="space-y-3">
              {payments
                .filter(p => products.find(prod => prod.id === p.productId)?.customerId === selectedCustomerId)
                .map(payment => {
                  const product = products.find(p => p.id === payment.productId);
                  return (
                    <div key={payment.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div>
                        <p className="text-xs font-bold text-slate-800">{payment.notes}</p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {payment.date} • {payment.paymentMethod}
                          {product && ` • ${product.productName}`}
                        </p>
                      </div>
                      <span className="text-sm font-extrabold text-emerald-600">
                        TSh {payment.amount.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              
              {payments.filter(p => products.find(prod => prod.id === p.productId)?.customerId === selectedCustomerId).length === 0 && (
                <p className="text-xs text-slate-400 text-center py-8">Hakuna malipo bado.</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* LIST VIEW */
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Thamani ya Bidhaa Zote</span>
              <h3 className="text-2xl font-black text-slate-800 mt-2">TSh {stats.totalExpected.toLocaleString()}</h3>
              <p className="text-[10px] text-slate-400 mt-1">Jumla ya thamani ya bidhaa zote</p>
            </div>
            
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Kiasi Kilichokusanywa</span>
              <h3 className="text-2xl font-black text-emerald-600 mt-2">TSh {stats.totalCollected.toLocaleString()}</h3>
              <p className="text-[10px] text-emerald-500 mt-1">Malipo yote yaliyopokelewa</p>
            </div>
            
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Baki ya Kukusanya</span>
              <h3 className="text-2xl font-black text-rose-600 mt-2">TSh {stats.totalRemaining.toLocaleString()}</h3>
              <p className="text-[10px] text-rose-500 mt-1">Fedha zinazosubiriwa</p>
            </div>
            
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Wateja wa Mkopo</span>
              <h3 className="text-2xl font-black text-slate-800 mt-2">{stats.totalCustomers}</h3>
              <p className="text-[10px] text-slate-400 mt-1">
                {stats.activeInstallments} zinazoendelea, {stats.completedInstallments} zimekamilika
              </p>
            </div>
          </div>

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-white p-5 rounded-3xl border border-slate-100 shadow-sm gap-4">
            <div>
              <h2 className="text-md font-bold text-slate-800">Installments (Mafungu)</h2>
              <p className="text-xs text-slate-400 mt-1">Dhibiti wateja wanaonunua bidhaa kwa malipo ya awamu.</p>
            </div>
            <button 
              onClick={() => { resetCustomerForm(); setIsAddCustomerModalOpen(true); }}
              disabled={isLoading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
            >
              <Plus size={15} /> Sajili Mteja
            </button>
          </div>

          {/* Customers Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {customers.length > 0 ? (
              customers.map(customer => {
                const customerStats = getCustomerProductStats(customer.id);
                const hasActiveProducts = customerStats.totalProducts > 0;
                
                return (
                  <div 
                    key={customer.id} 
                    onClick={() => setSelectedCustomerId(customer.id)}
                    className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm hover:shadow-md hover:border-slate-300 cursor-pointer transition flex flex-col justify-between space-y-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-xl bg-indigo-100 text-indigo-800 font-bold flex items-center justify-center">
                          {getInitials(customer.fullName)}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-800">{customer.fullName}</h3>
                          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                            <Phone size={12} /> {customer.phoneNumber}
                          </p>
                        </div>
                      </div>
                      {hasActiveProducts ? (
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                          {customerStats.totalProducts} Bidhaa
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
                          Mpya
                        </span>
                      )}
                    </div>

                    {hasActiveProducts && (
                      <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-2">
                        <div className="flex justify-between font-medium">
                          <span className="text-slate-400">Thamani:</span>
                          <span className="font-bold text-slate-700">TSh {customerStats.totalValue.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between font-medium">
                          <span className="text-slate-400">Imelipwa:</span>
                          <span className="font-bold text-emerald-600">TSh {customerStats.paidValue.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between font-medium border-t border-slate-200/50 pt-1.5">
                          <span className="text-slate-400">Baki:</span>
                          <span className="font-bold text-rose-600">TSh {customerStats.remainingValue.toLocaleString()}</span>
                        </div>
                      </div>
                    )}

                    {customer.address && (
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <MapPin size={12} /> {customer.address}
                      </p>
                    )}

                    <div className="flex items-center justify-between border-t border-slate-50 pt-3">
                      <p className="text-[10px] text-slate-400 font-mono">
                        <Calendar size={10} /> {customer.createdAt}
                      </p>
                      <span className="text-[10px] font-semibold text-indigo-600 flex items-center gap-0.5">
                        Fungua <ChevronRight size={12} />
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full bg-white p-12 text-center rounded-3xl border border-slate-100 shadow-sm text-slate-400">
                <Users size={40} className="mx-auto text-slate-300 mb-3" />
                <p className="text-sm font-semibold">Hakuna wateja wa mafungu bado.</p>
                <p className="text-xs mt-1">Bonyeza "Sajili Mteja" kuanza.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* MODAL: Add Customer */}
      {isAddCustomerModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-scale-in">
            <button onClick={() => setIsAddCustomerModalOpen(false)} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition">
              <X size={18} />
            </button>
            
            <h3 className="text-md font-bold text-slate-800">Sajili Mteja wa Mafungu</h3>
            
            <FormAIOCR 
              label="Changanua Karatasi kwa AI Camera"
              onSuccess={(data) => {
                if (data.name) setFullName(data.name);
                if (data.number) setPhoneNumber(data.number);
                if (data.notes) setNotes(data.notes);
              }}
            />
            
            <form onSubmit={handleAddCustomer} className="space-y-4 text-xs text-left">
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Jina Kamili *</label>
                <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Mfano: Juma Kassim" className="w-full p-2.5 border border-slate-200 rounded-xl" />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Namba ya Simu *</label>
                  <input type="tel" required value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="0712345678" className="w-full p-2.5 border border-slate-200 rounded-xl" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Anuani</label>
                  <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Mtaa, Jiji" className="w-full p-2.5 border border-slate-200 rounded-xl" />
                </div>
              </div>
              
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Maelezo</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Maelezo ya ziada..." className="w-full p-2.5 border border-slate-200 rounded-xl h-20" />
              </div>
              
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsAddCustomerModalOpen(false)} disabled={isLoading} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600 transition disabled:opacity-50">Ghairi</button>
                <button type="submit" disabled={isLoading} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-sm transition disabled:opacity-50 flex items-center gap-2">
                  {isLoading ? <><Loader2 size={14} className="animate-spin" /> Inasajili...</> : 'Sajili Mteja'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Customer */}
      {isEditCustomerModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-scale-in">
            <button onClick={() => setIsEditCustomerModalOpen(false)} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition">
              <X size={18} />
            </button>
            
            <h3 className="text-md font-bold text-slate-800">Hariri Wasifu</h3>
            
            <form onSubmit={handleEditCustomer} className="space-y-4 text-xs text-left">
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Jina Kamili *</label>
                <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl" />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Namba ya Simu *</label>
                  <input type="tel" required value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Anuani</label>
                  <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl" />
                </div>
              </div>
              
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Maelezo</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl h-20" />
              </div>
              
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsEditCustomerModalOpen(false)} disabled={isLoading} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600 transition disabled:opacity-50">Ghairi</button>
                <button type="submit" disabled={isLoading} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-sm transition disabled:opacity-50 flex items-center gap-2">
                  {isLoading ? <><Loader2 size={14} className="animate-spin" /> Inahifadhi...</> : 'Hifadhi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Product */}
      {isAddProductModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-scale-in">
            <button onClick={() => setIsAddProductModalOpen(false)} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition">
              <X size={18} />
            </button>
            
            <h3 className="text-md font-bold text-slate-800">Ongeza Bidhaa ya Mkopo</h3>
            <p className="text-xs text-slate-400">Mteja: {activeCustomer?.fullName}</p>
            
            <form onSubmit={handleAddProduct} className="space-y-4 text-xs text-left">
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Jina la Bidhaa *</label>
                <input type="text" required value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Mfano: Speaker ya Sony" className="w-full p-2.5 border border-slate-200 rounded-xl" />
              </div>
              
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Maelezo ya Bidhaa</label>
                <textarea value={productDescription} onChange={(e) => setProductDescription(e.target.value)} placeholder="Maelezo ya bidhaa..." className="w-full p-2.5 border border-slate-200 rounded-xl h-20" />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Bei Kamili (TSh) *</label>
                  <input type="number" required value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="50000" className="w-full p-2.5 border border-slate-200 rounded-xl" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Tarehe ya Kukamilisha</label>
                  <input type="date" value={expectedCompletionDate} onChange={(e) => setExpectedCompletionDate(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl" />
                </div>
              </div>
              
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Notes</label>
                <textarea value={productNotes} onChange={(e) => setProductNotes(e.target.value)} placeholder="Maelezo ya ziada..." className="w-full p-2.5 border border-slate-200 rounded-xl h-20" />
              </div>
              
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsAddProductModalOpen(false)} disabled={isLoading} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600 transition disabled:opacity-50">Ghairi</button>
                <button type="submit" disabled={isLoading} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-sm transition disabled:opacity-50 flex items-center gap-2">
                  {isLoading ? <><Loader2 size={14} className="animate-spin" /> Inahifadhi...</> : 'Hifadhi Bidhaa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Pay Product */}
      {isPayModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-scale-in">
            <button onClick={() => { setIsPayModalOpen(false); resetPaymentForm(); }} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition">
              <X size={18} />
            </button>
            
            <h3 className="text-md font-bold text-slate-800">Rekodi Malipo ya Mkopo</h3>
            <p className="text-xs text-slate-400">{selectedProduct.productName} - {activeCustomer?.fullName}</p>
            
            <form onSubmit={handlePayProduct} className="space-y-4 text-xs text-left">
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Kiasi (TSh) *</label>
                <input 
                  type="number" 
                  required 
                  value={payAmount} 
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder={`Baki: ${Math.max(0, selectedProduct.totalAmount - selectedProduct.paidAmount).toLocaleString()}`}
                  min="1"
                  max={Math.max(0, selectedProduct.totalAmount - selectedProduct.paidAmount)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl" 
                />
              </div>
              
              {/* Quick amount buttons */}
              <div className="flex gap-2">
                {(() => {
                  const remaining = Math.max(0, selectedProduct.totalAmount - selectedProduct.paidAmount);
                  const amounts = [
                    Math.min(10000, remaining),
                    Math.min(20000, remaining),
                    Math.min(50000, remaining),
                    remaining
                  ].filter((v, i, a) => v > 0 && a.indexOf(v) === i).slice(0, 4);
                  
                  return amounts.map(amount => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setPayAmount(amount.toString())}
                      className={`flex-1 py-2 px-2 rounded-xl text-[10px] font-bold border transition ${
                        payAmount === amount.toString()
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      TSh {amount >= 1000 ? `${(amount / 1000).toFixed(0)}k` : amount.toLocaleString()}
                    </button>
                  ));
                })()}
              </div>
              
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Njia ya Malipo</label>
                <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl bg-white">
                  <option value="Cash">Cash / Pesa Taslimu</option>
                  <option value="M-Pesa">M-Pesa</option>
                  <option value="Tigo Pesa">Tigo Pesa</option>
                  <option value="Airtel Money">Airtel Money</option>
                  <option value="HaloPesa">HaloPesa</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>
              
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Notes</label>
                <input type="text" value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Maelezo ya malipo..." className="w-full p-2.5 border border-slate-200 rounded-xl" />
              </div>
              
              {/* Summary */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Bei Kamili:</span>
                  <span className="font-bold text-slate-700">TSh {selectedProduct.totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Imelipwa:</span>
                  <span className="font-bold text-emerald-600">TSh {selectedProduct.paidAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[11px] border-t border-slate-200 pt-1.5">
                  <span className="text-slate-400">Baki Baada ya Malipo:</span>
                  <span className={`font-bold ${selectedProduct.totalAmount - selectedProduct.paidAmount - Number(payAmount || 0) <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    TSh {Math.max(0, selectedProduct.totalAmount - selectedProduct.paidAmount - Number(payAmount || 0)).toLocaleString()}
                  </span>
                </div>
              </div>
              
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => { setIsPayModalOpen(false); resetPaymentForm(); }} disabled={isLoading} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600 transition disabled:opacity-50">Ghairi</button>
                <button type="submit" disabled={isLoading || !payAmount || Number(payAmount) <= 0} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-sm transition disabled:opacity-50 flex items-center gap-2">
                  {isLoading ? <><Loader2 size={14} className="animate-spin" /> Inarekodi...</> : 'Hifadhi Malipo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Payment History */}
      {viewingHistoryProduct && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-scale-in">
            <button onClick={() => setViewingHistoryProduct(null)} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition">
              <X size={18} />
            </button>
            
            <h3 className="text-md font-bold text-slate-800">Historia ya Malipo</h3>
            <p className="text-xs text-slate-400">{viewingHistoryProduct.productName}</p>
            
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {payments
                .filter(p => p.productId === viewingHistoryProduct.id)
                .map(payment => (
                  <div key={payment.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div>
                      <p className="text-xs font-bold text-slate-800">{payment.notes}</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {payment.date} • {payment.paymentMethod}
                      </p>
                    </div>
                    <span className="text-sm font-extrabold text-emerald-600">
                      TSh {payment.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
              
              {payments.filter(p => p.productId === viewingHistoryProduct.id).length === 0 && (
                <p className="text-xs text-slate-400 text-center py-8">Hakuna malipo bado.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Statement */}
      {isStatementOpen && activeCustomer && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto animate-scale-in">
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
                  <span className="inline-block text-[10px] uppercase tracking-wider font-extrabold px-3 py-1 bg-slate-100 text-slate-600 rounded-full">Taarifa ya Mafungu</span>
                  <p className="text-[11px] text-slate-400 mt-2">Muda: {new Date().toLocaleDateString('sw-TZ')}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-8 py-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase">MTEJA:</h4>
                  <h3 className="text-sm font-bold text-slate-800 mt-1">{activeCustomer.fullName}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Simu: {activeCustomer.phoneNumber}</p>
                  {activeCustomer.address && <p className="text-xs text-slate-500 mt-0.5">Anuani: {activeCustomer.address}</p>}
                </div>
                <div className="text-right">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase">SALIO (TSh):</h4>
                  <h3 className="text-lg font-black text-rose-600 mt-1">
                    TSh {activeCustomerProducts.reduce((sum, p) => sum + Math.max(0, p.totalAmount - p.paidAmount), 0).toLocaleString()}
                  </h3>
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-800 border-b border-slate-100 pb-1.5 uppercase">Historia ya Bidhaa</h4>
                <table className="w-full text-left text-xs text-slate-600">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold">
                      <th className="py-2.5 px-3 rounded-l-lg">Bidhaa</th>
                      <th className="py-2.5 px-3">Bei Kamili</th>
                      <th className="py-2.5 px-3">Imelipwa</th>
                      <th className="py-2.5 px-3 text-right rounded-r-lg">Baki</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeCustomerProducts.map(product => {
                      const remaining = Math.max(0, product.totalAmount - product.paidAmount);
                      return (
                        <tr key={product.id} className="border-b border-slate-100/50">
                          <td className="py-2 px-3 font-semibold">{product.productName}</td>
                          <td className="py-2 px-3">TSh {product.totalAmount.toLocaleString()}</td>
                          <td className="py-2 px-3 text-emerald-600">TSh {product.paidAmount.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right font-bold text-rose-600">TSh {remaining.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              <div className="pt-12 grid grid-cols-2 gap-12 text-xs">
                <div className="border-t border-slate-200 pt-3 text-center">
                  <p className="font-bold text-slate-800">Sahihi ya Mmiliki</p>
                  <p className="text-slate-400 mt-1">{settings.businessName}</p>
                </div>
                <div className="border-t border-slate-200 pt-3 text-center">
                  <p className="font-bold text-slate-800">Sahihi ya Mteja</p>
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
