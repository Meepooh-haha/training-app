import { Router } from 'express';
import db from '../db/db.js';

const router = Router();
const h = (fn) => (req, res, next) => { try { fn(req, res); } catch (e) { next(e); } };

// List all plans (with course name + topic count)
router.get('/plans', h((req, res) => {
  res.json(
    db.prepare(
      `SELECT p.*, c.name_th AS course_name_th,
              (SELECT COUNT(*) FROM training_plan_topics t WHERE t.plan_id = p.id) AS topic_count
       FROM training_plans p LEFT JOIN courses c ON c.code = p.course_code
       ORDER BY p.created_at DESC, p.id DESC`
    ).all()
  );
}));

// Get single plan with topics
router.get('/plans/:id', h((req, res) => {
  const plan = db.prepare('SELECT * FROM training_plans WHERE id=?').get(req.params.id);
  if (!plan) return res.status(404).json({ error: 'not found' });
  plan.topics = db.prepare('SELECT * FROM training_plan_topics WHERE plan_id=? ORDER BY sequence').all(plan.id);
  res.json(plan);
}));

function savePlanTopics(planId, topics) {
  db.prepare('DELETE FROM training_plan_topics WHERE plan_id=?').run(planId);
  const stmt = db.prepare(
    `INSERT INTO training_plan_topics
      (plan_id, topic_code, topic_name, sequence, date, start_time, end_time, duration_minutes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  (topics || []).forEach((t, i) =>
    stmt.run(
      planId,
      t.topic_code || '',
      t.topic_name || '',
      t.sequence ?? i + 1,
      t.date || '',
      t.start_time || '',
      t.end_time || '',
      Number(t.duration_minutes) || 0
    )
  );
}

const createPlan = db.transaction((body) => {
  const info = db.prepare(
    `INSERT INTO training_plans
      (plan_name, course_code, date_mode, start_date, daily_start_time, hours_per_day, created_at, notes)
     VALUES (@plan_name, @course_code, @date_mode, @start_date, @daily_start_time, @hours_per_day, @created_at, @notes)`
  ).run({
    plan_name: body.plan_name || '',
    course_code: body.course_code || '',
    date_mode: body.date_mode || 'single',
    start_date: body.start_date || '',
    daily_start_time: body.daily_start_time || '09:00',
    hours_per_day: Number(body.hours_per_day) || 6,
    created_at: new Date().toISOString().slice(0, 10),
    notes: body.notes || '',
  });
  savePlanTopics(info.lastInsertRowid, body.topics);
  return info.lastInsertRowid;
});

const updatePlan = db.transaction((id, body) => {
  db.prepare(
    `UPDATE training_plans SET plan_name=@plan_name, course_code=@course_code, date_mode=@date_mode,
      start_date=@start_date, daily_start_time=@daily_start_time, hours_per_day=@hours_per_day, notes=@notes
     WHERE id=@id`
  ).run({
    id,
    plan_name: body.plan_name || '',
    course_code: body.course_code || '',
    date_mode: body.date_mode || 'single',
    start_date: body.start_date || '',
    daily_start_time: body.daily_start_time || '09:00',
    hours_per_day: Number(body.hours_per_day) || 6,
    notes: body.notes || '',
  });
  savePlanTopics(id, body.topics);
});

router.post('/plans', h((req, res) => {
  const id = createPlan(req.body);
  res.json({ ok: true, id });
}));

router.put('/plans/:id', h((req, res) => {
  updatePlan(Number(req.params.id), req.body);
  res.json({ ok: true });
}));

router.delete('/plans/:id', h((req, res) => {
  db.prepare('DELETE FROM training_plans WHERE id=?').run(req.params.id);
  res.json({ ok: true });
}));

export default router;
