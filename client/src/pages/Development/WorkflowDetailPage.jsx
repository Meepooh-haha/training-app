import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Trash2, Pencil, X, Stamp, Paperclip, FileDown, CheckCircle2, CircleAlert, Landmark } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import { buildDocExportPayload } from '../../lib/coursePlanUtils.js';
import { buildProjectPreset } from './WorkflowGraph.jsx';
import HubSatelliteGraph from './HubSatelliteGraph.jsx';
import { useProject, APPROVAL_BADGE } from './ProjectShell.jsx';
import { COMPETENCY_TYPES, DELIVERY_TYPES } from '../../config/projectTypes.jsx';

const STEP_LABELS = ['ขออนุมัติ', 'เตรียม-จัดอบรม', 'ประเมินผล', 'บันทึก-รายงาน'];

// คำเตือนแบบไม่ล็อก: งานหลักของ phase ที่กำลังจะออกยังไม่เสร็จ → confirm ก่อนเลื่อน
function advanceWarning(step, status, project) {
  if (!status) return null;
  if (step === 1 && status.approval?.status !== 'approved') {
    return 'ยังไม่ได้บันทึกผลอนุมัติของโครงการนี้';
  }
  // Public ไม่มีใบลงทะเบียน — ข้ามคำเตือนของ Phase 2
  if (step === 2 && project?.delivery_type !== 'public' && !status.registration?.exists) {
    return 'ยังไม่มีใบลงทะเบียนของโครงการนี้';
  }
  if (step === 3 && !status.evaluation?.count) {
    return 'ยังไม่มีผลประเมินของโครงการนี้';
  }
  return null;
}

