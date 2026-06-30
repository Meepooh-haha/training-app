import { Router } from 'express';
import { q } from '../db/db.js';

const router = Router();
const h = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (e) { next(e); }
};

router.get('/gap-analysis', h(async (req, res) => {
  const { department_id, position_id, employee_code } = req.query;
  let sql = 'SELECT * FROM v_competency_gap WHERE 1=1';
  const args = [];
  if (department_id) { sql += ' AND department_id=?'; args.push(department_id); }
  if (position_id)   { sql += ' AND position_id=?';   args.push(position_id); }
  if (employee_code) { sql += ' AND employee_code=?';  args.push(employee_code); }
  sql += ` ORDER BY
    CASE priority WHEN 'urgent' THEN 1 WHEN 'not_assessed' THEN 2 WHEN 'develop' THEN 3 ELSE 4 END,
    employee_name, competency_code`;
  res.json(await q.all(sql, args));
}));

router.get('/roadmap/:employee_code', h(async (req, res) => {
  res.json(await q.all(
    `SELECT er.*,
            c.competency_code, c.name AS competency_name, c.type AS competency_type,
            co.name_th AS course_name
     FROM employee_roadmaps er
     JOIN competencies c ON er.competency_id = c.id
     LEFT JOIN courses co ON er.course_code = co.code
     WHERE er.employee_code = ?
     ORDER BY er.priority_order, er.id`,
    [req.params.employee_code],
  ));
}));

router.post('/roadmap/:employee_code', h(async (req, res) => {
  const { competency_id, course_code, priority_order, status, target_quarter, notes } = req.body;
  await q.run(
    `INSERT INTO employee_roadmaps
       (employee_code, competency_id, course_code, priority_order, status, target_quarter, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(employee_code, competency_id) DO UPDATE SET
       course_code=excluded.course_code,
       priority_order=excluded.priority_order,
       status=excluded.status,
       target_quarter=excluded.target_quarter,
       notes=excluded.notes,
       updated_at=CURRENT_TIMESTAMP`,
    [req.params.employee_code, competency_id, course_code || null,
     priority_order || 1, status || 'not_started', target_quarter || '', notes || ''],
  );
  res.json({ ok: true });
}));

router.put('/roadmap/:employee_code/:id', h(async (req, res) => {
  const { status, target_quarter, course_code, notes } = req.body;
  await q.run(
    `UPDATE employee_roadmaps
     SET status=?, target_quarter=?, course_code=?, notes=?, updated_at=CURRENT_TIMESTAMP
     WHERE id=? AND employee_code=?`,
    [status, target_quarter || '', course_code || null, notes || '',
     req.params.id, req.params.employee_code],
  );
  res.json({ ok: true });
}));

router.delete('/roadmap/:employee_code/:id', h(async (req, res) => {
  await q.run(
    'DELETE FROM employee_roadmaps WHERE id=? AND employee_code=?',
    [req.params.id, req.params.employee_code],
  );
  res.json({ ok: true });
}));

export default router;
