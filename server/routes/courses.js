import { Router } from 'express';
import db, { q } from '../db/db.js';

const router = Router();
const h = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (e) { next(e); }
};

router.get('/courses', h(async (req, res) => {
  res.json(await q.all('SELECT * FROM courses ORDER BY code'));
}));

router.get('/courses/:code', h(async (req, res) => {
  const course = await q.get('SELECT * FROM courses WHERE code=?', [req.params.code]);
  if (!course) return res.status(404).json({ error: 'not found' });
  course.topics = await q.all(
    `SELECT ct.*, t.name_th AS topic_name_th, t.name_en AS topic_name_en,
            t.duration_hours, t.duration_minutes AS topic_duration_minutes
     FROM course_topics ct
     LEFT JOIN training_topics t ON t.code = ct.topic_code
     WHERE ct.course_code = ? ORDER BY ct.sequence`,
    [req.params.code],
  );
  course.prereqs = await q.all(
    `SELECT * FROM course_relations WHERE course_code=? AND relation_type='prereq'`,
    [req.params.code],
  );
  course.nexts = await q.all(
    `SELECT * FROM course_relations WHERE course_code=? AND relation_type='next'`,
    [req.params.code],
  );
  res.json(course);
}));

async function saveCourse(c) {
  const params = {
    code: c.code,
    name_th: c.name_th,
    name_en: c.name_en || '',
    category: c.category || '',
    type: c.type || 'ไม่ต่อเนื่อง',
    training_type: c.training_type || '',
    duration_hours: Number(c.duration_hours) || 0,
    duration_minutes: Number(c.duration_minutes) || 0,
    send_to_dsd: c.send_to_dsd ? 1 : 0,
    detail: c.detail || '',
  };

  const stmts = [
    {
      sql: `INSERT INTO courses (code,name_th,name_en,category,type,training_type,duration_hours,duration_minutes,send_to_dsd,detail)
            VALUES (@code,@name_th,@name_en,@category,@type,@training_type,@duration_hours,@duration_minutes,@send_to_dsd,@detail)
            ON CONFLICT(code) DO UPDATE SET
              name_th=excluded.name_th,name_en=excluded.name_en,category=excluded.category,type=excluded.type,
              training_type=excluded.training_type,duration_hours=excluded.duration_hours,
              duration_minutes=excluded.duration_minutes,send_to_dsd=excluded.send_to_dsd,detail=excluded.detail`,
      args: params,
    },
    { sql: 'DELETE FROM course_topics WHERE course_code=?', args: [c.code] },
    ...(c.topics || []).map((t, i) => ({
      sql: 'INSERT INTO course_topics (course_code,topic_code,sequence,duration) VALUES (?,?,?,?)',
      args: [c.code, t.topic_code || '', t.sequence ?? i + 1, Number(t.duration) || 0],
    })),
    { sql: 'DELETE FROM course_relations WHERE course_code=?', args: [c.code] },
    ...(c.prereqs || []).map((r) => ({
      sql: 'INSERT INTO course_relations (course_code,related_course_code,relation_type) VALUES (?,?,?)',
      args: [c.code, r.related_course_code, 'prereq'],
    })),
    ...(c.nexts || []).map((r) => ({
      sql: 'INSERT INTO course_relations (course_code,related_course_code,relation_type) VALUES (?,?,?)',
      args: [c.code, r.related_course_code, 'next'],
    })),
  ];

  await db.batch(stmts, 'write');
}

router.post('/courses', h(async (req, res) => {
  await saveCourse(req.body);
  res.json({ ok: true });
}));

router.put('/courses/:code', h(async (req, res) => {
  await saveCourse({ ...req.body, code: req.params.code });
  res.json({ ok: true });
}));

router.delete('/courses/:code', h(async (req, res) => {
  await q.run('DELETE FROM courses WHERE code=?', [req.params.code]);
  res.json({ ok: true });
}));

export default router;