function StepNavigator({ project, status, onChanged }) {
  const [advancing, setAdvancing] = useState(false);

  async function setStep(step, direction) {
    if (direction > 0) {
      const warn = advanceWarning(project.current_step, status, project);
      if (warn && !window.confirm(`${warn}\nต้องการเลื่อนไปขั้นถัดไปเลยหรือไม่?`)) return;
    }
    setAdvancing(true);
    try {
      await api.patch(`/training-projects/${project.id}/step`, { step });
      await onChanged();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setAdvancing(false);
    }
  }

  const cs = project.current_step;
  // ไม่มีคำเตือนของขั้นปัจจุบัน = งานหลักครบแล้ว → ชวนให้กดเลื่อนขั้น
  const readyToAdvance = cs < 4 && status && !advanceWarning(cs, status, project);

  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-ink-400 font-body">
        ขั้นตอน {cs}/4 — {STEP_LABELS[cs - 1]}
        {readyToAdvance && (
          <span className="ml-2 font-semibold" style={{ color: '#1E7A52' }}>
            ✓ งานหลักของขั้นนี้ครบแล้ว — กด "ถัดไป" ได้เลย
          </span>
        )}
      </span>
      <div className="flex gap-1">
        <button
          disabled={cs <= 1 || advancing}
          onClick={() => setStep(cs - 1, -1)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-ink-600 hover:bg-ink-100 disabled:opacity-40 transition-colors font-body"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> ย้อนกลับ
        </button>
        <button
          disabled={cs >= 4 || advancing}
          onClick={() => setStep(cs + 1, +1)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40 transition-colors font-body"
          style={{ background: cs < 4 ? '#710F16' : '#C4BDBA' }}
        >
          ถัดไป <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ---------- บันทึกผลอนุมัติ (HRD กรอกเองหลัง Memo ถูกเซ็นบนกระดาษ) ----------

function ApprovalModal({ project, onClose, onSaved }) {
  const [form, setForm] = useState({
    approval_status: project.approval_status === 'draft' ? 'approved' : project.approval_status,
    approved_by: project.approved_by || '',
    approved_at: project.approved_at || new Date().toISOString().slice(0, 10),
  });
  const [file, setFile] = useState(null); // { name, data }
  const [saving, setSaving] = useState(false);

  function onFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast.error('ไฟล์ต้องไม่เกิน 5MB'); return; }
    const reader = new FileReader();
    reader.onload = () => setFile({ name: f.name, data: reader.result });
    reader.readAsDataURL(f);
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/training-projects/${project.id}/approval`, {
        ...form,
        approval_file: file?.data || null,
      });
      toast.success('บันทึกผลอนุมัติแล้ว');
      await onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4 font-body">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-ink-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100" style={{ background: '#FCEBEC' }}>
          <span className="font-semibold text-ink-900 font-display">บันทึกผลอนุมัติ</span>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          <label className="block text-sm">
            <span className="text-ink-700 font-medium">สถานะ</span>
            <select
              className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-300"
              value={form.approval_status}
              onChange={(e) => setForm((f) => ({ ...f, approval_status: e.target.value }))}
            >
              <option value="pending">รออนุมัติ (ส่ง Memo แล้ว)</option>
              <option value="approved">อนุมัติแล้ว</option>
              <option value="rejected">ไม่อนุมัติ</option>
              <option value="draft">กลับเป็นร่าง</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-ink-700 font-medium">ผู้อนุมัติ</span>
              <input
                className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-300"
                value={form.approved_by}
                onChange={(e) => setForm((f) => ({ ...f, approved_by: e.target.value }))}
                placeholder="เช่น กรรมการผู้จัดการ"
              />
            </label>
            <label className="block text-sm">
              <span className="text-ink-700 font-medium">วันที่</span>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-300"
                value={form.approved_at || ''}
                onChange={(e) => setForm((f) => ({ ...f, approved_at: e.target.value }))}
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-ink-700 font-medium">แนบสแกน Memo ที่เซ็นแล้ว (ถ้ามี)</span>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={onFileChange}
              className="mt-1 w-full text-xs text-ink-500 file:mr-2 file:rounded-lg file:border-0 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:bg-ink-100 file:text-ink-700 hover:file:bg-ink-200"
            />
            {file && <span className="mt-1 block text-xs text-ink-400">เลือกไฟล์: {file.name}</span>}
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-ink-600 hover:bg-ink-100 transition-colors">
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60"
              style={{ background: saving ? '#9B9491' : '#710F16' }}
            >
              {saving ? 'กำลังบันทึก…' : 'บันทึก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------- แก้ไขรายละเอียดโครงการ + ฟิลด์ใบขอ ----------

function EditProjectModal({ project, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: project.name || '',
    description: project.description || '',
    notes: project.notes || '',
    course_code: project.course_code || '',
    quarter: project.quarter || 'Q1',
    year: project.year || new Date().getFullYear() + 543,
    training_date: project.training_date || '',
    end_date: project.end_date || '',
    location: project.location || '',
    trainer_name: project.trainer_name || '',
    trainer_org: project.trainer_org || '',
    budget_instructor: project.budget_instructor || 0,
    budget_venue: project.budget_venue || 0,
    budget_food: project.budget_food || 0,
    budget_material: project.budget_material || 0,
    budget_other: project.budget_other || 0,
    objective: project.objective || '',
    target_group: project.target_group || '',
    success_quantitative: project.success_quantitative || '',
    success_qualitative: project.success_qualitative || '',
    competency_type: project.competency_type || '',
    delivery_type: project.delivery_type || 'inhouse',
  });
  const [courses, setCourses] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/courses').then(setCourses).catch(() => {});
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const budgetTotal =
    Number(form.budget_instructor) + Number(form.budget_venue) + Number(form.budget_food) +
    Number(form.budget_material) + Number(form.budget_other);

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('กรุณาระบุชื่อโครงการ'); return; }
    setSaving(true);
    try {
      await api.patch(`/training-projects/${project.id}/details`, {
        ...form,
        course_code: form.course_code || null,
        training_date: form.training_date || null,
        end_date: form.end_date || null,
      });
      toast.success('บันทึกรายละเอียดโครงการแล้ว');
      await onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-300';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4 font-body overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-ink-200 overflow-hidden my-8">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100" style={{ background: '#FCEBEC' }}>
          <span className="font-semibold text-ink-900 font-display">แก้ไขรายละเอียดโครงการ / ใบขออนุมัติ</span>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-sm sm:col-span-2">
              <span className="text-ink-700 font-medium">ชื่อโครงการ <span className="text-red-500">*</span></span>
              <input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="text-ink-700 font-medium">หลักสูตร (จากข้อมูลหลัก)</span>
              <select className={inputCls} value={form.course_code} onChange={(e) => set('course_code', e.target.value)}>
                <option value="">— ไม่ระบุ —</option>
                {courses.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name_th}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-ink-700 font-medium">ไตรมาส</span>
                <select className={inputCls} value={form.quarter} onChange={(e) => set('quarter', e.target.value)}>
                  {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => <option key={q} value={q}>{q}</option>)}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-ink-700 font-medium">ปี (พ.ศ.)</span>
                <input type="number" className={inputCls} value={form.year} onChange={(e) => set('year', Number(e.target.value))} />
              </label>
            </div>
            <label className="block text-sm">
              <span className="text-ink-700 font-medium">ประเภทตาม Competency</span>
              <select className={inputCls} value={form.competency_type} onChange={(e) => set('competency_type', e.target.value)}>
                <option value="">— ไม่ระบุ —</option>
                {Object.entries(COMPETENCY_TYPES).map(([value, cfg]) => (
                  <option key={value} value={value}>{cfg.label} — {cfg.desc}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-ink-700 font-medium">รูปแบบการจัด</span>
              <select className={inputCls} value={form.delivery_type} onChange={(e) => set('delivery_type', e.target.value)}>
                {Object.entries(DELIVERY_TYPES).map(([value, cfg]) => (
                  <option key={value} value={value}>{cfg.label} — {cfg.desc}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="border-t border-ink-100 pt-3">
            <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2">กำหนดการและสถานที่</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-ink-700 font-medium">วันที่อบรม</span>
                <input type="date" className={inputCls} value={form.training_date} onChange={(e) => set('training_date', e.target.value)} />
              </label>
              <label className="block text-sm">
                <span className="text-ink-700 font-medium">ถึงวันที่</span>
                <input type="date" className={inputCls} value={form.end_date} onChange={(e) => set('end_date', e.target.value)} />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="text-ink-700 font-medium">สถานที่</span>
                <input className={inputCls} value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="เช่น ห้องประชุมใหญ่ ชั้น 5" />
              </label>
              <label className="block text-sm">
                <span className="text-ink-700 font-medium">วิทยากร</span>
                <input className={inputCls} value={form.trainer_name} onChange={(e) => set('trainer_name', e.target.value)} />
              </label>
              <label className="block text-sm">
                <span className="text-ink-700 font-medium">สังกัด/บริษัทวิทยากร</span>
                <input className={inputCls} value={form.trainer_org} onChange={(e) => set('trainer_org', e.target.value)} />
              </label>
            </div>
          </div>

          <div className="border-t border-ink-100 pt-3">
            <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2">
              งบประมาณ (รวม {budgetTotal.toLocaleString()} บาท)
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                ['budget_instructor', 'ค่าวิทยากร'],
                ['budget_venue', 'ค่าสถานที่'],
                ['budget_food', 'ค่าอาหาร'],
                ['budget_material', 'ค่าเอกสาร/อุปกรณ์'],
                ['budget_other', 'อื่น ๆ'],
              ].map(([key, label]) => (
                <label key={key} className="block text-sm">
                  <span className="text-ink-700 font-medium">{label}</span>
                  <input type="number" min="0" className={inputCls} value={form[key]} onChange={(e) => set(key, e.target.value)} />
                </label>
              ))}
            </div>
          </div>

          <div className="border-t border-ink-100 pt-3 space-y-3">
            <label className="block text-sm">
              <span className="text-ink-700 font-medium">วัตถุประสงค์</span>
              <textarea className={`${inputCls} resize-none`} rows={2} value={form.objective} onChange={(e) => set('objective', e.target.value)} />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-ink-700 font-medium">การวัดผลเชิงปริมาณ (Quantitative)</span>
                <textarea className={`${inputCls} resize-none`} rows={3} value={form.success_quantitative} onChange={(e) => set('success_quantitative', e.target.value)} placeholder="เช่น อัตราการเข้าเรียนไม่น้อยกว่า 80%" />
              </label>
              <label className="block text-sm">
                <span className="text-ink-700 font-medium">การวัดผลเชิงคุณภาพ (Qualitative)</span>
                <textarea className={`${inputCls} resize-none`} rows={3} value={form.success_qualitative} onChange={(e) => set('success_qualitative', e.target.value)} placeholder="เช่น ผลประเมินความพึงพอใจไม่ต่ำกว่า 80%" />
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-ink-700 font-medium">กลุ่มเป้าหมาย</span>
                <input className={inputCls} value={form.target_group} onChange={(e) => set('target_group', e.target.value)} />
              </label>
              <label className="block text-sm">
                <span className="text-ink-700 font-medium">หมายเหตุ</span>
                <input className={inputCls} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
              </label>
            </div>
            <label className="block text-sm">
              <span className="text-ink-700 font-medium">คำอธิบายโครงการ</span>
              <textarea className={`${inputCls} resize-none`} rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-ink-600 hover:bg-ink-100 transition-colors">
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60"
              style={{ background: saving ? '#9B9491' : '#710F16' }}
            >
              {saving ? 'กำลังบันทึก…' : 'บันทึก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------- ยื่น ยป. กรมพัฒนาฝีมือแรงงาน (เฉพาะหลักสูตร send_to_dsd) ----------

// จำนวนวันจากวันนี้ถึง iso date (ลบ = เลยกำหนดแล้ว) — เทียบแบบ UTC วันล้วน
function daysUntil(iso) {
  if (!iso) return null;
  const t = new Date();
  const today = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate());
  return Math.round((new Date(iso + 'T00:00:00Z').getTime() - today) / 86400000);
}

function DsdChecklistCard({ project, status, onChanged }) {
  const [saving, setSaving] = useState(false);
  const dsd = status?.dsd;
  if (!dsd?.required) return null;

  async function patch(fields) {
    setSaving(true);
    try {
      await api.patch(`/training-projects/${project.id}/details`, fields);
      await onChanged();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  // ป้ายสถานะ/นับถอยหลัง: เห็นชอบ > ยื่นแล้ว > นับวันถึง deadline
  const days = daysUntil(dsd.deadline);
  let badge;
  if (dsd.approved) badge = { bg: '#DCFCE7', color: '#166534', label: 'กรมฯ เห็นชอบแล้ว' };
  else if (dsd.submitted) badge = { bg: '#DBEAFE', color: '#1E40AF', label: 'ยื่นแล้ว — รอเห็นชอบ' };
  else if (days == null) badge = { bg: '#F1EDEC', color: '#7A716D', label: 'ยังไม่มีวันอบรม — ยังคำนวณกำหนดยื่นไม่ได้' };
  else if (days < 0) badge = { bg: '#FEE2E2', color: '#991B1B', label: `เลยกำหนดยื่นมา ${-days} วัน` };
  else if (days <= 14) badge = { bg: '#FEF3C7', color: '#92400E', label: `เหลือ ${days} วันถึงกำหนดยื่น` };
  else badge = { bg: '#F1EDEC', color: '#57514E', label: `เหลือ ${days} วันถึงกำหนดยื่น` };

  const AutoItem = ({ ok, label, fixHint }) => (
    <div className="flex items-start gap-2 text-sm">
      {ok
        ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#16A34A' }} />
        : <CircleAlert className="w-4 h-4 mt-0.5 shrink-0" style={{ color: '#D97706' }} />}
      <span className={ok ? 'text-ink-700' : 'text-ink-500'}>
        {label}
        {!ok && fixHint && <span className="block text-xs text-ink-400">{fixHint}</span>}
      </span>
    </div>
  );

  return (
    <div className="rounded-2xl border border-ink-200 p-4 space-y-3" style={{ background: '#FAF7F6' }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Landmark className="w-4 h-4 text-ink-400" />
          <span className="text-sm font-semibold text-ink-800 font-display">ยื่น ยป. กรมพัฒนาฝีมือแรงงาน</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.color }}>
            {badge.label}
          </span>
        </div>
        <label className="flex items-center gap-2 text-xs text-ink-500">
          กำหนดยื่น{dsd.deadline_overridden ? '' : ' (อัตโนมัติ: วันอบรม − 30 วัน)'}
          <input
            type="date"
            className="rounded-lg border border-ink-200 px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-maroon-300"
            value={dsd.deadline || ''}
            disabled={saving}
            onChange={(e) => patch({ dsd_deadline: e.target.value || null })}
          />
          {dsd.deadline_overridden && (
            <button
              onClick={() => patch({ dsd_deadline: null })}
              disabled={saving}
              className="underline underline-offset-2 hover:text-ink-800"
              title="กลับไปใช้วันอบรม − 30 วัน"
            >
              ใช้อัตโนมัติ
            </button>
          )}
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 border-t border-ink-100 pt-3">
        <AutoItem
          ok={dsd.proposal_ready}
          label="ข้อมูล Training Proposal ครบ (วัตถุประสงค์ / กลุ่มเป้าหมาย / สถานที่ / การวัดผล)"
          fixHint='กรอกได้ที่ปุ่ม "แก้ไขรายละเอียด" ด้านบน'
        />
        <AutoItem
          ok={dsd.schedule_ready}
          label={(
            <>กำหนดการบันทึกแล้ว{!dsd.schedule_ready && (
              <> — <Link to={`/development/workflow/${project.id}/schedule`} className="underline underline-offset-2">ไปหน้ากำหนดการ</Link></>
            )}</>
          )}
        />
        <label className="flex items-start gap-2 text-sm text-ink-700 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={dsd.submitted}
            disabled={saving}
            onChange={(e) => patch({ dsd_submitted: e.target.checked })}
          />
          กรอกยื่นบนเว็บกรมฯ แล้ว
        </label>
        <label className="flex items-start gap-2 text-sm text-ink-700 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={dsd.approved}
            disabled={saving}
            onChange={(e) => patch({ dsd_approved: e.target.checked })}
          />
          กรมฯ เห็นชอบแล้ว
        </label>
      </div>
    </div>
  );
}

// ---------- หน้า index ของโครงการ (ใต้ ProjectShell) ----------

export default function WorkflowDetailPage() {
  const { project, status, reload, projectId } = useProject();
  const navigate = useNavigate();
  const [showEdit, setShowEdit] = useState(false);
  const [showApproval, setShowApproval] = useState(false);
  const [exporting, setExporting] = useState(false);

  // DOCX 2 หน้า: Training Proposal + กำหนดการ — fill template บริษัทจริงฝั่ง server
  // (ผู้ใช้เปิด/แปลง PDF เองด้วย Word หรือ LibreOffice บนเครื่อง)
  async function exportProposal() {
    setExporting(true);
    try {
      const sched = await api.get(`/training-projects/${project.id}/schedule`);
      await api.download(
        `/training-projects/${project.id}/export-proposal-docx`,
        buildDocExportPayload(sched),
        `Training-Proposal-${project.req_no || project.id}.docx`,
      );
    } catch (e) {
      toast.error(e.message, { duration: 8000 });
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`ลบโครงการ "${project.name}" ?\nการกระทำนี้ไม่สามารถย้อนกลับได้`)) return;
    try {
      await api.del(`/training-projects/${project.id}`);
      toast.success('ลบโครงการแล้ว');
      navigate('/development/workflow');
    } catch (err) {
      toast.error(err.message);
    }
  }

  const preset = buildProjectPreset(project);
  const badge = APPROVAL_BADGE[project.approval_status] ?? APPROVAL_BADGE.draft;
  const budgetTotal =
    (project.budget_instructor || 0) + (project.budget_venue || 0) + (project.budget_food || 0) +
    (project.budget_material || 0) + (project.budget_other || 0);

  return (
    <div className="space-y-5 font-body">
      {(project.description || project.notes) && (
        <div>
          {project.description && (
            <p className="text-sm text-ink-600 whitespace-pre-wrap">{project.description}</p>
          )}
          {project.notes && (
            <p className="text-xs text-ink-400 mt-1.5 whitespace-pre-wrap">หมายเหตุ: {project.notes}</p>
          )}
        </div>
      )}

      {/* Hub-and-satellite diagram — สี satellite มาจากสถานะงานจริง;
          โครงการ Public ซ่อน satellite ที่ไม่เกี่ยว (หาวัน/ลงทะเบียน) */}
      <HubSatelliteGraph preset={preset} projectId={projectId} status={status} delivery={project.delivery_type} />

      {/* ใบขออนุมัติในตัวโครงการ */}
      <div className="rounded-2xl border border-ink-200 p-4 space-y-3" style={{ background: '#FAF7F6' }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Stamp className="w-4 h-4 text-ink-400" />
            <span className="text-sm font-semibold text-ink-800 font-display">ใบขออนุมัติ {project.req_no}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.color }}>
              {badge.label}
            </span>
            {project.approval_status === 'approved' && project.approved_by && (
              <span className="text-xs text-ink-400">
                โดย {project.approved_by}{project.approved_at ? ` · ${project.approved_at}` : ''}
              </span>
            )}
            {project.approval_file && (
              <a
                href={project.approval_file}
                download={`memo-approved-${project.req_no || project.id}`}
                className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-800 underline underline-offset-2"
              >
                <Paperclip className="w-3 h-3" /> ไฟล์แนบ
              </a>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportProposal}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-ink-600 hover:bg-ink-100 border border-ink-200 transition-colors disabled:opacity-50"
              title="DOCX หน้า 1 Training Proposal + หน้า 2 กำหนดการอบรม (เปิด/พิมพ์ด้วย Word หรือ LibreOffice)"
            >
              <FileDown className="w-3.5 h-3.5" /> {exporting ? 'กำลังสร้าง…' : 'Proposal + กำหนดการ (DOCX)'}
            </button>
            <button
              onClick={() => setShowApproval(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: '#710F16' }}
            >
              <Stamp className="w-3.5 h-3.5" /> บันทึกผลอนุมัติ
            </button>
            <button
              onClick={() => setShowEdit(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-ink-600 hover:bg-ink-100 border border-ink-200 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" /> แก้ไขรายละเอียด
            </button>
          </div>
        </div>

        {/* ข้อมูลที่ Training Proposal ต้องใช้ยังไม่ครบ — ชี้ช่องที่ขาดให้ตรง ๆ
            (แสดงทุกโครงการ ไม่เฉพาะ DSD จะได้ไม่ต้องไล่เดาใน mega-form) */}
        {(() => {
          const missing = [
            [!String(project.objective || '').trim(), 'วัตถุประสงค์'],
            [!String(project.target_group || '').trim(), 'กลุ่มเป้าหมาย'],
            [!String(project.location || '').trim(), 'สถานที่'],
            [!String(project.success_quantitative || '').trim() && !String(project.success_qualitative || '').trim(), 'การวัดผล (ปริมาณหรือคุณภาพ อย่างน้อย 1 ช่อง)'],
          ].filter(([m]) => m).map(([, label]) => label);
          if (!missing.length) return null;
          return (
            <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: '#FEF3C7', color: '#92400E' }}>
              <CircleAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                ข้อมูลใบขอยังไม่ครบสำหรับเอกสาร Training Proposal — ขาด: <b>{missing.join(', ')}</b>{' '}
                (กรอกได้ที่ปุ่ม "แก้ไขรายละเอียด")
              </span>
            </div>
          );
        })()}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm border-t border-ink-100 pt-3">
          <div>
            <p className="text-xs text-ink-400">วันที่อบรม</p>
            <p className="text-ink-800">{project.training_date || '—'}{project.end_date && project.end_date !== project.training_date ? ` – ${project.end_date}` : ''}</p>
          </div>
          <div>
            <p className="text-xs text-ink-400">สถานที่</p>
            <p className="text-ink-800">{project.location || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-ink-400">วิทยากร</p>
            <p className="text-ink-800">{project.trainer_name || '—'}{project.trainer_org ? ` (${project.trainer_org})` : ''}</p>
          </div>
          <div>
            <p className="text-xs text-ink-400">งบประมาณรวม</p>
            <p className="text-ink-800">{budgetTotal ? `${budgetTotal.toLocaleString()} บาท` : '—'}</p>
          </div>
          {project.objective && (
            <div className="col-span-2 sm:col-span-4">
              <p className="text-xs text-ink-400">วัตถุประสงค์</p>
              <p className="text-ink-800 whitespace-pre-wrap">{project.objective}</p>
            </div>
          )}
          {(project.success_quantitative || project.success_qualitative) && (
            <div className="col-span-2 sm:col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {project.success_quantitative && (
                <div>
                  <p className="text-xs text-ink-400">การวัดผลเชิงปริมาณ</p>
                  <p className="text-ink-800 whitespace-pre-wrap">{project.success_quantitative}</p>
                </div>
              )}
              {project.success_qualitative && (
                <div>
                  <p className="text-xs text-ink-400">การวัดผลเชิงคุณภาพ</p>
                  <p className="text-ink-800 whitespace-pre-wrap">{project.success_qualitative}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ยื่น ยป. กรมพัฒนาฝีมือแรงงาน — เฉพาะหลักสูตรที่ติ๊ก ส่ง กพร. */}
      <DsdChecklistCard project={project} status={status} onChanged={reload} />

      {/* Step controls */}
      <div className="rounded-2xl border border-ink-200 p-4 space-y-3" style={{ background: '#FAF7F6' }}>
        <StepNavigator project={project} status={status} onChanged={reload} />

        <div className="flex justify-end border-t border-ink-100 pt-3">
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-ink-400 hover:text-red-600 hover:bg-red-50 transition-colors font-body"
          >
            <Trash2 className="w-3.5 h-3.5" /> ลบโครงการนี้
          </button>
        </div>
      </div>

      {showEdit && (
        <EditProjectModal project={project} onClose={() => setShowEdit(false)} onSaved={reload} />
      )}
      {showApproval && (
        <ApprovalModal project={project} onClose={() => setShowApproval(false)} onSaved={reload} />
      )}
    </div>
  );
}
