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

// ---------------- 1C: Evaluation Items ----------------
router.get('/eval-items', h((req, res) => {
  res.json(db.prepare('SELECT * FROM eval_items ORDER BY code').all());
}));

router.post('/eval-items', h((req, res) => {
  const i = normItem(req.body);
  db.prepare(
    `INSERT INTO eval_items (code,name_th,name_en,eval_type,detail) VALUES (@code,@name_th,@name_en,@eval_type,@detail)`
  ).run(i);
  res.json({ ok: true });
}));

router.put('/eval-items/:code', h((req, res) => {
  const i = { ...normItem(req.body), code: req.params.code };
  db.prepare(
    `UPDATE eval_items SET name_th=@name_th,name_en=@name_en,eval_type=@eval_type,detail=@detail WHERE code=@code`
  ).run(i);
  res.json({ ok: true });
}));

router.delete('/eval-items/:code', h((req, res) => {
  db.prepare('DELETE FROM eval_items WHERE code=?').run(req.params.code);
  res.json({ ok: true });
}));

function normItem(i) {
  return {
    code: i.code,
    name_th: i.name_th,
    name_en: i.name_en || '',
    eval_type: i.eval_type || 'ประเมินผู้เข้าร่วมอบรม',
    detail: i.detail || '',
  };
}

export default router;
