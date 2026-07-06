import { Router } from 'express';
import { q } from '../db/db.js';

const router = Router();
const h = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (e) { next(e); }
};

// ── Instructors ───────────────────────────────────────────────────────────────

router.get('/instructors', h(async (req, res) => {
  res.json(await q.all(`
    SELECT i.*,
           v.vendor_name, v.is_registered, v.registered_date,
           v.contact_name AS vendor_contact,
           (SELECT COUNT(*) FROM instructor_topics it WHERE it.instructor_id = i.id) AS topic_count
    FROM instructors i
    LEFT JOIN vendors v ON v.id = i.vendor_id
    ORDER BY i.name
  `));
}));

router.patch('/instructors/:id', h(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await q.get('SELECT id FROM instructors WHERE id = ?', [id]);
  if (!existing) return res.status(404).json({ error: 'ไม่พบวิทยากร' });

  const { name, contact_phone, contact_email, vendor_id, notes } = req.body;
  const fields = [];
  const args   = [];

  if (name          !== undefined) { fields.push('name = ?');          args.push(String(name || '').trim()); }
  if (contact_phone !== undefined) { fields.push('contact_phone = ?'); args.push(contact_phone || null); }
  if (contact_email !== undefined) { fields.push('contact_email = ?'); args.push(contact_email || null); }
  if (vendor_id     !== undefined) { fields.push('vendor_id = ?');     args.push(vendor_id ? Number(vendor_id) : null); }
  if (notes         !== undefined) { fields.push('notes = ?');         args.push(notes || null); }

  if (!fields.length) return res.status(400).json({ error: 'ไม่มีข้อมูลที่ต้องการแก้ไข' });

  args.push(id);
  await q.run(`UPDATE instructors SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, args);
  res.json({ ok: true });
}));

router.delete('/instructors/:id', h(async (req, res) => {
  await q.run('DELETE FROM instructors WHERE id = ?', [Number(req.params.id)]);
  res.json({ ok: true });
}));

// ── Instructor ↔ Topic mapping ─────────────────────────────────────────────────

router.get('/instructors/:id/topics', h(async (req, res) => {
  res.json(await q.all(
    `SELECT t.code, t.name_th, t.name_en, t.type, t.duration_hours, t.duration_minutes
     FROM instructor_topics it
     JOIN training_topics t ON t.code = it.topic_code
     WHERE it.instructor_id = ?
     ORDER BY t.name_th`,
    [Number(req.params.id)],
  ));
}));

router.post('/instructors/:id/topics', h(async (req, res) => {
  const { topic_code } = req.body;
  if (!topic_code) return res.status(400).json({ error: 'ต้องระบุ topic_code' });
  await q.run(
    'INSERT OR IGNORE INTO instructor_topics (instructor_id, topic_code) VALUES (?, ?)',
    [Number(req.params.id), topic_code],
  );
  res.json({ ok: true });
}));

router.delete('/instructors/:id/topics/:code', h(async (req, res) => {
  await q.run(
    'DELETE FROM instructor_topics WHERE instructor_id = ? AND topic_code = ?',
    [Number(req.params.id), req.params.code],
  );
  res.json({ ok: true });
}));

router.post('/instructors', h(async (req, res) => {
  const { source_type, employee_id, name, contact_phone, contact_email, vendor_id, notes } = req.body;

  if (!['internal', 'external'].includes(source_type)) {
    return res.status(400).json({ error: 'source_type ต้องเป็น internal หรือ external' });
  }
  if (source_type === 'internal' && !employee_id) {
    return res.status(400).json({ error: 'internal instructor ต้องระบุ employee_id' });
  }
  if (!String(name || '').trim()) {
    return res.status(400).json({ error: 'ต้องระบุชื่อวิทยากร' });
  }

  const r = await q.run(
    `INSERT INTO instructors (source_type, employee_id, name, contact_phone, contact_email, vendor_id, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      source_type,
      source_type === 'internal' ? (employee_id || null) : null,
      String(name).trim(),
      contact_phone || null,
      contact_email || null,
      source_type === 'external' ? (vendor_id ? Number(vendor_id) : null) : null,
      notes || null,
    ],
  );
  res.json({ id: Number(r.lastInsertRowid) });
}));

