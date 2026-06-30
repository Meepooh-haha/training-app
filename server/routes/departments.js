import { Router } from 'express';
import { q } from '../db/db.js';

const router = Router();
const h = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (e) { next(e); }
};

router.get('/departments', h(async (req, res) => {
  res.json(await q.all('SELECT * FROM departments ORDER BY code'));
}));

router.post('/departments', h(async (req, res) => {
  const { code, name, name_en } = req.body;
  await q.run(
    'INSERT INTO departments (code, name, name_en) VALUES (@code, @name, @name_en)',
    { code, name, name_en: name_en || '' },
  );
  res.json({ ok: true });
}));

router.put('/departments/:id', h(async (req, res) => {
  const { name, name_en } = req.body;
  await q.run(
    'UPDATE departments SET name=@name, name_en=@name_en WHERE id=@id',
    { name, name_en: name_en || '', id: req.params.id },
  );
  res.json({ ok: true });
}));

router.delete('/departments/:id', h(async (req, res) => {
  try {
    await q.run('DELETE FROM departments WHERE id=?', [req.params.id]);
  } catch (e) {
    if (e.message && e.message.includes('FOREIGN KEY constraint failed')) {
      throw Object.assign(new Error('ไม่สามารถลบได้ เนื่องจากมีตำแหน่งงานที่อ้างอิงฝ่ายนี้อยู่'), { status: 409 });
    }
    throw e;
  }
  res.json({ ok: true });
}));

export default router;
