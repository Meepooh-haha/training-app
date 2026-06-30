PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE training_topics (
  code             TEXT PRIMARY KEY,
  name_th          TEXT NOT NULL,
  name_en          TEXT,
  type             TEXT,                 -- บรรยาย | บรรยายและปฏิบัติ
  duration_hours   INTEGER DEFAULT 0,
  duration_minutes INTEGER DEFAULT 0,
  is_continuous    INTEGER DEFAULT 0     -- bool
);
INSERT INTO training_topics VALUES('HR-TN-001','ความปลอดภัยในการทำงาน','Workplace Safety','บรรยาย',3,0,0);
INSERT INTO training_topics VALUES('HR-TN-002','การปฐมพยาบาลเบื้องต้น','Basic First Aid','บรรยายและปฏิบัติ',3,30,0);
INSERT INTO training_topics VALUES('HR-TN-003','การทำงานเป็นทีม','Teamwork','บรรยาย',2,0,0);
INSERT INTO training_topics VALUES('HR-TN-004','การสื่อสารในองค์กร','Organizational Communication','บรรยาย',2,30,0);
INSERT INTO training_topics VALUES('HR-TN-005','การใช้งานระบบ ERP','ERP System Usage','บรรยายและปฏิบัติ',6,0,1);
CREATE TABLE courses (
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
, competency_type TEXT);
INSERT INTO courses VALUES('HR-INT-001','หลักสูตรปฐมนิเทศพนักงานใหม่','New Employee Orientation','ปฐมนิเทศ','ไม่ต่อเนื่อง','ฝึกเตรียมเข้าทำงาน',6,0,0,'สำหรับพนักงานเข้าใหม่ทุกคน',NULL);
INSERT INTO courses VALUES('HR-INT-002','หลักสูตรความปลอดภัยพื้นฐาน','Basic Safety','ความปลอดภัย','ไม่ต่อเนื่อง','ฝึกยกระดับฝีมือแรงงาน',3,0,0,'ตามกฎหมายความปลอดภัย',NULL);
INSERT INTO courses VALUES('HR-INT-003','หลักสูตรพัฒนาภาวะผู้นำ','Leadership Development','การบริหาร','ต่อเนื่อง','ฝึกยกระดับฝีมือแรงงาน',12,0,1,'สำหรับหัวหน้างานขึ้นไป',NULL);
INSERT INTO courses VALUES('HR-INT-004','หลักสูตรบริการลูกค้า','Customer Service Excellence','การบริการ','ไม่ต่อเนื่อง','ฝึกยกระดับฝีมือแรงงาน',6,0,0,'สำหรับฝ่ายบริการลูกค้า',NULL);
INSERT INTO courses VALUES('HR-INT-005','หลักสูตรการใช้งานระบบ ERP','ERP System Training','เทคโนโลยี','ต่อเนื่อง','ฝึกยกระดับฝีมือแรงงาน',6,0,1,'สำหรับผู้ใช้งานระบบ',NULL);
CREATE TABLE course_topics (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  course_code TEXT NOT NULL,
  topic_code  TEXT,
  sequence    INTEGER,
  duration    INTEGER,
  FOREIGN KEY (course_code) REFERENCES courses(code) ON DELETE CASCADE
);
INSERT INTO course_topics VALUES(3,'HR-INT-002','HR-TN-001',1,180);
INSERT INTO course_topics VALUES(4,'HR-INT-005','HR-TN-005',1,360);
INSERT INTO course_topics VALUES(12,'HR-INT-001','HR-TN-003',1,120);
INSERT INTO course_topics VALUES(13,'HR-INT-001','HR-TN-004',2,150);
CREATE TABLE course_relations (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  course_code         TEXT NOT NULL,
  related_course_code TEXT,
  relation_type       TEXT,             -- prereq | next
  FOREIGN KEY (course_code) REFERENCES courses(code) ON DELETE CASCADE
);
INSERT INTO course_relations VALUES(1,'HR-INT-003','HR-INT-001','prereq');
CREATE TABLE eval_items (
  code      TEXT PRIMARY KEY,
  name_th   TEXT NOT NULL,
  name_en   TEXT,
  eval_type TEXT,                        -- ประเมินผู้เข้าร่วมอบรม | etc
  detail    TEXT
);
INSERT INTO eval_items VALUES('INT-CO-001','เนื้อหาตรงตามความต้องการ','Content relevance','ประเมินหลักสูตร','ความสอดคล้องของเนื้อหา');
INSERT INTO eval_items VALUES('INT-CO-002','ความรู้ความสามารถของวิทยากร','Trainer competency','ประเมินวิทยากร','');
INSERT INTO eval_items VALUES('INT-CO-003','เอกสารประกอบการอบรม','Training materials','ประเมินหลักสูตร','');
INSERT INTO eval_items VALUES('INT-CO-004','สถานที่และสิ่งอำนวยความสะดวก','Venue & facilities','ประเมินการจัดอบรม','');
INSERT INTO eval_items VALUES('INT-CO-005','สามารถนำความรู้ไปใช้ได้จริง','Applicability','ประเมินผู้เข้าร่วมอบรม','');
CREATE TABLE eval_forms (
  code    TEXT PRIMARY KEY,
  name_th TEXT NOT NULL,
  name_en TEXT,
  detail  TEXT
);
INSERT INTO eval_forms VALUES('INT-01','แบบประเมินความพึงพอใจการอบรม','Training Satisfaction Survey','ใช้กับการอบรมทั่วไป');
CREATE TABLE eval_form_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  form_code  TEXT NOT NULL,
  item_code  TEXT,
  sequence   INTEGER,
  weight     REAL,
  scale_type TEXT,                       -- ระดับ | คะแนน
  FOREIGN KEY (form_code) REFERENCES eval_forms(code) ON DELETE CASCADE
);
INSERT INTO eval_form_items VALUES(6,'INT-01','INT-CO-001',1,1.0,'ระดับ');
INSERT INTO eval_form_items VALUES(7,'INT-01','INT-CO-002',2,1.0,'ระดับ');
INSERT INTO eval_form_items VALUES(8,'INT-01','INT-CO-003',3,1.0,'ระดับ');
INSERT INTO eval_form_items VALUES(9,'INT-01','INT-CO-004',4,1.0,'ระดับ');
INSERT INTO eval_form_items VALUES(10,'INT-01','INT-CO-005',5,1.0,'ระดับ');
CREATE TABLE training_requests (
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
INSERT INTO training_requests VALUES(1,'TR-2026-001','HR-INT-001','2026-02-10','2026-02-10','ห้องประชุมใหญ่ ชั้น 5','คุณสมชาย ใจดี','ภายในองค์กร',8000.0,0.0,4000.0,1500.0,500.0,20,'เพื่อให้พนักงานใหม่เข้าใจวัฒนธรรมองค์กร','พนักงานเข้าใหม่','approved','2026-01-20','ผู้จัดการฝ่ายบุคคล','2026-01-25','');
INSERT INTO training_requests VALUES(2,'TR-2026-002','HR-INT-002','2026-03-15','2026-03-15','ห้องอบรม A','คุณวิภา ปลอดภัย','บริษัท Safety First',15000.0,5000.0,6000.0,2000.0,1000.0,30,'สร้างความตระหนักด้านความปลอดภัย','พนักงานทุกแผนก','approved','2026-02-28','ผู้จัดการโรงงาน','2026-03-02','');
INSERT INTO training_requests VALUES(3,'TR-2026-003','HR-INT-003','2026-05-01','2026-05-02','โรงแรม ABC','ดร.ประเสริฐ นำชัย','สถาบันพัฒนาผู้นำ',40000.0,20000.0,15000.0,5000.0,3000.0,15,'พัฒนาทักษะภาวะผู้นำ','หัวหน้างาน','pending','2026-04-10','','','รออนุมัติงบประมาณ');
INSERT INTO training_requests VALUES(4,'TR-2026-004','HR-INT-004','2026-06-20','2026-06-20','ห้องอบรม B','คุณนภา บริการ','ภายในองค์กร',6000.0,0.0,3000.0,1000.0,0.0,12,'ยกระดับการบริการลูกค้า','ฝ่ายบริการลูกค้า','draft','2026-06-01','','','');
CREATE TABLE request_attendees (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  req_id      INTEGER NOT NULL,
  employee_id TEXT,
  name        TEXT,
  department  TEXT,
  position    TEXT,
  FOREIGN KEY (req_id) REFERENCES training_requests(id) ON DELETE CASCADE
);
INSERT INTO request_attendees VALUES(1,1,'EMP-101','นายกิตติ วงศ์ทอง','ผลิต','พนักงานฝ่ายผลิต');
INSERT INTO request_attendees VALUES(2,1,'EMP-102','นางสาวมาลี ศรีสุข','บัญชี','เจ้าหน้าที่บัญชี');
INSERT INTO request_attendees VALUES(3,1,'EMP-103','นายอนุชา รุ่งเรือง','คลังสินค้า','พนักงานคลัง');
CREATE TABLE request_schedule (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  req_id     INTEGER NOT NULL,
  date       TEXT,
  start_time TEXT,
  end_time   TEXT,
  topic      TEXT,
  trainer    TEXT,
  FOREIGN KEY (req_id) REFERENCES training_requests(id) ON DELETE CASCADE
);
INSERT INTO request_schedule VALUES(1,1,'2026-02-10','09:00','12:00','การทำงานเป็นทีม','คุณสมชาย ใจดี');
INSERT INTO request_schedule VALUES(2,1,'2026-02-10','13:00','16:00','การสื่อสารในองค์กร','คุณสมชาย ใจดี');
CREATE TABLE training_registrations (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  req_id   INTEGER NOT NULL UNIQUE,
  reg_date TEXT,
  FOREIGN KEY (req_id) REFERENCES training_requests(id) ON DELETE CASCADE
);
INSERT INTO training_registrations VALUES(1,3,'2026-06-26');
CREATE TABLE registration_attendees (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  registration_id INTEGER NOT NULL,
  name            TEXT,
  department      TEXT,
  position        TEXT,
  checked_in      INTEGER DEFAULT 0,
  note            TEXT,
  FOREIGN KEY (registration_id) REFERENCES training_registrations(id) ON DELETE CASCADE
);
INSERT INTO registration_attendees VALUES(1,1,'ชินภัทร์ สุวรรณพุ่ม','','HR Manger',0,'');
CREATE TABLE training_evaluations (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  req_id         INTEGER,
  eval_form_code TEXT,
  evaluator_name TEXT,
  eval_date      TEXT,
  total_score    REAL,
  status         TEXT,                   -- pass | fail
  FOREIGN KEY (req_id) REFERENCES training_requests(id) ON DELETE CASCADE
);
INSERT INTO training_evaluations VALUES(1,1,'INT-01','ฝ่ายบุคคล','2026-02-11',4.2,'pass');
CREATE TABLE eval_responses (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  eval_id   INTEGER NOT NULL,
  item_code TEXT,
  score     REAL,
  comment   TEXT,
  FOREIGN KEY (eval_id) REFERENCES training_evaluations(id) ON DELETE CASCADE
);
INSERT INTO eval_responses VALUES(1,1,'INT-CO-001',4.0,'เนื้อหาดี');
INSERT INTO eval_responses VALUES(2,1,'INT-CO-002',5.0,'วิทยากรเป็นกันเอง');
INSERT INTO eval_responses VALUES(3,1,'INT-CO-003',4.0,'');
INSERT INTO eval_responses VALUES(4,1,'INT-CO-004',4.0,'');
INSERT INTO eval_responses VALUES(5,1,'INT-CO-005',4.0,'');
CREATE TABLE eval_attachments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  eval_id     INTEGER NOT NULL,
  filename    TEXT,
  file_data   TEXT,                      -- base64 data URL
  uploaded_at TEXT,
  FOREIGN KEY (eval_id) REFERENCES training_evaluations(id) ON DELETE CASCADE
);
CREATE TABLE training_plans (
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
CREATE TABLE training_plan_topics (
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
CREATE TABLE employees (
  code        TEXT PRIMARY KEY,
  sequence    INTEGER DEFAULT 0,
  full_name   TEXT NOT NULL,
  nickname    TEXT,
  email       TEXT,
  position_th TEXT,
  position_en TEXT,
  department  TEXT
, department_id INTEGER REFERENCES departments(id), position_id INTEGER REFERENCES positions(id));
INSERT INTO employees VALUES('6100001',1,'นาย โกสินทร์ วุฒิเจริญวงศ์','หนึ่ง','kosin.w@livplusthailand.com','กรรมการผู้จัดการ','Chief Executive Officer (CEO)','กรรมการผู้จัดการ',2,2);
INSERT INTO employees VALUES('6100002',2,'นางสาว ตรีจุฑา สรวงท่าไม้','พลอย','ceo@livplusthailand.com','กรรมการบริหาร','Managing Director (MD)','กรรมการผู้จัดการ',2,1);
INSERT INTO employees VALUES('6200001',3,'นางสาว ชุดา หาสอน','ชุ','tele.sales1@mylivplus.com','เจ้าหน้าที่ขายสินค้าทางโทรศัพท์','Telesales Staff','ฝ่ายขาย Out-Bound A',6,11);
INSERT INTO employees VALUES('6200002',4,'นางสาว กันยารัตน์ ดีประเสริฐ','บุ๋ม','kanyarat.dee@livplusthailand.com','ผู้เชี่ยวชาญงานสนับสนุนธุรกิจและประสบการณ์ลูกค้า','Business Support & Customer Experience Specialist','สายงานปฏิบัติการ',17,40);
INSERT INTO employees VALUES('6200003',5,'นาย ประครอง รักษาวงศ์','ดอง','sto1@mylivplus.com','เจ้าหน้าที่คลังสินค้า','Warehouse Staff','ฝ่ายคลังสินค้า',8,15);
INSERT INTO employees VALUES('6200004',6,'นางสาว เชษฐ์สุดา แสนจันทร์','มิ้ลค์','chetsuda.san@livplusthailand.com','พนักงานบัญชีและการเงิน','Accounting and Finance Officer','ฝ่ายบัญชีและการเงิน',10,23);
INSERT INTO employees VALUES('6200005',7,'นางสาว อำภากร มั่นเจ๊ก','จูล','adm.call1@mylivplus.com','เจ้าหน้าที่ขายสินค้าออนไลน์','Admin. Call Sales Staff','ฝ่ายขาย In-Bound',5,8);
INSERT INTO employees VALUES('6300001',8,'นางสาว เขมจิรา ชื่นวิทยา','เขม','order.mc1@mylivplus.com','พนักงานธุรการคลังสินค้าและบัญชี','Accounting and Warehouse Administrative Officer','ฝ่ายบัญชีและการเงิน',10,22);
INSERT INTO employees VALUES('6300002',9,'นางสาว วนิดา จันทร์ผง','ฝน','tele.sales2@mylivplus.com','เจ้าหน้าที่ขายสินค้าทางโทรศัพท์','Telesales Staff','ฝ่ายขาย Out-Bound A',6,11);
INSERT INTO employees VALUES('6400001',10,'นาย ฉัตรนรินทร์ ทองใหม่','มิ้นท์','mkt3@mylivplus.com','พนักงานออกแบบกราฟิก','Graphic Design Officer','ฝ่ายสร้างสรรค์และกลยุทธ์เนื้อหาการตลาด',14,34);
INSERT INTO employees VALUES('6500001',11,'นางสาว ภัทรสุดา ทนทาน','ฮาน่า','adm.call2@mylivplus.com','เจ้าหน้าที่ขายสินค้าออนไลน์','Admin. Call Sales Staff','ฝ่ายขาย In-Bound',5,8);
INSERT INTO employees VALUES('6500002',12,'นางสาว สุพัตรา ปราบมนตรี','โม','adm.call3@mylivplus.com','เจ้าหน้าที่ขายสินค้าออนไลน์','Admin. Call Sales Staff','ฝ่ายขาย In-Bound',5,8);
INSERT INTO employees VALUES('6500003',13,'นางสาว มาลา นาคสุวรรณ','แป๊ก','mala.n@livplusthailand.com','ผู้เชี่ยวชาญงานทรัพยากรบุคคล','Human Resources Specialist','ฝ่ายทรัพยากรบุคคล',9,18);
INSERT INTO employees VALUES('6500004',14,'นางสาว ณัฐณิชา เศรษฐกุลวาณิช','จ๊ะ','natnicha.set@mylivplus.com','เจ้าหน้าที่คลังสินค้า','Warehouse Staff','ฝ่ายคลังสินค้า',8,15);
INSERT INTO employees VALUES('6500005',15,'นางสาว จงรัก พรานพนัส','ขวัญ','order.mc2@mylivplus.com','พนักงานธุรการคลังสินค้าและบัญชี','Accounting and Warehouse Administrative Officer','ฝ่ายบัญชีและการเงิน',10,22);
INSERT INTO employees VALUES('6600001',16,'นางสาว รุ่งระวี ทองมลีวรรณ์','เต้','store@livplusthailand.com','หัวหน้างานคลังสินค้า','Warehouse Supervisor','ฝ่ายคลังสินค้า',8,14);
INSERT INTO employees VALUES('6600004',17,'นางสาว อรอุมา บุตรพันธ์','อร','adm.call4@mylivplus.com','เจ้าหน้าที่ขายสินค้าออนไลน์','Admin. Call Sales Staff','ฝ่ายขาย In-Bound',5,8);
INSERT INTO employees VALUES('6600005',18,'นางสาว จินดาพร อยู่สูง','หนูเล็ก','mkt1@mylivplus.com','พนักงานการตลาดเนื้อหาและสร้างสรรค์','Creative and Content Officer','ฝ่ายสร้างสรรค์และกลยุทธ์เนื้อหาการตลาด',14,32);
INSERT INTO employees VALUES('6600006',19,'นาย ป้อม จันทร์วิวัฒน์','ป้อม','adm.call5@mylivplus.com','เจ้าหน้าที่ขายสินค้าออนไลน์','Admin. Call Sales Staff','ฝ่ายขาย In-Bound',5,8);
INSERT INTO employees VALUES('6600007',20,'นางสาว เนตรนารี บุญมา','เนตร','adm.chat1@mylivplus.com','เจ้าหน้าที่ตอบแชทออนไลน์','Admin Chat Sales Staff','ฝ่ายขาย In-Bound',5,9);
INSERT INTO employees VALUES('6600008',21,'นางสาว ศศิกานต์ ผลผะกา','ชมพู่','adm.chat2@mylivplus.com','เจ้าหน้าที่ตอบแชทออนไลน์','Admin Chat Sales Staff','ฝ่ายขาย In-Bound',5,9);
INSERT INTO employees VALUES('6600009',22,'นาง กฤษณา เกิดศิริ','นก','tele.sales3@mylivplus.com','เจ้าหน้าที่ขายสินค้าทางโทรศัพท์','Telesales Staff','ฝ่ายขาย Out-Bound A',6,11);
INSERT INTO employees VALUES('6600010',23,'นางสาว จุฑาทิพย์ เหมือนเผือก','ตาล','tele.sales4@mylivplus.com','เจ้าหน้าที่ขายสินค้าทางโทรศัพท์','Telesales Staff','ฝ่ายขาย Out-Bound A',6,11);
INSERT INTO employees VALUES('6600011',24,'นาย ฉันทกรณ์ ศิลา','บอส','sto3@mylivplus.com','เจ้าหน้าที่คลังสินค้า','Warehouse Staff','ฝ่ายคลังสินค้า',8,15);
INSERT INTO employees VALUES('6600013',25,'นางสาว สิริรัฏฐ์ เข็มเพ็ชร','โย','tele.sales5@mylivplus.com','เจ้าหน้าที่ขายสินค้าทางโทรศัพท์','Telesales Staff','ฝ่ายขาย Out-Bound A',6,11);
INSERT INTO employees VALUES('6700001',26,'นางสาว ทัศนีย์ พิกุลหอม','ปอย','tele.sales6@mylivplus.com','เจ้าหน้าที่ขายสินค้าทางโทรศัพท์','Telesales Staff','ฝ่ายขาย Out-Bound A',6,11);
INSERT INTO employees VALUES('6700002',27,'นางสาว วรนิษฐ์ โรจน์อริยาพร','มารวย','tele.sales7@mylivplus.com','เจ้าหน้าที่ขายสินค้าทางโทรศัพท์','Telesales Staff','ฝ่ายขาย Out-Bound A',6,11);
INSERT INTO employees VALUES('6700003',28,'นาย จิรายุส คุรุเสถียรกิจ','แม็ค','mkt5@mylivplus.com','พนักงานตัดต่อวีดีโอเนื้อหา','Video Editor Officer','ฝ่ายสร้างสรรค์และกลยุทธ์เนื้อหาการตลาด',14,33);
INSERT INTO employees VALUES('6700004',29,'นาย จักรกฤษณ์ กำบังกาย','เล็ก','adm.chat3@mylivplus.com','เจ้าหน้าที่ตอบแชทออนไลน์','Admin Chat Sales Staff','ฝ่ายขาย In-Bound',5,9);
INSERT INTO employees VALUES('6700005',30,'นางสาว อัจฉราภรณ์ อิ่นแก้ว','ปูอัด','adm.chat4@mylivplus.com','เจ้าหน้าที่ตอบแชทออนไลน์','Admin Chat Sales Staff','ฝ่ายขาย In-Bound',5,9);
INSERT INTO employees VALUES('6700006',31,'นางสาว สรญา ดีประสงค์','โส','tele.sales8@mylivplus.com','เจ้าหน้าที่ขายสินค้าทางโทรศัพท์','Telesales Staff','ฝ่ายขาย Out-Bound A',6,11);
INSERT INTO employees VALUES('6700009',32,'นางสาว ธนภัค เต๊ะชัย','มุก','ceo-office@livplusthailand.com','ผู้ช่วยผู้บริหาร','Executive Assistant','กรรมการผู้จัดการ',2,3);
INSERT INTO employees VALUES('6700010',33,'นางสาว มธุรส มหาวงศ์','ลูกปัด','maturos.mah@mylivplus.com','เจ้าหน้าที่คลังสินค้า','Warehouse Staff','ฝ่ายคลังสินค้า',8,15);
INSERT INTO employees VALUES('6700012',34,'นางสาว อติภา สังข์สุวรรณ','ต้องตา','adm.call6@mylivplus.com','เจ้าหน้าที่ขายสินค้าออนไลน์','Admin. Call Sales Staff','ฝ่ายขาย In-Bound',5,8);
INSERT INTO employees VALUES('6700013',35,'นางสาว วิภาดา ปิ่นสุข','วิ','wipada.pin@mylivplus.com','เจ้าหน้าที่ขายสินค้าออนไลน์','Admin. Call Sales Staff','ฝ่ายขาย In-Bound',5,8);
INSERT INTO employees VALUES('6700014',36,'นางสาว ประภากรณ์ ลิชนะเธียร','พริกป่น','tele.sales10@mylivplus.com','เจ้าหน้าที่ขายสินค้าทางโทรศัพท์','Telesales Staff','ฝ่ายขาย Out-Bound A',6,11);
INSERT INTO employees VALUES('6700015',37,'นาย อนุสรณ์ สระทองบ้อง','ละเอ','tele.sales11@mylivplus.com','เจ้าหน้าที่ขายสินค้าทางโทรศัพท์','Telesales Staff','ฝ่ายขาย Out-Bound A',6,11);
INSERT INTO employees VALUES('6700016',38,'นางสาว กัณฐญา ศรีเกตุสุข','เพียว','tele.sales12@mylivplus.com','เจ้าหน้าที่ขายสินค้าทางโทรศัพท์','Telesales Staff','ฝ่ายขาย Out-Bound A',6,11);
INSERT INTO employees VALUES('6700017',39,'นางสาว ทิพย์สุดา ปลื้มใจ','ปุ้ย','product@livplusthailand.com','หัวหน้าทีมพัฒนาผลิตภัณฑ์และตรวจสอบคุณภาพ','Product Development, R&D and QC Team Lead','ฝ่ายวิจัยพัฒนาและควบคุมคุณภาพผลิตภัณฑ์',12,28);
INSERT INTO employees VALUES('6700018',40,'นาย พลพัฒน์ ทิมหาญ','กอล์ฟ','sales@livplusthailand.com','ผู้จัดการฝ่ายขาย','Sales Manager','สายงานขาย',16,39);
INSERT INTO employees VALUES('6700019',41,'นางสาว ธนานิษฐ์ ธนาสิริฐานันท์','พีช','admin_sup@livplusthailand.com','หัวหน้างานขายสินค้าออนไลน์','In-Bound Sales Supervisor','ฝ่ายขาย In-Bound',5,7);
INSERT INTO employees VALUES('6700020',42,'นางสาว ณหทัย ธนีเจริญ','หมวย','tele.sales13@mylivplus.com','เจ้าหน้าที่ขายสินค้าทางโทรศัพท์','Telesales Staff','ฝ่ายขาย Out-Bound A',6,11);
INSERT INTO employees VALUES('6700021',43,'นางสาว ภัควดี มณี','ปอนด์','puckawadee.m@livplusthailand.com','ผู้ช่วยผู้บริหาร','Executive Assistant','กรรมการผู้จัดการ',2,3);
INSERT INTO employees VALUES('6800001',44,'นาย นวัตกรณ์ แก้วอุ่น','โบ๊ท','mkt4@mylivplus.com','พนักงานการตลาดดิจิทัล','Digital Marketing Officer','ฝ่ายการตลาดดิจิทัล',4,5);
INSERT INTO employees VALUES('6800002',45,'นาย ชัยเมศร์ วรสมบูรณ์ไชย','ตี๋','tele_sup@livplusthailand.com','หัวหน้างานขายสินค้าทางโทรศัพท์','Out-Bound Sales Supervisor','ฝ่ายขาย Out-Bound A',6,10);
INSERT INTO employees VALUES('6800004',46,'นางสาว พรพิมล คงทัด','พลอย','pornpimol.kon@mylivplus.com','เจ้าหน้าที่ตอบแชทออนไลน์','Admin Chat Sales Staff','ฝ่ายขาย In-Bound',5,9);
INSERT INTO employees VALUES('6800005',47,'นางสาว นุชนาฏ พุทธเวช','หนุงหนิง','tele.sales14@mylivplus.com','เจ้าหน้าที่ขายสินค้าทางโทรศัพท์','Telesales Staff','ฝ่ายขาย Out-Bound A',6,11);
INSERT INTO employees VALUES('6800006',48,'นางสาว ปภัสสร พุทธเวช','บิงโก','tele.sales15@mylivplus.com','เจ้าหน้าที่ขายสินค้าทางโทรศัพท์','Telesales Staff','ฝ่ายขาย Out-Bound A',6,11);
INSERT INTO employees VALUES('6800008',49,'นาง นาฏยา ทัศนีย์','ตุ๊','nataya.tas@livplusthailand.com','หัวหน้าสายงานปฏิบัติการ','Head of Operations','สายงานปฏิบัติการ',17,42);
INSERT INTO employees VALUES('6800009',50,'นางสาว ภันฑิรา กนกรัตนา','ออม','accounting2@livplusthailand.com','พนักงานบัญชีและการเงิน','Accounting and Finance Officer','ฝ่ายบัญชีและการเงิน',10,23);
INSERT INTO employees VALUES('6800010',51,'นางสาว ชุติมา คุณทอง','จูน','tele.sales16@mylivplus.com','เจ้าหน้าที่ขายสินค้าทางโทรศัพท์','Telesales Staff','ฝ่ายขาย Out-Bound B',7,13);
INSERT INTO employees VALUES('6800011',52,'นางสาว สุชานันท์ มูลทองโร่ย','ไหมไหม','mkt7@mylivplus.com','พนักงานการตลาดดิจิทัล','Digital Marketing Officer','ฝ่ายการตลาดดิจิทัล',4,5);
INSERT INTO employees VALUES('6800012',53,'นางสาว สุพรรษา สนสูงเนิน','อาร์ม','suphansa.son@mylivplus.com','พนักงานวิจัยและพัฒนาและตรวจสอบคุณภาพผลิตภัณฑ์','R&D and QC Production Auditor','ฝ่ายวิจัยพัฒนาและควบคุมคุณภาพผลิตภัณฑ์',12,27);
INSERT INTO employees VALUES('6800013',54,'นางสาว บุญญาดา เพราะสำเนียง','ดา','tele.sales9@mylivplus.com','เจ้าหน้าที่ขายสินค้าทางโทรศัพท์','Telesales Staff','ฝ่ายขาย Out-Bound B',7,13);
INSERT INTO employees VALUES('6800014',55,'นาย คฑาวุฒิ ถือมั่น','วุด','khathawut.thu@mylivplus.com','เจ้าหน้าที่คลังสินค้า','Warehouse Staff','ฝ่ายคลังสินค้า',8,15);
INSERT INTO employees VALUES('6800015',56,'นางสาว พรทิวา สร้อยมาลัย','มาย','pontiwa.m@gmail.com','พนักงานการตลาดโครงการอาวุโส','Marketing Project Senior Officer','สายงานการตลาด',15,37);
INSERT INTO employees VALUES('6800016',57,'นางสาว นชิตา นาราวัน','ต่าย','callin.2@mylivplus.com','เจ้าหน้าที่ขายสินค้าออนไลน์','Admin. Call Sales Staff','ฝ่ายขาย In-Bound',5,8);
INSERT INTO employees VALUES('6800017',58,'นาย นฤพล พันธุ์จบสิงห์','เซน','accounting@livplusthailand.com','หัวหน้างานบัญชีและการเงิน','Accounting and Finance Supervisor','ฝ่ายบัญชีและการเงิน',10,24);
INSERT INTO employees VALUES('6800018',59,'นางสาว ณัฐณิชา สมพานต์','หนึ่ง','mkt2@mylivplus.com','หัวหน้าทีมการตลาดเนื้อหาและสร้างสรรค์','Creative and Content Team Lead','ฝ่ายสร้างสรรค์และกลยุทธ์เนื้อหาการตลาด',14,35);
INSERT INTO employees VALUES('6800019',60,'นาย จักรกฤษณ์ พึ่งม่วง','แจ๊ค','data_analyst@mylivplus.com','หัวหน้าทีมวิเคราะห์ข้อมูลและเทคโนโลยีดิจิทัล','Business Intelligence and Digital Technology Team Lead','ฝ่ายวิเคราะห์ข้อมูลและเทคโนโลยีดิจิทัล',13,30);
INSERT INTO employees VALUES('6800020',61,'นางสาว นิธินันท์ ศรีเพ็ญแก้ว','กอล์ฟ','tele.sales19@mylivplus.com','เจ้าหน้าที่ขายสินค้าทางโทรศัพท์','Telesales Staff','ฝ่ายขาย Out-Bound B',7,13);
INSERT INTO employees VALUES('6800021',62,'นาย ณัฐพัฒน์ สุขใส','โบ๊ท','data_analyst2@mylivplus.com','นักวิเคราะห์ข้อมูลธุรกิจ','Business Data Analyst','ฝ่ายวิเคราะห์ข้อมูลและเทคโนโลยีดิจิทัล',13,29);
INSERT INTO employees VALUES('6800022',63,'นางสาว สายรุ้ง ศรีมันตะ','แก้ว','Sairoong.sri@mylivplus.com','พนักงานออกแบบกราฟิก','Graphic Design Officer','ฝ่ายสร้างสรรค์และกลยุทธ์เนื้อหาการตลาด',14,34);
INSERT INTO employees VALUES('6800025',64,'นางสาว จริยา แตงโม','เจน','jariya.tan@mylivplus.com','พนักงานธุรการ','Administrative Officer','สายงานปฏิบัติการ',17,41);
INSERT INTO employees VALUES('6800026',65,'นางสาว อรธิรา เฉลิมถ้อย','ลูกเกด','ontira.cha@livplusthailand.com','พนักงานบริหารทรัพยากรบุคคลอาวุโส','Human Resources Management Senior Officer','ฝ่ายทรัพยากรบุคคล',9,19);
INSERT INTO employees VALUES('6800027',66,'นางสาว พิชญ์ฌาภัส พรหมศิริพัฒน์','ฟ้า','adm.call9@mylivplus.com','เจ้าหน้าที่ขายสินค้าออนไลน์','Admin. Call Sales Staff','ฝ่ายขาย In-Bound',5,8);
INSERT INTO employees VALUES('6800028',67,'นางสาว รุตินันต์ คุณทอง','ทราย','tele.sales21@mylivplus.com','เจ้าหน้าที่ขายสินค้าทางโทรศัพท์','Telesales Staff','ฝ่ายขาย Out-Bound B',7,13);
INSERT INTO employees VALUES('6800029',68,'นาย ณัฐพงศ์ ศรีสินสมุทร','สุเมษ','mkt6@mylivplus.com','พนักงานตัดต่อวีดีโอเนื้อหา','Video Editor Officer','ฝ่ายสร้างสรรค์และกลยุทธ์เนื้อหาการตลาด',14,33);
INSERT INTO employees VALUES('6800030',69,'นางสาว ศศิมา เทแก้ว','กิ๊ก','mkt9@mylivplus.com','หัวหน้าทีมการตลาดดิจิทัล','Digital Marketing Team Lead','ฝ่ายการตลาดดิจิทัล',4,6);
INSERT INTO employees VALUES('6900001',70,'นาย ชินภัทร์ สุวรรณพุ่ม','ชิน','shinapat.s@livplusthailand.com','ผู้จัดการฝ่ายทรัพยากรบุคคล','Human Resources Manager','ฝ่ายทรัพยากรบุคคล',9,17);
INSERT INTO employees VALUES('6900002',71,'นางสาว พิมพ์นารา ชวนชม','แหม่ม','adm.call10@mylivplus.com','เจ้าหน้าที่ขายสินค้าออนไลน์','Admin. Call Sales Staff','ฝ่ายขาย In-Bound',5,8);
INSERT INTO employees VALUES('6900004',72,'นางสาว อรวรรณ วงศ์ธนากรชัย','จุ๋ม','head_marketing@livplusthailand.com','หัวหน้าสายงานการตลาด','Head of Marketing','สายงานการตลาด',15,38);
INSERT INTO employees VALUES('6900005',73,'นางสาว อรนุช ภะวัง','แอม','oranut.pha@mylivplus.com','นักวิเคราะห์ข้อมูลธุรกิจ','Business Data Analyst','ฝ่ายวิเคราะห์ข้อมูลและเทคโนโลยีดิจิทัล',13,29);
INSERT INTO employees VALUES('6900007',74,'นางสาว สุมนมาศ พงศ์ปรีชา','หญิง','tele.sales18@mylivplus.com','เจ้าหน้าที่ขายสินค้าทางโทรศัพท์','Telesales Staff','ฝ่ายขาย Out-Bound B',7,13);
INSERT INTO employees VALUES('6900008',75,'นางสาว อารยา พึ่งมี','เพ้นท์','qa2@mylivplus.com','พนักงานตรวจสอบคุณภาพการขาย','Quality Assurance Officer','ฝ่ายประสบการณ์ลูกค้า',11,25);
INSERT INTO employees VALUES('6900009',76,'นางสาว ภัทรมน ธงไชย','เมย์','hrd@livplusthailand.com','พนักงานพัฒนาองค์กรอาวุโส','Organization Development Senior Officer','ฝ่ายทรัพยากรบุคคล',9,21);
INSERT INTO employees VALUES('6900010',77,'นาย ธนรัตน์ รอดพ่าย','บุ๊ค','trainer@livplusthailand.com','พนักงานพัฒนาทรัพยากรบุคคลอาวุโส','Human Resources Development Senior Officer','ฝ่ายทรัพยากรบุคคล',9,20);
INSERT INTO employees VALUES('6900014',78,'นางสาว วราภรณ์ เอี่ยมนาวินทร์','เก๋','waraporn.aie@mylivplus.com','เจ้าหน้าที่ขายสินค้าทางโทรศัพท์','Telesales Staff','ฝ่ายขาย Out-Bound A',6,11);
INSERT INTO employees VALUES('6900015',79,'นางสาว จุฑารัตน์ ทองสนิท','เมย์','jutharat.tho@mylivplus.com','พนักงานการตลาดดิจิทัล','Digital Marketing Officer','ฝ่ายการตลาดดิจิทัล',4,5);
INSERT INTO employees VALUES('6900016',80,'นางสาว ธัญชนก กฤดิกุล','ตอง','thanchanok.kri@livplusthailand.com','หัวหน้าทีม KOL Affiliate และ Live Management','KOL, Affiliate and Live Management Team Lead','ฝ่ายการตลาด KOL, Affiliate และการจัดการ Live',3,4);
INSERT INTO employees VALUES('6900017',81,'นางสาว นันทา ขันทอง','ปูเป้','nanta.kha@mylivplus.com','เจ้าหน้าที่ขายสินค้าทางโทรศัพท์','Telesales Staff','ฝ่ายขาย Out-Bound B',7,13);
INSERT INTO employees VALUES('6900018',82,'นางสาว อิงอร อินทรา','ก้อย','ingorn.int@mylivplus.com','เจ้าหน้าที่ขายสินค้าทางโทรศัพท์','Telesales Staff','ฝ่ายขาย Out-Bound B',7,13);
INSERT INTO employees VALUES('6900019',83,'นางสาว ภาวนา มั่นสงค์','ก้อย','adm.chat6@mylivplus.com','เจ้าหน้าที่ตอบแชทออนไลน์','Admin Chat Sales Staff','ฝ่ายขาย In-Bound',5,9);
INSERT INTO employees VALUES('6900020',84,'นางสาว พนิดา ผ่านอ้น','อ้อย','Panida.pha@mylivplus.com','พนักงานบริการหลังการขาย','Customer Services Officer','ฝ่ายประสบการณ์ลูกค้า',11,26);
INSERT INTO employees VALUES('6900021',85,'นางสาว นัทธ์ชนัน กุสารัมย์','มิว','adm.chat8@mylivplus.com','เจ้าหน้าที่ตอบแชทออนไลน์','Admin Chat Sales Staff','ฝ่ายขาย In-Bound',5,9);
INSERT INTO employees VALUES('6900022',86,'นางสาว มณีรัตน์ นันขุนทศ','ปุ๊กกี้','tele.sales20@mylivplus.com','เจ้าหน้าที่ขายสินค้าทางโทรศัพท์','Telesales Staff','ฝ่ายขาย Out-Bound A',6,11);
INSERT INTO employees VALUES('6900025',87,'นางสาว พรศรี กำจรรัศมีกิจ','มอคค่า','pornsri.kam@mylivplus.com','เจ้าหน้าที่ขายสินค้าทางโทรศัพท์','Telesales Staff','ฝ่ายขาย Out-Bound B',7,13);
INSERT INTO employees VALUES('6900026',88,'นางสาว ดีลยา รุจิรอานนท์','ซิ้ม','Coordinator@livplusthailand.com','Key Account Executive','Key Account Executive','สายงานการตลาด',15,36);
INSERT INTO employees VALUES('6900027',89,'นางสาว สิริกานต์ กระทิงทอง','นิ้ง','sirikarn.kra@mylivplus.com','พนักงานการตลาดเนื้อหาและสร้างสรรค์','Creative and Content Officer','ฝ่ายสร้างสรรค์และกลยุทธ์เนื้อหาการตลาด',14,32);
INSERT INTO employees VALUES('6900029',90,'นางสาว นันทวัน ศิรเกียรติพล','แนน','nantawan.sir@livplusthailand.com','เจ้าหน้าที่จัดซื้ออาวุโส','Senior Procurement Officer','สายงานปฏิบัติการ',17,43);
INSERT INTO employees VALUES('6900030',91,'นางสาว ฐายิกา ทัศนีย์','ไอซ์','thayika.tas@mylivplus.com','พนักงานบริการหลังการขาย','Customer Services Officer','ฝ่ายประสบการณ์ลูกค้า',11,26);
INSERT INTO employees VALUES('6900031',92,'นาย นฤเศรษฐ์ สูตรดำริห์วงศ์','ตั้ม','naruesade.sud@mylivplus.com','เจ้าหน้าที่ขายสินค้าทางโทรศัพท์','Telesales Staff','ฝ่ายขาย Out-Bound B',7,13);
INSERT INTO employees VALUES('6900033',93,'นาย เสริฐสินธ์ ธัญญรังสิกุล','เอ็ม','serthsin.tan@livplusthailand.com','หัวหน้างานขายสินค้าทางโทรศัพท์','Out-Bound Sales Supervisor','ฝ่ายขาย Out-Bound B',7,12);
INSERT INTO employees VALUES('6900034',94,'นางสาว จิราภรณ์ สิงห์ช่างชัย','มุก','cheeraporn.sin@mylivplus.com','เจ้าหน้าที่ขายสินค้าทางโทรศัพท์','Telesales Staff','ฝ่ายขาย Out-Bound B',7,13);
INSERT INTO employees VALUES('6900035',95,'นาย เสาร์แก้ว วาตสกุล','แก้ว','saokaew.wat@livplusthailand.com','เจ้าหน้าที่สนับสนุนงานเทคโนโลยีสารสนเทศอาวุโส','Senior IT Support','ฝ่ายวิเคราะห์ข้อมูลและเทคโนโลยีดิจิทัล',13,31);
INSERT INTO employees VALUES('6900036',96,'นาย เอกภณ อภิสรภคิน','หมีพูห์','aekkaphon.aph@mylivplus.com','นักศึกษาฝึกงาน','Intern','ฝ่ายทรัพยากรบุคคล',9,16);
CREATE TABLE departments (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  code    TEXT NOT NULL UNIQUE,
  name    TEXT NOT NULL,
  name_en TEXT
);
INSERT INTO departments VALUES(2,'EXEC','กรรมการผู้จัดการ',NULL);
INSERT INTO departments VALUES(3,'MKT-KOL','ฝ่ายการตลาด KOL, Affiliate และการจัดการ Live',NULL);
INSERT INTO departments VALUES(4,'MKT-DIG','ฝ่ายการตลาดดิจิทัล',NULL);
INSERT INTO departments VALUES(5,'SALES-IB','ฝ่ายขาย In-Bound',NULL);
INSERT INTO departments VALUES(6,'SALES-OBA','ฝ่ายขาย Out-Bound A',NULL);
INSERT INTO departments VALUES(7,'SALES-OBB','ฝ่ายขาย Out-Bound B',NULL);
INSERT INTO departments VALUES(8,'WH','ฝ่ายคลังสินค้า',NULL);
INSERT INTO departments VALUES(9,'HR','ฝ่ายทรัพยากรบุคคล',NULL);
INSERT INTO departments VALUES(10,'ACC','ฝ่ายบัญชีและการเงิน',NULL);
INSERT INTO departments VALUES(11,'CX','ฝ่ายประสบการณ์ลูกค้า',NULL);
INSERT INTO departments VALUES(12,'RD','ฝ่ายวิจัยพัฒนาและควบคุมคุณภาพผลิตภัณฑ์',NULL);
INSERT INTO departments VALUES(13,'DATA','ฝ่ายวิเคราะห์ข้อมูลและเทคโนโลยีดิจิทัล',NULL);
INSERT INTO departments VALUES(14,'CREATIVE','ฝ่ายสร้างสรรค์และกลยุทธ์เนื้อหาการตลาด',NULL);
INSERT INTO departments VALUES(15,'DIV-MKT','สายงานการตลาด',NULL);
INSERT INTO departments VALUES(16,'DIV-SALES','สายงานขาย',NULL);
INSERT INTO departments VALUES(17,'DIV-OPS','สายงานปฏิบัติการ',NULL);
CREATE TABLE positions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  code          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  name_en       TEXT,
  level         TEXT,
  department_id INTEGER REFERENCES departments(id)
);
INSERT INTO positions VALUES(1,'EXEC-DIR','กรรมการบริหาร','','',2);
INSERT INTO positions VALUES(2,'EXEC-MD','กรรมการผู้จัดการ','','',2);
INSERT INTO positions VALUES(3,'EXEC-ASST','ผู้ช่วยผู้บริหาร',NULL,NULL,2);
INSERT INTO positions VALUES(4,'MKT-KOL-HD','หัวหน้าทีม KOL Affiliate และ Live Management',NULL,NULL,3);
INSERT INTO positions VALUES(5,'MKT-DIG-ST','พนักงานการตลาดดิจิทัล',NULL,NULL,4);
INSERT INTO positions VALUES(6,'MKT-DIG-HD','หัวหน้าทีมการตลาดดิจิทัล',NULL,NULL,4);
INSERT INTO positions VALUES(7,'SALES-IB-HD','หัวหน้างานขายสินค้าออนไลน์',NULL,NULL,5);
INSERT INTO positions VALUES(8,'SALES-IB-ST','เจ้าหน้าที่ขายสินค้าออนไลน์',NULL,NULL,5);
INSERT INTO positions VALUES(9,'SALES-IB-CH','เจ้าหน้าที่ตอบแชทออนไลน์',NULL,NULL,5);
INSERT INTO positions VALUES(10,'SALES-OBA-HD','หัวหน้างานขายสินค้าทางโทรศัพท์',NULL,NULL,6);
INSERT INTO positions VALUES(11,'SALES-OBA-ST','เจ้าหน้าที่ขายสินค้าทางโทรศัพท์',NULL,NULL,6);
INSERT INTO positions VALUES(12,'SALES-OBB-HD','หัวหน้างานขายสินค้าทางโทรศัพท์',NULL,NULL,7);
INSERT INTO positions VALUES(13,'SALES-OBB-ST','เจ้าหน้าที่ขายสินค้าทางโทรศัพท์',NULL,NULL,7);
INSERT INTO positions VALUES(14,'WH-HD','หัวหน้างานคลังสินค้า',NULL,NULL,8);
INSERT INTO positions VALUES(15,'WH-ST','เจ้าหน้าที่คลังสินค้า',NULL,NULL,8);
INSERT INTO positions VALUES(16,'HR-INTERN','นักศึกษาฝึกงาน',NULL,NULL,9);
INSERT INTO positions VALUES(17,'HR-MGR','ผู้จัดการฝ่ายทรัพยากรบุคคล',NULL,NULL,9);
INSERT INTO positions VALUES(18,'HR-SPEC','ผู้เชี่ยวชาญงานทรัพยากรบุคคล',NULL,NULL,9);
INSERT INTO positions VALUES(19,'HR-SR-HRM','พนักงานบริหารทรัพยากรบุคคลอาวุโส',NULL,NULL,9);
INSERT INTO positions VALUES(20,'HR-SR-HRD','พนักงานพัฒนาทรัพยากรบุคคลอาวุโส',NULL,NULL,9);
INSERT INTO positions VALUES(21,'HR-SR-OD','พนักงานพัฒนาองค์กรอาวุโส',NULL,NULL,9);
INSERT INTO positions VALUES(22,'ACC-WH','พนักงานธุรการคลังสินค้าและบัญชี',NULL,NULL,10);
INSERT INTO positions VALUES(23,'ACC-ST','พนักงานบัญชีและการเงิน',NULL,NULL,10);
INSERT INTO positions VALUES(24,'ACC-HD','หัวหน้างานบัญชีและการเงิน','','',10);
INSERT INTO positions VALUES(25,'CX-QA','พนักงานตรวจสอบคุณภาพการขาย',NULL,NULL,11);
INSERT INTO positions VALUES(26,'CX-AS','พนักงานบริการหลังการขาย',NULL,NULL,11);
INSERT INTO positions VALUES(27,'RD-ST','พนักงานวิจัยและพัฒนาและตรวจสอบคุณภาพผลิตภัณฑ์',NULL,NULL,12);
INSERT INTO positions VALUES(28,'RD-HD','หัวหน้าทีมพัฒนาผลิตภัณฑ์และตรวจสอบคุณภาพ',NULL,NULL,12);
INSERT INTO positions VALUES(29,'DATA-AN','นักวิเคราะห์ข้อมูลธุรกิจ',NULL,NULL,13);
INSERT INTO positions VALUES(30,'DATA-HD','หัวหน้าทีมวิเคราะห์ข้อมูลและเทคโนโลยีดิจิทัล',NULL,NULL,13);
INSERT INTO positions VALUES(31,'DATA-IT','เจ้าหน้าที่สนับสนุนงานเทคโนโลยีสารสนเทศอาวุโส',NULL,NULL,13);
INSERT INTO positions VALUES(32,'CRT-MKT','พนักงานการตลาดเนื้อหาและสร้างสรรค์',NULL,NULL,14);
INSERT INTO positions VALUES(33,'CRT-VID','พนักงานตัดต่อวีดีโอเนื้อหา',NULL,NULL,14);
INSERT INTO positions VALUES(34,'CRT-GFX','พนักงานออกแบบกราฟิก',NULL,NULL,14);
INSERT INTO positions VALUES(35,'CRT-HD','หัวหน้าทีมการตลาดเนื้อหาและสร้างสรรค์',NULL,NULL,14);
INSERT INTO positions VALUES(36,'DIV-MKT-KA','Key Account Executive',NULL,NULL,15);
INSERT INTO positions VALUES(37,'DIV-MKT-SR','พนักงานการตลาดโครงการอาวุโส',NULL,NULL,15);
INSERT INTO positions VALUES(38,'DIV-MKT-HD','หัวหน้าสายงานการตลาด',NULL,NULL,15);
INSERT INTO positions VALUES(39,'DIV-SALES-MGR','ผู้จัดการฝ่ายขาย',NULL,NULL,16);
INSERT INTO positions VALUES(40,'DIV-OPS-SPEC','ผู้เชี่ยวชาญงานสนับสนุนธุรกิจและประสบการณ์ลูกค้า',NULL,NULL,17);
INSERT INTO positions VALUES(41,'DIV-OPS-ADM','พนักงานธุรการ',NULL,NULL,17);
INSERT INTO positions VALUES(42,'DIV-OPS-HD','หัวหน้าสายงานปฏิบัติการ',NULL,NULL,17);
INSERT INTO positions VALUES(43,'DIV-OPS-PUR','เจ้าหน้าที่จัดซื้ออาวุโส',NULL,NULL,17);
CREATE TABLE competency_assignments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  course_code   TEXT REFERENCES courses(code),
  department_id INTEGER REFERENCES departments(id),
  position_id   INTEGER REFERENCES positions(id),
  assign_type   TEXT NOT NULL CHECK(assign_type IN ('organization','functional')),
  UNIQUE(course_code, department_id, position_id)
);
CREATE TABLE competency_departments (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  competency_id  INTEGER NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  department_id  INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  UNIQUE(competency_id, department_id)
);
INSERT INTO competency_departments VALUES(13,4,9);
INSERT INTO competency_departments VALUES(20,3,9);
INSERT INTO competency_departments VALUES(23,5,9);
INSERT INTO competency_departments VALUES(24,8,9);
CREATE TABLE position_competency_profiles (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  position_id    INTEGER NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  competency_id  INTEGER NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  required_level INTEGER NOT NULL CHECK(required_level BETWEEN 1 AND 5),
  UNIQUE(position_id, competency_id)
);
INSERT INTO position_competency_profiles VALUES(73,19,3,3);
INSERT INTO position_competency_profiles VALUES(250,19,4,3);
INSERT INTO position_competency_profiles VALUES(389,19,5,1);
INSERT INTO position_competency_profiles VALUES(443,23,6,3);
INSERT INTO position_competency_profiles VALUES(444,22,6,3);
INSERT INTO position_competency_profiles VALUES(445,34,6,3);
INSERT INTO position_competency_profiles VALUES(446,35,6,3);
INSERT INTO position_competency_profiles VALUES(447,32,6,3);
INSERT INTO position_competency_profiles VALUES(448,33,6,3);
INSERT INTO position_competency_profiles VALUES(449,26,6,3);
INSERT INTO position_competency_profiles VALUES(450,25,6,3);
INSERT INTO position_competency_profiles VALUES(451,29,6,3);
INSERT INTO position_competency_profiles VALUES(452,30,6,3);
INSERT INTO position_competency_profiles VALUES(453,31,6,3);
INSERT INTO position_competency_profiles VALUES(454,38,6,3);
INSERT INTO position_competency_profiles VALUES(455,36,6,3);
INSERT INTO position_competency_profiles VALUES(456,37,6,3);
INSERT INTO position_competency_profiles VALUES(457,41,6,3);
INSERT INTO position_competency_profiles VALUES(458,42,6,3);
INSERT INTO position_competency_profiles VALUES(459,43,6,3);
INSERT INTO position_competency_profiles VALUES(460,40,6,3);
INSERT INTO position_competency_profiles VALUES(461,39,6,3);
INSERT INTO position_competency_profiles VALUES(462,3,6,3);
INSERT INTO position_competency_profiles VALUES(463,1,6,3);
INSERT INTO position_competency_profiles VALUES(464,2,6,3);
INSERT INTO position_competency_profiles VALUES(465,16,6,1);
INSERT INTO position_competency_profiles VALUES(466,17,6,3);
INSERT INTO position_competency_profiles VALUES(467,18,6,2);
INSERT INTO position_competency_profiles VALUES(468,20,6,2);
INSERT INTO position_competency_profiles VALUES(469,19,6,1);
INSERT INTO position_competency_profiles VALUES(470,21,6,1);
INSERT INTO position_competency_profiles VALUES(471,6,6,3);
INSERT INTO position_competency_profiles VALUES(472,5,6,3);
INSERT INTO position_competency_profiles VALUES(473,4,6,3);
INSERT INTO position_competency_profiles VALUES(474,28,6,3);
INSERT INTO position_competency_profiles VALUES(475,27,6,3);
INSERT INTO position_competency_profiles VALUES(476,9,6,3);
INSERT INTO position_competency_profiles VALUES(477,7,6,3);
INSERT INTO position_competency_profiles VALUES(478,8,6,3);
INSERT INTO position_competency_profiles VALUES(479,10,6,3);
INSERT INTO position_competency_profiles VALUES(480,11,6,3);
INSERT INTO position_competency_profiles VALUES(481,12,6,3);
INSERT INTO position_competency_profiles VALUES(482,13,6,3);
INSERT INTO position_competency_profiles VALUES(483,14,6,3);
INSERT INTO position_competency_profiles VALUES(484,15,6,3);
INSERT INTO position_competency_profiles VALUES(486,23,7,3);
INSERT INTO position_competency_profiles VALUES(487,22,7,3);
INSERT INTO position_competency_profiles VALUES(488,34,7,3);
INSERT INTO position_competency_profiles VALUES(489,35,7,3);
INSERT INTO position_competency_profiles VALUES(490,32,7,3);
INSERT INTO position_competency_profiles VALUES(491,33,7,3);
INSERT INTO position_competency_profiles VALUES(492,26,7,3);
INSERT INTO position_competency_profiles VALUES(493,25,7,3);
INSERT INTO position_competency_profiles VALUES(494,29,7,3);
INSERT INTO position_competency_profiles VALUES(495,30,7,3);
INSERT INTO position_competency_profiles VALUES(496,31,7,3);
INSERT INTO position_competency_profiles VALUES(497,38,7,3);
INSERT INTO position_competency_profiles VALUES(498,36,7,3);
INSERT INTO position_competency_profiles VALUES(499,37,7,3);
INSERT INTO position_competency_profiles VALUES(500,41,7,3);
INSERT INTO position_competency_profiles VALUES(501,42,7,3);
INSERT INTO position_competency_profiles VALUES(502,43,7,3);
INSERT INTO position_competency_profiles VALUES(503,40,7,3);
INSERT INTO position_competency_profiles VALUES(504,39,7,3);
INSERT INTO position_competency_profiles VALUES(505,3,7,3);
INSERT INTO position_competency_profiles VALUES(506,1,7,3);
INSERT INTO position_competency_profiles VALUES(507,2,7,3);
INSERT INTO position_competency_profiles VALUES(508,16,7,1);
INSERT INTO position_competency_profiles VALUES(509,17,7,3);
INSERT INTO position_competency_profiles VALUES(510,18,7,2);
INSERT INTO position_competency_profiles VALUES(511,20,7,2);
INSERT INTO position_competency_profiles VALUES(512,19,7,1);
INSERT INTO position_competency_profiles VALUES(513,21,7,1);
INSERT INTO position_competency_profiles VALUES(514,6,7,3);
INSERT INTO position_competency_profiles VALUES(515,5,7,3);
INSERT INTO position_competency_profiles VALUES(516,4,7,3);
INSERT INTO position_competency_profiles VALUES(517,28,7,3);
INSERT INTO position_competency_profiles VALUES(518,27,7,3);
INSERT INTO position_competency_profiles VALUES(519,9,7,3);
INSERT INTO position_competency_profiles VALUES(520,7,7,3);
INSERT INTO position_competency_profiles VALUES(521,8,7,3);
INSERT INTO position_competency_profiles VALUES(522,10,7,3);
INSERT INTO position_competency_profiles VALUES(523,11,7,3);
INSERT INTO position_competency_profiles VALUES(524,12,7,3);
INSERT INTO position_competency_profiles VALUES(525,13,7,3);
INSERT INTO position_competency_profiles VALUES(526,14,7,3);
INSERT INTO position_competency_profiles VALUES(527,15,7,3);
INSERT INTO position_competency_profiles VALUES(564,16,5,2);
INSERT INTO position_competency_profiles VALUES(565,17,5,2);
INSERT INTO position_competency_profiles VALUES(566,20,5,2);
INSERT INTO position_competency_profiles VALUES(567,21,5,2);
INSERT INTO position_competency_profiles VALUES(568,18,5,3);
INSERT INTO position_competency_profiles VALUES(569,24,1,3);
INSERT INTO position_competency_profiles VALUES(570,23,1,3);
INSERT INTO position_competency_profiles VALUES(571,22,1,3);
INSERT INTO position_competency_profiles VALUES(572,34,1,3);
INSERT INTO position_competency_profiles VALUES(573,35,1,3);
INSERT INTO position_competency_profiles VALUES(574,32,1,3);
INSERT INTO position_competency_profiles VALUES(575,33,1,3);
INSERT INTO position_competency_profiles VALUES(576,26,1,3);
INSERT INTO position_competency_profiles VALUES(577,25,1,3);
INSERT INTO position_competency_profiles VALUES(578,29,1,3);
INSERT INTO position_competency_profiles VALUES(579,30,1,3);
INSERT INTO position_competency_profiles VALUES(580,31,1,3);
INSERT INTO position_competency_profiles VALUES(581,38,1,3);
INSERT INTO position_competency_profiles VALUES(582,36,1,3);
INSERT INTO position_competency_profiles VALUES(583,37,1,3);
INSERT INTO position_competency_profiles VALUES(584,41,1,3);
INSERT INTO position_competency_profiles VALUES(585,42,1,3);
INSERT INTO position_competency_profiles VALUES(586,43,1,3);
INSERT INTO position_competency_profiles VALUES(587,40,1,3);
INSERT INTO position_competency_profiles VALUES(588,39,1,3);
INSERT INTO position_competency_profiles VALUES(589,3,1,3);
INSERT INTO position_competency_profiles VALUES(590,1,1,3);
INSERT INTO position_competency_profiles VALUES(591,2,1,3);
INSERT INTO position_competency_profiles VALUES(592,16,1,1);
INSERT INTO position_competency_profiles VALUES(593,17,1,2);
INSERT INTO position_competency_profiles VALUES(594,18,1,2);
INSERT INTO position_competency_profiles VALUES(595,20,1,2);
INSERT INTO position_competency_profiles VALUES(596,19,1,2);
INSERT INTO position_competency_profiles VALUES(597,21,1,1);
INSERT INTO position_competency_profiles VALUES(598,6,1,3);
INSERT INTO position_competency_profiles VALUES(599,5,1,3);
INSERT INTO position_competency_profiles VALUES(600,4,1,3);
INSERT INTO position_competency_profiles VALUES(601,28,1,3);
INSERT INTO position_competency_profiles VALUES(602,27,1,3);
INSERT INTO position_competency_profiles VALUES(603,9,1,3);
INSERT INTO position_competency_profiles VALUES(604,7,1,3);
INSERT INTO position_competency_profiles VALUES(605,8,1,3);
INSERT INTO position_competency_profiles VALUES(606,10,1,3);
INSERT INTO position_competency_profiles VALUES(607,11,1,3);
INSERT INTO position_competency_profiles VALUES(608,12,1,3);
INSERT INTO position_competency_profiles VALUES(609,13,1,3);
INSERT INTO position_competency_profiles VALUES(610,14,1,3);
INSERT INTO position_competency_profiles VALUES(611,15,1,3);
INSERT INTO position_competency_profiles VALUES(612,24,2,3);
INSERT INTO position_competency_profiles VALUES(613,23,2,3);
INSERT INTO position_competency_profiles VALUES(614,22,2,3);
INSERT INTO position_competency_profiles VALUES(615,34,2,3);
INSERT INTO position_competency_profiles VALUES(616,35,2,3);
INSERT INTO position_competency_profiles VALUES(617,32,2,3);
INSERT INTO position_competency_profiles VALUES(618,33,2,3);
INSERT INTO position_competency_profiles VALUES(619,26,2,3);
INSERT INTO position_competency_profiles VALUES(620,25,2,3);
INSERT INTO position_competency_profiles VALUES(621,29,2,3);
INSERT INTO position_competency_profiles VALUES(622,30,2,3);
INSERT INTO position_competency_profiles VALUES(623,31,2,3);
INSERT INTO position_competency_profiles VALUES(624,38,2,3);
INSERT INTO position_competency_profiles VALUES(625,36,2,3);
INSERT INTO position_competency_profiles VALUES(626,37,2,3);
INSERT INTO position_competency_profiles VALUES(627,41,2,3);
INSERT INTO position_competency_profiles VALUES(628,42,2,3);
INSERT INTO position_competency_profiles VALUES(629,43,2,3);
INSERT INTO position_competency_profiles VALUES(630,40,2,3);
INSERT INTO position_competency_profiles VALUES(631,39,2,3);
INSERT INTO position_competency_profiles VALUES(632,3,2,3);
INSERT INTO position_competency_profiles VALUES(633,1,2,3);
INSERT INTO position_competency_profiles VALUES(634,2,2,3);
INSERT INTO position_competency_profiles VALUES(635,16,2,1);
INSERT INTO position_competency_profiles VALUES(636,17,2,2);
INSERT INTO position_competency_profiles VALUES(637,18,2,2);
INSERT INTO position_competency_profiles VALUES(638,20,2,2);
INSERT INTO position_competency_profiles VALUES(639,19,2,2);
INSERT INTO position_competency_profiles VALUES(640,21,2,1);
INSERT INTO position_competency_profiles VALUES(641,6,2,3);
INSERT INTO position_competency_profiles VALUES(642,5,2,3);
INSERT INTO position_competency_profiles VALUES(643,4,2,3);
INSERT INTO position_competency_profiles VALUES(644,28,2,3);
INSERT INTO position_competency_profiles VALUES(645,27,2,3);
INSERT INTO position_competency_profiles VALUES(646,9,2,3);
INSERT INTO position_competency_profiles VALUES(647,7,2,3);
INSERT INTO position_competency_profiles VALUES(648,8,2,3);
INSERT INTO position_competency_profiles VALUES(649,10,2,3);
INSERT INTO position_competency_profiles VALUES(650,11,2,3);
INSERT INTO position_competency_profiles VALUES(651,12,2,3);
INSERT INTO position_competency_profiles VALUES(652,13,2,3);
INSERT INTO position_competency_profiles VALUES(653,14,2,3);
INSERT INTO position_competency_profiles VALUES(654,15,2,3);
INSERT INTO position_competency_profiles VALUES(678,16,8,1);
INSERT INTO position_competency_profiles VALUES(679,17,8,3);
INSERT INTO position_competency_profiles VALUES(680,18,8,3);
INSERT INTO position_competency_profiles VALUES(681,20,8,2);
INSERT INTO position_competency_profiles VALUES(682,19,8,3);
INSERT INTO position_competency_profiles VALUES(683,21,8,3);
CREATE TABLE employee_competency_scores (
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
INSERT INTO employee_competency_scores VALUES(1,'6900036',5,1,'manager','2026-06-29','','2026-06-29 07:07:28');
INSERT INTO employee_competency_scores VALUES(2,'6900036',8,1,'manager','2026-06-29','','2026-06-29 07:07:28');
INSERT INTO employee_competency_scores VALUES(3,'6900036',6,2,'manager','2026-06-29','','2026-06-29 07:07:28');
INSERT INTO employee_competency_scores VALUES(4,'6900036',7,1,'manager','2026-06-29','','2026-06-29 07:07:28');
INSERT INTO employee_competency_scores VALUES(5,'6900036',1,2,'manager','2026-06-29','','2026-06-29 07:07:28');
INSERT INTO employee_competency_scores VALUES(6,'6900036',2,1,'manager','2026-06-29','','2026-06-29 07:07:28');
CREATE TABLE competency_course_mapping (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  competency_id  INTEGER NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  course_code    TEXT NOT NULL REFERENCES courses(code) ON DELETE CASCADE,
  target_level   INTEGER CHECK(target_level BETWEEN 1 AND 5),
  UNIQUE(competency_id, course_code)
);
CREATE TABLE employee_roadmaps (
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
INSERT INTO employee_roadmaps VALUES(1,'6200002',6,NULL,1,'not_started','',NULL,'','2026-06-28 14:47:37','2026-06-28 14:47:37');
INSERT INTO employee_roadmaps VALUES(2,'6200002',7,NULL,2,'not_started','',NULL,'','2026-06-28 14:47:37','2026-06-28 14:47:37');
INSERT INTO employee_roadmaps VALUES(3,'6200002',1,NULL,3,'not_started','',NULL,'','2026-06-28 14:47:37','2026-06-28 14:47:37');
INSERT INTO employee_roadmaps VALUES(4,'6200002',2,NULL,4,'not_started','',NULL,'','2026-06-28 14:47:37','2026-06-28 14:47:37');
INSERT INTO employee_roadmaps VALUES(5,'6200001',6,NULL,1,'not_started','',NULL,'','2026-06-29 02:01:03','2026-06-29 02:01:03');
INSERT INTO employee_roadmaps VALUES(6,'6200001',7,NULL,2,'not_started','',NULL,'','2026-06-29 02:01:03','2026-06-29 02:01:03');
INSERT INTO employee_roadmaps VALUES(7,'6200001',1,NULL,3,'not_started','',NULL,'','2026-06-29 02:01:03','2026-06-29 02:01:03');
INSERT INTO employee_roadmaps VALUES(8,'6200001',2,NULL,4,'not_started','',NULL,'','2026-06-29 02:01:03','2026-06-29 02:01:03');
INSERT INTO employee_roadmaps VALUES(9,'6900036',5,NULL,1,'not_started','',NULL,'','2026-06-29 07:04:20','2026-06-30 05:20:38');
INSERT INTO employee_roadmaps VALUES(10,'6900036',8,NULL,2,'not_started','',NULL,'','2026-06-29 07:04:20','2026-06-29 07:04:20');
INSERT INTO employee_roadmaps VALUES(11,'6900036',6,NULL,3,'not_started','',NULL,'','2026-06-29 07:04:20','2026-06-29 07:04:20');
INSERT INTO employee_roadmaps VALUES(12,'6900036',7,NULL,4,'not_started','',NULL,'','2026-06-29 07:04:20','2026-06-29 07:04:20');
INSERT INTO employee_roadmaps VALUES(13,'6900036',1,NULL,1,'not_started','',NULL,'','2026-06-29 07:04:20','2026-06-29 10:58:28');
INSERT INTO employee_roadmaps VALUES(14,'6900036',2,NULL,2,'not_started','',NULL,'','2026-06-29 07:04:20','2026-06-29 10:58:28');
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
INSERT INTO competencies_new VALUES(1,'HR-TN-001','Training Need Analysis','functional','',3,'','','','','','2026-06-27 22:02:45','2026-06-28 04:39:00');
INSERT INTO competencies_new VALUES(2,'ORG-001','ทักษะการทำงานร่วมกัน','organizational','',3,'','','','','','2026-06-28 04:42:49','2026-06-28 04:42:49');
INSERT INTO competencies_new VALUES(3,'ORG-002','ทักษะการสื่อสาร','organizational','',3,'','','','','','2026-06-28 04:53:28','2026-06-28 04:53:28');
CREATE TABLE competencies (
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
INSERT INTO competencies VALUES(1,'ORG-001','ทักษะการทำงานร่วมกัน','organizational','',3,'','','','','','2026-06-28 13:34:46','2026-06-28 14:42:08');
INSERT INTO competencies VALUES(2,'ORG-002','ทักษะการสื่อสาร','organizational','',3,'','','','','','2026-06-28 13:38:33','2026-06-28 14:42:13');
INSERT INTO competencies VALUES(3,'HR-001','การบริการจัดการนโยบายบุคคล','functional','',3,'','','','','','2026-06-28 13:39:31','2026-06-28 14:25:37');
INSERT INTO competencies VALUES(4,'HR-002','การจัดการด้านแรงงาน','functional','',3,'','','','','','2026-06-28 13:40:27','2026-06-28 13:40:27');
INSERT INTO competencies VALUES(5,'HR-003','การประยุกต์ใช้ AI ในงาน HR','functional','',3,'','','','','','2026-06-28 13:41:09','2026-06-29 05:49:16');
INSERT INTO competencies VALUES(6,'LS-001','การโค้ชและการพัฒนาผู้อื่น','leadership','',3,'','','','','','2026-06-28 13:42:21','2026-06-28 13:42:21');
INSERT INTO competencies VALUES(7,'LS-002','การจัดการความขัดแย้ง','leadership','',3,'','','','','','2026-06-28 13:42:36','2026-06-28 13:42:36');
INSERT INTO competencies VALUES(8,'HR-004','ความรู้สวัสดิการ','functional','',3,'','','','','','2026-06-29 05:51:10','2026-06-29 05:51:24');
PRAGMA writable_schema=ON;
CREATE TABLE IF NOT EXISTS sqlite_sequence(name,seq);
DELETE FROM sqlite_sequence;
INSERT INTO sqlite_sequence VALUES('course_topics',13);
INSERT INTO sqlite_sequence VALUES('course_relations',3);
INSERT INTO sqlite_sequence VALUES('eval_form_items',10);
INSERT INTO sqlite_sequence VALUES('training_requests',6);
INSERT INTO sqlite_sequence VALUES('request_attendees',5);
INSERT INTO sqlite_sequence VALUES('request_schedule',3);
INSERT INTO sqlite_sequence VALUES('training_evaluations',2);
INSERT INTO sqlite_sequence VALUES('eval_responses',8);
INSERT INTO sqlite_sequence VALUES('training_registrations',1);
INSERT INTO sqlite_sequence VALUES('registration_attendees',1);
INSERT INTO sqlite_sequence VALUES('training_plans',1);
INSERT INTO sqlite_sequence VALUES('training_plan_topics',2);
INSERT INTO sqlite_sequence VALUES('departments',1745);
INSERT INTO sqlite_sequence VALUES('positions',4300);
INSERT INTO sqlite_sequence VALUES('competency_departments',24);
INSERT INTO sqlite_sequence VALUES('position_competency_profiles',697);
INSERT INTO sqlite_sequence VALUES('competencies_new',3);
INSERT INTO sqlite_sequence VALUES('competencies',8);
INSERT INTO sqlite_sequence VALUES('employee_roadmaps',25);
INSERT INTO sqlite_sequence VALUES('employee_competency_scores',12);
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
    ON e.code = ecs.employee_code AND c.id = ecs.competency_id;
PRAGMA writable_schema=OFF;
COMMIT;
