-- ============================================================
-- Training Management — SQLite schema
-- Executed on every server start (idempotent via IF NOT EXISTS)
-- ============================================================

-- ---------- MODULE 1: MASTER DATA ----------

-- 1A: Training Topics (หัวข้ออบรม)
CREATE TABLE IF NOT EXISTS training_topics (
  code             TEXT PRIMARY KEY,
  name_th          TEXT NOT NULL,
  name_en          TEXT,
  type             TEXT,                 -- บรรยาย | บรรยายและปฏิบัติ
  duration_hours   INTEGER DEFAULT 0,
  duration_minutes INTEGER DEFAULT 0,
  is_continuous    INTEGER DEFAULT 0,    -- bool
  speaker          TEXT
);

-- 1B: Courses (หลักสูตร)
CREATE TABLE IF NOT EXISTS courses (
  code             TEXT PRIMARY KEY,
  name_th          TEXT NOT NULL,
  name_en          TEXT,
  category         TEXT,
  type             TEXT,                 -- ไม่ต่อเนื่อง | ต่อเนื่อง
  training_type    TEXT,                 -- ฝึกยกระดับฝีมือแรงงาน | etc
  duration_hours   INTEGER DEFAULT 0,
  duration_minutes INTEGER DEFAULT 0,
  send_to_dsd      INTEGER DEFAULT 0,    -- bool
  detail           TEXT
);

-- Course → Topic sub-table (หัวข้ออบรม tab)
CREATE TABLE IF NOT EXISTS course_topics (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  course_code TEXT NOT NULL,
  topic_code  TEXT,
  sequence    INTEGER,
  duration    INTEGER,
  FOREIGN KEY (course_code) REFERENCES courses(code) ON DELETE CASCADE
);

-- Course relations (ควรอบรมก่อน / ควรอบรมต่อไป tabs)
CREATE TABLE IF NOT EXISTS course_relations (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  course_code         TEXT NOT NULL,
  related_course_code TEXT,
  relation_type       TEXT,             -- prereq | next
  FOREIGN KEY (course_code) REFERENCES courses(code) ON DELETE CASCADE
);

-- 1C: Evaluation Items (หัวข้อประเมิน)
CREATE TABLE IF NOT EXISTS eval_items (
  code      TEXT PRIMARY KEY,
  name_th   TEXT NOT NULL,
  name_en   TEXT,
  eval_type TEXT,                        -- ประเมินผู้เข้าร่วมอบรม | etc
  detail    TEXT
);

-- 1D: Evaluation Forms (รูปแบบประเมิน)
CREATE TABLE IF NOT EXISTS eval_forms (
  code    TEXT PRIMARY KEY,
  name_th TEXT NOT NULL,
  name_en TEXT,
  detail  TEXT
);

CREATE TABLE IF NOT EXISTS eval_form_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  form_code  TEXT NOT NULL,
  item_code  TEXT,
  sequence   INTEGER,
  weight     REAL,
  scale_type TEXT,                       -- ระดับ | คะแนน
  FOREIGN KEY (form_code) REFERENCES eval_forms(code) ON DELETE CASCADE
);

-- 1E: Employees (ข้อมูลพนักงาน)
CREATE TABLE IF NOT EXISTS employees (
  code        TEXT PRIMARY KEY,
  sequence    INTEGER DEFAULT 0,
  full_name   TEXT NOT NULL,
  nickname    TEXT,
  email       TEXT,
  position_th TEXT,
  position_en TEXT,
  department  TEXT
);

-- ---------- MODULE 1.5: COURSE SCHEDULE PLANNING (กำหนดหลักสูตร) ----------

-- แผนการจัดอบรม (ก่อนขออนุมัติ)
CREATE TABLE IF NOT EXISTS training_plans (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_name        TEXT NOT NULL,
  course_code      TEXT,
  date_mode        TEXT DEFAULT 'single', -- single | consecutive | separate
  start_date       TEXT,
  daily_start_time TEXT DEFAULT '09:00',
  hours_per_day    REAL DEFAULT 6,
  created_at       TEXT,
  notes            TEXT,
  FOREIGN KEY (course_code) REFERENCES courses(code)
);

