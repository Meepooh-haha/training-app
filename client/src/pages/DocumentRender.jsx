import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Download, RefreshCw } from 'lucide-react';
import { api } from '../lib/api.js';
import { exportPRForm, exportMemo, exportMemoFull } from '../lib/pdf-generator.js';
import { Field, Input, Select, Textarea, Button, Card, Badge } from '../components/ui.jsx';
import MemoFullSection from './DocumentRenderMemoFull.jsx';

const EMPTY = {
  // ── Course & training info (shared PR + Memo) ──
  course_name: '',
  training_date: '',
  end_date: '',
  location: '',
  trainer_name: '',
  trainer_org: '',
  attendee_count: '',
  target_group: '',
  objective: '',

  // ── Document meta ──
  requester: 'ฝ่ายทรัพยากรบุคคล',
  department: 'HR',
  doc_date: new Date().toISOString().slice(0, 10),

  // ── Simple budget (PR Form) ──
  budget_instructor: '',
  budget_venue: '',
  budget_food: '',
  budget_material: '',
  budget_other: '',

  // ── Memo Full: header fields ──
  from_dept: '',
  to_dept: 'ผู้จัดการฝ่ายทรัพยากรบุคคล',
  cc_dept: '',
  subject: '',

  // ── Memo Full: attendees (for body paragraph) ──
  attendee_names: [],      // [{name:''}]

  // ── Memo Full: detailed budget items ──
  budget_items: [],        // [{item_name, price_per_person, vendor_name, invoice_number, payment_date}]

  // ── Memo Full: signature block ──
  preparer_name: '',
  preparer_title: 'เจ้าหน้าที่ฝึกอบรม',
  reviewer_name: '',
  reviewer_title: 'ผู้จัดการฝ่าย HR',
  approver_name: '',
  approver_title: 'ผู้อำนวยการ',
};

const PR_REQUIRED = ['course_name', 'training_date'];
const MEMO_REQUIRED = ['course_name', 'training_date', 'location', 'trainer_name', 'target_group', 'objective'];
const MEMO_FULL_REQUIRED = ['course_name', 'training_date', 'location', 'from_dept', 'to_dept', 'subject'];

const money = (n) =>
  Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const EMPTY_ITEM = () => ({
  item_name: '', price_per_person: '', vendor_name: '', invoice_number: '', payment_date: '',
});

