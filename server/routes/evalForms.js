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

// ---------------- 1D: Evaluation Forms (+ items) ----------------
router.get('/eval-forms', h((req, res) => {
  res.json(db.prepare('SELECT * FROM eval_forms ORDER BY code').all());
}));

router.get('/eval-forms/:code', h((req, res) => {
  const form = db.prepare('SELECT * FROM eval_forms WHERE code=?').get(req.params.code);
  if (!form) return res.status(404).json({ error: 'not found' });
  // Join item names so the UI can render labels without a second call.
  form.items = db
    .prepare(
      `SELECT fi.*, i.name_th AS item_name_th, i.name_en AS item_name_en
       FROM eval_form_items fi LEFT JOIN eval_items i ON i.code = fi.item_code
       WHERE fi.form_code=? ORDER BY fi.sequence`
    )
    .all(req.params.code);
  res.json(form);
}));

const saveForm = db.transaction((f) => {
  const exists = db.prepare('SELECT 1 FROM eval_forms WHERE code=?').get(f.code);
  const params = { code: f.code, name_th: f.name_th, name_en: f.name_en || '', detail: f.detail || '' };
  if (exists) {
    db.prepare('UPDATE eval_forms SET name_th=@name_th,name_en=@name_en,detail=@detail WHERE code=@code').run(params);
  } else {
    db.prepare('INSERT INTO eval_forms (code,name_th,name_en,detail) VALUES (@code,@name_th,@name_en,@detail)').run(params);
  }
  db.prepare('DELETE FROM eval_form_items WHERE form_code=?').run(f.code);
  const fi = db.prepare(
    'INSERT INTO eval_form_items (form_code,item_code,sequence,weight,scale_type) VALUES (?,?,?,?,?)'
  );
  (f.items || []).forEach((it, i) =>
    fi.run(f.code, it.item_code || '', it.sequence ?? i + 1, Number(it.weight) || 1, it.scale_type || 'ระดับ')
  );
});

router.post('/eval-forms', h((req, res) => {
  saveForm(req.body);
  res.json({ ok: true });
}));
router.put('/eval-forms/:code', h((req, res) => {
  saveForm({ ...req.body, code: req.params.code });
  res.json({ ok: true });
}));
router.delete('/eval-forms/:code', h((req, res) => {
  db.prepare('DELETE FROM eval_forms WHERE code=?').run(req.params.code);
  res.json({ ok: true });
}));

export default router;
