import { Router } from 'express';
import db, { q } from '../db/db.js';

const router = Router();
const h = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (e) { next(e); }
};

router.get('/eval-forms', h(async (req, res) => {
  res.json(await q.all('SELECT * FROM eval_forms ORDER BY code'));
}));

router.get('/eval-forms/:code', h(async (req, res) => {
  const form = await q.get('SELECT * FROM eval_forms WHERE code=?', [req.params.code]);
  if (!form) return res.status(404).json({ error: 'not found' });
  form.items = await q.all(
    `SELECT fi.*, i.name_th AS item_name_th, i.name_en AS item_name_en
     FROM eval_form_items fi LEFT JOIN eval_items i ON i.code = fi.item_code
     WHERE fi.form_code=? ORDER BY fi.sequence`,
    [req.params.code],
  );
  res.json(form);
}));

async function saveForm(f) {
  const params = { code: f.code, name_th: f.name_th, name_en: f.name_en || '', detail: f.detail || '' };
  await db.batch([
    {
      sql: `INSERT INTO eval_forms (code,name_th,name_en,detail) VALUES (@code,@name_th,@name_en,@detail)
            ON CONFLICT(code) DO UPDATE SET name_th=excluded.name_th,name_en=excluded.name_en,detail=excluded.detail`,
      args: params,
    },
    { sql: 'DELETE FROM eval_form_items WHERE form_code=?', args: [f.code] },
    ...(f.items || []).map((it, i) => ({
      sql: 'INSERT INTO eval_form_items (form_code,item_code,sequence,weight,scale_type) VALUES (?,?,?,?,?)',
      args: [f.code, it.item_code || '', it.sequence ?? i + 1, Number(it.weight) || 1, it.scale_type || 'ระดับ'],
    })),
  ], 'write');
}

router.post('/eval-forms', h(async (req, res) => {
  await saveForm(req.body);
  res.json({ ok: true });
}));

router.put('/eval-forms/:code', h(async (req, res) => {
  await saveForm({ ...req.body, code: req.params.code });
  res.json({ ok: true });
}));

router.delete('/eval-forms/:code', h(async (req, res) => {
  await q.run('DELETE FROM eval_forms WHERE code=?', [req.params.code]);
  res.json({ ok: true });
}));

export default router;
