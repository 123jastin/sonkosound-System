import { useState, useEffect, useMemo, useRef } from 'react';
import { Customer, BusinessSettings } from '../types';
import {
  FileText, Plus, Search, Printer, MessageCircle, Trash2, Copy, Edit3,
  ArrowLeft, Save, Send, Ban, CheckCircle2, Wallet, X, Clock,
  AlertTriangle, TrendingUp, Receipt, Loader2
} from 'lucide-react';

// ============================================
// TYPES
// ============================================
type BaseStatus = 'Draft' | 'Sent' | 'Cancelled';
type DisplayStatus = 'Draft' | 'Sent' | 'Partial' | 'Paid' | 'Overdue' | 'Cancelled';

interface InvoiceItem {
  id: string;
  description: string;
  qty: number;
  unitPrice: number;
}

interface InvoicePayment {
  id: string;
  amount: number;
  date: string;
  method: string;
  notes: string;
}

interface InvoiceData {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  issueDate: string;
  dueDate: string;
  items: InvoiceItem[];
  discountType: 'amount' | 'percent';
  discount: number;
  taxRate: number;
  notes: string;
  terms: string;
  payments: InvoicePayment[];
  status: BaseStatus;
  createdAt: string;
  createdBy: string;
}

interface InvoiceProps {
  userRole?: 'admin' | 'staff' | 'cashier' | null;
  customers?: Customer[];
  settings?: BusinessSettings | null;
}

// ============================================
// CONSTANTS & HELPERS
// ============================================
const STORAGE_KEY = 'ledger_invoices';
const PAYMENT_METHODS = ['Cash', 'M-Pesa', 'Tigo Pesa', 'Airtel Money', 'Halopesa', 'Benki (Bank)', 'Nyingine'];
const DEFAULT_TERMS = 'Malipo yafanyike ndani ya muda uliowekwa. Bidhaa zilizouzwa hazirudishwi baada ya siku 7.';

const STATUS_META: Record<DisplayStatus, { label: string; badge: string; color: string }> = {
  Draft:     { label: 'Rasimu',          badge: 'bg-slate-100 text-slate-600 border-slate-200',     color: '#64748b' },
  Sent:      { label: 'Imetumwa',        badge: 'bg-sky-50 text-sky-700 border-sky-200',            color: '#0284c7' },
  Partial:   { label: 'Imelipwa Sehemu', badge: 'bg-amber-50 text-amber-700 border-amber-200',      color: '#d97706' },
  Paid:      { label: 'Imelipwa',        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', color: '#059669' },
  Overdue:   { label: 'Imechelewa',      badge: 'bg-rose-50 text-rose-700 border-rose-200',         color: '#e11d48' },
  Cancelled: { label: 'Imefutwa',        badge: 'bg-slate-100 text-slate-400 border-slate-200',     color: '#94a3b8' },
};

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const todayStr = () => new Date().toISOString().split('T')[0];
const addDays = (date: string, days: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};
const money = (n: number) => `TSh ${Math.round(n || 0).toLocaleString('en-US')}`;
const fmtDate = (s: string) => {
  if (!s) return '-';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};
const esc = (s: any) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function computeTotals(inv: Pick<InvoiceData, 'items' | 'discountType' | 'discount' | 'taxRate' | 'payments'>) {
  const subtotal = inv.items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unitPrice) || 0), 0);
  const rawDiscount = inv.discountType === 'percent'
    ? (subtotal * (Number(inv.discount) || 0)) / 100
    : Number(inv.discount) || 0;
  const discountAmt = Math.min(Math.max(rawDiscount, 0), subtotal);
  const taxable = subtotal - discountAmt;
  const tax = (taxable * (Number(inv.taxRate) || 0)) / 100;
  const total = Math.round(taxable + tax);
  const paid = inv.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const balance = Math.max(0, total - paid);
  return { subtotal, discountAmt, taxable, tax, total, paid, balance };
}

function getDisplayStatus(inv: InvoiceData): DisplayStatus {
  if (inv.status === 'Cancelled') return 'Cancelled';
  if (inv.status === 'Draft') return 'Draft';
  const { total, paid, balance } = computeTotals(inv);
  if (total > 0 && paid >= total) return 'Paid';
  if (balance > 0 && inv.dueDate && inv.dueDate < todayStr()) return 'Overdue';
  if (paid > 0) return 'Partial';
  return 'Sent';
}

function generateInvoiceNumber(existing: InvoiceData[]): string {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const nums = existing
    .filter(i => i.number.startsWith(prefix))
    .map(i => parseInt(i.number.replace(prefix, ''), 10))
    .filter(n => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
}

function emptyInvoice(existing: InvoiceData[], role: string): InvoiceData {
  const issue = todayStr();
  return {
    id: uid(),
    number: generateInvoiceNumber(existing),
    customerId: '',
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    issueDate: issue,
    dueDate: addDays(issue, 14),
    items: [{ id: uid(), description: '', qty: 1, unitPrice: 0 }],
    discountType: 'amount',
    discount: 0,
    taxRate: 0,
    notes: '',
    terms: DEFAULT_TERMS,
    payments: [],
    status: 'Draft',
    createdAt: new Date().toISOString(),
    createdBy: role,
  };
}

function normalizePhone(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('255')) return digits;
  if (digits.startsWith('0')) return '255' + digits.slice(1);
  return digits;
}

