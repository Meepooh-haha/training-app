import { Router } from 'express';
import ExcelJS from 'exceljs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import db, { q } from '../db/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = join(__dirname, '../templates/dsd_template.xlsx');

const router = Router();
const h = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (e) { next(e); }
};

// ---------------------------------------------------------------------------
// ฟอร์มรายงานผลกรมพัฒนาฝีมือแรงงาน (แปลงครั้งเดียวจาก .xls ราชการ — ห้ามแก้โครงสร้าง)
// ชีท Summary: แถวข้อมูล 8-107 (100 คน), แถว 108 = แถวเฉลี่ยของฟอร์ม
//   A=ที่ B=เลขบัตร ปชช. C=คำนำหน้า D=ชื่อ E=สกุล F=ตำแหน่ง
//   G-K=ผลประเมินศักยภาพ 5 หัวข้อ (0-3) L/M/O/P=สูตรของฟอร์ม (ห้ามแตะ)
//   N=ช่วงรายได้ (dropdown W28:W34) Q=STATUS 'passed'/'fail' R='ü' หากผ่าน
// พิกัดอ่านจากไฟล์จริงด้วย server/scripts/inspect-dsd-xlsx.mjs —
// ถ้าเปลี่ยน template ให้รันสคริปต์นั้นแล้วอัปเดตค่าคงที่ข้างล่าง
// ---------------------------------------------------------------------------
const DATA_ROW_START = 8;
const DATA_ROW_END = 107; // 100 แถว
const INCOME_NA = 'N/A (ไม่ระบุ)'; // ตกลงกันว่าไม่บันทึกช่วงรายได้ — ใช้ตัวเลือกนี้ทุกคน

export const DSD_TOPICS = [
  'ความรู้จากการฝึกอบรม',
  'ทักษะในการปฏิบัติงาน',
  'ทัศนคติที่มีต่อการปฏิบัติงาน',
  'การแก้ปัญหาในการทำงาน',
  'ความตระหนักในด้านความปลอดภัย',
];

// ตรวจเลขบัตร ปชช. 13 หลักด้วยสูตร checksum เดียวกับในฟอร์มกรม
export function validateThaiId(id) {
  const s = String(id || '').replace(/[^0-9]/g, '');
  if (!s) return { ok: false, msg: 'ยังไม่กรอก' };
  if (s.length !== 13) return { ok: false, msg: 'ไม่ครบ 13 หลัก' };
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(s[i]) * (13 - i);
  const check = (11 - (sum % 11)) % 10;
  if (check !== Number(s[12])) return { ok: false, msg: 'checksum ไม่ถูกต้อง' };
  return { ok: true, msg: '' };
}

// แยกคำนำหน้าออกจากชื่อเต็ม เช่น "นายสมชาย ชัยมงคล" → {นาย, สมชาย, ชัยมงคล}
const TITLES = ['ว่าที่ ร.ต.', 'นางสาว', 'น.ส.', 'นาง', 'นาย', 'ดร.'];
export function splitThaiName(fullName) {
  let rest = String(fullName || '').trim();
  let title = '';
  for (const t of TITLES) {
    if (rest.startsWith(t)) {
      title = t === 'น.ส.' ? 'นางสาว' : t; // ฟอร์มกรมเช็คเพศจากคำนำหน้า — ใช้แบบเต็ม
      rest = rest.slice(t.length).trim();
      break;
    }
  }
  const sp = rest.indexOf(' ');
  const first = sp === -1 ? rest : rest.slice(0, sp).trim();
  const last = sp === -1 ? '' : rest.slice(sp + 1).trim();
  return { title, first_name: first, last_name: last };
}

// แปลงคะแนนเฉลี่ย 1-5 ของเรา → สเกลกรม 0-3 (ตกลงกัน: 5→3, 4→2, 3→1, ต่ำกว่า→0)
function toDsdScale(avg) {
  const s = Math.round(avg);
  if (s >= 5) return 3;
  if (s === 4) return 2;
  if (s === 3) return 1;
  return 0;
}

// ค่าตั้งต้น 5 หัวข้อจากผลประเมินโครงการล่าสุด ผ่านป้าย eval_items.dsd_topic
async function computeTopicDefaults(projectId) {
  const ev = await q.get(
    'SELECT id FROM training_evaluations WHERE project_id = ? ORDER BY id DESC LIMIT 1',
    [projectId],
  );
  const defaults = [0, 0, 0, 0, 0];
  if (!ev) return { defaults, mapped_items: 0 };

  const rows = await q.all(
    `SELECT i.dsd_topic, r.score
     FROM eval_responses r
     JOIN eval_items i ON i.code = r.item_code
     WHERE r.eval_id = ? AND i.dsd_topic BETWEEN 1 AND 5 AND r.score IS NOT NULL`,
    [ev.id],
  );
  const byTopic = {};
  for (const r of rows) {
    (byTopic[r.dsd_topic] = byTopic[r.dsd_topic] || []).push(Number(r.score));
  }
  for (const [topic, scores] of Object.entries(byTopic)) {
    const avg = scores.reduce((s, x) => s + x, 0) / scores.length;
    defaults[Number(topic) - 1] = toDsdScale(avg);
  }
  return { defaults, mapped_items: rows.length };
}

