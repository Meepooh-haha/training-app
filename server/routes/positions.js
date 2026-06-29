import { Router } from 'express';
import db from '../db/db.js';

const router = Router();
const h = (fn) => (req, res, next) => {
  try { fn(req, res); } catch (e) { next(e); }
};

const isFk = (e) => e.message && e.message.includes('FOREIGN KEY constraint failed');

router.get('/positions', h((req, res) => {
  const { department_id } = req.query;
  const sql = `
    SELECT p.*, d.name AS department_name
    FROM positions p
    LEFT JOIN departments d ON p.department_id = d.id
    ${department_id ? 'WHERE p.department_id=?' : ''}
    ORDER BY p.code
  `;
  res.json(department_id ? db.prepare(sql).all(department_id) : db.prepare(sql).all());
}));

router.post('/positions', h((req, res) => {
  const { code, name, name_en, level, department_id } = req.body;
  db.prepare(
    'INSERT INTO positions (code, name, name_en, level, department_id) VALUES (@code, @name, @name_en, @level, @department_id)'
  ).run({ code, name, name_en: name_en || '', level: level || '', department_id: department_id || null });
  res.json({ ok: true });
}));

router.put('/positions/:id', h((req, res) => {
  const { name, name_en, level, department_id } = req.body;
  db.prepare(
    'UPDATE positions SET name=@name, name_en=@name_en, level=@level, department_id=@department_id WHERE id=@id'
  ).run({ name, name_en: name_en || '', level: level || '', department_id: department_id || null, id: req.params.id });
  res.json({ ok: true });
}));

router.delete('/positions/:id', h((req, res) => {
  try {
    db.prepare('DELETE FROM positions WHERE id=?').run(req.params.id);
  } catch (e) {
    if (isFk(e)) throw Object.assign(new Error('ไม่สามารถลบได้ เนื่องจากมีข้อมูลที่อ้างอิงตำแหน่งนี้อยู่'), { status: 409 });
    throw e;
  }
  res.json({ ok: true });
}));

export default router;
