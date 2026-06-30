export async function seedIfEmpty(db) {
  const row = await db.execute('SELECT COUNT(*) AS c FROM training_topics').then((r) => r.rows[0]);
  if (row.c > 0) return;

  const topics = [
    ['HR-TN-001', 'ความปลอดภัยในการทำงาน', 'Workplace Safety', 'บรรยาย', 3, 0, 0],
    ['HR-TN-002', 'การปฐมพยาบาลเบื้องต้น', 'Basic First Aid', 'บรรยายและปฏิบัติ', 3, 30, 0],
    ['HR-TN-003', 'การทำงานเป็นทีม', 'Teamwork', 'บรรยาย', 2, 0, 0],
    ['HR-TN-004', 'การสื่อสารในองค์กร', 'Organizational Communication', 'บรรยาย', 2, 30, 0],
    ['HR-TN-005', 'การใช้งานระบบ ERP', 'ERP System Usage', 'บรรยายและปฏิบัติ', 6, 0, 1],
  ];
  const courses = [
    ['HR-INT-001', 'หลักสูตรปฐมนิเทศพนักงานใหม่', 'New Employee Orientation', 'ปฐมนิเทศ', 'ไม่ต่อเนื่อง', 'ฝึกเตรียมเข้าทำงาน', 6, 0, 1, 'สำหรับพนักงานเข้าใหม่ทุกคน'],
    ['HR-INT-002', 'หลักสูตรความปลอดภัยพื้นฐาน', 'Basic Safety', 'ความปลอดภัย', 'ไม่ต่อเนื่อง', 'ฝึกยกระดับฝีมือแรงงาน', 3, 0, 0, 'ตามกฎหมายความปลอดภัย'],
    ['HR-INT-003', 'หลักสูตรพัฒนาภาวะผู้นำ', 'Leadership Development', 'การบริหาร', 'ต่อเนื่อง', 'ฝึกยกระดับฝีมือแรงงาน', 12, 0, 1, 'สำหรับหัวหน้างานขึ้นไป'],
    ['HR-INT-004', 'หลักสูตรบริการลูกค้า', 'Customer Service Excellence', 'การบริการ', 'ไม่ต่อเนื่อง', 'ฝึกยกระดับฝีมือแรงงาน', 6, 0, 0, 'สำหรับฝ่ายบริการลูกค้า'],
    ['HR-INT-005', 'หลักสูตรการใช้งานระบบ ERP', 'ERP System Training', 'เทคโนโลยี', 'ต่อเนื่อง', 'ฝึกยกระดับฝีมือแรงงาน', 6, 0, 1, 'สำหรับผู้ใช้งานระบบ'],
  ];
  const items = [
    ['INT-CO-001', 'เนื้อหาตรงตามความต้องการ', 'Content relevance', 'ประเมินหลักสูตร', 'ความสอดคล้องของเนื้อหา'],
    ['INT-CO-002', 'ความรู้ความสามารถของวิทยากร', 'Trainer competency', 'ประเมินวิทยากร', ''],
    ['INT-CO-003', 'เอกสารประกอบการอบรม', 'Training materials', 'ประเมินหลักสูตร', ''],
    ['INT-CO-004', 'สถานที่และสิ่งอำนวยความสะดวก', 'Venue & facilities', 'ประเมินการจัดอบรม', ''],
    ['INT-CO-005', 'สามารถนำความรู้ไปใช้ได้จริง', 'Applicability', 'ประเมินผู้เข้าร่วมอบรม', ''],
  ];
  const forms = [
    ['INT-01', 'แบบประเมินความพึงพอใจการอบรม', 'Training Satisfaction Survey', 'ใช้กับการอบรมทั่วไป'],
    ['INT-02', 'แบบประเมินวิทยากร', 'Trainer Evaluation', ''],
    ['INT-03', 'แบบประเมินผลการเรียนรู้', 'Learning Outcome Evaluation', ''],
    ['INT-04', 'แบบประเมินการจัดอบรม', 'Training Logistics Evaluation', ''],
    ['INT-05', 'แบบประเมินหลักสูตรปฐมนิเทศ', 'Orientation Evaluation', ''],
  ];

  const y = new Date().getFullYear();

  await db.batch([
    ...topics.map(([code, name_th, name_en, type, duration_hours, duration_minutes, is_continuous]) => ({
      sql: 'INSERT INTO training_topics (code,name_th,name_en,type,duration_hours,duration_minutes,is_continuous) VALUES (?,?,?,?,?,?,?)',
      args: [code, name_th, name_en, type, duration_hours, duration_minutes, is_continuous],
    })),
    ...courses.map(([code, name_th, name_en, category, type, training_type, duration_hours, duration_minutes, send_to_dsd, detail]) => ({
      sql: 'INSERT INTO courses (code,name_th,name_en,category,type,training_type,duration_hours,duration_minutes,send_to_dsd,detail) VALUES (?,?,?,?,?,?,?,?,?,?)',
      args: [code, name_th, name_en, category, type, training_type, duration_hours, duration_minutes, send_to_dsd, detail],
    })),
    { sql: 'INSERT INTO course_topics (course_code,topic_code,sequence,duration) VALUES (?,?,?,?)', args: ['HR-INT-001', 'HR-TN-003', 1, 120] },
    { sql: 'INSERT INTO course_topics (course_code,topic_code,sequence,duration) VALUES (?,?,?,?)', args: ['HR-INT-001', 'HR-TN-004', 2, 150] },
    { sql: 'INSERT INTO course_topics (course_code,topic_code,sequence,duration) VALUES (?,?,?,?)', args: ['HR-INT-002', 'HR-TN-001', 1, 180] },
    { sql: 'INSERT INTO course_topics (course_code,topic_code,sequence,duration) VALUES (?,?,?,?)', args: ['HR-INT-005', 'HR-TN-005', 1, 360] },
    { sql: 'INSERT INTO course_relations (course_code,related_course_code,relation_type) VALUES (?,?,?)', args: ['HR-INT-003', 'HR-INT-001', 'prereq'] },
    ...items.map(([code, name_th, name_en, eval_type, detail]) => ({
      sql: 'INSERT INTO eval_items (code,name_th,name_en,eval_type,detail) VALUES (?,?,?,?,?)',
      args: [code, name_th, name_en, eval_type, detail],
    })),
    ...forms.map(([code, name_th, name_en, detail]) => ({
      sql: 'INSERT INTO eval_forms (code,name_th,name_en,detail) VALUES (?,?,?,?)',
      args: [code, name_th, name_en, detail],
    })),
    { sql: 'INSERT INTO eval_form_items (form_code,item_code,sequence,weight,scale_type) VALUES (?,?,?,?,?)', args: ['INT-01', 'INT-CO-001', 1, 1, 'ระดับ'] },
    { sql: 'INSERT INTO eval_form_items (form_code,item_code,sequence,weight,scale_type) VALUES (?,?,?,?,?)', args: ['INT-01', 'INT-CO-002', 2, 1, 'ระดับ'] },
    { sql: 'INSERT INTO eval_form_items (form_code,item_code,sequence,weight,scale_type) VALUES (?,?,?,?,?)', args: ['INT-01', 'INT-CO-003', 3, 1, 'ระดับ'] },
    { sql: 'INSERT INTO eval_form_items (form_code,item_code,sequence,weight,scale_type) VALUES (?,?,?,?,?)', args: ['INT-01', 'INT-CO-004', 4, 1, 'ระดับ'] },
    { sql: 'INSERT INTO eval_form_items (form_code,item_code,sequence,weight,scale_type) VALUES (?,?,?,?,?)', args: ['INT-01', 'INT-CO-005', 5, 1, 'ระดับ'] },
  ], 'write');

  const sampleReqs = [
    { req_no: `TR-${y}-001`, course_code: 'HR-INT-001', training_date: `${y}-02-10`, end_date: `${y}-02-10`, location: 'ห้องประชุมใหญ่ ชั้น 5', trainer_name: 'คุณสมชาย ใจดี', trainer_org: 'ภายในองค์กร', budget_instructor: 8000, budget_venue: 0, budget_food: 4000, budget_material: 1500, budget_other: 500, attendee_count: 20, objective: 'เพื่อให้พนักงานใหม่เข้าใจวัฒนธรรมองค์กร', target_group: 'พนักงานเข้าใหม่', status: 'approved', created_at: `${y}-01-20`, approved_by: 'ผู้จัดการฝ่ายบุคคล', approved_at: `${y}-01-25`, notes: '' },
    { req_no: `TR-${y}-002`, course_code: 'HR-INT-002', training_date: `${y}-03-15`, end_date: `${y}-03-15`, location: 'ห้องอบรม A', trainer_name: 'คุณวิภา ปลอดภัย', trainer_org: 'บริษัท Safety First', budget_instructor: 15000, budget_venue: 5000, budget_food: 6000, budget_material: 2000, budget_other: 1000, attendee_count: 30, objective: 'สร้างความตระหนักด้านความปลอดภัย', target_group: 'พนักงานทุกแผนก', status: 'approved', created_at: `${y}-02-28`, approved_by: 'ผู้จัดการโรงงาน', approved_at: `${y}-03-02`, notes: '' },
    { req_no: `TR-${y}-003`, course_code: 'HR-INT-003', training_date: `${y}-05-01`, end_date: `${y}-05-02`, location: 'โรงแรม ABC', trainer_name: 'ดร.ประเสริฐ นำชัย', trainer_org: 'สถาบันพัฒนาผู้นำ', budget_instructor: 40000, budget_venue: 20000, budget_food: 15000, budget_material: 5000, budget_other: 3000, attendee_count: 15, objective: 'พัฒนาทักษะภาวะผู้นำ', target_group: 'หัวหน้างาน', status: 'pending', created_at: `${y}-04-10`, approved_by: '', approved_at: '', notes: 'รออนุมัติงบประมาณ' },
    { req_no: `TR-${y}-004`, course_code: 'HR-INT-004', training_date: `${y}-06-20`, end_date: `${y}-06-20`, location: 'ห้องอบรม B', trainer_name: 'คุณนภา บริการ', trainer_org: 'ภายในองค์กร', budget_instructor: 6000, budget_venue: 0, budget_food: 3000, budget_material: 1000, budget_other: 0, attendee_count: 12, objective: 'ยกระดับการบริการลูกค้า', target_group: 'ฝ่ายบริการลูกค้า', status: 'draft', created_at: `${y}-06-01`, approved_by: '', approved_at: '', notes: '' },
    { req_no: `TR-${y}-005`, course_code: 'HR-INT-005', training_date: `${y}-07-05`, end_date: `${y}-07-05`, location: 'ห้องคอมพิวเตอร์', trainer_name: 'คุณธนา เทคโน', trainer_org: 'ภายในองค์กร', budget_instructor: 10000, budget_venue: 0, budget_food: 3500, budget_material: 1500, budget_other: 0, attendee_count: 18, objective: 'ใช้งานระบบ ERP ได้อย่างถูกต้อง', target_group: 'ผู้ใช้งานระบบ', status: 'approved', created_at: `${y}-06-15`, approved_by: 'ผู้จัดการ IT', approved_at: `${y}-06-18`, notes: '' },
  ];

  const reqSql = `INSERT INTO training_requests
    (req_no,course_code,training_date,end_date,location,trainer_name,trainer_org,
     budget_instructor,budget_venue,budget_food,budget_material,budget_other,
     attendee_count,objective,target_group,status,created_at,approved_by,approved_at,notes)
   VALUES (@req_no,@course_code,@training_date,@end_date,@location,@trainer_name,@trainer_org,
     @budget_instructor,@budget_venue,@budget_food,@budget_material,@budget_other,
     @attendee_count,@objective,@target_group,@status,@created_at,@approved_by,@approved_at,@notes)
   RETURNING id`;

  const ids = [];
  for (const r of sampleReqs) {
    const result = await db.execute({ sql: reqSql, args: r });
    ids.push(result.rows[0].id);
  }

  await db.batch([
    { sql: 'INSERT INTO request_attendees (req_id,employee_id,name,department,position) VALUES (?,?,?,?,?)', args: [ids[0], 'EMP-101', 'นายกิตติ วงศ์ทอง', 'ผลิต', 'พนักงานฝ่ายผลิต'] },
    { sql: 'INSERT INTO request_attendees (req_id,employee_id,name,department,position) VALUES (?,?,?,?,?)', args: [ids[0], 'EMP-102', 'นางสาวมาลี ศรีสุข', 'บัญชี', 'เจ้าหน้าที่บัญชี'] },
    { sql: 'INSERT INTO request_attendees (req_id,employee_id,name,department,position) VALUES (?,?,?,?,?)', args: [ids[0], 'EMP-103', 'นายอนุชา รุ่งเรือง', 'คลังสินค้า', 'พนักงานคลัง'] },
    { sql: 'INSERT INTO request_schedule (req_id,date,start_time,end_time,topic,trainer) VALUES (?,?,?,?,?,?)', args: [ids[0], `${y}-02-10`, '09:00', '12:00', 'การทำงานเป็นทีม', 'คุณสมชาย ใจดี'] },
    { sql: 'INSERT INTO request_schedule (req_id,date,start_time,end_time,topic,trainer) VALUES (?,?,?,?,?,?)', args: [ids[0], `${y}-02-10`, '13:00', '16:00', 'การสื่อสารในองค์กร', 'คุณสมชาย ใจดี'] },
  ], 'write');

  const evalResult = await db.execute({
    sql: 'INSERT INTO training_evaluations (req_id,eval_form_code,evaluator_name,eval_date,total_score,status) VALUES (?,?,?,?,?,?) RETURNING id',
    args: [ids[0], 'INT-01', 'ฝ่ายบุคคล', `${y}-02-11`, 4.2, 'pass'],
  });
  const evalId = evalResult.rows[0].id;

  await db.batch([
    { sql: 'INSERT INTO eval_responses (eval_id,item_code,score,comment) VALUES (?,?,?,?)', args: [evalId, 'INT-CO-001', 4, 'เนื้อหาดี'] },
    { sql: 'INSERT INTO eval_responses (eval_id,item_code,score,comment) VALUES (?,?,?,?)', args: [evalId, 'INT-CO-002', 5, 'วิทยากรเป็นกันเอง'] },
    { sql: 'INSERT INTO eval_responses (eval_id,item_code,score,comment) VALUES (?,?,?,?)', args: [evalId, 'INT-CO-003', 4, ''] },
    { sql: 'INSERT INTO eval_responses (eval_id,item_code,score,comment) VALUES (?,?,?,?)', args: [evalId, 'INT-CO-004', 4, ''] },
    { sql: 'INSERT INTO eval_responses (eval_id,item_code,score,comment) VALUES (?,?,?,?)', args: [evalId, 'INT-CO-005', 4, ''] },
  ], 'write');

  console.log('[db] Seeded demo data.');
}
