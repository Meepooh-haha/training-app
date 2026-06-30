import { Router } from 'express';
import { q } from '../db/db.js';

const router = Router();
const h = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (e) { next(e); }
};

router.get('/positions', h(async (req, res) => {
  const { department_id } = req.query;
  const sql = `
    SELECT p.*, d.name AS department_name
    FROM positions p
    LEFT JOIN departments d ON p.department_id = d.id
    ${department_id ? 'WHERE p.department_id=?' : ''}
    ORDER BY p.code
  `;
  res.json(await q.all(sql, department_id ? [department_id] : []));
}));

router.post('/positions', h(async (req, res) => {
  const { code, name, name_en, level, department_id } = req.body;
  await q.run(
    'INSERT INTO positions (code, name, name_en, level, department_id) VALUES (@code, @name, @name_en, @level, @department_id)',
    { code, name, name_en: name_en || '', level: level || '', department_id: department_id || null },
  );
  res.json({ ok: true });
}));

router.put('/positions/:id', h(async (req, res) => {
  const { name, name_en, level, department_id } = req.body;
  await q.run(
    'UPDATE positions SET name=@name, name_en=@name_en, level=@level, department_id=@department_id WHERE id=@id',
    { name, name_en: name_en || '', level: level || '', department_id: department_id || null, id: req.params.id },
  );
  res.json({ ok: true });
}));

router.delete('/positions/:id', h(async (req, res) => {
  try {
    await q.run('DELETE FROM positions WHERE id=?', [req.params.id]);
  } catch (e) {
    if (e.message && e.message.includes('FOREIGN KEY constraint failed')) {
      throw Object.assign(new Error('ไม่สามารถลบได้ เนื่องจากมีข้อมูลที่อ้างอิงตำแหน่งนี้อยู่'), { status: 409 });
    }
    throw e;
  }
  res.json({ ok: true });
}));

export default router;
