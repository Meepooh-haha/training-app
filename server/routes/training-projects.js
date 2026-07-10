import { Router } from 'express';
import db, { q } from '../db/db.js';

const router = Router();
const h = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (e) { next(e); }
};

// participant_count คำนวณจาก project_participants เสมอ — ไม่มีคอลัมน์ซ้ำซ้อน
const PROJECT_SELECT = `
  SELECT p.*, c.name_th AS course_name_th, c.name_en AS course_name_en,
         c.duration_hours AS course_duration_hours, c.duration_minutes AS course_duration_minutes,
         c.send_to_dsd AS course_send_to_dsd,
         (SELECT COUNT(*) FROM project_participants pp WHERE pp.project_id = p.id) AS participant_count
  FROM training_projects p
  LEFT JOIN courses c ON c.code = p.course_code
`;

router.get('/training-projects/:id([0-9]+)', h(async (req, res) => {
  const row = await q.get(`${PROJECT_SELECT} WHERE p.id = ?`, [Number(req.params.id)]);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(row);
}));

router.get('/training-projects', h(async (req, res) => {
  const { year } = req.query;
  const rows = await q.all(
    year
      ? `${PROJECT_SELECT} WHERE p.year = ? ORDER BY p.quarter, p.order_index, p.id`
      : `${PROJECT_SELECT} ORDER BY p.year DESC, p.quarter, p.order_index, p.id`,
    year ? [Number(year)] : [],
  );
  res.json(rows);
}));

// เลขที่ใบขอ TR-<ค.ศ.>-NNN ต่อเนื่องตามปี (ยังใช้แพทเทิร์นเดิมจาก training_requests)
async function nextReqNo(tx) {
  const year = new Date().getFullYear();
  const prefix = `TR-${year}-`;
  const row = (await tx.execute({
    sql: 'SELECT req_no FROM training_projects WHERE req_no LIKE ? ORDER BY req_no DESC LIMIT 1',
    args: [prefix + '%'],
  })).rows[0];
  const n = row ? parseInt(row.req_no.slice(prefix.length), 10) + 1 : 1;
  return prefix + String(n).padStart(3, '0');
}

const COMPETENCY_TYPES = ['organizational', 'functional', 'leadership'];
const DELIVERY_TYPES = ['inhouse', 'public'];

