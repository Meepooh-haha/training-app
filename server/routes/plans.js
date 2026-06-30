import { Router } from 'express';
import db, { q } from '../db/db.js';

const router = Router();
const h = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (e) { next(e); } };

router.get('/plans', h(async (req, res) => {
  res.json(await q.all(
    `SELECT p.*, c.name_th AS course_name_th,
            (SELECT COUNT(*) FROM training_plan_topics t WHERE t.plan_id = p.id) AS topic_count
     FROM training_plans p LEFT JOIN courses c ON c.code = p.course_code
     ORDER BY p.created_at DESC, p.id DESC`,
  ));
}));

router.get('/plans/:id', h(async (req, res) => {
  const plan = await q.get('SELECT * FROM training_plans WHERE id=?', [req.params.id]);
  if (!plan) return res.status(404).json({ error: 'not found' });
  plan.topics = await q.all(
    'SELECT * FROM training_plan_topics WHERE plan_id=? ORDER BY sequence',
    [plan.id],
  );
  res.json(plan);
}));

function topicStmts(planId, topics) {
  return [
    { sql: 'DELETE FROM training_plan_topics WHERE plan_id=?', args: [planId] },
    ...(topics || []).map((t, i) => ({
      sql: `INSERT INTO training_plan_topics
              (plan_id,topic_code,topic_name,sequence,date,start_time,end_time,duration_minutes)
            VALUES (?,?,?,?,?,?,?,?)`,
      args: [
        planId, t.topic_code || '', t.topic_name || '', t.sequence ?? i + 1,
        t.date || '', t.start_time || '', t.end_time || '', Number(t.duration_minutes) || 0,
      ],
    })),
  ];
}

router.post('/plans', h(async (req, res) => {
  const body = req.body;
  const tx = await db.transaction('write');
  try {
    const r = await tx.execute({
      sql: `INSERT INTO training_plans
              (plan_name,course_code,date_mode,start_date,daily_start_time,hours_per_day,created_at,notes)
            VALUES (@plan_name,@course_code,@date_mode,@start_date,@daily_start_time,@hours_per_day,@created_at,@notes)
            RETURNING id`,
      args: {
        plan_name: body.plan_name || '',
        course_code: body.course_code || '',
        date_mode: body.date_mode || 'single',
        start_date: body.start_date || '',
        daily_start_time: body.daily_start_time || '09:00',
        hours_per_day: Number(body.hours_per_day) || 6,
        created_at: new Date().toISOString().slice(0, 10),
        notes: body.notes || '',
      },
    });
    const id = r.rows[0].id;
    for (const s of topicStmts(id, body.topics)) {
      await tx.execute(s);
    }
    await tx.commit();
    res.json({ ok: true, id });
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}));

router.put('/plans/:id', h(async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body;
  await db.batch([
    {
      sql: `UPDATE training_plans SET plan_name=@plan_name,course_code=@course_code,date_mode=@date_mode,
              start_date=@start_date,daily_start_time=@daily_start_time,hours_per_day=@hours_per_day,notes=@notes
            WHERE id=@id`,
      args: {
        id,
        plan_name: body.plan_name || '',
        course_code: body.course_code || '',
        date_mode: body.date_mode || 'single',
        start_date: body.start_date || '',
        daily_start_time: body.daily_start_time || '09:00',
        hours_per_day: Number(body.hours_per_day) || 6,
        notes: body.notes || '',
      },
    },
    ...topicStmts(id, body.topics),
  ], 'write');
  res.json({ ok: true });
}));

router.delete('/plans/:id', h(async (req, res) => {
  await q.run('DELETE FROM training_plans WHERE id=?', [req.params.id]);
  res.json({ ok: true });
}));

export default router;
