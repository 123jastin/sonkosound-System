/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Customer, Debt, Payment, Supplier, NotificationItem, TransactionRecord, BusinessSettings, CustomerStatus, DebtStatus } from './types';

// Simple hashing function for password protection in LocalStorage
export function hashPassword(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return 'sha-' + Math.abs(hash).toString(16);
}

// Initial seed data to make the ledger instantly beautiful and functional on load
const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cust-1',
    fullName: 'Jalia Hassan',
    phoneNumber: '0712345678',
    address: 'Kariakoo, Dar es Salaam',
    businessName: 'Jalia Boutique',
    notes: 'Kutana naye kila tarehe 10. Huwa analipa kwa awamu.',
    createdAt: '2026-06-01'
  },
  {
    id: 'cust-2',
    fullName: 'John Mashaka',
    phoneNumber: '0754889922',
    address: 'Mbezi Beach, Dar es Salaam',
    businessName: 'Mashaka General Supplies',
    notes: 'Mteja mwaminifu wa jumla.',
    createdAt: '2026-06-05'
  },
  {
    id: 'cust-3',
    fullName: 'Maria Temu',
    phoneNumber: '0682114455',
    address: 'Njiro, Arusha',
    businessName: 'Temu Fresh Vegetables',
    notes: 'Amechelewa malipo ya bidhaa za kilimo.',
    createdAt: '2026-06-10'
  },
  {
    id: 'cust-4',
    fullName: 'Peter Shirima',
    phoneNumber: '0711998877',
    address: 'Kinondoni, Dar es Salaam',
    businessName: 'Shirima Tech Lab',
    notes: 'Amemaliza kulipa deni lake lote.',
    createdAt: '2026-06-15'
  }
];

// Current date for mock generation: 2026-07-10 (as in metadata)
const INITIAL_DEBTS: Debt[] = [
  {
    id: 'debt-1',
    customerId: 'cust-1',
    amount: 150000,
    dateBorrowed: '2026-06-10',
    dueDate: '2026-07-10', // Due Today
    description: 'Boutique clothing wholesale batch',
    category: 'Products',
    notes: 'Mizigo ya kike na watoto kutoka Uturuki.',
    status: 'Due Today',
    createdAt: '2026-06-10'
  },
  {
    id: 'debt-2',
    customerId: 'cust-2',
    amount: 250000,
    dateBorrowed: '2026-06-20',
    dueDate: '2026-07-11', // Due Tomorrow
    description: 'Office supply delivery',
    category: 'Products',
    notes: 'Karatasi za A4 na vifaa vya ofisi.',
    status: 'Active',
    createdAt: '2026-06-20'
  },
  {
    id: 'debt-3',
    customerId: 'cust-3',
    amount: 120000,
    dateBorrowed: '2026-06-05',
    dueDate: '2026-07-05', // Overdue by 5 days (as of July 10, 2026)
    description: 'Fresh groceries supply',
    category: 'Products',
    notes: 'Mizigo ya mboga mboga kutoka shambani.',
    status: 'Overdue',
    createdAt: '2026-06-05'
  },
  {
    id: 'debt-4',
    customerId: 'cust-4',
    amount: 80000,
    dateBorrowed: '2026-06-15',
    dueDate: '2026-06-30', // Paid fully
    description: 'Consulting on networking setup',
    category: 'Services',
    notes: 'Ufungaji wa mifumo ya ofisi.',
    status: 'Paid',
    createdAt: '2026-06-15'
  }
];

const INITIAL_PAYMENTS: Payment[] = [
  {
    id: 'pay-1',
    debtId: 'debt-1',
    amount: 120000,
    date: '2026-06-25',
    paymentMethod: 'M-Pesa',
    notes: 'Malipo ya kwanza, bado TSh 30,000.',
    createdAt: '2026-06-25'
  },
  {
    id: 'pay-2',
    debtId: 'debt-2',
    amount: 230000,
    date: '2026-07-01',
    paymentMethod: 'Tigo Pesa',
    notes: 'Katikati ya mwezi, bado TSh 20,000.',
    createdAt: '2026-07-01'
  },
  {
    id: 'pay-3',
    debtId: 'debt-4',
    amount: 80000,
    date: '2026-06-30',
    paymentMethod: 'Bank Transfer',
    notes: 'Malipo ya mwisho kabisa.',
    createdAt: '2026-06-30'
  }
];