// ============================================
// PRINTABLE / PREVIEW HTML (single source for preview + print)
// ============================================
function buildInvoiceHtml(
  inv: InvoiceData,
  biz: { name: string; address: string; phone: string }
): string {
  const t = computeTotals(inv);
  const status = getDisplayStatus(inv);
  const meta = STATUS_META[status];

  const itemRows = inv.items
    .filter(i => i.description.trim() || i.unitPrice)
    .map((i, idx) => `
      <tr>
        <td class="c">${idx + 1}</td>
        <td>${esc(i.description)}</td>
        <td class="r">${Number(i.qty).toLocaleString('en-US')}</td>
        <td class="r">${Math.round(i.unitPrice).toLocaleString('en-US')}</td>
        <td class="r b">${Math.round(i.qty * i.unitPrice).toLocaleString('en-US')}</td>
      </tr>`).join('');

  const paymentRows = inv.payments.map(p => `
      <tr>
        <td>${esc(fmtDate(p.date))}</td>
        <td>${esc(p.method)}</td>
        <td>${esc(p.notes)}</td>
        <td class="r b">${Math.round(p.amount).toLocaleString('en-US')}</td>
      </tr>`).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${esc(inv.number)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; color: #0f172a; margin: 0; padding: 0; background: #fff; font-size: 13px; }
  .page { max-width: 794px; margin: 0 auto; padding: 36px 40px; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 4px solid #0284c7; padding-bottom: 18px; }
  .biz h1 { margin: 0 0 4px; font-size: 22px; color: #0c4a6e; letter-spacing: .3px; }
  .biz p { margin: 2px 0; color: #475569; font-size: 12px; }
  .title { text-align: right; }
  .title h2 { margin: 0; font-size: 32px; letter-spacing: 4px; color: #0284c7; font-weight: 800; }
  .title .num { font-size: 13px; font-weight: 700; margin-top: 4px; color: #0f172a; }
  .stamp { display: inline-block; margin-top: 8px; padding: 3px 12px; border: 2px solid ${meta.color}; color: ${meta.color}; border-radius: 6px; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
  .info { display: flex; justify-content: space-between; gap: 24px; margin: 24px 0; }
  .box { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; }
  .box h4 { margin: 0 0 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; }
  .box .name { font-size: 15px; font-weight: 700; margin-bottom: 3px; }
  .box p { margin: 2px 0; color: #475569; font-size: 12px; }
  .meta-row { display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0; }
  .meta-row span:first-child { color: #64748b; }
  .meta-row span:last-child { font-weight: 700; }
  table { width: 100%; border-collapse: collapse; }
  table.items thead th { background: #0c4a6e; color: #fff; padding: 10px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: .8px; text-align: left; }
  table.items tbody td { padding: 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  table.items tbody tr:nth-child(even) td { background: #f8fafc; }
  .r { text-align: right; } .c { text-align: center; width: 36px; } .b { font-weight: 700; }
  .totals { display: flex; justify-content: flex-end; margin-top: 18px; }
  .totals table { width: 300px; }
  .totals td { padding: 6px 10px; font-size: 13px; }
  .totals tr.grand td { background: #0284c7; color: #fff; font-weight: 800; font-size: 15px; }
  .totals tr.paid td { color: #059669; font-weight: 700; }
  .totals tr.bal td { font-weight: 800; font-size: 14px; border-top: 2px solid #0f172a; color: ${t.balance > 0 ? '#e11d48' : '#059669'}; }
  h3.sec { font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; margin: 26px 0 8px; }
  table.pay th { text-align: left; font-size: 10px; text-transform: uppercase; color: #64748b; padding: 6px 8px; border-bottom: 2px solid #e2e8f0; }
  table.pay td { padding: 7px 8px; border-bottom: 1px solid #f1f5f9; font-size: 12px; }
  .note { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 10px 14px; border-radius: 6px; font-size: 12px; color: #78350f; white-space: pre-wrap; }
  .terms { font-size: 11px; color: #64748b; white-space: pre-wrap; }
  .sign { display: flex; justify-content: space-between; margin-top: 54px; gap: 40px; }
  .sign div { flex: 1; border-top: 1px solid #94a3b8; padding-top: 6px; text-align: center; font-size: 11px; color: #64748b; }
  .foot { margin-top: 30px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px dashed #cbd5e1; padding-top: 12px; }
</style></head>
<body><div class="page">
  <div class="top">
    <div class="biz">
      <h1>${esc(biz.name)}</h1>
      ${biz.address ? `<p>${esc(biz.address)}</p>` : ''}
      ${biz.phone ? `<p>Simu: ${esc(biz.phone)}</p>` : ''}
    </div>
    <div class="title">
      <h2>INVOICE</h2>
      <div class="num"># ${esc(inv.number)}</div>
      <div class="stamp">${esc(meta.label)}</div>
    </div>
  </div>

  <div class="info">
    <div class="box">
      <h4>Mteja (Bill To)</h4>
      <div class="name">${esc(inv.customerName || '-')}</div>
      ${inv.customerPhone ? `<p>Simu: ${esc(inv.customerPhone)}</p>` : ''}
      ${inv.customerAddress ? `<p>${esc(inv.customerAddress)}</p>` : ''}
    </div>
    <div class="box">
      <h4>Maelezo ya Invoice</h4>
      <div class="meta-row"><span>Tarehe ya Kutoa</span><span>${esc(fmtDate(inv.issueDate))}</span></div>
      <div class="meta-row"><span>Mwisho wa Malipo</span><span>${esc(fmtDate(inv.dueDate))}</span></div>
      <div class="meta-row"><span>Jumla Kuu</span><span>${esc(money(t.total))}</span></div>
      <div class="meta-row"><span>Kinachodaiwa</span><span style="color:${t.balance > 0 ? '#e11d48' : '#059669'}">${esc(money(t.balance))}</span></div>
    </div>
  </div>

  <table class="items">
    <thead><tr><th class="c">#</th><th>Maelezo ya Bidhaa/Huduma</th><th class="r">Idadi</th><th class="r">Bei (TSh)</th><th class="r">Jumla (TSh)</th></tr></thead>
    <tbody>${itemRows || '<tr><td colspan="5" class="c">Hakuna bidhaa</td></tr>'}</tbody>
  </table>

  <div class="totals"><table>
    <tr><td>Jumla Ndogo</td><td class="r">${Math.round(t.subtotal).toLocaleString('en-US')}</td></tr>
    ${t.discountAmt > 0 ? `<tr><td>Punguzo${inv.discountType === 'percent' ? ` (${inv.discount}%)` : ''}</td><td class="r">- ${Math.round(t.discountAmt).toLocaleString('en-US')}</td></tr>` : ''}
    ${inv.taxRate > 0 ? `<tr><td>VAT (${inv.taxRate}%)</td><td class="r">${Math.round(t.tax).toLocaleString('en-US')}</td></tr>` : ''}
    <tr class="grand"><td>JUMLA KUU</td><td class="r">${esc(money(t.total))}</td></tr>
    ${t.paid > 0 ? `<tr class="paid"><td>Kimelipwa</td><td class="r">- ${Math.round(t.paid).toLocaleString('en-US')}</td></tr>` : ''}
    <tr class="bal"><td>KINACHODAIWA</td><td class="r">${esc(money(t.balance))}</td></tr>
  </table></div>

  ${inv.payments.length ? `
  <h3 class="sec">Historia ya Malipo</h3>
  <table class="pay"><thead><tr><th>Tarehe</th><th>Njia</th><th>Maelezo</th><th class="r">Kiasi (TSh)</th></tr></thead><tbody>${paymentRows}</tbody></table>` : ''}

  ${inv.notes.trim() ? `<h3 class="sec">Maelezo</h3><div class="note">${esc(inv.notes)}</div>` : ''}
  ${inv.terms.trim() ? `<h3 class="sec">Masharti</h3><div class="terms">${esc(inv.terms)}</div>` : ''}

  <div class="sign"><div>Sahihi ya Muuzaji</div><div>Sahihi ya Mteja</div></div>
  <div class="foot">Asante kwa kufanya biashara nasi! • ${esc(biz.name)}${biz.phone ? ' • ' + esc(biz.phone) : ''}</div>
</div></body></html>`;
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function Invoice({ userRole, customers = [], settings }: InvoiceProps) {
  const isAdmin = userRole === 'admin';
  const role = userRole || 'staff';

  const [invoices, setInvoices] = useState<InvoiceData[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [view, setView] = useState<'list' | 'form' | 'detail'>('list');
  const [draft, setDraft] = useState<InvoiceData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | DisplayStatus>('All');

  // payment modal
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(todayStr());
  const [payMethod, setPayMethod] = useState('Cash');
  const [payNotes, setPayNotes] = useState('');
  const [payError, setPayError] = useState<string | null>(null);

  const [iframeH, setIframeH] = useState(900);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const biz = useMemo(() => ({
    name: settings?.businessName || 'Sonko Sound',
    address: settings?.businessAddress || '',
    phone: settings?.businessPhone || '',
  }), [settings]);

  // persist
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices));
    } catch (e) {
      console.error('Failed to save invoices:', e);
    }
  }, [invoices]);

  const activeInvoice = useMemo(
    () => invoices.find(i => i.id === activeId) || null,
    [invoices, activeId]
  );

  // ---------- stats ----------
  const stats = useMemo(() => {
    let invoiced = 0, paid = 0, outstanding = 0, overdueCount = 0;
    invoices.forEach(inv => {
      const st = getDisplayStatus(inv);
      if (st === 'Draft' || st === 'Cancelled') return;
      const t = computeTotals(inv);
      invoiced += t.total;
      paid += Math.min(t.paid, t.total);
      outstanding += t.balance;
      if (st === 'Overdue') overdueCount++;
    });
    return { invoiced, paid, outstanding, overdueCount };
  }, [invoices]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices
      .filter(inv => {
        const st = getDisplayStatus(inv);
        if (statusFilter !== 'All' && st !== statusFilter) return false;
        if (!q) return true;
        return inv.number.toLowerCase().includes(q) ||
               inv.customerName.toLowerCase().includes(q) ||
               inv.customerPhone.toLowerCase().includes(q);
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [invoices, search, statusFilter]);

  // ---------- actions ----------
  const startNew = () => {
    setDraft(emptyInvoice(invoices, role));
    setIsEditing(false);
    setFormError(null);
    setView('form');
  };

  const startEdit = (inv: InvoiceData) => {
    setDraft(JSON.parse(JSON.stringify(inv)));
    setIsEditing(true);
    setFormError(null);
    setView('form');
  };

  const openDetail = (id: string) => {
    setActiveId(id);
    setView('detail');
  };

  const updateDraft = (patch: Partial<InvoiceData>) =>
    setDraft(d => (d ? { ...d, ...patch } : d));

  const updateItem = (id: string, patch: Partial<InvoiceItem>) =>
    setDraft(d => d ? { ...d, items: d.items.map(i => (i.id === id ? { ...i, ...patch } : i)) } : d);

  const addItem = () =>
    setDraft(d => d ? { ...d, items: [...d.items, { id: uid(), description: '', qty: 1, unitPrice: 0 }] } : d);

  const removeItem = (id: string) =>
    setDraft(d => d && d.items.length > 1 ? { ...d, items: d.items.filter(i => i.id !== id) } : d);

  const pickCustomer = (id: string) => {
    const c = customers.find(x => x.id === id);
    if (!c) {
      updateDraft({ customerId: '' });
      return;
    }
    updateDraft({
      customerId: c.id,
      customerName: c.fullName,
      customerPhone: c.phoneNumber || '',
      customerAddress: c.address || '',
    });
  };

  const saveDraft = (status: BaseStatus) => {
    if (!draft) return;
    if (!draft.customerName.trim()) {
      setFormError('Weka jina la mteja.');
      return;
    }
    const validItems = draft.items.filter(i => i.description.trim() && Number(i.qty) > 0 && Number(i.unitPrice) >= 0);
    if (validItems.length === 0) {
      setFormError('Weka angalau bidhaa moja yenye maelezo, idadi na bei.');
      return;
    }
    if (draft.dueDate && draft.dueDate < draft.issueDate) {
      setFormError('Tarehe ya mwisho haiwezi kuwa kabla ya tarehe ya kutoa.');
      return;
    }
    const finalInv: InvoiceData = {
      ...draft,
      items: validItems,
      status: isEditing && draft.status === 'Cancelled' ? 'Cancelled' : status,
    };
    setInvoices(prev =>
      isEditing ? prev.map(i => (i.id === finalInv.id ? finalInv : i)) : [finalInv, ...prev]
    );
    setActiveId(finalInv.id);
    setDraft(null);
    setFormError(null);
    setView('detail');
  };

  const setBaseStatus = (id: string, status: BaseStatus) =>
    setInvoices(prev => prev.map(i => (i.id === id ? { ...i, status } : i)));

  const duplicateInvoice = (inv: InvoiceData) => {
    const issue = todayStr();
    const copy: InvoiceData = {
      ...JSON.parse(JSON.stringify(inv)),
      id: uid(),
      number: generateInvoiceNumber(invoices),
      issueDate: issue,
      dueDate: addDays(issue, 14),
      payments: [],
      status: 'Draft',
      createdAt: new Date().toISOString(),
      createdBy: role,
      items: inv.items.map(i => ({ ...i, id: uid() })),
    };
    setInvoices(prev => [copy, ...prev]);
    setActiveId(copy.id);
    setView('detail');
  };

  const deleteInvoice = (inv: InvoiceData) => {
    if (!isAdmin) return;
    if (!window.confirm(`Futa kabisa invoice ${inv.number}? Hatua hii haiwezi kurudishwa.`)) return;
    setInvoices(prev => prev.filter(i => i.id !== inv.id));
    setActiveId(null);
    setView('list');
  };

  const openPayModal = (inv: InvoiceData) => {
    const t = computeTotals(inv);
    setPayAmount(String(t.balance || ''));
    setPayDate(todayStr());
    setPayMethod('Cash');
    setPayNotes('');
    setPayError(null);
    setPayOpen(true);
  };

  const submitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeInvoice) return;
    const amt = Number(payAmount);
    const t = computeTotals(activeInvoice);
    if (!amt || amt <= 0) { setPayError('Weka kiasi sahihi.'); return; }
    if (amt > t.balance) { setPayError(`Kiasi kimezidi deni lililobaki (${money(t.balance)}).`); return; }
    const payment: InvoicePayment = { id: uid(), amount: amt, date: payDate, method: payMethod, notes: payNotes.trim() };
    setInvoices(prev => prev.map(i =>
      i.id === activeInvoice.id
        ? { ...i, payments: [...i.payments, payment], status: i.status === 'Draft' ? 'Sent' : i.status }
        : i
    ));
    setPayOpen(false);
  };

  const removePayment = (invId: string, payId: string) => {
    if (!isAdmin) return;
    if (!window.confirm('Futa malipo haya?')) return;
    setInvoices(prev => prev.map(i =>
      i.id === invId ? { ...i, payments: i.payments.filter(p => p.id !== payId) } : i
    ));
  };

  const handlePrint = () => {
    const win = iframeRef.current?.contentWindow;
    if (win) {
      win.focus();
      win.print();
    }
  };

  const handleWhatsApp = (inv: InvoiceData) => {
    const t = computeTotals(inv);
    const phone = normalizePhone(inv.customerPhone);
    const lines = [
      `*INVOICE ${inv.number}*`,
      `${biz.name}`,
      ``,
      `Habari ${inv.customerName},`,
      `Hii ni invoice yako:`,
      ...inv.items.map(i => `• ${i.description} x${i.qty} = ${money(i.qty * i.unitPrice)}`),
      ``,
      `*Jumla Kuu:* ${money(t.total)}`,
      t.paid > 0 ? `*Kimelipwa:* ${money(t.paid)}` : '',
      `*Kinachodaiwa:* ${money(t.balance)}`,
      inv.dueDate ? `*Mwisho wa malipo:* ${fmtDate(inv.dueDate)}` : '',
      ``,
      `Asante kwa kufanya biashara nasi.`,
      biz.phone ? `📞 ${biz.phone}` : '',
    ].filter((l, idx, arr) => !(l === '' && arr[idx - 1] === ''));
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`;
    window.open(url, '_blank');
    if (inv.status === 'Draft') setBaseStatus(inv.id, 'Sent');
  };

  // ============================================
  // RENDER: HEADER
  // ============================================
  const pageHeader = (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-600 flex items-center justify-center shadow-md shadow-sky-500/20">
          <FileText size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-lg font-extrabold text-slate-800">Invoice</h1>
          <p className="text-xs text-slate-400">Tengeneza, tuma na fuatilia invoice za wateja wako</p>
        </div>
      </div>
      {view === 'list' && (
        <button
          onClick={startNew}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-cyan-700 text-white text-xs font-bold shadow-md shadow-sky-500/20 transition"
        >
          <Plus size={16} /> Invoice Mpya
        </button>
      )}
    </div>
  );

  // ============================================
  // RENDER: LIST VIEW
  // ============================================
  const statCards = [
    { label: 'Jumla Iliyotolewa', value: money(stats.invoiced), icon: Receipt, tone: 'from-sky-500 to-cyan-600' },
    { label: 'Imelipwa', value: money(stats.paid), icon: CheckCircle2, tone: 'from-emerald-500 to-teal-600' },
    { label: 'Inayodaiwa', value: money(stats.outstanding), icon: TrendingUp, tone: 'from-amber-500 to-orange-600' },
    { label: 'Zilizochelewa', value: String(stats.overdueCount), icon: AlertTriangle, tone: 'from-rose-500 to-pink-600' },
  ];

  const filterOptions: Array<'All' | DisplayStatus> = ['All', 'Draft', 'Sent', 'Partial', 'Paid', 'Overdue', 'Cancelled'];

  const listView = (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${s.tone} flex items-center justify-center mb-3 shadow-sm`}>
                <Icon size={16} className="text-white" />
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
              <p className="text-sm sm:text-base font-extrabold text-slate-800 mt-0.5 break-words">{s.value}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tafuta kwa namba ya invoice, jina au simu ya mteja..."
            className="w-full pl-10 pr-4 py-2.5 border-2 border-slate-200 rounded-xl text-xs focus:border-sky-400 focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {filterOptions.map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition ${
                statusFilter === f
                  ? 'bg-sky-600 border-sky-600 text-white'
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              {f === 'All' ? 'Zote' : STATUS_META[f].label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center space-y-2">
          <div className="h-12 w-12 rounded-2xl bg-sky-50 flex items-center justify-center mx-auto">
            <FileText size={22} className="text-sky-500" />
          </div>
          <p className="text-sm font-bold text-slate-700">
            {invoices.length === 0 ? 'Bado hujatengeneza invoice yoyote' : 'Hakuna invoice zinazolingana'}
          </p>
          <p className="text-xs text-slate-400">
            {invoices.length === 0 ? 'Bonyeza "Invoice Mpya" kuanza.' : 'Jaribu kubadilisha utafutaji au kichujio.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(inv => {
            const t = computeTotals(inv);
            const st = getDisplayStatus(inv);
            return (
              <button
                key={inv.id}
                onClick={() => openDetail(inv.id)}
                className="w-full text-left bg-white rounded-2xl border border-slate-200 hover:border-sky-300 hover:shadow-md p-4 transition flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-sky-50 flex items-center justify-center shrink-0">
                    <Receipt size={18} className="text-sky-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-slate-800">{inv.number}</p>
                    <p className="text-xs text-slate-500 truncate">{inv.customerName}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                      <Clock size={10} /> {fmtDate(inv.issueDate)} → {fmtDate(inv.dueDate)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6">
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Jumla</p>
                    <p className="text-xs font-extrabold text-slate-800">{money(t.total)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Inadaiwa</p>
                    <p className={`text-xs font-extrabold ${t.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{money(t.balance)}</p>
                  </div>
                  <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg border whitespace-nowrap ${STATUS_META[st].badge}`}>
                    {STATUS_META[st].label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  // ============================================
  // RENDER: FORM VIEW
  // ============================================
  const renderForm = () => {
    if (!draft) return null;
    const t = computeTotals(draft);
    const labelCls = 'block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1';
    const inputCls = 'w-full p-2.5 border-2 border-slate-200 rounded-xl text-xs focus:border-sky-400 focus:outline-none bg-white';

    return (
      <div className="space-y-5">
        <button
          onClick={() => { setDraft(null); setView(isEditing && activeId ? 'detail' : 'list'); }}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft size={14} /> Rudi
        </button>

        {formError && (
          <div className="rounded-xl p-3 text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-2">
            <AlertTriangle size={14} /> {formError}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            {/* Customer */}
            <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">1. Taarifa za Mteja</h3>
              {customers.length > 0 && (
                <div>
                  <label className={labelCls}>Chagua Mteja (Hiari)</label>
                  <select value={draft.customerId} onChange={e => pickCustomer(e.target.value)} className={inputCls}>
                    <option value="">— Mteja mpya / andika mwenyewe —</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.fullName}{c.phoneNumber ? ` • ${c.phoneNumber}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Jina la Mteja *</label>
                  <input value={draft.customerName} onChange={e => updateDraft({ customerName: e.target.value })} placeholder="Mf. Juma Hassan" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Namba ya Simu</label>
                  <input value={draft.customerPhone} onChange={e => updateDraft({ customerPhone: e.target.value })} placeholder="07XXXXXXXX" className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Anwani</label>
                <input value={draft.customerAddress} onChange={e => updateDraft({ customerAddress: e.target.value })} placeholder="Mf. Kariakoo, Dar es Salaam" className={inputCls} />
              </div>
            </section>

            {/* Items */}
            <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">2. Bidhaa / Huduma</h3>
                <button onClick={addItem} className="flex items-center gap-1 text-[11px] font-bold text-sky-600 hover:text-sky-800">
                  <Plus size={13} /> Ongeza Bidhaa
                </button>
              </div>
              <div className="space-y-3">
                {draft.items.map((item, idx) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase">Bidhaa #{idx + 1}</span>
                      {draft.items.length > 1 && (
                        <button onClick={() => removeItem(item.id)} className="p-1 text-rose-400 hover:text-rose-600 rounded-lg hover:bg-rose-50">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <input
                      value={item.description}
                      onChange={e => updateItem(item.id, { description: e.target.value })}
                      placeholder="Maelezo (Mf. Spika ya Bass 12 inch)"
                      className={inputCls}
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className={labelCls}>Idadi</label>
                        <input type="number" min="0" value={item.qty} onChange={e => updateItem(item.id, { qty: Number(e.target.value) })} className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Bei (TSh)</label>
                        <input type="number" min="0" value={item.unitPrice || ''} onChange={e => updateItem(item.id, { unitPrice: Number(e.target.value) })} placeholder="0" className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Jumla</label>
                        <div className="p-2.5 rounded-xl bg-white border-2 border-transparent text-xs font-extrabold text-slate-700">
                          {Math.round(item.qty * item.unitPrice).toLocaleString('en-US')}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Notes */}
            <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">3. Maelezo & Masharti</h3>
              <div>
                <label className={labelCls}>Maelezo kwa Mteja</label>
                <textarea rows={2} value={draft.notes} onChange={e => updateDraft({ notes: e.target.value })} placeholder="Mf. Bidhaa itapelekwa Jumatatu." className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Masharti ya Malipo</label>
                <textarea rows={3} value={draft.terms} onChange={e => updateDraft({ terms: e.target.value })} className={inputCls} />
              </div>
            </section>
          </div>

          {/* Side panel */}
          <div className="space-y-5">
            <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Tarehe & Namba</h3>
              <div>
                <label className={labelCls}>Namba ya Invoice</label>
                <input value={draft.number} onChange={e => updateDraft({ number: e.target.value })} className={`${inputCls} font-bold`} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Tarehe ya Kutoa</label>
                  <input type="date" value={draft.issueDate} onChange={e => updateDraft({ issueDate: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Mwisho wa Malipo</label>
                  <input type="date" value={draft.dueDate} onChange={e => updateDraft({ dueDate: e.target.value })} className={inputCls} />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[7, 14, 30].map(d => (
                  <button key={d} type="button" onClick={() => updateDraft({ dueDate: addDays(draft.issueDate, d) })}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-sky-100 text-slate-600 hover:text-sky-700 transition">
                    +{d} siku
                  </button>
                ))}
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Punguzo & VAT</h3>
              <div>
                <label className={labelCls}>Punguzo</label>
                <div className="flex gap-2">
                  <input type="number" min="0" value={draft.discount || ''} onChange={e => updateDraft({ discount: Number(e.target.value) })} placeholder="0" className={inputCls} />
                  <select value={draft.discountType} onChange={e => updateDraft({ discountType: e.target.value as 'amount' | 'percent' })} className={`${inputCls} w-24`}>
                    <option value="amount">TSh</option>
                    <option value="percent">%</option>
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.taxRate > 0}
                  onChange={e => updateDraft({ taxRate: e.target.checked ? 18 : 0 })}
                  className="h-4 w-4 accent-sky-600"
                />
                Ongeza VAT (18%)
              </label>
            </section>

            <section className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 shadow-lg space-y-2">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-300 mb-1">Muhtasari</h3>
              <div className="flex justify-between text-xs"><span className="text-slate-400">Jumla Ndogo</span><span className="font-bold">{money(t.subtotal)}</span></div>
              {t.discountAmt > 0 && <div className="flex justify-between text-xs"><span className="text-slate-400">Punguzo</span><span className="font-bold text-amber-300">- {money(t.discountAmt)}</span></div>}
              {t.tax > 0 && <div className="flex justify-between text-xs"><span className="text-slate-400">VAT ({draft.taxRate}%)</span><span className="font-bold">{money(t.tax)}</span></div>}
              <div className="border-t border-slate-700 pt-2 flex justify-between items-center">
                <span className="text-xs font-bold text-sky-300">JUMLA KUU</span>
                <span className="text-lg font-extrabold">{money(t.total)}</span>
              </div>
            </section>

            <div className="space-y-2">
              <button
                onClick={() => saveDraft('Sent')}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-cyan-700 text-white text-xs font-bold shadow-md transition"
              >
                <Send size={14} /> {isEditing ? 'Hifadhi Mabadiliko' : 'Hifadhi & Weka Imetumwa'}
              </button>
              {(!isEditing || draft.status === 'Draft') && (
                <button
                  onClick={() => saveDraft('Draft')}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white border-2 border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold transition"
                >
                  <Save size={14} /> Hifadhi kama Rasimu
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============================================
  // RENDER: DETAIL VIEW
  // ============================================
  const renderDetail = () => {
    if (!activeInvoice) return null;
    const inv = activeInvoice;
    const t = computeTotals(inv);
    const st = getDisplayStatus(inv);
    const html = buildInvoiceHtml(inv, biz);
    const canPay = t.balance > 0 && inv.status !== 'Cancelled';

    const actionBtn = 'flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-[11px] font-bold transition';

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button onClick={() => setView('list')} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800">
            <ArrowLeft size={14} /> Invoice Zote
          </button>
          <span className={`text-[11px] font-extrabold px-3 py-1.5 rounded-lg border ${STATUS_META[st].badge}`}>
            {STATUS_META[st].label}
          </span>
        </div>

        {/* Action bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-sm flex flex-wrap gap-2">
          <button onClick={handlePrint} className={`${actionBtn} bg-slate-900 hover:bg-slate-800 text-white`}>
            <Printer size={14} /> Print / PDF
          </button>
          <button onClick={() => handleWhatsApp(inv)} className={`${actionBtn} bg-emerald-600 hover:bg-emerald-700 text-white`}>
            <MessageCircle size={14} /> WhatsApp
          </button>
          {canPay && (
            <button onClick={() => openPayModal(inv)} className={`${actionBtn} bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-cyan-700 text-white`}>
              <Wallet size={14} /> Rekodi Malipo
            </button>
          )}
          {inv.status === 'Draft' && (
            <button onClick={() => setBaseStatus(inv.id, 'Sent')} className={`${actionBtn} bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200`}>
              <Send size={14} /> Weka Imetumwa
            </button>
          )}
          <button onClick={() => startEdit(inv)} className={`${actionBtn} bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200`}>
            <Edit3 size={14} /> Hariri
          </button>
          <button onClick={() => duplicateInvoice(inv)} className={`${actionBtn} bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200`}>
            <Copy size={14} /> Nakili
          </button>
          {inv.status !== 'Cancelled' ? (
            <button
              onClick={() => { if (window.confirm(`Futa (cancel) invoice ${inv.number}?`)) setBaseStatus(inv.id, 'Cancelled'); }}
              className={`${actionBtn} bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200`}
            >
              <Ban size={14} /> Sitisha
            </button>
          ) : (
            <button onClick={() => setBaseStatus(inv.id, 'Sent')} className={`${actionBtn} bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200`}>
              <CheckCircle2 size={14} /> Rejesha
            </button>
          )}
          {isAdmin && (
            <button onClick={() => deleteInvoice(inv)} className={`${actionBtn} bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 sm:ml-auto`}>
              <Trash2 size={14} /> Futa
            </button>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-5">
          {/* Preview */}
          <div className="lg:col-span-2">
            <div className="bg-slate-200/60 rounded-2xl p-2 sm:p-4 overflow-hidden">
              <iframe
                ref={iframeRef}
                title={`Invoice ${inv.number}`}
                srcDoc={html}
                onLoad={e => {
                  const d = e.currentTarget.contentDocument;
                  if (d) setIframeH(d.documentElement.scrollHeight + 20);
                }}
                className="w-full bg-white rounded-xl shadow-lg"
                style={{ height: iframeH, border: 0 }}
              />
            </div>
          </div>

          {/* Payments side */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-2">
              <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">Hali ya Malipo</h3>
              <div className="flex justify-between text-xs"><span className="text-slate-500">Jumla Kuu</span><span className="font-extrabold text-slate-800">{money(t.total)}</span></div>
              <div className="flex justify-between text-xs"><span className="text-slate-500">Kimelipwa</span><span className="font-extrabold text-emerald-600">{money(t.paid)}</span></div>
              <div className="flex justify-between text-xs border-t border-slate-100 pt-2">
                <span className="text-slate-500 font-bold">Kinachodaiwa</span>
                <span className={`font-extrabold ${t.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{money(t.balance)}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden mt-2">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all"
                  style={{ width: `${t.total > 0 ? Math.min(100, (t.paid / t.total) * 100) : 0}%` }}
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-3">Historia ya Malipo</h3>
              {inv.payments.length === 0 ? (
                <p className="text-xs text-slate-400">Hakuna malipo yaliyorekodiwa bado.</p>
              ) : (
                <div className="space-y-2">
                  {inv.payments.map(p => (
                    <div key={p.id} className="flex items-start justify-between gap-2 rounded-xl bg-slate-50 border border-slate-100 p-3">
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-emerald-600">{money(p.amount)}</p>
                        <p className="text-[10px] text-slate-500">{fmtDate(p.date)} • {p.method}</p>
                        {p.notes && <p className="text-[10px] text-slate-400 mt-0.5 truncate">{p.notes}</p>}
                      </div>
                      {isAdmin && (
                        <button onClick={() => removePayment(inv.id, p.id)} className="p-1 text-rose-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 shrink-0">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Payment modal */}
        {payOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
              <button onClick={() => setPayOpen(false)} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50">
                <X size={18} />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-600 flex items-center justify-center shadow-md">
                  <Wallet size={22} className="text-white" />
                </div>
                <div>
                  <h3 className="text-md font-extrabold text-slate-800">Rekodi Malipo</h3>
                  <p className="text-xs text-slate-400">{inv.number} • Inadaiwa {money(t.balance)}</p>
                </div>
              </div>

              {payError && (
                <div className="rounded-xl p-3 text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">{payError}</div>
              )}

              <form onSubmit={submitPayment} className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-500 uppercase tracking-wide mb-1">Kiasi (TSh) *</label>
                  <input type="number" min="1" required value={payAmount} onChange={e => setPayAmount(e.target.value)}
                    className="w-full p-3 border-2 border-slate-200 rounded-xl text-lg font-extrabold focus:border-sky-400 focus:outline-none" />
                  <button type="button" onClick={() => setPayAmount(String(t.balance))} className="mt-1.5 text-[11px] font-bold text-sky-600 hover:text-sky-800">
                    Lipa kiasi chote kilichobaki
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-500 uppercase tracking-wide mb-1">Tarehe</label>
                    <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-sky-400 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-500 uppercase tracking-wide mb-1">Njia</label>
                    <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-sky-400 focus:outline-none bg-white">
                      {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block font-bold text-slate-500 uppercase tracking-wide mb-1">Maelezo (Hiari)</label>
                  <input value={payNotes} onChange={e => setPayNotes(e.target.value)} placeholder="Mf. Ref ya M-Pesa" className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-sky-400 focus:outline-none" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setPayOpen(false)} className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600">Ghairi</button>
                  <button type="submit" className="px-5 py-2.5 bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-cyan-700 text-white rounded-xl font-bold shadow-md flex items-center gap-2">
                    <CheckCircle2 size={14} /> Hifadhi Malipo
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================
  // ROOT
  // ============================================
  return (
    <div className="space-y-6">
      {pageHeader}
      {view === 'list' && listView}
      {view === 'form' && renderForm()}
      {view === 'detail' && (activeInvoice ? renderDetail() : (
        <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="animate-spin" /></div>
      ))}
    </div>
  );
}