-- หัวข้อในแผนการจัดอบรม (เก็บ schedule ที่คำนวณแล้ว)
CREATE TABLE IF NOT EXISTS training_plan_topics (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id          INTEGER NOT NULL,
  topic_code       TEXT,
  topic_name       TEXT,
  sequence         INTEGER,
  date             TEXT,
  start_time       TEXT,
  end_time         TEXT,
  duration_minutes INTEGER DEFAULT 0,
  FOREIGN KEY (plan_id) REFERENCES training_plans(id) ON DELETE CASCADE
);

-- ---------- MODULE 2: TRAINING WORKFLOW ----------

-- 2A: Training Request (ขออนุมัติอบรม)
CREATE TABLE IF NOT EXISTS training_requests (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  req_no            TEXT UNIQUE,
  course_code       TEXT,
  training_date     TEXT,
  end_date          TEXT,
  location          TEXT,
  trainer_name      TEXT,
  trainer_org       TEXT,
  budget_instructor REAL DEFAULT 0,
  budget_venue      REAL DEFAULT 0,
  budget_food       REAL DEFAULT 0,
  budget_material   REAL DEFAULT 0,
  budget_other      REAL DEFAULT 0,
  attendee_count    INTEGER DEFAULT 0,
  objective         TEXT,
  target_group      TEXT,
  status            TEXT DEFAULT 'draft',-- draft | pending | approved | rejected
  created_at        TEXT,
  approved_by       TEXT,
  approved_at       TEXT,
  notes             TEXT
);

