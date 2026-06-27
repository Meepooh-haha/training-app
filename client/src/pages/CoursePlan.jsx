import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeft, RefreshCw, Pencil, Plus, Calendar } from 'lucide-react';
import { api } from '../lib/api.js';
import { useUnsavedPrompt } from '../lib/useUnsavedPrompt.js';
import DataGrid from '../components/DataGrid.jsx';
import { Field, Input, Select, Textarea, Button, Card, Badge } from '../components/ui.jsx';
import { MODE_LABELS, addMinutes, fmtDuration, computeSchedule } from '../lib/coursePlanUtils.js';
import TopicRow from './CoursePlanTopicRow.jsx';

// ───────────────────────────────────────────────
// Default empty plan state
// ───────────────────────────────────────────────
const EMPTY = {
  plan_name: '',
  course_code: '',
  date_mode: 'single',
  start_date: '',
  daily_start_time: '09:00',
  hours_per_day: 6,
  notes: '',
  topics: [],
};

// ───────────────────────────────────────────────
// Main component
// ───────────────────────────────────────────────
export default function CoursePlan() {
  const [plans, setPlans] = useState([]);
  const [courses, setCourses] = useState([]);
  const [view, setView] = useState('list');
  const [plan, setPlan] = useState(EMPTY);
  const [planId, setPlanId] = useState(null);
  const [errors, setErrors] = useState({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useUnsavedPrompt(dirty);

  const loadList = () => api.get('/plans').then(setPlans).catch((e) => toast.error(e.message));
  useEffect(() => {
    loadList();
    api.get('/courses').then(setCourses).catch(() => {});
  }, []);

  const setField = (k, v) => {
    setPlan((p) => ({ ...p, [k]: v }));
    setDirty(true);
  };

  // When mode or settings change, recompute schedule (non-separate modes auto-fill dates/times)
  const recompute = useCallback((updatedPlan) => {
    const p = updatedPlan || plan;
    const recalculated = computeSchedule(p.topics, p.date_mode, p);
    setPlan((prev) => ({ ...prev, ...p, topics: recalculated }));
  }, [plan]);

  // ── Course selection: load topics from master data ──
  async function onCourseChange(code) {
    setField('course_code', code);
    if (!code) {
      setPlan((p) => ({ ...p, course_code: code, topics: [] }));
      return;
    }
    try {
      const full = await api.get(`/courses/${code}`);
      // Pull topic details (duration) from the training_topics master
      const topicsRaw = await api.get('/topics');
      const topicMap = Object.fromEntries(topicsRaw.map((t) => [t.code, t]));

      const topics = (full.topics || [])
        .sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
        .map((ct, i) => {
          const master = topicMap[ct.topic_code] || {};
          const dur = (Number(master.duration_hours) || 0) * 60 + (Number(master.duration_minutes) || 0);
          return {
            topic_code: ct.topic_code || '',
            topic_name: master.name_th || ct.topic_code || `หัวข้อ ${i + 1}`,
            sequence: ct.sequence ?? i + 1,
            duration_minutes: dur || Number(ct.duration) || 0,
            date: '',
            start_time: '',
            end_time: '',
          };
        });

      const next = { ...plan, course_code: code, topics };
      const computed = computeSchedule(topics, next.date_mode, next);
      setPlan({ ...next, topics: computed });
      setDirty(true);
    } catch (e) {
      toast.error(e.message);
    }
  }

  // ── Date mode / settings change → auto recompute ──
  function onModeOrSettingChange(k, v) {
    setPlan((prev) => {
      const next = { ...prev, [k]: v };
      next.topics = computeSchedule(prev.topics, next.date_mode, next);
      return next;
    });
    setDirty(true);
  }

  // ── Add manual topic row ──
  function addTopic() {
    setPlan((prev) => ({
      ...prev,
      topics: [
        ...prev.topics,
        { topic_code: '', topic_name: '', sequence: prev.topics.length + 1, duration_minutes: 60, date: '', start_time: '', end_time: '' },
      ],
    }));
    setDirty(true);
  }

  // ── Update individual topic row ──
  function updTopic(i, k, v) {
    setPlan((prev) => {
      const topics = prev.topics.map((t, idx) => {
        if (idx !== i) return t;
        const updated = { ...t, [k]: v };
        // In all modes, recalculate end_time when start_time or duration changes
        if (k === 'start_time' || k === 'duration_minutes') {
          updated.end_time = updated.start_time ? addMinutes(updated.start_time, updated.duration_minutes) : '';
        }
        return updated;
      });
      return { ...prev, topics };
    });
    setDirty(true);
  }

  function delTopic(i) {
    setPlan((prev) => ({ ...prev, topics: prev.topics.filter((_, idx) => idx !== i) }));
    setDirty(true);
  }

  // ── Open new / edit ──
  function openNew() {
    setPlan(EMPTY);
    setPlanId(null);
    setErrors({});
    setDirty(false);
    setView('form');
  }

  async function openEdit(row) {
    setErrors({});
    try {
      const full = await api.get(`/plans/${row.id}`);
      setPlan({ ...EMPTY, ...full });
      setPlanId(full.id);
      setDirty(false);
      setView('form');
    } catch (e) {
      toast.error(e.message);
    }
  }

  // ── Save ──
  async function save() {
    const errs = {};
    if (!plan.plan_name.trim()) errs.plan_name = true;
    if (!plan.course_code) errs.course_code = true;
    setErrors(errs);
    if (Object.keys(errs).length) return toast.error('กรุณากรอกชื่อแผนและเลือกหลักสูตร');
    setSaving(true);
    try {
      if (planId) {
        await api.put(`/plans/${planId}`, plan);
      } else {
        const res = await api.post('/plans', plan);
        setPlanId(res.id);
      }
      setDirty(false);
      toast.success('บันทึกแผนการจัดอบรมสำเร็จ');
      loadList();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(row) {
    if (!confirm(`ลบแผน "${row.plan_name}" ?`)) return;
    try {
      await api.del(`/plans/${row.id}`);
      toast.success('ลบสำเร็จ');
      loadList();
    } catch (e) {
      toast.error(e.message);
    }
  }

  function back() {
    if (dirty && !confirm('มีการแก้ไขที่ยังไม่บันทึก ต้องการออกหรือไม่?')) return;
    setView('list');
    setDirty(false);
  }

  // ── Totals ──
  const totalMins = plan.topics.reduce((s, t) => s + (Number(t.duration_minutes) || 0), 0);
  const uniqueDates = [...new Set(plan.topics.map((t) => t.date).filter(Boolean))];

  // ─────────────── LIST VIEW ───────────────
  if (view === 'list') {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">กำหนดหลักสูตร</h1>
          <p className="text-sm text-slate-500">วางแผนตารางการจัดอบรม ก่อนยื่นขออนุมัติ</p>
        </div>
        <DataGrid
          title="แผนการจัดอบรม"
          rows={plans}
          newLabel="สร้างแผน"
          searchKeys={['plan_name', 'course_name_th']}
          onNew={openNew}
          onEdit={openEdit}
          onDelete={remove}
          columns={[
            { key: 'plan_name', header: 'ชื่อแผน', className: 'font-medium' },
            { key: 'course_name_th', header: 'หลักสูตร' },
            {
              key: 'date_mode',
              header: 'รูปแบบวัน',
              render: (r) => {
                const colors = { single: 'slate', consecutive: 'blue', separate: 'amber' };
                return <Badge color={colors[r.date_mode]}>{MODE_LABELS[r.date_mode] || r.date_mode}</Badge>;
              },
            },
            { key: 'start_date', header: 'วันเริ่มต้น' },
            { key: 'topic_count', header: 'หัวข้อ', render: (r) => `${r.topic_count} หัวข้อ` },
            { key: 'created_at', header: 'สร้างเมื่อ' },
          ]}
        />
      </div>
    );
  }

  // ─────────────── FORM VIEW ───────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={back}>
            <ArrowLeft size={16} /> กลับ
          </Button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">
              {planId ? `แผน: ${plan.plan_name}` : 'สร้างแผนการจัดอบรม'}
            </h1>
            <p className="text-sm text-slate-500">กำหนดตารางเวลาและหัวข้ออบรม</p>
          </div>
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? 'กำลังบันทึก...' : 'บันทึกแผน'}
        </Button>
      </div>

      {/* General settings */}
      <Card className="p-5">
        <h2 className="mb-4 font-semibold text-slate-800">ข้อมูลทั่วไป</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="ชื่อแผนการจัดอบรม" required>
            <Input
              value={plan.plan_name}
              invalid={errors.plan_name}
              onChange={(e) => setField('plan_name', e.target.value)}
              placeholder="เช่น แผนอบรมประจำปี Q3"
            />
          </Field>
          <Field label="หลักสูตร" required>
            <Select value={plan.course_code} invalid={errors.course_code} onChange={(e) => onCourseChange(e.target.value)}>
              <option value="">— เลือกหลักสูตร —</option>
              {courses.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} · {c.name_th}
                </option>
              ))}
            </Select>
          </Field>
          <div className="sm:col-span-2 lg:col-span-1">
            <Field label="หมายเหตุ">
              <Input value={plan.notes} onChange={(e) => setField('notes', e.target.value)} />
            </Field>
          </div>
        </div>
      </Card>

      {/* Date mode selector */}
      <Card className="p-5">
        <h2 className="mb-4 font-semibold text-slate-800">รูปแบบวันที่จัดอบรม</h2>
        <div className="mb-5 flex flex-wrap gap-3">
          {[
            { key: 'single', label: 'วันเดียว', desc: 'ทุกหัวข้ออยู่ในวันเดียวกัน' },
            { key: 'consecutive', label: 'หลายวันติดกัน', desc: 'ต่อเนื่องหลายวัน คำนวณจากชั่วโมงต่อวัน' },
            { key: 'separate', label: 'หลายวันแยกกัน', desc: 'แต่ละหัวข้อกำหนดวันเองอิสระ' },
          ].map((m) => (
            <button
              key={m.key}
              onClick={() => onModeOrSettingChange('date_mode', m.key)}
              className={`flex flex-col items-start rounded-xl border-2 px-4 py-3 text-left transition-colors ${
                plan.date_mode === m.key
                  ? 'border-brand-600 bg-brand-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className={`text-sm font-semibold ${plan.date_mode === m.key ? 'text-brand-700' : 'text-slate-700'}`}>
                {m.label}
              </span>
              <span className="text-xs text-slate-400">{m.desc}</span>
            </button>
          ))}
        </div>

        {/* Mode-specific settings */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plan.date_mode === 'single' && (
            <>
              <Field label="วันที่จัดอบรม">
                <Input type="date" value={plan.start_date} onChange={(e) => onModeOrSettingChange('start_date', e.target.value)} />
              </Field>
              <Field label="เวลาเริ่มต้น">
                <Input type="time" value={plan.daily_start_time} onChange={(e) => onModeOrSettingChange('daily_start_time', e.target.value)} />
              </Field>
            </>
          )}
          {plan.date_mode === 'consecutive' && (
            <>
              <Field label="วันเริ่มต้น">
                <Input type="date" value={plan.start_date} onChange={(e) => onModeOrSettingChange('start_date', e.target.value)} />
              </Field>
              <Field label="เวลาเริ่มต้นแต่ละวัน">
                <Input type="time" value={plan.daily_start_time} onChange={(e) => onModeOrSettingChange('daily_start_time', e.target.value)} />
              </Field>
              <Field label="ชั่วโมงการอบรมต่อวัน">
                <Input
                  type="number"
                  min="1"
                  max="12"
                  step="0.5"
                  value={plan.hours_per_day}
                  onChange={(e) => onModeOrSettingChange('hours_per_day', e.target.value)}
                />
              </Field>
            </>
          )}
          {plan.date_mode === 'separate' && (
            <div className="col-span-full text-sm text-slate-500">
              กำหนดวันที่และเวลาของแต่ละหัวข้อในตารางด้านล่างได้เลย
            </div>
          )}
        </div>

        {/* Recompute button (for single/consecutive) */}
        {plan.date_mode !== 'separate' && (
          <div className="mt-3 flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => recompute()}>
              <RefreshCw size={14} /> คำนวณตารางใหม่
            </Button>
          </div>
        )}
      </Card>

      {/* Schedule grid */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <div>
            <h2 className="font-semibold text-slate-800">ตารางหัวข้ออบรม</h2>
            <p className="text-xs text-slate-400">
              {plan.topics.length} หัวข้อ · รวม {fmtDuration(totalMins)}
              {uniqueDates.length > 0 && ` · ${uniqueDates.length} วัน`}
            </p>
          </div>
          <Button size="sm" variant="subtle" onClick={addTopic}>
            <Plus size={14} /> เพิ่มหัวข้อ
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="w-10 px-3 py-2.5 font-medium">ลำดับ</th>
                <th className="px-3 py-2.5 font-medium">หัวข้ออบรม</th>
                <th className="w-28 px-3 py-2.5 font-medium">ระยะเวลา</th>
                <th className="w-36 px-3 py-2.5 font-medium">วันที่</th>
                <th className="w-24 px-3 py-2.5 font-medium">เริ่ม</th>
                <th className="w-24 px-3 py-2.5 font-medium">สิ้นสุด</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {plan.topics.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-slate-400">
                    {plan.course_code
                      ? 'หลักสูตรนี้ยังไม่มีหัวข้ออบรมในระบบ — กดเพิ่มหัวข้อด้วยตนเอง'
                      : 'เลือกหลักสูตรเพื่อดึงหัวข้ออบรมมาอัตโนมัติ'}
                  </td>
                </tr>
              )}
              {plan.topics.map((t, i) => (
                <TopicRow
                  key={i}
                  topic={t}
                  mode={plan.date_mode}
                  onUpdate={(k, v) => updTopic(i, k, v)}
                  onDelete={() => delTopic(i)}
                />
              ))}
            </tbody>
            {plan.topics.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50">
                  <td colSpan={2} className="px-3 py-2.5 text-right text-xs font-medium text-slate-500">
                    รวม
                  </td>
                  <td className="px-3 py-2.5 text-xs font-semibold text-brand-700">{fmtDuration(totalMins)}</td>
                  <td colSpan={4} className="px-3 py-2.5 text-xs text-slate-400">
                    {uniqueDates.length > 0 && `จำนวน ${uniqueDates.length} วัน: ${uniqueDates.join(', ')}`}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </div>
  );
}

