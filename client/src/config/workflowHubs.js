// Satellite `route` values are relative segments under /development/workflow/:projectId/
// (resolved by ProjectShell's nested routes — no ?projectId= query strings anymore).
// `publicHidden: true` = ซ่อนเมื่อโครงการเป็นแบบ Public (ส่งไปเรียนข้างนอก —
// ไม่ต้องหาวัน/วิทยากร/ลงทะเบียน เหลือสายจ่ายเงิน + ประเมิน/บันทึกผล);
// satellite ที่ parent ถูกซ่อนจะกลายเป็น root โดยอัตโนมัติ (layout รองรับอยู่แล้ว)
export const workflowHubs = [
  {
    id: 'approve',
    label: 'ขออนุมัติ',
    order: 1,
    // Chain: participants -> availability -> vendor_check -> invoice_intake,
    // which then forks into pr_issuance and memo_issuance. `parent` names the
    // satellite (by id) this one branches from; omitted = branches from the hub.
    // participants มาก่อนเสมอ — ทุก phase อ่านรายชื่อกลางชุดนี้
    satellites: [
      { id: 'participants',   label: 'รายชื่อผู้เข้าอบรม', route: 'participants' },
      { id: 'availability',   label: 'ตารางวันว่าง', route: 'availability', parent: 'participants', publicHidden: true },
      { id: 'vendor_check',   label: 'ตรวจสอบ Vendor', route: 'vendor-check', dynamicStatus: true, parent: 'availability', publicHidden: true },
      { id: 'invoice_intake', label: 'รับ Invoice', route: 'invoice-intake', parent: 'vendor_check' },
      { id: 'pr_issuance',    label: 'ออก PR',       route: 'pr-issuance', parent: 'invoice_intake' },
      { id: 'memo_issuance',  label: 'ออก Memo',     route: 'memo-issuance', parent: 'invoice_intake' },
    ],
  },
  {
    id: 'execute',
    label: 'เตรียม-จัดอบรม',
    order: 2,
    // ลำดับงานจริง: ทำกำหนดการ (ต้องมีวันอบรมจาก Phase 1) ก่อน แล้วค่อยพิมพ์ใบลงทะเบียน
    satellites: [
      { id: 'schedule', label: 'กำหนดการ', route: 'schedule', publicHidden: true },
      { id: 'registration', label: 'ลงทะเบียน', route: 'registration', parent: 'schedule', publicHidden: true },
    ],
  },
  {
    id: 'evaluate',
    label: 'ประเมินผล',
    order: 3,
    satellites: [
      { id: 'evaluation', label: 'ประเมินผล', route: 'evaluation' },
    ],
  },
  {
    id: 'record',
    label: 'บันทึก-รายงาน',
    order: 4,
    satellites: [
      { id: 'training_records', label: 'ประวัติอบรม', route: 'records' },
      { id: 'summary_report', label: 'รายงานสรุป', route: 'summary', parent: 'training_records' },
      { id: 'dsd_export', label: 'ยื่นกรมพัฒนาฯ', route: 'dsd', parent: 'training_records' },
    ],
  },
];
