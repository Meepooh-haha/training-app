import { Router } from 'express';
import db from '../db/db.js';

const router = Router();
const h = (fn) => (req, res, next) => {
  try {
    fn(req, res);
  } catch (e) {
    next(e);
  }
};

// ---------------- 1B: Courses (+ topics + relations) ----------------
router.get('/courses', h((req, res) => {
  res.json(db.prepare('SELECT * FROM courses ORDER BY code').all());
}));

router.get('/courses/:code', h((req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE code=?').get(req.params.code);
  if (!course) return res.status(404).json({ error: 'not found' });
  course.topics = db
    .prepare(
      `SELECT ct.*, t.name_th AS topic_name_th, t.name_en AS topic_name_en,
              t.duration_hours, t.duration_minutes AS topic_duration_minutes
       FROM course_topics ct
       LEFT JOIN training_topics t ON t.code = ct.topic_code
       WHERE ct.course_code = ? ORDER BY ct.sequence`
    )
    .all(req.params.code);
  course.prereqs = db
    .prepare(`SELECT * FROM course_relations WHERE course_code=? AND relation_type='prereq'`)
    .all(req.params.code);
  course.nexts = db
    .prepare(`SELECT * FROM course_relations WHERE course_code=? AND relation_type='next'`)
    .all(req.params.code);
  res.json(course);
}));

const saveCourse = db.transaction((c) => {
  const exists = db.prepare('SELECT 1 FROM courses WHERE code=?').get(c.code);
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
  if (exists) {
    db.prepare(
      `UPDATE courses SET name_th=@name_th,name_en=@name_en,category=@category,type=@type,
        training_type=@training_type,duration_hours=@duration_hours,duration_minutes=@duration_minutes,
        send_to_dsd=@send_to_dsd,detail=@detail WHERE code=@code`
    ).run(params);
  } else {
    db.prepare(
      `INSERT INTO courses (code,name_th,name_en,category,type,training_type,duration_hours,duration_minutes,send_to_dsd,detail)
       VALUES (@code,@name_th,@name_en,@category,@type,@training_type,@duration_hours,@duration_minutes,@send_to_dsd,@detail)`
    ).run(params);
  }
  // Replace child rows wholesale — simplest correct approach.
  db.prepare('DELETE FROM course_topics WHERE course_code=?').run(c.code);
  const ct = db.prepare(
    'INSERT INTO course_topics (course_code,topic_code,sequence,duration) VALUES (?,?,?,?)'
  );
  (c.topics || []).forEach((t, i) =>
    ct.run(c.code, t.topic_code || '', t.sequence ?? i + 1, Number(t.duration) || 0)
  );

  db.prepare('DELETE FROM course_relations WHERE course_code=?').run(c.code);
  const cr = db.prepare(
    'INSERT INTO course_relations (course_code,related_course_code,relation_type) VALUES (?,?,?)'
  );
  (c.prereqs || []).forEach((r) => cr.run(c.code, r.related_course_code, 'prereq'));
  (c.nexts || []).forEach((r) => cr.run(c.code, r.related_course_code, 'next'));
});

router.post('/courses', h((req, res) => {
  saveCourse(req.body);
  res.json({ ok: true });
}));
router.put('/courses/:code', h((req, res) => {
  saveCourse({ ...req.body, code: req.params.code });
  res.json({ ok: true });
}));
router.delete('/courses/:code', h((req, res) => {
  db.prepare('DELETE FROM courses WHERE code=?').run(req.params.code);
  res.json({ ok: true });
}));

export default router;
