import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import DataGrid from '../../components/DataGrid.jsx';
import Modal, { ModalFooter } from '../../components/Modal.jsx';
import { Field, Input } from '../../components/ui.jsx';

const EMPTY = { code: '', name: '', name_en: '' };

export default function DepartmentsTab() {
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const load = () => api.get('/departments').then(setRows).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, []);

  function openNew() {
    setForm(EMPTY);
    setErrors({});
    setEditing({ isNew: true });
  }
  function openEdit(row) {
    setForm({ code: row.code, name: row.name, name_en: row.name_en || '' });
    setErrors({});
    setEditing({ isNew: false, id: row.id });
  }

  async function save() {
    const errs = {};
    if (!String(form.code).trim()) errs.code = true;
    if (!String(form.name).trim()) errs.name = true;
    setErrors(errs);
    if (Object.keys(errs).length) return toast.error('กรุณากรอกข้อมูลที่จำเป็น');
    setSaving(true);
    try {
      if (editing.isNew) await api.post('/departments', form);
      else await api.put(`/departments/${editing.id}`, form);
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
    if (!confirm(`ลบฝ่าย "${row.name}" ?`)) return;
    try {
      await api.del(`/departments/${row.id}`);
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
        title="ฝ่าย/แผนก"
        rows={rows}
        searchKeys={['code', 'name', 'name_en']}
        onNew={openNew}
        onEdit={openEdit}
        onDelete={remove}
        excel={{
          filename: 'departments',
          map: (r) => ({ รหัส: r.code, ชื่อ: r.name, 'ชื่อ (EN)': r.name_en }),
        }}
        columns={[
          { key: 'code', header: 'รหัส', className: 'font-medium' },
          { key: 'name', header: 'ชื่อฝ่าย/แผนก' },
          { key: 'name_en', header: 'ชื่อ (EN)' },
        ]}
      />

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.isNew ? 'เพิ่มฝ่าย/แผนก' : 'แก้ไขฝ่าย/แผนก'}
        footer={<ModalFooter onCancel={() => setEditing(null)} onSave={save} saving={saving} />}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="รหัส" required>
            <Input
              value={form.code}
              disabled={!editing?.isNew}
              invalid={errors.code}
              onChange={(e) => set('code', e.target.value)}
              placeholder="DEPT-001"
            />
          </Field>
          <Field label="ชื่อ (ไทย)" required>
            <Input value={form.name} invalid={errors.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="ชื่อ (EN)">
            <Input value={form.name_en} onChange={(e) => set('name_en', e.target.value)} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
