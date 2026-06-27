import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../../lib/api.js';
import DataGrid from '../../components/DataGrid.jsx';
import Modal, { ModalFooter } from '../../components/Modal.jsx';
import { Field, Input, Select, Textarea, Button, Badge } from '../../components/ui.jsx';

const EMPTY = {
  code: '', name_th: '', name_en: '', category: '', type: 'ไม่ต่อเนื่อง',
  training_type: 'ฝึกยกระดับฝีมือแรงงาน', duration_hours: 0, duration_minutes: 0,
  send_to_dsd: false, detail: '', topics: [], prereqs: [], nexts: [],
};
const TRAINING_TYPES = ['ฝึกยกระดับฝีมือแรงงาน', 'ฝึกเตรียมเข้าทำงาน', 'ฝึกอาชีพเสริม'];
const FORM_TABS = ['ทั่วไป', 'หัวข้ออบรม', 'ควรอบรมก่อน', 'ควรอบรมต่อไป'];

export default function CoursesTab() {
  const [rows, setRows] = useState([]);
  const [topics, setTopics] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [ftab, setFtab] = useState(0);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const load = () => api.get('/courses').then(setRows).catch((e) => toast.error(e.message));
  useEffect(() => {
    load();
    api.get('/topics').then(setTopics).catch(() => {});
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function openNew() {
    setForm(EMPTY);
    setErrors({});
    setFtab(0);
    setEditing({ isNew: true });
  }
  async function openEdit(row) {
    setFtab(0);
    setErrors({});
    try {
      const full = await api.get(`/courses/${row.code}`);
      setForm({ ...EMPTY, ...full, send_to_dsd: !!full.send_to_dsd });
      setEditing({ isNew: false, code: row.code });
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function save() {
    const errs = {};
    if (!form.code.trim()) errs.code = true;
    if (!form.name_th.trim()) errs.name_th = true;
    setErrors(errs);
    if (Object.keys(errs).length) {
      setFtab(0);
      return toast.error('กรุณากรอกข้อมูลที่จำเป็น');
    }
    setSaving(true);
    try {
      if (editing.isNew) await api.post('/courses', form);
      else await api.put(`/courses/${editing.code}`, form);
      toast.success('บันทึกสำเร็จ');
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(row) {
    if (!confirm(`ลบหลักสูตร "${row.name_th}" ?`)) return;
    try {
      await api.del(`/courses/${row.code}`);
      toast.success('ลบสำเร็จ');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  // --- inline sub-grid helpers ---
  const addTopic = () => set('topics', [...form.topics, { topic_code: '', sequence: form.topics.length + 1, duration: 0 }]);
  const updTopic = (i, k, v) => set('topics', form.topics.map((t, idx) => (idx === i ? { ...t, [k]: v } : t)));
  const delTopic = (i) => set('topics', form.topics.filter((_, idx) => idx !== i));

  const addRel = (field) => set(field, [...form[field], { related_course_code: '' }]);
  const updRel = (field, i, v) => set(field, form[field].map((r, idx) => (idx === i ? { ...r, related_course_code: v } : r)));
  const delRel = (field, i) => set(field, form[field].filter((_, idx) => idx !== i));

  return (
    <>
      <DataGrid
        title="หลักสูตร"
        rows={rows}
        searchKeys={['code', 'name_th', 'category']}
        onNew={openNew}
        onEdit={openEdit}
        onDelete={remove}
        excel={{
          filename: 'courses',
          map: (r) => ({ รหัส: r.code, ชื่อ: r.name_th, หมวดหมู่: r.category, ประเภท: r.type, 'ส่ง กรมพัฒนาฝีมือ': r.send_to_dsd ? 'ใช่' : 'ไม่' }),
        }}
        columns={[
          { key: 'code', header: 'รหัส', className: 'font-medium' },
          { key: 'name_th', header: 'ชื่อหลักสูตร' },
          { key: 'category', header: 'หมวดหมู่' },
          { key: 'type', header: 'ประเภท', render: (r) => <Badge color={r.type === 'ต่อเนื่อง' ? 'blue' : 'slate'}>{r.type}</Badge> },
          { key: 'send_to_dsd', header: 'ส่ง กพร.', render: (r) => (r.send_to_dsd ? 'ใช่' : '-') },
        ]}
      />

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        wide
        title={editing?.isNew ? 'เพิ่มหลักสูตร' : `แก้ไขหลักสูตร: ${form.name_th}`}
        footer={<ModalFooter onCancel={() => setEditing(null)} onSave={save} saving={saving} />}
      >
        <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
          {FORM_TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => setFtab(i)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                ftab === i ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {ftab === 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="รหัสหลักสูตร" required>
              <Input value={form.code} disabled={!editing?.isNew} invalid={errors.code} onChange={(e) => set('code', e.target.value)} placeholder="HR-INT-001" />
            </Field>
            <Field label="หมวดหมู่">
              <Input value={form.category} onChange={(e) => set('category', e.target.value)} />
            </Field>
            <Field label="ชื่อหลักสูตร (ไทย)" required>
              <Input value={form.name_th} invalid={errors.name_th} onChange={(e) => set('name_th', e.target.value)} />
            </Field>
            <Field label="ชื่อหลักสูตร (อังกฤษ)">
              <Input value={form.name_en} onChange={(e) => set('name_en', e.target.value)} />
            </Field>
            <Field label="ประเภท">
              <Select value={form.type} onChange={(e) => set('type', e.target.value)}>
                <option>ไม่ต่อเนื่อง</option>
                <option>ต่อเนื่อง</option>
              </Select>
            </Field>
            <Field label="ประเภทการฝึก">
              <Select value={form.training_type} onChange={(e) => set('training_type', e.target.value)}>
                {TRAINING_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </Field>
            <Field label="ระยะเวลา (ชั่วโมง)">
              <Input type="number" min="0" value={form.duration_hours} onChange={(e) => set('duration_hours', e.target.value)} />
            </Field>
            <Field label="ระยะเวลา (นาที)">
              <Input type="number" min="0" max="59" value={form.duration_minutes} onChange={(e) => set('duration_minutes', e.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="รายละเอียด">
                <Textarea rows={3} value={form.detail} onChange={(e) => set('detail', e.target.value)} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.send_to_dsd} onChange={(e) => set('send_to_dsd', e.target.checked)} />
              ส่งข้อมูลกรมพัฒนาฝีมือแรงงาน (กพร.)
            </label>
          </div>
        )}

        {ftab === 1 && (
          <div>
            <div className="mb-2 flex justify-end">
              <Button size="sm" variant="subtle" onClick={addTopic}>
                <Plus size={14} /> เพิ่มหัวข้อ
              </Button>
            </div>
            <SubGrid
              head={['ลำดับ', 'หัวข้ออบรม', 'ระยะเวลา (นาที)', '']}
              empty="ยังไม่มีหัวข้อ"
              rows={form.topics}
              render={(t, i) => (
                <>
                  <td className="px-2 py-1.5">
                    <Input className="h-8" type="number" value={t.sequence} onChange={(e) => updTopic(i, 'sequence', e.target.value)} />
                  </td>
                  <td className="px-2 py-1.5">
                    <Select className="h-8" value={t.topic_code} onChange={(e) => updTopic(i, 'topic_code', e.target.value)}>
                      <option value="">— เลือกหัวข้อ —</option>
                      {topics.map((tp) => (
                        <option key={tp.code} value={tp.code}>
                          {tp.code} · {tp.name_th}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-2 py-1.5">
                    <Input className="h-8" type="number" value={t.duration} onChange={(e) => updTopic(i, 'duration', e.target.value)} />
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <button onClick={() => delTopic(i)} className="text-slate-400 hover:text-red-600">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </>
              )}
            />
          </div>
        )}

        {ftab === 2 && (
          <RelationGrid label="หลักสูตรที่ควรอบรมก่อน" field="prereqs" courses={rows} form={form} add={addRel} upd={updRel} del={delRel} />
        )}
        {ftab === 3 && (
          <RelationGrid label="หลักสูตรที่ควรอบรมต่อไป" field="nexts" courses={rows} form={form} add={addRel} upd={updRel} del={delRel} />
        )}
      </Modal>
    </>
  );
}

function SubGrid({ head, rows, render, empty }) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-slate-50 text-left text-slate-500">
        <tr>
          {head.map((h, i) => (
            <th key={i} className="px-2 py-2 font-medium">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.length === 0 && (
          <tr>
            <td colSpan={head.length} className="px-2 py-6 text-center text-slate-400">
              {empty}
            </td>
          </tr>
        )}
        {rows.map((r, i) => (
          <tr key={i}>{render(r, i)}</tr>
        ))}
      </tbody>
    </table>
  );
}

function RelationGrid({ label, field, courses, form, add, upd, del }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-600">{label}</span>
        <Button size="sm" variant="subtle" onClick={() => add(field)}>
          <Plus size={14} /> เพิ่ม
        </Button>
      </div>
      <SubGrid
        head={['หลักสูตร', '']}
        empty="ยังไม่มีรายการ"
        rows={form[field]}
        render={(r, i) => (
          <>
            <td className="px-2 py-1.5">
              <Select className="h-8" value={r.related_course_code} onChange={(e) => upd(field, i, e.target.value)}>
                <option value="">— เลือกหลักสูตร —</option>
                {courses.filter((c) => c.code !== form.code).map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} · {c.name_th}
                  </option>
                ))}
              </Select>
            </td>
            <td className="px-2 py-1.5 text-right">
              <button onClick={() => del(field, i)} className="text-slate-400 hover:text-red-600">
                <Trash2 size={15} />
              </button>
            </td>
          </>
        )}
      />
    </div>
  );
}
