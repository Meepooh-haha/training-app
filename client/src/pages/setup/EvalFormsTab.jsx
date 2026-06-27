import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../../lib/api.js';
import DataGrid from '../../components/DataGrid.jsx';
import Modal, { ModalFooter } from '../../components/Modal.jsx';
import { Field, Input, Select, Textarea, Button } from '../../components/ui.jsx';

const EMPTY = { code: '', name_th: '', name_en: '', detail: '', items: [] };

export default function EvalFormsTab() {
  const [rows, setRows] = useState([]);
  const [items, setItems] = useState([]); // master eval items
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const load = () => api.get('/eval-forms').then(setRows).catch((e) => toast.error(e.message));
  useEffect(() => {
    load();
    api.get('/eval-items').then(setItems).catch(() => {});
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function openNew() {
    setForm(EMPTY);
    setErrors({});
    setEditing({ isNew: true });
  }
  async function openEdit(row) {
    setErrors({});
    try {
      const full = await api.get(`/eval-forms/${row.code}`);
      setForm({ ...EMPTY, ...full });
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
    if (Object.keys(errs).length) return toast.error('กรุณากรอกข้อมูลที่จำเป็น');
    setSaving(true);
    try {
      if (editing.isNew) await api.post('/eval-forms', form);
      else await api.put(`/eval-forms/${editing.code}`, form);
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
    if (!confirm(`ลบรูปแบบประเมิน "${row.name_th}" ?`)) return;
    try {
      await api.del(`/eval-forms/${row.code}`);
      toast.success('ลบสำเร็จ');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  const addItem = () => set('items', [...form.items, { item_code: '', sequence: form.items.length + 1, weight: 1, scale_type: 'ระดับ' }]);
  const updItem = (i, k, v) => set('items', form.items.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));
  const delItem = (i) => set('items', form.items.filter((_, idx) => idx !== i));

  return (
    <>
      <DataGrid
        title="รูปแบบประเมิน"
        rows={rows}
        searchKeys={['code', 'name_th']}
        onNew={openNew}
        onEdit={openEdit}
        onDelete={remove}
        excel={{ filename: 'eval-forms', map: (r) => ({ รหัส: r.code, ชื่อ: r.name_th, 'ชื่อ (EN)': r.name_en, รายละเอียด: r.detail }) }}
        columns={[
          { key: 'code', header: 'รหัส', className: 'font-medium' },
          { key: 'name_th', header: 'ชื่อแบบประเมิน' },
          { key: 'name_en', header: 'ชื่อ (EN)' },
        ]}
      />

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        wide
        title={editing?.isNew ? 'เพิ่มรูปแบบประเมิน' : `แก้ไข: ${form.name_th}`}
        footer={<ModalFooter onCancel={() => setEditing(null)} onSave={save} saving={saving} />}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="รหัส" required>
            <Input value={form.code} disabled={!editing?.isNew} invalid={errors.code} onChange={(e) => set('code', e.target.value)} placeholder="INT-01" />
          </Field>
          <Field label="ชื่อ (อังกฤษ)">
            <Input value={form.name_en} onChange={(e) => set('name_en', e.target.value)} />
          </Field>
          <Field label="ชื่อแบบประเมิน (ไทย)" required>
            <Input value={form.name_th} invalid={errors.name_th} onChange={(e) => set('name_th', e.target.value)} />
          </Field>
          <Field label="รายละเอียด">
            <Input value={form.detail} onChange={(e) => set('detail', e.target.value)} />
          </Field>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">หัวข้อในแบบประเมิน</span>
            <Button size="sm" variant="subtle" onClick={addItem}>
              <Plus size={14} /> เพิ่มหัวข้อ
            </Button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="w-16 px-2 py-2 font-medium">ลำดับ</th>
                <th className="px-2 py-2 font-medium">หัวข้อประเมิน</th>
                <th className="w-24 px-2 py-2 font-medium">น้ำหนัก</th>
                <th className="w-32 px-2 py-2 font-medium">รูปแบบ</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {form.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-2 py-6 text-center text-slate-400">
                    ยังไม่มีหัวข้อประเมิน
                  </td>
                </tr>
              )}
              {form.items.map((it, i) => (
                <tr key={i}>
                  <td className="px-2 py-1.5">
                    <Input className="h-8" type="number" value={it.sequence} onChange={(e) => updItem(i, 'sequence', e.target.value)} />
                  </td>
                  <td className="px-2 py-1.5">
                    <Select className="h-8" value={it.item_code} onChange={(e) => updItem(i, 'item_code', e.target.value)}>
                      <option value="">— เลือกหัวข้อ —</option>
                      {items.map((m) => (
                        <option key={m.code} value={m.code}>
                          {m.code} · {m.name_th}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-2 py-1.5">
                    <Input className="h-8" type="number" step="0.1" value={it.weight} onChange={(e) => updItem(i, 'weight', e.target.value)} />
                  </td>
                  <td className="px-2 py-1.5">
                    <Select className="h-8" value={it.scale_type} onChange={(e) => updItem(i, 'scale_type', e.target.value)}>
                      <option>ระดับ</option>
                      <option>คะแนน</option>
                    </Select>
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <button onClick={() => delItem(i)} className="text-slate-400 hover:text-red-600">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    </>
  );
}
