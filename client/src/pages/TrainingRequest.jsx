import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, ArrowLeft, CalendarRange } from 'lucide-react';
import { api } from '../lib/api.js';
import { useUnsavedPrompt } from '../lib/useUnsavedPrompt.js';
import DataGrid from '../components/DataGrid.jsx';
import Modal from '../components/Modal.jsx';
import ExportButton from '../components/ExportButton.jsx';
import { Field, Input, Select, Textarea, Button, Badge, STATUS_META } from '../components/ui.jsx';
import { exportTrainingProposal, exportPRForm, exportMemo } from '../lib/pdf-generator.js';
import { Header, Section, InlineTable, Cell, DelCell } from './TrainingRequestHelpers.jsx';

const MODE_LABELS = { single: 'วันเดียว', consecutive: 'หลายวันติดกัน', separate: 'หลายวันแยกกัน' };

const EMPTY = {
  course_code: '', training_date: '', end_date: '', location: '', trainer_name: '', trainer_org: '',
  budget_instructor: 0, budget_venue: 0, budget_food: 0, budget_material: 0, budget_other: 0,
  attendee_count: 0, objective: '', target_group: '', status: 'draft', notes: '',
  attendees: [], schedule: [],
};

export default function TrainingRequest() {
  const [list, setList] = useState([]);
  const [courses, setCourses] = useState([]);
  const [view, setView] = useState('list'); // 'list' | 'form'
  const [form, setForm] = useState(EMPTY);
  const [reqId, setReqId] = useState(null);
  const [reqNo, setReqNo] = useState('');
  const [errors, setErrors] = useState({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [planModal, setPlanModal] = useState(false);
  const [plans, setPlans] = useState([]);

  useUnsavedPrompt(dirty);

  const load = () => api.get('/requests').then(setList).catch((e) => toast.error(e.message));
  useEffect(() => {
    load();
    api.get('/courses').then(setCourses).catch(() => {});
  }, []);

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };

  function openNew() {
    setForm(EMPTY);
    setReqId(null);
    setReqNo('');
    setErrors({});
    setDirty(false);
    setView('form');
  }
  async function openEdit(row) {
    try {
      const full = await api.get(`/requests/${row.id}`);
      setForm({ ...EMPTY, ...full });
      setReqId(full.id);
      setReqNo(full.req_no);
      setErrors({});
      setDirty(false);
      setView('form');
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function save() {
    const errs = {};
    if (!form.course_code) errs.course_code = true;
    if (!form.training_date) errs.training_date = true;
    setErrors(errs);
    if (Object.keys(errs).length) return toast.error('กรุณาเลือกหลักสูตรและวันที่อบรม');
    setSaving(true);
    try {
      if (reqId) {
        await api.put(`/requests/${reqId}`, form);
      } else {
        const res = await api.post('/requests', form);
        setReqId(res.id);
        const created = await api.get(`/requests/${res.id}`);
        setReqNo(created.req_no);
      }
      setDirty(false);
      toast.success('บันทึกสำเร็จ');
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(row) {
    if (!confirm(`ลบคำขอ ${row.req_no} ?`)) return;
    try {
      await api.del(`/requests/${row.id}`);
      toast.success('ลบสำเร็จ');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  function back() {
    if (dirty && !confirm('มีการแก้ไขที่ยังไม่บันทึก ต้องการออกหรือไม่?')) return;
    setView('list');
    setDirty(false);
  }

  // When course changes: auto-populate schedule from course topics, suggest existing plans
  async function onCourseChange(code) {
    if (!code) {
      setForm((f) => ({ ...f, course_code: '' }));
      setDirty(true);
      return;
    }
    try {
      const full = await api.get(`/courses/${code}`);
      const topicRows = (full.topics || [])
        .sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
        .map((t) => ({
          date: form.training_date || '',
          start_time: '',
          end_time: '',
          topic: t.topic_name_th || t.topic_code || '',
          trainer: form.trainer_name || '',
        }));

      setForm((f) => {
        // If schedule already has rows, ask before overwriting
        if (f.schedule.length > 0) {
          if (!confirm('ต้องการแทนที่กำหนดการด้วยหัวข้ออบรมจากหลักสูตรที่เลือกใหม่หรือไม่?')) {
            return { ...f, course_code: code };
          }
        }
        return { ...f, course_code: code, schedule: topicRows };
      });
      setDirty(true);

      // Show hint if plans already exist for this course
      const allPlans = await api.get('/plans');
      const matching = allPlans.filter((p) => p.course_code === code);
      if (matching.length > 0) {
        toast(`มีแผนการจัดอบรมสำหรับหลักสูตรนี้ ${matching.length} แผน — กด "เลือกจากแผน" เพื่อใช้วันที่และเวลาที่คำนวณไว้แล้ว`, { icon: '📅', duration: 5000 });
      }
    } catch (e) {
      setForm((f) => ({ ...f, course_code: code }));
      setDirty(true);
    }
  }

  // sub-grids
  const addAtt = () => set('attendees', [...form.attendees, { employee_id: '', name: '', department: '', position: '' }]);
  const updAtt = (i, k, v) => set('attendees', form.attendees.map((a, idx) => (idx === i ? { ...a, [k]: v } : a)));
  const delAtt = (i) => set('attendees', form.attendees.filter((_, idx) => idx !== i));

  const addSch = () => set('schedule', [...form.schedule, { date: form.training_date, start_time: '', end_time: '', topic: '', trainer: form.trainer_name }]);
  const updSch = (i, k, v) => set('schedule', form.schedule.map((s, idx) => (idx === i ? { ...s, [k]: v } : s)));
  const delSch = (i) => set('schedule', form.schedule.filter((_, idx) => idx !== i));

  async function openPlanModal() {
    try {
      const data = await api.get('/plans');
      setPlans(data);
      setPlanModal(true);
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function importFromPlan(planRow) {
    try {
      const full = await api.get(`/plans/${planRow.id}`);
      const scheduleRows = (full.topics || []).map((t) => ({
        date: t.date || '',
        start_time: t.start_time || '',
        end_time: t.end_time || '',
        topic: t.topic_name || '',
        trainer: form.trainer_name || '',
      }));
      // Auto-fill course + dates from plan if not already set
      const earliest = (full.topics || []).map((t) => t.date).filter(Boolean).sort()[0] || '';
      const latest = (full.topics || []).map((t) => t.date).filter(Boolean).sort().reverse()[0] || '';
      setForm((f) => ({
        ...f,
        schedule: scheduleRows,
        course_code: f.course_code || full.course_code || '',
        training_date: f.training_date || earliest,
        end_date: f.end_date || latest,
      }));
      setDirty(true);
      setPlanModal(false);
      toast.success(`นำเข้าแผน "${planRow.plan_name}" สำเร็จ (${scheduleRows.length} หัวข้อ)`);
    } catch (e) {
      toast.error(e.message);
    }
  }

  const course = courses.find((c) => c.code === form.course_code);
  const budgetTotal =
    Number(form.budget_instructor || 0) + Number(form.budget_venue || 0) + Number(form.budget_food || 0) +
    Number(form.budget_material || 0) + Number(form.budget_other || 0);

  async function exportDoc(kind) {
    if (dirty) return toast.error('กรุณาบันทึกก่อนพิมพ์เอกสาร');
    const data = { ...form, req_no: reqNo };
    try {
      if (kind === 'proposal') await exportTrainingProposal(data, course);
      if (kind === 'pr') await exportPRForm(data, course);
      if (kind === 'memo') await exportMemo(data, course);
    } catch (e) {
      toast.error(e.message, { duration: 8000 });
    }
  }

  if (view === 'list') {
    return (
      <div className="space-y-5">
        <Header title="ขออนุมัติอบรม" subtitle="สร้างและจัดการคำขออนุมัติการฝึกอบรม" />
        <DataGrid
          title="รายการคำขออบรม"
          rows={list}
          newLabel="สร้างคำขอ"
          searchKeys={['req_no', 'course_name_th', 'location']}
          onNew={openNew}
          onEdit={openEdit}
          onDelete={remove}
          excel={{
            filename: 'training-requests',
            map: (r) => ({ เลขที่: r.req_no, หลักสูตร: r.course_name_th, วันที่: r.training_date, สถานที่: r.location, จำนวน: r.attendee_count, สถานะ: STATUS_META[r.status]?.label }),
          }}
          columns={[
            { key: 'req_no', header: 'เลขที่', className: 'font-medium' },
            { key: 'course_name_th', header: 'หลักสูตร' },
            { key: 'training_date', header: 'วันที่อบรม' },
            { key: 'attendee_count', header: 'ผู้เข้าอบรม', render: (r) => `${r.attendee_count} คน` },
            { key: 'status', header: 'สถานะ', render: (r) => <Badge color={STATUS_META[r.status]?.color}>{STATUS_META[r.status]?.label}</Badge> },
          ]}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={back}>
            <ArrowLeft size={16} /> กลับ
          </Button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">{reqId ? `คำขอ ${reqNo}` : 'สร้างคำขออบรมใหม่'}</h1>
            {reqId && <span className="text-sm text-slate-500">แก้ไขข้อมูลคำขอ</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <ExportButton
            disabled={!reqId}
            actions={[
              { label: 'Training Proposal', onClick: () => exportDoc('proposal') },
              { label: 'ใบ PR (PR Form)', onClick: () => exportDoc('pr') },
              { label: 'บันทึกข้อความ (Memo)', onClick: () => exportDoc('memo') },
            ]}
          />
          <Button onClick={save} disabled={saving}>
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </div>
      </div>

      {/* General info */}
      <Section title="ข้อมูลทั่วไป">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="หลักสูตร" required>
            <Select value={form.course_code} invalid={errors.course_code} onChange={(e) => onCourseChange(e.target.value)}>
              <option value="">— เลือกหลักสูตร —</option>
              {courses.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} · {c.name_th}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="สถานะ">
            <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
              {Object.entries(STATUS_META).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="จำนวนผู้เข้าอบรม">
            <Input type="number" min="0" value={form.attendee_count} onChange={(e) => set('attendee_count', e.target.value)} />
          </Field>
          <Field label="วันที่เริ่มอบรม" required>
            <Input type="date" value={form.training_date} invalid={errors.training_date} onChange={(e) => set('training_date', e.target.value)} />
          </Field>
          <Field label="วันที่สิ้นสุด">
            <Input type="date" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} />
          </Field>
          <Field label="สถานที่">
            <Input value={form.location} onChange={(e) => set('location', e.target.value)} />
          </Field>
          <Field label="วิทยากร">
            <Input value={form.trainer_name} onChange={(e) => set('trainer_name', e.target.value)} />
          </Field>
          <Field label="หน่วยงานวิทยากร">
            <Input value={form.trainer_org} onChange={(e) => set('trainer_org', e.target.value)} />
          </Field>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="วัตถุประสงค์">
            <Textarea rows={2} value={form.objective} onChange={(e) => set('objective', e.target.value)} />
          </Field>
          <Field label="กลุ่มเป้าหมาย">
            <Textarea rows={2} value={form.target_group} onChange={(e) => set('target_group', e.target.value)} />
          </Field>
        </div>
      </Section>

      {/* Budget */}
      <Section title="คาดการณ์งบประมาณ">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {[
            ['budget_instructor', 'ค่าวิทยากร'],
            ['budget_venue', 'ค่าสถานที่'],
            ['budget_food', 'ค่าอาหาร'],
            ['budget_material', 'ค่าเอกสาร/วัสดุ'],
            ['budget_other', 'ค่าใช้จ่ายอื่นๆ'],
          ].map(([k, label]) => (
            <Field key={k} label={label}>
              <Input type="number" min="0" value={form[k]} onChange={(e) => set(k, e.target.value)} />
            </Field>
          ))}
        </div>
        <div className="mt-3 text-right text-sm font-medium text-slate-700">
          รวมงบประมาณ: <span className="text-brand-700">{budgetTotal.toLocaleString('th-TH')} บาท</span>
        </div>
      </Section>

      {/* Attendees */}
      <Section
        title="รายชื่อผู้เข้าอบรม"
        action={
          <Button size="sm" variant="subtle" onClick={addAtt}>
            <Plus size={14} /> เพิ่มผู้เข้าอบรม
          </Button>
        }
      >
        <InlineTable
          head={['รหัสพนักงาน', 'ชื่อ-นามสกุล', 'แผนก', 'ตำแหน่ง', '']}
          rows={form.attendees}
          empty="ยังไม่มีรายชื่อ"
          render={(a, i) => (
            <>
              <Cell><Input className="h-8" value={a.employee_id} onChange={(e) => updAtt(i, 'employee_id', e.target.value)} /></Cell>
              <Cell><Input className="h-8" value={a.name} onChange={(e) => updAtt(i, 'name', e.target.value)} /></Cell>
              <Cell><Input className="h-8" value={a.department} onChange={(e) => updAtt(i, 'department', e.target.value)} /></Cell>
              <Cell><Input className="h-8" value={a.position} onChange={(e) => updAtt(i, 'position', e.target.value)} /></Cell>
              <DelCell onClick={() => delAtt(i)} />
            </>
          )}
        />
      </Section>

      {/* Plan-import modal */}
      <Modal open={planModal} onClose={() => setPlanModal(false)} title="เลือกจากแผนการจัดอบรม">
        {plans.length === 0 ? (
          <p className="py-6 text-center text-slate-400">ยังไม่มีแผนการจัดอบรม — ไปสร้างที่เมนู "กำหนดหลักสูตร" ก่อน</p>
        ) : (
          <div className="space-y-2">
            {plans.map((p) => (
              <button
                key={p.id}
                onClick={() => importFromPlan(p)}
                className="flex w-full items-start gap-4 rounded-lg border border-slate-200 p-3 text-left hover:border-brand-400 hover:bg-brand-50"
              >
                <CalendarRange size={20} className="mt-0.5 shrink-0 text-brand-500" />
                <div>
                  <div className="font-medium text-slate-800">{p.plan_name}</div>
                  <div className="text-sm text-slate-500">
                    {p.course_name_th} · {MODE_LABELS[p.date_mode] || p.date_mode} · {p.topic_count} หัวข้อ
                    {p.start_date && ` · เริ่ม ${p.start_date}`}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </Modal>

      {/* Schedule */}
      <Section
        title="กำหนดการอบรม"
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={openPlanModal}>
              <CalendarRange size={14} /> เลือกจากแผน
            </Button>
            <Button size="sm" variant="subtle" onClick={addSch}>
              <Plus size={14} /> เพิ่มกำหนดการ
            </Button>
          </div>
        }
      >
        <InlineTable
          head={['วันที่', 'เริ่ม', 'สิ้นสุด', 'หัวข้อ', 'วิทยากร', '']}
          rows={form.schedule}
          empty="ยังไม่มีกำหนดการ"
          render={(s, i) => (
            <>
              <Cell><Input className="h-8" type="date" value={s.date} onChange={(e) => updSch(i, 'date', e.target.value)} /></Cell>
              <Cell><Input className="h-8" type="time" value={s.start_time} onChange={(e) => updSch(i, 'start_time', e.target.value)} /></Cell>
              <Cell><Input className="h-8" type="time" value={s.end_time} onChange={(e) => updSch(i, 'end_time', e.target.value)} /></Cell>
              <Cell><Input className="h-8" value={s.topic} onChange={(e) => updSch(i, 'topic', e.target.value)} /></Cell>
              <Cell><Input className="h-8" value={s.trainer} onChange={(e) => updSch(i, 'trainer', e.target.value)} /></Cell>
              <DelCell onClick={() => delSch(i)} />
            </>
          )}
        />
      </Section>
    </div>
  );
}

