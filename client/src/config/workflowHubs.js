export const workflowHubs = [
  {
    id: 'approve',
    label: 'ขออนุมัติ',
    order: 1,
    // Chain: availability -> vendor_check -> invoice_intake, which then forks
    // into pr_issuance and memo_issuance. `parent` names the satellite (by id)
    // this one branches from; omitted = branches from the hub itself.
    satellites: [
      { id: 'availability',   label: 'ตารางวันว่าง', route: '/development/availability' },
      { id: 'vendor_check',   label: 'ตรวจสอบ Vendor', route: '/development/vendor-check', dynamicStatus: true, parent: 'availability' },
      { id: 'invoice_intake', label: 'รับ Invoice', route: '/development/invoice-intake', parent: 'vendor_check' },
      { id: 'pr_issuance',    label: 'ออก PR',       route: '/development/pr-issuance', parent: 'invoice_intake' },
      { id: 'memo_issuance',  label: 'ออก Memo',     route: '/development/memo-issuance', parent: 'invoice_intake' },
    ],
  },
  {
    id: 'execute',
    label: 'เตรียม-จัดอบรม',
    order: 2,
    satellites: [],
  },
  { id: 'evaluate', label: 'ประเมินผล',        order: 3, satellites: [] },
  { id: 'record',   label: 'บันทึก-รายงาน',   order: 4, satellites: [] },
];
