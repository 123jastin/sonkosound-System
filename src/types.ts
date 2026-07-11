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
  photoUrl?: string; // Optional avatar placeholder / local data URL
  createdAt: string;
}

export type DebtCategory = string;
export type DebtStatus = 'Active' | 'Due Today' | 'Due Soon' | 'Overdue' | 'Paid';

export interface Debt {
  id: string;
  customerId: string;
  amount: number; // in TSh
  dateBorrowed: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
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
  amount: number; // in TSh
  date: string; // YYYY-MM-DD
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
  amount: number; // sum of all product amounts
  paidAmount: number; // sum of all supplier payments
  dueDate: string; // YYYY-MM-DD (latest or initial due date)
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
  read: boolean;
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
  businessLogoUrl: string; // Data URL or icon identifier
  businessPhone: string;
  businessAddress: string;
  defaultReminderDays: number; // days before due date to alert
  darkMode: boolean;
}

export interface UserSession {
  isAuthenticated: boolean;
  businessName: string;
  username: string;
  lastActive: string;
}
