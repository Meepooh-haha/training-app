import { Router } from 'express';
import { q } from '../db/db.js';

const router = Router();
const h = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (e) { next(e); }
};

router.get('/training-projects/:id', h(async (req, res) => {
  const row = await q.get(
    'SELECT * FROM training_projects WHERE id = ?',
    [Number(req.params.id)],
  );
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(row);
}));

router.get('/training-projects', h(async (req, res) => {
  const { year } = req.query;
  const rows = await q.all(
    year
      ? 'SELECT * FROM training_projects WHERE year = ? ORDER BY quarter, order_index, id'
      : 'SELECT * FROM training_projects ORDER BY year DESC, quarter, order_index, id',
    year ? [Number(year)] : [],
  );
  res.json(rows);
}));

router.post('/training-projects', h(async (req, res) => {
  const p = norm(req.body);
  const r = await q.run(
    `INSERT INTO training_projects
       (name, description, course_code, request_id, quarter, year, current_step, participant_count, order_index, notes)
     VALUES
       (@name, @description, @course_code, @request_id, @quarter, @year, @current_step, @participant_count, @order_index, @notes)`,
    p,
  );
  res.json({ id: Number(r.lastInsertRowid) });
}));

router.put('/training-projects/:id', h(async (req, res) => {
  const p = norm(req.body);
  await q.run(
    `UPDATE training_projects
     SET name=@name, description=@description, course_code=@course_code, request_id=@request_id,
         quarter=@quarter, year=@year, current_step=@current_step,
         participant_count=@participant_count, order_index=@order_index, notes=@notes,
         updated_at=CURRENT_TIMESTAMP
     WHERE id=@id`,
    { ...p, id: Number(req.params.id) },
  );
  res.json({ ok: true });
}));

router.patch('/training-projects/:id/details', h(async (req, res) => {
  const name        = String(req.body.name || '').trim();
  const description = String(req.body.description || '').trim();
  const notes       = String(req.body.notes || '').trim();
  if (!name) return res.status(400).json({ error: 'name is required' });
  await q.run(
    `UPDATE training_projects
     SET name=?, description=?, notes=?, updated_at=CURRENT_TIMESTAMP
     WHERE id=?`,
    [name, description, notes, Number(req.params.id)],
  );
  res.json({ ok: true });
}));

router.patch('/training-projects/:id/step', h(async (req, res) => {
  const step = Number(req.body.step);
  if (!step || step < 1 || step > 6) {
    return res.status(400).json({ error: 'step must be 1–6' });
  }
  await q.run(
    'UPDATE training_projects SET current_step=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [step, Number(req.params.id)],
  );
  res.json({ ok: true });
}));

router.delete('/training-projects/:id', h(async (req, res) => {
  await q.run('DELETE FROM training_projects WHERE id=?', [Number(req.params.id)]);
  res.json({ ok: true });
}));

// Vendor registration check for all external instructors in a project
router.get('/training-projects/:id/vendor-check', h(async (req, res) => {
  const projectId = Number(req.params.id);

  const slots = await q.all(
    "SELECT DISTINCT entity_ref FROM availability_slots WHERE training_project_id = ? AND entity_type = 'instructor'",
    [projectId],
  );

  if (slots.length === 0) {
    return res.json({ total_external: 0, linked: 0, registered: 0, status: 'none', instructors: [] });
  }

  const instructors = [];
  for (const slot of slots) {
    const inst = await q.get(
      `SELECT i.id, i.name, i.source_type, i.vendor_id,
              v.vendor_name, v.is_registered, v.registered_date,
              v.contact_name, v.contact_phone
       FROM instructors i
       LEFT JOIN vendors v ON v.id = i.vendor_id
       WHERE i.id = ?`,
      [Number(slot.entity_ref)],
    );
    if (inst && inst.source_type === 'external') instructors.push(inst);
  }

  if (instructors.length === 0) {
    return res.json({ total_external: 0, linked: 0, registered: 0, status: 'none', instructors: [] });
  }

  const linked     = instructors.filter(i => i.vendor_id).length;
  const registered = instructors.filter(i => i.is_registered === 1).length;
  const status     = registered === instructors.length ? 'ok' : 'warning';

  res.json({ total_external: instructors.length, linked, registered, status, instructors });
}));

function norm(b) {
  const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
  return {
    name:              String(b.name || '').trim(),
    description:       String(b.description || '').trim(),
    course_code:       b.course_code || null,
    request_id:        b.request_id ? Number(b.request_id) : null,
    quarter:           QUARTERS.includes(b.quarter) ? b.quarter : 'Q1',
    year:              Number(b.year) || 2569,
    current_step:      Math.max(1, Math.min(4, Number(b.current_step) || 1)),
    participant_count: Math.max(0, Number(b.participant_count) || 0),
    order_index:       Number(b.order_index) || 0,
    notes:             String(b.notes || '').trim(),
  };
}

export default router;
