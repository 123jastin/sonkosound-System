/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Plus, Trash2, Printer, Phone, ShoppingCart, 
  Package, X, Loader2, AlertCircle, FileText, 
  Search, User, MapPin, Users, CheckCircle,
  Bike, Bus, Edit2, MessageSquare
} from 'lucide-react';

// Interfaces
interface OrderCustomer {
  id: string;
  full_name: string;
  phone_number: string;
  address: string;
  created_at: string;
}

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface ShippingInfo {
  method: 'BodaBoda' | 'Bus';
  bodaName?: string;
  bodaPhone?: string;
  bodaPlateNumber?: string;
  busName?: string;
  busNumber?: string;
  cargoNumber?: string; // Namba ya Mzigo
  driverName?: string;
  driverPhone?: string;
}

interface Order {
  id: string;
  customer_id: string;
  customer_name?: string;
  customer_phone?: string;
  items: OrderItem[];
  total_amount: number;
  status: 'Pending' | 'Completed' | 'Cancelled';
  notes: string;
  created_at: string;
  shipping_info?: ShippingInfo;
  shipping_method?: string;
  shipping_details?: string;
}

interface OrdersPageProps {
  onUpdate: () => void;
}

const API_BASE_URL = '/api/orders';

export default function OrdersPage({ onUpdate }: OrdersPageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const [customers, setCustomers] = useState<OrderCustomer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  
  const [activeTab, setActiveTab] = useState<'orders' | 'customers'>('orders');
  
  // Modal states
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [isEditCustomerModalOpen, setIsEditCustomerModalOpen] = useState(false);
  const [isAddOrderModalOpen, setIsAddOrderModalOpen] = useState(false);
  const [isEditOrderModalOpen, setIsEditOrderModalOpen] = useState(false);
  const [isViewOrderModalOpen, setIsViewOrderModalOpen] = useState(false);
  const [isCompleteOrderModalOpen, setIsCompleteOrderModalOpen] = useState(false);
  
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<OrderCustomer | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  
  // Customer form states
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  
  // Order form states
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([
    { id: 'item-' + Date.now(), product_name: '', quantity: 1, unit_price: '', total_price: 0 }
  ]);
  const [orderNotes, setOrderNotes] = useState('');
  
  // Shipping form states
  const [shippingMethod, setShippingMethod] = useState<'BodaBoda' | 'Bus'>('BodaBoda');
  const [bodaName, setBodaName] = useState('');
  const [bodaPhone, setBodaPhone] = useState('');
  const [bodaPlateNumber, setBodaPlateNumber] = useState('');
  const [busType, setBusType] = useState<'company' | 'driver'>('company');
  const [busName, setBusName] = useState('');
  const [busNumber, setBusNumber] = useState('');
  const [cargoNumber, setCargoNumber] = useState(''); // Namba ya Mzigo
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  
  // Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');

  // SMS Notification function
  const sendOrderSMS = async (order: Order, customerPhone: string) => {
    try {
      const itemsList = order.items.map((item, index) => 
        `${index + 1}. ${item.product_name} ~ TSh ${Number(item.total_price).toLocaleString()}`
      ).join('\n');
      
      const message = `Habari ${order.customer_name}, tumepokea oda yako ya:\n${itemsList}\n\nJumla Kuu = TSh ${Number(order.total_amount).toLocaleString()}`;
      
      console.log('📱 Sending order SMS:', message);
      
      const response = await fetch('/api/orders-send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: order.customer_name,
          customerPhone: customerPhone,
          orderId: order.id,
          items: order.items,
          totalAmount: order.total_amount,
          message: message
        })
      });
      
      const result = await response.json();
      console.log('📱 SMS Result:', result);
      
      if (result.success) {
        setSuccessMessage('SMS imetumwa kwa mteja');
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      console.error('Failed to send SMS:', err);
    }
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}`);
      const data = await response.json();
      
      if (data.success) {
        const loadedCustomers = Array.isArray(data.customers) ? data.customers : [];
        const loadedOrders = Array.isArray(data.orders) ? data.orders : [];
        
        const parsedOrders = loadedOrders.map((order: any) => {
          let shippingInfo = order.shipping_info || null;
          if (!shippingInfo && order.shipping_details) {
            try {
              shippingInfo = JSON.parse(order.shipping_details);
            } catch (e) {
              console.error('Failed to parse shipping details:', e);
            }
          }
          return {
            ...order,
            shipping_info: shippingInfo,
            items: Array.isArray(order.items) ? order.items : []
          };
        });
        
        setCustomers(loadedCustomers);
        setOrders(parsedOrders);
      } else {
        setError(data.error || 'Failed to load data');
      }
    } catch (err) {
      console.error('Failed to load orders:', err);
      const savedData = localStorage.getItem('orders_data');
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          setCustomers(parsed.customers || []);
          setOrders(parsed.orders || []);
        } catch (e) {
          console.error('Failed to parse saved data:', e);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateOrderItem = (index: number, field: string, value: any) => {
    const updatedItems = [...orderItems];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value
    };
    
    if (field === 'quantity' || field === 'unit_price') {
      const qty = Number(updatedItems[index].quantity) || 0;
      const price = Number(updatedItems[index].unit_price) || 0;
      updatedItems[index].total_price = qty * price;
    }
    
    setOrderItems(updatedItems);
  };

  const addOrderItem = () => {
    setOrderItems([
      ...orderItems,
      { 
        id: 'item-' + Date.now() + '-' + Math.random(), 
        product_name: '', 
        quantity: 1, 
        unit_price: '', // Empty string instead of 0
        total_price: 0 
      }
    ]);
  };

  const removeOrderItem = (index: number) => {
    if (orderItems.length === 1) return;
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const orderTotal = useMemo(() => {
    return orderItems.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unit_price) || 0;
      return sum + (qty * price);
    }, 0);
  }, [orderItems]);

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerPhone) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fullName: customerName, 
          phoneNumber: customerPhone, 
          address: customerAddress 
        })
      });
      
      const result = await response.json();
      
      if (result.success && result.customer) {
        setCustomers(prev => [result.customer, ...prev]);
        setIsAddCustomerModalOpen(false);
        setCustomerName('');
        setCustomerPhone('');
        setCustomerAddress('');
        onUpdate();
        setActiveTab('customers');
        await loadData();
      } else {
        setError(result.error || 'Imeshindwa kumsajili mteja');
      }
    } catch (err: any) {
      console.error('Failed to add customer:', err);
      setError('Imeshindwa kumsajili mteja');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer || !customerName || !customerPhone) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/customers/${editingCustomer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fullName: customerName, 
          phoneNumber: customerPhone, 
          address: customerAddress 
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setCustomers(prev => prev.map(c => 
          c.id === editingCustomer.id ? result.customer : c
        ));
        setIsEditCustomerModalOpen(false);
        setEditingCustomer(null);
        onUpdate();
        await loadData();
      } else {
        setError(result.error || 'Imeshindwa kuhariri mteja');
      }
    } catch (err: any) {
      console.error('Failed to edit customer:', err);
      setError('Imeshindwa kuhariri mteja');
    } finally {
      setIsLoading(false);
    }
  };

  const openEditCustomerModal = (customer: OrderCustomer) => {
    setEditingCustomer(customer);
    setCustomerName(customer.full_name);
    setCustomerPhone(customer.phone_number);
    setCustomerAddress(customer.address);
    setIsEditCustomerModalOpen(true);
  };

  const handleDeleteCustomer = async (customerId: string) => {
    if (!confirm('Je, una uhakika unataka kumfuta mteja huyu?')) return;
    
    setIsLoading(true);
    try {
      await fetch(`${API_BASE_URL}/customers/${customerId}`, { method: 'DELETE' });
      setCustomers(prev => prev.filter(c => c.id !== customerId));
      setOrders(prev => prev.filter(o => o.customer_id !== customerId));
      onUpdate();
    } catch (err: any) {
      console.error('Failed to delete customer:', err);
      setError('Imeshindwa kumfuta mteja');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || orderItems.length === 0) return;
    
    const validItems = orderItems.filter(item => item.product_name && Number(item.unit_price) > 0);
    if (validItems.length === 0) {
      setError('Ongeza bidhaa angalau moja na bei');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          items: validItems,
          notes: orderNotes
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        const newOrder = result.order;
        setOrders(prev => [newOrder, ...prev]);
        setIsAddOrderModalOpen(false);
        resetOrderForm();
        onUpdate();
        await loadData();
        setActiveTab('orders');
        
        // Send SMS notification
        const customer = customers.find(c => c.id === selectedCustomerId);
        if (customer) {
          await sendOrderSMS(newOrder, customer.phone_number);
        }
      } else {
        setError(result.error || 'Imeshindwa kuhifadhi oda');
      }
    } catch (err: any) {
      console.error('Failed to add order:', err);
      setError('Imeshindwa kuhifadhi oda');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder || !selectedCustomerId || orderItems.length === 0) return;
    
    const validItems = orderItems.filter(item => item.product_name && Number(item.unit_price) > 0);
    if (validItems.length === 0) {
      setError('Ongeza bidhaa angalau moja na bei');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/${editingOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          items: validItems,
          notes: orderNotes
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setOrders(prev => prev.map(o => 
          o.id === editingOrder.id ? result.order : o
        ));
        setIsEditOrderModalOpen(false);
        setEditingOrder(null);
        resetOrderForm();
        onUpdate();
        await loadData();
      } else {
        setError(result.error || 'Imeshindwa kuhariri oda');
      }
    } catch (err: any) {
      console.error('Failed to edit order:', err);
      setError('Imeshindwa kuhariri oda');
    } finally {
      setIsLoading(false);
    }
  };

  const openEditOrderModal = (order: Order) => {
    setEditingOrder(order);
    setSelectedCustomerId(order.customer_id);
    setOrderItems(order.items.map(item => ({
      ...item,
      id: item.id || 'item-' + Date.now(),
      unit_price: item.unit_price || ''
    })));
    setOrderNotes(order.notes || '');
    setIsEditOrderModalOpen(true);
  };

  const handleCompleteOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    
    const shippingInfo: ShippingInfo = {
      method: shippingMethod,
    };
    
    if (shippingMethod === 'BodaBoda') {
      if (!bodaPhone) {
        setError('Namba ya BodaBoda inahitajika');
        return;
      }
      shippingInfo.bodaName = bodaName;
      shippingInfo.bodaPhone = bodaPhone;
      shippingInfo.bodaPlateNumber = bodaPlateNumber;
    } else {
      if (busType === 'company') {
        if (!busName) {
          setError('Jina la Bus/Kampuni inahitajika');
          return;
        }
        shippingInfo.busName = busName;
        shippingInfo.busNumber = busNumber;
        shippingInfo.cargoNumber = cargoNumber;
      } else {
        if (!driverName || !driverPhone) {
          setError('Jina na namba ya Dreva vinahitajika');
          return;
        }
        shippingInfo.driverName = driverName;
        shippingInfo.driverPhone = driverPhone;
        shippingInfo.cargoNumber = cargoNumber;
      }
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/orders-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          ...shippingInfo
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setOrders(prev => prev.map(o => 
          o.id === selectedOrder.id ? { ...o, status: 'Completed', shipping_info: shippingInfo } : o
        ));
        setIsCompleteOrderModalOpen(false);
        setSelectedOrder(null);
        resetShippingForm();
        onUpdate();
        await loadData();
      } else {
        setError(result.error || 'Imeshindwa kukamilisha oda');
      }
    } catch (err: any) {
      console.error('Failed to complete order:', err);
      setOrders(prev => prev.map(o => 
        o.id === selectedOrder.id ? { ...o, status: 'Completed', shipping_info: shippingInfo } : o
      ));
      setIsCompleteOrderModalOpen(false);
      setSelectedOrder(null);
      resetShippingForm();
      onUpdate();
    } finally {
      setIsLoading(false);
    }
  };

  const openCompleteOrderModal = (order: Order) => {
    setSelectedOrder(order);
    resetShippingForm();
    setIsCompleteOrderModalOpen(true);
  };

  const resetShippingForm = () => {
    setShippingMethod('BodaBoda');
    setBodaName('');
    setBodaPhone('');
    setBodaPlateNumber('');
    setBusType('company');
    setBusName('');
    setBusNumber('');
    setCargoNumber('');
    setDriverName('');
    setDriverPhone('');
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm('Je, una uhakika unataka kufuta oda hii?')) return;
    
    setIsLoading(true);
    try {
      await fetch(`${API_BASE_URL}/${orderId}`, { method: 'DELETE' });
      setOrders(prev => prev.filter(o => o.id !== orderId));
      onUpdate();
    } catch (err: any) {
      console.error('Failed to delete order:', err);
      setError('Imeshindwa kufuta oda');
    } finally {
      setIsLoading(false);
    }
  };

  const resetOrderForm = () => {
    setSelectedCustomerId('');
    setOrderItems([
      { id: 'item-' + Date.now(), product_name: '', quantity: 1, unit_price: '', total_price: 0 }
    ]);
    setOrderNotes('');
  };

  const filteredOrders = useMemo(() => {
    if (!searchTerm) return orders;
    const term = searchTerm.toLowerCase();
    return orders.filter(order => 
      order.customer_name?.toLowerCase().includes(term) ||
      order.items.some(item => item.product_name.toLowerCase().includes(term)) ||
      order.id.toLowerCase().includes(term)
    );
  }, [orders, searchTerm]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearchTerm) return customers;
    const term = customerSearchTerm.toLowerCase();
    return customers.filter(customer => 
      customer.full_name?.toLowerCase().includes(term) ||
      customer.phone_number?.toLowerCase().includes(term) ||
      customer.address?.toLowerCase().includes(term)
    );
  }, [customers, customerSearchTerm]);

  const stats = useMemo(() => {
    const totalOrders = orders.length;
    const totalAmount = orders.reduce((sum, order) => sum + Number(order.total_amount), 0);
    const pendingOrders = orders.filter(o => o.status === 'Pending').length;
    const completedOrders = orders.filter(o => o.status === 'Completed').length;
    return { totalOrders, totalAmount, pendingOrders, completedOrders, totalCustomers: customers.length };
  }, [orders, customers]);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handlePrintOrder = (order: Order) => {
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);
    
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('sw-TZ', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    };

    const formatTime = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleTimeString('sw-TZ', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    };

    const shippingHTML = order.shipping_info ? `
      <div style="background: #f0fdf4; border: 1.5px solid #22c55e; border-radius: 8px; padding: 10px 15px; margin-top: 12px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <span style="font-size: 16px;">🚚</span>
          <span style="color: #16a34a; font-size: 13px; font-weight: bold;">TAARIFA ZA USAFIRISHAJI</span>
        </div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; font-size: 11px;">
          <div>
            <span style="color: #64748b; font-size: 8px; font-weight: bold; text-transform: uppercase; display: block;">Njia</span>
            <span style="font-weight: bold; color: #16a34a;">${order.shipping_info.method === 'BodaBoda' ? '🏍️ BodaBoda' : '🚌 Bus'}</span>
          </div>
          ${
            order.shipping_info.method === 'BodaBoda'
              ? `
                <div>
                  <span style="color: #64748b; font-size: 8px; font-weight: bold; text-transform: uppercase; display: block;">Jina</span>
                  <span style="font-weight: bold; color: #334155;">${order.shipping_info.bodaName || '-'}</span>
                </div>
                <div>
                  <span style="color: #64748b; font-size: 8px; font-weight: bold; text-transform: uppercase; display: block;">Simu</span>
                  <span style="font-weight: bold; color: #334155;">${order.shipping_info.bodaPhone}</span>
                </div>
                <div>
                  <span style="color: #64748b; font-size: 8px; font-weight: bold; text-transform: uppercase; display: block;">Pikipiki</span>
                  <span style="font-weight: bold; color: #334155;">${order.shipping_info.bodaPlateNumber || '-'}</span>
                </div>
              `
              : order.shipping_info.busName
                ? `
                  <div>
                    <span style="color: #64748b; font-size: 8px; font-weight: bold; text-transform: uppercase; display: block;">Bus/Kampuni</span>
                    <span style="font-weight: bold; color: #334155;">${order.shipping_info.busName}</span>
                  </div>
                  <div>
                    <span style="color: #64748b; font-size: 8px; font-weight: bold; text-transform: uppercase; display: block;">Namba ya Bus</span>
                    <span style="font-weight: bold; color: #334155;">${order.shipping_info.busNumber || '-'}</span>
                  </div>
                  <div>
                    <span style="color: #64748b; font-size: 8px; font-weight: bold; text-transform: uppercase; display: block;">Namba ya Mzigo</span>
                    <span style="font-weight: bold; color: #334155;">${order.shipping_info.cargoNumber || '-'}</span>
                  </div>
                `
                : `
                  <div>
                    <span style="color: #64748b; font-size: 8px; font-weight: bold; text-transform: uppercase; display: block;">Dreva</span>
                    <span style="font-weight: bold; color: #334155;">${order.shipping_info.driverName}</span>
                  </div>
                  <div>
                    <span style="color: #64748b; font-size: 8px; font-weight: bold; text-transform: uppercase; display: block;">Simu ya Dreva</span>
                    <span style="font-weight: bold; color: #334155;">${order.shipping_info.driverPhone}</span>
                  </div>
                  <div>
                    <span style="color: #64748b; font-size: 8px; font-weight: bold; text-transform: uppercase; display: block;">Namba ya Mzigo</span>
                    <span style="font-weight: bold; color: #334155;">${order.shipping_info.cargoNumber || '-'}</span>
                  </div>
                `
          }
        </div>
      </div>
    ` : '';

    const docContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Oda - ${order.id}</title>
          <meta charset="UTF-8">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            @page {
              size: A4;
              margin: 10mm;
            }
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              background: #f8fafc;
              color: #1e293b;
              padding: 10px;
            }
            .container {
              max-width: 190mm;
              margin: 0 auto;
              background: white;
              border-radius: 12px;
              box-shadow: 0 4px 20px rgba(0,0,0,0.08);
              overflow: hidden;
              min-height: 260mm;
              display: flex;
              flex-direction: column;
            }
            .header {
              background: linear-gradient(135deg, #1e3a5f 0%, #3b82f6 50%, #22c55e 100%);
              color: white;
              padding: 15px 25px;
              text-align: center;
            }
            .business-name {
              font-size: 22px;
              font-weight: 900;
              letter-spacing: 1px;
            }
            .business-slogan {
              font-size: 10px;
              opacity: 0.9;
              margin: 2px 0 8px;
            }
            .order-badge {
              display: inline-block;
              background: rgba(255,255,255,0.2);
              padding: 4px 15px;
              border-radius: 20px;
              font-size: 11px;
              font-weight: bold;
              letter-spacing: 1px;
            }
            .content {
              padding: 15px 25px;
              flex: 1;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 8px;
              margin-bottom: 10px;
            }
            .info-card {
              background: #f0f9ff;
              border: 1px solid #bae6fd;
              border-radius: 6px;
              padding: 8px 12px;
            }
            .info-label {
              color: #0284c7;
              font-size: 7px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 2px;
            }
            .info-value {
              font-size: 12px;
              font-weight: bold;
              color: #1e293b;
            }
            .divider {
              border: none;
              border-top: 1.5px dashed #e2e8f0;
              margin: 10px 0;
            }
            .section-title {
              font-size: 12px;
              font-weight: 800;
              color: #1e3a5f;
              margin-bottom: 8px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 8px 0;
            }
            thead th {
              background: #1e3a5f;
              color: white;
              padding: 8px 10px;
              text-align: left;
              font-size: 9px;
              text-transform: uppercase;
              letter-spacing: 0.3px;
            }
            thead th:first-child { border-radius: 6px 0 0 0; }
            thead th:last-child { border-radius: 0 6px 0 0; }
            tbody td {
              padding: 6px 10px;
              border-bottom: 1px solid #e2e8f0;
              font-size: 11px;
            }
            tbody tr:nth-child(even) { background: #f8fafc; }
            .total-section {
              background: linear-gradient(135deg, #1e3a5f 0%, #3b82f6 100%);
              color: white;
              padding: 10px 15px;
              border-radius: 8px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-top: 10px;
            }
            .total-label {
              font-size: 11px;
              font-weight: bold;
              letter-spacing: 0.5px;
            }
            .total-amount {
              font-size: 18px;
              font-weight: 900;
            }
            .signature-section {
              display: flex;
              justify-content: space-between;
              margin-top: 25px;
              padding: 0 10px;
              gap: 40px;
            }
            .signature-box {
              text-align: center;
              flex: 1;
            }
            .signature-name {
              font-size: 13px;
              font-style: italic;
              font-weight: 600;
              color: #1e3a5f;
              margin-bottom: 3px;
            }
            .signature-line {
              border-top: 1.5px solid #1e3a5f;
              padding-top: 5px;
              font-size: 9px;
              font-weight: bold;
              color: #64748b;
              text-transform: uppercase;
            }
            .footer {
              background: #f8fafc;
              padding: 8px 20px;
              text-align: center;
              font-size: 9px;
              color: #64748b;
              border-top: 1px solid #e2e8f0;
            }
            .status-badge {
              display: inline-block;
              padding: 2px 10px;
              border-radius: 10px;
              font-size: 9px;
              font-weight: bold;
              letter-spacing: 0.3px;
            }
            .status-pending { background: #fef3c7; color: #d97706; }
            .status-completed { background: #d1fae5; color: #059669; }
            @media print {
              body { background: white; padding: 0; }
              .container { box-shadow: none; border-radius: 0; }
              .no-print { display: none !important; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="business-name">SONKO SOUND</div>
              <div class="business-slogan">🔊 Electronics & Appliances</div>
              <div class="order-badge">📋 ODA YA BIDHAA</div>
            </div>
            
            <div class="content">
              <div class="info-grid">
                <div class="info-card">
                  <div class="info-label">Oda ID</div>
                  <div class="info-value" style="font-size: 10px;">${order.id}</div>
                </div>
                <div class="info-card">
                  <div class="info-label">Tarehe</div>
                  <div class="info-value">${formatDate(order.created_at)}</div>
                </div>
                <div class="info-card">
                  <div class="info-label">Saa</div>
                  <div class="info-value">${formatTime(order.created_at)}</div>
                </div>
                <div class="info-card">
                  <div class="info-label">Hali ya Oda</div>
                  <div class="info-value">
                    <span class="status-badge ${order.status === 'Completed' ? 'status-completed' : 'status-pending'}">
                      ${order.status === 'Completed' ? '✅ Imekamilika' : '⏳ Inasubiri'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div class="section-title" style="margin-top: 8px;">👤 TAARIFA ZA MTEJA</div>
              <div class="info-grid">
                <div class="info-card" style="background: #fef2f2; border-color: #fecaca;">
                  <div class="info-label" style="color: #dc2626;">Jina la Mteja</div>
                  <div class="info-value">${order.customer_name}</div>
                </div>
                <div class="info-card" style="background: #fef2f2; border-color: #fecaca;">
                  <div class="info-label" style="color: #dc2626;">Namba ya Simu</div>
                  <div class="info-value">${order.customer_phone}</div>
                </div>
              </div>
              ${order.notes ? `
                <div class="info-card" style="background: #fffbeb; border-color: #fde68a; margin-top: 8px; padding: 6px 12px;">
                  <div class="info-label" style="color: #d97706;">📝 Maelezo</div>
                  <div class="info-value" style="font-size: 10px;">${order.notes}</div>
                </div>
              ` : ''}
              
              ${shippingHTML}
              
              <hr class="divider">
              
              <div class="section-title">📦 BIDHAA ZILIZOAGIZWA</div>
              <table>
                <thead>
                  <tr>
                    <th style="width: 30px;">#</th>
                    <th>Bidhaa</th>
                    <th style="width: 50px;">Idadi</th>
                    <th>Bei ya Kimoja</th>
                    <th>Jumla</th>
                  </tr>
                </thead>
                <tbody>
                  ${order.items.map((item, index) => `
                    <tr>
                      <td>${index + 1}</td>
                      <td style="font-weight: bold;">${item.product_name}</td>
                      <td style="text-align: center;">${item.quantity}</td>
                      <td>TSh ${Number(item.unit_price).toLocaleString()}</td>
                      <td style="font-weight: bold;">TSh ${Number(item.total_price).toLocaleString()}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              
              <div class="total-section">
                <span class="total-label">JUMLA KUU</span>
                <span class="total-amount">TSh ${Number(order.total_amount).toLocaleString()}</span>
              </div>
              
              <div class="signature-section">
                <div class="signature-box">
                  <div class="signature-name">${order.customer_name}</div>
                  <div class="signature-line">Sahihi ya Mteja</div>
                </div>
                <div class="signature-box">
                  <div class="signature-name">Sonko Sound</div>
                  <div class="signature-line">Sahihi ya Mmiliki</div>
                </div>
              </div>
            </div>
            
            <div class="footer">
              <p>📍 Morogoro, Tanzania | 📞 0656738253</p>
              <p style="margin-top: 3px;">Asante kwa kufanya biashara nasi! 🙏</p>
            </div>
            
            <div class="no-print" style="text-align: center; padding: 10px; background: #f1f5f9;">
              <button onclick="window.print()" style="background: #3b82f6; color: white; border: none; padding: 8px 20px; border-radius: 20px; font-size: 12px; font-weight: bold; cursor: pointer; margin-right: 8px;">
                🖨️ Chapisha / Save as PDF
              </button>
              <button onclick="window.close()" style="background: #64748b; color: white; border: none; padding: 8px 20px; border-radius: 20px; font-size: 12px; font-weight: bold; cursor: pointer;">
                Funga
              </button>
            </div>
          </div>
        </body>
      </html>
    `;
    
    printFrame.contentWindow.document.open();
    printFrame.contentWindow.document.write(docContent);
    printFrame.contentWindow.document.close();
    
    setTimeout(() => {
      printFrame.contentWindow.focus();
      printFrame.contentWindow.print();
      printFrame.contentWindow.onafterprint = function() {
        document.body.removeChild(printFrame);
      };
    }, 500);
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-rose-700 text-xs">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
            <X size={16} />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-2 text-emerald-700 text-xs">
          <MessageSquare size={16} />
          <span>{successMessage}</span>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center gap-2 text-xs text-slate-400 py-2">
          <Loader2 size={14} className="animate-spin" />
          <span>Inapakia...</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Jumla ya Oda</span>
          <h3 className="text-2xl font-black text-slate-800 mt-2">{stats.totalOrders}</h3>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Thamani ya Oda Zote</span>
          <h3 className="text-2xl font-black text-slate-800 mt-2">TSh {stats.totalAmount.toLocaleString()}</h3>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Wateja wa Oda</span>
          <h3 className="text-2xl font-black text-accent mt-2">{stats.totalCustomers}</h3>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Oda Zinazosubiri</span>
          <h3 className="text-2xl font-black text-amber-600 mt-2">{stats.pendingOrders}</h3>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm">
        <button 
          onClick={() => setActiveTab('orders')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition ${
            activeTab === 'orders' 
              ? 'bg-accent text-white shadow-sm' 
              : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <ShoppingCart size={14} className="inline mr-1" />
          Oda ({orders.length})
        </button>
        <button 
          onClick={() => setActiveTab('customers')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition ${
            activeTab === 'customers' 
              ? 'bg-accent text-white shadow-sm' 
              : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Users size={14} className="inline mr-1" />
          Wateja ({customers.length})
        </button>
      </div>

      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-white p-5 rounded-3xl border border-slate-100 shadow-sm gap-4">
        <div>
          <h2 className="text-md font-bold text-slate-800">
            {activeTab === 'orders' ? 'Oda za Bidhaa' : 'Wateja wa Oda'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {activeTab === 'orders' 
              ? 'Dhibiti oda za wateja na bidhaa zao.' 
              : 'Dhibiti wateja wanaonunua bidhaa.'}
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsAddCustomerModalOpen(true)} 
            className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5 shadow-sm transition"
          >
            <User size={15} /> Mteja Mpya
          </button>
          <button 
            onClick={() => {
              resetOrderForm();
              setIsAddOrderModalOpen(true);
            }} 
            className="bg-accent hover:bg-accent/90 text-white font-semibold text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5 shadow-sm transition"
          >
            <Plus size={15} /> Oda Mpya
          </button>
        </div>
      </div>

      {/* ORDERS TAB */}
      {activeTab === 'orders' && (
        <>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tafuta oda kwa jina la mteja au bidhaa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs"
            />
          </div>

          <div className="space-y-4">
            {filteredOrders.length > 0 ? filteredOrders.map(order => (
              <div key={order.id} className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                      order.status === 'Completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-accent/10 text-accent'
                    }`}>
                      <ShoppingCart size={20} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-800">{order.customer_name}</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          order.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                          order.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                          'bg-rose-100 text-rose-700'
                        }`}>
                          {order.status === 'Pending' ? 'Inasubiri' : 
                           order.status === 'Completed' ? 'Imekamilika' : 'Imefutwa'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        <Phone size={12} /> {order.customer_phone}
                      </p>
                      <div className="mt-2 space-y-1">
                        {order.items.slice(0, 3).map(item => (
                          <p key={item.id} className="text-xs text-slate-500">
                            {item.quantity}x {item.product_name} - TSh {Number(item.total_price).toLocaleString()}
                          </p>
                        ))}
                        {order.items.length > 3 && (
                          <p className="text-xs text-slate-400">+ {order.items.length - 3} bidhaa nyingine</p>
                        )}
                      </div>
                      {order.shipping_info && (
                        <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                          {order.shipping_info.method === 'BodaBoda' 
                            ? <Bike size={12} /> 
                            : <Bus size={12} />} 
                          {order.shipping_info.method === 'BodaBoda' 
                            ? order.shipping_info.bodaName || order.shipping_info.bodaPhone || 'BodaBoda'
                            : order.shipping_info.busName || order.shipping_info.driverName || 'Bus'}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex md:flex-col items-center gap-2">
                    <span className="text-sm font-black text-slate-800">
                      TSh {Number(order.total_amount).toLocaleString()}
                    </span>
                    <div className="flex gap-1">
                      {order.status === 'Pending' && (
                        <button 
                          onClick={() => openCompleteOrderModal(order)}
                          className="p-2 rounded-xl border border-emerald-200 hover:bg-emerald-50 text-emerald-600 transition"
                          title="Kamilisha Oda"
                        >
                          <CheckCircle size={14} />
                        </button>
                      )}
                      <button 
                        onClick={() => {
                          setSelectedOrder(order);
                          setIsViewOrderModalOpen(true);
                        }}
                        className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
                        title="Angalia Oda"
                      >
                        <FileText size={14} />
                      </button>
                      <button 
                        onClick={() => openEditOrderModal(order)}
                        className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
                        title="Hariri Oda"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => handlePrintOrder(order)}
                        className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
                        title="Chapisha"
                      >
                        <Printer size={14} />
                      </button>
                      <button 
                        onClick={() => handleDeleteOrder(order.id)}
                        className="p-2 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-600 transition"
                        title="Futa"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )) : (
              <div className="bg-white p-12 text-center rounded-3xl border border-slate-100 shadow-sm text-slate-400">
                <Package size={40} className="mx-auto text-slate-300 mb-3" />
                <p className="text-sm font-semibold">Hakuna oda bado.</p>
                <p className="text-xs mt-1">Bonyeza "Oda Mpya" kuunda oda ya kwanza.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* CUSTOMERS TAB */}
      {activeTab === 'customers' && (
        <>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tafuta mteja kwa jina au namba..."
              value={customerSearchTerm}
              onChange={(e) => setCustomerSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCustomers.length > 0 ? filteredCustomers.map(customer => {
              const customerOrders = orders.filter(o => o.customer_id === customer.id);
              const totalSpent = customerOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
              
              return (
                <div key={customer.id} className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-accent/10 text-accent font-bold flex items-center justify-center">
                        {getInitials(customer.full_name)}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">{customer.full_name}</h3>
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                          <Phone size={12} /> {customer.phone_number}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => openEditCustomerModal(customer)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-accent hover:bg-accent/10 transition"
                        title="Hariri Mteja"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => handleDeleteCustomer(customer.id)}
                        className="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="Futa Mteja"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  
                  {customer.address && (
                    <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                      <MapPin size={12} /> {customer.address}
                    </p>
                  )}
                  
                  <div className="mt-4 pt-3 border-t border-slate-50 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Oda</p>
                      <p className="text-sm font-bold text-slate-800">{customerOrders.length}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Jumla</p>
                      <p className="text-sm font-bold text-accent">TSh {totalSpent.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Tarehe</p>
                      <p className="text-xs font-mono text-slate-600">
                        {new Date(customer.created_at).toLocaleDateString('sw-TZ')}
                      </p>
                    </div>
                  </div>
                </div>
              );
            }) : (
              <div className="col-span-full bg-white p-12 text-center rounded-3xl border border-slate-100 shadow-sm text-slate-400">
                <Users size={40} className="mx-auto text-slate-300 mb-3" />
                <p className="text-sm font-semibold">Hakuna wateja wa oda bado.</p>
                <p className="text-xs mt-1">Bonyeza "Mteja Mpya" kumsajili mteja.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Add/Edit Customer Modal */}
      {(isAddCustomerModalOpen || isEditCustomerModalOpen) && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <button onClick={() => {
              setIsAddCustomerModalOpen(false);
              setIsEditCustomerModalOpen(false);
              setEditingCustomer(null);
            }} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition">
              <X size={18} />
            </button>
            <h3 className="text-md font-bold text-slate-800">
              {isEditCustomerModalOpen ? 'Hariri Mteja' : 'Sajili Mteja wa Oda'}
            </h3>
            <form onSubmit={isEditCustomerModalOpen ? handleEditCustomer : handleAddCustomer} className="space-y-4 text-xs text-left">
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Jina Kamili *</label>
                <input type="text" required value={customerName} onChange={(e) => setCustomerName(e.target.value)} 
                  placeholder="Mfano: Juma Kassim" className="w-full p-2.5 border border-slate-200 rounded-xl" />
              </div>
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Namba ya Simu *</label>
                <input type="tel" required value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} 
                  placeholder="0712345678" className="w-full p-2.5 border border-slate-200 rounded-xl" />
              </div>
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Anuani</label>
                <input type="text" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} 
                  placeholder="Mtaa, Jiji" className="w-full p-2.5 border border-slate-200 rounded-xl" />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => {
                  setIsAddCustomerModalOpen(false);
                  setIsEditCustomerModalOpen(false);
                  setEditingCustomer(null);
                }} 
                  className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600 transition">Ghairi</button>
                <button type="submit" disabled={isLoading} 
                  className="px-5 py-2 bg-accent hover:bg-accent/90 text-white rounded-xl font-semibold shadow-sm transition disabled:opacity-50">
                  {isLoading ? 'Inahifadhi...' : isEditCustomerModalOpen ? 'Hifadhi Mabadiliko' : 'Sajili Mteja'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Order Modal */}
      {(isAddOrderModalOpen || isEditOrderModalOpen) && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => {
              setIsAddOrderModalOpen(false);
              setIsEditOrderModalOpen(false);
              setEditingOrder(null);
            }} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition">
              <X size={18} />
            </button>
            <h3 className="text-md font-bold text-slate-800">
              {isEditOrderModalOpen ? 'Hariri Oda' : 'Oda Mpya'}
            </h3>
            <form onSubmit={isEditOrderModalOpen ? handleEditOrder : handleAddOrder} className="space-y-4 text-xs text-left">
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Mteja *</label>
                <select 
                  required 
                  value={selectedCustomerId} 
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-white"
                >
                  <option value="">Chagua Mteja...</option>
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.full_name} - {customer.phone_number}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <label className="block font-semibold text-slate-500 uppercase tracking-wide">Bidhaa za Oda</label>
                {orderItems.map((item, index) => (
                  <div key={item.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Bidhaa {index + 1}</span>
                      {orderItems.length > 1 && (
                        <button type="button" onClick={() => removeOrderItem(index)} 
                          className="text-rose-500 hover:text-rose-700 p-1">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                    <input 
                      type="text" 
                      placeholder="Jina la bidhaa (mf. Generator)" 
                      value={item.product_name}
                      onChange={(e) => updateOrderItem(index, 'product_name', e.target.value)}
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
                          onChange={(e) => updateOrderItem(index, 'quantity', Number(e.target.value))}
                          className="w-full p-2 border border-slate-200 rounded-lg bg-white"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 mb-1">Bei ya Kimoja (TSh)</label>
                        <input 
                          type="number" 
                          min="0"
                          placeholder="0"
                          value={item.unit_price === '' ? '' : item.unit_price}
                          onChange={(e) => updateOrderItem(index, 'unit_price', e.target.value)}
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
                <button type="button" onClick={addOrderItem} 
                  className="w-full py-2 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:text-accent hover:border-accent transition font-semibold flex items-center justify-center gap-1">
                  <Plus size={14} /> Ongeza Bidhaa Nyingine
                </button>
              </div>

              <div className="bg-accent/5 p-4 rounded-2xl border border-accent/10">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-800">Jumla Kuu:</span>
                  <span className="text-lg font-black text-accent">TSh {orderTotal.toLocaleString()}</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Maelezo</label>
                <textarea 
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="Maelezo ya ziada..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl h-20"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => {
                  setIsAddOrderModalOpen(false);
                  setIsEditOrderModalOpen(false);
                  setEditingOrder(null);
                }} 
                  className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600 transition">Ghairi</button>
                <button type="submit" disabled={isLoading} 
                  className="px-5 py-2 bg-accent hover:bg-accent/90 text-white rounded-xl font-semibold shadow-sm transition disabled:opacity-50">
                  {isLoading ? 'Inahifadhi...' : isEditOrderModalOpen ? 'Hifadhi Mabadiliko' : 'Hifadhi Oda'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Order (Shipping) Modal */}
      {isCompleteOrderModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => {
              setIsCompleteOrderModalOpen(false);
              setSelectedOrder(null);
              resetShippingForm();
            }} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition">
              <X size={18} />
            </button>
            <h3 className="text-md font-bold text-slate-800">Kamilisha Oda - Usafirishaji</h3>
            <p className="text-xs text-slate-400">
              Oda ya {selectedOrder.customer_name} - TSh {Number(selectedOrder.total_amount).toLocaleString()}
            </p>
            
            <form onSubmit={handleCompleteOrder} className="space-y-4 text-xs text-left">
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-2">Kutuma Kwa *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setShippingMethod('BodaBoda')}
                    className={`p-4 rounded-2xl border-2 transition flex flex-col items-center gap-2 ${
                      shippingMethod === 'BodaBoda' 
                        ? 'border-accent bg-accent/5 text-accent' 
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <Bike size={24} />
                    <span className="font-bold">BodaBoda</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShippingMethod('Bus')}
                    className={`p-4 rounded-2xl border-2 transition flex flex-col items-center gap-2 ${
                      shippingMethod === 'Bus' 
                        ? 'border-accent bg-accent/5 text-accent' 
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <Bus size={24} />
                    <span className="font-bold">Bus</span>
                  </button>
                </div>
              </div>

              {shippingMethod === 'BodaBoda' && (
                <div className="space-y-3">
                  <div>
                    <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Jina la BodaBoda (Optional)</label>
                    <input type="text" value={bodaName} onChange={(e) => setBodaName(e.target.value)} 
                      placeholder="Mfano: Juma Boda" className="w-full p-2.5 border border-slate-200 rounded-xl" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Namba ya BodaBoda *</label>
                    <input type="tel" required value={bodaPhone} onChange={(e) => setBodaPhone(e.target.value)} 
                      placeholder="0712345678" className="w-full p-2.5 border border-slate-200 rounded-xl" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Namba ya Pikipiki (Optional)</label>
                    <input type="text" value={bodaPlateNumber} onChange={(e) => setBodaPlateNumber(e.target.value)} 
                      placeholder="T123 ABC" className="w-full p-2.5 border border-slate-200 rounded-xl" />
                  </div>
                </div>
              )}

              {shippingMethod === 'Bus' && (
                <div className="space-y-3">
                  <div>
                    <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-2">Chagua Aina</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setBusType('company')}
                        className={`p-3 rounded-xl border-2 transition ${
                          busType === 'company' 
                            ? 'border-accent bg-accent/5 text-accent' 
                            : 'border-slate-200 text-slate-500'
                        }`}
                      >
                        Kampuni ya Bus
                      </button>
                      <button
                        type="button"
                        onClick={() => setBusType('driver')}
                        className={`p-3 rounded-xl border-2 transition ${
                          busType === 'driver' 
                            ? 'border-accent bg-accent/5 text-accent' 
                            : 'border-slate-200 text-slate-500'
                        }`}
                      >
                        Dreva
                      </button>
                    </div>
                  </div>

                  {busType === 'company' ? (
                    <>
                      <div>
                        <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Jina la Bus/Kampuni *</label>
                        <input type="text" required value={busName} onChange={(e) => setBusName(e.target.value)} 
                          placeholder="Mfano: ABC Express" className="w-full p-2.5 border border-slate-200 rounded-xl" />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Namba ya Bus (Optional)</label>
                        <input type="text" value={busNumber} onChange={(e) => setBusNumber(e.target.value)} 
                          placeholder="T123 ABC" className="w-full p-2.5 border border-slate-200 rounded-xl" />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Namba ya Mzigo (Optional)</label>
                        <input type="text" value={cargoNumber} onChange={(e) => setCargoNumber(e.target.value)} 
                          placeholder="MZ123456" className="w-full p-2.5 border border-slate-200 rounded-xl" />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Jina la Dreva *</label>
                        <input type="text" required value={driverName} onChange={(e) => setDriverName(e.target.value)} 
                          placeholder="Mfano: Juma Dreva" className="w-full p-2.5 border border-slate-200 rounded-xl" />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Namba ya Simu *</label>
                        <input type="tel" required value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} 
                          placeholder="0712345678" className="w-full p-2.5 border border-slate-200 rounded-xl" />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Namba ya Mzigo (Optional)</label>
                        <input type="text" value={cargoNumber} onChange={(e) => setCargoNumber(e.target.value)} 
                          placeholder="MZ123456" className="w-full p-2.5 border border-slate-200 rounded-xl" />
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => {
                  setIsCompleteOrderModalOpen(false);
                  setSelectedOrder(null);
                  resetShippingForm();
                }} 
                  className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600 transition">Ghairi</button>
                <button type="submit" disabled={isLoading} 
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-sm transition disabled:opacity-50 flex items-center gap-2">
                  <CheckCircle size={14} />
                  {isLoading ? 'Inakamilisha...' : 'Kamilisha Oda'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Order Modal */}
      {isViewOrderModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative">
            <button onClick={() => setIsViewOrderModalOpen(false)} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50 transition">
              <X size={18} />
            </button>
            <h3 className="text-md font-bold text-slate-800">Maelezo ya Oda</h3>
            <div className="space-y-4 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Oda ID:</span>
                <span className="font-bold">{selectedOrder.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Mteja:</span>
                <span className="font-bold">{selectedOrder.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Simu:</span>
                <span className="font-bold">{selectedOrder.customer_phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tarehe:</span>
                <span className="font-bold">{new Date(selectedOrder.created_at).toLocaleDateString('sw-TZ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Hali:</span>
                <span className={`font-bold ${selectedOrder.status === 'Completed' ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {selectedOrder.status === 'Pending' ? 'Inasubiri' : 
                   selectedOrder.status === 'Completed' ? 'Imekamilika' : 'Imefutwa'}
                </span>
              </div>
              
              {selectedOrder.shipping_info && (
                <div className="border-t border-slate-100 pt-3">
                  <h4 className="font-bold text-slate-700 mb-2">Taarifa za Usafirishaji:</h4>
                  <div className="space-y-2">
                    <p><strong>Njia:</strong> {selectedOrder.shipping_info.method}</p>
                    {selectedOrder.shipping_info.method === 'BodaBoda' ? (
                      <>
                        <p><strong>Jina:</strong> {selectedOrder.shipping_info.bodaName || '-'}</p>
                        <p><strong>Namba:</strong> {selectedOrder.shipping_info.bodaPhone}</p>
                        <p><strong>Pikipiki:</strong> {selectedOrder.shipping_info.bodaPlateNumber || '-'}</p>
                      </>
                    ) : selectedOrder.shipping_info.busName ? (
                      <>
                        <p><strong>Bus/Kampuni:</strong> {selectedOrder.shipping_info.busName}</p>
                        <p><strong>Namba ya Bus:</strong> {selectedOrder.shipping_info.busNumber || '-'}</p>
                        {selectedOrder.shipping_info.cargoNumber && (
                          <p><strong>Namba ya Mzigo:</strong> {selectedOrder.shipping_info.cargoNumber}</p>
                        )}
                      </>
                    ) : (
                      <>
                        <p><strong>Dreva:</strong> {selectedOrder.shipping_info.driverName}</p>
                        <p><strong>Simu:</strong> {selectedOrder.shipping_info.driverPhone}</p>
                        {selectedOrder.shipping_info.cargoNumber && (
                          <p><strong>Namba ya Mzigo:</strong> {selectedOrder.shipping_info.cargoNumber}</p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
              
              <div className="border-t border-slate-100 pt-3">
                <h4 className="font-bold text-slate-700 mb-2">Bidhaa:</h4>
                <div className="space-y-2">
                  {selectedOrder.items.map((item, index) => (
                    <div key={item.id} className="flex justify-between items-center">
                      <span>{index + 1}. {item.product_name} ({item.quantity}x)</span>
                      <span className="font-bold">TSh {Number(item.total_price).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="border-t border-slate-100 pt-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-700">Jumla Kuu:</span>
                  <span className="text-lg font-black text-accent">TSh {Number(selectedOrder.total_amount).toLocaleString()}</span>
                </div>
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <button 
                  onClick={() => handlePrintOrder(selectedOrder)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold flex items-center gap-2"
                >
                  <Printer size={14} /> Chapisha
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