// ผู้ที่ลงไฟล์กรม: เฉพาะคนเข้าอบรม (เช็คอิน) — โครงการ Public ไม่มีเช็คอิน ใช้ทุกคน
async function loadAttendees(project) {
  const participants = await q.all(
    `SELECT pp.*, e.national_id
     FROM project_participants pp
     LEFT JOIN employees e ON e.code = pp.employee_code
     WHERE pp.project_id = ? ORDER BY pp.id`,
    [project.id],
  );
  return project.delivery_type === 'public' ? participants : participants.filter((p) => p.checked_in);
}

function buildRows(attendees, assessments, defaults) {
  const byParticipant = Object.fromEntries(assessments.map((a) => [a.participant_id, a]));
  const idCount = {};
  attendees.forEach((p) => {
    const nid = String(p.national_id || '').trim();
    if (nid) idCount[nid] = (idCount[nid] || 0) + 1;
  });

  return attendees.map((p) => {
    const saved = byParticipant[p.id];
    const auto = splitThaiName(p.name);
    const idCheck = validateThaiId(p.national_id);
    return {
      participant_id: p.id,
      employee_code: p.employee_code,
      full_name: p.name,
      position: p.position || '',
      national_id: p.national_id || '',
      id_ok: idCheck.ok,
      id_msg: idCheck.msg,
      id_duplicate: !!p.national_id && idCount[String(p.national_id).trim()] > 1,
      title: saved?.title ?? auto.title,
      first_name: saved?.first_name ?? auto.first_name,
      last_name: saved?.last_name ?? auto.last_name,
      topics: saved
        ? [saved.topic1, saved.topic2, saved.topic3, saved.topic4, saved.topic5]
        : [...defaults],
      status: saved?.status ?? 'passed',
      saved: !!saved,
    };
  });
}

// ---------- GET: ข้อมูลตารางประเมิน (ค่าที่บันทึก หรือ default จากผลประเมิน) ----------

router.get('/training-projects/:id/dsd', h(async (req, res) => {
  const project = await q.get(
    `SELECT p.*, c.name_th AS course_name_th, c.send_to_dsd AS course_send_to_dsd,
            c.training_type AS course_training_type
     FROM training_projects p LEFT JOIN courses c ON c.code = p.course_code
     WHERE p.id = ?`,
    [Number(req.params.id)],
  );
  if (!project) return res.status(404).json({ error: 'not found' });

  const [attendees, assessments, conv] = await Promise.all([
    loadAttendees(project),
    q.all('SELECT * FROM project_dsd_assessments WHERE project_id = ?', [project.id]),
    computeTopicDefaults(project.id),
  ]);

  res.json({
    topics: DSD_TOPICS,
    defaults: conv.defaults,
    mapped_items: conv.mapped_items, // 0 = ยังไม่ได้ติดป้าย dsd_topic ใน Setup เลย
    rows: buildRows(attendees, assessments, conv.defaults),
  });
}));

// ---------- PUT: บันทึกตาราง (upsert ต่อคน) ----------