// สร้างโครงการแบบ course-first: ระบุ course_code แล้วชื่อ auto-fill จากหลักสูตรถ้าไม่ส่งมา
// competency_type ไม่ส่งมา = สืบทอดจากหลักสูตรใน Setup
router.post('/training-projects', h(async (req, res) => {
  const b = req.body;
  const course = b.course_code
    ? await q.get('SELECT code, name_th, detail, competency_type FROM courses WHERE code = ?', [b.course_code])
    : null;
  if (b.course_code && !course) return res.status(400).json({ error: 'ไม่พบหลักสูตรที่เลือก' });

  const name = String(b.name || '').trim() || course?.name_th || '';
  if (!name) return res.status(400).json({ error: 'ต้องเลือกหลักสูตรหรือระบุชื่อโครงการ' });

  const competencyType = COMPETENCY_TYPES.includes(b.competency_type)
    ? b.competency_type
    : (COMPETENCY_TYPES.includes(course?.competency_type) ? course.competency_type : null);
  const deliveryType = DELIVERY_TYPES.includes(b.delivery_type) ? b.delivery_type : 'inhouse';

  const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
  const tx = await db.transaction('write');
  try {
    const reqNo = await nextReqNo(tx);
    const r = await tx.execute({
      sql: `INSERT INTO training_projects
              (name, description, course_code, quarter, year, req_no, target_group, competency_type, delivery_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      args: [
        name,
        String(b.description || '').trim(),
        course?.code || null,
        QUARTERS.includes(b.quarter) ? b.quarter : 'Q1',
        Number(b.year) || new Date().getFullYear() + 543,
        reqNo,
        String(b.target_group || '').trim(),
        competencyType,
        deliveryType,
      ],
    });
    await tx.commit();
    res.json({ id: Number(r.rows[0].id), req_no: reqNo });
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}));

// แก้รายละเอียดโครงการ + ฟิลด์ใบขอ (วันที่ งบ วัตถุประสงค์ สถานที่ วิทยากร)
router.patch('/training-projects/:id/details', h(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await q.get('SELECT id FROM training_projects WHERE id = ?', [id]);
  if (!existing) return res.status(404).json({ error: 'not found' });

  const FIELDS = {
    name:              (v) => String(v).trim(),
    description:       (v) => String(v).trim(),
    notes:             (v) => String(v).trim(),
    course_code:       (v) => v || null,
    quarter:           (v) => (['Q1', 'Q2', 'Q3', 'Q4'].includes(v) ? v : 'Q1'),
    year:              (v) => Number(v) || new Date().getFullYear() + 543,
    training_date:     (v) => v || null,
    end_date:          (v) => v || null,
    location:          (v) => String(v ?? '').trim(),
    trainer_name:      (v) => String(v ?? '').trim(),
    trainer_org:       (v) => String(v ?? '').trim(),
    budget_instructor: (v) => Number(v) || 0,
    budget_venue:      (v) => Number(v) || 0,
    budget_food:       (v) => Number(v) || 0,
    budget_material:   (v) => Number(v) || 0,
    budget_other:      (v) => Number(v) || 0,
    objective:         (v) => String(v ?? '').trim(),
    target_group:      (v) => String(v ?? '').trim(),
    success_quantitative: (v) => String(v ?? '').trim(),
    success_qualitative:  (v) => String(v ?? '').trim(),
    dsd_deadline:      (v) => v || null,
    dsd_submitted:     (v) => (v ? 1 : 0),
    dsd_approved:      (v) => (v ? 1 : 0),
    order_index:       (v) => Number(v) || 0,
    competency_type:   (v) => (COMPETENCY_TYPES.includes(v) ? v : null),
    delivery_type:     (v) => (DELIVERY_TYPES.includes(v) ? v : 'inhouse'),
  };

  const sets = [];
  const args = [];
  for (const [key, normalize] of Object.entries(FIELDS)) {
    if (key in req.body) {
      const val = normalize(req.body[key]);
      if (key === 'name' && !val) return res.status(400).json({ error: 'name is required' });
      sets.push(`${key} = ?`);
      args.push(val);
    }
  }
  if (!sets.length) return res.status(400).json({ error: 'no fields to update' });

  args.push(id);
  await q.run(
    `UPDATE training_projects SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    args,
  );
  res.json({ ok: true });
}));

// บันทึกผลอนุมัติ (HRD บันทึกเองหลัง Memo ถูกเซ็นบนกระดาษ)
router.patch('/training-projects/:id/approval', h(async (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body.approval_status || '');
  if (!['draft', 'pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'approval_status ไม่ถูกต้อง' });
  }
  await q.run(
    `UPDATE training_projects
     SET approval_status = ?, approved_by = ?, approved_at = ?,
         approval_file = COALESCE(?, approval_file),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      status,
      String(req.body.approved_by ?? '').trim(),
      req.body.approved_at || (status === 'approved' ? new Date().toISOString().slice(0, 10) : null),
      req.body.approval_file || null,
      id,
    ],
  );
  res.json({ ok: true });
}));

router.patch('/training-projects/:id/step', h(async (req, res) => {
  const step = Number(req.body.step);
  if (!step || step < 1 || step > 4) {
    return res.status(400).json({ error: 'step must be 1–4' });
  }
  await q.run(
    'UPDATE training_projects SET current_step=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
    [step, Number(req.params.id)],
  );
  res.json({ ok: true });
}));

router.delete('/training-projects/:id', h(async (req, res) => {
  // PRAGMA session-level: ต้องอยู่ batch เดียวกันเพื่อให้ ON DELETE CASCADE ทำงาน
  // เลข PR ใน ledger ห้ามหาย — ปลดลิงก์ก่อนลบ (DB เก่าที่ ALTER เพิ่มคอลัมน์
  // ไม่มี ON DELETE SET NULL จึงลบตรง ๆ ไม่ได้)
  await db.batch([
    'PRAGMA foreign_keys = ON',
    { sql: 'UPDATE purchase_requisitions SET project_id=NULL WHERE project_id=?', args: [Number(req.params.id)] },
    { sql: 'UPDATE invoice_extractions SET project_id=NULL WHERE project_id=?', args: [Number(req.params.id)] },
    { sql: 'DELETE FROM training_projects WHERE id=?', args: [Number(req.params.id)] },
  ], 'write');
  res.json({ ok: true });
}));

// ---------- รายชื่อผู้เข้าอบรมกลาง (single source ทุก phase) ----------

router.get('/training-projects/:id/participants', h(async (req, res) => {
  res.json(await q.all(
    'SELECT * FROM project_participants WHERE project_id = ? ORDER BY id',
    [Number(req.params.id)],
  ));
}));

// เพิ่มได้ทีละหลายคน: { participants: [{ employee_code } | { name, department, position }] }
// employee_code จะดึงชื่อ/ฝ่าย/ตำแหน่ง snapshot จาก Setup ให้เอง
router.post('/training-projects/:id/participants', h(async (req, res) => {
  const projectId = Number(req.params.id);
  const list = Array.isArray(req.body.participants) ? req.body.participants : [req.body];
  const tx = await db.transaction('write');
  try {
    let added = 0;
    for (const p of list) {
      if (p.employee_code) {
        const emp = await tx.execute({
          sql: 'SELECT code, full_name, department, position_th FROM employees WHERE code = ?',
          args: [p.employee_code],
        }).then((r) => r.rows[0]);
        if (!emp) continue;
        const r = await tx.execute({
          sql: `INSERT OR IGNORE INTO project_participants (project_id, employee_code, name, department, position)
                VALUES (?, ?, ?, ?, ?)`,
          args: [projectId, emp.code, emp.full_name, emp.department || '', emp.position_th || ''],
        });
        added += Number(r.rowsAffected) || 0;
      } else if (String(p.name || '').trim()) {
        await tx.execute({
          sql: `INSERT INTO project_participants (project_id, employee_code, name, department, position)
                VALUES (?, NULL, ?, ?, ?)`,
          args: [projectId, String(p.name).trim(), String(p.department || ''), String(p.position || '')],
        });
        added++;
      }
    }
    await tx.commit();
    res.json({ ok: true, added });
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}));

router.patch('/training-projects/:id/participants/:pid', h(async (req, res) => {
  const sets = [];
  const args = [];
  if ('checked_in' in req.body) { sets.push('checked_in = ?'); args.push(req.body.checked_in ? 1 : 0); }
  if ('note' in req.body)       { sets.push('note = ?');       args.push(String(req.body.note ?? '')); }
  if ('name' in req.body)       { sets.push('name = ?');       args.push(String(req.body.name ?? '').trim()); }
  if ('department' in req.body) { sets.push('department = ?'); args.push(String(req.body.department ?? '')); }
  if ('position' in req.body)   { sets.push('position = ?');   args.push(String(req.body.position ?? '')); }
  if (!sets.length) return res.status(400).json({ error: 'no fields to update' });
  args.push(Number(req.params.pid), Number(req.params.id));
  await q.run(
    `UPDATE project_participants SET ${sets.join(', ')} WHERE id = ? AND project_id = ?`,
    args,
  );
  res.json({ ok: true });
}));

router.delete('/training-projects/:id/participants/:pid', h(async (req, res) => {
  await q.run(
    'DELETE FROM project_participants WHERE id = ? AND project_id = ?',
    [Number(req.params.pid), Number(req.params.id)],
  );
  res.json({ ok: true });
}));

// ---------- กำหนดการ Phase 2 (ตัวคำนวณอยู่ client: coursePlanUtils.computeSchedule) ----------

// คืนกำหนดการที่บันทึกไว้ ถ้ายังไม่มี → seed หัวข้อจากหลักสูตรของโครงการ (ยังไม่บันทึก)
router.get('/training-projects/:id/schedule', h(async (req, res) => {
  const id = Number(req.params.id);
  const project = await q.get(
    `SELECT course_code, training_date, schedule_date_mode, schedule_start_time, schedule_hours_per_day,
            schedule_lunch_start, schedule_lunch_end
     FROM training_projects WHERE id = ?`,
    [id],
  );
  if (!project) return res.status(404).json({ error: 'not found' });

  const settings = {
    date_mode: project.schedule_date_mode || 'single',
    daily_start_time: project.schedule_start_time || '09:00',
    hours_per_day: project.schedule_hours_per_day ?? 6,
    lunch_start: project.schedule_lunch_start ?? '12:00',
    lunch_end: project.schedule_lunch_end ?? '13:00',
    start_date: project.training_date || null,
  };

  const saved = await q.all(
    'SELECT * FROM project_schedule WHERE project_id = ? ORDER BY sequence, id',
    [id],
  );
  if (saved.length) return res.json({ ...settings, seeded: false, topics: saved });

  // seed จาก Setup: หัวข้อของหลักสูตร + ระยะเวลาจาก master หัวข้ออบรม
  let topics = [];
  if (project.course_code) {
    topics = await q.all(
      `SELECT ct.topic_code,
              COALESCE(t.name_th, ct.topic_code) AS topic_name,
              ct.sequence,
              COALESCE(t.subtopics, '') AS subtopics,
              COALESCE(
                NULLIF(COALESCE(t.duration_hours, 0) * 60 + COALESCE(t.duration_minutes, 0), 0),
                ct.duration, 0
              ) AS duration_minutes
       FROM course_topics ct
       LEFT JOIN training_topics t ON t.code = ct.topic_code
       WHERE ct.course_code = ?
       ORDER BY ct.sequence, ct.id`,
      [project.course_code],
    );
  }
  res.json({
    ...settings,
    seeded: true,
    topics: topics.map((t, i) => ({
      ...t,
      sequence: t.sequence ?? i + 1,
      date: '',
      start_time: '',
      end_time: '',
      theory_minutes: Number(t.duration_minutes) || 0,
      practice_minutes: 0,
    })),
  });
}));

// บันทึกทั้งชุด: ตั้งค่า + แถวหัวข้อ (client ส่งค่าที่คำนวณแล้วมา)
router.put('/training-projects/:id/schedule', h(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await q.get('SELECT id FROM training_projects WHERE id = ?', [id]);
  if (!existing) return res.status(404).json({ error: 'not found' });

  const MODES = ['single', 'consecutive', 'separate'];
  const mode = MODES.includes(req.body.date_mode) ? req.body.date_mode : 'single';
  const topics = Array.isArray(req.body.topics) ? req.body.topics : [];

  const tx = await db.transaction('write');
  try {
    await tx.execute({
      sql: `UPDATE training_projects
            SET schedule_date_mode = ?, schedule_start_time = ?, schedule_hours_per_day = ?,
                schedule_lunch_start = ?, schedule_lunch_end = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
      args: [
        mode, req.body.daily_start_time || '09:00', Number(req.body.hours_per_day) || 6,
        // ค่าว่าง = ปิดพักเที่ยง (เก็บ '' ตามที่ส่งมา ไม่ fallback เป็น default)
        String(req.body.lunch_start ?? '12:00'), String(req.body.lunch_end ?? '13:00'),
        id,
      ],
    });
    await tx.execute({ sql: 'DELETE FROM project_schedule WHERE project_id = ?', args: [id] });
    for (let i = 0; i < topics.length; i++) {
      const t = topics[i];
      await tx.execute({
        sql: `INSERT INTO project_schedule
                (project_id, topic_code, topic_name, sequence, date, start_time, end_time,
                 duration_minutes, subtopics, theory_minutes, practice_minutes)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id, t.topic_code || null, String(t.topic_name || '').trim(), i + 1,
          t.date || null, t.start_time || null, t.end_time || null,
          Number(t.duration_minutes) || 0,
          String(t.subtopics || '').trim(),
          Number(t.theory_minutes) || 0,
          Number(t.practice_minutes) || 0,
        ],
      });
    }
    await tx.commit();
    res.json({ ok: true, count: topics.length });
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}));

// ---------- Phase 4: ประวัติการอบรมรายคน + อัปเดต IDP ----------

router.get('/training-projects/:id/records', h(async (req, res) => {
  res.json(await q.all(
    'SELECT * FROM training_records WHERE project_id = ? ORDER BY id',
    [Number(req.params.id)],
  ));
}));

// บันทึกประวัติเข้าแฟ้ม: snapshot ผู้เข้าอบรมทุกคน + mark IDP (employee_roadmaps)
// เป็น completed สำหรับคนที่เช็คอินและ roadmap ผูกหลักสูตรเดียวกับโครงการ
// เรียกซ้ำได้ — แทนที่ records ชุดเดิมของโครงการทั้งหมด (idempotent)
router.post('/training-projects/:id/records', h(async (req, res) => {
  const id = Number(req.params.id);
  const project = await q.get(`${PROJECT_SELECT} WHERE p.id = ?`, [id]);
  if (!project) return res.status(404).json({ error: 'not found' });

  const participants = await q.all(
    'SELECT * FROM project_participants WHERE project_id = ? ORDER BY id',
    [id],
  );
  if (!participants.length) {
    return res.status(400).json({ error: 'ยังไม่มีรายชื่อผู้เข้าอบรม — เพิ่มที่หน้าผู้เข้าอบรมก่อน' });
  }

  // ชั่วโมงจากกำหนดการ; ถ้ายังไม่ทำกำหนดการใช้ระยะเวลาหลักสูตรจาก Setup
  const schedMins = (await q.get(
    'SELECT SUM(duration_minutes) AS m FROM project_schedule WHERE project_id = ?',
    [id],
  ))?.m || 0;
  const courseMins =
    (Number(project.course_duration_hours) || 0) * 60 + (Number(project.course_duration_minutes) || 0);
  const hours = Math.round(((schedMins || courseMins) / 60) * 100) / 100;

  const latestEval = await q.get(
    'SELECT status FROM training_evaluations WHERE project_id = ? ORDER BY id DESC LIMIT 1',
    [id],
  );
  const result = latestEval?.status || null;

  // โครงการ Public ไม่มีใบลงทะเบียน/เช็คอิน — ทุกคนในรายชื่อคือคนที่ส่งไปเรียน
  // ถือว่าเข้าอบรมทั้งหมด (ถ้าใครไม่ได้ไป ให้เอาออกจากรายชื่อก่อนบันทึก)
  const isPublic = project.delivery_type === 'public';
  const isAttended = (p) => (isPublic ? true : !!p.checked_in);

  const attendedCodes = participants
    .filter((p) => isAttended(p) && p.employee_code)
    .map((p) => p.employee_code);

  const tx = await db.transaction('write');
  try {
    await tx.execute({ sql: 'DELETE FROM training_records WHERE project_id = ?', args: [id] });
    for (const p of participants) {
      await tx.execute({
        sql: `INSERT INTO training_records
                (project_id, employee_code, name, department, position, course_code, course_name,
                 training_date, end_date, hours, attended, result)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id, p.employee_code || null, p.name, p.department || '', p.position || '',
          project.course_code || null, project.course_name_th || null,
          project.training_date || null, project.end_date || null,
          hours, isAttended(p) ? 1 : 0, isAttended(p) ? result : null,
        ],
      });
    }

    let roadmapsCompleted = 0;
    if (project.course_code && attendedCodes.length) {
      const placeholders = attendedCodes.map(() => '?').join(',');
      const r = await tx.execute({
        sql: `UPDATE employee_roadmaps
              SET status = 'completed',
                  completed_date = ?,
                  updated_at = CURRENT_TIMESTAMP
              WHERE course_code = ?
                AND status IN ('not_started', 'in_progress')
                AND employee_code IN (${placeholders})`,
        args: [project.training_date || new Date().toISOString().slice(0, 10), project.course_code, ...attendedCodes],
      });
      roadmapsCompleted = Number(r.rowsAffected) || 0;
    }

    await tx.commit();
    res.json({ ok: true, records: participants.length, attended: attendedCodes.length, roadmaps_completed: roadmapsCompleted });
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}));

