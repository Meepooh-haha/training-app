import { Router } from 'express';
import db, { q } from '../db/db.js';

const router = Router();
const h = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (e) { next(e); }
};

router.get('/registrations/:reqId', h(async (req, res) => {
  const reqId = Number(req.params.reqId);
  const reg = await q.get('SELECT * FROM training_registrations WHERE req_id=?', [reqId]);
  if (!reg) {
    const planned = await q.all(
      'SELECT name,department,position FROM request_attendees WHERE req_id=?',
      [reqId],
    );
    return res.json({
      req_id: reqId,
      reg_date: new Date().toISOString().slice(0, 10),
      attendees: planned.map((p) => ({ ...p, checked_in: 0, note: '' })),
    });
  }
  reg.attendees = await q.all(
    'SELECT * FROM registration_attendees WHERE registration_id=?',
    [reg.id],
  );
  res.json(reg);
}));

router.post('/registrations', h(async (req, res) => {
  const body = req.body;
  const tx = await db.transaction('write');
  try {
    let regId;
    const existing = (await tx.execute({
      sql: 'SELECT id FROM training_registrations WHERE req_id=?',
      args: [body.req_id],
    })).rows[0];

    if (!existing) {
      const r = await tx.execute({
        sql: 'INSERT INTO training_registrations (req_id,reg_date) VALUES (?,?) RETURNING id',
        args: [body.req_id, body.reg_date || new Date().toISOString().slice(0, 10)],
      });
      regId = r.rows[0].id;
    } else {
      regId = existing.id;
      await tx.execute({
        sql: 'UPDATE training_registrations SET reg_date=? WHERE id=?',
        args: [body.reg_date || '', regId],
      });
    }

    await tx.execute({ sql: 'DELETE FROM registration_attendees WHERE registration_id=?', args: [regId] });
    for (const x of (body.attendees || [])) {
      await tx.execute({
        sql: 'INSERT INTO registration_attendees (registration_id,name,department,position,checked_in,note) VALUES (?,?,?,?,?,?)',
        args: [regId, x.name || '', x.department || '', x.position || '', x.checked_in ? 1 : 0, x.note || ''],
      });
    }

    await tx.commit();
    res.json({ ok: true, id: regId });
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}));

export default router;
