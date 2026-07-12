/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type CustomerStatus = 'Active' | 'Cleared' | 'Overdue';

export interface Customer {
  id: string;
  fullName: string;
  phoneNumber: string;
  address: string;
  businessName?: string;
  notes: string;
  photoUrl?: string;
  createdAt: string;
}

export type DebtCategory = string;
export type DebtStatus = 'Active' | 'Due Today' | 'Due Soon' | 'Overdue' | 'Paid';

export interface Debt {
  id: string;
  customerId: string;
  amount: number;
  dateBorrowed: string;
  dueDate: string;
  description: string;
  category: DebtCategory;
  notes: string;
  status: DebtStatus;
  createdAt: string;
}

export type PaymentMethod = 'M-Pesa' | 'Tigo Pesa' | 'Airtel Money' | 'HaloPesa' | 'Bank Transfer' | 'Cash' | 'Cheque' | 'Other';

export interface Payment {
  id: string;
  debtId: string;
  amount: number;
  date: string;
  paymentMethod: PaymentMethod;
  notes: string;
  createdAt: string;
}

export interface SupplierProduct {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
  notes: string;
  createdAt: string;
}

export interface SupplierPayment {
  id: string;
  amount: number;
  date: string;
  notes: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  phoneNumber: string;
  amount: number;
  paidAmount: number;
  dueDate: string;
  productType?: string;  // ADDED: Product type like "Mizigo/Products", "Huduma", "Mkopo"
  notes: string;
  createdAt: string;
  products?: SupplierProduct[];
  payments?: SupplierPayment[];
}

export type NotificationType = 
  | 'Due Today' 
  | 'Due Tomorrow' 
  | 'Upcoming' 
  | 'Overdue' 
  | 'Fully Paid' 
  | 'New Customer Added' 
  | 'Payment Received' 
  | 'Debt Added';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  message: string;
  date: string;
  customerId?: string;
  debtId?: string;
}

export type ActionType = 
  | 'Debt Added' 
  | 'Debt Edited' 
  | 'Payment Added' 
  | 'Payment Updated' 
  | 'Payment Deleted' 
  | 'Customer Created' 
  | 'Customer Updated'
  | 'Supplier Created'
  | 'Supplier Updated'
  | 'Supplier Paid';

export interface TransactionRecord {
  id: string;
  actionType: ActionType;
  description: string;
  timestamp: string;
  amount?: number;
}

export interface BusinessSettings {
  businessName: string;
  businessAddress: string;
  businessPhone: string;
}
