/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Malipo.tsx — Pay workers/suppliers for jobs done
 * - Admin & staff accessible (cashier too, if you later grant it)
 * - Create worker, add job ("Mpe kazi"), pay partial/full ("Lipa"),
 *   download colourful PDF statement per worker ("Taarifa")
 * - Mirrors Kopesha / CustomerManagement patterns & styling
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Users, Plus, Phone, Calendar, Trash2, CreditCard, ChevronRight,
  Check, X, AlertCircle, Edit2, ArrowLeft, History, Printer,
  MapPin, Loader2, Wallet, TrendingUp, CheckCircle2, Clock,
  Banknote, AlertTriangle, Coins, Sparkles, Briefcase, FileText,
  UserPlus, Building, Search, ChevronDown, Lock
} from 'lucide-react';

// ============================================
// TYPES
// ============================================
interface MalipoWorker {
  id: string;
  full_name: string;
  phone_number: string;
  address: string;
  business_name: string;
  notes: string;
  created_at: string;
}

interface MalipoJob {
  id: string;
  worker_id: string;
  job_name: string;
  amount: number;
  paid_amount: number;
  start_date: string;
  due_date: string;
  status: string;
  notes: string;
  created_at: string;
}

interface MalipoPayment {
  id: string;
  job_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  notes: string;
  created_at: string;
}

interface MalipoProps {
  onUpdate?: () => void;
  userRole?: 'admin' | 'staff' | 'cashier' | null;
}

const API_BASE_URL = '/api/malipo';

// ============================================
// CONSTANTS
// ============================================
const LOGO_URL = 'https://pics.sonkosound.store/file_0000000018a881f4bef28aaff0866bbd.png';

const BUSINESS = {
  name: 'Sonko Sound',
  slogan: 'Electronics & Appliances',
  address: 'Morogoro, Tanzania',
  phone: '0688423753',
};

// ============================================
// HELPERS
// ============================================
const todayISO = () => new Date().toISOString().split('T')[0];

const daysUntil = (dateStr: string): number => {
  if (!dateStr) return 0;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86400000);
};

