import { Router } from 'express';
import db, { q } from '../db/db.js';

const router = Router();
const h = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (e) { next(e); }
};

router.get('/requests', h(async (req, res) => {
  res.json(await q.all(
    `SELECT r.*, c.name_th AS course_name_th
     FROM training_requests r LEFT JOIN courses c ON c.code = r.course_code
     ORDER BY r.created_at DESC, r.id DESC`,
  ));
}));

router.get('/requests/:id', h(async (req, res) => {
  const r = await q.get('SELECT * FROM training_requests WHERE id=?', [req.params.id]);
  if (!r) return res.status(404).json({ error: 'not found' });
  r.attendees = await q.all('SELECT * FROM request_attendees WHERE req_id=?', [r.id]);
  r.schedule = await q.all(
    'SELECT * FROM request_schedule WHERE req_id=? ORDER BY date,start_time',
    [r.id],
  );
  res.json(r);
}));

async function nextReqNo(tx) {
  const year = new Date().getFullYear();
  const prefix = `TR-${year}-`;
  const row = (await tx.execute({
    sql: 'SELECT req_no FROM training_requests WHERE req_no LIKE ? ORDER BY req_no DESC LIMIT 1',
    args: [prefix + '%'],
  })).rows[0];
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

async function saveChildren(tx, reqId, r) {
  await tx.execute({ sql: 'DELETE FROM request_attendees WHERE req_id=?', args: [reqId] });
  for (const x of (r.attendees || [])) {
    await tx.execute({
      sql: 'INSERT INTO request_attendees (req_id,employee_id,name,department,position) VALUES (?,?,?,?,?)',
      args: [reqId, x.employee_id || '', x.name || '', x.department || '', x.position || ''],
    });
  }
  await tx.execute({ sql: 'DELETE FROM request_schedule WHERE req_id=?', args: [reqId] });
  for (const x of (r.schedule || [])) {
    await tx.execute({
      sql: 'INSERT INTO request_schedule (req_id,date,start_time,end_time,topic,trainer) VALUES (?,?,?,?,?,?)',
      args: [reqId, x.date || '', x.start_time || '', x.end_time || '', x.topic || '', x.trainer || ''],
    });
  }
}

router.post('/requests', h(async (req, res) => {
  const tx = await db.transaction('write');
  try {
    const reqNo = await nextReqNo(tx);
    const r = await tx.execute({
      sql: `INSERT INTO training_requests
              (req_no,course_code,training_date,end_date,location,trainer_name,trainer_org,
               budget_instructor,budget_venue,budget_food,budget_material,budget_other,
               attendee_count,objective,target_group,status,created_at,approved_by,approved_at,notes)
            VALUES (@req_no,@course_code,@training_date,@end_date,@location,@trainer_name,@trainer_org,
               @budget_instructor,@budget_venue,@budget_food,@budget_material,@budget_other,
               @attendee_count,@objective,@target_group,@status,@created_at,@approved_by,@approved_at,@notes)
            RETURNING id`,
      args: { ...reqParams(req.body), req_no: reqNo, created_at: new Date().toISOString().slice(0, 10) },
    });
    const id = r.rows[0].id;
    await saveChildren(tx, id, req.body);
    await tx.commit();
    res.json({ ok: true, id });
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}));

router.put('/requests/:id', h(async (req, res) => {
  const id = Number(req.params.id);
  const tx = await db.transaction('write');
  try {
    await tx.execute({
      sql: `UPDATE training_requests SET course_code=@course_code,training_date=@training_date,end_date=@end_date,
              location=@location,trainer_name=@trainer_name,trainer_org=@trainer_org,
              budget_instructor=@budget_instructor,budget_venue=@budget_venue,budget_food=@budget_food,
              budget_material=@budget_material,budget_other=@budget_other,attendee_count=@attendee_count,
              objective=@objective,target_group=@target_group,status=@status,approved_by=@approved_by,
              approved_at=@approved_at,notes=@notes WHERE id=@id`,
      args: { ...reqParams(req.body), id },
    });
    await saveChildren(tx, id, req.body);
    await tx.commit();
    res.json({ ok: true });
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}));

router.delete('/requests/:id', h(async (req, res) => {
  await q.run('DELETE FROM training_requests WHERE id=?', [req.params.id]);
  res.json({ ok: true });
}));

export default router;
