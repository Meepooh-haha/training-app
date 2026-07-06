import { Router } from 'express';
import { q } from '../db/db.js';

const router = Router();
const h = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (e) { next(e); }
};

router.get('/eval-items', h(async (req, res) => {
  res.json(await q.all('SELECT * FROM eval_items ORDER BY code'));
}));

router.post('/eval-items', h(async (req, res) => {
  await q.run(
    `INSERT INTO eval_items (code,name_th,name_en,eval_type,detail,dsd_topic) VALUES (@code,@name_th,@name_en,@eval_type,@detail,@dsd_topic)`,
    normItem(req.body),
  );
  res.json({ ok: true });
}));

router.put('/eval-items/:code', h(async (req, res) => {
  await q.run(
    `UPDATE eval_items SET name_th=@name_th,name_en=@name_en,eval_type=@eval_type,detail=@detail,dsd_topic=@dsd_topic WHERE code=@code`,
    { ...normItem(req.body), code: req.params.code },
  );
  res.json({ ok: true });
}));

router.delete('/eval-items/:code', h(async (req, res) => {
  await q.run('DELETE FROM eval_items WHERE code=?', [req.params.code]);
  res.json({ ok: true });
}));

function normItem(i) {
  const topic = Number(i.dsd_topic);
  return {
    code: i.code,
    name_th: i.name_th,
    name_en: i.name_en || '',
    eval_type: i.eval_type || 'ประเมินผู้เข้าร่วมอบรม',
    detail: i.detail || '',
    dsd_topic: topic >= 1 && topic <= 5 ? topic : null,
  };
}

export default router;
