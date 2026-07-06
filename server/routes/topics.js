import { Router } from 'express';
import { q } from '../db/db.js';

const router = Router();
const h = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (e) { next(e); }
};

router.get('/topics', h(async (req, res) => {
  res.json(await q.all('SELECT * FROM training_topics ORDER BY code'));
}));

router.post('/topics', h(async (req, res) => {
  await q.run(
    `INSERT INTO training_topics (code,name_th,name_en,type,duration_hours,duration_minutes,is_continuous,speaker,subtopics)
     VALUES (@code,@name_th,@name_en,@type,@duration_hours,@duration_minutes,@is_continuous,@speaker,@subtopics)`,
    normTopic(req.body),
  );
  res.json({ ok: true });
}));

router.put('/topics/:code', h(async (req, res) => {
  await q.run(
    `UPDATE training_topics SET name_th=@name_th,name_en=@name_en,type=@type,
       duration_hours=@duration_hours,duration_minutes=@duration_minutes,is_continuous=@is_continuous,
       speaker=@speaker,subtopics=@subtopics
     WHERE code=@code`,
    { ...normTopic(req.body), code: req.params.code },
  );
  res.json({ ok: true });
}));

router.delete('/topics/:code', h(async (req, res) => {
  await q.run('DELETE FROM training_topics WHERE code=?', [req.params.code]);
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
    speaker: t.speaker || '',
    subtopics: String(t.subtopics || '').trim(),
  };
}

export default router;
