import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';
import { seedIfEmpty } from './seed.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '../../.env') });

export const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
  intMode: 'number',
});

// Thin helpers — keep route code readable
export const q = {
  all: (sql, args = []) => db.execute({ sql, args }).then((r) => r.rows),
  get: (sql, args = []) => db.execute({ sql, args }).then((r) => r.rows[0] ?? null),
  run: (sql, args = []) => db.execute({ sql, args }),
};

const DEPTS = [
  ['EXEC',       'กรรมการผู้จัดการ'],
  ['MKT-KOL',   'ฝ่ายการตลาด KOL, Affiliate และการจัดการ Live'],
  ['MKT-DIG',   'ฝ่ายการตลาดดิจิทัล'],
  ['SALES-IB',  'ฝ่ายขาย In-Bound'],
  ['SALES-OBA', 'ฝ่ายขาย Out-Bound A'],
  ['SALES-OBB', 'ฝ่ายขาย Out-Bound B'],
  ['WH',        'ฝ่ายคลังสินค้า'],
  ['HR',        'ฝ่ายทรัพยากรบุคคล'],
  ['ACC',       'ฝ่ายบัญชีและการเงิน'],
  ['CX',        'ฝ่ายประสบการณ์ลูกค้า'],
  ['RD',        'ฝ่ายวิจัยพัฒนาและควบคุมคุณภาพผลิตภัณฑ์'],
  ['DATA',      'ฝ่ายวิเคราะห์ข้อมูลและเทคโนโลยีดิจิทัล'],
  ['CREATIVE',  'ฝ่ายสร้างสรรค์และกลยุทธ์เนื้อหาการตลาด'],
  ['DIV-MKT',   'สายงานการตลาด'],
  ['DIV-SALES', 'สายงานขาย'],
  ['DIV-OPS',   'สายงานปฏิบัติการ'],
];

