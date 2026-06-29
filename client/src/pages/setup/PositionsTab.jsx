import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Target, Trash2, Plus } from 'lucide-react';
import { api } from '../../lib/api.js';
import { LEVEL_OPTIONS } from '../../lib/competency-levels.js';
import DataGrid from '../../components/DataGrid.jsx';
import Modal, { ModalFooter } from '../../components/Modal.jsx';
import { Field, Input, Select, Button, Badge } from '../../components/ui.jsx';

const EMPTY = { code: '', name: '', name_en: '', level: '', department_id: '' };

export default function PositionsTab() {
  const [rows, setRows] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Position competency profile modal
  const [profilePos, setProfilePos] = useState(null);
  const [profile, setProfile] = useState([]);
  const [allCompetencies, setAllCompetencies] = useState([]);
  const [addForm, setAddForm] = useState({ competency_id: '', required_level: 3 });
  const [addingSaving, setAddingSaving] = useState(false);

  const load = () => api.get('/positions').then(setRows).catch(e => toast.error(e.message));

  useEffect(() => {
    load();
    api.get('/departments').then(setDepartments).catch(e => toast.error(e.message));
  }, []);

  function openNew() {
    setForm(EMPTY);
    setErrors({});
    setEditing({ isNew: true });
  }
  function openEdit(row) {
    setForm({ code: row.code, name: row.name, name_en: row.name_en || '', level: row.level || '', department_id: row.department_id ?? '' });
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
      const payload = { ...form, department_id: form.department_id || null };
      if (editing.isNew) await api.post('/positions', payload);
      else await api.put(`/positions/${editing.id}`, payload);
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
    if (!confirm(`ลบตำแหน่ง "${row.name}" ?`)) return;
    try {
      await api.del(`/positions/${row.id}`);
      toast.success('ลบสำเร็จ');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function openProfile(pos) {
    setProfilePos(pos);
    setAddForm({ competency_id: '', required_level: 3 });
    const [prof, comps] = await Promise.all([
      api.get(`/positions/${pos.id}/competencies`),
      api.get('/competencies'),
    ]);
    setProfile(prof);
    setAllCompetencies(comps);
  }

  function closeProfile() {
    setProfilePos(null);
    setProfile([]);
  }

  async function addCompetency() {
    if (!addForm.competency_id) return toast.error('เลือก Competency ก่อน');
    setAddingSaving(true);
    try {
      await api.post(`/positions/${profilePos.id}/competencies`, {
        competency_id: Number(addForm.competency_id),
        required_level: Number(addForm.required_level),
      });
      const updated = await api.get(`/positions/${profilePos.id}/competencies`);
      setProfile(updated);
      setAddForm({ competency_id: '', required_level: 3 });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setAddingSaving(false);
    }
  }

  async function updateRequiredLevel(cid, level) {
    try {
      await api.put(`/positions/${profilePos.id}/competencies/${cid}`, { required_level: Number(level) });
      setProfile(p => p.map(r => r.competency_id === cid ? { ...r, required_level: Number(level) } : r));
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function removeCompetency(cid) {
    try {
      await api.del(`/positions/${profilePos.id}/competencies/${cid}`);
      setProfile(p => p.filter(r => r.competency_id !== cid));
    } catch (e) {
      toast.error(e.message);
    }
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const profiledIds = new Set(profile.map(r => r.competency_id));
  const availableToAdd = allCompetencies.filter(c => !profiledIds.has(c.id));

  return (
    <>
      <DataGrid
        title="ตำแหน่งงาน"
        rows={rows}
        searchKeys={['code', 'name', 'name_en', 'department_name']}
        onNew={openNew}
        onEdit={openEdit}
        onDelete={remove}
        excel={{
          filename: 'positions',
          map: r => ({ รหัส: r.code, ชื่อ: r.name, 'ชื่อ (EN)': r.name_en, ระดับ: r.level, ฝ่าย: r.department_name }),
        }}
        columns={[
          { key: 'code', header: 'รหัส', className: 'font-medium' },
          { key: 'name', header: 'ชื่อตำแหน่ง' },
          { key: 'level', header: 'ระดับ' },
          {
            key: 'department_name',
            header: 'สังกัดฝ่าย',
            render: r => r.department_name || <span className="text-slate-400">-</span>,
          },
          {
            key: '_competency',
            header: '',
            render: r => (
              <button
                onClick={e => { e.stopPropagation(); openProfile(r); }}
                className="rounded p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-600"
                title="กำหนด Competency"
              >
                <Target size={15} />
              </button>
            ),
          },
        ]}
      />

      {/* Add / Edit position modal */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.isNew ? 'เพิ่มตำแหน่งงาน' : 'แก้ไขตำแหน่งงาน'}
        footer={<ModalFooter onCancel={() => setEditing(null)} onSave={save} saving={saving} />}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="รหัส" required>
            <Input value={form.code} disabled={!editing?.isNew} invalid={errors.code} onChange={e => set('code', e.target.value)} placeholder="POS-001" />
          </Field>
          <Field label="ฝ่าย/แผนก">
            <Select value={String(form.department_id ?? '')} onChange={e => set('department_id', e.target.value)}>
              <option value="">— ไม่ระบุ —</option>
              {departments.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
            </Select>
          </Field>
          <Field label="ชื่อตำแหน่ง (ไทย)" required>
            <Input value={form.name} invalid={errors.name} onChange={e => set('name', e.target.value)} />
          </Field>
          <Field label="ระดับ">
            <Input value={form.level} onChange={e => set('level', e.target.value)} placeholder="เช่น ระดับ 4" />
          </Field>
          <Field label="ชื่อตำแหน่ง (EN)">
            <Input value={form.name_en} onChange={e => set('name_en', e.target.value)} />
          </Field>
        </div>
      </Modal>

      {/* Position competency profile modal */}
      <Modal
        open={!!profilePos}
        onClose={closeProfile}
        title={profilePos ? `กำหนด Competency — ${profilePos.name}` : ''}
        wide
        footer={<Button variant="secondary" onClick={closeProfile}>ปิด</Button>}
      >
        {profilePos && (
          <div className="space-y-4">
            {/* Existing profile table */}
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">รหัส</th>
                  <th className="px-3 py-2 font-medium">ชื่อสมรรถนะ</th>
                  <th className="px-3 py-2 font-medium">ประเภท</th>
                  <th className="px-3 py-2 font-medium text-center">Required Level</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {profile.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-slate-400">ยังไม่มี Competency ที่กำหนด</td>
                  </tr>
                )}
                {profile.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono text-xs text-slate-600">{r.competency_code}</td>
                    <td className="px-3 py-2">{r.name}</td>
                    <td className="px-3 py-2">
                      <Badge color={r.type === 'organizational' ? 'blue' : 'green'}>
                        {r.type === 'organizational' ? 'Org' : 'Func'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <select
                        value={r.required_level}
                        onChange={e => updateRequiredLevel(r.competency_id, e.target.value)}
                        className="h-8 rounded border border-slate-300 px-2 text-sm"
                      >
                        {LEVEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => removeCompetency(r.competency_id)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Add competency row */}
            <div className="flex items-center gap-2 border-t border-slate-200 pt-4">
              <select
                value={addForm.competency_id}
                onChange={e => setAddForm(f => ({ ...f, competency_id: e.target.value }))}
                className="h-9 flex-1 rounded-md border border-slate-300 px-2.5 text-sm"
              >
                <option value="">— เลือก Competency ที่จะเพิ่ม —</option>
                {availableToAdd.map(c => (
                  <option key={c.id} value={c.id}>{c.competency_code} — {c.name}</option>
                ))}
              </select>
              <select
                value={addForm.required_level}
                onChange={e => setAddForm(f => ({ ...f, required_level: e.target.value }))}
                className="h-9 rounded-md border border-slate-300 px-2 text-sm"
              >
                {LEVEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <Button size="sm" onClick={addCompetency} disabled={addingSaving}>
                <Plus size={14} /> เพิ่ม
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
