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
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  await db.executeMultiple(schema);

  // Migrations
  try { await db.execute('ALTER TABLE courses ADD COLUMN competency_type TEXT'); } catch {}

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