// ---------- Phase 4: รายงานสรุปโครงการ (อ่านอย่างเดียว — รวมทุกมิติในคำขอเดียว) ----------

router.get('/training-projects/:id/summary', h(async (req, res) => {
  const id = Number(req.params.id);
  const project = await q.get(
    `SELECT p.*, c.name_th AS course_name_th, c.training_type AS course_training_type,
            c.send_to_dsd AS course_send_to_dsd, c.type AS course_type
     FROM training_projects p LEFT JOIN courses c ON c.code = p.course_code
     WHERE p.id = ?`,
    [id],
  );
  if (!project) return res.status(404).json({ error: 'not found' });

  const [participants, evals, schedule, prs, records] = await Promise.all([
    q.all('SELECT * FROM project_participants WHERE project_id = ? ORDER BY id', [id]),
    q.all('SELECT * FROM training_evaluations WHERE project_id = ? ORDER BY id DESC', [id]),
    q.all('SELECT * FROM project_schedule WHERE project_id = ? ORDER BY sequence, id', [id]),
    q.all("SELECT pr_no, requester, status, issued_at FROM purchase_requisitions WHERE project_id = ? ORDER BY id", [id]),
    q.get('SELECT COUNT(*) AS c, MAX(recorded_at) AS last FROM training_records WHERE project_id = ?', [id]),
  ]);

  const checkedIn = participants.filter((p) => p.checked_in).length;
  const totalMins = schedule.reduce((s, t) => s + (Number(t.duration_minutes) || 0), 0);
  const budgetTotal =
    (project.budget_instructor || 0) + (project.budget_venue || 0) + (project.budget_food || 0) +
    (project.budget_material || 0) + (project.budget_other || 0);
  const avgScore = evals.length
    ? Math.round((evals.reduce((s, e) => s + (Number(e.total_score) || 0), 0) / evals.length) * 100) / 100
    : null;

  res.json({
    project,
    budget: {
      instructor: project.budget_instructor || 0,
      venue: project.budget_venue || 0,
      food: project.budget_food || 0,
      material: project.budget_material || 0,
      other: project.budget_other || 0,
      total: budgetTotal,
    },
    participants: {
      total: participants.length,
      checked_in: checkedIn,
      rate: participants.length ? Math.round((checkedIn / participants.length) * 100) : 0,
      list: participants,
    },
    evaluation: {
      count: evals.length,
      avg_score: avgScore,
      latest: evals[0] || null,
    },
    schedule: { topics: schedule, total_minutes: totalMins },
    prs,
    records: { count: records?.c || 0, last_recorded_at: records?.last || null },
  });
}));