const POSITIONS = [
  ['EXEC-DIR',       'กรรมการบริหาร',                                              'กรรมการผู้จัดการ'],
  ['EXEC-MD',        'กรรมการผู้จัดการ',                                             'กรรมการผู้จัดการ'],
  ['EXEC-ASST',      'ผู้ช่วยผู้บริหาร',                                               'กรรมการผู้จัดการ'],
  ['MKT-KOL-HD',    'หัวหน้าทีม KOL Affiliate และ Live Management',              'ฝ่ายการตลาด KOL, Affiliate และการจัดการ Live'],
  ['MKT-DIG-ST',    'พนักงานการตลาดดิจิทัล',                                        'ฝ่ายการตลาดดิจิทัล'],
  ['MKT-DIG-HD',    'หัวหน้าทีมการตลาดดิจิทัล',                                       'ฝ่ายการตลาดดิจิทัล'],
  ['SALES-IB-HD',   'หัวหน้างานขายสินค้าออนไลน์',                                    'ฝ่ายขาย In-Bound'],
  ['SALES-IB-ST',   'เจ้าหน้าที่ขายสินค้าออนไลน์',                                     'ฝ่ายขาย In-Bound'],
  ['SALES-IB-CH',   'เจ้าหน้าที่ตอบแชทออนไลน์',                                      'ฝ่ายขาย In-Bound'],
  ['SALES-OBA-HD',  'หัวหน้างานขายสินค้าทางโทรศัพท์',                               'ฝ่ายขาย Out-Bound A'],
  ['SALES-OBA-ST',  'เจ้าหน้าที่ขายสินค้าทางโทรศัพท์',                                'ฝ่ายขาย Out-Bound A'],
  ['SALES-OBB-HD',  'หัวหน้างานขายสินค้าทางโทรศัพท์',                               'ฝ่ายขาย Out-Bound B'],
  ['SALES-OBB-ST',  'เจ้าหน้าที่ขายสินค้าทางโทรศัพท์',                                'ฝ่ายขาย Out-Bound B'],
  ['WH-HD',         'หัวหน้างานคลังสินค้า',                                           'ฝ่ายคลังสินค้า'],
  ['WH-ST',         'เจ้าหน้าที่คลังสินค้า',                                            'ฝ่ายคลังสินค้า'],
  ['HR-INTERN',     'นักศึกษาฝึกงาน',                                              'ฝ่ายทรัพยากรบุคคล'],
  ['HR-MGR',        'ผู้จัดการฝ่ายทรัพยากรบุคคล',                                     'ฝ่ายทรัพยากรบุคคล'],
  ['HR-SPEC',       'ผู้เชี่ยวชาญงานทรัพยากรบุคคล',                                   'ฝ่ายทรัพยากรบุคคล'],
  ['HR-SR-HRM',     'พนักงานบริหารทรัพยากรบุคคลอาวุโส',                              'ฝ่ายทรัพยากรบุคคล'],
  ['HR-SR-HRD',     'พนักงานพัฒนาทรัพยากรบุคคลอาวุโส',                               'ฝ่ายทรัพยากรบุคคล'],
  ['HR-SR-OD',      'พนักงานพัฒนาองค์กรอาวุโส',                                     'ฝ่ายทรัพยากรบุคคล'],
  ['ACC-WH',        'พนักงานธุรการคลังสินค้าและบัญชี',                                  'ฝ่ายบัญชีและการเงิน'],
  ['ACC-ST',        'พนักงานบัญชีและการเงิน',                                         'ฝ่ายบัญชีและการเงิน'],
  ['ACC-HD',        'หัวหน้างานบัญชีและการเงิน',                                       'ฝ่ายบัญชีและการเงิน'],
  ['CX-QA',         'พนักงานตรวจสอบคุณภาพการขาย',                                   'ฝ่ายประสบการณ์ลูกค้า'],
  ['CX-AS',         'พนักงานบริการหลังการขาย',                                        'ฝ่ายประสบการณ์ลูกค้า'],
  ['RD-ST',         'พนักงานวิจัยและพัฒนาและตรวจสอบคุณภาพผลิตภัณฑ์',               'ฝ่ายวิจัยพัฒนาและควบคุมคุณภาพผลิตภัณฑ์'],
  ['RD-HD',         'หัวหน้าทีมพัฒนาผลิตภัณฑ์และตรวจสอบคุณภาพ',                     'ฝ่ายวิจัยพัฒนาและควบคุมคุณภาพผลิตภัณฑ์'],
  ['DATA-AN',       'นักวิเคราะห์ข้อมูลธุรกิจ',                                          'ฝ่ายวิเคราะห์ข้อมูลและเทคโนโลยีดิจิทัล'],
  ['DATA-HD',       'หัวหน้าทีมวิเคราะห์ข้อมูลและเทคโนโลยีดิจิทัล',                      'ฝ่ายวิเคราะห์ข้อมูลและเทคโนโลยีดิจิทัล'],
  ['DATA-IT',       'เจ้าหน้าที่สนับสนุนงานเทคโนโลยีสารสนเทศอาวุโส',                 'ฝ่ายวิเคราะห์ข้อมูลและเทคโนโลยีดิจิทัล'],
  ['CRT-MKT',       'พนักงานการตลาดเนื้อหาและสร้างสรรค์',                              'ฝ่ายสร้างสรรค์และกลยุทธ์เนื้อหาการตลาด'],
  ['CRT-VID',       'พนักงานตัดต่อวีดีโอเนื้อหา',                                       'ฝ่ายสร้างสรรค์และกลยุทธ์เนื้อหาการตลาด'],
  ['CRT-GFX',       'พนักงานออกแบบกราฟิก',                                          'ฝ่ายสร้างสรรค์และกลยุทธ์เนื้อหาการตลาด'],
  ['CRT-HD',        'หัวหน้าทีมการตลาดเนื้อหาและสร้างสรรค์',                           'ฝ่ายสร้างสรรค์และกลยุทธ์เนื้อหาการตลาด'],
  ['DIV-MKT-KA',    'Key Account Executive',                                       'สายงานการตลาด'],
  ['DIV-MKT-SR',    'พนักงานการตลาดโครงการอาวุโส',                                   'สายงานการตลาด'],
  ['DIV-MKT-HD',    'หัวหน้าสายงานการตลาด',                                          'สายงานการตลาด'],
  ['DIV-SALES-MGR', 'ผู้จัดการฝ่ายขาย',                                              'สายงานขาย'],
  ['DIV-OPS-SPEC',  'ผู้เชี่ยวชาญงานสนับสนุนธุรกิจและประสบการณ์ลูกค้า',              'สายงานปฏิบัติการ'],
  ['DIV-OPS-ADM',   'พนักงานธุรการ',                                                'สายงานปฏิบัติการ'],
  ['DIV-OPS-HD',    'หัวหน้าสายงานปฏิบัติการ',                                        'สายงานปฏิบัติการ'],
  ['DIV-OPS-PUR',   'เจ้าหน้าที่จัดซื้ออาวุโส',                                         'สายงานปฏิบัติการ'],
];