// ── Venues ────────────────────────────────────────────────────────────────────

router.get('/venues', h(async (req, res) => {
  res.json(await q.all(`
    SELECT ve.*,
           vn.vendor_name, vn.is_registered, vn.registered_date
    FROM venues ve
    LEFT JOIN vendors vn ON vn.id = ve.vendor_id
    ORDER BY ve.name
  `));
}));

router.patch('/venues/:id', h(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await q.get('SELECT id FROM venues WHERE id = ?', [id]);
  if (!existing) return res.status(404).json({ error: 'ไม่พบสถานที่' });

  const { name, address, capacity, vendor_id, notes } = req.body;
  const fields = [];
  const args   = [];

  if (name      !== undefined) { fields.push('name = ?');      args.push(String(name || '').trim()); }
  if (address   !== undefined) { fields.push('address = ?');   args.push(address || null); }
  if (capacity  !== undefined) { fields.push('capacity = ?');  args.push(capacity ? Number(capacity) : null); }
  if (vendor_id !== undefined) { fields.push('vendor_id = ?'); args.push(vendor_id ? Number(vendor_id) : null); }
  if (notes     !== undefined) { fields.push('notes = ?');     args.push(notes || null); }

  if (!fields.length) return res.status(400).json({ error: 'ไม่มีข้อมูลที่ต้องการแก้ไข' });

  args.push(id);
  await q.run(`UPDATE venues SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, args);
  res.json({ ok: true });
}));

router.delete('/venues/:id', h(async (req, res) => {
  await q.run('DELETE FROM venues WHERE id = ?', [Number(req.params.id)]);
  res.json({ ok: true });
}));

router.post('/venues', h(async (req, res) => {
  const { source_type, name, address, capacity, vendor_id, notes } = req.body;

  if (!['internal', 'external'].includes(source_type)) {
    return res.status(400).json({ error: 'source_type ต้องเป็น internal หรือ external' });
  }
  if (!String(name || '').trim()) {
    return res.status(400).json({ error: 'ต้องระบุชื่อสถานที่' });
  }

  const r = await q.run(
    `INSERT INTO venues (source_type, name, address, capacity, vendor_id, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      source_type,
      String(name).trim(),
      address || null,
      capacity ? Number(capacity) : null,
      source_type === 'external' ? (vendor_id ? Number(vendor_id) : null) : null,
      notes || null,
    ],
  );
  res.json({ id: Number(r.lastInsertRowid) });
}));

// ── Availability slots ────────────────────────────────────────────────────────

