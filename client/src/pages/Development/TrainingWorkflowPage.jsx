import { useState, useCallback, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, X } from 'lucide-react';
import { api } from '../../lib/api.js';
import { COMPETENCY_TYPES, DELIVERY_TYPES } from '../../config/projectTypes.jsx';
import RoadmapTrail from './RoadmapTrail.jsx';

// สร้างโครงการแบบ course-first: เลือกหลักสูตรจากข้อมูลหลัก → ชื่อโครงการ auto-fill
// ที่เหลือ (วันที่ งบ ผู้เข้าอบรม) ไปกรอกใน phase ของมันเอง
// Public = ส่งพนักงานไปเรียนข้างนอก: ตั้งชื่อคอร์สเองได้ + เลือกผู้ขอไปอบรมได้เลย
function NewProjectModal({ onClose, onCreated }) {
  const currentBE = new Date().getFullYear() + 543;
  const [form, setForm] = useState({
    course_code: '', name: '', quarter: 'Q1', year: currentBE,
    competency_type: '', delivery_type: 'inhouse',
  });
  const [nameTouched, setNameTouched] = useState(false);
  const [courses, setCourses] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [requesterCode, setRequesterCode] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/courses').then(setCourses).catch(() => {});
    api.get('/employees').then(setEmployees).catch(() => {});
  }, []);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function pickCourse(code) {
    const course = courses.find(c => c.code === code);
    setForm(f => ({
      ...f,
      course_code: code,
      // ชื่อโครงการตามหลักสูตรจนกว่าผู้ใช้จะแก้เอง
      name: nameTouched && f.name.trim() ? f.name : (course?.name_th || f.name),
      // ประเภท competency สืบทอดจากหลักสูตร (แก้ทับได้)
      competency_type: f.competency_type || course?.competency_type || '',
    }));
  }

  const filtered = search.trim()
    ? courses.filter(c =>
        (c.name_th || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.code || '').toLowerCase().includes(search.toLowerCase()))
    : courses;

  const isPublic = form.delivery_type === 'public';

  async function submit(e) {
    e.preventDefault();
    if (!form.course_code && !form.name.trim()) {
      toast.error(isPublic ? 'กรุณาระบุชื่อหลักสูตร/โครงการที่จะไปเรียน' : 'กรุณาเลือกหลักสูตร หรือระบุชื่อโครงการ');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/training-projects', form);
      // Public: เพิ่มพนักงานผู้ขอไปอบรมเข้ารายชื่อกลางให้เลย
      if (isPublic && requesterCode) {
        await api.post(`/training-projects/${res.id}/participants`, {
          participants: [{ employee_code: requesterCode }],
        }).catch(() => {});
      }
      toast.success(`สร้างโครงการแล้ว (${res.req_no})`);
      onCreated();
      onClose();
      navigate(`/development/workflow/${res.id}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-300';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4 font-body">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-ink-200 overflow-hidden">
        <div
          className="flex items-center justify-between px-5 py-4 border-b border-ink-100"
          style={{ background: '#FCEBEC' }}
        >
          <span className="font-semibold text-ink-900 font-display">เพิ่มโครงการฝึกอบรมใหม่</span>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* รูปแบบการจัด: In-house จัดเอง / Public ส่งไปเรียนข้างนอก */}
          <div className="block text-sm">
            <span className="text-ink-700 font-medium">1. รูปแบบการจัด</span>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {Object.entries(DELIVERY_TYPES).map(([value, cfg]) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => set('delivery_type', value)}
                  className="rounded-xl border px-3 py-2 text-left transition-colors"
                  style={form.delivery_type === value
                    ? { background: cfg.bg, borderColor: cfg.color, color: cfg.color }
                    : { borderColor: '#E4DEDC', color: '#78716E' }}
                >
                  <span className="block text-sm font-semibold">{cfg.label}</span>
                  <span className="block text-[10.5px] leading-snug mt-0.5 opacity-80">{cfg.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="block text-sm">
            <span className="text-ink-700 font-medium">
              2. เลือกหลักสูตร (จากข้อมูลหลัก){isPublic && <span className="font-normal text-ink-400"> — ไม่บังคับสำหรับ Public</span>}
            </span>
            <input
              className={inputCls}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อหรือรหัสหลักสูตร…"
            />
            <div className="mt-2 max-h-36 overflow-y-auto rounded-lg border border-ink-100 divide-y divide-ink-50">
              {filtered.length === 0 && (
                <p className="px-3 py-3 text-xs text-ink-400">
                  ไม่พบหลักสูตร — เพิ่มได้ที่ <Link to="/setup?tab=courses" className="underline underline-offset-2">ข้อมูลหลัก › หลักสูตร</Link>
                </p>
              )}
              {filtered.map(c => (
                <button
                  type="button"
                  key={c.code}
                  onClick={() => pickCourse(c.code)}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                    form.course_code === c.code ? 'font-semibold' : 'hover:bg-ink-50'
                  }`}
                  style={form.course_code === c.code ? { background: '#FCEBEC', color: '#710F16' } : undefined}
                >
                  <span className="font-mono text-xs text-ink-400 mr-1.5">{c.code}</span>
                  {c.name_th}
                </button>
              ))}
            </div>
          </div>

          <label className="block text-sm">
            <span className="text-ink-700 font-medium">3. ชื่อโครงการ</span>
            <input
              className={inputCls}
              value={form.name}
              onChange={e => { setNameTouched(true); set('name', e.target.value); }}
              placeholder={isPublic ? 'เช่น อบรม Excel ขั้นสูง (สถาบัน XYZ)' : 'auto จากหลักสูตรที่เลือก — แก้ได้'}
            />
          </label>

          <label className="block text-sm">
            <span className="text-ink-700 font-medium">4. ประเภทตาม Competency</span>
            <select
              className={inputCls}
              value={form.competency_type}
              onChange={e => set('competency_type', e.target.value)}
            >
              <option value="">— ไม่ระบุ —</option>
              {Object.entries(COMPETENCY_TYPES).map(([value, cfg]) => (
                <option key={value} value={value}>{cfg.label} — {cfg.desc}</option>
              ))}
            </select>
          </label>

          {isPublic && (
            <label className="block text-sm">
              <span className="text-ink-700 font-medium">ผู้ขอไปอบรม (เพิ่มเข้ารายชื่อให้เลย)</span>
              <select className={inputCls} value={requesterCode} onChange={e => setRequesterCode(e.target.value)}>
                <option value="">— เลือกทีหลังได้ —</option>
                {employees.map(emp => (
                  <option key={emp.code} value={emp.code}>{emp.full_name} ({emp.code}{emp.department ? ` · ${emp.department}` : ''})</option>
                ))}
              </select>
            </label>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-ink-700 font-medium">ไตรมาส</span>
              <select className={inputCls} value={form.quarter} onChange={e => set('quarter', e.target.value)}>
                {['Q1','Q2','Q3','Q4'].map(q => <option key={q} value={q}>{q}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-ink-700 font-medium">ปี (พ.ศ.)</span>
              <input type="number" className={inputCls} value={form.year} onChange={e => set('year', Number(e.target.value))} />
            </label>
          </div>

          <p className="text-xs text-ink-400">
            {isPublic
              ? 'เลขที่ใบขอออกให้อัตโนมัติ — Public ตัดขั้นตอนหาวัน/ลงทะเบียนออก เหลือ ขออนุมัติ-จ่ายเงิน → ไปเรียน → ประเมิน/บันทึกผล'
              : 'เลขที่ใบขออนุมัติจะออกให้อัตโนมัติ — วันอบรม งบประมาณ และผู้เข้าอบรม ไปกรอกในหน้าโครงการ'}
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-ink-600 hover:bg-ink-100 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60"
              style={{ background: saving ? '#9B9491' : '#710F16' }}
            >
              {saving ? 'กำลังบันทึก…' : 'สร้างโครงการ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TrainingWorkflowPage() {
  const [showForm,  setShowForm]  = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey(k => k + 1), []);

  return (
    <div className="space-y-5 font-body">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 font-display">Training Workflow</h1>
          <p className="text-sm text-ink-500 mt-0.5">แผนโครงการฝึกอบรมประจำปีตาม HR-SOP-003</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: '#710F16' }}
        >
          <Plus className="w-4 h-4" /> เพิ่มโครงการ
        </button>
      </div>

      <RoadmapTrail key={reloadKey} />

      {showForm && (
        <NewProjectModal onClose={() => setShowForm(false)} onCreated={reload} />
      )}
    </div>
  );
}
