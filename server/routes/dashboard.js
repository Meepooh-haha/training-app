import { Router } from 'express';
import { q } from '../db/db.js';
import { dsdDeadline } from './training-projects.js';

const router = Router();
const h = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (e) { next(e); }
};

router.get('/dashboard/stats', h(async (req, res) => {
  const year = String(new Date().getFullYear());
  const projects = await q.all('SELECT * FROM training_projects');
  const thisYear = projects.filter((p) => (p.training_date || '').startsWith(year));

  const byMonth = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, count: 0, planned: 0, used: 0 }));
  for (const p of thisYear) {
    const m = parseInt((p.training_date || '0000-00').slice(5, 7), 10) - 1;
    if (m < 0 || m > 11) continue;
    const budget =
      (p.budget_instructor || 0) + (p.budget_venue || 0) + (p.budget_food || 0) +
      (p.budget_material || 0) + (p.budget_other || 0);
    byMonth[m].count += 1;
    byMonth[m].planned += budget;
    if (p.approval_status === 'approved') byMonth[m].used += budget;
  }

  const avgRow = await q.get('SELECT AVG(total_score) AS a FROM training_evaluations');
  const avg = avgRow?.a || 0;

  const recent = await q.all(
    `SELECT p.id, p.req_no, p.name, p.training_date, p.approval_status AS status,
            c.name_th AS course_name_th
     FROM training_projects p LEFT JOIN courses c ON c.code = p.course_code
     ORDER BY p.created_at DESC, p.id DESC LIMIT 5`,
  );

  // เตือนยื่น ยป. กรมพัฒนาฝีมือแรงงาน: โครงการหลักสูตร send_to_dsd ที่ยังไม่ติ๊ก
  // "ยื่นแล้ว" อบรมยังไม่ผ่านไป และ deadline ใกล้ (≤ 21 วัน) หรือเลยแล้ว
  const today = new Date().toISOString().slice(0, 10);
  const dsdRows = await q.all(
    `SELECT p.id, p.req_no, p.name, p.training_date, p.dsd_deadline, p.dsd_submitted
     FROM training_projects p
     JOIN courses c ON c.code = p.course_code
     WHERE c.send_to_dsd = 1 AND p.training_date IS NOT NULL AND p.training_date >= ?
       AND COALESCE(p.dsd_submitted, 0) = 0`,
    [today],
  );
  const dsdAlerts = dsdRows
    .map((p) => {
      const deadline = dsdDeadline(p);
      if (!deadline) return null;
      const daysLeft = Math.round((new Date(deadline + 'T00:00:00Z') - new Date(today + 'T00:00:00Z')) / 86400000);
      return { id: p.id, req_no: p.req_no, name: p.name, training_date: p.training_date, deadline, days_left: daysLeft };
    })
    .filter((a) => a && a.days_left <= 21)
    .sort((a, b) => a.days_left - b.days_left);

  res.json({
    dsdAlerts,
    year: Number(year),
    totalThisYear: thisYear.length,
    byMonth,
    totalPlanned: byMonth.reduce((s, m) => s + m.planned, 0),
    totalUsed: byMonth.reduce((s, m) => s + m.used, 0),
    avgScore: Math.round(avg * 100) / 100,
    recent,
  });
}));

export default router;
