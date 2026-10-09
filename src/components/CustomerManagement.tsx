/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Customer, Debt, Payment, CustomerStatus, DebtExtension } from '../types';
import FormAIOCR from './FormAIOCR';
import { api } from '../services/api';
import { 
  Users, Search, Plus, Filter, Phone, MapPin, 
  Building, UserPlus, CreditCard, ChevronRight, ChevronDown, FileText, 
  History, Calendar, Check, AlertCircle, Printer, X, Trash2, Edit2, 
  ArrowLeft, Loader2, ListChecks, Package, CalendarClock
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

// ============================================
// LOGO URL (constant — easy to change)
// ============================================
const LOGO_URL = 'https://pics.sonkosound.store/file_0000000018a881f4bef28aaff0866bbd.png';

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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [isAddDebtOpen, setIsAddDebtOpen] = useState(false);
  const [isEditDebtOpen, setIsEditDebtOpen] = useState(false);
  const [isDeleteDebtConfirmOpen, setIsDeleteDebtConfirmOpen] = useState(false);
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);

  // Single-debt extension modal states
  const [isExtendDebtOpen, setIsExtendDebtOpen] = useState(false);
  const [extendingDebtId, setExtendingDebtId] = useState<string | null>(null);
  const [newDueDate, setNewDueDate] = useState('');
  const [extensionReason, setExtensionReason] = useState('');
  const [expandedExtensions, setExpandedExtensions] = useState<Record<string, boolean>>({});

  // Bulk extend-all modal states
  const [isExtendAllOpen, setIsExtendAllOpen] = useState(false);
  const [bulkNewDueDate, setBulkNewDueDate] = useState('');
  const [bulkExtensionReason, setBulkExtensionReason] = useState('');

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

  // Edit debt form states
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null);
  const [editDebtDescription, setEditDebtDescription] = useState('');
  const [editDebtAmount, setEditDebtAmount] = useState('');
  const [editDebtDateBorrowed, setEditDebtDateBorrowed] = useState('');
  const [editDebtDueDate, setEditDebtDueDate] = useState('');
  const [editDebtCategory, setEditDebtCategory] = useState('');
  const [editDebtNotes, setEditDebtNotes] = useState('');
  const [editDebtStatus, setEditDebtStatus] = useState('Active');

  // Form states - Payment recording
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<string>('Cash');
  const [payNotes, setPayNotes] = useState('');
  const [payAmountError, setPayAmountError] = useState(false);

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
        return d.amount - paid > 0 && new Date(d.dueDate) < new Date();
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
          return d.amount - paid > 0 && new Date(d.dueDate) < new Date();
        });
        status = hasOverdue ? 'Overdue' : 'Active';
      }

      const hasExtensions = customerDebts.some(d => (d.extensions?.length || 0) > 0);
      const totalExtensions = customerDebts.reduce((sum, d) => sum + (d.extensions?.length || 0), 0);

      return {
        ...c,
        stats: { 
          totalDebt, 
          totalPaid, 
          remainingBalance, 
          status, 
          percentagePaid: totalDebt > 0 ? (totalPaid / totalDebt) * 100 : 0,
          hasExtensions,
          totalExtensions,
        }
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

  const handleAddDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !debtDueDate) return;

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
          originalDueDate: debtDueDate,
          description: quantity > 1 
            ? `${product.product_name} (${quantity} x TSh ${unitPrice.toLocaleString()})`
            : product.product_name,
          category: debtCategory,
          notes: debtNotes,
          status: 'Active',
          extensions: []
        });
      }
      
      onUpdate();
      setIsAddDebtOpen(false);
      resetProductForm();
      setSuccessMessage('Madeni yameongezwa!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError('Imeshindwa kuongeza madeni: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================
  // EDIT DEBT HANDLERS
  // ============================================
  const openEditDebtModal = (debt: Debt) => {
    setEditingDebtId(debt.id);
    setEditDebtDescription(debt.description || '');
    setEditDebtAmount(String(debt.amount) || '');
    setEditDebtDateBorrowed(debt.dateBorrowed || '');
    setEditDebtDueDate(debt.dueDate || '');
    setEditDebtCategory(debt.category || 'Mizigo/Products');
    setEditDebtNotes(debt.notes || '');
    setEditDebtStatus(debt.status || 'Active');
    setIsEditDebtOpen(true);
  };

  const handleEditDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDebtId) return;

    if (!editDebtDescription.trim()) {
      setError('Maelezo ya deni yanahitajika');
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (!editDebtAmount || Number(editDebtAmount) <= 0) {
      setError('Kiasi cha deni kinahitajika');
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (!editDebtDueDate) {
      setError('Tarehe ya ukomo inahitajika');
      setTimeout(() => setError(null), 3000);
      return;
    }

    // Prevent reducing below amount already paid
    const currentDebt = activeCustomerHistory.debts.find(d => d.id === editingDebtId);
    if (currentDebt) {
      const alreadyPaid = activeCustomerHistory.payments
        .filter(p => p.debtId === editingDebtId)
        .reduce((s, p) => s + p.amount, 0);

      if (Number(editDebtAmount) < alreadyPaid) {
        setError(`Kiasi hakiwezi kuwa chini ya malipo yaliyofanywa (TSh ${alreadyPaid.toLocaleString()})`);
        setTimeout(() => setError(null), 5000);
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      await api.debts.update(editingDebtId, {
        amount: Number(editDebtAmount),
        dateBorrowed: editDebtDateBorrowed,
        dueDate: editDebtDueDate,
        description: editDebtDescription.trim(),
        category: editDebtCategory,
        notes: editDebtNotes,
        status: editDebtStatus
      });
      
      onUpdate();
      setIsEditDebtOpen(false);
      setEditingDebtId(null);
      setSuccessMessage('Deni limehaririwa kikamilifu!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('Edit debt error:', err);
      setError('Imeshindwa kuhariri deni: ' + (err?.message || 'Jaribu tena'));
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  // DELETE DEBT
  const openDeleteDebtConfirm = (debtId: string) => {
    setEditingDebtId(debtId);
    setIsDeleteDebtConfirmOpen(true);
  };

  const handleDeleteDebt = async () => {
    if (!editingDebtId) return;

    setIsLoading(true);
    try {
      await api.debts.delete(editingDebtId);
      
      const debtPayments = payments.filter(p => p.debtId === editingDebtId);
      for (const payment of debtPayments) {
        try {
          await api.payments.delete(payment.id);
        } catch (e) {
          console.error('Failed to delete payment:', e);
        }
      }
      
      onUpdate();
      setIsDeleteDebtConfirmOpen(false);
      setEditingDebtId(null);
      setSuccessMessage('Deni limefutwa!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('Delete debt error:', err);
      setError('Imeshindwa kufuta deni: ' + (err?.message || 'Jaribu tena'));
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================
  // SINGLE-DEBT EXTENSION HANDLERS
  // ============================================
  const openExtendDebtModal = (debt: Debt) => {
    setExtendingDebtId(debt.id);
    setNewDueDate('');
    setExtensionReason('');
    setIsExtendDebtOpen(true);
  };

  const handleExtendDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendingDebtId || !newDueDate) return;

    const debt = activeCustomerHistory.debts.find(d => d.id === extendingDebtId);
    if (!debt) return;

    if (new Date(newDueDate) <= new Date(debt.dueDate)) {
      setError('Tarehe mpya lazima iwe baada ya tarehe ya sasa ya ukomo');
      setTimeout(() => setError(null), 4000);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const extension: DebtExtension = {
        id: 'ext-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        oldDueDate: debt.dueDate,
        newDueDate,
        reason: extensionReason.trim(),
        extendedAt: new Date().toISOString(),
      };

      await api.debts.update(extendingDebtId, {
        dueDate: newDueDate,
        originalDueDate: debt.originalDueDate || debt.dueDate,
        extensions: [...(debt.extensions || []), extension],
        status: 'Active',
      });

      onUpdate();
      setIsExtendDebtOpen(false);
      setExtendingDebtId(null);
      setSuccessMessage(`Ukomo umeongezwa hadi ${new Date(newDueDate).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })}`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError('Imeshindwa kuongeza muda: ' + (err?.message || 'Jaribu tena'));
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================
  // BULK EXTEND-ALL HANDLERS
  // ============================================
  const openExtendAllModal = () => {
    if (unpaidDebts.length === 0) return;
    setBulkNewDueDate('');
    setBulkExtensionReason('');
    setIsExtendAllOpen(true);
  };

  const handleExtendAllDebts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkNewDueDate || unpaidDebts.length === 0) return;

    // New date must be after the LATEST current due date among unpaid debts
    const maxCurrentDue = unpaidDebts.reduce((latest, d) => {
      return new Date(d.dueDate) > new Date(latest) ? d.dueDate : latest;
    }, unpaidDebts[0].dueDate);

    if (new Date(bulkNewDueDate) <= new Date(maxCurrentDue)) {
      setError(`Tarehe mpya lazima iwe baada ya ${maxCurrentDue}`);
      setTimeout(() => setError(null), 4000);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const now = new Date().toISOString();
      let updatedCount = 0;

      for (const debt of unpaidDebts) {
        // Skip if the new date equals current due date
        if (debt.dueDate === bulkNewDueDate) continue;

        const extension: DebtExtension = {
          id: 'ext-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          oldDueDate: debt.dueDate,
          newDueDate: bulkNewDueDate,
          reason: bulkExtensionReason.trim() || `Umeongezwa kwa madeni yote (${unpaidDebts.length})`,
          extendedAt: now,
        };

        await api.debts.update(debt.id, {
          dueDate: bulkNewDueDate,
          originalDueDate: debt.originalDueDate || debt.dueDate,
          extensions: [...(debt.extensions || []), extension],
          status: 'Active',
        });

        updatedCount++;
      }

      onUpdate();
      setIsExtendAllOpen(false);
      setSuccessMessage(
        `Ukomo umeongezwa kwa madeni ${updatedCount} hadi ${new Date(bulkNewDueDate).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })}`
      );
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setError('Imeshindwa kuongeza muda: ' + (err?.message || 'Jaribu tena'));
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExtensions = (debtId: string) => {
    setExpandedExtensions(prev => ({ ...prev, [debtId]: !prev[debtId] }));
  };

  // ============================================
  // PAYMENT HANDLERS
  // ============================================
  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!payAmount || Number(payAmount) <= 0) {
      setPayAmountError(true);
      setError('Tafadhali jaza kiasi cha malipo');
      setTimeout(() => setError(null), 3000);
      return;
    }

    setPayAmountError(false);
    setIsLoading(true);
    setError(null);
    
    try {
      const totalPayAmount = Number(payAmount);
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
          notes: payNotes || `Malipo ya ${debt.description}`
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
      
      setSuccessMessage('Malipo yamerekodiwa!');
      setTimeout(() => setSuccessMessage(null), 3000);
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
    setPayAmount(''); setPayNotes(''); setPayAmountError(false);
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

  const openPaymentModal = () => {
    setPayAmount('');
    setPayMethod('Cash');
    setPayNotes('');
    setPayAmountError(false);
    setIsAddPaymentOpen(true);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const settings = {
    businessName: 'Sonko Sound',
    businessAddress: 'Morogoro, Tanzania',
    businessPhone: '0688423753'
  };

  // ============================================
  // PRINT STATEMENT (with logo + extensions)
  // ============================================
  const handlePrintStatement = () => {
    if (!activeCustomer || !activeCustomerStats) return;

    const now = new Date();
    const statementId = `STM-${Date.now().toString(36).toUpperCase()}`;

    const hasAnyExtension = activeCustomerHistory.debts.some(d => (d.extensions?.length || 0) > 0);

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <title>Taarifa - ${activeCustomer.fullName}</title>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: A4; margin: 12mm; }
    body { font-family: 'Segoe UI', Tahoma, sans-serif; background: white; color: #1e293b; padding: 20px; }
    .container { max-width: 190mm; margin: 0 auto; }
    .header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; background: linear-gradient(135deg, #1e3a5f 0%, #3b82f6 50%, #22c55e 100%); color: white; border-radius: 12px; margin-bottom: 24px; gap: 20px; }
    .header-left { display: flex; align-items: center; gap: 16px; }
    .logo-box { width: 70px; height: 70px; border-radius: 14px; background: white; display: flex; align-items: center; justify-content: center; padding: 6px; box-shadow: 0 4px 15px rgba(0,0,0,0.15); flex-shrink: 0; overflow: hidden; }
    .logo-box img { width: 100%; height: 100%; object-fit: contain; }
    .business-name { font-size: 22px; font-weight: 900; letter-spacing: 1px; line-height: 1.1; }
    .business-slogan { font-size: 11px; opacity: 0.9; margin-top: 4px; }
    .business-contact { font-size: 10px; opacity: 0.85; margin-top: 3px; }
    .statement-badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 6px 14px; border-radius: 20px; font-size: 10px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; }
    .statement-id { font-size: 10px; opacity: 0.8; margin-top: 8px; font-family: monospace; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 13px; font-weight: 800; color: #1e3a5f; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid #e2e8f0; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; }
    .info-card { display: flex; flex-direction: column; gap: 3px; }
    .info-label { font-size: 9px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; }
    .info-value { font-size: 13px; font-weight: bold; color: #1e293b; }
    .info-value.highlight { color: #dc2626; font-size: 16px; }
    table { width: 100%; border-collapse: collapse; background: white; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
    thead th { background: #1e3a5f; color: white; padding: 10px 12px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 800; }
    thead th:last-child { text-align: right; }
    tbody td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 11px; color: #334155; }
    tbody td:last-child { text-align: right; font-weight: bold; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    tbody tr:last-child td { border-bottom: none; }
    .empty-row { text-align: center !important; padding: 20px !important; color: #94a3b8; font-style: italic; }
    .payment-amount { color: #059669; font-weight: bold; }
    .ext-badge { display: inline-block; background: #d97706; color: white; padding: 2px 7px; border-radius: 10px; font-size: 8px; font-weight: 800; margin-left: 5px; letter-spacing: 0.3px; }
    .ext-old-cell { color: #94a3b8; text-decoration: line-through; font-style: italic; }
    .ext-new-cell { color: #d97706; font-weight: bold; }

    /* ✅ Extension block — prominent card design */
    .ext-header {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      font-weight: 800;
      color: #92400e;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 12px 16px;
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border-left: 4px solid #d97706;
      border-radius: 8px;
      margin-bottom: 14px;
    }
    .ext-header-icon { font-size: 18px; }

    .ext-debt-card {
      background: #fffbeb;
      border: 1px solid #fcd34d;
      border-radius: 10px;
      padding: 14px;
      margin-bottom: 12px;
    }

    .ext-debt-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 10px;
      margin-bottom: 10px;
      border-bottom: 1px dashed #fcd34d;
    }
    .ext-debt-name { font-size: 13px; font-weight: 800; color: #78350f; }
    .ext-count-badge {
      font-size: 9px;
      font-weight: 800;
      background: #d97706;
      color: white;
      padding: 3px 10px;
      border-radius: 12px;
      letter-spacing: 0.3px;
    }

    .ext-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px;
      background: white;
      border-radius: 8px;
      margin-bottom: 8px;
      border: 1px solid #fef3c7;
    }
    .ext-item:last-child { margin-bottom: 0; }

    .ext-item-num {
      font-size: 11px;
      font-weight: 900;
      color: #92400e;
      background: #fde68a;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .ext-item-dates {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
    }
    .ext-date-from, .ext-date-to {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .ext-date-label {
      font-size: 8px;
      font-weight: 800;
      color: #94a3b8;
      letter-spacing: 0.5px;
    }
    .ext-date-value {
      font-size: 12px;
      font-weight: 700;
      color: #334155;
    }
    .ext-strikethrough {
      text-decoration: line-through;
      color: #94a3b8;
    }
    .ext-highlight {
      color: #059669;
      font-weight: 900;
    }
    .ext-arrow {
      font-size: 18px;
      color: #d97706;
      font-weight: 900;
    }

    .ext-item-meta {
      flex: 1;
      min-width: 0;
      text-align: right;
    }
    .ext-reason {
      font-size: 10px;
      color: #64748b;
      font-style: italic;
      margin-bottom: 2px;
    }
    .ext-timestamp {
      font-size: 9px;
      color: #94a3b8;
      font-weight: 600;
    }

    .summary-box { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 20px; }
    .summary-item { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; text-align: center; }
    .summary-item.total { background: #fef2f2; border-color: #fecaca; }
    .summary-item.paid { background: #f0fdf4; border-color: #bbf7d0; }
    .summary-item.balance { background: #fff7ed; border-color: #fed7aa; }
    .summary-label { font-size: 9px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 4px; }
    .summary-value { font-size: 18px; font-weight: 900; color: #1e293b; }
    .summary-item.total .summary-value { color: #1e293b; }
    .summary-item.paid .summary-value { color: #059669; }
    .summary-item.balance .summary-value { color: #dc2626; }
    .signatures { display: flex; justify-content: space-between; gap: 40px; margin-top: 50px; padding: 0 20px; }
    .signature-box { flex: 1; text-align: center; }
    .signature-line { border-top: 1.5px solid #1e3a5f; padding-top: 8px; font-size: 11px; font-weight: bold; color: #1e3a5f; }
    .signature-sub { font-size: 9px; color: #94a3b8; margin-top: 3px; }
    .footer { margin-top: 30px; padding: 14px; background: #f8fafc; border-radius: 10px; text-align: center; font-size: 10px; color: #64748b; border: 1px solid #e2e8f0; }
    .footer strong { color: #1e3a5f; }
    .no-print { text-align: center; padding: 20px; margin-top: 10px; }
    .no-print button { background: #3b82f6; color: white; border: none; padding: 12px 28px; border-radius: 22px; font-size: 13px; font-weight: bold; cursor: pointer; margin: 0 5px; transition: all 0.2s; }
    .no-print button:hover { background: #2563eb; }
    .no-print button.close { background: #64748b; }
    .no-print button.close:hover { background: #475569; }
    @media print { .no-print { display: none !important; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-left">
        <div class="logo-box">
          <img src="${LOGO_URL}" alt="Sonko Sound Logo" />
        </div>
        <div>
          <div class="business-name">SONKO SOUND</div>
          <div class="business-slogan">Electronics & Appliances</div>
          <div class="business-contact">${settings.businessAddress} • ${settings.businessPhone}</div>
        </div>
      </div>
      <div style="text-align: right;">
        <div class="statement-badge">Taarifa ya Mteja</div>
        <div class="statement-id">${statementId}</div>
      </div>
    </div>
    <div class="section">
      <div class="section-title">Taarifa za Mteja</div>
      <div class="info-grid">
        <div class="info-card"><span class="info-label">Jina la Mteja</span><span class="info-value">${activeCustomer.fullName}</span></div>
        <div class="info-card"><span class="info-label">Namba ya Simu</span><span class="info-value">${activeCustomer.phoneNumber}</span></div>
        <div class="info-card"><span class="info-label">Tarehe ya Taarifa</span><span class="info-value">${now.toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
        <div class="info-card"><span class="info-label">Salio la Sasa</span><span class="info-value highlight">TSh ${activeCustomerStats.remainingBalance.toLocaleString()}</span></div>
      </div>
    </div>
    <div class="section">
      <div class="section-title">Historia ya Madeni (${activeCustomerHistory.debts.length})</div>
      <table>
        <thead><tr><th>Maelezo</th><th>Tarehe</th><th>Ukomo wa Awali</th><th>Ukomo wa Sasa</th><th>Kiasi (TSh)</th></tr></thead>
        <tbody>
          ${activeCustomerHistory.debts.length > 0 
            ? activeCustomerHistory.debts.map(debt => {
                const extCount = debt.extensions?.length || 0;
                const isExtended = extCount > 0;
                const originalDate = debt.originalDueDate || debt.dueDate;
                return `
                  <tr>
                    <td>${debt.description}${isExtended ? `<span class="ext-badge">+${extCount}</span>` : ''}</td>
                    <td>${debt.dateBorrowed}</td>
                    <td class="${isExtended ? 'ext-old-cell' : ''}">${originalDate}</td>
                    <td class="${isExtended ? 'ext-new-cell' : ''}">${debt.dueDate}</td>
                    <td>TSh ${debt.amount.toLocaleString()}</td>
                  </tr>
                `;
              }).join('')
            : '<tr><td colspan="5" class="empty-row">Hakuna madeni bado</td></tr>'
          }
        </tbody>
      </table>
    </div>
    ${hasAnyExtension ? `
    <div class="section">
      <div class="ext-header">
        <span class="ext-header-icon">⏰</span>
        <span>Ukomo Uliosogezwa (Deadline Extensions)</span>
      </div>
      ${activeCustomerHistory.debts
        .filter(debt => (debt.extensions?.length || 0) > 0)
        .map(debt => `
          <div class="ext-debt-card">
            <div class="ext-debt-title">
              <span class="ext-debt-name">${debt.description}</span>
              <span class="ext-count-badge">Imesogezwa mara ${debt.extensions!.length}</span>
            </div>
            ${debt.extensions!.map((ext, idx) => `
              <div class="ext-item">
                <div class="ext-item-num">#${idx + 1}</div>
                <div class="ext-item-dates">
                  <div class="ext-date-from">
                    <span class="ext-date-label">KUTOKA</span>
                    <span class="ext-date-value ext-strikethrough">${ext.oldDueDate}</span>
                  </div>
                  <div class="ext-arrow">→</div>
                  <div class="ext-date-to">
                    <span class="ext-date-label">HADI</span>
                    <span class="ext-date-value ext-highlight">${ext.newDueDate}</span>
                  </div>
                </div>
                <div class="ext-item-meta">
                  ${ext.reason ? `<div class="ext-reason">"${ext.reason}"</div>` : ''}
                  <div class="ext-timestamp">${new Date(ext.extendedAt).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                </div>
              </div>
            `).join('')}
          </div>
        `).join('')}
    </div>
    ` : ''}
    <div class="section">
      <div class="section-title">Historia ya Malipo (${activeCustomerHistory.payments.length})</div>
      <table>
        <thead><tr><th>Maelezo</th><th>Tarehe</th><th>Njia</th><th>Kiasi (TSh)</th></tr></thead>
        <tbody>
          ${activeCustomerHistory.payments.length > 0
            ? activeCustomerHistory.payments.map(pay => `
              <tr><td>${pay.notes || 'Malipo'}</td><td>${pay.date}</td><td>${pay.paymentMethod}</td><td class="payment-amount">TSh ${pay.amount.toLocaleString()}</td></tr>
            `).join('')
            : '<tr><td colspan="4" class="empty-row">Hakuna malipo bado</td></tr>'
          }
        </tbody>
      </table>
    </div>
    <div class="summary-box">
      <div class="summary-item total"><div class="summary-label">Jumla ya Madeni</div><div class="summary-value">TSh ${activeCustomerStats.totalDebt.toLocaleString()}</div></div>
      <div class="summary-item paid"><div class="summary-label">Jumla Iliyolipwa</div><div class="summary-value">TSh ${activeCustomerStats.totalPaid.toLocaleString()}</div></div>
      <div class="summary-item balance"><div class="summary-label">Salio la Sasa</div><div class="summary-value">TSh ${activeCustomerStats.remainingBalance.toLocaleString()}</div></div>
    </div>
    <div class="signatures">
      <div class="signature-box"><div class="signature-line">Sahihi ya Mmiliki</div><div class="signature-sub">${settings.businessName}</div></div>
      <div class="signature-box"><div class="signature-line">Sahihi ya Mteja</div><div class="signature-sub">${activeCustomer.fullName}</div></div>
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

      {/* Success Banner */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-2 text-emerald-700 text-xs animate-fade-in">
          <Check size={16} />
          <span>{successMessage}</span>
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
                  onClick={() => setSelectedCustomerId(null)}
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
                <button onClick={() => setSelectedCustomerId(null)} className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors font-bold">
                  Orodha (Back)
                </button>
              </div>
            </div>
          </div>

          {/* ✅ Extension summary banner */}
          {activeCustomerHistory.debts.some(d => (d.extensions?.length || 0) > 0) && (
            <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-200 rounded-3xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-md flex-shrink-0">
                <CalendarClock size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-extrabold text-amber-900">
                  Mteja huyu amesogezewa ukomo wa malipo
                </p>
                <p className="text-[10px] text-amber-700 font-medium mt-0.5">
                  {activeCustomerHistory.debts.filter(d => (d.extensions?.length || 0) > 0).length} ya madeni •{' '}
                  {activeCustomerHistory.debts.reduce((sum, d) => sum + (d.extensions?.length || 0), 0)} marekebisho jumla
                </p>
              </div>
              <button
                onClick={() => {
                  const first = activeCustomerHistory.debts.find(d => (d.extensions?.length || 0) > 0);
                  if (first && !expandedExtensions[first.id]) toggleExtensions(first.id);
                }}
                className="text-[10px] font-bold text-amber-800 bg-white border border-amber-300 px-3 py-1.5 rounded-lg hover:bg-amber-50 transition"
              >
                Angalia
              </button>
            </div>
          )}

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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-slate-100">
                <button
                  onClick={() => { resetProductForm(); setIsAddDebtOpen(true); }}
                  disabled={isLoading}
                  className="bg-slate-900 text-white font-bold py-2.5 px-3 rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <Plus size={14} /> Deni Jipya
                </button>
                <button
                  onClick={openPaymentModal}
                  disabled={isLoading || unpaidDebts.length === 0}
                  className="bg-emerald-600 text-white font-bold py-2.5 px-3 rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CreditCard size={14} /> Lipisha Deni
                </button>
                <button
                  onClick={openExtendAllModal}
                  disabled={isLoading || unpaidDebts.length === 0}
                  className="bg-amber-600 text-white font-bold py-2.5 px-3 rounded-xl hover:bg-amber-700 transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Ongeza muda kwa madeni yote yaliyobaki"
                >
                  <CalendarClock size={14} /> Ongeza Muda Zote
                </button>
                <button
                  onClick={handlePrintStatement}
                  className="border border-slate-200 text-slate-700 font-bold py-2.5 px-3 rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Printer size={14} /> Taarifa
                </button>
              </div>
            </div>
          </div>

          {/* History section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* DEBTS LIST WITH EDIT / EXTEND / DELETE */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <FileText size={14} className="text-amber-500" /> Madeni ({activeCustomerHistory.debts.length})
              </h4>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {activeCustomerHistory.debts.map(debt => {
                  const dPayments = activeCustomerHistory.payments.filter(p => p.debtId === debt.id);
                  const paidSum = dPayments.reduce((acc, p) => acc + p.amount, 0);
                  const bal = debt.amount - paidSum;
                  const extCount = debt.extensions?.length || 0;
                  const isExtended = extCount > 0;
                  
                  return (
                    <div key={debt.id} className="p-4 bg-slate-50/60 rounded-2xl border border-slate-100 text-xs">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between font-bold">
                            <span className="truncate">{debt.description}</span>
                            <span>TSh {debt.amount.toLocaleString()}</span>
                          </div>
                        </div>
                        
                        {/* EDIT / EXTEND / DELETE BUTTONS */}
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => openExtendDebtModal(debt)}
                            className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-600 transition"
                            title="Ongeza muda wa ukomo"
                          >
                            <CalendarClock size={12} />
                          </button>
                          <button
                            onClick={() => openEditDebtModal(debt)}
                            className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition"
                            title="Hariri deni"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => openDeleteDebtConfirm(debt.id)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition"
                            title="Futa deni"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                      
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400 flex-wrap">
                        <span><Calendar size={10} /> {debt.dateBorrowed}</span>
                        <span className="flex items-center gap-1.5">
                          <Calendar size={10} className="text-rose-500" />
                          {isExtended && debt.originalDueDate && debt.originalDueDate !== debt.dueDate ? (
                            <>
                              <span className="line-through text-slate-400 text-[10px]">{debt.originalDueDate}</span>
                              <ChevronRight size={10} className="text-amber-500" />
                              <span className="text-amber-700 font-bold">{debt.dueDate}</span>
                              <span className="text-[9px] font-extrabold text-amber-800 bg-gradient-to-r from-amber-100 to-amber-200 border border-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <CalendarClock size={9} />
                                IMESOGEZWA
                              </span>
                            </>
                          ) : (
                            <span>{debt.dueDate}</span>
                          )}
                        </span>
                        <span className={bal > 0 ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}>
                          {bal > 0 ? `Salio: TSh ${bal.toLocaleString()}` : '✓ Imelipwa'}
                        </span>
                      </div>

                      {/* ✅ Extension history — professional design */}
                      {isExtended && (
                        <div className="mt-3">
                          <button
                            onClick={() => toggleExtensions(debt.id)}
                            className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl transition-all border ${
                              expandedExtensions[debt.id]
                                ? 'bg-amber-100 border-amber-300 shadow-sm'
                                : 'bg-amber-50 border-amber-200 hover:bg-amber-100'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-lg bg-amber-500 flex items-center justify-center shadow-sm">
                                <CalendarClock size={12} className="text-white" />
                              </div>
                              <div className="text-left">
                                <p className="text-[10px] font-extrabold text-amber-900 uppercase tracking-wide">
                                  Ukomo Ulisogezwa
                                </p>
                                <p className="text-[9px] text-amber-700 font-semibold">
                                  Mara {extCount} • Bonyeza kuona historia
                                </p>
                              </div>
                            </div>
                            <div className={`transition-transform ${expandedExtensions[debt.id] ? 'rotate-180' : ''}`}>
                              <ChevronDown size={14} className="text-amber-700" />
                            </div>
                          </button>

                          {expandedExtensions[debt.id] && (
                            <div className="mt-2 space-y-2">
                              {debt.extensions!.map((ext, i) => (
                                <div
                                  key={ext.id}
                                  className="relative bg-white rounded-xl border border-amber-100 shadow-sm overflow-hidden"
                                >
                                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-400 to-amber-600" />

                                  <div className="pl-4 pr-3 py-3">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-1.5">
                                        <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[9px] font-black flex items-center justify-center shadow-sm">
                                          {i + 1}
                                        </span>
                                        <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wide">
                                          Marekebisho #{i + 1}
                                        </span>
                                      </div>
                                      <span className="text-[9px] text-slate-400 font-medium">
                                        {new Date(ext.extendedAt).toLocaleDateString('sw-TZ', {
                                          day: 'numeric',
                                          month: 'short',
                                          year: 'numeric',
                                        })}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-2 mb-2 bg-slate-50 rounded-lg p-2">
                                      <div className="flex-1">
                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">
                                          Kutoka
                                        </p>
                                        <p className="text-[11px] font-bold text-slate-400 line-through">
                                          {ext.oldDueDate}
                                        </p>
                                      </div>
                                      <div className="flex items-center justify-center">
                                        <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center">
                                          <ChevronRight size={12} className="text-amber-600" />
                                        </div>
                                      </div>
                                      <div className="flex-1 text-right">
                                        <p className="text-[8px] font-bold text-emerald-600 uppercase tracking-wide mb-0.5">
                                          Hadi
                                        </p>
                                        <p className="text-[11px] font-extrabold text-emerald-700">
                                          {ext.newDueDate}
                                        </p>
                                      </div>
                                    </div>

                                    {ext.reason && (
                                      <div className="flex items-start gap-1.5 mt-2">
                                        <div className="mt-0.5 w-1 h-1 rounded-full bg-amber-500 flex-shrink-0" />
                                        <p className="text-[10px] text-slate-600 italic leading-relaxed">
                                          "{ext.reason}"
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}

                              {debt.originalDueDate && debt.originalDueDate !== debt.dueDate && (
                                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-2.5 flex items-center justify-between">
                                  <div>
                                    <p className="text-[8px] font-bold text-amber-700 uppercase tracking-wide">
                                      Ukomo wa Awali
                                    </p>
                                    <p className="text-[10px] font-bold text-slate-500 line-through">
                                      {debt.originalDueDate}
                                    </p>
                                  </div>
                                  <ChevronRight size={14} className="text-amber-500" />
                                  <div className="text-right">
                                    <p className="text-[8px] font-bold text-emerald-700 uppercase tracking-wide">
                                      Ukomo wa Sasa
                                    </p>
                                    <p className="text-[11px] font-extrabold text-emerald-700">
                                      {debt.dueDate}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {debt.notes && <p className="text-[10px] text-slate-500 mt-1 italic">{debt.notes}</p>}
                      
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
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${customer.stats.status === 'Overdue' ? 'bg-rose-100 text-rose-700' : customer.stats.status === 'Active' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{customer.stats.status}</span>
                        {customer.stats.hasExtensions && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 flex items-center gap-0.5">
                            <CalendarClock size={9} /> Muda+{customer.stats.totalExtensions > 1 ? ` (${customer.stats.totalExtensions})` : ''}
                          </span>
                        )}
                      </div>
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

      {/* MODAL: EDIT DEBT */}
      {isEditDebtOpen && editingDebtId && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto animate-scale-in">
            <button onClick={() => { setIsEditDebtOpen(false); setEditingDebtId(null); }} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition">
              <X size={18} />
            </button>
            
            <h3 className="text-md font-bold text-slate-850 flex items-center gap-1.5">
              <Edit2 className="text-blue-600" size={18} />
              Hariri Deni
            </h3>
            
            <p className="text-xs text-slate-500">
              Badilisha taarifa za deni kwa <strong>{activeCustomer?.fullName}</strong>
            </p>

            <form onSubmit={handleEditDebt} className="space-y-4 text-xs text-left">
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Maelezo ya Deni *</label>
                <input type="text" required value={editDebtDescription} onChange={(e) => setEditDebtDescription(e.target.value)} placeholder="Mfano: Speaker ya Sony" className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-blue-500 focus:border-blue-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Kiasi (TSh) *</label>
                  <input type="number" required min="1" value={editDebtAmount} onChange={(e) => setEditDebtAmount(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Kundi</label>
                  <input type="text" value={editDebtCategory} onChange={(e) => setEditDebtCategory(e.target.value)} placeholder="Mizigo/Products" className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-blue-500 focus:border-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Tarehe ya Kukopa</label>
                  <input type="date" value={editDebtDateBorrowed} onChange={(e) => setEditDebtDateBorrowed(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Ukomo (Due Date) *
                  </label>
                  <input type="date" required value={editDebtDueDate} onChange={(e) => setEditDebtDueDate(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-blue-500 focus:border-blue-500" />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Hali ya Deni</label>
                <select value={editDebtStatus} onChange={(e) => setEditDebtStatus(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl bg-white focus:ring-blue-500 focus:border-blue-500">
                  <option value="Active">Active - Inaendelea</option>
                  <option value="Paid">Paid - Imelipwa</option>
                  <option value="Overdue">Overdue - Imechelewa</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Maelezo ya Ziada</label>
                <textarea value={editDebtNotes} onChange={(e) => setEditDebtNotes(e.target.value)} placeholder="Maelezo yoyote ya ziada..." className="w-full p-2.5 border border-slate-200 rounded-xl h-20 focus:ring-blue-500 focus:border-blue-500" />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <p className="text-[11px] text-blue-700 leading-relaxed">
                  <strong>Kumbuka:</strong> Kubadilisha kiasi kutaathiri salio la mteja. Malipo yaliyofanywa bado yanabaki kama yalivyo.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => { setIsEditDebtOpen(false); setEditingDebtId(null); }} disabled={isLoading} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600 transition disabled:opacity-50">
                  Ghairi
                </button>
                <button type="submit" disabled={isLoading} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-sm transition disabled:opacity-50 flex items-center gap-2">
                  {isLoading ? <><Loader2 size={14} className="animate-spin" /> Inahifadhi...</> : <>Hifadhi Mabadiliko</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EXTEND SINGLE DEBT DUE DATE */}
      {isExtendDebtOpen && extendingDebtId && (() => {
        const debt = activeCustomerHistory.debts.find(d => d.id === extendingDebtId);
        if (!debt) return null;
        const isOverdue = new Date(debt.dueDate) < new Date();

        return (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-scale-in">
              <button
                onClick={() => { setIsExtendDebtOpen(false); setExtendingDebtId(null); }}
                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition"
              >
                <X size={18} />
              </button>

              <h3 className="text-md font-bold text-slate-850 flex items-center gap-1.5">
                <CalendarClock className="text-amber-600" size={18} />
                Ongeza Muda wa Ukomo
              </h3>

              <div className="bg-slate-50 rounded-2xl p-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Deni:</span>
                  <span className="font-bold text-slate-700 truncate max-w-[180px]">{debt.description}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Kiasi:</span>
                  <span className="font-bold text-slate-700">TSh {debt.amount.toLocaleString()}</span>
                </div>
                {debt.originalDueDate && debt.originalDueDate !== debt.dueDate && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Ukomo wa awali:</span>
                    <span className="line-through text-slate-400">{debt.originalDueDate}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">Ukomo wa sasa:</span>
                  <span className={`font-bold ${isOverdue ? 'text-rose-600' : 'text-slate-700'}`}>
                    {debt.dueDate} {isOverdue && '(Umechelewa)'}
                  </span>
                </div>
                {(debt.extensions?.length || 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Mara zilizoongezwa:</span>
                    <span className="font-bold text-amber-700">{debt.extensions!.length}</span>
                  </div>
                )}
              </div>

              <form onSubmit={handleExtendDebt} className="space-y-4 text-xs text-left">
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Ukomo Mpya *
                  </label>
                  <input
                    type="date"
                    required
                    min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-amber-500 focus:border-amber-500"
                  />
                  <p className="mt-1 text-[10px] text-slate-400">
                    Lazima iwe baada ya {debt.dueDate}
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Sababu ya Kuongeza Muda
                  </label>
                  <textarea
                    value={extensionReason}
                    onChange={(e) => setExtensionReason(e.target.value)}
                    placeholder="Mf. Mteja ameomba muda zaidi, ameathirika kifedha..."
                    className="w-full p-2.5 border border-slate-200 rounded-xl h-20 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>

                {(debt.extensions?.length || 0) > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      <strong>Kumbuka:</strong> Deni hili limekwisha ongezwa muda
                      <strong> mara {debt.extensions!.length}</strong>. Ukiendelea, historia yote itahifadhiwa.
                    </p>
                  </div>
                )}

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => { setIsExtendDebtOpen(false); setExtendingDebtId(null); }}
                    disabled={isLoading}
                    className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600 transition disabled:opacity-50"
                  >
                    Ghairi
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || !newDueDate}
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold shadow-sm transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {isLoading ? (
                      <><Loader2 size={14} className="animate-spin" /> Inahifadhi...</>
                    ) : (
                      <><CalendarClock size={14} /> Ongeza Muda</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* MODAL: EXTEND ALL DEBTS AT ONCE */}
      {isExtendAllOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto animate-scale-in">
            <button
              onClick={() => setIsExtendAllOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition"
            >
              <X size={18} />
            </button>

            <h3 className="text-md font-bold text-slate-850 flex items-center gap-1.5">
              <CalendarClock className="text-amber-600" size={18} />
              Ongeza Muda kwa Madeni Yote
            </h3>

            <p className="text-xs text-slate-500">
              Utabadilisha ukomo wa madeni yote <strong>{unpaidDebts.length}</strong> kwa mteja{' '}
              <strong>{activeCustomer?.fullName}</strong> kwa wakati mmoja.
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 space-y-2 max-h-56 overflow-y-auto">
              <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wide mb-1">
                Madeni Yatakayoongezwa ({unpaidDebts.length})
              </div>
              {unpaidDebts.map(d => (
                <div key={d.id} className="flex justify-between items-center text-[11px] bg-white rounded-lg p-2 gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-700 truncate">{d.description}</div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-2 flex-wrap">
                      <span>Ukomo wa sasa: <strong className={
                        new Date(d.dueDate) < new Date() ? 'text-rose-600' : 'text-slate-600'
                      }>{d.dueDate}</strong></span>
                      {(d.extensions?.length || 0) > 0 && (
                        <span className="text-amber-600 font-bold">(+{d.extensions!.length} mara)</span>
                      )}
                    </div>
                  </div>
                  <span className="font-bold text-rose-600 shrink-0">TSh {d.remaining.toLocaleString()}</span>
                </div>
              ))}
            </div>

            <form onSubmit={handleExtendAllDebts} className="space-y-4 text-xs text-left">
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Ukomo Mpya kwa Zote *
                </label>
                <input
                  type="date"
                  required
                  min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                  value={bulkNewDueDate}
                  onChange={(e) => setBulkNewDueDate(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl focus:ring-amber-500 focus:border-amber-500"
                />
                <p className="mt-1 text-[10px] text-slate-400">
                  Lazima iwe baada ya ukomo wa sasa wa kila deni
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Sababu ya Kuongeza Muda
                </label>
                <textarea
                  value={bulkExtensionReason}
                  onChange={(e) => setBulkExtensionReason(e.target.value)}
                  placeholder="Mf. Mteja ameomba muda wa ziada kwa madeni yote..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl h-20 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  <strong>Kumbuka:</strong> Kila deni litapata rekodi yake ya kuongeza muda.
                  Historia ya awali ya kila deni haitafutwa.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsExtendAllOpen(false)}
                  disabled={isLoading}
                  className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600 transition disabled:opacity-50"
                >
                  Ghairi
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !bulkNewDueDate}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold shadow-sm transition disabled:opacity-50 flex items-center gap-2"
                >
                  {isLoading ? (
                    <><Loader2 size={14} className="animate-spin" /> Inahifadhi...</>
                  ) : (
                    <><CalendarClock size={14} /> Ongeza Muda Zote</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE DEBT CONFIRM */}
      {isDeleteDebtConfirmOpen && editingDebtId && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-scale-in">
            <div className="text-center">
              <div className="h-16 w-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
                <Trash2 size={28} />
              </div>
              <h3 className="text-md font-bold text-slate-800">Futa Deni?</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Je, una uhakika unataka kufuta deni hili? 
                <br />
                <span className="font-bold text-rose-600">Malipo yote yanayohusiana nalo yatafutwa pia.</span>
                <br />
                <span className="text-slate-400 mt-1 block">Kitendo hiki hakiwezi kutenduliwa.</span>
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button 
                onClick={() => { setIsDeleteDebtConfirmOpen(false); setEditingDebtId(null); }}
                disabled={isLoading}
                className="flex-1 py-2.5 px-4 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600 transition disabled:opacity-50"
              >
                Ghairi
              </button>
              <button 
                onClick={handleDeleteDebt}
                disabled={isLoading}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <><Loader2 size={14} className="animate-spin" /> Inafuta...</>
                ) : (
                  <><Trash2 size={14} /> Futa</>
                )}
              </button>
            </div>
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

              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-800">JUMLA KUU:</span>
                  <span className="text-lg font-black text-amber-700">TSh {productsTotal.toLocaleString()}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Kundi *</label>
                  <input type="text" required value={debtCategory} onChange={(e) => setDebtCategory(e.target.value)} placeholder="Mizigo/Products" className="w-full p-2.5 border border-slate-200 rounded-xl bg-white" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Ukomo *</label>
                  <input type="date" required value={debtDueDate} onChange={(e) => setDebtDueDate(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-xl" />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Maelezo ya Ziada</label>
                <textarea value={debtNotes} onChange={(e) => setDebtNotes(e.target.value)} placeholder="Maelezo yoyote ya ziada..." className="w-full p-2.5 border border-slate-200 rounded-xl h-16" />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => { setIsAddDebtOpen(false); resetProductForm(); }} disabled={isLoading} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600 transition disabled:opacity-50">
                  Ghairi
                </button>
                <button type="submit" disabled={isLoading || productItems.filter(p => p.product_name && Number(p.unit_price) > 0).length === 0} className="px-5 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-xl font-semibold shadow-sm transition disabled:opacity-50 flex items-center gap-2">
                  {isLoading ? <><Loader2 size={14} className="animate-spin" /> Inasajili...</> : <>Sajili Bidhaa ({productItems.filter(p => p.product_name && Number(p.unit_price) > 0).length})</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Payment */}
      {isAddPaymentOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-scale-in">
            <button onClick={() => { setIsAddPaymentOpen(false); resetPaymentForm(); }} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition">
              <X size={18} />
            </button>
            
            <h3 className="text-md font-bold text-slate-850 flex items-center gap-1.5">
              <ListChecks className="text-emerald-600" size={18} />
              Lipa Madeni - {activeCustomer?.fullName}
            </h3>
            
            <form onSubmit={handleAddPayment} className="space-y-4 text-xs text-left">
              
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs mb-2">
                  <ListChecks size={14} /> Madeni Yote ({unpaidDebts.length})
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {unpaidDebts.map(d => (
                    <div key={d.id} className="flex justify-between text-[11px] bg-white rounded-lg p-2">
                      <span className="text-slate-600 truncate">{d.description}</span>
                      <span className="font-bold text-emerald-700">TSh {d.remaining.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between border-t border-emerald-200 pt-2 mt-2">
                  <span className="font-bold text-emerald-800">JUMLA KUU:</span>
                  <span className="font-black text-emerald-800 text-base">TSh {totalRemaining.toLocaleString()}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block font-semibold uppercase tracking-wide mb-1 ${payAmountError ? 'text-rose-600' : 'text-slate-500'}`}>
                    Kiasi (TSh) *
                  </label>
                  <input 
                    type="number" 
                    required 
                    value={payAmount} 
                    onChange={(e) => {
                      setPayAmount(e.target.value);
                      if (payAmountError && e.target.value && Number(e.target.value) > 0) {
                        setPayAmountError(false);
                      }
                    }}
                    placeholder="Andika kiasi..."
                    min="1"
                    className={`w-full p-2.5 border rounded-xl focus:ring-accent transition ${
                      payAmountError 
                        ? 'border-rose-400 bg-rose-50 animate-pulse' 
                        : 'border-slate-200'
                    }`} 
                  />
                  {payAmountError && (
                    <p className="mt-1 text-[10px] text-rose-600 font-bold flex items-center gap-1">
                      <AlertCircle size={10} /> Lazima ujaze kiasi
                    </p>
                  )}
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

              {payAmount && Number(payAmount) > 0 && (
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Jumla ya Madeni Yote:</span>
                    <span className="font-bold text-slate-700">TSh {totalRemaining.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Unalipa:</span>
                    <span className="font-bold text-emerald-600">TSh {Number(payAmount).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[11px] border-t border-slate-200 pt-1.5">
                    <span className="text-slate-400">Baki Baada ya Malipo:</span>
                    <span className={`font-bold ${totalRemaining - Number(payAmount) <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      TSh {Math.max(0, totalRemaining - Number(payAmount)).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => { setIsAddPaymentOpen(false); resetPaymentForm(); }} disabled={isLoading} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600 transition disabled:opacity-50">
                  Ghairi
                </button>
                <button 
                  type="submit" 
                  disabled={isLoading} 
                  onClick={(e) => {
                    if (!payAmount || Number(payAmount) <= 0) {
                      e.preventDefault();
                      setPayAmountError(true);
                      setError('Tafadhali jaza kiasi cha malipo');
                      setTimeout(() => setError(null), 3000);
                    }
                  }}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-sm transition disabled:opacity-50 flex items-center gap-2"
                >
                  {isLoading ? <><Loader2 size={14} className="animate-spin" /> Inarekodi...</> : 'Lipa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