export async function initDb() {
  // PRAGMA foreign_keys is session-level in libSQL — must be set before any FK-dependent DDL.
  // For runtime DELETE with ON DELETE CASCADE/SET NULL, include this PRAGMA in the same batch.
  await db.execute('PRAGMA foreign_keys = ON');

  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  await db.executeMultiple(schema);

  // One-time rebuild (2026-07): training_requests ยุบเข้า training_projects +
  // รายชื่อผู้เข้าอบรมย้ายไป project_participants. ตรวจจาก shape เก่า
  // (training_projects ยังมีคอลัมน์ request_id) แล้วทิ้งตาราง workflow ทั้งชุด —
  // ข้อมูล workflow เดิมเป็นข้อมูลทดสอบ (master data ใน Setup ไม่ถูกแตะ)
  const tpShape = await q.get(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='training_projects'",
  );
  if (tpShape && String(tpShape.sql).includes('request_id')) {
    await db.executeMultiple(`
      PRAGMA foreign_keys = OFF;
      DROP TABLE IF EXISTS training_projects;
      DROP TABLE IF EXISTS training_requests;
      DROP TABLE IF EXISTS request_attendees;
      DROP TABLE IF EXISTS request_schedule;
      DROP TABLE IF EXISTS training_registrations;
      DROP TABLE IF EXISTS registration_attendees;
      DROP TABLE IF EXISTS training_evaluations;
      DROP TABLE IF EXISTS eval_responses;
      DROP TABLE IF EXISTS eval_attachments;
      DROP TABLE IF EXISTS availability_slots;
      DROP TABLE IF EXISTS candidate_dates;
      PRAGMA foreign_keys = ON;
    `);
    await db.executeMultiple(schema); // recreate ตาม shape ใหม่
    console.log('[db] Rebuilt workflow tables (project = request merge).');
  }

  // Vendor updated_at triggers — must be separate db.execute() calls because
  // BEGIN...END bodies contain semicolons that break executeMultiple's splitter
  await db.execute(`
    CREATE TRIGGER IF NOT EXISTS vendors_updated_at
    AFTER UPDATE ON vendors
    BEGIN
      UPDATE vendors SET updated_at = datetime('now') WHERE id = NEW.id;
    END
  `);
  await db.execute(`
    CREATE TRIGGER IF NOT EXISTS vendor_documents_updated_at
    AFTER UPDATE ON vendor_documents
    BEGIN
      UPDATE vendor_documents SET updated_at = datetime('now') WHERE id = NEW.id;
    END
  `);

  // Migrations
  try { await db.execute('ALTER TABLE courses ADD COLUMN competency_type TEXT'); } catch {}
  try { await db.execute('ALTER TABLE training_topics ADD COLUMN speaker TEXT'); } catch {}
  try { await db.execute('ALTER TABLE vendors ADD COLUMN drive_folder_url TEXT'); } catch {}
  // training_projects table (idempotent — schema.sql already has IF NOT EXISTS)
  try {
    await db.execute('ALTER TABLE training_projects ADD COLUMN order_index INTEGER DEFAULT 0');
  } catch {}
  try { await db.execute('ALTER TABLE instructors ADD COLUMN notes TEXT'); } catch {}
  try { await db.execute('ALTER TABLE venues ADD COLUMN notes TEXT'); } catch {}
  // Round 2 (2026-07): กำหนดการ Phase 2 + ผูก PR กับโครงการ
  try { await db.execute("ALTER TABLE training_projects ADD COLUMN schedule_date_mode TEXT DEFAULT 'single'"); } catch {}
  try { await db.execute("ALTER TABLE training_projects ADD COLUMN schedule_start_time TEXT DEFAULT '09:00'"); } catch {}
  try { await db.execute('ALTER TABLE training_projects ADD COLUMN schedule_hours_per_day REAL DEFAULT 6'); } catch {}
  try { await db.execute('ALTER TABLE purchase_requisitions ADD COLUMN project_id INTEGER REFERENCES training_projects(id)'); } catch {}
  // การจัดประเภทโครงการ (competency + inhouse/public) — CHECK อยู่ใน schema.sql
  // สำหรับ DB ใหม่; DB เดิม validate ที่ route แทน (SQLite ALTER ใส่ CHECK ไม่ได้)
  try { await db.execute('ALTER TABLE training_projects ADD COLUMN competency_type TEXT'); } catch {}
  try { await db.execute("ALTER TABLE training_projects ADD COLUMN delivery_type TEXT DEFAULT 'inhouse'"); } catch {}
  // ฟอร์มยื่นกรมพัฒนาฝีมือแรงงาน (DSD)
  try { await db.execute('ALTER TABLE employees ADD COLUMN national_id TEXT'); } catch {}
  try { await db.execute('ALTER TABLE eval_items ADD COLUMN dsd_topic INTEGER'); } catch {}
  // Round 3 (2026-07): หัวข้อย่อยในกำหนดการ + Training Proposal (การวัดผล) + พักเที่ยง
  try { await db.execute("ALTER TABLE training_topics ADD COLUMN subtopics TEXT DEFAULT ''"); } catch {}
  try { await db.execute("ALTER TABLE project_schedule ADD COLUMN subtopics TEXT DEFAULT ''"); } catch {}
  try { await db.execute('ALTER TABLE project_schedule ADD COLUMN theory_minutes INTEGER DEFAULT 0'); } catch {}
  try { await db.execute('ALTER TABLE project_schedule ADD COLUMN practice_minutes INTEGER DEFAULT 0'); } catch {}
  try { await db.execute("ALTER TABLE training_projects ADD COLUMN success_quantitative TEXT DEFAULT ''"); } catch {}
  try { await db.execute("ALTER TABLE training_projects ADD COLUMN success_qualitative TEXT DEFAULT ''"); } catch {}
  try { await db.execute("ALTER TABLE training_projects ADD COLUMN schedule_lunch_start TEXT DEFAULT '12:00'"); } catch {}
  try { await db.execute("ALTER TABLE training_projects ADD COLUMN schedule_lunch_end TEXT DEFAULT '13:00'"); } catch {}
  // ติดตามยื่น ยป. กรมพัฒนาฝีมือแรงงาน
  try { await db.execute('ALTER TABLE training_projects ADD COLUMN dsd_deadline TEXT'); } catch {}
  try { await db.execute('ALTER TABLE training_projects ADD COLUMN dsd_submitted INTEGER DEFAULT 0'); } catch {}
  try { await db.execute('ALTER TABLE training_projects ADD COLUMN dsd_approved INTEGER DEFAULT 0'); } catch {}

  const compRow = await q.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='competencies'");
  if (compRow && !String(compRow.sql).includes("'leadership'")) {
    await db.executeMultiple(`
      PRAGMA foreign_keys = OFF;
      CREATE TABLE competencies_new (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        competency_code  TEXT UNIQUE NOT NULL,
        name             TEXT NOT NULL,
        type             TEXT NOT NULL CHECK(type IN ('organizational', 'functional', 'leadership')),
        description      TEXT,
        max_level        INTEGER DEFAULT 5,
        level_1_desc     TEXT,
        level_2_desc     TEXT,
        level_3_desc     TEXT,
        level_4_desc     TEXT,
        level_5_desc     TEXT,
        created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO competencies_new SELECT * FROM competencies;
      DROP TABLE competencies;
      ALTER TABLE competencies_new RENAME TO competencies;
      PRAGMA foreign_keys = ON;
    `);
  }

  await db.batch(
    DEPTS.map(([code, name]) => ({
      sql: 'INSERT OR IGNORE INTO departments (code, name) VALUES (?, ?)',
      args: [code, name],
    })),
    'write',
  );

  try { await db.execute('ALTER TABLE employees ADD COLUMN department_id INTEGER REFERENCES departments(id)'); } catch {}
  await db.execute('UPDATE employees SET department_id = (SELECT id FROM departments WHERE name = employees.department) WHERE department_id IS NULL');

  await db.batch(
    POSITIONS.map(([code, name, deptName]) => ({
      sql: 'INSERT OR IGNORE INTO positions (code, name, department_id) VALUES (?, ?, (SELECT id FROM departments WHERE name = ?))',
      args: [code, name, deptName],
    })),
    'write',
  );

  try { await db.execute('ALTER TABLE employees ADD COLUMN position_id INTEGER REFERENCES positions(id)'); } catch {}

  // Invoice extractions — ผล AI อ่านใบแจ้งหนี้ ผูกกับโครงการผ่าน project_id
  // (nullable — ลบโครงการแล้วประวัติการสกัดยังอยู่)
  try {
    await db.execute(`
      CREATE TABLE invoice_extractions (
        id                TEXT PRIMARY KEY,
        project_id        INTEGER,
        file_name         TEXT NOT NULL,
        file_mime_type    TEXT NOT NULL,
        file_size         INTEGER NOT NULL,
        extraction_data   TEXT NOT NULL,
        confidence_flag   INTEGER DEFAULT 0,
        uncertain_fields  TEXT DEFAULT '[]',
        created_at        TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at        TEXT,
        status            TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'rejected'))
      )
    `);
  } catch {}
  // DB เก่าที่สร้างตารางก่อนมีคอลัมน์เหล่านี้
  try { await db.execute('ALTER TABLE invoice_extractions ADD COLUMN project_id INTEGER'); } catch {}
  try { await db.execute('ALTER TABLE invoice_extractions ADD COLUMN updated_at TEXT'); } catch {}
  await db.execute(`
    UPDATE employees
    SET position_id = (
      SELECT p.id FROM positions p
      WHERE p.name = employees.position_th
        AND p.department_id = employees.department_id
    )
    WHERE position_id IS NULL
  `);

  await db.execute('DROP VIEW IF EXISTS v_competency_gap');
  await db.execute(`
    CREATE VIEW v_competency_gap AS
    SELECT
      e.code          AS employee_code,
      e.full_name     AS employee_name,
      e.position_id,
      p.code          AS position_code,
      p.name          AS position_name,
      p.department_id,
      d.name          AS department_name,
      c.id            AS competency_id,
      c.competency_code,
      c.name          AS competency_name,
      c.type          AS competency_type,
      pcp.required_level,
      COALESCE(ecs.actual_level, 0) AS actual_level,
      COALESCE(ecs.actual_level, 0) - pcp.required_level AS gap,
      CASE
        WHEN ecs.actual_level IS NULL                         THEN 'not_assessed'
        WHEN ecs.actual_level >= pcp.required_level           THEN 'passed'
        WHEN pcp.required_level - ecs.actual_level = 1       THEN 'develop'
        ELSE                                                       'urgent'
      END AS priority
    FROM employees e
    JOIN positions p   ON e.position_id = p.id
    LEFT JOIN departments d ON p.department_id = d.id
    JOIN position_competency_profiles pcp ON p.id = pcp.position_id
    JOIN competencies c ON pcp.competency_id = c.id
    LEFT JOIN employee_competency_scores ecs
      ON e.code = ecs.employee_code AND c.id = ecs.competency_id
  `);

  await seedIfEmpty(db);
}

export default db;
