import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import DataGrid from '../../components/DataGrid.jsx';
import Modal, { ModalFooter } from '../../components/Modal.jsx';
import { Field, Input, Select, Textarea } from '../../components/ui.jsx';

const EMPTY = { code: '', name_th: '', name_en: '', eval_type: 'ประเมินผู้เข้าร่วมอบรม', detail: '' };
const TYPES = ['ประเมินผู้เข้าร่วมอบรม', 'ประเมินวิทยากร', 'ประเมินหลักสูตร', 'ประเมินการจัดอบรม'];
const REQUIRED = ['code', 'name_th'];

export default function EvalItemsTab() {
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const load = () => api.get('/eval-items').then(setRows).catch((e) => toast.error(e.message));
  useEffect(() => {
    load();
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function openNew() {
    setForm(EMPTY);
    setErrors({});
    setEditing({ isNew: true });
  }
  function openEdit(row) {
    setForm({ ...row });
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
      if (editing.isNew) await api.post('/eval-items', form);
      else await api.put(`/eval-items/${editing.code}`, form);
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
    if (!confirm(`ลบหัวข้อประเมิน "${row.name_th}" ?`)) return;
    try {
      await api.del(`/eval-items/${row.code}`);
      toast.success('ลบสำเร็จ');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <>
      <DataGrid
        title="หัวข้อประเมิน"
        rows={rows}
        searchKeys={['code', 'name_th', 'eval_type']}
        onNew={openNew}
        onEdit={openEdit}
        onDelete={remove}
        excel={{
          filename: 'eval-items',
          map: (r) => ({ รหัส: r.code, ชื่อ: r.name_th, 'ชื่อ (EN)': r.name_en, ประเภท: r.eval_type, รายละเอียด: r.detail }),
        }}
        columns={[
          { key: 'code', header: 'รหัส', className: 'font-medium' },
          { key: 'name_th', header: 'หัวข้อประเมิน' },
          { key: 'eval_type', header: 'ประเภทการประเมิน' },
        ]}
      />

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.isNew ? 'เพิ่มหัวข้อประเมิน' : 'แก้ไขหัวข้อประเมิน'}
        footer={<ModalFooter onCancel={() => setEditing(null)} onSave={save} saving={saving} />}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="รหัส" required>
            <Input value={form.code} disabled={!editing?.isNew} invalid={errors.code} onChange={(e) => set('code', e.target.value)} placeholder="INT-CO-001" />
          </Field>
          <Field label="ประเภทการประเมิน">
            <Select value={form.eval_type} onChange={(e) => set('eval_type', e.target.value)}>
              {TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="ชื่อ (ไทย)" required>
            <Input value={form.name_th} invalid={errors.name_th} onChange={(e) => set('name_th', e.target.value)} />
          </Field>
          <Field label="ชื่อ (อังกฤษ)">
            <Input value={form.name_en} onChange={(e) => set('name_en', e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="รายละเอียด">
              <Textarea rows={3} value={form.detail} onChange={(e) => set('detail', e.target.value)} />
            </Field>
          </div>
        </div>
      </Modal>
    </>
  );
}
