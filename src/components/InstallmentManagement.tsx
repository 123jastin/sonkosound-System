/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import FormAIOCR from './FormAIOCR';
import { 
  Users, Plus, Phone, Calendar, Package, 
  Trash2, CreditCard, ChevronRight, Check, X, AlertCircle, Edit2,
  ArrowLeft, History, Printer, MapPin, Loader2, Wallet,
  TrendingUp, CheckCircle2, Clock, ShoppingBag, Award, PartyPopper
} from 'lucide-react';

// Interfaces
interface InstallmentCustomer {
  id: string;
  full_name: string;
  phone_number: string;
  address: string;
  notes: string;
  created_at: string;
}

interface InstallmentProduct {
  id: string;
  customer_id: string;
  product_name: string;
  description: string;
  total_amount: number;
  paid_amount: number;
  start_date: string;
  expected_completion_date: string;
  status: string;
  notes: string;
  created_at: string;
  customer_name?: string;
  customer_phone?: string;
}

interface InstallmentPayment {
  id: string;
  product_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  notes: string;
  receipt_number: string;
  created_at: string;
}

// ✅ NEW: multi-product item shape
interface ProductItem {
  id: string;
  product_name: string;
  description: string;
  total_amount: string;
  expected_completion_date: string;
  notes: string;
}