router.put('/training-projects/:id/dsd', h(async (req, res) => {
  const projectId = Number(req.params.id);
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  const clamp = (v) => Math.max(0, Math.min(3, Number(v) || 0));

  const tx = await db.transaction('write');
  try {
    for (const r of rows) {
      if (!r.participant_id) continue;
      await tx.execute({
        sql: `INSERT INTO project_dsd_assessments
                (project_id, participant_id, title, first_name, last_name,
                 topic1, topic2, topic3, topic4, topic5, status, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(project_id, participant_id) DO UPDATE SET
                title=excluded.title, first_name=excluded.first_name, last_name=excluded.last_name,
                topic1=excluded.topic1, topic2=excluded.topic2, topic3=excluded.topic3,
                topic4=excluded.topic4, topic5=excluded.topic5, status=excluded.status,
                updated_at=CURRENT_TIMESTAMP`,
        args: [
          projectId, Number(r.participant_id),
          String(r.title || '').trim(), String(r.first_name || '').trim(), String(r.last_name || '').trim(),
          clamp(r.topics?.[0]), clamp(r.topics?.[1]), clamp(r.topics?.[2]),
          clamp(r.topics?.[3]), clamp(r.topics?.[4]),
          r.status === 'fail' ? 'fail' : 'passed',
        ],
      });
    }
    await tx.commit();
    res.json({ ok: true, saved: rows.length });
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}));

// ---------- Export: เติมฟอร์มกรมจริง (.xlsx — โครงสร้าง/สูตรครบ, macro ของ
// เจ้าหน้าที่หายจากการแปลงรูปแบบ ซึ่งผู้ใช้ยืนยันแล้วว่ากรมรับได้) ----------

router.get('/training-projects/:id/dsd/export-xlsx', h(async (req, res) => {
  const project = await q.get(
    `SELECT p.*, c.name_th AS course_name_th FROM training_projects p
     LEFT JOIN courses c ON c.code = p.course_code WHERE p.id = ?`,
    [Number(req.params.id)],
  );
  if (!project) return res.status(404).json({ error: 'not found' });

  const [attendees, assessments, conv] = await Promise.all([
    loadAttendees(project),
    q.all('SELECT * FROM project_dsd_assessments WHERE project_id = ?', [project.id]),
    computeTopicDefaults(project.id),
  ]);
  const rows = buildRows(attendees, assessments, conv.defaults);

  if (!rows.length) return res.status(400).json({ error: 'ไม่มีผู้เข้าอบรมให้ลงฟอร์ม (ต้องเช็คอินก่อน หรือเพิ่มรายชื่อในโครงการ Public)' });
  if (rows.length > DATA_ROW_END - DATA_ROW_START + 1) {
    return res.status(400).json({ error: `ฟอร์มกรมรองรับสูงสุด ${DATA_ROW_END - DATA_ROW_START + 1} คน (มี ${rows.length} คน)` });
  }
  const bad = rows.filter((r) => !r.id_ok);
  if (bad.length) {
    return res.status(400).json({ error: `เลขบัตรประชาชนไม่ถูกต้อง ${bad.length} คน: ${bad.slice(0, 5).map((r) => r.full_name).join(', ')}${bad.length > 5 ? ' …' : ''} — แก้ที่ ข้อมูลหลัก › ข้อมูลพนักงาน` });
  }
  const dup = rows.filter((r) => r.id_duplicate);
  if (dup.length) {
    return res.status(400).json({ error: `เลขบัตรประชาชนซ้ำกัน: ${[...new Set(dup.map((r) => r.national_id))].join(', ')}` });
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TEMPLATE);
  const ws = wb.getWorksheet('Summary');

  // ล้างเฉพาะช่องที่ผู้ใช้กรอก (template ที่ได้มามีข้อมูลตัวอย่างค้างอยู่) —
  // คอลัมน์สูตรของฟอร์ม L(12) M(13) O(15) P(16) ไม่แตะ
  const INPUT_COLS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 17, 18]; // A-K, N, Q, R
  for (let r = DATA_ROW_START; r <= DATA_ROW_END; r++) {
    const row = ws.getRow(r);
    for (const c of INPUT_COLS) row.getCell(c).value = null;
  }

  rows.forEach((r, i) => {
    const row = ws.getRow(DATA_ROW_START + i);
    row.getCell(1).value = i + 1;                                     // ที่
    row.getCell(2).value = String(r.national_id).replace(/[^0-9]/g, ''); // เลขบัตร (คงเป็น text ตามฟอร์ม)
    row.getCell(3).value = r.title;                                   // คำนำหน้า
    row.getCell(4).value = r.first_name;                              // ชื่อ
    row.getCell(5).value = r.last_name;                               // สกุล
    row.getCell(6).value = r.position;                                // ตำแหน่ง
    r.topics.forEach((t, k) => { row.getCell(7 + k).value = Number(t) || 0; }); // G-K
    row.getCell(14).value = INCOME_NA;                                // ช่วงรายได้ — ไม่บันทึกตามที่ตกลง
    row.getCell(17).value = r.status === 'fail' ? 'fail' : 'passed';  // STATUS (ชีท Data แปลงเป็น ผ่าน/ไม่ผ่าน)
    if (r.status !== 'fail') row.getCell(18).value = 'ü';             // เช็ค ü หาก ผ่าน
  });

  // ให้สูตรของฟอร์ม (ชีท Data, คอลัมน์ L/M/O/P) คำนวณใหม่ตอนเปิดไฟล์
  wb.calcProperties.fullCalcOnLoad = true;

  const buf = await wb.xlsx.writeBuffer();
  const fname = `DSD-${project.req_no || project.id}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fname)}"`);
  res.send(Buffer.from(buf));
}));

export default router;
