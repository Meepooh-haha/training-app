import { Router } from 'express';
import db from '../db/db.js';

const router = Router();
const h = (fn) => (req, res, next) => {
  try { fn(req, res); } catch (e) { next(e); }
};

const isFk = (e) => e.message && e.message.includes('FOREIGN KEY constraint failed');

router.get('/departments', h((req, res) => {
  res.json(db.prepare('SELECT * FROM departments ORDER BY code').all());
}));

router.post('/departments', h((req, res) => {
  const { code, name, name_en } = req.body;
  db.prepare('INSERT INTO departments (code, name, name_en) VALUES (@code, @name, @name_en)')
    .run({ code, name, name_en: name_en || '' });
  res.json({ ok: true });
}));

router.put('/departments/:id', h((req, res) => {
  const { name, name_en } = req.body;
  db.prepare('UPDATE departments SET name=@name, name_en=@name_en WHERE id=@id')
    .run({ name, name_en: name_en || '', id: req.params.id });
  res.json({ ok: true });
}));

router.delete('/departments/:id', h((req, res) => {
  try {
    db.prepare('DELETE FROM departments WHERE id=?').run(req.params.id);
  } catch (e) {
    if (isFk(e)) throw Object.assign(new Error('ไม่สามารถลบได้ เนื่องจากมีตำแหน่งงานที่อ้างอิงฝ่ายนี้อยู่'), { status: 409 });
    throw e;
  }
  res.json({ ok: true });
}));

export default router;
