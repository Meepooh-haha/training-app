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

// ---------------- 2A: Training Requests ----------------
router.get('/requests', h((req, res) => {
  // Join course name for list display.
  res.json(
    db
      .prepare(
        `SELECT r.*, c.name_th AS course_name_th
         FROM training_requests r LEFT JOIN courses c ON c.code = r.course_code
         ORDER BY r.created_at DESC, r.id DESC`
      )
      .all()
  );
}));

router.get('/requests/:id', h((req, res) => {
  const r = db.prepare('SELECT * FROM training_requests WHERE id=?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'not found' });
  r.attendees = db.prepare('SELECT * FROM request_attendees WHERE req_id=?').all(r.id);
  r.schedule = db.prepare('SELECT * FROM request_schedule WHERE req_id=? ORDER BY date,start_time').all(r.id);
  res.json(r);
}));

function nextReqNo() {
  const year = new Date().getFullYear();
  const prefix = `TR-${year}-`;
  const row = db
    .prepare(`SELECT req_no FROM training_requests WHERE req_no LIKE ? ORDER BY req_no DESC LIMIT 1`)
    .get(prefix + '%');
  const n = row ? parseInt(row.req_no.slice(prefix.length), 10) + 1 : 1;
  return prefix + String(n).padStart(3, '0');
}

function reqParams(r) {
  return {
    course_code: r.course_code || '',
    training_date: r.training_date || '',
    end_date: r.end_date || '',
    location: r.location || '',
    trainer_name: r.trainer_name || '',
    trainer_org: r.trainer_org || '',
    budget_instructor: Number(r.budget_instructor) || 0,
    budget_venue: Number(r.budget_venue) || 0,
    budget_food: Number(r.budget_food) || 0,
    budget_material: Number(r.budget_material) || 0,
    budget_other: Number(r.budget_other) || 0,
    attendee_count: Number(r.attendee_count) || 0,
    objective: r.objective || '',
    target_group: r.target_group || '',
    status: r.status || 'draft',
    approved_by: r.approved_by || '',
    approved_at: r.approved_at || '',
    notes: r.notes || '',
  };
}

function saveChildren(reqId, r) {
  db.prepare('DELETE FROM request_attendees WHERE req_id=?').run(reqId);
  const a = db.prepare(
    'INSERT INTO request_attendees (req_id,employee_id,name,department,position) VALUES (?,?,?,?,?)'
  );
  (r.attendees || []).forEach((x) =>
    a.run(reqId, x.employee_id || '', x.name || '', x.department || '', x.position || '')
  );

  db.prepare('DELETE FROM request_schedule WHERE req_id=?').run(reqId);
  const s = db.prepare(
    'INSERT INTO request_schedule (req_id,date,start_time,end_time,topic,trainer) VALUES (?,?,?,?,?,?)'
  );
  (r.schedule || []).forEach((x) =>
    s.run(reqId, x.date || '', x.start_time || '', x.end_time || '', x.topic || '', x.trainer || '')
  );
}

const createReq = db.transaction((r) => {
  const reqNo = nextReqNo();
  const info = db
    .prepare(
      `INSERT INTO training_requests
        (req_no,course_code,training_date,end_date,location,trainer_name,trainer_org,
         budget_instructor,budget_venue,budget_food,budget_material,budget_other,
         attendee_count,objective,target_group,status,created_at,approved_by,approved_at,notes)
       VALUES (@req_no,@course_code,@training_date,@end_date,@location,@trainer_name,@trainer_org,
         @budget_instructor,@budget_venue,@budget_food,@budget_material,@budget_other,
         @attendee_count,@objective,@target_group,@status,@created_at,@approved_by,@approved_at,@notes)`
    )
    .run({ ...reqParams(r), req_no: reqNo, created_at: new Date().toISOString().slice(0, 10) });
  saveChildren(info.lastInsertRowid, r);
  return info.lastInsertRowid;
});

const updateReq = db.transaction((id, r) => {
  db.prepare(
    `UPDATE training_requests SET course_code=@course_code,training_date=@training_date,end_date=@end_date,
      location=@location,trainer_name=@trainer_name,trainer_org=@trainer_org,
      budget_instructor=@budget_instructor,budget_venue=@budget_venue,budget_food=@budget_food,
      budget_material=@budget_material,budget_other=@budget_other,attendee_count=@attendee_count,
      objective=@objective,target_group=@target_group,status=@status,approved_by=@approved_by,
      approved_at=@approved_at,notes=@notes WHERE id=@id`
  ).run({ ...reqParams(r), id });
  saveChildren(id, r);
});

router.post('/requests', h((req, res) => {
  const id = createReq(req.body);
  res.json({ ok: true, id });
}));
router.put('/requests/:id', h((req, res) => {
  updateReq(Number(req.params.id), req.body);
  res.json({ ok: true });
}));
router.delete('/requests/:id', h((req, res) => {
  db.prepare('DELETE FROM training_requests WHERE id=?').run(req.params.id);
  res.json({ ok: true });
}));

export default router;