const INITIAL_SUPPLIERS: Supplier[] = [
  {
    id: 'sup-1',
    name: 'Ally Said (Mshauri wa Kodi)',
    phoneNumber: '0715332211',
    amount: 300000,
    paidAmount: 100000,
    dueDate: '2026-07-20',
    notes: 'Malipo ya ushauri wa kodi ya biashara.',
    createdAt: '2026-06-10'
  },
  {
    id: 'sup-2',
    name: 'Imani Wholesalers Ltd',
    phoneNumber: '0655443322',
    amount: 850000,
    paidAmount: 850000,
    dueDate: '2026-07-01',
    notes: 'Kununua vifaa vya duka letu kuu.',
    createdAt: '2026-06-01'
  },
  {
    id: 'sup-3',
    name: 'Fresh Groceries Supply',
    phoneNumber: '0655221100',
    amount: 30000,
    paidAmount: 0,
    dueDate: '2026-07-10',
    notes: 'Kununua mboga mboga na matunda safi ya duka.',
    createdAt: '2026-07-01'
  }
];

const INITIAL_TRANSACTIONS: TransactionRecord[] = [
  {
    id: 'tx-1',
    actionType: 'Customer Created',
    description: 'Customer Jalia Hassan was registered in the database',
    timestamp: '2026-06-01T09:00:00-07:00'
  },
  {
    id: 'tx-2',
    actionType: 'Debt Added',
    description: 'Added debt of TSh 150,000 for Jalia Hassan',
    timestamp: '2026-06-10T11:30:00-07:00',
    amount: 150000
  },
  {
    id: 'tx-3',
    actionType: 'Payment Added',
    description: 'Recorded payment of TSh 120,000 from Jalia Hassan via M-Pesa',
    timestamp: '2026-06-25T14:15:00-07:00',
    amount: 120000
  }
];

const DEFAULT_SETTINGS: BusinessSettings = {
  businessName: 'Sonko Sound Accountant system',
  businessLogoUrl: 'emerald_shield',
  businessPhone: '0700000000',
  businessAddress: 'Kariakoo, Dar es Salaam',
  defaultReminderDays: 3,
  darkMode: false
};

