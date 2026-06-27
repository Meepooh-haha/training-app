import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, FileDown, RefreshCw, AlertTriangle } from 'lucide-react';
import { exportMemoFull } from '../lib/pdf-generator.js';
import { ensureThaiFont } from '../lib/thai-font.js';
import { bahtText } from '../lib/thai-utils.js';
import { Field, Input, Textarea, Button, Card } from '../components/ui.jsx';

const TODAY = new Date().toISOString().slice(0, 10);

const INTRO_DEFAULT =
  'ตามที่ฝ่ายทรัพยากรบุคคล ได้รับอนุมัติให้ส่งบุคลากรเข้าร่วมการฝึกอบรมภายนอก ทางฝ่ายจึงขออนุมัติค่าฝึกอบรมภายนอก ตามรายละเอียดดังนี้';

const EMPTY = {
  from_dept: '',
  to_dept: '',
  cc_dept: '',
  subject: '',
  doc_date: TODAY,
  intro_text: INTRO_DEFAULT,
  budget_items: [],   // [{item_name, details, vendor_name, invoice_no, due_date, amount}]
  sig1_name: '', sig1_title: '',
  sig2_name: '', sig2_title: '',
  sig3_name: '', sig3_title: '',
};

const money = (n) =>
  Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function MemoForm() {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [exporting, setExporting] = useState(false);
  const [fontReady, setFontReady] = useState(null); // null=loading, true=ok, false=missing

  useEffect(() => {
    ensureThaiFont().then(setFontReady);
  }, []);

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: false }));
  };

  const addItem = () =>
    setForm((f) => ({
      ...f,
      budget_items: [...f.budget_items, { item_name: '', details: '', vendor_name: '', invoice_no: '', due_date: '', amount: '' }],
    }));
  const removeItem = (i) =>
    setForm((f) => ({ ...f, budget_items: f.budget_items.filter((_, j) => j !== i) }));
  const setItem = (i, field, value) =>
    setForm((f) => {
      const arr = [...f.budget_items];
      arr[i] = { ...arr[i], [field]: value };
      return { ...f, budget_items: arr };
    });

  const total = form.budget_items.reduce((s, it) => s + (Number(it.amount) || 0), 0);

  function validate() {
    const errs = {};
    ['from_dept', 'to_dept', 'subject', 'doc_date'].forEach((k) => {
      if (!String(form[k] ?? '').trim()) errs[k] = true;
    });
    if (form.budget_items.length === 0) errs.budget_items = true;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleExport() {
    if (!validate()) return toast.error('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
    setExporting(true);
    try {
      await exportMemoFull(form);
    } catch (e) {
      console.error(e);
      toast.error(`เกิดข้อผิดพลาด: ${e.message}`);
    } finally {
      setExporting(false);
    }
  }

  const Req = ({ k }) =>
    errors[k] ? <span className="ml-1 text-xs text-red-500">*จำเป็น</span> : null;

  return (
    <div className="space-y-5">
      {fontReady === false && <FontWarning />}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">ออกใบ Memo</h1>
          <p className="text-sm text-slate-500">บันทึกข้อความขออนุมัติค่าใช้จ่ายการฝึกอบรม</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { setForm(EMPTY); setErrors({}); }}>
          <RefreshCw size={14} /> ล้างฟอร์ม
        </Button>
      </div>

      {/* ── Header fields ── */}
      <Card className="p-5">
        <h2 className="mb-4 font-semibold text-slate-800">หัวบันทึกข้อความ</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={<>หน่วยงานผู้ส่ง <Req k="from_dept" /></>}>
            <Input
              value={form.from_dept}
              invalid={errors.from_dept}
              onChange={(e) => set('from_dept', e.target.value)}
              placeholder="เช่น ฝ่ายทรัพยากรบุคคล"
            />
          </Field>
          <Field label={<>วันที่ <Req k="doc_date" /></>}>
            <Input
              type="date"
              value={form.doc_date}
              invalid={errors.doc_date}
              onChange={(e) => set('doc_date', e.target.value)}
            />
          </Field>
          <Field label={<>เรียน <Req k="to_dept" /></>}>
            <Input
              value={form.to_dept}
              invalid={errors.to_dept}
              onChange={(e) => set('to_dept', e.target.value)}
              placeholder="เช่น ผู้จัดการฝ่ายทรัพยากรบุคคล"
            />
          </Field>
          <Field label="สำเนา (ถ้ามี)">
            <Input
              value={form.cc_dept}
              onChange={(e) => set('cc_dept', e.target.value)}
              placeholder="เช่น ฝ่ายการเงิน"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label={<>เรื่อง <Req k="subject" /></>}>
              <Input
                value={form.subject}
                invalid={errors.subject}
                onChange={(e) => set('subject', e.target.value)}
                placeholder="เช่น ขออนุมัติค่าใช้จ่ายการฝึกอบรมหลักสูตร..."
              />
            </Field>
          </div>
        </div>
      </Card>

      {/* ── Intro text ── */}
      <Card className="p-5">
        <h2 className="mb-3 font-semibold text-slate-800">ข้อความนำ (เหนือตาราง)</h2>
        <Textarea
          rows={3}
          value={form.intro_text}
          onChange={(e) => set('intro_text', e.target.value)}
        />
        <p className="mt-1 text-xs text-slate-400">แก้ไขข้อความได้ตามต้องการ</p>
      </Card>

      {/* ── Budget items ── */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">
            รายการค่าใช้จ่าย
            {errors.budget_items && (
              <span className="ml-2 text-xs font-normal text-red-500">*ต้องมีอย่างน้อย 1 รายการ</span>
            )}
          </h2>
          <Button size="sm" variant="secondary" onClick={addItem}>
            <Plus size={14} /> เพิ่มรายการ
          </Button>
        </div>

        {form.budget_items.length === 0 ? (
          <p className="text-sm text-slate-400">กดเพิ่มรายการเพื่อใส่ค่าใช้จ่าย</p>
        ) : (
          <div className="space-y-4">
            {form.budget_items.map((it, i) => (
              <div key={i} className="rounded-lg border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-500">รายการที่ {i + 1}</span>
                  <button
                    onClick={() => removeItem(i)}
                    className="rounded p-1 text-slate-400 hover:text-red-500"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="space-y-3">
                  <Field label="ชื่อรายการหลัก">
                    <Input
                      value={it.item_name}
                      onChange={(e) => setItem(i, 'item_name', e.target.value)}
                      placeholder="เช่น ค่าลงทะเบียนอบรม, ค่าที่พัก..."
                    />
                  </Field>
                  <Field label="รายละเอียด (แต่ละบรรทัด = 1 bullet)">
                    <Textarea
                      rows={2}
                      value={it.details}
                      onChange={(e) => setItem(i, 'details', e.target.value)}
                      placeholder="รายละเอียดค่าใช้จ่าย..."
                    />
                  </Field>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Field label="ชื่อบริษัทผู้ขาย">
                      <Input
                        value={it.vendor_name}
                        onChange={(e) => setItem(i, 'vendor_name', e.target.value)}
                        placeholder="เช่น ABC Co., Ltd."
                      />
                    </Field>
                    <Field label="เลขที่ Invoice">
                      <Input
                        value={it.invoice_no}
                        onChange={(e) => setItem(i, 'invoice_no', e.target.value)}
                        placeholder="เช่น INV-2025-001"
                      />
                    </Field>
                    <Field label="วันครบกำหนดชำระ">
                      <Input
                        type="date"
                        value={it.due_date}
                        onChange={(e) => setItem(i, 'due_date', e.target.value)}
                      />
                    </Field>
                  </div>
                  <div className="flex items-center justify-end gap-3">
                    <span className="text-sm text-slate-600">ค่าใช้จ่ายรวม (บาท)</span>
                    <div className="w-44">
                      <Input
                        type="number"
                        min="0"
                        value={it.amount}
                        onChange={(e) => setItem(i, 'amount', e.target.value)}
                        placeholder="0.00"
                        className="text-right"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {form.budget_items.length > 0 && (
          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm">
            <div className="flex justify-end gap-6">
              <span className="text-slate-600">รวมค่าใช้จ่ายทั้งหมด</span>
              <span className="font-bold text-slate-800">{money(total)} บาท</span>
            </div>
            <p className="mt-0.5 text-right text-xs text-slate-400">({bahtText(total)})</p>
          </div>
        )}
      </Card>

      {/* ── Signatures ── */}
      <Card className="p-5">
        <h2 className="mb-4 font-semibold text-slate-800">ลายเซ็น</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500">ผู้ลงนาม (ซ้าย)</p>
              <Field label="ชื่อ-นามสกุล">
                <Input
                  value={form.sig1_name}
                  onChange={(e) => set('sig1_name', e.target.value)}
                  placeholder="เช่น นายสมชาย ใจดี"
                />
              </Field>
              <Field label="ตำแหน่ง">
                <Input
                  value={form.sig1_title}
                  onChange={(e) => set('sig1_title', e.target.value)}
                  placeholder="เช่น นักศึกษาฝึกงาน – พัฒนาทรัพยากรบุคคล"
                />
              </Field>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500">ผู้ลงนาม (ขวา)</p>
              <Field label="ชื่อ-นามสกุล">
                <Input
                  value={form.sig2_name}
                  onChange={(e) => set('sig2_name', e.target.value)}
                  placeholder="เช่น นางสาวสมหญิง ดีมาก"
                />
              </Field>
              <Field label="ตำแหน่ง">
                <Input
                  value={form.sig2_title}
                  onChange={(e) => set('sig2_title', e.target.value)}
                  placeholder="เช่น ผู้จัดการฝ่ายพัฒนาทรัพยากรบุคคล"
                />
              </Field>
            </div>
          </div>
          <div className="mx-auto max-w-sm space-y-2">
            <p className="text-xs font-medium text-slate-500">ผู้ลงนาม (กลาง-ล่าง / ผู้อนุมัติ)</p>
            <Field label="ชื่อ-นามสกุล">
              <Input
                value={form.sig3_name}
                onChange={(e) => set('sig3_name', e.target.value)}
                placeholder="เช่น นายประสิทธิ์ ผลดี"
              />
            </Field>
            <Field label="ตำแหน่ง">
              <Input
                value={form.sig3_title}
                onChange={(e) => set('sig3_title', e.target.value)}
                placeholder="เช่น Head of Operations"
              />
            </Field>
          </div>
        </div>
      </Card>

      {/* ── Export ── */}
      <Card className="p-5">
        <Button onClick={handleExport} disabled={exporting}>
          <FileDown size={18} />
          {exporting ? 'กำลังสร้างเอกสาร...' : 'ออกใบ Memo (PDF)'}
        </Button>
      </Card>
    </div>
  );
}

function FontWarning() {
  return (
    <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" />
      <div>
        <p className="font-semibold">ไม่พบฟอนต์ภาษาไทย — เอกสาร PDF จะออกไม่ได้</p>
        <p className="mt-0.5 text-xs">
          วางไฟล์ <code className="rounded bg-amber-100 px-1 font-mono">THSarabunNew.ttf</code> ใน{' '}
          <code className="rounded bg-amber-100 px-1 font-mono">training-app/client/public/fonts/</code>{' '}
          แล้วกดรีเฟรชหน้าเว็บ{' '}
          <a
            href="https://www.f0nt.com/release/th-sarabun-new/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            ดาวน์โหลดที่นี่
          </a>
        </p>
      </div>
    </div>
  );
}
