import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import DataGrid from '../../components/DataGrid.jsx';
import Modal, { ModalFooter } from '../../components/Modal.jsx';
import { Field, Input, Select, Badge } from '../../components/ui.jsx';

const EMPTY = { code: '', name_th: '', name_en: '', type: 'บรรยาย', duration_hours: 0, duration_minutes: 0, is_continuous: false };
const REQUIRED = ['code', 'name_th'];

export default function TopicsTab() {
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null); // null | {row, isNew}
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const load = () => api.get('/topics').then(setRows).catch((e) => toast.error(e.message));
  useEffect(() => {
    load();
  }, []);

  function openNew() {
    setForm(EMPTY);
    setErrors({});
    setEditing({ isNew: true });
  }
  function openEdit(row) {
    setForm({ ...row, is_continuous: !!row.is_continuous });
    setErrors({});
    setEditing({ isNew: false, code: row.code });
  }

  async function save() {
    const errs = {};
    REQUIRED.forEach((k) => !String(form[k]).trim() && (errs[k] = true));
    setErrors(errs);
    if (Object.keys(errs).length) return toast.error('กรุณากรอกข้อมูลที่จำเป็น');
    setSaving(true);
    try {
      if (editing.isNew) await api.post('/topics', form);
      else await api.put(`/topics/${editing.code}`, form);
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
    if (!confirm(`ลบหัวข้อ "${row.name_th}" ?`)) return;
    try {
      await api.del(`/topics/${row.code}`);
      toast.success('ลบสำเร็จ');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <>
      <DataGrid
        title="หัวข้ออบรม"
        rows={rows}
        searchKeys={['code', 'name_th', 'name_en']}
        onNew={openNew}
        onEdit={openEdit}
        onDelete={remove}
        excel={{
          filename: 'training-topics',
          map: (r) => ({
            รหัส: r.code,
            ชื่อ: r.name_th,
            'ชื่อ (EN)': r.name_en,
            ประเภท: r.type,
            ชั่วโมง: r.duration_hours,
            นาที: r.duration_minutes,
            ต่อเนื่อง: r.is_continuous ? 'ใช่' : 'ไม่',
          }),
        }}
        columns={[
          { key: 'code', header: 'รหัส', className: 'font-medium' },
          { key: 'name_th', header: 'ชื่อหัวข้อ' },
          { key: 'type', header: 'ประเภท' },
          { key: 'duration', header: 'ระยะเวลา', render: (r) => `${r.duration_hours} ชม. ${r.duration_minutes} น.` },
          { key: 'is_continuous', header: 'ต่อเนื่อง', render: (r) => (r.is_continuous ? <Badge color="blue">ต่อเนื่อง</Badge> : <span className="text-slate-400">-</span>) },
        ]}
      />

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.isNew ? 'เพิ่มหัวข้ออบรม' : 'แก้ไขหัวข้ออบรม'}
        footer={<ModalFooter onCancel={() => setEditing(null)} onSave={save} saving={saving} />}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="รหัส" required>
            <Input value={form.code} disabled={!editing?.isNew} invalid={errors.code} onChange={(e) => set('code', e.target.value)} placeholder="HR-TN-001" />
          </Field>
          <Field label="ประเภท">
            <Select value={form.type} onChange={(e) => set('type', e.target.value)}>
              <option>บรรยาย</option>
              <option>บรรยายและปฏิบัติ</option>
            </Select>
          </Field>
          <Field label="ชื่อหัวข้อ (ไทย)" required>
            <Input value={form.name_th} invalid={errors.name_th} onChange={(e) => set('name_th', e.target.value)} />
          </Field>
          <Field label="ชื่อหัวข้อ (อังกฤษ)">
            <Input value={form.name_en} onChange={(e) => set('name_en', e.target.value)} />
          </Field>
          <Field label="ระยะเวลา (ชั่วโมง)">
            <Input type="number" min="0" value={form.duration_hours} onChange={(e) => set('duration_hours', e.target.value)} />
          </Field>
          <Field label="ระยะเวลา (นาที)">
            <Input type="number" min="0" max="59" value={form.duration_minutes} onChange={(e) => set('duration_minutes', e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.is_continuous} onChange={(e) => set('is_continuous', e.target.checked)} />
            หลักสูตรต่อเนื่อง
          </label>
        </div>
      </Modal>
    </>
  );
}