export default function DocumentRender() {
  const [form, setForm] = useState(EMPTY);
  const [courses, setCourses] = useState([]);
  const [requests, setRequests] = useState([]);
  const [errors, setErrors] = useState({});
  const [loadReqId, setLoadReqId] = useState('');

  useEffect(() => {
    api.get('/courses').then(setCourses).catch(() => {});
    api.get('/requests').then(setRequests).catch(() => {});
  }, []);

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: false }));
  };

  // ── Attendee list helpers ──
  const addAttendee = () =>
    setForm((f) => ({ ...f, attendee_names: [...f.attendee_names, { name: '' }] }));
  const removeAttendee = (i) =>
    setForm((f) => ({ ...f, attendee_names: f.attendee_names.filter((_, j) => j !== i) }));
  const setAttendeeName = (i, name) =>
    setForm((f) => {
      const arr = [...f.attendee_names];
      arr[i] = { ...arr[i], name };
      return { ...f, attendee_names: arr };
    });

  // ── Budget items helpers ──
  const addBudgetItem = () =>
    setForm((f) => ({ ...f, budget_items: [...f.budget_items, EMPTY_ITEM()] }));
  const removeBudgetItem = (i) =>
    setForm((f) => ({ ...f, budget_items: f.budget_items.filter((_, j) => j !== i) }));
  const setBudgetItem = (i, field, value) =>
    setForm((f) => {
      const arr = [...f.budget_items];
      arr[i] = { ...arr[i], [field]: value };
      return { ...f, budget_items: arr };
    });

  async function loadFromRequest(id) {
    setLoadReqId(id);
    if (!id) return;
    try {
      const r = await api.get(`/requests/${id}`);
      const course = courses.find((c) => c.code === r.course_code);
      const courseName = course?.name_th || r.course_code || '';
      setForm((f) => ({
        ...f,
        course_name: courseName,
        training_date: r.training_date || '',
        end_date: r.end_date || '',
        location: r.location || '',
        trainer_name: r.trainer_name || '',
        trainer_org: r.trainer_org || '',
        attendee_count: r.attendee_count || '',
        target_group: r.target_group || '',
        objective: r.objective || '',
        requester: r.requester || f.requester,
        department: r.department || f.department,
        doc_date: r.created_at?.slice(0, 10) || f.doc_date,
        budget_instructor: r.budget_instructor || '',
        budget_venue: r.budget_venue || '',
        budget_food: r.budget_food || '',
        budget_material: r.budget_material || '',
        budget_other: r.budget_other || '',
        from_dept: r.department || f.from_dept,
        subject: courseName ? `ขออนุมัติค่าใช้จ่ายการอบรม หลักสูตร ${courseName}` : f.subject,
        attendee_names: (r.attendees || []).map((a) => ({ name: a.name || '' })),
      }));
      setErrors({});
      toast.success('โหลดข้อมูลจากคำขออบรมสำเร็จ');
    } catch (e) {
      toast.error(e.message);
    }
  }

  // PR budget totals
  const subtotal =
    Number(form.budget_instructor || 0) + Number(form.budget_venue || 0) +
    Number(form.budget_food || 0) + Number(form.budget_material || 0) +
    Number(form.budget_other || 0);
  const vat = subtotal * 0.07;
  const grand = subtotal + vat;

  function validate(requiredFields) {
    const errs = {};
    requiredFields.forEach((k) => {
      if (!String(form[k] ?? '').trim()) errs[k] = true;
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function buildPayload() {
    return {
      course_code: form.course_name,
      training_date: form.training_date,
      end_date: form.end_date,
      location: form.location,
      trainer_name: form.trainer_name,
      trainer_org: form.trainer_org,
      attendee_count: Number(form.attendee_count) || 0,
      target_group: form.target_group,
      objective: form.objective,
      requester: form.requester,
      department: form.department,
      created_at: form.doc_date,
      budget_instructor: Number(form.budget_instructor) || 0,
      budget_venue: Number(form.budget_venue) || 0,
      budget_food: Number(form.budget_food) || 0,
      budget_material: Number(form.budget_material) || 0,
      budget_other: Number(form.budget_other) || 0,
      req_no: 'standalone',
    };
  }

  function buildMemoFullPayload() {
    return {
      ...buildPayload(),
      doc_date: form.doc_date,
      course_name: form.course_name,
      from_dept: form.from_dept,
      to_dept: form.to_dept,
      cc_dept: form.cc_dept,
      subject: form.subject,
      attendee_names: form.attendee_names,
      budget_items: form.budget_items.map((it) => ({
        ...it,
        price_per_person: Number(it.price_per_person) || 0,
      })),
      preparer_name: form.preparer_name,
      preparer_title: form.preparer_title,
      reviewer_name: form.reviewer_name,
      reviewer_title: form.reviewer_title,
      approver_name: form.approver_name,
      approver_title: form.approver_title,
    };
  }

  const courseObj = { name_th: form.course_name };

  async function renderPR() {
    if (!validate(PR_REQUIRED)) return toast.error('กรุณากรอกชื่อหลักสูตรและวันที่อบรม');
    await exportPRForm(buildPayload(), courseObj);
  }

  async function renderMemo() {
    if (!validate(MEMO_REQUIRED)) return toast.error('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
    await exportMemo(buildPayload(), courseObj);
  }

  async function renderMemoFull() {
    if (!validate(MEMO_FULL_REQUIRED)) return toast.error('กรุณากรอกหัวบันทึก (From/To/Subject) ให้ครบ');
    await exportMemoFull(buildMemoFullPayload());
  }

  async function renderBoth() {
    if (!validate([...new Set([...PR_REQUIRED, ...MEMO_REQUIRED])])) {
      return toast.error('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
    }
    await exportPRForm(buildPayload(), courseObj);
    await exportMemo(buildPayload(), courseObj);
  }

  function resetForm() {
    if (!confirm('ล้างข้อมูลทั้งหมดในฟอร์ม?')) return;
    setForm(EMPTY);
    setLoadReqId('');
    setErrors({});
  }

  const Req = ({ k }) =>
    errors[k] ? <span className="ml-1 text-xs text-red-500">*จำเป็น</span> : null;

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">ออกเอกสารขออนุมัติ</h1>
          <p className="text-sm text-slate-500">กรอกข้อมูลแล้วพิมพ์ ใบ PR และ/หรือ ใบ Memo ได้ทันที</p>
        </div>
        <Button variant="ghost" size="sm" onClick={resetForm}>
          <RefreshCw size={14} /> ล้างฟอร์ม
        </Button>
      </div>

      {/* Required-field legend */}
      <div className="flex flex-wrap gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        <span className="font-medium">ป้ายกำกับ:</span>
        <span><Badge color="blue">PR</Badge> ใช้ในใบ PR</span>
        <span><Badge color="amber">Memo</Badge> ใช้ในใบ Memo (ย่อ)</span>
        <span><Badge color="purple">Memo เต็ม</Badge> ใช้ในใบ Memo รูปแบบเต็ม</span>
      </div>

      {/* Load from existing request */}
      <Card className="p-5">
        <h2 className="mb-3 font-semibold text-slate-800">โหลดจากคำขออบรมที่มีอยู่ (ไม่บังคับ)</h2>
        <Select value={loadReqId} onChange={(e) => loadFromRequest(e.target.value)}>
          <option value="">— เลือกคำขออบรมเพื่อดึงข้อมูล —</option>
          {requests.map((r) => (
            <option key={r.id} value={r.id}>
              {r.req_no} · {r.course_name_th} ({r.training_date})
            </option>
          ))}
        </Select>
        <p className="mt-2 text-xs text-slate-400">
          เลือกคำขอเพื่อดึงข้อมูลมาใส่ฟอร์มอัตโนมัติ หรือกรอกเองโดยไม่ต้องเลือก
        </p>
      </Card>

      {/* ── Section 1: Course & Training Info ── */}
      <Card className="p-5">
        <h2 className="mb-4 font-semibold text-slate-800">ข้อมูลหลักสูตรและการอบรม</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2 lg:col-span-3">
            <Field
              label={
                <>ชื่อหลักสูตร <Badge color="blue">PR</Badge> <Badge color="amber">Memo</Badge> <Badge color="purple">Memo เต็ม</Badge><Req k="course_name" /></>
              }
            >
              <div className="flex gap-2">
                <Select
                  className="w-64 shrink-0"
                  value={courses.find((c) => c.name_th === form.course_name)?.code || ''}
                  onChange={(e) => {
                    const c = courses.find((x) => x.code === e.target.value);
                    if (c) set('course_name', c.name_th);
                  }}
                >
                  <option value="">— เลือกจากหลักสูตรในระบบ —</option>
                  {courses.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} · {c.name_th}
                    </option>
                  ))}
                </Select>
                <Input
                  value={form.course_name}
                  invalid={errors.course_name}
                  onChange={(e) => set('course_name', e.target.value)}
                  placeholder="หรือพิมพ์ชื่อหลักสูตรเอง"
                />
              </div>
            </Field>
          </div>

          <Field label={<>วันที่อบรม <Badge color="blue">PR</Badge> <Badge color="amber">Memo</Badge><Req k="training_date" /></>}>
            <Input type="date" value={form.training_date} invalid={errors.training_date} onChange={(e) => set('training_date', e.target.value)} />
          </Field>
          <Field label="วันที่สิ้นสุด (ถ้ามี)">
            <Input type="date" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} />
          </Field>
          <Field label={<>สถานที่ <Badge color="amber">Memo</Badge> <Badge color="purple">Memo เต็ม</Badge><Req k="location" /></>}>
            <Input value={form.location} invalid={errors.location} onChange={(e) => set('location', e.target.value)} placeholder="เช่น ห้องประชุมใหญ่ ชั้น 5" />
          </Field>
          <Field label={<>วิทยากร <Badge color="amber">Memo</Badge><Req k="trainer_name" /></>}>
            <Input value={form.trainer_name} invalid={errors.trainer_name} onChange={(e) => set('trainer_name', e.target.value)} />
          </Field>
          <Field label="หน่วยงานวิทยากร">
            <Input value={form.trainer_org} onChange={(e) => set('trainer_org', e.target.value)} placeholder="เช่น ภายในองค์กร" />
          </Field>
          <Field label="จำนวนผู้เข้าอบรม (คน)">
            <Input type="number" min="0" value={form.attendee_count} onChange={(e) => set('attendee_count', e.target.value)} />
          </Field>
          <Field label={<>กลุ่มเป้าหมาย <Badge color="amber">Memo</Badge><Req k="target_group" /></>}>
            <Input value={form.target_group} invalid={errors.target_group} onChange={(e) => set('target_group', e.target.value)} placeholder="เช่น พนักงานทุกแผนก" />
          </Field>
          <div className="sm:col-span-2 lg:col-span-3">
            <Field label={<>วัตถุประสงค์ <Badge color="amber">Memo</Badge><Req k="objective" /></>}>
              <Textarea rows={2} value={form.objective} invalid={errors.objective} onChange={(e) => set('objective', e.target.value)} placeholder="เพื่อ..." />
            </Field>
          </div>
        </div>
      </Card>

      {/* ── Section 2: Document meta ── */}
      <Card className="p-5">
        <h2 className="mb-4 font-semibold text-slate-800">ข้อมูลเอกสาร</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label={<>ผู้ขอ <Badge color="blue">PR</Badge></>}>
            <Input value={form.requester} onChange={(e) => set('requester', e.target.value)} />
          </Field>
          <Field label={<>แผนก <Badge color="blue">PR</Badge></>}>
            <Input value={form.department} onChange={(e) => set('department', e.target.value)} />
          </Field>
          <Field label={<>วันที่จัดทำ <Badge color="amber">Memo</Badge> <Badge color="purple">Memo เต็ม</Badge></>}>
            <Input type="date" value={form.doc_date} onChange={(e) => set('doc_date', e.target.value)} />
          </Field>
        </div>
      </Card>

      {/* ── Section 3: Simple budget (PR) ── */}
      <Card className="p-5">
        <h2 className="mb-1 font-semibold text-slate-800">
          งบประมาณ <Badge color="blue">PR</Badge> <Badge color="amber">Memo</Badge>
        </h2>
        <p className="mb-4 text-xs text-slate-400">ใช้สำหรับ ใบ PR และ ใบ Memo รูปแบบย่อ</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ['budget_instructor', 'ค่าวิทยากร'],
            ['budget_venue', 'ค่าสถานที่'],
            ['budget_food', 'ค่าอาหารและเครื่องดื่ม'],
            ['budget_material', 'ค่าเอกสาร/วัสดุ'],
            ['budget_other', 'ค่าใช้จ่ายอื่นๆ'],
          ].map(([k, label]) => (
            <Field key={k} label={label}>
              <Input type="number" min="0" placeholder="0" value={form[k]} onChange={(e) => set(k, e.target.value)} />
            </Field>
          ))}
        </div>
        <div className="mt-4 rounded-lg bg-slate-50 p-4">
          <table className="ml-auto w-64 text-sm">
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="py-1.5 text-slate-500">รวมก่อน VAT</td>
                <td className="py-1.5 text-right font-medium text-slate-800">{money(subtotal)} ฿</td>
              </tr>
              <tr>
                <td className="py-1.5 text-slate-500">VAT 7%</td>
                <td className="py-1.5 text-right font-medium text-slate-800">{money(vat)} ฿</td>
              </tr>
              <tr className="text-base">
                <td className="py-2 font-semibold text-slate-700">รวมทั้งหมด</td>
                <td className="py-2 text-right font-bold text-brand-700">{money(grand)} ฿</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <MemoFullSection
        form={form}
        errors={errors}
        set={set}
        addAttendee={addAttendee}
        removeAttendee={removeAttendee}
        setAttendeeName={setAttendeeName}
        addBudgetItem={addBudgetItem}
        removeBudgetItem={removeBudgetItem}
        setBudgetItem={setBudgetItem}
      />

      {/* ── Render buttons ── */}
      <Card className="p-5">
        <h2 className="mb-4 font-semibold text-slate-800">ออกเอกสาร</h2>
        <div className="flex flex-wrap gap-3">
          <RenderBtn
            label="ออกใบ PR"
            sublabel="ใบขอซื้อ / ขออนุมัติงบประมาณ"
            color="blue"
            required="ชื่อหลักสูตร · วันที่ · งบประมาณ (section 3)"
            onClick={renderPR}
          />
          <RenderBtn
            label="ออกใบ Memo (ย่อ)"
            sublabel="บันทึกข้อความแบบสั้น"
            color="amber"
            required="ฟิลด์ที่มีป้าย Memo"
            onClick={renderMemo}
          />
          <RenderBtn
            label="ออกใบ Memo (รูปแบบเต็ม)"
            sublabel="MEMORANDUM · ตาราง · ลายเซ็น 3 คน"
            color="purple"
            required="หัวบันทึก · รายชื่อ · รายการค่าใช้จ่าย"
            onClick={renderMemoFull}
          />
          <RenderBtn
            label="ออกทั้งสองใบ"
            sublabel="PR + Memo ย่อ พร้อมกัน"
            color="green"
            required="ต้องกรอกครบทั้งสองชุด"
            onClick={renderBoth}
          />
        </div>
      </Card>
    </div>
  );
}

function RenderBtn({ label, sublabel, color, required, onClick }) {
  const colors = {
    blue:   'border-brand-300 bg-brand-50 hover:bg-brand-100 text-brand-700',
    amber:  'border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-700',
    purple: 'border-purple-300 bg-purple-50 hover:bg-purple-100 text-purple-700',
    green:  'border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700',
  };
  const iconColors = {
    blue: 'text-brand-500', amber: 'text-amber-500',
    purple: 'text-purple-500', green: 'text-emerald-500',
  };

  return (
    <button
      onClick={onClick}
      className={`flex items-start gap-3 rounded-xl border-2 px-5 py-4 text-left transition-colors ${colors[color]}`}
    >
      <Download size={22} className={`mt-0.5 shrink-0 ${iconColors[color]}`} />
      <div>
        <div className="font-semibold">{label}</div>
        <div className="text-sm opacity-80">{sublabel}</div>
        <div className="mt-1 text-xs opacity-60">ต้องกรอก: {required}</div>
      </div>
    </button>
  );
}
