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

// ---------------- 1A: Training Topics ----------------
router.get('/topics', h((req, res) => {
  res.json(db.prepare('SELECT * FROM training_topics ORDER BY code').all());
}));

router.post('/topics', h((req, res) => {
  const t = req.body;
  db.prepare(
    `INSERT INTO training_topics (code,name_th,name_en,type,duration_hours,duration_minutes,is_continuous)
     VALUES (@code,@name_th,@name_en,@type,@duration_hours,@duration_minutes,@is_continuous)`
  ).run(normTopic(t));
  res.json({ ok: true });
}));

router.put('/topics/:code', h((req, res) => {
  const t = { ...normTopic(req.body), code: req.params.code };
  db.prepare(
    `UPDATE training_topics SET name_th=@name_th,name_en=@name_en,type=@type,
       duration_hours=@duration_hours,duration_minutes=@duration_minutes,is_continuous=@is_continuous
     WHERE code=@code`
  ).run(t);
  res.json({ ok: true });
}));

router.delete('/topics/:code', h((req, res) => {
  db.prepare('DELETE FROM training_topics WHERE code=?').run(req.params.code);
  res.json({ ok: true });
}));

function normTopic(t) {
  return {
    code: t.code,
    name_th: t.name_th,
    name_en: t.name_en || '',
    type: t.type || 'บรรยาย',
    duration_hours: Number(t.duration_hours) || 0,
    duration_minutes: Number(t.duration_minutes) || 0,
    is_continuous: t.is_continuous ? 1 : 0,
  };
}

export default router;
