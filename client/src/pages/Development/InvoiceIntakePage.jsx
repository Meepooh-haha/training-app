import { Receipt } from 'lucide-react';

export default function InvoiceIntakePage() {
  return (
    <div className="space-y-5 font-body">
      <div>
        <h2 className="text-xl font-bold text-ink-900 font-display">รับ Invoice</h2>
        <p className="text-sm text-ink-500 mt-0.5">อัปโหลด Invoice เพื่อสกัดข้อมูลสำหรับใบ PR และใบ Memo</p>
      </div>

      <div
        className="rounded-xl border border-dashed border-ink-200 py-20 text-center text-sm text-ink-400"
        style={{ background: '#FAF7F6' }}
      >
        <Receipt className="w-8 h-8 mx-auto mb-2 text-ink-200" />
        ฟีเจอร์นี้กำลังพัฒนา — จะเปิดใช้งานเร็ว ๆ นี้
      </div>
    </div>
  );
}
