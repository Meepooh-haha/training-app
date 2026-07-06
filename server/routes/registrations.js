import { Router } from 'express';
import db, { q } from '../db/db.js';

const router = Router();
const h = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (e) { next(e); }
};

// ใบลงทะเบียนของโครงการ — รายชื่อ+เช็คอินอ่านจาก project_participants (single source)
router.get('/registrations/:projectId', h(async (req, res) => {
  const projectId = Number(req.params.projectId);
  const reg = await q.get('SELECT * FROM training_registrations WHERE project_id=?', [projectId]);
  const attendees = await q.all(
    'SELECT * FROM project_participants WHERE project_id=? ORDER BY id',
    [projectId],
  );
  // default วันลงทะเบียน = วันอบรมของโครงการ (ถ้าสรุปแล้ว)
  const project = await q.get(
    'SELECT training_date FROM training_projects WHERE id=?',
    [projectId],
  );
  res.json({
    project_id: projectId,
    reg_date: reg?.reg_date || project?.training_date || new Date().toISOString().slice(0, 10),
    start_time: reg?.start_time || '09:00',
    end_time: reg?.end_time || '',
    attendees,
  });
}));

// บันทึก header + สถานะเช็คอิน/หมายเหตุกลับเข้ารายชื่อกลาง
// (เพิ่ม/ลบรายชื่อทำผ่าน /training-projects/:id/participants)
router.post('/registrations', h(async (req, res) => {
  const body = req.body;
  const projectId = Number(body.project_id);
  if (!projectId) return res.status(400).json({ error: 'project_id is required' });

  const tx = await db.transaction('write');
  try {
    const existing = (await tx.execute({
      sql: 'SELECT id FROM training_registrations WHERE project_id=?',
      args: [projectId],
    })).rows[0];

    let regId;
    if (!existing) {
      const r = await tx.execute({
        sql: 'INSERT INTO training_registrations (project_id,reg_date,start_time,end_time) VALUES (?,?,?,?) RETURNING id',
        args: [projectId, body.reg_date || new Date().toISOString().slice(0, 10), body.start_time || '09:00', body.end_time || ''],
      });
      regId = r.rows[0].id;
    } else {
      regId = existing.id;
      await tx.execute({
        sql: 'UPDATE training_registrations SET reg_date=?,start_time=?,end_time=? WHERE id=?',
        args: [body.reg_date || '', body.start_time || '09:00', body.end_time || '', regId],
      });
    }

    for (const x of (body.attendees || [])) {
      if (!x.id) continue;
      await tx.execute({
        sql: 'UPDATE project_participants SET checked_in=?, note=? WHERE id=? AND project_id=?',
        args: [x.checked_in ? 1 : 0, x.note || '', Number(x.id), projectId],
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
