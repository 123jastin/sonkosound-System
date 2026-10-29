// ============================================================
// routes/malipo.js
// ============================================================
import { Router } from 'express';
import db from '../db.js';             // your pg Pool
import { sendSms } from '../sms.js';   // your existing SMS helper

const router = Router();

const genId = (prefix) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const todayISO = () => new Date().toISOString().slice(0, 10);

// ============================================================
// GET /api/malipo — all data in one shot (matches client loadData)
// ============================================================
router.get('/', async (req, res) => {
  try {
    const [workers, jobs, payments] = await Promise.all([
      db.query(`SELECT * FROM malipo_workers ORDER BY created_at DESC`),
      db.query(`SELECT * FROM malipo_jobs    ORDER BY created_at DESC`),
      db.query(`SELECT * FROM malipo_payments ORDER BY payment_date DESC`),
    ]);
    res.json({
      workers:  workers.rows,
      jobs:     jobs.rows,
      payments: payments.rows,
    });
  } catch (err) {
    console.error('GET /api/malipo', err);
    res.status(500).json({ error: 'Failed to load malipo data' });
  }
});

// ============================================================
// WORKERS
// ============================================================

router.post('/workers', async (req, res) => {
  const { fullName, phoneNumber, address = '', businessName = '', notes = '' } = req.body;
  if (!fullName?.trim() || !phoneNumber?.trim()) {
    return res.status(400).json({ error: 'Jina na simu vinahitajika' });
  }
  try {
    const id = genId('mwork');
    const { rows } = await db.query(
      `INSERT INTO malipo_workers (id, full_name, phone_number, address, business_name, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, fullName.trim(), phoneNumber.trim(), address, businessName, notes]
    );
    res.json({ worker: rows[0] });
  } catch (err) {
    console.error('POST /api/malipo/workers', err);
    res.status(500).json({ error: 'Imeshindwa kumsajili mfanyakazi' });
  }
});

router.put('/workers/:id', async (req, res) => {
  const { fullName, phoneNumber, address = '', businessName = '', notes = '' } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE malipo_workers
       SET full_name=$1, phone_number=$2, address=$3, business_name=$4, notes=$5
       WHERE id=$6 RETURNING *`,
      [fullName, phoneNumber, address, businessName, notes, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Mfanyakazi hapatikani' });
    res.json({ worker: rows[0] });
  } catch (err) {
    console.error('PUT /api/malipo/workers', err);
    res.status(500).json({ error: 'Imeshindwa kuhariri mfanyakazi' });
  }
});

router.delete('/workers/:id', async (req, res) => {
  try {
    // CASCADE removes jobs + payments
    await db.query(`DELETE FROM malipo_workers WHERE id=$1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/malipo/workers', err);
    res.status(500).json({ error: 'Imeshindwa kufuta mfanyakazi' });
  }
});

// ============================================================
// JOBS
// ============================================================

router.post('/jobs', async (req, res) => {
  const {
    workerId, jobName, amount, paidAmount = 0,
    startDate, dueDate, status = 'Active', notes = '',
  } = req.body;

  const amt = Number(amount);
  if (!workerId || !jobName?.trim() || !(amt > 0)) {
    return res.status(400).json({ error: 'Taarifa za kazi si sahihi' });
  }

  try {
    // Verify worker exists
    const w = await db.query(`SELECT id FROM malipo_workers WHERE id=$1`, [workerId]);
    if (!w.rows[0]) return res.status(404).json({ error: 'Mfanyakazi hapatikani' });

    const id = genId('mjob');
    const { rows } = await db.query(
      `INSERT INTO malipo_jobs
        (id, worker_id, job_name, amount, paid_amount, start_date, due_date, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [id, workerId, jobName.trim(), amt, Number(paidAmount) || 0,
       startDate || todayISO(), dueDate || null, status, notes]
    );
    res.json({ job: rows[0] });
  } catch (err) {
    console.error('POST /api/malipo/jobs', err);
    res.status(500).json({ error: 'Imeshindwa kuongeza kazi' });
  }
});

router.put('/jobs/:id', async (req, res) => {
  const { jobName, amount, startDate, dueDate, notes = '' } = req.body;
  const amt = Number(amount);
  if (!jobName?.trim() || !(amt > 0)) {
    return res.status(400).json({ error: 'Taarifa za kazi si sahihi' });
  }

  try {
    const existing = await db.query(
      `SELECT paid_amount FROM malipo_jobs WHERE id=$1`,
      [req.params.id]
    );
    if (!existing.rows[0]) return res.status(404).json({ error: 'Kazi hapatikani' });

    const paid = Number(existing.rows[0].paid_amount);
    if (amt < paid) {
      return res.status(400).json({
        error: `Kiasi hakiwezi kuwa chini ya malipo yaliyofanywa (TSh ${paid.toLocaleString()})`,
      });
    }

    const newStatus = amt <= paid ? 'Cleared' : 'Active';
    const { rows } = await db.query(
      `UPDATE malipo_jobs
       SET job_name=$1, amount=$2, start_date=$3, due_date=$4, notes=$5, status=$6
       WHERE id=$7 RETURNING *`,
      [jobName.trim(), amt, startDate || null, dueDate || null, notes, newStatus, req.params.id]
    );
    res.json({ job: rows[0] });
  } catch (err) {
    console.error('PUT /api/malipo/jobs', err);
    res.status(500).json({ error: 'Imeshindwa kuhariri kazi' });
  }
});

router.delete('/jobs/:id', async (req, res) => {
  try {
    await db.query(`DELETE FROM malipo_jobs WHERE id=$1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/malipo/jobs', err);
    res.status(500).json({ error: 'Imeshindwa kufuta kazi' });
  }
});

// ============================================================
// PAYMENTS — the critical one
//   Enforces: amount <= remaining, updates paid_amount + status
//   in the SAME transaction.
// ============================================================

router.post('/payments', async (req, res) => {
  const { jobId, amount, paymentDate, paymentMethod = 'Cash', notes = '' } = req.body;
  const amt = Number(amount);

  if (!jobId || !(amt > 0)) {
    return res.status(400).json({ error: 'Taarifa za malipo si sahihi' });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Lock the job row so concurrent payments can't overpay
    const jobRes = await client.query(
      `SELECT amount, paid_amount FROM malipo_jobs WHERE id=$1 FOR UPDATE`,
      [jobId]
    );
    if (!jobRes.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Kazi hapatikani' });
    }

    const jobAmount = Number(jobRes.rows[0].amount);
    const paidBefore = Number(jobRes.rows[0].paid_amount);
    const remaining = Math.max(0, jobAmount - paidBefore);

    if (amt > remaining) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Kiasi kinazidi baki (TSh ${remaining.toLocaleString()})`,
      });
    }

    const payId = genId('mpay');
    const insert = await client.query(
      `INSERT INTO malipo_payments
        (id, job_id, amount, payment_date, payment_method, notes)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [payId, jobId, amt, paymentDate || todayISO(), paymentMethod, notes]
    );

    const paidAfter = paidBefore + amt;
    const newStatus = paidAfter >= jobAmount ? 'Cleared' : 'Active';

    const update = await client.query(
      `UPDATE malipo_jobs
       SET paid_amount=$1, status=$2
       WHERE id=$3 RETURNING *`,
      [paidAfter, newStatus, jobId]
    );

    await client.query('COMMIT');

    res.json({ payment: insert.rows[0], job: update.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /api/malipo/payments', err);
    res.status(500).json({ error: 'Imeshindwa kurekodi malipo' });
  } finally {
    client.release();
  }
});

export default router;