router.get('/availability/:trainingProjectId', h(async (req, res) => {
  const pid = Number(req.params.trainingProjectId);

  const slots = await q.all(
    `SELECT
       s.entity_type, s.entity_ref, s.slot_date, s.status, s.note,
       CASE s.entity_type
         WHEN 'participant' THEN e.full_name
         WHEN 'instructor'  THEN i.name
         WHEN 'venue'       THEN v.name
       END AS entity_name,
       CASE s.entity_type
         WHEN 'instructor' THEN i.source_type
         WHEN 'venue'      THEN v.source_type
         ELSE NULL
       END AS source_type
     FROM availability_slots s
     LEFT JOIN employees e   ON s.entity_type = 'participant' AND s.entity_ref = e.code
     LEFT JOIN instructors i ON s.entity_type = 'instructor'  AND s.entity_ref = CAST(i.id AS TEXT)
     LEFT JOIN venues v      ON s.entity_type = 'venue'       AND s.entity_ref = CAST(v.id AS TEXT)
     WHERE s.training_project_id = ?
     ORDER BY s.entity_type, s.entity_ref, s.slot_date`,
    [pid],
  );

  const entities = {};
  for (const slot of slots) {
    const key = `${slot.entity_type}:${slot.entity_ref}`;
    if (!entities[key]) {
      entities[key] = {
        entity_type: slot.entity_type,
        entity_ref:  slot.entity_ref,
        entity_name: slot.entity_name,
        source_type: slot.source_type,
        slots: {},
      };
    }
    entities[key].slots[slot.slot_date] = { status: slot.status, note: slot.note };
  }

  // รายชื่อกลางของโครงการโผล่ในตารางอัตโนมัติ (ไม่ต้องกดเพิ่มซ้ำรอบสอง) —
  // เฉพาะคนที่เลือกจากข้อมูลหลัก (มี employee_code) เท่านั้นที่ติดตามวันว่างได้
  const projParticipants = await q.all(
    `SELECT employee_code, name FROM project_participants
     WHERE project_id = ? AND employee_code IS NOT NULL
     ORDER BY id`,
    [pid],
  );
  for (const p of projParticipants) {
    const key = `participant:${p.employee_code}`;
    if (!entities[key]) {
      entities[key] = {
        entity_type: 'participant',
        entity_ref:  p.employee_code,
        entity_name: p.name,
        source_type: null,
        slots: {},
      };
    }
  }

  const result = { participants: [], instructors: [], venues: [] };
  for (const entity of Object.values(entities)) {
    if (entity.entity_type === 'participant') result.participants.push(entity);
    else if (entity.entity_type === 'instructor') result.instructors.push(entity);
    else result.venues.push(entity);
  }

  res.json(result);
}));

router.post('/availability', h(async (req, res) => {
  const { training_project_id, entity_type, entity_ref, slot_date, status, note } = req.body;

  if (!training_project_id || !entity_type || !entity_ref || !slot_date || !status) {
    return res.status(400).json({ error: 'ข้อมูลไม่ครบ' });
  }
  if (!['participant', 'instructor', 'venue'].includes(entity_type)) {
    return res.status(400).json({ error: 'entity_type ไม่ถูกต้อง' });
  }
  if (!['available', 'unavailable', 'tentative'].includes(status)) {
    return res.status(400).json({ error: 'status ไม่ถูกต้อง' });
  }

  // Validate entity_ref points to a real record
  if (entity_type === 'participant') {
    const emp = await q.get('SELECT code FROM employees WHERE code = ?', [entity_ref]);
    if (!emp) return res.status(400).json({ error: `ไม่พบพนักงาน ${entity_ref}` });
  } else if (entity_type === 'instructor') {
    const inst = await q.get('SELECT id FROM instructors WHERE id = ?', [Number(entity_ref)]);
    if (!inst) return res.status(400).json({ error: `ไม่พบวิทยากร id=${entity_ref}` });
  } else {
    const venue = await q.get('SELECT id FROM venues WHERE id = ?', [Number(entity_ref)]);
    if (!venue) return res.status(400).json({ error: `ไม่พบสถานที่ id=${entity_ref}` });
  }

  await q.run(
    `INSERT INTO availability_slots
       (training_project_id, entity_type, entity_ref, slot_date, status, note, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(training_project_id, entity_type, entity_ref, slot_date)
     DO UPDATE SET status=excluded.status, note=excluded.note, updated_at=CURRENT_TIMESTAMP`,
    [Number(training_project_id), entity_type, String(entity_ref), slot_date, status, note || null],
  );

  res.json({ ok: true });
}));

router.delete('/availability/:projectId/entity/:type/:ref', h(async (req, res) => {
  const pid  = Number(req.params.projectId);
  const type = req.params.type;
  const ref  = req.params.ref;

  if (!['participant', 'instructor', 'venue'].includes(type)) {
    return res.status(400).json({ error: 'entity_type ไม่ถูกต้อง' });
  }

  await q.run(
    'DELETE FROM availability_slots WHERE training_project_id = ? AND entity_type = ? AND entity_ref = ?',
    [pid, type, ref],
  );
  res.json({ ok: true });
}));

