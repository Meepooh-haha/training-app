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

router.get('/employees', h((req, res) => {
  res.json(db.prepare('SELECT * FROM employees ORDER BY sequence, code').all());
}));

router.post('/employees', h((req, res) => {
  db.prepare(
    `INSERT INTO employees (code,sequence,full_name,nickname,email,position_th,position_en,department,department_id,position_id)
     VALUES (@code,@sequence,@full_name,@nickname,@email,@position_th,@position_en,@department,@department_id,@position_id)`
  ).run(norm(req.body));
  res.json({ ok: true });
}));

router.put('/employees/:code', h((req, res) => {
  db.prepare(
    `UPDATE employees SET sequence=@sequence,full_name=@full_name,nickname=@nickname,
       email=@email,position_th=@position_th,position_en=@position_en,
       department=@department,department_id=@department_id,position_id=@position_id
     WHERE code=@code`
  ).run({ ...norm(req.body), code: req.params.code });
  res.json({ ok: true });
}));

router.delete('/employees/:code', h((req, res) => {
  db.prepare('DELETE FROM employees WHERE code=?').run(req.params.code);
  res.json({ ok: true });
}));

router.post('/employees/import', h((req, res) => {
  const { rows } = req.body;
  if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ error: 'ไม่มีข้อมูล' });
  const stmt = db.prepare(
    `INSERT INTO employees (code,sequence,full_name,nickname,email,position_th,position_en,department)
     VALUES (@code,@sequence,@full_name,@nickname,@email,@position_th,@position_en,@department)
     ON CONFLICT(code) DO UPDATE SET
       sequence=excluded.sequence, full_name=excluded.full_name, nickname=excluded.nickname,
       email=excluded.email, position_th=excluded.position_th,
       position_en=excluded.position_en, department=excluded.department`
  );
  db.transaction((r) => r.forEach((row) => stmt.run(norm(row))))(rows);
  res.json({ count: rows.length });
}));

function norm(b) {
  return {
    code: b.code,
    sequence: Number(b.sequence) || 0,
    full_name: b.full_name || '',
    nickname: b.nickname || '',
    email: b.email || '',
    position_th: b.position_th || '',
    position_en: b.position_en || '',
    department: b.department || '',
    department_id: b.department_id ? Number(b.department_id) : null,
    position_id: b.position_id ? Number(b.position_id) : null,
  };
}

export default router;
