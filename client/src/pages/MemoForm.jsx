import { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2, FileDown, RefreshCw, ChevronDown, ChevronUp, UserPlus, X, BookmarkPlus } from 'lucide-react';
import { bahtText, thaiDate } from '../lib/thai-utils.js';
import { Field, Input, Textarea, Button, Card } from '../components/ui.jsx';

const TODAY = new Date().toISOString().slice(0, 10);

const INTRO_DEFAULT_LINES = [
  'ตามที่ฝ่ายทรัพยากรบุคคล ได้รับอนุมัติให้ส่งบุคลากรเข้าร่วมการฝึกอบรมภายนอก',
  'ทางฝ่ายจึงขออนุมัติค่าฝึกอบรมภายนอก ตามรายละเอียดดังนี้',
];

// The memo template renders this text at ~10pt in a ~6.5in-wide column (server/templates/memo_template.docx),
// which fits roughly 100 Thai characters per line — capping input here keeps what the user types
// from silently overflowing into a second, unplanned line in the exported document.
const INTRO_LINE_MAX = 100;

// Each entry is one literal line in the exported document — writing line-by-line
// (instead of one wrapping textarea) lets the user see and control exactly where
// lines break, since the browser's soft-wrap width has nothing to do with the
// document's actual page width.
const makeLine = (text = '') => ({ id: `line-${Date.now()}-${Math.random().toString(36).slice(2)}`, text });

const EMPTY = {
  from_dept: '',
  to_dept: '',
  cc_dept: '',
  subject: '',
  doc_date: TODAY,
  intro_lines: INTRO_DEFAULT_LINES.map((text, i) => ({ id: `line-intro-default-${i}`, text })),
  budget_items: [],
  sig1_name: '', sig1_title: '',
  sig2_name: '', sig2_title: '',
  sig3_name: '', sig3_title: '',
};

const EMPTY_ITEM = { item_name: '', isBold: false, details: '', vendor_name: '', invoice_no: '', due_date: '', amount: '' };

const money = (n) =>
  Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function loadApprovers() {
  try { return JSON.parse(localStorage.getItem('memo_approvers') || '[]'); }
  catch { return []; }
}

function loadHeaderPresets() {
  try { return JSON.parse(localStorage.getItem('memo_header_presets') || '[]'); }
  catch { return []; }
}

// สร้าง budget items ตั้งต้น: ถ้ามี Invoice ที่ยืนยันแล้ว ใช้ข้อมูลจริงจาก Invoice
// (1 ใบ = 1 รายการ พร้อมเลขที่/ผู้ขาย/วันทำจ่าย) ไม่งั้นถอยไปใช้งบ 5 หมวดในใบขอ
function seedFromProject(project, invoices) {
  if (!project) return EMPTY;
  const base = {
    ...EMPTY,
    subject: `ขออนุมัติค่าใช้จ่ายโครงการฝึกอบรม "${project.name}"${project.req_no ? ` (${project.req_no})` : ''}`,
  };
  if (invoices?.length) {
    return {
      ...base,
      budget_items: invoices.map((ex) => ({
        ...EMPTY_ITEM,
        item_name: ex.line_items?.[0]?.description || `ค่าใช้จ่ายตาม Invoice ${ex.invoice_number || ''}`.trim(),
        details: (ex.line_items || []).slice(1).map((it) => it.description).filter(Boolean).join('\n'),
        vendor_name: ex.vendor_name || '',
        invoice_no: ex.invoice_number || '',
        due_date: ex.due_date || '',
        amount: ex.total_amount != null ? String(ex.total_amount) : '',
      })),
    };
  }
  const BUDGETS = [
    ['budget_instructor', 'ค่าวิทยากร'],
    ['budget_venue', 'ค่าสถานที่'],
    ['budget_food', 'ค่าอาหารและเครื่องดื่ม'],
    ['budget_material', 'ค่าเอกสารและอุปกรณ์'],
    ['budget_other', 'ค่าใช้จ่ายอื่น ๆ'],
  ];
  return {
    ...base,
    budget_items: BUDGETS
      .filter(([key]) => Number(project[key]) > 0)
      .map(([key, item_name]) => ({ ...EMPTY_ITEM, item_name, amount: String(project[key]) })),
  };
}