// Date helper relative utilities
export function getDaysDiff(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  const diffTime = d1.getTime() - d2.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Database wrapper class
export class LocalDatabase {
  private static readonly KEYS = {
    CUSTOMERS: 'ledger_customers',
    DEBTS: 'ledger_debts',
    PAYMENTS: 'ledger_payments',
    SUPPLIERS: 'ledger_suppliers',
    TRANSACTIONS: 'ledger_transactions',
    SETTINGS: 'ledger_settings',
    PASSWORD: 'ledger_password_hash',
    NOT_SHOW_WELCOME: 'ledger_not_show_welcome'
  };

  static init() {
    if (!localStorage.getItem(this.KEYS.CUSTOMERS)) {
      localStorage.setItem(this.KEYS.CUSTOMERS, JSON.stringify(INITIAL_CUSTOMERS));
      localStorage.setItem(this.KEYS.DEBTS, JSON.stringify(INITIAL_DEBTS));
      localStorage.setItem(this.KEYS.PAYMENTS, JSON.stringify(INITIAL_PAYMENTS));
      localStorage.setItem(this.KEYS.SUPPLIERS, JSON.stringify(INITIAL_SUPPLIERS));
      localStorage.setItem(this.KEYS.TRANSACTIONS, JSON.stringify(INITIAL_TRANSACTIONS));
      localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
      localStorage.setItem(this.KEYS.PASSWORD, hashPassword('1234')); // Default pin: 1234
    }
  }

  // Raw Read
  static getCustomers(): Customer[] {
    this.init();
    return JSON.parse(localStorage.getItem(this.KEYS.CUSTOMERS) || '[]');
  }

  static getDebts(): Debt[] {
    this.init();
    return JSON.parse(localStorage.getItem(this.KEYS.DEBTS) || '[]');
  }

  static getPayments(): Payment[] {
    this.init();
    return JSON.parse(localStorage.getItem(this.KEYS.PAYMENTS) || '[]');
  }

  static getSuppliers(): Supplier[] {
    this.init();
    return JSON.parse(localStorage.getItem(this.KEYS.SUPPLIERS) || '[]');
  }

  static getTransactions(): TransactionRecord[] {
    this.init();
    return JSON.parse(localStorage.getItem(this.KEYS.TRANSACTIONS) || '[]');
  }

  static getSettings(): BusinessSettings {
    this.init();
    const settingsStr = localStorage.getItem(this.KEYS.SETTINGS);
    if (settingsStr) {
      const settings = JSON.parse(settingsStr);
      if (settings.businessName === 'Tanzania Ledger Pro') {
        settings.businessName = 'Sonko Sound Accountant system';
        this.saveSettings(settings);
      }
      return settings;
    }
    return DEFAULT_SETTINGS;
  }

  static getPasswordHash(): string {
    this.init();
    return localStorage.getItem(this.KEYS.PASSWORD) || hashPassword('1234');
  }

  // Raw Save
  static saveCustomers(customers: Customer[]) {
    localStorage.setItem(this.KEYS.CUSTOMERS, JSON.stringify(customers));
  }

  static saveDebts(debts: Debt[]) {
    localStorage.setItem(this.KEYS.DEBTS, JSON.stringify(debts));
  }

  static savePayments(payments: Payment[]) {
    localStorage.setItem(this.KEYS.PAYMENTS, JSON.stringify(payments));
  }

  static saveSuppliers(suppliers: Supplier[]) {
    localStorage.setItem(this.KEYS.SUPPLIERS, JSON.stringify(suppliers));
  }

  static saveTransactions(transactions: TransactionRecord[]) {
    localStorage.setItem(this.KEYS.TRANSACTIONS, JSON.stringify(transactions));
  }

  static saveSettings(settings: BusinessSettings) {
    localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(settings));
  }

  static savePassword(password: string) {
    const hashed = hashPassword(password);
    localStorage.setItem(this.KEYS.PASSWORD, hashed);
  }

  // Transaction recorder
  static logTransaction(actionType: TransactionRecord['actionType'], description: string, amount?: number) {
    const transactions = this.getTransactions();
    const newTx: TransactionRecord = {
      id: 'tx-' + Date.now(),
      actionType,
      description,
      timestamp: new Date().toISOString(),
      amount
    };
    transactions.unshift(newTx);
    // Keep transaction history bounded to 1000 items to avoid LocalStorage bloat
    if (transactions.length > 1000) {
      transactions.pop();
    }
    this.saveTransactions(transactions);
  }

  // Automatic customer level calculations
  static getCustomerStats(customerId: string, currentDate: string = '2026-07-10') {
    const debts = this.getDebts().filter(d => d.customerId === customerId);
    const payments = this.getPayments();

    let totalDebt = 0;
    let totalPaid = 0;
    let overdueCount = 0;
    let isAnyOverdue = false;

    debts.forEach(debt => {
      totalDebt += debt.amount;
      const debtPayments = payments.filter(p => p.debtId === debt.id);
      const debtPaid = debtPayments.reduce((acc, p) => acc + p.amount, 0);
      totalPaid += debtPaid;

      const remaining = debt.amount - debtPaid;
      if (remaining > 0) {
        const daysDiff = getDaysDiff(currentDate, debt.dueDate);
        if (daysDiff > 0) {
          overdueCount++;
          isAnyOverdue = true;
        }
      }
    });

    const remainingBalance = totalDebt - totalPaid;
    const percentagePaid = totalDebt > 0 ? (totalPaid / totalDebt) * 100 : 0;

    let status: CustomerStatus = 'Cleared';
    if (remainingBalance > 0) {
      status = isAnyOverdue ? 'Overdue' : 'Active';
    }

    return {
      totalDebt,
      totalPaid,
      remainingBalance,
      percentagePaid,
      status
    };
  }

  // Dynamic Debt Calculations and Status Updates
  static getUpdatedDebts(currentDate: string = '2026-07-10'): Debt[] {
    const debts = this.getDebts();
    const payments = this.getPayments();

    return debts.map(debt => {
      const debtPayments = payments.filter(p => p.debtId === debt.id);
      const paid = debtPayments.reduce((acc, p) => acc + p.amount, 0);
      const remaining = debt.amount - paid;

      let status: DebtStatus = 'Active';
      if (remaining <= 0) {
        status = 'Paid';
      } else {
        const daysDiff = getDaysDiff(currentDate, debt.dueDate); // postive means overdue, negative means remaining
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
        status
      };
    });
  }

  // Automatic Notification Generation Engine
  static getNotifications(currentDate: string = '2026-07-10'): NotificationItem[] {
    const notifications: NotificationItem[] = [];
    const customers = this.getCustomers();
    const debts = this.getDebts();
    const payments = this.getPayments();
    const suppliers = this.getSuppliers();
    
    // 1. Fully Paid Notifications & Debt status based
    debts.forEach(debt => {
      const cust = customers.find(c => c.id === debt.customerId);
      if (!cust) return;

      const debtPayments = payments.filter(p => p.debtId === debt.id);
      const paid = debtPayments.reduce((acc, p) => acc + p.amount, 0);
      const remaining = debt.amount - paid;

      if (remaining <= 0) {
        // Peter amemaliza kulipa deni lake.
        notifications.push({
          id: `notif-paid-${debt.id}`,
          type: 'Fully Paid',
          message: `🟢 ${cust.fullName} amemaliza kulipa deni lake la TSh ${debt.amount.toLocaleString()}.`,
          date: debt.dueDate,
          read: false,
          customerId: cust.id,
          debtId: debt.id
        });
      } else {
        const daysDiff = getDaysDiff(currentDate, debt.dueDate);
        if (daysDiff === 0) {
          // Jalia anatakiwa kulipa TSh 30,000 leo.
          notifications.push({
            id: `notif-today-${debt.id}`,
            type: 'Due Today',
            message: `🔴 ${cust.fullName} anatakiwa kulipa salio la TSh ${remaining.toLocaleString()} leo.`,
            date: currentDate,
            read: false,
            customerId: cust.id,
            debtId: debt.id
          });
        } else if (daysDiff === 1) {
          // John anatakiwa kulipa TSh 20,000 kesho.
          notifications.push({
            id: `notif-tomorrow-${debt.id}`,
            type: 'Due Tomorrow',
            message: `🟡 ${cust.fullName} anatakiwa kulipa salio la TSh ${remaining.toLocaleString()} kesho.`,
            date: currentDate,
            read: false,
            customerId: cust.id,
            debtId: debt.id
          });
        } else if (daysDiff > 1) {
          // Maria amechelewa kulipa kwa siku 5. Salio: TSh 120,000.
          notifications.push({
            id: `notif-overdue-${debt.id}`,
            type: 'Overdue',
            message: `🔴 ${cust.fullName} amechelewa kulipa kwa siku ${daysDiff}. Salio: TSh ${remaining.toLocaleString()}.`,
            date: currentDate,
            read: false,
            customerId: cust.id,
            debtId: debt.id
          });
        } else if (daysDiff < 0 && daysDiff >= -3) {
          // Upcoming
          notifications.push({
            id: `notif-upcoming-${debt.id}`,
            type: 'Upcoming',
            message: `🔵 Deni la ${cust.fullName} la TSh ${remaining.toLocaleString()} litakuwa hivi karibuni (siku ${Math.abs(daysDiff)} zilizobaki).`,
            date: currentDate,
            read: false,
            customerId: cust.id,
            debtId: debt.id
          });
        }
      }
    });

    // 1b. Supplier Reminders (Malipo kwa wauzaji/creditors)
    suppliers.forEach(supplier => {
      const remaining = supplier.amount - supplier.paidAmount;
      if (remaining <= 0) {
        notifications.push({
          id: `notif-supplier-paid-${supplier.id}`,
          type: 'Fully Paid',
          message: `🟢 Umekamilisha malipo yote kwa muuzaji ${supplier.name} ya TSh ${supplier.amount.toLocaleString()}.`,
          date: supplier.dueDate,
          read: false
        });
      } else {
        const daysDiff = getDaysDiff(currentDate, supplier.dueDate);
        if (daysDiff === 0) {
          notifications.push({
            id: `notif-supplier-today-${supplier.id}`,
            type: 'Due Today',
            message: `📦 ${supplier.name} anastahili kulipwa TSh ${remaining.toLocaleString()} leo.`,
            date: currentDate,
            read: false
          });
        } else if (daysDiff === 1) {
          notifications.push({
            id: `notif-supplier-tomorrow-${supplier.id}`,
            type: 'Due Tomorrow',
            message: `🟡 ${supplier.name} anastahili kulipwa TSh ${remaining.toLocaleString()} kesho.`,
            date: currentDate,
            read: false
          });
        } else if (daysDiff > 1) {
          notifications.push({
            id: `notif-supplier-overdue-${supplier.id}`,
            type: 'Overdue',
            message: `⚠️ Malipo ya ${supplier.name} ya TSh ${remaining.toLocaleString()} yamechelewa kwa siku ${daysDiff}.`,
            date: currentDate,
            read: false
          });
        } else if (daysDiff < 0 && daysDiff >= -3) {
          notifications.push({
            id: `notif-supplier-upcoming-${supplier.id}`,
            type: 'Upcoming',
            message: `📅 Malipo ya ${supplier.name} ya TSh ${remaining.toLocaleString()} yatakuwa tarehe ${supplier.dueDate} (${Math.abs(daysDiff)} siku zilizobaki).`,
            date: currentDate,
            read: false
          });
        }
      }
    });

    // 2. Add New Customer, Payment Received, Debt Added from Transaction logs
    const transactions = this.getTransactions();
    transactions.forEach((tx, i) => {
      if (tx.actionType === 'Customer Created') {
        notifications.push({
          id: `notif-tx-cust-${tx.id}`,
          type: 'New Customer Added',
          message: `👤 ${tx.description}`,
          date: tx.timestamp.split('T')[0],
          read: true
        });
      } else if (tx.actionType === 'Payment Added') {
        notifications.push({
          id: `notif-tx-pay-${tx.id}`,
          type: 'Payment Received',
          message: `💰 ${tx.description}`,
          date: tx.timestamp.split('T')[0],
          read: true
        });
      } else if (tx.actionType === 'Debt Added') {
        notifications.push({
          id: `notif-tx-debt-${tx.id}`,
          type: 'Debt Added',
          message: `📝 ${tx.description}`,
          date: tx.timestamp.split('T')[0],
          read: true
        });
      }
    });

    // Remove duplicates by message to keep notices elegant
    const seen = new Set<string>();
    return notifications.filter(item => {
      const k = item.message;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  // Backup and Restore (Direct JSON Export/Import files)
  static exportDatabase(): string {
    const data = {
      customers: this.getCustomers(),
      debts: this.getDebts(),
      payments: this.getPayments(),
      suppliers: this.getSuppliers(),
      transactions: this.getTransactions(),
      settings: this.getSettings(),
      passwordHash: this.getPasswordHash()
    };
    return JSON.stringify(data, null, 2);
  }

  static restoreDatabase(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.customers && parsed.debts && parsed.payments) {
        localStorage.setItem(this.KEYS.CUSTOMERS, JSON.stringify(parsed.customers));
        localStorage.setItem(this.KEYS.DEBTS, JSON.stringify(parsed.debts));
        localStorage.setItem(this.KEYS.PAYMENTS, JSON.stringify(parsed.payments));
        if (parsed.suppliers) localStorage.setItem(this.KEYS.SUPPLIERS, JSON.stringify(parsed.suppliers));
        if (parsed.transactions) localStorage.setItem(this.KEYS.TRANSACTIONS, JSON.stringify(parsed.transactions));
        if (parsed.settings) localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(parsed.settings));
        if (parsed.passwordHash) localStorage.setItem(this.KEYS.PASSWORD, parsed.passwordHash);
        this.logTransaction('Customer Created', 'Database restored successfully from local backup file');
        return true;
      }
      return false;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  static resetDatabase() {
    localStorage.removeItem(this.KEYS.CUSTOMERS);
    localStorage.removeItem(this.KEYS.DEBTS);
    localStorage.removeItem(this.KEYS.PAYMENTS);
    localStorage.removeItem(this.KEYS.SUPPLIERS);
    localStorage.removeItem(this.KEYS.TRANSACTIONS);
    localStorage.removeItem(this.KEYS.SETTINGS);
    localStorage.removeItem(this.KEYS.PASSWORD);
    this.init();
  }
}
