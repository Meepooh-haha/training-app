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
  is_continuous    INTEGER DEFAULT 0     -- bool
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
