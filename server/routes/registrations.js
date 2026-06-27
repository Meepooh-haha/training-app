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

// ---------------- 2B: Registration ----------------
// One registration per request (upsert). GET returns existing, or seeds the
// attendee list from the request's planned attendees when none exists yet.
router.get('/registrations/:reqId', h((req, res) => {
  const reqId = Number(req.params.reqId);
  let reg = db.prepare('SELECT * FROM training_registrations WHERE req_id=?').get(reqId);
  if (!reg) {
    const planned = db.prepare('SELECT name,department,position FROM request_attendees WHERE req_id=?').all(reqId);
    return res.json({
      req_id: reqId,
      reg_date: new Date().toISOString().slice(0, 10),
      attendees: planned.map((p) => ({ ...p, checked_in: 0, note: '' })),
    });
  }
  reg.attendees = db.prepare('SELECT * FROM registration_attendees WHERE registration_id=?').all(reg.id);
  res.json(reg);
}));

const saveReg = db.transaction((body) => {
  let reg = db.prepare('SELECT * FROM training_registrations WHERE req_id=?').get(body.req_id);
  if (!reg) {
    const info = db
      .prepare('INSERT INTO training_registrations (req_id,reg_date) VALUES (?,?)')
      .run(body.req_id, body.reg_date || new Date().toISOString().slice(0, 10));
    reg = { id: info.lastInsertRowid };
  } else {
    db.prepare('UPDATE training_registrations SET reg_date=? WHERE id=?').run(body.reg_date || '', reg.id);
  }
  db.prepare('DELETE FROM registration_attendees WHERE registration_id=?').run(reg.id);
  const a = db.prepare(
    'INSERT INTO registration_attendees (registration_id,name,department,position,checked_in,note) VALUES (?,?,?,?,?,?)'
  );
  (body.attendees || []).forEach((x) =>
    a.run(reg.id, x.name || '', x.department || '', x.position || '', x.checked_in ? 1 : 0, x.note || '')
  );
  return reg.id;
});

router.post('/registrations', h((req, res) => {
  const id = saveReg(req.body);
  res.json({ ok: true, id });
}));

export default router;
