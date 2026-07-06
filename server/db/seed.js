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

  // โครงการตัวอย่าง (โครงการ = ใบขออนุมัติในตัว)
  const beYear = y + 543;
  const sampleProjects = [
    { name: 'ปฐมนิเทศพนักงานใหม่', course_code: 'HR-INT-001', quarter: 'Q1', req_no: `TR-${y}-001`, training_date: `${y}-02-10`, end_date: `${y}-02-10`, location: 'ห้องประชุมใหญ่ ชั้น 5', trainer_name: 'คุณสมชาย ใจดี', trainer_org: 'ภายในองค์กร', budget_instructor: 8000, budget_venue: 0, budget_food: 4000, budget_material: 1500, budget_other: 500, objective: 'เพื่อให้พนักงานใหม่เข้าใจวัฒนธรรมองค์กร', target_group: 'พนักงานเข้าใหม่', approval_status: 'approved', approved_by: 'ผู้จัดการฝ่ายบุคคล', approved_at: `${y}-01-25`, current_step: 3 },
    { name: 'อบรมความปลอดภัยพื้นฐานประจำปี', course_code: 'HR-INT-002', quarter: 'Q2', req_no: `TR-${y}-002`, training_date: `${y}-03-15`, end_date: `${y}-03-15`, location: 'ห้องอบรม A', trainer_name: 'คุณวิภา ปลอดภัย', trainer_org: 'บริษัท Safety First', budget_instructor: 15000, budget_venue: 5000, budget_food: 6000, budget_material: 2000, budget_other: 1000, objective: 'สร้างความตระหนักด้านความปลอดภัย', target_group: 'พนักงานทุกแผนก', approval_status: 'pending', approved_by: '', approved_at: null, current_step: 1 },
  ];

  const projSql = `INSERT INTO training_projects
    (name,course_code,quarter,year,current_step,req_no,training_date,end_date,location,
     trainer_name,trainer_org,budget_instructor,budget_venue,budget_food,budget_material,
     budget_other,objective,target_group,approval_status,approved_by,approved_at)
   VALUES (@name,@course_code,@quarter,@year,@current_step,@req_no,@training_date,@end_date,@location,
     @trainer_name,@trainer_org,@budget_instructor,@budget_venue,@budget_food,@budget_material,
     @budget_other,@objective,@target_group,@approval_status,@approved_by,@approved_at)
   RETURNING id`;

  const ids = [];
  for (const p of sampleProjects) {
    const result = await db.execute({ sql: projSql, args: { ...p, year: beYear } });
    ids.push(result.rows[0].id);
  }

  await db.batch([
    { sql: 'INSERT INTO project_participants (project_id,employee_code,name,department,position) VALUES (?,?,?,?,?)', args: [ids[0], 'EMP-101', 'นายกิตติ วงศ์ทอง', 'ผลิต', 'พนักงานฝ่ายผลิต'] },
    { sql: 'INSERT INTO project_participants (project_id,employee_code,name,department,position) VALUES (?,?,?,?,?)', args: [ids[0], 'EMP-102', 'นางสาวมาลี ศรีสุข', 'บัญชี', 'เจ้าหน้าที่บัญชี'] },
    { sql: 'INSERT INTO project_participants (project_id,employee_code,name,department,position) VALUES (?,?,?,?,?)', args: [ids[0], 'EMP-103', 'นายอนุชา รุ่งเรือง', 'คลังสินค้า', 'พนักงานคลัง'] },
  ], 'write');

  const evalResult = await db.execute({
    sql: 'INSERT INTO training_evaluations (project_id,eval_form_code,evaluator_name,eval_date,total_score,status) VALUES (?,?,?,?,?,?) RETURNING id',
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