// ── Candidate Dates ───────────────────────────────────────────────────────────

router.get('/candidate-dates/:projectId', h(async (req, res) => {
  const pid = Number(req.params.projectId);
  res.json(await q.all(
    'SELECT * FROM candidate_dates WHERE training_project_id = ? ORDER BY date',
    [pid],
  ));
}));

router.post('/candidate-dates', h(async (req, res) => {
  const { training_project_id, date, note } = req.body;
  if (!training_project_id || !date) {
    return res.status(400).json({ error: 'ข้อมูลไม่ครบ' });
  }
  const r = await q.run(
    'INSERT OR IGNORE INTO candidate_dates (training_project_id, date, note) VALUES (?, ?, ?)',
    [Number(training_project_id), date, note || null],
  );
  res.json({ id: Number(r.lastInsertRowid) });
}));

router.delete('/candidate-dates/:id', h(async (req, res) => {
  await q.run('DELETE FROM candidate_dates WHERE id = ?', [Number(req.params.id)]);
  res.json({ ok: true });
}));

// ── Ranking ───────────────────────────────────────────────────────────────────

router.get('/availability/:trainingProjectId/ranking', h(async (req, res) => {
  const pid = Number(req.params.trainingProjectId);

  const rows = await q.all(
    `WITH
      candidates AS (
        SELECT id, date FROM candidate_dates WHERE training_project_id = ?
      ),
      instructor_check AS (
        SELECT slot_date,
          MIN(CASE WHEN status = 'unavailable' THEN 0 ELSE 1 END) AS ok
        FROM availability_slots
        WHERE training_project_id = ? AND entity_type = 'instructor'
          AND slot_date IN (SELECT date FROM candidates)
        GROUP BY slot_date
      ),
      venue_check AS (
        SELECT slot_date,
          MIN(CASE WHEN status = 'unavailable' THEN 0 ELSE 1 END) AS ok
        FROM availability_slots
        WHERE training_project_id = ? AND entity_type = 'venue'
          AND slot_date IN (SELECT date FROM candidates)
        GROUP BY slot_date
      ),
      participant_counts AS (
        SELECT slot_date,
          SUM(CASE WHEN status = 'available'   THEN 1 ELSE 0 END) AS avail,
          SUM(CASE WHEN status = 'unavailable' THEN 1 ELSE 0 END) AS unavail,
          SUM(CASE WHEN status = 'tentative'   THEN 1 ELSE 0 END) AS tentative,
          COUNT(*) AS total
        FROM availability_slots
        WHERE training_project_id = ? AND entity_type = 'participant'
          AND slot_date IN (SELECT date FROM candidates)
        GROUP BY slot_date
      )
    SELECT
      c.id   AS candidate_id,
      c.date,
      COALESCE(ic.ok, 1)       AS instructor_ok,
      COALESCE(vc.ok, 1)       AS venue_ok,
      COALESCE(pc.avail, 0)    AS participant_available,
      COALESCE(pc.unavail, 0)  AS participant_unavailable,
      COALESCE(pc.tentative, 0) AS participant_tentative,
      COALESCE(pc.total, 0)    AS participant_total
    FROM candidates c
    LEFT JOIN instructor_check  ic ON ic.slot_date = c.date
    LEFT JOIN venue_check       vc ON vc.slot_date = c.date
    LEFT JOIN participant_counts pc ON pc.slot_date = c.date
    ORDER BY
      (COALESCE(ic.ok,1) * COALESCE(vc.ok,1)) DESC,
      COALESCE(pc.avail, 0) DESC,
      c.date ASC`,
    [pid, pid, pid, pid],
  );

  res.json(rows);
}));

export default router;
