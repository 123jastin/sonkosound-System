/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { Customer, Debt, Payment, Supplier } from '../types';
import { LocalDatabase, getDaysDiff } from '../db';
import { 
  FileText, Download, Printer, ArrowRight, Search, 
  TrendingUp, TrendingDown, Clock, ShieldAlert, CheckSquare, 
  FileSpreadsheet, FileCode
} from 'lucide-react';

interface ReportsViewProps {
  customers: Customer[];
  debts: Debt[];
  payments: Payment[];
  suppliers: Supplier[];
}

type ReportType = 'CustomersOwe' | 'SuppliersOwe' | 'Collected' | 'Overdue' | 'MonthlySummary';

export default function ReportsView({
  customers,
  debts,
  payments,
  suppliers
}: ReportsViewProps) {
  const [activeReport, setActiveReport] = useState<ReportType>('CustomersOwe');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Calculate general figures
  const summaryStats = useMemo(() => {
    const currentDate = '2026-07-10';
    
    let totalCustomersOwe = 0;
    const customerDebtsList: any[] = [];
    
    debts.forEach(debt => {
      const dPayments = payments.filter(p => p.debtId === debt.id);
      const paid = dPayments.reduce((acc, p) => acc + p.amount, 0);
      const remaining = debt.amount - paid;
      const customer = customers.find(c => c.id === debt.customerId);

      if (remaining > 0) {
        totalCustomersOwe += remaining;
      }

      customerDebtsList.push({
        id: debt.id,
        customerName: customer ? customer.fullName : 'Mteja Asiyejulikana',
        phone: customer ? customer.phoneNumber : '',
        description: debt.description,
        amount: debt.amount,
        paid,
        remaining,
        dueDate: debt.dueDate,
        isOverdue: getDaysDiff(currentDate, debt.dueDate) > 0 && remaining > 0,
        daysOverdue: Math.max(0, getDaysDiff(currentDate, debt.dueDate))
      });
    });

    let totalIOWeSuppliers = 0;
    suppliers.forEach(s => {
      totalIOWeSuppliers += Math.max(0, s.amount - s.paidAmount);
    });

    const totalCollectedThisMonth = payments
      .filter(p => p.date.startsWith('2026-07'))
      .reduce((s, p) => s + p.amount, 0);

    return {
      totalCustomersOwe,
      totalIOWeSuppliers,
      totalCollectedThisMonth,
      customerDebtsList
    };
  }, [customers, debts, payments, suppliers]);

  // 2. Generate active report list
  const reportData = useMemo(() => {
    switch (activeReport) {
      case 'CustomersOwe':
        return summaryStats.customerDebtsList
          .filter(d => d.remaining > 0)
          .map(d => ({
            'Jina la Mteja': d.customerName,
            'Simu': d.phone,
            'Maelezo ya Bidhaa': d.description,
            'Tarehe ya Ukomo': d.dueDate,
            'Kiasi Kamili (TSh)': d.amount,
            'Kiasi Kilicholipwa (TSh)': d.paid,
            'Kiasi Kilichobaki (TSh)': d.remaining,
            'Hali': d.isOverdue ? `Overdue (siku ${d.daysOverdue})` : 'Active'
          }));

      case 'SuppliersOwe':
        return suppliers
          .map(s => {
            const rem = s.amount - s.paidAmount;
            return {
              'Mkopeshaji/Muuzaji': s.name,
              'Simu': s.phoneNumber,
              'Tarehe ya Ukomo': s.dueDate,
              'Kiasi Kamili (TSh)': s.amount,
              'Kiasi Kilicholipwa (TSh)': s.paidAmount,
              'Kiasi Kilichobaki (TSh)': rem,
              'Notes': s.notes || ''
            };
          })
          .filter(s => s['Kiasi Kilichobaki (TSh)'] > 0);

      case 'Collected':
        return payments.map(p => {
          const debt = debts.find(d => d.id === p.debtId);
          const cust = debt ? customers.find(c => c.id === debt.customerId) : null;
          return {
            'Tarehe': p.date,
            'Mteja': cust ? cust.fullName : 'Mteja',
            'Deni / Bidhaa': debt ? debt.description : '',
            'Njia ya Malipo': p.paymentMethod,
            'Notes za Risiti': p.notes || '',
            'Kiasi Kilichopokelewa (TSh)': p.amount
          };
        }).sort((a, b) => b['Tarehe'].localeCompare(a['Tarehe']));

      case 'Overdue':
        return summaryStats.customerDebtsList
          .filter(d => d.isOverdue)
          .map(d => ({
            'Mteja': d.customerName,
            'Simu': d.phone,
            'Bidhaa': d.description,
            'Kiasi Kilichobaki (TSh)': d.remaining,
            'Tarehe ya Ukomo': d.dueDate,
            'Siku Zilizochelewa': d.daysOverdue
          }));

      case 'MonthlySummary':
        // Collection by category
        const cats: { [key: string]: number } = {};
        debts.forEach(d => {
          const dPays = payments.filter(p => p.debtId === d.id);
          const pd = dPays.reduce((acc, x) => acc + x.amount, 0);
          cats[d.category] = (cats[d.category] || 0) + pd;
        });
        return Object.keys(cats).map(cat => ({
          'Jamii ya Bidhaa (Category)': cat,
          'Jumla ya Fedha Zilizopokelewa (TSh)': cats[cat]
        }));

      default:
        return [];
    }
  }, [activeReport, summaryStats, payments, debts, customers, suppliers]);

  // 3. Search filter inside active report
  const filteredReportData = useMemo(() => {
    if (!searchQuery) return reportData;
    return reportData.filter((row: any) => {
      return Object.values(row).some(val => 
        val !== null && val !== undefined && 
        val.toString().toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [reportData, searchQuery]);

  // 4. Exporters
  const exportToCSV = () => {
    if (filteredReportData.length === 0) return;
    
    // Add UTF-8 BOM for Microsoft Excel compatibility
    let csvContent = '\uFEFF';
    
    // Header
    const headers = Object.keys(filteredReportData[0]);
    csvContent += headers.join(',') + '\n';

    // Rows
    filteredReportData.forEach((row: any) => {
      const values = headers.map(header => {
        const val = row[header];
        // Escape quotes and commas
        if (typeof val === 'string') {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      });
      csvContent += values.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Ledger_Ripoti_${activeReport}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const exportToExcel = () => {
    if (filteredReportData.length === 0) return;
    
    // Simple Excel-compatible XML format with tabs instead of commas
    let tsvContent = '\uFEFF';
    const headers = Object.keys(filteredReportData[0]);
    tsvContent += headers.join('\t') + '\n';

    filteredReportData.forEach((row: any) => {
      const values = headers.map(header => row[header]);
      tsvContent += values.join('\t') + '\n';
    });

    const blob = new Blob([tsvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Ledger_Ripoti_${activeReport}_${new Date().toISOString().split('T')[0]}.xls`;
    link.click();
  };

  return (
    <div className="space-y-6">
      
      {/* KPI stats at top of reports */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
        
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <span className="p-3 bg-rose-50 text-rose-600 rounded-2xl"><TrendingUp size={22} /></span>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Wateja Wananidai</p>
            <h4 className="text-sm font-black text-slate-800 mt-1">TSh {summaryStats.totalCustomersOwe.toLocaleString()}</h4>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <span className="p-3 bg-amber-50 text-amber-600 rounded-2xl"><TrendingDown size={22} /></span>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Ninazodaiwa (Others)</p>
            <h4 className="text-sm font-black text-slate-800 mt-1">TSh {summaryStats.totalIOWeSuppliers.toLocaleString()}</h4>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <span className="p-3 bg-success/10 text-success rounded-2xl"><CheckSquare size={22} /></span>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Makusanyo (Mwezi Huu)</p>
            <h4 className="text-sm font-black text-slate-800 mt-1">TSh {summaryStats.totalCollectedThisMonth.toLocaleString()}</h4>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <span className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><Clock size={22} /></span>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Outstanding Net</p>
            <h4 className="text-sm font-black text-indigo-700 mt-1">TSh {(summaryStats.totalCustomersOwe - summaryStats.totalIOWeSuppliers).toLocaleString()}</h4>
          </div>
        </div>

      </div>

      {/* Reports workspace layout */}
      <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-6">
        
        {/* Templates controls tabs */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between border-b border-slate-50 pb-4 gap-4">
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => { setActiveReport('CustomersOwe'); setSearchQuery(''); }}
              className={`px-4 py-2 text-xs font-semibold rounded-xl transition whitespace-nowrap ${
                activeReport === 'CustomersOwe' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
              }`}
            >
              Ninazodai (Receivables)
            </button>
            <button
              onClick={() => { setActiveReport('SuppliersOwe'); setSearchQuery(''); }}
              className={`px-4 py-2 text-xs font-semibold rounded-xl transition whitespace-nowrap ${
                activeReport === 'SuppliersOwe' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
              }`}
            >
              Wauzaji ninaowadaiwa (Payables)
            </button>
            <button
              onClick={() => { setActiveReport('Collected'); setSearchQuery(''); }}
              className={`px-4 py-2 text-xs font-semibold rounded-xl transition whitespace-nowrap ${
                activeReport === 'Collected' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
              }`}
            >
              Historia ya Makusanyo (Collected)
            </button>
            <button
              onClick={() => { setActiveReport('Overdue'); setSearchQuery(''); }}
              className={`px-4 py-2 text-xs font-semibold rounded-xl transition whitespace-nowrap ${
                activeReport === 'Overdue' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
              }`}
            >
              Madeni Sugu (Overdue)
            </button>
            <button
              onClick={() => { setActiveReport('MonthlySummary'); setSearchQuery(''); }}
              className={`px-4 py-2 text-xs font-semibold rounded-xl transition whitespace-nowrap ${
                activeReport === 'MonthlySummary' ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
              }`}
            >
              Muhtasari wa Makundi (Category Summary)
            </button>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={exportToExcel}
              className="px-3.5 py-2 bg-success/10 hover:bg-success/20 text-success font-semibold text-xs rounded-xl flex items-center gap-1.5 transition"
              title="Pakua ripoti kama Excel"
            >
              <FileSpreadsheet size={15} /> Excel
            </button>
            <button
              onClick={exportToCSV}
              className="px-3.5 py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition"
              title="Pakua kama CSV"
            >
              <FileCode size={15} /> CSV
            </button>
            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition"
              title="Print"
            >
              <Printer size={15} /> Print
            </button>
          </div>
        </div>

        {/* Local Search input */}
        <div className="relative max-w-md print:hidden">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
            <Search size={16} />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Kuchuja data iliyotolewa kwenye ripoti..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs focus:bg-white focus:ring-accent"
          />
        </div>

        {/* Live reports renderer table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-50">
          <table className="w-full text-left border-collapse text-xs text-slate-600">
            <thead>
              {filteredReportData.length > 0 && (
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
                  {Object.keys(filteredReportData[0]).map(header => (
                    <th key={header} className="py-3.5 px-5">{header}</th>
                  ))}
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReportData.length > 0 ? (
                filteredReportData.map((row: any, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/30 transition">
                    {Object.keys(row).map(header => {
                      const val = row[header];
                      return (
                        <td key={header} className="py-3.5 px-5 font-medium text-slate-700">
                          {typeof val === 'number' ? `TSh ${val.toLocaleString()}` : val}
                        </td>
                      );
                    })}
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="py-12 text-center text-slate-400">
                    <FileText size={32} className="mx-auto text-slate-200 mb-2" />
                    <p className="text-xs">Hakuna ripoti au kumbukumbu zilizowekwa hapa.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
}