const formatDate = (s: string) => {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('sw-TZ', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch { return s; }
};

const getInitials = (name: string) =>
  (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

// ============================================
// COMPONENT
// ============================================
export default function Malipo({ onUpdate, userRole }: MalipoProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [workers, setWorkers] = useState<MalipoWorker[]>([]);
  const [jobs, setJobs] = useState<MalipoJob[]>([]);
  const [payments, setPayments] = useState<MalipoPayment[]>([]);

  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Cleared' | 'Overdue'>('All');

  // Modals
  const [isAddWorkerOpen, setIsAddWorkerOpen] = useState(false);
  const [isEditWorkerOpen, setIsEditWorkerOpen] = useState(false);
  const [isAddJobOpen, setIsAddJobOpen] = useState(false);
  const [isEditJobOpen, setIsEditJobOpen] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<MalipoJob | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyJob, setHistoryJob] = useState<MalipoJob | null>(null);
  const [expandedJob, setExpandedJob] = useState<Record<string, boolean>>({});

  // Form: worker
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [notes, setNotes] = useState('');

  // Form: job
  const [jobName, setJobName] = useState('');
  const [jobAmount, setJobAmount] = useState('');
  const [startDate, setStartDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState('');
  const [jobNotes, setJobNotes] = useState('');

  // Edit job form
  const [editJobName, setEditJobName] = useState('');
  const [editJobAmount, setEditJobAmount] = useState('');
  const [editJobStartDate, setEditJobStartDate] = useState('');
  const [editJobDueDate, setEditJobDueDate] = useState('');
  const [editJobNotes, setEditJobNotes] = useState('');

  // Form: payment
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [payNotes, setPayNotes] = useState('');
  const [payAmountError, setPayAmountError] = useState(false);

  // ============================================
  // LOAD / CACHE
  // ============================================
  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(API_BASE_URL);
      const data = await res.json();
      setWorkers(data.workers || []);
      setJobs(data.jobs || []);
      setPayments(data.payments || []);
    } catch {
      const cached = localStorage.getItem('malipo_data');
      if (cached) {
        try {
          const p = JSON.parse(cached);
          setWorkers(p.workers || []);
          setJobs(p.jobs || []);
          setPayments(p.payments || []);
        } catch {}
      }
    } finally {
      setIsLoading(false);
    }
  };

  const saveCache = (w: MalipoWorker[], j: MalipoJob[], p: MalipoPayment[]) => {
    try {
      localStorage.setItem('malipo_data', JSON.stringify({ workers: w, jobs: j, payments: p }));
    } catch {}
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    if (workers.length || jobs.length) saveCache(workers, jobs, payments);
  }, [workers, jobs, payments]);

  // ============================================
  // COMPUTED
  // ============================================
  const activeWorker = useMemo(
    () => workers.find(w => w.id === selectedWorkerId) || null,
    [workers, selectedWorkerId],
  );

  const activeWorkerJobs = useMemo(() => {
    if (!selectedWorkerId) return [];
    return jobs
      .filter(j => j.worker_id === selectedWorkerId)
      .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
  }, [jobs, selectedWorkerId]);

  const activeWorkerStats = useMemo(() => {
    if (!selectedWorkerId) return null;
    const totalAgreed = activeWorkerJobs.reduce((s, j) => s + Number(j.amount), 0);
    const totalPaid = activeWorkerJobs.reduce((s, j) => s + Number(j.paid_amount), 0);
    const remaining = Math.max(0, totalAgreed - totalPaid);
    const unpaid = activeWorkerJobs.filter(j =>
      Number(j.amount) > Number(j.paid_amount)
    );
    const overdue = unpaid.filter(j => daysUntil(j.due_date) < 0).length;

    return {
      totalAgreed, totalPaid, remaining, overdue,
      percentagePaid: totalAgreed > 0 ? (totalPaid / totalAgreed) * 100 : 0,
    };
  }, [selectedWorkerId, activeWorkerJobs]);

  const activeWorkerPayments = useMemo(() => {
    if (!selectedWorkerId) return [];
    const jobIds = activeWorkerJobs.map(j => j.id);
    return payments
      .filter(p => jobIds.includes(p.job_id))
      .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());
  }, [selectedWorkerId, activeWorkerJobs, payments]);

  const unpaidJobs = useMemo(() => {
    return activeWorkerJobs
      .map(j => ({
        ...j,
        remaining: Math.max(0, Number(j.amount) - Number(j.paid_amount)),
      }))
      .filter(j => j.remaining > 0);
  }, [activeWorkerJobs]);

  const totalUnpaid = useMemo(
    () => unpaidJobs.reduce((s, j) => s + j.remaining, 0),
    [unpaidJobs]
  );

  const globalStats = useMemo(() => {
    let totalAgreed = 0, totalPaid = 0, outstanding = 0, overdueCount = 0;
    jobs.forEach(j => {
      const remaining = Math.max(0, Number(j.amount) - Number(j.paid_amount));
      totalAgreed += Number(j.amount);
      totalPaid += Number(j.paid_amount);
      outstanding += remaining;
      if (remaining > 0 && daysUntil(j.due_date) < 0) overdueCount++;
    });
    return { totalAgreed, totalPaid, outstanding, overdueCount, totalWorkers: workers.length };
  }, [jobs, workers]);

  const workersWithStats = useMemo(() => {
    return workers.map(w => {
      const wJobs = jobs.filter(j => j.worker_id === w.id);
      const totalAgreed = wJobs.reduce((s, j) => s + Number(j.amount), 0);
      const totalPaid = wJobs.reduce((s, j) => s + Number(j.paid_amount), 0);
      const remaining = Math.max(0, totalAgreed - totalPaid);
      const unpaid = wJobs.filter(j => Number(j.amount) > Number(j.paid_amount));
      const overdue = unpaid.filter(j => daysUntil(j.due_date) < 0).length;
      const status: 'Cleared' | 'Active' | 'Overdue' =
        remaining <= 0 ? 'Cleared' : overdue > 0 ? 'Overdue' : 'Active';

      return {
        ...w,
        stats: { totalAgreed, totalPaid, remaining, status, jobCount: wJobs.length },
      };
    });
  }, [workers, jobs]);

  const filteredWorkers = useMemo(() => {
    return workersWithStats.filter(w => {
      const matchesSearch =
        w.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.phone_number.includes(searchQuery) ||
        (w.business_name && w.business_name.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesStatus = statusFilter === 'All' || w.stats.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [workersWithStats, searchQuery, statusFilter]);

  // ============================================
  // SMS
  // ============================================
  const sendMalipoSMS = async (payload: any) => {
    try {
      const res = await fetch('/api/malipo-send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (err) {
      console.error('SMS error:', err);
      return { success: false };
    }
  };

  // ============================================
  // WORKER CRUD
  // ============================================
  const handleAddWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !phoneNumber) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/workers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, phoneNumber, address, businessName, notes }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed');
      setWorkers(prev => [result.worker, ...prev]);
    } catch {
      const fallback: MalipoWorker = {
        id: 'mwork-' + Date.now(),
        full_name: fullName,
        phone_number: phoneNumber,
        address,
        business_name: businessName,
        notes,
        created_at: new Date().toISOString(),
      };
      setWorkers(prev => [fallback, ...prev]);
    } finally {
      setIsAddWorkerOpen(false);
      resetWorkerForm();
      setIsLoading(false);
      onUpdate?.();
    }
  };

  const handleEditWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkerId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/workers/${selectedWorkerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, phoneNumber, address, businessName, notes }),
      });
      if (!res.ok) throw new Error('Failed');
    } catch {}
    setWorkers(prev => prev.map(w =>
      w.id === selectedWorkerId
        ? { ...w, full_name: fullName, phone_number: phoneNumber, address, business_name: businessName, notes }
        : w,
    ));
    setIsEditWorkerOpen(false);
    setIsLoading(false);
    onUpdate?.();
  };

  const handleDeleteWorker = async (id: string) => {
    if (userRole !== 'admin') {
      setError('Huna ruhusa ya kufuta. Wasiliana na Admin.');
      setTimeout(() => setError(null), 3000);
      return;
    }
    if (!confirm('Futa mfanyakazi huyu pamoja na kazi zake zote?')) return;
    setIsLoading(true);
    try {
      await fetch(`${API_BASE_URL}/workers/${id}`, { method: 'DELETE' });
    } catch {}
    setWorkers(prev => prev.filter(w => w.id !== id));
    setJobs(prev => prev.filter(j => j.worker_id !== id));
    if (selectedWorkerId === id) setSelectedWorkerId('');
    setIsLoading(false);
    onUpdate?.();
  };

  // ============================================
  // JOB
  // ============================================
  const handleAddJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorkerId) return;
    const amt = Number(jobAmount);
    if (!amt || amt <= 0) {
      setError('Weka kiasi sahihi cha malipo');
      setTimeout(() => setError(null), 3000);
      return;
    }
    if (!jobName.trim()) {
      setError('Weka jina la kazi');
      setTimeout(() => setError(null), 3000);
      return;
    }
    setIsLoading(true);

    let createdJob: MalipoJob | null = null;
    try {
      const res = await fetch(`${API_BASE_URL}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerId: selectedWorkerId,
          jobName: jobName.trim(),
          amount: amt,
          paidAmount: 0,
          startDate,
          dueDate,
          status: 'Active',
          notes: jobNotes,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed');
      createdJob = result.job;
      setJobs(prev => [result.job, ...prev]);
    } catch (err: any) {
      setError(err.message || 'Imeshindwa kuongeza kazi');
      setTimeout(() => setError(null), 5000);
      setIsLoading(false);
      return;
    }

    if (createdJob && activeWorker) {
      await sendMalipoSMS({
        event: 'job_created',
        workerName: activeWorker.full_name,
        workerPhone: activeWorker.phone_number,
        jobName: createdJob.job_name,
        amount: amt,
        dueDate,
      });
    }

    setIsAddJobOpen(false);
    resetJobForm();
    setIsLoading(false);
    setSuccessMessage(`Kazi "${createdJob?.job_name}" imeongezwa! Malipo: TSh ${amt.toLocaleString()}`);
    setTimeout(() => setSuccessMessage(null), 4000);
    onUpdate?.();
  };

  const openEditJobModal = (job: MalipoJob) => {
    setEditingJobId(job.id);
    setEditJobName(job.job_name);
    setEditJobAmount(String(job.amount));
    setEditJobStartDate(job.start_date);
    setEditJobDueDate(job.due_date);
    setEditJobNotes(job.notes || '');
    setIsEditJobOpen(true);
  };

  const handleEditJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingJobId) return;
    if (!editJobName.trim() || !editJobAmount || Number(editJobAmount) <= 0 || !editJobDueDate) {
      setError('Jaza sehemu zote muhimu');
      setTimeout(() => setError(null), 3000);
      return;
    }
    const currentJob = activeWorkerJobs.find(j => j.id === editingJobId);
    if (currentJob && Number(editJobAmount) < Number(currentJob.paid_amount)) {
      setError(`Kiasi hakiwezi kuwa chini ya malipo yaliyofanywa (TSh ${Number(currentJob.paid_amount).toLocaleString()})`);
      setTimeout(() => setError(null), 5000);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/jobs/${editingJobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobName: editJobName.trim(),
          amount: Number(editJobAmount),
          startDate: editJobStartDate,
          dueDate: editJobDueDate,
          notes: editJobNotes,
        }),
      });
      if (!res.ok) throw new Error('Failed');
    } catch {}
    setJobs(prev => prev.map(j =>
      j.id === editingJobId
        ? {
            ...j,
            job_name: editJobName.trim(),
            amount: Number(editJobAmount),
            start_date: editJobStartDate,
            due_date: editJobDueDate,
            notes: editJobNotes,
          }
        : j
    ));
    setIsEditJobOpen(false);
    setEditingJobId(null);
    setIsLoading(false);
    setSuccessMessage('Kazi imehaririwa!');
    setTimeout(() => setSuccessMessage(null), 3000);
    onUpdate?.();
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('Futa kazi hii pamoja na malipo yake yote?')) return;
    setIsLoading(true);
    try {
      await fetch(`${API_BASE_URL}/jobs/${jobId}`, { method: 'DELETE' });
    } catch {}
    setJobs(prev => prev.filter(j => j.id !== jobId));
    setPayments(prev => prev.filter(p => p.job_id !== jobId));
    setIsLoading(false);
    onUpdate?.();
  };

  // ============================================
  // PAYMENT
  // ============================================
  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;

    const amt = Number(payAmount);
    const remainingBefore = Math.max(0, Number(selectedJob.amount) - Number(selectedJob.paid_amount));
    if (!amt || amt <= 0 || amt > remainingBefore) {
      setPayAmountError(true);
      setError('Kiasi si sahihi');
      setTimeout(() => setError(null), 3000);
      return;
    }
    setPayAmountError(false);
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: selectedJob.id,
          amount: amt,
          paymentDate: todayISO(),
          paymentMethod: payMethod,
          notes: payNotes || `Malipo ya kazi ${selectedJob.job_name}`,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed');

      const newPayment: MalipoPayment = result.payment || {
        id: 'mpay-' + Date.now(),
        job_id: selectedJob.id,
        amount: amt,
        payment_date: todayISO(),
        payment_method: payMethod,
        notes: payNotes || 'Malipo',
        created_at: new Date().toISOString(),
      };
      setPayments(prev => [newPayment, ...prev]);
    } catch (err: any) {
      setError(err.message || 'Imeshindwa kurekodi malipo');
      setTimeout(() => setError(null), 5000);
      setIsLoading(false);
      return;
    }

    const newPaid = Number(selectedJob.paid_amount) + amt;
    const remainingAfter = Math.max(0, Number(selectedJob.amount) - newPaid);
    const isCompleted = remainingAfter <= 0;

    setJobs(prev => prev.map(j =>
      j.id === selectedJob.id
        ? { ...j, paid_amount: newPaid, status: isCompleted ? 'Cleared' : 'Active' }
        : j
    ));

    if (activeWorker) {
      await sendMalipoSMS({
        event: 'job_paid',
        workerName: activeWorker.full_name,
        workerPhone: activeWorker.phone_number,
        jobName: selectedJob.job_name,
        paidAmount: amt,
        remaining: remainingAfter,
        isCompleted,
      });
    }

    setIsPayModalOpen(false);
    resetPaymentForm();
    setIsLoading(false);
    setSuccessMessage(
      isCompleted
        ? `Malipo ya TSh ${amt.toLocaleString()} yamekamilisha kazi!`
        : `Malipo ya TSh ${amt.toLocaleString()} yamerekodiwa!`
    );
    setTimeout(() => setSuccessMessage(null), 4000);
    onUpdate?.();
  };

  // ============================================
  // FORM RESETS / OPENERS
  // ============================================
  const resetWorkerForm = () => {
    setFullName(''); setPhoneNumber(''); setAddress('');
    setBusinessName(''); setNotes('');
  };
  const resetJobForm = () => {
    setJobName(''); setJobAmount(''); setStartDate(todayISO());
    setDueDate(''); setJobNotes('');
  };
  const resetPaymentForm = () => {
    setPayAmount(''); setPayNotes(''); setPayAmountError(false);
  };

  const openEditWorker = () => {
    if (!activeWorker) return;
    setFullName(activeWorker.full_name);
    setPhoneNumber(activeWorker.phone_number);
    setAddress(activeWorker.address);
    setBusinessName(activeWorker.business_name || '');
    setNotes(activeWorker.notes);
    setIsEditWorkerOpen(true);
  };

  const openPay = (job: MalipoJob) => {
    setSelectedJob(job);
    setPayAmount('');
    setPayNotes('');
    setPayAmountError(false);
    setIsPayModalOpen(true);
  };

  const toggleJobExpand = (jobId: string) => {
    setExpandedJob(prev => ({ ...prev, [jobId]: !prev[jobId] }));
  };

  // ============================================
  // PRINT STATEMENT
  // ============================================
  const handlePrintStatement = () => {
    if (!activeWorker || !activeWorkerStats) return;

    const now = new Date();
    const statementId = `MLP-${Date.now().toString(36).toUpperCase()}`;

    const htmlContent = `<!DOCTYPE html>
<html><head><title>Taarifa ya Malipo - ${activeWorker.full_name}</title><meta charset="UTF-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
@page { size: A4; margin: 12mm; }
body { font-family: 'Segoe UI', Tahoma, sans-serif; background: white; color: #1e293b; padding: 20px; }
.container { max-width: 190mm; margin: 0 auto; }
.header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; background: linear-gradient(135deg, #4c1d95 0%, #7c3aed 50%, #ec4899 100%); color: white; border-radius: 12px; margin-bottom: 24px; gap: 20px; }
.header-left { display: flex; align-items: center; gap: 16px; }
.logo-box { width: 70px; height: 70px; border-radius: 14px; background: white; display: flex; align-items: center; justify-content: center; padding: 6px; box-shadow: 0 4px 15px rgba(0,0,0,0.15); flex-shrink: 0; overflow: hidden; }
.logo-box img { width: 100%; height: 100%; object-fit: contain; }
.business-name { font-size: 22px; font-weight: 900; letter-spacing: 1px; line-height: 1.1; }
.business-slogan { font-size: 11px; opacity: 0.9; margin-top: 4px; }
.business-contact { font-size: 10px; opacity: 0.85; margin-top: 3px; }
.statement-badge { display: inline-block; background: rgba(255,255,255,0.25); padding: 6px 14px; border-radius: 20px; font-size: 10px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; }
.statement-id { font-size: 10px; opacity: 0.85; margin-top: 8px; font-family: monospace; }
.section { margin-bottom: 24px; }
.section-title { font-size: 13px; font-weight: 800; color: #6d28d9; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid #c4b5fd; }
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 16px; background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 10px; }
.info-card { display: flex; flex-direction: column; gap: 3px; }
.info-label { font-size: 9px; font-weight: 800; text-transform: uppercase; color: #7c3aed; letter-spacing: 0.5px; }
.info-value { font-size: 13px; font-weight: bold; color: #1e293b; }
.info-value.highlight { color: #dc2626; font-size: 16px; }
.stat-strip { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 20px; }
.stat-item { border-radius: 12px; padding: 14px; text-align: center; }
.stat-item.agreed { background: #ede9fe; border: 1px solid #c4b5fd; }
.stat-item.paid { background: #d1fae5; border: 1px solid #6ee7b7; }
.stat-item.balance { background: #fee2e2; border: 1px solid #fca5a5; }
.stat-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
.stat-item.agreed .stat-label { color: #5b21b6; }
.stat-item.paid .stat-label { color: #065f46; }
.stat-item.balance .stat-label { color: #991b1b; }
.stat-value { font-size: 18px; font-weight: 900; }
.stat-item.agreed .stat-value { color: #7c3aed; }
.stat-item.paid .stat-value { color: #047857; }
.stat-item.balance .stat-value { color: #dc2626; }
table { width: 100%; border-collapse: collapse; background: white; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; }
thead th { background: linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%); color: white; padding: 10px 12px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 800; }
thead th:last-child { text-align: right; }
tbody td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 11px; color: #334155; }
tbody td:last-child { text-align: right; font-weight: bold; }
tbody tr:nth-child(even) { background: #f5f3ff; }
.empty-row { text-align: center !important; padding: 20px !important; color: #94a3b8; font-style: italic; }
.payment-amount { color: #059669; font-weight: bold; }
.status-badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 9px; font-weight: 800; text-transform: uppercase; }
.status-cleared { background: #d1fae5; color: #065f46; }
.status-active { background: #fef3c7; color: #92400e; }
.status-overdue { background: #fee2e2; color: #991b1b; }
.summary-box { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 20px; }
.summary-item { border-radius: 10px; padding: 12px; text-align: center; }
.summary-item.total { background: #f5f3ff; border: 1px solid #ddd6fe; }
.summary-item.paid { background: #f0fdf4; border: 1px solid #bbf7d0; }
.summary-item.balance { background: #fef2f2; border: 1px solid #fecaca; }
.summary-label { font-size: 9px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 4px; }
.summary-value { font-size: 18px; font-weight: 900; }
.summary-item.total .summary-value { color: #7c3aed; }
.summary-item.paid .summary-value { color: #059669; }
.summary-item.balance .summary-value { color: #dc2626; }
.signatures { display: flex; justify-content: space-between; gap: 40px; margin-top: 50px; padding: 0 20px; }
.signature-box { flex: 1; text-align: center; }
.signature-line { border-top: 1.5px solid #6d28d9; padding-top: 8px; font-size: 11px; font-weight: bold; color: #6d28d9; }
.signature-sub { font-size: 9px; color: #94a3b8; margin-top: 3px; }
.footer { margin-top: 30px; padding: 14px; background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%); border-radius: 10px; text-align: center; font-size: 10px; color: #6d28d9; border: 1px solid #ddd6fe; }
.footer strong { color: #6d28d9; }
.no-print { text-align: center; padding: 20px; margin-top: 10px; }
.no-print button { background: #7c3aed; color: white; border: none; padding: 12px 28px; border-radius: 22px; font-size: 13px; font-weight: bold; cursor: pointer; margin: 0 5px; }
.no-print button.close { background: #64748b; }
@media print { .no-print { display: none !important; } body { padding: 0; } }
</style></head><body>
<div class="container">
<div class="header">
<div class="header-left">
<div class="logo-box"><img src="${LOGO_URL}" alt="Logo" /></div>
<div>
<div class="business-name">${BUSINESS.name.toUpperCase()}</div>
<div class="business-slogan">${BUSINESS.slogan}</div>
<div class="business-contact">${BUSINESS.address} • ${BUSINESS.phone}</div>
</div></div>
<div style="text-align: right;">
<div class="statement-badge">Taarifa ya Malipo</div>
<div class="statement-id">${statementId}</div>
</div></div>

<div class="section">
<div class="section-title">Taarifa za Mfanyakazi</div>
<div class="info-grid">
<div class="info-card"><span class="info-label">Jina Kamili</span><span class="info-value">${activeWorker.full_name}</span></div>
<div class="info-card"><span class="info-label">Namba ya Simu</span><span class="info-value">${activeWorker.phone_number}</span></div>
<div class="info-card"><span class="info-label">Anuani</span><span class="info-value">${activeWorker.address || '—'}</span></div>
<div class="info-card"><span class="info-label">Tarehe ya Taarifa</span><span class="info-value">${now.toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
</div>
<div class="stat-strip">
<div class="stat-item agreed"><div class="stat-label">Jumla ya Makubaliano</div><div class="stat-value">TSh ${activeWorkerStats.totalAgreed.toLocaleString()}</div></div>
<div class="stat-item paid"><div class="stat-label">Iliyolipwa</div><div class="stat-value">TSh ${activeWorkerStats.totalPaid.toLocaleString()}</div></div>
<div class="stat-item balance"><div class="stat-label">Baki</div><div class="stat-value">TSh ${activeWorkerStats.remaining.toLocaleString()}</div></div>
</div></div>

<div class="section">
<div class="section-title">Historia ya Kazi (${activeWorkerJobs.length})</div>
<table><thead><tr><th>Kazi #</th><th>Jina la Kazi</th><th>Tarehe</th><th>Deadline</th><th>Malipo</th><th>Iliyolipwa</th><th>Baki</th><th>Hali</th></tr></thead>
<tbody>${activeWorkerJobs.length > 0
  ? activeWorkerJobs.map((job, idx) => {
      const remaining = Math.max(0, Number(job.amount) - Number(job.paid_amount));
      const isCleared = remaining <= 0;
      const isOverdue = !isCleared && daysUntil(job.due_date) < 0;
      const statusClass = isCleared ? 'status-cleared' : isOverdue ? 'status-overdue' : 'status-active';
      const statusText = isCleared ? 'Imelipwa' : isOverdue ? 'Imechelewa' : 'Inaendelea';
      return `<tr><td>#${idx + 1}</td><td>${job.job_name}</td><td>${formatDate(job.start_date)}</td><td>${formatDate(job.due_date)}</td><td>TSh ${Number(job.amount).toLocaleString()}</td><td class="payment-amount">TSh ${Number(job.paid_amount).toLocaleString()}</td><td style="color:#dc2626;font-weight:bold;">TSh ${remaining.toLocaleString()}</td><td><span class="status-badge ${statusClass}">${statusText}</span></td></tr>`;
    }).join('')
  : '<tr><td colspan="8" class="empty-row">Hakuna kazi bado</td></tr>'}</tbody></table></div>

<div class="section">
<div class="section-title">Historia ya Malipo (${activeWorkerPayments.length})</div>
<table><thead><tr><th>Tarehe</th><th>Kazi #</th><th>Njia</th><th>Maelezo</th><th>Kiasi</th></tr></thead>
<tbody>${activeWorkerPayments.length > 0
  ? activeWorkerPayments.map(pay => {
      const jobIdx = activeWorkerJobs.findIndex(j => j.id === pay.job_id) + 1;
      return `<tr><td>${formatDate(pay.payment_date)}</td><td>#${jobIdx}</td><td>${pay.payment_method}</td><td>${pay.notes || 'Malipo'}</td><td class="payment-amount">TSh ${Number(pay.amount).toLocaleString()}</td></tr>`;
    }).join('')
  : '<tr><td colspan="5" class="empty-row">Hakuna malipo bado</td></tr>'}</tbody></table></div>

<div class="summary-box">
<div class="summary-item total"><div class="summary-label">Jumla ya Makubaliano</div><div class="summary-value">TSh ${activeWorkerStats.totalAgreed.toLocaleString()}</div></div>
<div class="summary-item paid"><div class="summary-label">Jumla Iliyolipwa</div><div class="summary-value">TSh ${activeWorkerStats.totalPaid.toLocaleString()}</div></div>
<div class="summary-item balance"><div class="summary-label">Salio la Sasa</div><div class="summary-value">TSh ${activeWorkerStats.remaining.toLocaleString()}</div></div>
</div>

<div class="signatures">
<div class="signature-box"><div class="signature-line">Sahihi ya Mmiliki</div><div class="signature-sub">${BUSINESS.name}</div></div>
<div class="signature-box"><div class="signature-line">Sahihi ya Mfanyakazi</div><div class="signature-sub">${activeWorker.full_name}</div></div>
</div>

<div class="footer">
<strong>${BUSINESS.name}</strong> • ${BUSINESS.address} • ${BUSINESS.phone}<br>
Taarifa hii ilitengenezwa ${now.toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })} saa ${now.toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' })}
</div>

<div class="no-print">
<button onclick="window.print()">🖨️ Chapisha / Save as PDF</button>
<button class="close" onclick="window.close()">Funga</button>
</div>
</div>
<script>window.onload = function() { setTimeout(function() { window.print(); }, 400); };</script>
</body></html>`;

    const printWindow = window.open('', '_blank', 'width=900,height=800');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    } else {
      alert('Tafadhali ruhusu pop-ups kwa ajili ya kuchapisha');
    }
  };

  // ============================================
  // HARD LOCK: cashier cannot use this page
  // ============================================
  if (userRole === 'cashier') {
    return (
      <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center shadow-sm max-w-lg mx-auto my-12 text-xs">
        <div className="w-20 h-20 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-4 border-2 border-rose-100">
          <Lock size={36} className="text-rose-500" />
        </div>
        <h2 className="text-lg font-extrabold text-slate-800">Ufikiaji Umekataliwa</h2>
        <p className="text-slate-500 mt-2 leading-relaxed">
          Ukurasa wa <strong>Malipo</strong> unaruhusiwa kwa Admin na Staff pekee.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* BANNERS */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2 text-rose-700 text-xs">
            <AlertCircle size={16} /><span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700"><X size={16} /></button>
        </div>
      )}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-2 text-emerald-700 text-xs animate-fade-in">
          <Sparkles size={16} /><span>{successMessage}</span>
        </div>
      )}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 text-xs text-slate-400 py-2">
          <Loader2 size={14} className="animate-spin" /><span>Inasasisha...</span>
        </div>
      )}

      {activeWorker && activeWorkerStats ? (
        /* ========================================
         * WORKER PROFILE
         * ======================================== */
        <div className="space-y-6 text-xs text-left animate-fade-in">
          {/* Profile header */}
          <div className="bg-gradient-to-br from-purple-600 via-violet-600 to-indigo-700 rounded-3xl p-6 md:p-8 text-white shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSelectedWorkerId('')}
                  className="p-2.5 rounded-2xl bg-white/20 hover:bg-white/30 backdrop-blur border border-white/30 transition"
                >
                  <ArrowLeft size={16} />
                </button>
                <div className="h-16 w-16 rounded-2xl bg-white/25 backdrop-blur border-2 border-white/40 flex items-center justify-center text-white font-extrabold text-xl shadow-lg">
                  {getInitials(activeWorker.full_name)}
                </div>
                <div>
                  <h3 className="text-base font-extrabold">{activeWorker.full_name}</h3>
                  <p className="text-xs text-purple-100 mt-1 flex items-center gap-1">
                    <Phone size={12} /> {activeWorker.phone_number}
                  </p>
                  {activeWorker.address && (
                    <p className="text-xs text-purple-100 mt-1 flex items-center gap-1">
                      <MapPin size={12} /> {activeWorker.address}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={openEditWorker} className="py-2.5 px-4 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur border border-white/30 text-white font-bold flex items-center gap-1.5 transition">
                  <Edit2 size={14} /> Hariri
                </button>
                {userRole === 'admin' && (
                  <button onClick={() => handleDeleteWorker(activeWorker.id)} className="py-2.5 px-4 rounded-xl bg-rose-500/80 hover:bg-rose-500 text-white font-bold flex items-center gap-1.5 transition">
                    <Trash2 size={14} /> Futa
                  </button>
                )}
                <button onClick={() => setSelectedWorkerId('')} className="py-2.5 px-4 rounded-xl bg-white/90 hover:bg-white text-slate-800 font-bold">
                  Orodha
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 mt-4 border-t border-white/20">
              <div className="text-center">
                <p className="text-[10px] text-purple-100 uppercase font-bold tracking-wider">Kazi</p>
                <p className="text-xl font-black mt-1">{activeWorkerJobs.length}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-purple-100 uppercase font-bold tracking-wider">Makubaliano</p>
                <p className="text-base font-black mt-1">TSh {activeWorkerStats.totalAgreed.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-purple-100 uppercase font-bold tracking-wider">Iliyolipwa</p>
                <p className="text-base font-black mt-1 text-emerald-200">TSh {activeWorkerStats.totalPaid.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-purple-100 uppercase font-bold tracking-wider">Baki</p>
                <p className="text-base font-black mt-1 text-rose-200">TSh {activeWorkerStats.remaining.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Action bar */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => { resetJobForm(); setIsAddJobOpen(true); }}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-2.5 px-5 rounded-xl flex items-center gap-2 shadow-lg"
            >
              <Plus size={16} /> Mpe Kazi
            </button>
            <button
              onClick={handlePrintStatement}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-5 rounded-xl flex items-center gap-2 shadow-sm"
            >
              <Printer size={16} /> Taarifa (PDF)
            </button>
          </div>

          {/* Jobs list */}
          <div className="space-y-4">
            {activeWorkerJobs.map(job => {
              const remaining = Math.max(0, Number(job.amount) - Number(job.paid_amount));
              const isCleared = remaining <= 0;
              const days = daysUntil(job.due_date);
              const isOverdue = !isCleared && days < 0;
              const isDueSoon = !isCleared && days >= 0 && days <= 3;
              const progress = Number(job.amount) > 0
                ? Math.min(100, (Number(job.paid_amount) / Number(job.amount)) * 100)
                : 0;

              const jobPayments = payments.filter(p => p.job_id === job.id);

              return (
                <div
                  key={job.id}
                  className={`bg-white rounded-3xl border-2 p-6 shadow-sm hover:shadow-md transition ${
                    isCleared ? 'border-emerald-200'
                    : isOverdue ? 'border-rose-200'
                    : isDueSoon ? 'border-amber-200'
                    : 'border-slate-100'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-xl ${
                          isCleared ? 'bg-emerald-50 text-emerald-600'
                          : isOverdue ? 'bg-rose-50 text-rose-600'
                          : 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white'
                        }`}>
                          {isCleared ? <CheckCircle2 size={22} /> : <Briefcase size={22} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-extrabold text-slate-800">{job.job_name}</h4>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                              isCleared ? 'bg-emerald-100 text-emerald-700'
                              : isOverdue ? 'bg-rose-100 text-rose-700'
                              : isDueSoon ? 'bg-amber-100 text-amber-700'
                              : 'bg-purple-100 text-purple-700'
                            }`}>
                              {isCleared ? 'IMEKAMILIKA' : isOverdue ? 'IMECHELEWA' : isDueSoon ? 'KARIBU' : 'INATENDEKA'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {job.notes || 'Kazi iliyokubaliwa'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-purple-50 rounded-xl p-3 border border-purple-100">
                          <p className="text-[9px] text-purple-700 font-extrabold uppercase">Malipo</p>
                          <p className="text-sm font-extrabold text-purple-800 mt-0.5">TSh {Number(job.amount).toLocaleString()}</p>
                        </div>
                        <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                          <p className="text-[9px] text-emerald-700 font-extrabold uppercase">Iliyolipwa</p>
                          <p className="text-sm font-extrabold text-emerald-800 mt-0.5">TSh {Number(job.paid_amount).toLocaleString()}</p>
                        </div>
                        <div className="bg-rose-50 rounded-xl p-3 border border-rose-100">
                          <p className="text-[9px] text-rose-700 font-extrabold uppercase">Baki</p>
                          <p className="text-sm font-extrabold text-rose-800 mt-0.5">TSh {remaining.toLocaleString()}</p>
                        </div>
                        <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                          <p className="text-[9px] text-amber-700 font-extrabold uppercase">Deadline</p>
                          <p className={`text-sm font-extrabold mt-0.5 ${isOverdue ? 'text-rose-700' : isDueSoon ? 'text-amber-700' : 'text-slate-800'}`}>
                            {formatDate(job.due_date)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-2 text-[10px] flex-wrap">
                        <span className="text-slate-400">
                          <Calendar size={10} /> {formatDate(job.start_date)}
                        </span>
                        {isOverdue && (
                          <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                            <AlertTriangle size={9} /> Imechelewa siku {Math.abs(days)}
                          </span>
                        )}
                        {isDueSoon && (
                          <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                            <Clock size={9} /> Siku {days} zimebaki
                          </span>
                        )}
                        {isCleared && (
                          <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                            <CheckCircle2 size={9} /> Imekamilika
                          </span>
                        )}
                      </div>

                      <div className="mt-4">
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-slate-400 font-semibold">Maendeleo ya Malipo</span>
                          <span className={`font-extrabold ${isCleared ? 'text-emerald-600' : 'text-purple-700'}`}>{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${isCleared ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' : 'bg-gradient-to-r from-purple-400 to-purple-600'}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      {jobPayments.length > 0 && (
                        <div className="mt-3">
                          <button
                            onClick={() => toggleJobExpand(job.id)}
                            className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl transition-all border ${expandedJob[job.id] ? 'bg-emerald-100 border-emerald-300 shadow-sm' : 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100'}`}
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-lg bg-emerald-500 flex items-center justify-center shadow-sm">
                                <History size={12} className="text-white" />
                              </div>
                              <div className="text-left">
                                <p className="text-[10px] font-extrabold text-emerald-900 uppercase tracking-wide">Malipo Yaliyofanywa</p>
                                <p className="text-[9px] text-emerald-700 font-semibold">Mara {jobPayments.length} • Bonyeza kuona historia</p>
                              </div>
                            </div>
                            <div className={`transition-transform ${expandedJob[job.id] ? 'rotate-180' : ''}`}>
                              <ChevronDown size={14} className="text-emerald-700" />
                            </div>
                          </button>

                          {expandedJob[job.id] && (
                            <div className="mt-2 space-y-2">
                              {jobPayments.map((pay, i) => (
                                <div key={pay.id} className="relative bg-white rounded-xl border border-emerald-100 shadow-sm overflow-hidden">
                                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-emerald-400 to-emerald-600" />
                                  <div className="pl-4 pr-3 py-3 flex items-center justify-between">
                                    <div>
                                      <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide">Malipo #{i + 1}</p>
                                      <p className="text-[10px] text-slate-500 mt-0.5">
                                        {formatDate(pay.payment_date)} • {pay.payment_method}
                                      </p>
                                      {pay.notes && <p className="text-[10px] text-slate-400 italic mt-0.5">"{pay.notes}"</p>}
                                    </div>
                                    <span className="text-sm font-extrabold text-emerald-600">TSh {Number(pay.amount).toLocaleString()}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex md:flex-col gap-2 flex-wrap">
                      {!isCleared && (
                        <button
                          onClick={() => openPay(job)}
                          className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-2 px-4 rounded-xl flex items-center gap-1.5 text-xs shadow-sm"
                        >
                          <CreditCard size={14} /> Lipa
                        </button>
                      )}
                      <button
                        onClick={() => openEditJobModal(job)}
                        className="border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold py-2 px-4 rounded-xl flex items-center gap-1.5 text-xs"
                      >
                        <Edit2 size={14} /> Hariri
                      </button>
                      {userRole === 'admin' && (
                        <button
                          onClick={() => handleDeleteJob(job.id)}
                          className="border border-rose-200 hover:bg-rose-50 text-rose-600 font-bold py-2 px-4 rounded-xl flex items-center gap-1.5 text-xs"
                        >
                          <Trash2 size={14} /> Futa
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {activeWorkerJobs.length === 0 && (
              <div className="bg-white p-12 text-center rounded-3xl border border-slate-100 shadow-sm text-slate-400">
                <Briefcase size={40} className="mx-auto text-slate-300 mb-3" />
                <p className="text-sm font-semibold">Hakuna kazi bado.</p>
                <p className="text-xs mt-1">Bonyeza "Mpe Kazi" kuanza.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ========================================
         * WORKERS LIST
         * ======================================== */
        <>
          {/* Global stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-purple-500 to-violet-600 p-6 rounded-3xl shadow-lg text-white">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-100">Makubaliano Yote</span>
                <Briefcase size={18} className="text-purple-100" />
              </div>
              <h3 className="text-2xl font-black mt-2">TSh {globalStats.totalAgreed.toLocaleString()}</h3>
              <p className="text-[10px] text-purple-100 mt-1">Kazi zote zilizokubaliwa</p>
            </div>
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-6 rounded-3xl shadow-lg text-white">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">Iliyolipwa</span>
                <TrendingUp size={18} className="text-emerald-100" />
              </div>
              <h3 className="text-2xl font-black mt-2">TSh {globalStats.totalPaid.toLocaleString()}</h3>
              <p className="text-[10px] text-emerald-100 mt-1">Malipo yaliyofanywa</p>
            </div>
            <div className="bg-gradient-to-br from-rose-500 to-red-600 p-6 rounded-3xl shadow-lg text-white">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-100">Baki</span>
                <Wallet size={18} className="text-rose-100" />
              </div>
              <h3 className="text-2xl font-black mt-2">TSh {globalStats.outstanding.toLocaleString()}</h3>
              <p className="text-[10px] text-rose-100 mt-1">Inadaiwa kwa wafanyakazi</p>
            </div>
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-6 rounded-3xl shadow-lg text-white">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-100">Waliochelewa</span>
                <AlertTriangle size={18} className="text-amber-100" />
              </div>
              <h3 className="text-2xl font-black mt-2">{globalStats.overdueCount}</h3>
              <p className="text-[10px] text-amber-100 mt-1">Kazi zilizochelewa</p>
            </div>
          </div>

          {/* Header + Search + Filter */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-white p-4 rounded-3xl border border-slate-100 shadow-sm gap-4">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400"><Search size={18} /></span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tafuta mfanyakazi kwa jina, simu..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:bg-white focus:ring-purple-500"
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto">
              {(['All', 'Active', 'Cleared', 'Overdue'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-4 py-2 text-xs font-semibold rounded-xl transition ${statusFilter === tab ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                >
                  {tab === 'All' ? 'Wote' : tab === 'Active' ? 'Active' : tab === 'Cleared' ? 'Safi' : 'Overdue'}
                </button>
              ))}
              <button
                onClick={() => { resetWorkerForm(); setIsAddWorkerOpen(true); }}
                disabled={isLoading}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 ml-2 shadow-sm transition disabled:opacity-50"
              >
                <UserPlus size={15} /> Ongeza Mfanyakazi
              </button>
            </div>
          </div>

          {/* Worker cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredWorkers.length > 0 ? filteredWorkers.map(worker => (
              <div
                key={worker.id}
                onClick={() => setSelectedWorkerId(worker.id)}
                className="p-5 rounded-3xl border bg-white border-slate-100 hover:border-purple-300 hover:shadow-md shadow-sm cursor-pointer flex flex-col justify-between h-52 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-bold text-sm flex items-center justify-center">
                        {getInitials(worker.full_name)}
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-800 truncate max-w-[140px]">{worker.full_name}</h3>
                        <p className="text-[10px] text-slate-400 flex items-center gap-0.5 mt-0.5"><Phone size={10} /> {worker.phone_number}</p>
                      </div>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      worker.stats.status === 'Overdue' ? 'bg-rose-100 text-rose-700'
                      : worker.stats.status === 'Active' ? 'bg-amber-100 text-amber-700'
                      : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {worker.stats.status}
                    </span>
                  </div>
                  {worker.business_name && (
                    <div className="mt-3 flex items-center gap-1 text-[10px] text-slate-500 font-medium bg-slate-50 px-2.5 py-1 rounded-lg w-fit">
                      <Building size={11} /><span>{worker.business_name}</span>
                    </div>
                  )}
                </div>
                <div className="border-t border-slate-50 pt-3 mt-4 flex justify-between items-end">
                  <div>
                    <p className="text-[9px] text-slate-400 uppercase font-semibold">Baki</p>
                    <p className="text-xs font-bold text-slate-800 mt-0.5">TSh {worker.stats.remaining.toLocaleString()}</p>
                  </div>
                  <span className="text-[10px] font-semibold text-purple-600 flex items-center gap-0.5">
                    Fungua <ChevronRight size={12} />
                  </span>
                </div>
              </div>
            )) : (
              <div className="col-span-full bg-white p-12 text-center rounded-3xl border border-slate-100 shadow-sm text-slate-400">
                <Users size={40} className="mx-auto text-slate-300 mb-3" />
                <p className="text-sm font-semibold">Hakuna wafanyakazi waliopatikana.</p>
                <p className="text-xs mt-1">Bonyeza "Ongeza Mfanyakazi" kuanza.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ============================================ */}
      {/* MODAL: Add Worker */}
      {/* ============================================ */}
      {isAddWorkerOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-scale-in max-h-[92vh] overflow-y-auto">
            <button onClick={() => setIsAddWorkerOpen(false)} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50">
              <X size={18} />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                <UserPlus size={20} className="text-white" />
              </div>
              <h3 className="text-md font-extrabold text-slate-800">Ongeza Mfanyakazi</h3>
            </div>
            <form onSubmit={handleAddWorker} className="space-y-4 text-xs text-left">
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Jina Kamili *</label>
                <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Mfano: Juma Kassim" className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-purple-400 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Simu *</label>
                  <input type="tel" required value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="0712345678" className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-purple-400 focus:outline-none" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Kazi/Biashara</label>
                  <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="Mf. Fundi" className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-purple-400 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Anuani</label>
                <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Mtaa, Jiji" className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-purple-400 focus:outline-none" />
              </div>
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Maelezo</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Maelezo ya ziada..." className="w-full p-2.5 border-2 border-slate-200 rounded-xl h-20 focus:border-purple-400 focus:outline-none" />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsAddWorkerOpen(false)} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600">Ghairi</button>
                <button type="submit" disabled={isLoading} className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-semibold flex items-center gap-2 disabled:opacity-50">
                  {isLoading ? <><Loader2 size={14} className="animate-spin" /> Inasajili...</> : 'Sajili'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* MODAL: Edit Worker */}
      {/* ============================================ */}
      {isEditWorkerOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-scale-in max-h-[92vh] overflow-y-auto">
            <button onClick={() => setIsEditWorkerOpen(false)} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50">
              <X size={18} />
            </button>
            <h3 className="text-md font-extrabold text-slate-800">Hariri Mfanyakazi</h3>
            <form onSubmit={handleEditWorker} className="space-y-4 text-xs text-left">
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Jina Kamili *</label>
                <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)} className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-purple-400 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Simu *</label>
                  <input type="tel" required value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-purple-400 focus:outline-none" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Kazi/Biashara</label>
                  <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)} className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-purple-400 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Anuani</label>
                <input type="text" value={address} onChange={e => setAddress(e.target.value)} className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-purple-400 focus:outline-none" />
              </div>
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Maelezo</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-2.5 border-2 border-slate-200 rounded-xl h-20 focus:border-purple-400 focus:outline-none" />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsEditWorkerOpen(false)} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600">Ghairi</button>
                <button type="submit" disabled={isLoading} className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-semibold disabled:opacity-50">
                  Hifadhi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* MODAL: Add Job ("Mpe Kazi") */}
      {/* ============================================ */}
      {isAddJobOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-scale-in max-h-[92vh] overflow-y-auto">
            <button onClick={() => setIsAddJobOpen(false)} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50">
              <X size={18} />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                <Briefcase size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-md font-extrabold text-slate-800">Mpe Kazi</h3>
                <p className="text-xs text-slate-400">Mfanyakazi: {activeWorker?.full_name}</p>
              </div>
            </div>

            <form onSubmit={handleAddJob} className="space-y-4 text-xs text-left">
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Jina la Kazi *</label>
                <input type="text" required value={jobName} onChange={e => setJobName(e.target.value)} placeholder="Mf. Kuchora kabati" className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-purple-400 focus:outline-none" />
              </div>
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Kiasi Kilichokubaliwa (TSh) *</label>
                <input type="number" required min="1" value={jobAmount} onChange={e => setJobAmount(e.target.value)} placeholder="50000" className="w-full p-2.5 border-2 border-slate-200 rounded-xl text-lg font-extrabold focus:border-purple-400 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Tarehe ya Kuanza *</label>
                  <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-purple-400 focus:outline-none" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Deadline</label>
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} min={startDate} className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-purple-400 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Maelezo</label>
                <textarea value={jobNotes} onChange={e => setJobNotes(e.target.value)} placeholder="Maelezo ya kazi..." className="w-full p-2.5 border-2 border-slate-200 rounded-xl h-20 focus:border-purple-400 focus:outline-none" />
              </div>
              <div className="bg-purple-50 p-3 rounded-2xl border border-purple-200 text-[11px] text-purple-800">
                <strong>💡 Kumbuka:</strong> Malipo yanaweza kufanywa kidogo kidogo au yote kwa mkupuo kupitia kitufe cha "Lipa".
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setIsAddJobOpen(false)} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600">Ghairi</button>
                <button type="submit" disabled={isLoading} className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-semibold flex items-center gap-2 disabled:opacity-50">
                  {isLoading ? <><Loader2 size={14} className="animate-spin" /> Inahifadhi...</> : 'Hifadhi Kazi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* MODAL: Edit Job */}
      {/* ============================================ */}
      {isEditJobOpen && editingJobId && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-scale-in max-h-[92vh] overflow-y-auto">
            <button onClick={() => { setIsEditJobOpen(false); setEditingJobId(null); }} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50">
              <X size={18} />
            </button>
            <h3 className="text-md font-extrabold text-slate-800 flex items-center gap-1.5">
              <Edit2 size={18} className="text-blue-600" /> Hariri Kazi
            </h3>
            <form onSubmit={handleEditJob} className="space-y-4 text-xs text-left">
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Jina la Kazi *</label>
                <input type="text" required value={editJobName} onChange={e => setEditJobName(e.target.value)} className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-blue-400 focus:outline-none" />
              </div>
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Kiasi (TSh) *</label>
                <input type="number" required min="1" value={editJobAmount} onChange={e => setEditJobAmount(e.target.value)} className="w-full p-2.5 border-2 border-slate-200 rounded-xl text-lg font-extrabold focus:border-blue-400 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Kuanza</label>
                  <input type="date" value={editJobStartDate} onChange={e => setEditJobStartDate(e.target.value)} className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-blue-400 focus:outline-none" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Deadline</label>
                  <input type="date" value={editJobDueDate} onChange={e => setEditJobDueDate(e.target.value)} className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-blue-400 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Maelezo</label>
                <textarea value={editJobNotes} onChange={e => setEditJobNotes(e.target.value)} className="w-full p-2.5 border-2 border-slate-200 rounded-xl h-20 focus:border-blue-400 focus:outline-none" />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => { setIsEditJobOpen(false); setEditingJobId(null); }} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600">Ghairi</button>
                <button type="submit" disabled={isLoading} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold disabled:opacity-50">
                  Hifadhi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* MODAL: Pay (Lipa) */}
      {/* ============================================ */}
      {isPayModalOpen && selectedJob && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-scale-in max-h-[92vh] overflow-y-auto">
            <button onClick={() => { setIsPayModalOpen(false); resetPaymentForm(); }} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50">
              <X size={18} />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                <CreditCard size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-md font-extrabold text-slate-800">Lipa</h3>
                <p className="text-xs text-slate-400">{activeWorker?.full_name} • {selectedJob.job_name}</p>
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-2xl p-3 space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-purple-700">Makubaliano:</span>
                <span className="font-bold text-purple-900">TSh {Number(selectedJob.amount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-purple-700">Iliyolipwa:</span>
                <span className="font-bold text-emerald-700">TSh {Number(selectedJob.paid_amount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t border-purple-200 pt-1.5">
                <span className="text-purple-700">Baki:</span>
                <span className="font-bold text-rose-700">TSh {Math.max(0, Number(selectedJob.amount) - Number(selectedJob.paid_amount)).toLocaleString()}</span>
              </div>
            </div>

            <form onSubmit={handlePay} className="space-y-4 text-xs text-left">
              <div>
                <label className={`block font-semibold uppercase tracking-wide mb-1 ${payAmountError ? 'text-rose-600' : 'text-slate-500'}`}>
                  Kiasi (TSh) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={Math.max(0, Number(selectedJob.amount) - Number(selectedJob.paid_amount))}
                  value={payAmount}
                  onChange={e => { setPayAmount(e.target.value); if (payAmountError) setPayAmountError(false); }}
                  placeholder={`Baki: TSh ${Math.max(0, Number(selectedJob.amount) - Number(selectedJob.paid_amount)).toLocaleString()}`}
                  className={`w-full p-2.5 border-2 rounded-xl text-lg font-extrabold focus:outline-none ${payAmountError ? 'border-rose-400 bg-rose-50' : 'border-slate-200 focus:border-purple-400'}`}
                />
                {payAmountError && (
                  <p className="mt-1 text-[10px] text-rose-600 font-bold flex items-center gap-1">
                    <AlertCircle size={10} /> Weka kiasi sahihi
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {(() => {
                  const remaining = Math.max(0, Number(selectedJob.amount) - Number(selectedJob.paid_amount));
                  const amounts = [Math.min(10000, remaining), Math.min(20000, remaining), remaining].filter((v, i, a) => v > 0 && a.indexOf(v) === i);
                  return amounts.map(amount => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setPayAmount(amount.toString())}
                      className={`flex-1 py-2 px-2 rounded-xl text-[10px] font-bold border-2 transition ${
                        payAmount === amount.toString()
                          ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-purple-600'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      TSh {amount >= 1000 ? `${(amount / 1000).toFixed(0)}k` : amount}
                    </button>
                  ));
                })()}
              </div>
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Njia</label>
                <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="w-full p-2.5 border-2 border-slate-200 rounded-xl bg-white focus:border-purple-400 focus:outline-none">
                  <option>Cash</option>
                  <option>M-Pesa</option>
                  <option>Tigo Pesa</option>
                  <option>Airtel Money</option>
                  <option>HaloPesa</option>
                  <option>Bank Transfer</option>
                  <option>Cheque</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-500 uppercase tracking-wide mb-1">Maelezo</label>
                <input type="text" value={payNotes} onChange={e => setPayNotes(e.target.value)} placeholder="Risiti au kumbukumbu..." className="w-full p-2.5 border-2 border-slate-200 rounded-xl focus:border-purple-400 focus:outline-none" />
              </div>
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Unalipa:</span>
                  <span className="font-bold text-emerald-600">TSh {Number(payAmount || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[11px] border-t border-slate-200 pt-1.5">
                  <span className="text-slate-400">Baki Baada:</span>
                  <span className="font-bold text-rose-600">
                    TSh {Math.max(0, Number(selectedJob.amount) - Number(selectedJob.paid_amount) - Number(payAmount || 0)).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => { setIsPayModalOpen(false); resetPaymentForm(); }} className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-semibold text-slate-600">Ghairi</button>
                <button type="submit" disabled={isLoading || !payAmount || Number(payAmount) <= 0} className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl font-semibold flex items-center gap-2 disabled:opacity-50">
                  {isLoading ? <><Loader2 size={14} className="animate-spin" /> Inarekodi...</> : 'Hifadhi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* MODAL: History per job */}
      {/* ============================================ */}
      {isHistoryOpen && historyJob && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative animate-scale-in">
            <button onClick={() => setIsHistoryOpen(false)} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-50">
              <X size={18} />
            </button>
            <h3 className="text-md font-extrabold text-slate-800">Historia ya Malipo</h3>
            <p className="text-xs text-slate-400">Kazi: {historyJob.job_name} — TSh {Number(historyJob.amount).toLocaleString()}</p>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {payments.filter(p => p.job_id === historyJob.id).map(payment => (
                <div key={payment.id} className="flex items-center justify-between p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <div>
                    <p className="text-xs font-bold text-slate-800">{payment.notes}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{formatDate(payment.payment_date)} • {payment.payment_method}</p>
                  </div>
                  <span className="text-sm font-extrabold text-emerald-600">TSh {Number(payment.amount).toLocaleString()}</span>
                </div>
              ))}
              {payments.filter(p => p.job_id === historyJob.id).length === 0 && (
                <p className="text-xs text-slate-400 text-center py-8">Hakuna malipo bado.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
