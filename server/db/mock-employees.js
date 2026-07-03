/**
 * Run once to replace real employee names/emails with fake mock data.
 * Preserves: code, sequence, department, position — changes only personal fields.
 *
 * Usage: node server/db/mock-employees.js
 */

import { db, q } from './db.js';

const MALE = ['สมชาย', 'อนุชา', 'วีระ', 'ประเสริฐ', 'ธนา', 'สุรชัย', 'ปิยะ', 'ชาญชัย', 'ภูมิ', 'กิตติ', 'ธนกร', 'ศุภชัย', 'พงศ์พันธุ์', 'ณัฐพล', 'วรวิทย์'];
const FEMALE = ['สมหญิง', 'อรทัย', 'วิภา', 'มาลี', 'นภา', 'สุดา', 'พรรณี', 'ชุติมา', 'ปัทมา', 'กัญญา', 'นันทิดา', 'ปิยธิดา', 'วรรณภา', 'ศิริพร', 'อภิชญา'];
const LAST = ['ใจดี', 'สุขใจ', 'รุ่งเรือง', 'วงศ์ทอง', 'ศรีสุข', 'นำชัย', 'สุวรรณ', 'ชัยมงคล', 'เจริญสุข', 'ทองดี', 'บุญมา', 'สิทธิชัย', 'กุลเดช', 'อุดมพร', 'มีสุข'];
const NICK = ['ปอ', 'แป้ง', 'น้ำ', 'บอย', 'เอ็ม', 'จีน', 'อ้อ', 'ตั้ม', 'โอ๋', 'ต้น', 'ฝ้าย', 'แนน', 'บิ๊ก', 'นิว', 'ป๊อบ', 'แอ๊ม', 'บัส', 'เจ', 'เฟิร์น', 'มิ้ง'];
const EMAIL_FIRST = ['somchai', 'anucha', 'veera', 'prasert', 'thana', 'surachai', 'piya', 'chanchai', 'poom', 'kitti', 'thanakon', 'supachai', 'sompong', 'natthaphon', 'worawit', 'somying', 'orathai', 'vipa', 'malee', 'napa', 'suda', 'pannee', 'chutima', 'patama', 'kanya', 'nantida', 'piyatida', 'wannapha', 'siriporn', 'apichaya'];

function pick(arr, i) { return arr[i % arr.length]; }

async function main() {
  const employees = await q.all('SELECT code, sequence FROM employees ORDER BY sequence, code');

  if (!employees.length) {
    console.log('ไม่มีข้อมูลพนักงาน');
    process.exit(0);
  }

  const updates = employees.map((emp, i) => {
    const isMale = i % 3 !== 1;
    const firstName = isMale ? pick(MALE, i) : pick(FEMALE, i + 5);
    const lastName = pick(LAST, i * 3 + 7);
    const nickname = pick(NICK, i * 2 + 3);
    const emailFirst = pick(EMAIL_FIRST, i);
    const emailLast = ['jaidee', 'sukjai', 'rungruang', 'wongthong', 'srisuk', 'namchai', 'suwan', 'jaimongkol', 'cheorensuk', 'thongdee'][i % 10];

    return {
      sql: `UPDATE employees SET full_name=?, nickname=?, email=? WHERE code=?`,
      args: [
        `${isMale ? 'นาย' : 'นางสาว'}${firstName} ${lastName}`,
        nickname,
        `${emailFirst}.${emailLast}@mockcompany.com`,
        emp.code,
      ],
    };
  });

  await db.batch(updates, 'write');
  console.log(`แทนข้อมูลส่วนบุคคลสำเร็จ ${employees.length} คน`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
