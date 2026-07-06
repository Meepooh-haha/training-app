import { Router } from 'express';
import db, { q } from '../db/db.js';

const router = Router();
const h = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (e) { next(e); }
};

router.get('/employees', h(async (req, res) => {
  res.json(await q.all('SELECT * FROM employees ORDER BY sequence, code'));
}));

router.post('/employees', h(async (req, res) => {
  await q.run(
    `INSERT INTO employees (code,sequence,full_name,nickname,email,position_th,position_en,department,department_id,position_id,national_id)
     VALUES (@code,@sequence,@full_name,@nickname,@email,@position_th,@position_en,@department,@department_id,@position_id,@national_id)`,
    norm(req.body),
  );
  res.json({ ok: true });
}));

router.put('/employees/:code', h(async (req, res) => {
  await q.run(
    `UPDATE employees SET sequence=@sequence,full_name=@full_name,nickname=@nickname,
       email=@email,position_th=@position_th,position_en=@position_en,
       department=@department,department_id=@department_id,position_id=@position_id,
       national_id=@national_id
     WHERE code=@code`,
    { ...norm(req.body), code: req.params.code },
  );
  res.json({ ok: true });
}));

router.delete('/employees/:code', h(async (req, res) => {
  await q.run('DELETE FROM employees WHERE code=?', [req.params.code]);
  res.json({ ok: true });
}));

router.post('/employees/import', h(async (req, res) => {
  const { rows } = req.body;
  if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ error: 'ไม่มีข้อมูล' });
  await db.batch(
    rows.map((row) => ({
      sql: `INSERT INTO employees (code,sequence,full_name,nickname,email,position_th,position_en,department)
            VALUES (@code,@sequence,@full_name,@nickname,@email,@position_th,@position_en,@department)
            ON CONFLICT(code) DO UPDATE SET
              sequence=excluded.sequence,full_name=excluded.full_name,nickname=excluded.nickname,
              email=excluded.email,position_th=excluded.position_th,
              position_en=excluded.position_en,department=excluded.department`,
      args: norm(row),
    })),
    'write',
  );
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
    national_id: String(b.national_id || '').replace(/[^0-9]/g, '') || null,
  };
}

export default router;