// `project` (optional): เมื่อออก Memo จากใต้โครงการอบรม — เรื่องและรายการงบ
// prefill จากใบขอของโครงการ (แก้ไขต่อได้อิสระ)
// `invoices` (optional): extraction_data ของ Invoice ที่ยืนยันแล้ว → ใช้แทนงบ 5 หมวด
// `onExported` (optional): เรียกหลัง export สำเร็จ (เช่นให้ shell รีโหลดสถานะอนุมัติ)
export default function MemoForm({ project, invoices, onExported }) {
  const [form, setForm] = useState(() => seedFromProject(project, invoices));
  const [errors, setErrors] = useState({});
  const [exporting, setExporting] = useState(false);
  const [approvers, setApprovers] = useState(loadApprovers);
  const [showApproverPanel, setShowApproverPanel] = useState(false);
  const [newApprover, setNewApprover] = useState({ name: '', title: '' });
  const [headerPresets, setHeaderPresets] = useState(loadHeaderPresets);
  const [showHeaderPanel, setShowHeaderPanel] = useState(false);
  const [newPresetLabel, setNewPresetLabel] = useState('');

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: false }));
  };

  // ── Intro line management (one field per document line) ────────────────
  const introLineRefs = useRef({});
  const pendingFocusId = useRef(null);
  useEffect(() => {
    if (pendingFocusId.current && introLineRefs.current[pendingFocusId.current]) {
      introLineRefs.current[pendingFocusId.current].focus();
      pendingFocusId.current = null;
    }
  }, [form.intro_lines]);
  const setIntroLine = (id, text) =>
    setForm((f) => ({ ...f, intro_lines: f.intro_lines.map((l) => (l.id === id ? { ...l, text } : l)) }));
  const addIntroLine = (afterId) =>
    setForm((f) => {
      const idx = afterId ? f.intro_lines.findIndex((l) => l.id === afterId) : f.intro_lines.length - 1;
      const newLine = makeLine('');
      pendingFocusId.current = newLine.id;
      return { ...f, intro_lines: [...f.intro_lines.slice(0, idx + 1), newLine, ...f.intro_lines.slice(idx + 1)] };
    });
  const removeIntroLine = (id) =>
    setForm((f) => ({
      ...f,
      intro_lines: f.intro_lines.length > 1 ? f.intro_lines.filter((l) => l.id !== id) : f.intro_lines,
    }));

  const addItem = () =>
    setForm((f) => ({ ...f, budget_items: [...f.budget_items, { ...EMPTY_ITEM }] }));
  const removeItem = (i) =>
    setForm((f) => ({ ...f, budget_items: f.budget_items.filter((_, j) => j !== i) }));
  const setItem = (i, field, value) =>
    setForm((f) => {
      const arr = [...f.budget_items];
      arr[i] = { ...arr[i], [field]: value };
      return { ...f, budget_items: arr };
    });

  const total = form.budget_items.reduce((s, it) => s + (Number(it.amount) || 0), 0);

  // ── Header preset management ────────────────────────────────────────────
  const saveHeaderPresets = (arr) => {
    setHeaderPresets(arr);
    localStorage.setItem('memo_header_presets', JSON.stringify(arr));
  };
  const addHeaderPreset = () => {
    const label = newPresetLabel.trim();
    if (!label) return;
    saveHeaderPresets([...headerPresets, {
      label,
      from_dept: form.from_dept,
      to_dept: form.to_dept,
      cc_dept: form.cc_dept,
      subject: form.subject,
      intro_lines: form.intro_lines.map((l) => l.text),
    }]);
    setNewPresetLabel('');
    toast.success(`บันทึกแม่แบบ "${label}" แล้ว`);
  };
  const removeHeaderPreset = (i) => saveHeaderPresets(headerPresets.filter((_, j) => j !== i));
  const applyHeaderPreset = (idx) => {
    const p = headerPresets[idx];
    if (!p) return;
    ['from_dept', 'to_dept', 'cc_dept', 'subject'].forEach((k) => set(k, p[k] ?? ''));
    // older saved presets stored a single intro_text string instead of intro_lines
    const lines = p.intro_lines ?? (p.intro_text ? p.intro_text.split('\n') : ['']);
    set('intro_lines', lines.map(makeLine));
  };

  // ── Approver preset management ──────────────────────────────────────────
  const saveApprovers = (arr) => {
    setApprovers(arr);
    localStorage.setItem('memo_approvers', JSON.stringify(arr));
  };
  const addApprover = () => {
    if (!newApprover.name.trim()) return;
    saveApprovers([...approvers, { name: newApprover.name.trim(), title: newApprover.title.trim() }]);
    setNewApprover({ name: '', title: '' });
  };
  const removeApprover = (i) => saveApprovers(approvers.filter((_, j) => j !== i));
  const applyPreset = (sigKey, idx) => {
    const a = approvers[idx];
    if (!a) return;
    set(`${sigKey}_name`, a.name);
    set(`${sigKey}_title`, a.title);
  };

  function validate() {
    const errs = {};
    ['from_dept', 'to_dept', 'subject', 'doc_date'].forEach((k) => {
      if (!String(form[k] ?? '').trim()) errs[k] = true;
    });
    if (form.budget_items.length === 0) errs.budget_items = true;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleExportFile(endpoint, filename) {
    if (!validate()) return toast.error('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน');
    setExporting(true);
    try {
      const payload = {
        // C4: Thai-formatted doc date
        date: thaiDate(form.doc_date),
        from_dept: form.from_dept,
        to_dept: form.to_dept,
        cc_dept: form.cc_dept,
        subject: form.subject,
        // Bug 1: user's editable intro text replaces hardcoded body paragraph.
        // Lines are entered one field at a time in the UI, so \n here is exactly
        // where the user chose to break — no relying on the docx to re-wrap it.
        intro_text: form.intro_lines.map((l) => l.text).join('\n'),
        // Multi-item loop for expense table
        budget_items: form.budget_items.map((it) => ({
          // C2: bold toggle — two fields, one always empty
          item_display_bold: it.isBold ? it.item_name : '',
          item_display_plain: it.isBold ? '' : it.item_name,
          details: it.details,
          vendor_name: it.vendor_name,
          // Bug 2: invoice number + payment date on one line
          invoice_line: it.invoice_no
            ? `${it.invoice_no}   ทำจ่าย ณ วันที่ ${thaiDate(it.due_date)}`
            : '',
          amount: money(it.amount ?? 0),
        })),
        total_text: bahtText(total),
        total_amount: money(total),
        signer1_name: form.sig1_name,
        signer1_position: form.sig1_title,
        signer2_name: form.sig2_name,
        signer2_position: form.sig2_title,
        signer3_name: form.sig3_name,
        signer3_position: form.sig3_title,
      };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      // ออก Memo ใต้โครงการที่ยังเป็นร่าง → ขยับสถานะเป็น "รออนุมัติ" ให้เอง
      // (สี satellite ออก Memo ในกราฟอนุมานจาก approval_status)
      if (project?.id && project.approval_status === 'draft') {
        try {
          await fetch(`/api/training-projects/${project.id}/approval`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ approval_status: 'pending' }),
          });
          toast.success('อัปเดตสถานะโครงการเป็น "รออนุมัติ (ส่ง Memo แล้ว)" ให้แล้ว');
          onExported?.();
        } catch { /* ไม่ให้พลาดเรื่องสถานะมาบังการ export ที่สำเร็จแล้ว */ }
      }
    } catch (e) {
      console.error(e);
      toast.error(`เกิดข้อผิดพลาด: ${e.message}`);
    } finally {
      setExporting(false);
    }
  }

  const Req = ({ k }) =>
    errors[k] ? <span className="ml-1 text-xs text-red-500">*จำเป็น</span> : null;

  // Dropdown to pick a saved approver preset
  const ApproverSelect = ({ sigKey }) => {
    if (approvers.length === 0) return null;
    return (
      <select
        className="mb-2 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        defaultValue=""
        onChange={(e) => { if (e.target.value !== '') applyPreset(sigKey, parseInt(e.target.value)); e.target.value = ''; }}
      >
        <option value="">— เลือกจากรายชื่อที่บันทึกไว้ —</option>
        {approvers.map((a, i) => (
          <option key={i} value={i}>{a.name}{a.title ? ` (${a.title})` : ''}</option>
        ))}
      </select>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">ออกใบ Memo</h1>
          <p className="text-sm text-slate-500">บันทึกข้อความขออนุมัติค่าใช้จ่ายการฝึกอบรม</p>
          {invoices?.length > 0 && (
            <p className="mt-1 text-xs text-emerald-700">
              ✓ เติมรายการค่าใช้จ่ายจาก Invoice ที่ยืนยันแล้ว {invoices.length} ใบให้อัตโนมัติ — แก้ไขต่อได้อิสระ
            </p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={() => { setForm(EMPTY); setErrors({}); }}>
          <RefreshCw size={14} /> ล้างฟอร์ม
        </Button>
      </div>

      {/* ── Header fields ── */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">หัวบันทึกข้อความ</h2>
          <button
            type="button"
            onClick={() => setShowHeaderPanel((v) => !v)}
            className="flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
          >
            <BookmarkPlus size={13} />
            จัดการแม่แบบที่บันทึกไว้
            {showHeaderPanel ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>

        {showHeaderPanel && (
          <div className="mb-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
            <p className="mb-3 text-xs font-medium text-slate-500">แม่แบบที่บันทึกไว้</p>
            {headerPresets.length === 0 && (
              <p className="mb-3 text-xs text-slate-400">ยังไม่มีแม่แบบที่บันทึก</p>
            )}
            <div className="mb-3 space-y-1.5">
              {headerPresets.map((p, i) => (
                <div key={i} className="flex items-center justify-between rounded border border-slate-200 bg-white px-3 py-2 text-sm">
                  <span className="truncate font-medium text-slate-700">{p.label}</span>
                  <button onClick={() => removeHeaderPreset(i)} className="ml-3 shrink-0 text-slate-300 hover:text-red-400">
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newPresetLabel}
                onChange={(e) => setNewPresetLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addHeaderPreset()}
                placeholder="ชื่อแม่แบบ เช่น ขออนุมัติอบรม HR"
                className="flex-1"
              />
              <Button size="sm" variant="secondary" onClick={addHeaderPreset}>บันทึกปัจจุบัน</Button>
            </div>
            <p className="mt-1.5 text-xs text-slate-400">บันทึกหัวบันทึก + ข้อความนำ ที่กรอกอยู่ตอนนี้</p>
          </div>
        )}

        {headerPresets.length > 0 && (
          <select
            className="mb-4 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            defaultValue=""
            onChange={(e) => { if (e.target.value !== '') { applyHeaderPreset(parseInt(e.target.value)); e.target.value = ''; } }}
          >
            <option value="">— เลือกแม่แบบที่บันทึกไว้ —</option>
            {headerPresets.map((p, i) => (
              <option key={i} value={i}>{p.label}</option>
            ))}
          </select>
        )}

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
        <h2 className="font-semibold text-slate-800">ข้อความนำ (เหนือตาราง)</h2>
        <p className="mb-3 mt-1 text-xs text-slate-400">
          พิมพ์ทีละบรรทัด แต่ละช่องคือ 1 บรรทัดจริงในเอกสาร กด Enter เพื่อขึ้นบรรทัดใหม่
        </p>
        <div className="space-y-2">
          {form.intro_lines.map((line, i) => (
            <div key={line.id} className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-right text-xs text-slate-400">{i + 1}</span>
              <input
                ref={(el) => {
                  if (el) introLineRefs.current[line.id] = el;
                  else delete introLineRefs.current[line.id];
                }}
                value={line.text}
                onChange={(e) => setIntroLine(line.id, e.target.value.slice(0, INTRO_LINE_MAX))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addIntroLine(line.id);
                  }
                }}
                maxLength={INTRO_LINE_MAX}
                placeholder="พิมพ์ข้อความบรรทัดนี้..."
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
              <span
                className={`w-14 shrink-0 text-right text-xs tabular-nums ${
                  line.text.length >= INTRO_LINE_MAX ? 'text-red-500' : 'text-slate-400'
                }`}
              >
                {line.text.length}/{INTRO_LINE_MAX}
              </span>
              <button
                type="button"
                onClick={() => removeIntroLine(line.id)}
                disabled={form.intro_lines.length <= 1}
                className="shrink-0 rounded p-1 text-slate-400 hover:text-red-500 disabled:opacity-30"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
        <Button size="sm" variant="secondary" className="mt-3" onClick={() => addIntroLine()}>
          <Plus size={14} /> เพิ่มบรรทัด
        </Button>
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
                  {/* C1: free-text item name | C2: bold toggle */}
                  <Field label="ชื่อรายการหลัก">
                    <div className="flex gap-2">
                      <Input
                        value={it.item_name}
                        onChange={(e) => setItem(i, 'item_name', e.target.value)}
                        placeholder="พิมพ์ชื่อรายการได้อิสระ เช่น ค่าลงทะเบียนอบรม..."
                      />
                      <button
                        type="button"
                        onClick={() => setItem(i, 'isBold', !it.isBold)}
                        title={it.isBold ? 'ตัวหนา (คลิกเพื่อยกเลิก)' : 'คลิกเพื่อทำตัวหนา'}
                        className={`shrink-0 rounded border px-3 py-1.5 text-sm font-bold transition-colors ${
                          it.isBold
                            ? 'border-blue-500 bg-blue-500 text-white'
                            : 'border-slate-300 bg-white text-slate-600 hover:border-blue-400'
                        }`}
                      >
                        B
                      </button>
                    </div>
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
                    {/* C3: renamed label */}
                    <Field label="ทำจ่าย ณ วันที่">
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
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">ลายเซ็น</h2>
          {/* C5A: collapsible approver preset panel toggle */}
          <button
            type="button"
            onClick={() => setShowApproverPanel((v) => !v)}
            className="flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
          >
            <UserPlus size={13} />
            จัดการรายชื่อที่บันทึกไว้
            {showApproverPanel ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>

        {/* C5A: Approver preset management panel */}
        {showApproverPanel && (
          <div className="mb-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
            <p className="mb-3 text-xs font-medium text-slate-500">รายชื่อที่บันทึกไว้</p>
            {approvers.length === 0 && (
              <p className="mb-3 text-xs text-slate-400">ยังไม่มีรายชื่อที่บันทึก</p>
            )}
            <div className="mb-3 space-y-1.5">
              {approvers.map((a, i) => (
                <div key={i} className="flex items-center justify-between rounded border border-slate-200 bg-white px-3 py-2 text-sm">
                  <span>
                    <span className="font-medium text-slate-700">{a.name}</span>
                    {a.title && <span className="ml-2 text-slate-400">({a.title})</span>}
                  </span>
                  <button onClick={() => removeApprover(i)} className="ml-3 text-slate-300 hover:text-red-400">
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newApprover.name}
                onChange={(e) => setNewApprover((p) => ({ ...p, name: e.target.value }))}
                placeholder="ชื่อ-นามสกุล"
                className="flex-1"
              />
              <Input
                value={newApprover.title}
                onChange={(e) => setNewApprover((p) => ({ ...p, title: e.target.value }))}
                placeholder="ตำแหน่ง"
                className="flex-1"
              />
              <Button size="sm" variant="secondary" onClick={addApprover}>เพิ่ม</Button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500">ผู้ลงนาม (ซ้าย)</p>
              {/* C5B: preset dropdown */}
              <ApproverSelect sigKey="sig1" />
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
              <ApproverSelect sigKey="sig2" />
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
            <ApproverSelect sigKey="sig3" />
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
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => handleExportFile('/api/memo/export-docx', 'memo.docx')} disabled={exporting}>
            <FileDown size={18} />
            {exporting ? 'กำลังสร้างเอกสาร...' : 'Export DOCX'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