export interface InstallmentNotification {
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

interface InstallmentManagementProps {
  onUpdate: () => void;
  onNotificationsGenerated?: (notifications: InstallmentNotification[]) => void;
  userRole?: 'admin' | 'staff' | null; // ✅ NEW: Role for delete permissions
}

const API_BASE_URL = '/api/installment';

// ============================================
// CONSTANTS
// ============================================
const LOGO_URL = 'https://pics.sonkosound.store/file_0000000018a881f4bef28aaff0866bbd.png';

// ✅ Create a fresh empty product row
const newProductItem = (): ProductItem => ({
  id: 'item-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
  product_name: '',
  description: '',
  total_amount: '',
  expected_completion_date: '',
  notes: ''
});

export function generateInstallmentNotifications(
  products: InstallmentProduct[],
  customers: InstallmentCustomer[]
): InstallmentNotification[] {
  const notifications: InstallmentNotification[] = [];
  const today = new Date().toISOString().split('T')[0];

  products.forEach(product => {
    const customer = customers.find(c => c.id === product.customer_id);
    if (!customer) return;

    const totalAmount = Number(product.total_amount);
    const paidAmount = Number(product.paid_amount);
    
    if (totalAmount <= 0) return;

    const progressPercentage = Math.round((paidAmount / totalAmount) * 100);
    
    if (progressPercentage >= 45 && progressPercentage <= 55 && paidAmount < totalAmount) {
      notifications.push({
        id: `installment-half-${product.id}`,
        type: 'Installment Halfway',
        message: `${customer.full_name} amefika nusu ya malipo ya ${product.product_name} (${progressPercentage}%). Imebakia TSh ${(totalAmount - paidAmount).toLocaleString()}.`,
        date: today,
        customerId: customer.id,
        productId: product.id,
        productName: product.product_name,
        customerName: customer.full_name,
        phoneNumber: customer.phone_number,
        progressPercentage,
        startDate: product.start_date,
        totalAmount,
        paidAmount
      });
    }
    
    if (paidAmount >= totalAmount) {
      notifications.push({
        id: `installment-complete-${product.id}`,
        type: 'Installment Completed',
        message: `${customer.full_name} amekamilisha malipo ya ${product.product_name} aliyo ibandika tangu tarehe ${product.start_date}. Hongera! 🎉`,
        date: today,
        customerId: customer.id,
        productId: product.id,
        productName: product.product_name,
        customerName: customer.full_name,
        phoneNumber: customer.phone_number,
        progressPercentage: 100,
        startDate: product.start_date,
        totalAmount,
        paidAmount
      });
    }
  });

  return notifications;
}

export default function InstallmentManagement({ 
  onUpdate, 
  onNotificationsGenerated,
  userRole, // ✅ Receive role
}: InstallmentManagementProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [customers, setCustomers] = useState<InstallmentCustomer[]>([]);
  const [products, setProducts] = useState<InstallmentProduct[]>([]);
  const [payments, setPayments] = useState<InstallmentPayment[]>([]);
  
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [isEditCustomerModalOpen, setIsEditCustomerModalOpen] = useState(false);
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<InstallmentProduct | null>(null);
  const [viewingHistoryProduct, setViewingHistoryProduct] = useState<InstallmentProduct | null>(null);
  
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  // ✅ MULTI-PRODUCT STATE
  const [productItems, setProductItems] = useState<ProductItem[]>([newProductItem()]);

  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [payNotes, setPayNotes] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const sendPaymentNotification = async (
    customerName: string,
    customerPhone: string,
    productName: string,
    totalAmount: number,
    paidAmount: number,
    paymentAmount: number,
    isCompleted: boolean,
    progressPercentage: number,
    paymentMethod: string
  ) => {
    try {
      const response = await fetch('/api/installment-send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          customerPhone,
          productName,
          totalAmount,
          paidAmount,
          paymentAmount,
          isCompleted,
          progressPercentage,
          paymentMethod
        })
      });
      
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('📱 Failed to send SMS:', error);
      return { success: false, error };
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}`);
      const data = await response.json();
      if (data.customers) {
        setCustomers(data.customers);
        setProducts(data.products || []);
        setPayments(data.payments || []);
      }
    } catch (err) {
      console.error('Failed to load installment data:', err);
      const savedData = localStorage.getItem('installment_data');
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          setCustomers(parsed.customers || []);
          setProducts(parsed.products || []);
          setPayments(parsed.payments || []);
        } catch (e) {
          console.error('Failed to parse saved data:', e);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const activeCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  const activeCustomerProducts = useMemo(() => {
    if (!selectedCustomerId) return [];
    return products.filter(p => p.customer_id === selectedCustomerId);
  }, [products, selectedCustomerId]);

  const stats = useMemo(() => {
    let totalExpected = 0, totalCollected = 0, totalRemaining = 0;
    let activeInstallments = 0, completedInstallments = 0;
    products.forEach(p => {
      const total = Number(p.total_amount) || 0;
      const paid = Number(p.paid_amount) || 0;
      totalExpected += total;
      totalCollected += paid;
      const remaining = total - paid;
      totalRemaining += Math.max(0, remaining);
      if (remaining > 0) activeInstallments++;
      else completedInstallments++;
    });
    return { totalExpected, totalCollected, totalRemaining, activeInstallments, completedInstallments, totalCustomers: customers.length };
  }, [products, customers]);

  const productsTotal = useMemo(() => {
    return productItems.reduce((sum, item) => {
      return sum + (Number(item.total_amount) || 0);
    }, 0);
  }, [productItems]);

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !phoneNumber) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, phoneNumber, address, notes })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed');
      setCustomers(prev => [result.customer, ...prev]);
      setIsAddCustomerModalOpen(false);
      resetCustomerForm();
      onUpdate();
    } catch (err: any) {
      const newCustomer: InstallmentCustomer = {
        id: 'icust-' + Date.now(),
        full_name: fullName,
        phone_number: phoneNumber,
        address,
        notes,
        created_at: new Date().toISOString()
      };
      const updatedCustomers = [newCustomer, ...customers];
      setCustomers(updatedCustomers);
      localStorage.setItem('installment_data', JSON.stringify({ customers: updatedCustomers, products, payments }));
      setIsAddCustomerModalOpen(false);
      resetCustomerForm();
      onUpdate();
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
      const response = await fetch(`${API_BASE_URL}/customers/${selectedCustomerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, phoneNumber, address, notes })
      });
      if (!response.ok) throw new Error('Failed');
      setCustomers(prev => prev.map(c => c.id === selectedCustomerId ? { ...c, full_name: fullName, phone_number: phoneNumber, address, notes } : c));
      setIsEditCustomerModalOpen(false);
      onUpdate();
    } catch (err: any) {
      setCustomers(prev => prev.map(c => c.id === selectedCustomerId ? { ...c, full_name: fullName, phone_number: phoneNumber, address, notes } : c));
      setIsEditCustomerModalOpen(false);
      onUpdate();
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCustomer = async (customerId: string) => {
    // ✅ Only admins can delete
    if (userRole !== 'admin') {
      setError('Huna ruhusa ya kufuta. Wasiliana na Admin.');
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (!confirm('Je, una uhakika unataka kumfuta mteja huyu na bidhaa zake zote?')) return;
    setIsLoading(true);
    try {
      await fetch(`${API_BASE_URL}/customers/${customerId}`, { method: 'DELETE' });
      setCustomers(prev => prev.filter(c => c.id !== customerId));
      setProducts(prev => prev.filter(p => p.customer_id !== customerId));
      if (selectedCustomerId === customerId) setSelectedCustomerId('');
      onUpdate();
    } catch (err: any) {
      setCustomers(prev => prev.filter(c => c.id !== customerId));
      setProducts(prev => prev.filter(p => p.customer_id !== customerId));
      if (selectedCustomerId === customerId) setSelectedCustomerId('');
      onUpdate();
    } finally {
      setIsLoading(false);
    }
  };

  const updateProductItem = (index: number, field: keyof ProductItem, value: string) => {
    setProductItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addProductItem = () => {
    setProductItems(prev => [...prev, newProductItem()]);
  };

  const removeProductItem = (index: number) => {
    if (productItems.length === 1) return;
    setProductItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) return;

    const validItems = productItems.filter(
      item => item.product_name.trim() && Number(item.total_amount) > 0
    );

    if (validItems.length === 0) {
      setError('Ongeza bidhaa angalau moja na bei');
      setTimeout(() => setError(null), 3000);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const startDate = new Date().toISOString().split('T')[0];
      const createdProducts: InstallmentProduct[] = [];

      for (const item of validItems) {
        const payload = {
          customerId: selectedCustomerId,
          productName: item.product_name.trim(),
          description: item.description.trim(),
          totalAmount: Number(item.total_amount),
          paidAmount: 0,
          startDate,
          expectedCompletionDate: item.expected_completion_date || '',
          status: 'Active',
          notes: item.notes.trim()
        };

        try {
          const response = await fetch(`${API_BASE_URL}/products`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Failed');

          createdProducts.push(result.product);
        } catch (apiErr) {
          const fallback: InstallmentProduct = {
            id: 'iprod-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            customer_id: selectedCustomerId,
            product_name: payload.productName,
            description: payload.description,
            total_amount: payload.totalAmount,
            paid_amount: 0,
            start_date: payload.startDate,
            expected_completion_date: payload.expectedCompletionDate,
            status: 'Active',
            notes: payload.notes,
            created_at: new Date().toISOString()
          };
          createdProducts.push(fallback);
        }
      }

      setProducts(prev => [...createdProducts, ...prev]);
      setIsAddProductModalOpen(false);
      resetProductForm();
      onUpdate();
    } catch (err: any) {
      console.error('Add products error:', err);
      setError('Imeshindwa kuongeza bidhaa: ' + (err?.message || 'Jaribu tena'));
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !payAmount) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct.id,
          amount: Number(payAmount),
          paymentDate: new Date().toISOString().split('T')[0],
          paymentMethod: payMethod,
          notes: payNotes || `Malipo ya ${selectedProduct.product_name}`
        })
      });
      
      const result = await response.json();
      
      const newPayment: InstallmentPayment = {
        id: result.payment?.id || 'ipay-' + Date.now(),
        product_id: selectedProduct.id,
        amount: Number(payAmount),
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: payMethod,
        notes: payNotes || `Malipo ya ${selectedProduct.product_name}`,
        receipt_number: '',
        created_at: new Date().toISOString()
      };
      setPayments(prev => [newPayment, ...prev]);
      
      const updatedProducts = products.map(p => {
        if (p.id === selectedProduct.id) {
          const newPaid = Number(p.paid_amount) + Number(payAmount);
          const newStatus = newPaid >= Number(p.total_amount) ? 'Completed' : 'Active';
          return { ...p, paid_amount: newPaid, status: newStatus };
        }
        return p;
      });
      setProducts(updatedProducts);
      
      const updatedProduct = updatedProducts.find(p => p.id === selectedProduct.id);
      const customer = customers.find(c => c.id === selectedProduct.customer_id);
      
      if (updatedProduct && customer && customer.phone_number) {
        const newPaidAmount = Number(updatedProduct.paid_amount);
        const totalProductAmount = Number(updatedProduct.total_amount);
        const remainingAmount = Math.max(0, totalProductAmount - newPaidAmount);
        const isCompleted = remainingAmount <= 0 || newPaidAmount >= totalProductAmount;
        const progressPercentage = totalProductAmount > 0 ? Math.round((newPaidAmount / totalProductAmount) * 100) : 0;
        
        await sendPaymentNotification(
          customer.full_name,
          customer.phone_number,
          updatedProduct.product_name,
          totalProductAmount,
          newPaidAmount,
          Number(payAmount),
          isCompleted,
          progressPercentage,
          payMethod
        );
      }
      
      if (onNotificationsGenerated && updatedProduct) {
        const notifs = generateInstallmentNotifications([updatedProduct], customers);
        if (notifs.length > 0) {
          onNotificationsGenerated(notifs);
        }
      }
      
      setIsPayModalOpen(false);
      resetPaymentForm();
      onUpdate();
      
    } catch (err: any) {
      console.error('Payment error:', err);
      setError('Imeshindwa kurekodi malipo: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const resetCustomerForm = () => { setFullName(''); setPhoneNumber(''); setAddress(''); setNotes(''); };

  const resetProductForm = () => {
    setProductItems([newProductItem()]);
  };

  const resetPaymentForm = () => { setPayAmount(''); setPayNotes(''); };

  const openEditCustomerModal = () => {
    if (!activeCustomer) return;
    setFullName(activeCustomer.full_name);
    setPhoneNumber(activeCustomer.phone_number);
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

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const settings = {
    businessName: 'Sonko Sound',
    businessAddress: 'Dar es Salaam, Tanzania',
    businessPhone: '255XXXXXXXXX'
  };

  // ============================================
  // PRINT STATEMENT
  // ============================================
  const handlePrintStatement = () => {
    if (!activeCustomer) return;

    const now = new Date();
    const statementId = `INS-${Date.now().toString(36).toUpperCase()}`;

    const totalValue = activeCustomerProducts.reduce((s, p) => s + Number(p.total_amount), 0);
    const totalPaid = activeCustomerProducts.reduce((s, p) => s + Number(p.paid_amount), 0);
    const totalRemaining = Math.max(0, totalValue - totalPaid);

    const allPayments = payments
      .filter(p => activeCustomerProducts.some(pr => pr.id === p.product_id))
      .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <title>Taarifa ya Mafungu - ${activeCustomer.full_name}</title>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: A4; margin: 12mm; }
    body { font-family: 'Segoe UI', Tahoma, sans-serif; background: white; color: #1e293b; padding: 20px; }
    .container { max-width: 190mm; margin: 0 auto; }
    .header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; background: linear-gradient(135deg, #312e81 0%, #4f46e5 50%, #6366f1 100%); color: white; border-radius: 12px; margin-bottom: 24px; gap: 20px; }
    .header-left { display: flex; align-items: center; gap: 16px; }
    .logo-box { width: 70px; height: 70px; border-radius: 14px; background: white; display: flex; align-items: center; justify-content: center; padding: 6px; box-shadow: 0 4px 15px rgba(0,0,0,0.15); flex-shrink: 0; overflow: hidden; }
    .logo-box img { width: 100%; height: 100%; object-fit: contain; }
    .business-name { font-size: 22px; font-weight: 900; letter-spacing: 1px; line-height: 1.1; }
    .business-slogan { font-size: 11px; opacity: 0.9; margin-top: 4px; }
    .business-contact { font-size: 10px; opacity: 0.85; margin-top: 3px; }
    .statement-badge { display: inline-block; background: rgba(255,255,255,0.25); padding: 6px 14px; border-radius: 20px; font-size: 10px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; }
    .statement-id { font-size: 10px; opacity: 0.85; margin-top: 8px; font-family: monospace; }
    .section { margin-bottom: 22px; }
    .section-title { font-size: 13px; font-weight: 800; color: #312e81; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid #c7d2fe; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 16px; background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 10px; }
    .info-card { display: flex; flex-direction: column; gap: 3px; }
    .info-label { font-size: 9px; font-weight: 800; text-transform: uppercase; color: #4338ca; letter-spacing: 0.5px; }
    .info-value { font-size: 13px; font-weight: bold; color: #1e293b; }
    .stat-strip { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 20px; }
    .stat-item { border-radius: 12px; padding: 14px; text-align: center; }
    .stat-item.total { background: #e0e7ff; border: 1px solid #a5b4fc; }
    .stat-item.paid  { background: #d1fae5; border: 1px solid #6ee7b7; }
    .stat-item.balance { background: #fee2e2; border: 1px solid #fca5a5; }
    .stat-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .stat-item.total .stat-label { color: #3730a3; }
    .stat-item.paid .stat-label  { color: #065f46; }
    .stat-item.balance .stat-label { color: #991b1b; }
    .stat-value { font-size: 18px; font-weight: 900; }
    .stat-item.total .stat-value { color: #312e81; }
    .stat-item.paid .stat-value  { color: #059669; }
    .stat-item.balance .stat-value { color: #dc2626; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; }
    thead th { background: linear-gradient(135deg, #312e81 0%, #4f46e5 100%); color: white; padding: 10px 12px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 800; }
    thead th:last-child { text-align: right; }
    tbody td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 11px; color: #334155; }
    tbody td:last-child { text-align: right; font-weight: bold; }
    tbody tr:nth-child(even) { background: #eef2ff; }
    tbody tr:last-child td { border-bottom: none; }
    .empty-row { text-align: center !important; padding: 20px !important; color: #94a3b8; font-style: italic; }
    .payment-amount { color: #059669; font-weight: bold; }
    .status-badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3px; }
    .status-completed { background: #d1fae5; color: #065f46; }
    .status-active    { background: #fef3c7; color: #92400e; }
    .signatures { display: flex; justify-content: space-between; gap: 40px; margin-top: 50px; padding: 0 20px; }
    .signature-box { flex: 1; text-align: center; }
    .signature-line { border-top: 1.5px solid #312e81; padding-top: 8px; font-size: 11px; font-weight: bold; color: #312e81; }
    .signature-sub { font-size: 9px; color: #94a3b8; margin-top: 3px; }
    .footer { margin-top: 30px; padding: 14px; background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%); border-radius: 10px; text-align: center; font-size: 10px; color: #312e81; border: 1px solid #c7d2fe; }
    .footer strong { color: #312e81; }
    .no-print { text-align: center; padding: 20px; margin-top: 10px; }
    .no-print button { background: #4f46e5; color: white; border: none; padding: 12px 28px; border-radius: 22px; font-size: 13px; font-weight: bold; cursor: pointer; margin: 0 5px; transition: all 0.2s; }
    .no-print button:hover { background: #4338ca; }
    .no-print button.close { background: #64748b; }
    .no-print button.close:hover { background: #475569; }
    @media print { .no-print { display: none !important; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-left">
        <div class="logo-box"><img src="${LOGO_URL}" alt="Sonko Sound Logo" /></div>
        <div>
          <div class="business-name">${settings.businessName.toUpperCase()}</div>
          <div class="business-slogan">Electronics &amp; Appliances</div>
          <div class="business-contact">${settings.businessAddress} • ${settings.businessPhone}</div>
        </div>
      </div>
      <div style="text-align: right;">
        <div class="statement-badge">Taarifa ya Mafungu</div>
        <div class="statement-id">${statementId}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Taarifa za Mteja</div>
      <div class="info-grid">
        <div class="info-card"><span class="info-label">Jina la Mteja</span><span class="info-value">${activeCustomer.full_name}</span></div>
        <div class="info-card"><span class="info-label">Namba ya Simu</span><span class="info-value">${activeCustomer.phone_number}</span></div>
        <div class="info-card"><span class="info-label">Anuani</span><span class="info-value">${activeCustomer.address || '—'}</span></div>
        <div class="info-card"><span class="info-label">Tarehe ya Taarifa</span><span class="info-value">${now.toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
      </div>

      <div class="stat-strip">
        <div class="stat-item total">
          <div class="stat-label">Jumla ya Bidhaa</div>
          <div class="stat-value">TSh ${totalValue.toLocaleString()}</div>
        </div>
        <div class="stat-item paid">
          <div class="stat-label">Imelipwa</div>
          <div class="stat-value">TSh ${totalPaid.toLocaleString()}</div>
        </div>
        <div class="stat-item balance">
          <div class="stat-label">Baki</div>
          <div class="stat-value">TSh ${totalRemaining.toLocaleString()}</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Bidhaa za Mkopo (${activeCustomerProducts.length})</div>
      <table>
        <thead>
          <tr>
            <th>Bidhaa</th>
            <th>Bei Kamili</th>
            <th>Imelipwa</th>
            <th>Baki</th>
            <th>Hali</th>
          </tr>
        </thead>
        <tbody>
          ${activeCustomerProducts.length > 0
            ? activeCustomerProducts.map(product => {
                const remaining = Math.max(0, Number(product.total_amount) - Number(product.paid_amount));
                const isDone = remaining <= 0;
                return `
                  <tr>
                    <td>${product.product_name}${product.description ? `<br><span style="font-size:9px;color:#94a3b8;">${product.description}</span>` : ''}</td>
                    <td>TSh ${Number(product.total_amount).toLocaleString()}</td>
                    <td class="payment-amount">TSh ${Number(product.paid_amount).toLocaleString()}</td>
                    <td style="color:#dc2626;font-weight:bold;">TSh ${remaining.toLocaleString()}</td>
                    <td><span class="status-badge ${isDone ? 'status-completed' : 'status-active'}">${isDone ? 'Imekamilika' : 'Inaendelea'}</span></td>
                  </tr>
                `;
              }).join('')
            : '<tr><td colspan="5" class="empty-row">Hakuna bidhaa bado</td></tr>'
          }
        </tbody>
      </table>
    </div>

    <div class="section">
      <div class="section-title">Historia ya Malipo (${allPayments.length})</div>
      <table>
        <thead>
          <tr>
            <th>Tarehe</th>
            <th>Bidhaa</th>
            <th>Njia</th>
            <th>Maelezo</th>
            <th>Kiasi</th>
          </tr>
        </thead>
        <tbody>
          ${allPayments.length > 0
            ? allPayments.map(pay => {
                const prod = activeCustomerProducts.find(pr => pr.id === pay.product_id);
                return `
                  <tr>
                    <td>${pay.payment_date}</td>
                    <td>${prod?.product_name || '—'}</td>
                    <td>${pay.payment_method}</td>
                    <td>${pay.notes || 'Malipo'}</td>
                    <td class="payment-amount">TSh ${Number(pay.amount).toLocaleString()}</td>
                  </tr>
                `;
              }).join('')
            : '<tr><td colspan="5" class="empty-row">Hakuna malipo bado</td></tr>'
          }
        </tbody>
      </table>
    </div>

    <div class="signatures">
      <div class="signature-box">
        <div class="signature-line">Sahihi ya Mmiliki</div>
        <div class="signature-sub">${settings.businessName}</div>
      </div>
      <div class="signature-box">
        <div class="signature-line">Sahihi ya Mteja</div>
        <div class="signature-sub">${activeCustomer.full_name}</div>
      </div>
    </div>

    <div class="footer">
      <strong>${settings.businessName}</strong> • ${settings.businessAddress} • ${settings.businessPhone}<br>
      Taarifa hii ilitengenezwa ${now.toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })} saa ${now.toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' })}
    </div>

    <div class="no-print">
      <button onclick="window.print()">🖨️ Chapisha / Save as PDF</button>
      <button class="close" onclick="window.close()">Funga</button>
    </div>
  </div>
  <script>window.onload = function() { setTimeout(function() { window.print(); }, 400); };</script>
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=900,height=800');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    } else {
      alert('Tafadhali ruhusu pop-ups kwa ajili ya kuchapisha');
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2 text-rose-700 text-xs">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700"><X size={16} /></button>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center gap-2 text-xs text-slate-400 py-2">
          <Loader2 size={14} className="animate-spin" />
          <span>Inasasisha data...</span>
        </div>
      )}

      {activeCustomer ? (
        <div className="space-y-6 text-xs text-left animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-100 p-6 md:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <button onClick={() => setSelectedCustomerId('')} className="p-2.5 hover:bg-slate-50 text-slate-500 hover:text-slate-700 rounded-2xl border border-slate-100 transition-colors">
                  <ArrowLeft size={16} />
                </button>
                <div className="h-16 w-16 rounded-2xl bg-indigo-100 text-indigo-800 font-extrabold text-xl flex items-center justify-center shadow-sm">
                  {getInitials(activeCustomer.full_name)}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">{activeCustomer.full_name}</h3>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1"><Phone size={12} /> {activeCustomer.phone_number}</p>
                  {activeCustomer.address && <p className="text-xs text-slate-500 mt-1 flex items-center gap-1"><MapPin size={12} /> {activeCustomer.address}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={openEditCustomerModal} disabled={isLoading} className="py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors flex items-center gap-1.5 font-bold disabled:opacity-50">
                  <Edit2 size={14} /> Hariri
                </button>
                {/* ✅ Admin-only Delete Customer */}
                {userRole === 'admin' && (
                  <button onClick={() => handleDeleteCustomer(activeCustomer.id)} disabled={isLoading} className="py-2.5 px-4 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-600 transition-colors flex items-center gap-1.5 font-bold disabled:opacity-50">
                    <Trash2 size={14} /> Futa
                  </button>
                )}
                <button onClick={() => setSelectedCustomerId('')} className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors font-bold">Orodha</button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
              <div className="text-center"><p className="text-xs text-slate-400">Bidhaa Zote</p><p className="text-lg font-bold text-slate-800">{activeCustomerProducts.length}</p></div>
              <div className="text-center"><p className="text-xs text-slate-400">Zilizokamilika</p><p className="text-lg font-bold text-emerald-600">{activeCustomerProducts.filter(p => Number(p.paid_amount) >= Number(p.total_amount)).length}</p></div>
              <div className="text-center"><p className="text-xs text-slate-400">Jumla ya Thamani</p><p className="text-lg font-bold text-slate-800">TSh {activeCustomerProducts.reduce((sum, p) => sum + Number(p.total_amount), 0).toLocaleString()}</p></div>
              <div className="text-center"><p className="text-xs text-slate-400">Baki</p><p className="text-lg font-bold text-rose-600">TSh {activeCustomerProducts.reduce((sum, p) => sum + Math.max(0, Number(p.total_amount) - Number(p.paid_amount)), 0).toLocaleString()}</p></div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button onClick={() => { resetProductForm(); setIsAddProductModalOpen(true); }} disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-5 rounded-xl flex items-center gap-2 shadow-sm transition disabled:opacity-50">
              <Plus size={16} /> Ongeza Bidhaa
            </button>
            <button onClick={handlePrintStatement} className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold py-2.5 px-5 rounded-xl flex items-center gap-2 shadow-sm transition">
              <Printer size={16} /> Taarifa (PDF)
            </button>
          </div>

          <div className="space-y-4">
            {activeCustomerProducts.map(product => {
              const remaining = Math.max(0, Number(product.total_amount) - Number(product.paid_amount));
              const progressPercentage = Number(product.total_amount) > 0 ? (Number(product.paid_amount) / Number(product.total_amount)) * 100 : 0;
              const isCompleted = remaining <= 0;
              const isHalfway = !isCompleted && progressPercentage >= 45 && progressPercentage <= 55;
              
              return (
                <div key={product.id} className={`bg-white rounded-3xl border p-6 shadow-sm hover:shadow-md transition ${isCompleted ? 'border-emerald-200' : isHalfway ? 'border-blue-200' : 'border-slate-100'}`}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-xl ${isCompleted ? 'bg-emerald-50 text-emerald-600' : isHalfway ? 'bg-blue-50 text-blue-600' : 'bg-indigo-50 text-indigo-600'}`}>
                          {isCompleted ? <Award size={20} /> : <Package size={20} />}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-800">{product.product_name}</h4>
                          <p className="text-xs text-slate-400 mt-0.5">{product.description || 'Hakuna maelezo'}</p>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div><p className="text-[10px] text-slate-400 font-semibold uppercase">Bei Kamili</p><p className="text-sm font-bold text-slate-800 mt-1">TSh {Number(product.total_amount).toLocaleString()}</p></div>
                        <div><p className="text-[10px] text-slate-400 font-semibold uppercase">Imelipwa</p><p className="text-sm font-bold text-emerald-600 mt-1">TSh {Number(product.paid_amount).toLocaleString()}</p></div>
                        <div><p className="text-[10px] text-slate-400 font-semibold uppercase">Baki</p><p className="text-sm font-bold text-rose-600 mt-1">TSh {remaining.toLocaleString()}</p></div>
                        <div><p className="text-[10px] text-slate-400 font-semibold uppercase">Hali</p>
                          <span className={`inline-block mt-1 px-2 py-1 rounded-full text-[10px] font-bold ${isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {isCompleted ? '✓ Imekamilika' : 'Inaendelea'}
                          </span>
                        </div>
                      </div>
                      <div className="mt-4">
                        <div className="flex justify-between text-[10px] mb-1"><span className="text-slate-400">Maendeleo ya Malipo</span><span className="font-bold text-slate-700">{Math.round(progressPercentage)}%</span></div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${isCompleted ? 'bg-emerald-500' : isHalfway ? 'bg-blue-500' : 'bg-indigo-500'}`} style={{ width: `${progressPercentage}%` }}></div>
                        </div>
                      </div>
                    </div>
                    <div className="flex md:flex-col gap-2">
                      {remaining > 0 && (
                        <button onClick={() => openPayModal(product)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl flex items-center gap-1.5 text-xs transition">
                          <CreditCard size={14} /> Lipa
                        </button>
                      )}
                      <button onClick={() => setViewingHistoryProduct(product)} className="border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold py-2 px-4 rounded-xl flex items-center gap-1.5 text-xs transition">
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
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Thamani ya Bidhaa Zote</span>
              <h3 className="text-2xl font-black text-slate-800 mt-2">TSh {stats.totalExpected.toLocaleString()}</h3>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Kiasi Kilichokusanywa</span>
              <h3 className="text-2xl font-black text-emerald-600 mt-2">TSh {stats.totalCollected.toLocaleString()}</h3>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Baki ya Kukusanya</span>
              <h3 className="text-2xl font-black text-rose-600 mt-2">TSh {stats.totalRemaining.toLocaleString()}</h3>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Wateja wa Mkopo</span>
              <h3 className="text-2xl font-black text-slate-800 mt-2">{stats.totalCustomers}</h3>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-white p-5 rounded-3xl border border-slate-100 shadow-sm gap-4">
            <div>
              <h2 className="text-md font-bold text-slate-800">Installments (Mafungu)</h2>
              <p className="text-xs text-slate-400 mt-1">Dhibiti wateja wanaonunua bidhaa kwa malipo ya awamu.</p>
            </div>
            <button onClick={() => { resetCustomerForm(); setIsAddCustomerModalOpen(true); }} disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5 shadow-sm transition disabled:opacity-50">
              <Plus size={15} /> Sajili Mteja
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {customers.length > 0 ? customers.map(customer => {
              const customerProducts = products.filter(p => p.customer_id === customer.id);
              const totalValue = customerProducts.reduce((sum, p) => sum + Number(p.total_amount), 0);
              const paidValue = customerProducts.reduce((sum, p) => sum + Number(p.paid_amount), 0);
              const remainingValue = totalValue - paidValue;
              const hasProducts = customerProducts.length > 0;
              const completedCount = customerProducts.filter(p => Number(p.paid_amount) >= Number(p.total_amount)).length;
              
              return (
                <div key={customer.id} onClick={() => setSelectedCustomerId(customer.id)} className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm hover:shadow-md hover:border-slate-300 cursor-pointer transition flex flex-col justify-between space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-indigo-100 text-indigo-800 font-bold flex items-center justify-center">{getInitials(customer.full_name)}</div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">{customer.full_name}</h3>
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1"><Phone size={12} /> {customer.phone_number}</p>
                      </div>
                    </div>
                    {hasProducts ? (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                        {completedCount}/{customerProducts.length} Kamili
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500">Mpya</span>
                    )}
                  </div>
                  {hasProducts && (
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-2">
                      <div className="flex justify-between font-medium"><span className="text-slate-400">Thamani:</span><span className="font-bold text-slate-700">TSh {totalValue.toLocaleString()}</span></div>
                      <div className="flex justify-between font-medium"><span className="text-slate-400">Imelipwa:</span><span className="font-bold text-emerald-600">TSh {paidValue.toLocaleString()}</span></div>
                      <div className="flex justify-between font-medium border-t border-slate-200/50 pt-1.5"><span className="text-slate-400">Baki:</span><span className="font-bold text-rose-600">TSh {remainingValue.toLocaleString()}</span></div>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-slate-50 pt-3">
                    <p className="text-[10px] text-slate-400 font-mono"><Calendar size={10} /> {new Date(customer.created_at).toLocaleDateString()}</p>
                    <span className="text-[10px] font-semibold text-indigo-600 flex items-center gap-0.5">Fungua <ChevronRight size={12} /></span>
                  </div>
                </div>
              );
            }) : (
              <div className="col-span-full bg-white p-12 text-center rounded-3xl border border-slate-100 shadow-sm text-slate-400">
                <Users size={40} className="mx-auto text-slate-300 mb-3" />
                <p className="text-sm font-semibold">Hakuna wateja wa mafungu bado.</p>
                <p className="text-xs mt-1">Bonyeza "Sajili Mteja" kuanza.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Add Customer Modal */}
      {isAddCustomerModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-scale-in">
            <button onClick={() => setIsAddCustomerModalOpen(false)} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition"><X size={18} /></button>
            <h3 className="text-md font-bold text-slate-800">Sajili Mteja wa Mafungu</h3>
            <form onSubmit={handleAddCustomer} className="space-y-4 text-xs text-left">
              <div><label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Jina Kamili *</label><input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Mfano: Juma Kassim" className="w-full p-2.5 border border-slate-200 rounded-xl" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Namba ya Simu *</label><input type="tel" required value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="0712345678" className="w-full p-2.5 border border-slate-200 rounded-xl" /></div>
                <div><label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Anuani</label><input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Mtaa, Jiji" className="w-full p-2.5 border border-slate-200 rounded-xl" /></div>
              </div>
              <div><label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Maelezo</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Maelezo ya ziada..." className="w-full p-2.5 border border-slate-200 rounded-xl h-20" /></div>
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

      {/* Edit Customer Modal */}
      {isEditCustomerModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-scale-in">
            <button onClick={() => setIsEditCustomerModalOpen(false)} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition"><X size={18} /></button>
            <h3 className="text-md font-bold text-slate-800">Hariri Wasifu</h3>
            <form onSubmit={handleEditCustomer} className="space-y-4 text-xs text-left">
              <div><label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Jina Kamili *</label><input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Namba ya Simu *</label><input type="tel" required value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl" /></div>
                <div><label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Anuani</label><input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl" /></div>
              </div>
              <div><label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Maelezo</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl h-20" /></div>
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

      {/* Multi-Product Add Modal */}
      {isAddProductModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto animate-scale-in">
            <button onClick={() => { setIsAddProductModalOpen(false); resetProductForm(); }} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition"><X size={18} /></button>
            <h3 className="text-md font-bold text-slate-800 flex items-center gap-1.5">
              <Package size={18} className="text-indigo-600" />
              Ongeza Bidhaa ({productItems.length})
            </h3>
            <p className="text-xs text-slate-400">Mteja: {activeCustomer?.full_name}</p>

            <form onSubmit={handleAddProduct} className="space-y-4 text-xs text-left">
              <div className="space-y-3">
                {productItems.map((item, index) => (
                  <div key={item.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Bidhaa {index + 1}</span>
                      {productItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeProductItem(index)}
                          className="text-rose-500 hover:text-rose-700 p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    <input
                      type="text"
                      placeholder="Jina la bidhaa (mf. Speaker ya Sony)"
                      value={item.product_name}
                      onChange={(e) => updateProductItem(index, 'product_name', e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg bg-white"
                      required
                    />

                    <textarea
                      placeholder="Maelezo ya bidhaa (si lazima)..."
                      value={item.description}
                      onChange={(e) => updateProductItem(index, 'description', e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg bg-white h-14"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 mb-1">Bei Kamili (TSh)</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="50000"
                          value={item.total_amount}
                          onChange={(e) => updateProductItem(index, 'total_amount', e.target.value)}
                          className="w-full p-2 border border-slate-200 rounded-lg bg-white"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 mb-1">Tarehe ya Kukamilisha</label>
                        <input
                          type="date"
                          value={item.expected_completion_date}
                          onChange={(e) => updateProductItem(index, 'expected_completion_date', e.target.value)}
                          className="w-full p-2 border border-slate-200 rounded-lg bg-white"
                        />
                      </div>
                    </div>

                    <input
                      type="text"
                      placeholder="Notes za ziada (si lazima)..."
                      value={item.notes}
                      onChange={(e) => updateProductItem(index, 'notes', e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg bg-white"
                    />
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addProductItem}
                  className="w-full py-2 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition font-semibold flex items-center justify-center gap-1"
                >
                  <Plus size={14} /> Ongeza Bidhaa Nyingine
                </button>
              </div>

              <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-800">JUMLA KUU:</span>
                  <span className="text-lg font-black text-indigo-700">TSh {productsTotal.toLocaleString()}</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => { setIsAddProductModalOpen(false); resetProductForm(); }} disabled={isLoading} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600 transition disabled:opacity-50">Ghairi</button>
                <button
                  type="submit"
                  disabled={isLoading || productItems.filter(p => p.product_name && Number(p.total_amount) > 0).length === 0}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-sm transition disabled:opacity-50 flex items-center gap-2"
                >
                  {isLoading ? (
                    <><Loader2 size={14} className="animate-spin" /> Inahifadhi...</>
                  ) : (
                    <>Hifadhi Bidhaa ({productItems.filter(p => p.product_name && Number(p.total_amount) > 0).length})</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Product Modal */}
      {isPayModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-scale-in">
            <button onClick={() => { setIsPayModalOpen(false); resetPaymentForm(); }} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition"><X size={18} /></button>
            <h3 className="text-md font-bold text-slate-800">Rekodi Malipo ya Mkopo</h3>
            <p className="text-xs text-slate-400">{selectedProduct.product_name} - {activeCustomer?.full_name}</p>
            <form onSubmit={handlePayProduct} className="space-y-4 text-xs text-left">
              <div><label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Kiasi (TSh) *</label>
                <input type="number" required value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder={`Baki: ${Math.max(0, Number(selectedProduct.total_amount) - Number(selectedProduct.paid_amount)).toLocaleString()}`} min="1" max={Math.max(0, Number(selectedProduct.total_amount) - Number(selectedProduct.paid_amount))} className="w-full p-2.5 border border-slate-200 rounded-xl" />
              </div>
              <div className="flex gap-2">
                {(() => {
                  const remaining = Math.max(0, Number(selectedProduct.total_amount) - Number(selectedProduct.paid_amount));
                  const amounts = [Math.min(10000, remaining), Math.min(20000, remaining), Math.min(50000, remaining), remaining].filter((v, i, a) => v > 0 && a.indexOf(v) === i).slice(0, 4);
                  return amounts.map(amount => (
                    <button key={amount} type="button" onClick={() => setPayAmount(amount.toString())} className={`flex-1 py-2 px-2 rounded-xl text-[10px] font-bold border transition ${payAmount === amount.toString() ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
                      TSh {amount >= 1000 ? `${(amount / 1000).toFixed(0)}k` : amount.toLocaleString()}
                    </button>
                  ));
                })()}
              </div>
              <div><label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Njia ya Malipo</label>
                <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl bg-white">
                  <option value="Cash">Cash / Pesa Taslimu</option>
                  <option value="M-Pesa">M-Pesa</option>
                  <option value="Tigo Pesa">Tigo Pesa</option>
                  <option value="Airtel Money">Airtel Money</option>
                  <option value="HaloPesa">HaloPesa</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>
              <div><label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Notes</label><input type="text" value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Maelezo ya malipo..." className="w-full p-2.5 border border-slate-200 rounded-xl" /></div>
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-1.5">
                <div className="flex justify-between text-[11px]"><span className="text-slate-400">Bei Kamili:</span><span className="font-bold text-slate-700">TSh {Number(selectedProduct.total_amount).toLocaleString()}</span></div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-400">Imelipwa:</span><span className="font-bold text-emerald-600">TSh {Number(selectedProduct.paid_amount).toLocaleString()}</span></div>
                <div className="flex justify-between text-[11px] border-t border-slate-200 pt-1.5"><span className="text-slate-400">Baki Baada ya Malipo:</span><span className={`font-bold ${Number(selectedProduct.total_amount) - Number(selectedProduct.paid_amount) - Number(payAmount || 0) <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>TSh {Math.max(0, Number(selectedProduct.total_amount) - Number(selectedProduct.paid_amount) - Number(payAmount || 0)).toLocaleString()}</span></div>
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

      {/* View Payment History Modal */}
      {viewingHistoryProduct && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-scale-in">
            <button onClick={() => setViewingHistoryProduct(null)} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition"><X size={18} /></button>
            <h3 className="text-md font-bold text-slate-800">Historia ya Malipo</h3>
            <p className="text-xs text-slate-400">{viewingHistoryProduct.product_name}</p>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {payments.filter(p => p.product_id === viewingHistoryProduct.id).map(payment => (
                <div key={payment.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div>
                    <p className="text-xs font-bold text-slate-800">{payment.notes}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{payment.payment_date} • {payment.payment_method}</p>
                  </div>
                  <span className="text-sm font-extrabold text-emerald-600">TSh {Number(payment.amount).toLocaleString()}</span>
                </div>
              ))}
              {payments.filter(p => p.product_id === viewingHistoryProduct.id).length === 0 && (
                <p className="text-xs text-slate-400 text-center py-8">Hakuna malipo bado.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