// ---------- สถานะ satellite อัตโนมัติ (แสดงความคืบหน้า — ไม่ล็อกการเลื่อน phase) ----------

router.get('/training-projects/:id/status', h(async (req, res) => {
  const id = Number(req.params.id);
  const [project, participants, candidates, slots, registration, checkedIn, evals, schedule, prs, records, invoices] = await Promise.all([
    q.get(
      `SELECT p.approval_status, p.approved_by, p.approved_at, p.training_date,
              p.objective, p.target_group, p.location, p.success_quantitative, p.success_qualitative,
              p.dsd_deadline, p.dsd_submitted, p.dsd_approved,
              c.send_to_dsd AS course_send_to_dsd
       FROM training_projects p LEFT JOIN courses c ON c.code = p.course_code
       WHERE p.id=?`,
      [id],
    ),
    q.get('SELECT COUNT(*) AS c FROM project_participants WHERE project_id=?', [id]),
    q.get('SELECT COUNT(*) AS c FROM candidate_dates WHERE training_project_id=?', [id]),
    q.get('SELECT COUNT(*) AS c FROM availability_slots WHERE training_project_id=?', [id]),
    q.get('SELECT id, reg_date FROM training_registrations WHERE project_id=?', [id]),
    q.get('SELECT COUNT(*) AS c FROM project_participants WHERE project_id=? AND checked_in=1', [id]),
    q.get('SELECT COUNT(*) AS c, AVG(total_score) AS avg FROM training_evaluations WHERE project_id=?', [id]),
    q.get('SELECT COUNT(*) AS c FROM project_schedule WHERE project_id=?', [id]),
    q.get("SELECT COUNT(*) AS c FROM purchase_requisitions WHERE project_id=? AND status='issued'", [id]),
    q.get('SELECT COUNT(*) AS c FROM training_records WHERE project_id=?', [id]),
    q.get("SELECT COUNT(*) AS c, SUM(CASE WHEN status='confirmed' THEN 1 ELSE 0 END) AS confirmed FROM invoice_extractions WHERE project_id=?", [id]),
  ]);
  if (!project) return res.status(404).json({ error: 'not found' });

  res.json({
    approval: {
      status: project.approval_status,
      approved_by: project.approved_by,
      approved_at: project.approved_at,
    },
    participants:  { count: participants.c },
    availability:  { candidate_dates: candidates.c, slots: slots.c, date_confirmed: !!project.training_date },
    registration:  { exists: !!registration, checked_in: checkedIn.c },
    evaluation:    { count: evals.c, avg_score: evals.avg ? Math.round(evals.avg * 100) / 100 : null },
    schedule:      { topics: schedule.c },
    pr:            { issued: prs.c },
    invoice:       { count: invoices?.c || 0, confirmed: Number(invoices?.confirmed) || 0 },
    records:       { count: records.c },
    // ยื่น ยป. กรมพัฒนาฝีมือแรงงาน — เฉพาะหลักสูตร send_to_dsd; deadline = override หรือ training_date − 30 วัน
    dsd: {
      required: !!project.course_send_to_dsd,
      deadline: dsdDeadline(project),
      deadline_overridden: !!project.dsd_deadline,
      proposal_ready: !!(
        String(project.objective || '').trim() &&
        String(project.target_group || '').trim() &&
        String(project.location || '').trim() &&
        (String(project.success_quantitative || '').trim() || String(project.success_qualitative || '').trim())
      ),
      schedule_ready: schedule.c > 0,
      submitted: !!project.dsd_submitted,
      approved: !!project.dsd_approved,
    },
  });
}));

// วันครบกำหนดยื่น ยป.: ใช้ค่า override ถ้ามี ไม่งั้นคำนวณ training_date − 30 วัน
// (คำนวณแบบ UTC ล้วนกัน toISOString เลื่อนวันตาม timezone)
export function dsdDeadline(p) {
  if (p.dsd_deadline) return p.dsd_deadline;
  if (!p.training_date) return null;
  const d = new Date(p.training_date + 'T00:00:00Z');
  if (isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() - 30);
  return d.toISOString().slice(0, 10);
}

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

export default router;