CREATE TABLE IF NOT EXISTS request_attendees (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  req_id      INTEGER NOT NULL,
  employee_id TEXT,
  name        TEXT,
  department  TEXT,
  position    TEXT,
  FOREIGN KEY (req_id) REFERENCES training_requests(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS request_schedule (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  req_id     INTEGER NOT NULL,
  date       TEXT,
  start_time TEXT,
  end_time   TEXT,
  topic      TEXT,
  trainer    TEXT,
  FOREIGN KEY (req_id) REFERENCES training_requests(id) ON DELETE CASCADE
);

-- 2B: Registration (ใบลงทะเบียน)
CREATE TABLE IF NOT EXISTS training_registrations (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  req_id   INTEGER NOT NULL UNIQUE,
  reg_date TEXT,
  FOREIGN KEY (req_id) REFERENCES training_requests(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS registration_attendees (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  registration_id INTEGER NOT NULL,
  name            TEXT,
  department      TEXT,
  position        TEXT,
  checked_in      INTEGER DEFAULT 0,
  note            TEXT,
  FOREIGN KEY (registration_id) REFERENCES training_registrations(id) ON DELETE CASCADE
);

-- 2C: Evaluation (ประเมินผล)
CREATE TABLE IF NOT EXISTS training_evaluations (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  req_id         INTEGER,
  eval_form_code TEXT,
  evaluator_name TEXT,
  eval_date      TEXT,
  total_score    REAL,
  status         TEXT,                   -- pass | fail
  FOREIGN KEY (req_id) REFERENCES training_requests(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS eval_responses (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  eval_id   INTEGER NOT NULL,
  item_code TEXT,
  score     REAL,
  comment   TEXT,
  FOREIGN KEY (eval_id) REFERENCES training_evaluations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS eval_attachments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  eval_id     INTEGER NOT NULL,
  filename    TEXT,
  file_data   TEXT,                      -- base64 data URL
  uploaded_at TEXT,
  FOREIGN KEY (eval_id) REFERENCES training_evaluations(id) ON DELETE CASCADE
);

-- ---------- MODULE 3: ORGANIZATION STRUCTURE ----------

-- 3A: Departments (ฝ่าย/แผนก)
CREATE TABLE IF NOT EXISTS departments (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  code    TEXT NOT NULL UNIQUE,
  name    TEXT NOT NULL,
  name_en TEXT
);

-- 3B: Positions (ตำแหน่งงาน)
CREATE TABLE IF NOT EXISTS positions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  code          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  name_en       TEXT,
  level         TEXT,
  department_id INTEGER REFERENCES departments(id)
);

-- 3C: Competency Assignments (สำหรับ Training Roadmap — ยังไม่มี UI)
-- NOTE: UNIQUE(course_code, department_id, position_id) does not cover duplicate
-- org-wide rows where both FKs are NULL (SQLite treats NULL != NULL in UNIQUE).
-- Enforce no-duplicate org-wide assignments at the application layer when building the route.
CREATE TABLE IF NOT EXISTS competency_assignments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  course_code   TEXT REFERENCES courses(code),
  department_id INTEGER REFERENCES departments(id),
  position_id   INTEGER REFERENCES positions(id),
  assign_type   TEXT NOT NULL CHECK(assign_type IN ('organization','functional')),
  UNIQUE(course_code, department_id, position_id)
);

-- ---------- MODULE 4: COMPETENCY MANAGEMENT ----------

-- 4A: Competency Dictionary
CREATE TABLE IF NOT EXISTS competencies (
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

-- 4B: Functional Competency ↔ Department mapping
CREATE TABLE IF NOT EXISTS competency_departments (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  competency_id  INTEGER NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  department_id  INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  UNIQUE(competency_id, department_id)
);

-- 4C: Position Competency Profile (required level per position)
CREATE TABLE IF NOT EXISTS position_competency_profiles (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  position_id    INTEGER NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  competency_id  INTEGER NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  required_level INTEGER NOT NULL CHECK(required_level BETWEEN 1 AND 5),
  UNIQUE(position_id, competency_id)
);

-- 4D: Employee actual competency scores
CREATE TABLE IF NOT EXISTS employee_competency_scores (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_code  TEXT NOT NULL REFERENCES employees(code) ON DELETE CASCADE,
  competency_id  INTEGER NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  actual_level   INTEGER NOT NULL CHECK(actual_level BETWEEN 1 AND 5),
  assessor_type  TEXT DEFAULT 'manager' CHECK(assessor_type IN ('self','manager','hr')),
  assessed_date  DATE NOT NULL,
  notes          TEXT,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(employee_code, competency_id)
);

-- 4E: Competency → Course mapping
CREATE TABLE IF NOT EXISTS competency_course_mapping (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  competency_id  INTEGER NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  course_code    TEXT NOT NULL REFERENCES courses(code) ON DELETE CASCADE,
  target_level   INTEGER CHECK(target_level BETWEEN 1 AND 5),
  UNIQUE(competency_id, course_code)
);

-- 4E-2: Org-level training projects (HR-SOP-003 lifecycle)
-- current_step: 1=TNA, 2=แผนประจำปี, 3=ขออนุมัติ, 4=เตรียม-จัดอบรม, 5=ประเมินผล, 6=บันทึก-รายงาน
CREATE TABLE IF NOT EXISTS training_projects (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  name              TEXT NOT NULL,
  description       TEXT DEFAULT '',
  course_code       TEXT REFERENCES courses(code),
  request_id        INTEGER REFERENCES training_requests(id),
  quarter           TEXT DEFAULT 'Q1' CHECK(quarter IN ('Q1','Q2','Q3','Q4')),
  year              INTEGER DEFAULT 2569,
  current_step      INTEGER DEFAULT 1 CHECK(current_step BETWEEN 1 AND 6),
  participant_count INTEGER DEFAULT 0,
  order_index       INTEGER DEFAULT 0,
  notes             TEXT DEFAULT '',
  created_at        TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at        TEXT DEFAULT CURRENT_TIMESTAMP
);

-- ---------- MODULE 5: AVAILABILITY MATRIX ----------

-- 5A: Instructors registry (internal employees or external vendors)
CREATE TABLE IF NOT EXISTS instructors (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type    TEXT NOT NULL CHECK(source_type IN ('internal','external')),
  employee_id    TEXT REFERENCES employees(code),
  vendor_id      INTEGER,
  name           TEXT NOT NULL,
  contact_phone  TEXT,
  contact_email  TEXT,
  created_at     TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at     TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 5B: Venues registry (internal rooms or external locations)
CREATE TABLE IF NOT EXISTS venues (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL CHECK(source_type IN ('internal','external')),
  location_id INTEGER,
  vendor_id   INTEGER,
  name        TEXT NOT NULL,
  address     TEXT,
  capacity    INTEGER,
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 5C: Availability slots — one row per entity × date × project
-- entity_ref is TEXT to unify employees.code (TEXT PK) with
-- instructors/venues ids stored as strings, avoiding type-collision FK
CREATE TABLE IF NOT EXISTS availability_slots (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  training_project_id INTEGER NOT NULL REFERENCES training_projects(id) ON DELETE CASCADE,
  entity_type         TEXT NOT NULL CHECK(entity_type IN ('participant','instructor','venue')),
  entity_ref          TEXT NOT NULL,
  slot_date           TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'available'
                        CHECK(status IN ('available','unavailable','tentative')),
  note                TEXT,
  created_at          TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at          TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(training_project_id, entity_type, entity_ref, slot_date)
);

-- 5D: Candidate Dates — dates shortlisted for scheduling coordination
CREATE TABLE IF NOT EXISTS candidate_dates (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  training_project_id INTEGER NOT NULL REFERENCES training_projects(id) ON DELETE CASCADE,
  date                TEXT NOT NULL,
  note                TEXT,
  created_at          TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(training_project_id, date)
);

-- ---------- MODULE 6: VENDOR REGISTRATION ----------

-- 6A: Vendors master data (วิทยากรภายนอก / สถานที่ / อื่นๆ)
CREATE TABLE IF NOT EXISTS vendors (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_name     TEXT NOT NULL,
  tax_id          TEXT,                        -- nullable: บุคคลธรรมดาบางรายไม่มีเลขผู้เสียภาษี
  vendor_type     TEXT NOT NULL CHECK (vendor_type IN ('instructor', 'venue', 'other')),
  is_registered   INTEGER NOT NULL DEFAULT 0,  -- 0 = ยังไม่ขึ้นทะเบียน, 1 = ขึ้นทะเบียนแล้ว
  registered_date TEXT,                        -- ISO date; NULL เมื่อ is_registered กลับเป็น 0
  contact_name    TEXT,
  contact_phone   TEXT,
  contact_email   TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- กันสร้าง vendor ซ้ำด้วย tax_id (partial index: หลาย NULL ได้ — บุคคลธรรมดาไม่มี tax_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_tax_id
  ON vendors (tax_id) WHERE tax_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vendors_type_status
  ON vendors (vendor_type, is_registered);

-- 6B: Vendor documents checklist (4 ประเภทต่อ vendor)
CREATE TABLE IF NOT EXISTS vendor_documents (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_id     INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  doc_type      TEXT NOT NULL CHECK (doc_type IN ('book_bank', 'pp20', 'company_cert', 'vendor_form')),
  file_data     TEXT,                          -- base64 สำหรับ MVP; เปลี่ยน storage_type เป็น 'url' เมื่อย้าย blob storage
  storage_type  TEXT NOT NULL DEFAULT 'base64' CHECK (storage_type IN ('base64', 'url')),
  file_format   TEXT CHECK (file_format IN ('image', 'pdf')),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'verified')),
  received_date TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (vendor_id, doc_type)                 -- 1 แถวต่อประเภทเอกสารต่อ vendor
);

CREATE INDEX IF NOT EXISTS idx_vendor_documents_vendor
  ON vendor_documents (vendor_id);

-- Index vendor_id บน instructors/venues (คอลัมน์มีอยู่แล้ว ไม่ต้อง ALTER TABLE)
CREATE INDEX IF NOT EXISTS idx_instructors_vendor ON instructors (vendor_id);
CREATE INDEX IF NOT EXISTS idx_venues_vendor       ON venues (vendor_id);

-- 5E: Instructor → Topic mapping (หัวข้ออบรมที่วิทยากรสอนได้)
CREATE TABLE IF NOT EXISTS instructor_topics (
  instructor_id INTEGER NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  topic_code    TEXT    NOT NULL,
  PRIMARY KEY (instructor_id, topic_code)
);

-- ---------- MODULE 4F (continued): Employee Roadmap ----------

-- 4F: Employee training roadmap (IDP)
CREATE TABLE IF NOT EXISTS employee_roadmaps (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_code  TEXT NOT NULL REFERENCES employees(code) ON DELETE CASCADE,
  competency_id  INTEGER NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  course_code    TEXT REFERENCES courses(code),
  priority_order INTEGER,
  status         TEXT DEFAULT 'not_started' CHECK(status IN ('not_started','in_progress','completed','waived')),
  target_quarter TEXT,
  completed_date DATE,
  notes          TEXT,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(employee_code, competency_id)
);
