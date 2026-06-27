import { Plus, Trash2 } from 'lucide-react';
import { Field, Input, Textarea, Button, Card, Badge } from '../components/ui.jsx';

const money = (n) =>
  Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function MemoFullSection({
  form,
  errors,
  set,
  addAttendee,
  removeAttendee,
  setAttendeeName,
  addBudgetItem,
  removeBudgetItem,
  setBudgetItem,
}) {
  const Req = ({ k }) =>
    errors[k] ? <span className="ml-1 text-xs text-red-500">*จำเป็น</span> : null;

  const memoAttendeeCount = form.attendee_names.length || Number(form.attendee_count) || 0;
  const memoGrandTotal = form.budget_items.reduce(
    (s, it) => s + (Number(it.price_per_person) || 0) * (memoAttendeeCount || 1),
    0
  );

  return (
    <>
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-purple-200" />
        <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
          ข้อมูลสำหรับ ใบ Memo รูปแบบเต็ม
        </span>
        <div className="h-px flex-1 bg-purple-200" />
      </div>

      {/* ── Section 4: Memo header fields ── */}
      <Card className="border-purple-100 p-5">
        <h2 className="mb-4 font-semibold text-slate-800">
          หัวบันทึกข้อความ <Badge color="purple">Memo เต็ม</Badge>
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={<>หน่วยงานผู้ส่ง / From <Req k="from_dept" /></>}>
            <Input
              value={form.from_dept}
              invalid={errors.from_dept}
              onChange={(e) => set('from_dept', e.target.value)}
              placeholder="เช่น ฝ่ายทรัพยากรบุคคล"
            />
          </Field>
          <Field label={<>เรียน / To <Req k="to_dept" /></>}>
            <Input
              value={form.to_dept}
              invalid={errors.to_dept}
              onChange={(e) => set('to_dept', e.target.value)}
            />
          </Field>
          <Field label="สำเนา / CC (ถ้ามี)">
            <Input
              value={form.cc_dept}
              onChange={(e) => set('cc_dept', e.target.value)}
              placeholder="เช่น ฝ่ายการเงิน"
            />
          </Field>
          <Field label={<>เรื่อง / Subject <Req k="subject" /></>}>
            <Input
              value={form.subject}
              invalid={errors.subject}
              onChange={(e) => set('subject', e.target.value)}
              placeholder="เช่น ขออนุมัติค่าใช้จ่ายการอบรม หลักสูตร ..."
            />
          </Field>
        </div>
      </Card>

      {/* ── Section 5: Attendee list ── */}
      <Card className="border-purple-100 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">
            รายชื่อผู้เข้าอบรม <Badge color="purple">Memo เต็ม</Badge>
          </h2>
          <Button size="sm" variant="outline" onClick={addAttendee}>
            <Plus size={14} /> เพิ่มรายชื่อ
          </Button>
        </div>
        {form.attendee_names.length === 0 ? (
          <p className="text-sm text-slate-400">
            ยังไม่มีรายชื่อ — กดเพิ่มรายชื่อ หรือโหลดจากคำขออบรมที่มีรายชื่อผู้เข้าร่วม
          </p>
        ) : (
          <div className="space-y-2">
            {form.attendee_names.map((a, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-7 shrink-0 text-right text-sm text-slate-400">{i + 1}.</span>
                <Input
                  value={a.name}
                  onChange={(e) => setAttendeeName(i, e.target.value)}
                  placeholder="ชื่อ-นามสกุล"
                />
                <button
                  onClick={() => removeAttendee(i)}
                  className="shrink-0 rounded p-1 text-slate-400 hover:text-red-500"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
        {form.attendee_names.length > 0 && (
          <p className="mt-2 text-xs text-slate-400">
            จำนวน {form.attendee_names.length} คน (ใช้แทนค่าในช่อง "จำนวนผู้เข้าอบรม")
          </p>
        )}
      </Card>

      {/* ── Section 6: Detailed budget items (Memo Full) ── */}
      <Card className="border-purple-100 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">
            รายการค่าใช้จ่าย <Badge color="purple">Memo เต็ม</Badge>
          </h2>
          <Button size="sm" variant="outline" onClick={addBudgetItem}>
            <Plus size={14} /> เพิ่มรายการ
          </Button>
        </div>
        <p className="mb-3 text-xs text-slate-400">
          แต่ละรายการจะแสดงในตาราง Memo พร้อมรายละเอียดผู้จ่าย, เลขที่ใบแจ้งหนี้, และวันที่ชำระ
        </p>

        {form.budget_items.length === 0 ? (
          <p className="text-sm text-slate-400">ยังไม่มีรายการ — กดเพิ่มรายการ</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="pb-2 pr-2">#</th>
                  <th className="pb-2 pr-2">รายการ (ค่า...)</th>
                  <th className="pb-2 pr-2">ราคา/คน (บาท)</th>
                  <th className="pb-2 pr-2">รวม</th>
                  <th className="pb-2 pr-2">สั่งจ่ายนาม</th>
                  <th className="pb-2 pr-2">เลขที่ใบแจ้งหนี้</th>
                  <th className="pb-2 pr-2">วันที่ชำระ</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {form.budget_items.map((it, i) => {
                  const rowTotal =
                    (Number(it.price_per_person) || 0) * (memoAttendeeCount || 1);
                  return (
                    <tr key={i}>
                      <td className="py-2 pr-2 text-slate-400">{i + 1}</td>
                      <td className="py-2 pr-2">
                        <div className="flex items-center">
                          <span className="shrink-0 text-slate-500">ค่า</span>
                          <Input
                            value={it.item_name}
                            onChange={(e) => setBudgetItem(i, 'item_name', e.target.value)}
                            placeholder="ลงทะเบียน"
                            className="ml-1"
                          />
                        </div>
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          type="number"
                          min="0"
                          value={it.price_per_person}
                          onChange={(e) => setBudgetItem(i, 'price_per_person', e.target.value)}
                          placeholder="0"
                          className="w-28"
                        />
                      </td>
                      <td className="py-2 pr-2 text-right font-medium text-slate-700 whitespace-nowrap">
                        {money(rowTotal)} ฿
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          value={it.vendor_name}
                          onChange={(e) => setBudgetItem(i, 'vendor_name', e.target.value)}
                          placeholder="ชื่อผู้รับเงิน"
                          className="w-36"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          value={it.invoice_number}
                          onChange={(e) => setBudgetItem(i, 'invoice_number', e.target.value)}
                          placeholder="INV-XXXX"
                          className="w-32"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          type="date"
                          value={it.payment_date}
                          onChange={(e) => setBudgetItem(i, 'payment_date', e.target.value)}
                          className="w-36"
                        />
                      </td>
                      <td className="py-2">
                        <button
                          onClick={() => removeBudgetItem(i)}
                          className="rounded p-1 text-slate-400 hover:text-red-500"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {form.budget_items.length > 0 && (
          <div className="mt-4 rounded-lg bg-purple-50 p-3 text-sm">
            <div className="flex justify-end gap-6">
              <span className="text-slate-600">รวมค่าใช้จ่ายทั้งหมด</span>
              <span className="font-bold text-purple-700">{money(memoGrandTotal)} บาท</span>
            </div>
          </div>
        )}
      </Card>

      {/* ── Section 7: Signature block ── */}
      <Card className="border-purple-100 p-5">
        <h2 className="mb-4 font-semibold text-slate-800">
          ผู้ลงนาม <Badge color="purple">Memo เต็ม</Badge>
        </h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {[
            ['preparer', 'ผู้จัดทำ'],
            ['reviewer', 'ผู้ตรวจสอบ'],
            ['approver', 'ผู้อนุมัติ'],
          ].map(([key, label]) => (
            <div key={key} className="space-y-3 rounded-lg border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
              <Field label="ชื่อ-นามสกุล">
                <Input
                  value={form[`${key}_name`]}
                  onChange={(e) => set(`${key}_name`, e.target.value)}
                  placeholder="ชื่อ นามสกุล"
                />
              </Field>
              <Field label="ตำแหน่ง">
                <Input
                  value={form[`${key}_title`]}
                  onChange={(e) => set(`${key}_title`, e.target.value)}
                />
              </Field>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
