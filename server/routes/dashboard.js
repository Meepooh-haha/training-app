import { Router } from 'express';
import { q } from '../db/db.js';

const router = Router();
const h = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (e) { next(e); }
};

router.get('/dashboard/stats', h(async (req, res) => {
  const year = String(new Date().getFullYear());
  const reqs = await q.all('SELECT * FROM training_requests');
  const thisYear = reqs.filter((r) => (r.training_date || '').startsWith(year));

  const byMonth = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, count: 0, planned: 0, used: 0 }));
  for (const r of thisYear) {
    const m = parseInt((r.training_date || '0000-00').slice(5, 7), 10) - 1;
    if (m < 0 || m > 11) continue;
    const budget =
      (r.budget_instructor || 0) + (r.budget_venue || 0) + (r.budget_food || 0) +
      (r.budget_material || 0) + (r.budget_other || 0);
    byMonth[m].count += 1;
    byMonth[m].planned += budget;
    if (r.status === 'approved') byMonth[m].used += budget;
  }

  const avgRow = await q.get('SELECT AVG(total_score) AS a FROM training_evaluations');
  const avg = avgRow?.a || 0;

  const recent = await q.all(
    `SELECT r.id,r.req_no,r.training_date,r.status,c.name_th AS course_name_th
     FROM training_requests r LEFT JOIN courses c ON c.code=r.course_code
     ORDER BY r.created_at DESC, r.id DESC LIMIT 5`,
  );

  res.json({
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
