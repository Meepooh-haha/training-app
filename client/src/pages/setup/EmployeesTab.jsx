import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import DataGrid from '../../components/DataGrid.jsx';
import Modal, { ModalFooter } from '../../components/Modal.jsx';
import { Field, Input, Select } from '../../components/ui.jsx';

const EMPTY = {
  sequence: '', code: '', full_name: '', nickname: '',
  email: '', position_th: '', position_en: '', department: '', department_id: '', position_id: '',
};

// Maps trimmed header cell values → internal field names.
// Covers both our own export format and the Manpower HR file format.
const HEADER_MAP = {
  'ลำดับ': 'sequence',
  'No': 'sequence',
  'รหัส': 'code',
  'รหัสพนักงาน': 'code',
  'ชื่อ นามสกุล': 'full_name',
  'ชื่อ-นามสกุล': 'full_name',
  'ชื่อเล่น': 'nickname',
  'Email': 'email',
  'ตำแหน่ง': 'position_th',
  'ตำแหน่ง (ภาษาไทย)': 'position_th',
  'Position': 'position_en',
  'ตำแหน่ง (ภาษาอังกฤษ)': 'position_en',
  'ฝ่าย': 'department',
};

export default function EmployeesTab() {
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(null);
  const [importSaving, setImportSaving] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const fileRef = useRef(null);

  const load = () => api.get('/employees').then(setRows).catch((e) => toast.error(e.message));
  useEffect(() => {
    load();
    api.get('/departments').then(setDepartments).catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.department_id) { setPositions([]); return; }
    api.get(`/positions?department_id=${form.department_id}`).then(setPositions).catch(() => {});
  }, [form.department_id]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function openNew() {
    setForm(EMPTY);
    setErrors({});
    setEditing({ isNew: true });
  }
  async function openEdit(row) {
    setErrors({});
    if (row.department_id) {
      const pos = await api.get(`/positions?department_id=${row.department_id}`).catch(() => []);
      setPositions(pos);
    }
    setForm({ ...row });
    setEditing({ isNew: false, code: row.code });
  }

  async function save() {
    const errs = {};
    if (!String(form.code).trim()) errs.code = true;
    if (!form.full_name.trim()) errs.full_name = true;
    setErrors(errs);
    if (Object.keys(errs).length) return toast.error('กรุณากรอกข้อมูลที่จำเป็น');
    setSaving(true);
    try {
      if (editing.isNew) await api.post('/employees', form);
      else await api.put(`/employees/${editing.code}`, form);
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
    if (!confirm(`ลบพนักงาน "${row.full_name}" ?`)) return;
    try {
      await api.del(`/employees/${row.code}`);
      toast.success('ลบสำเร็จ');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  function openImport() {
    fileRef.current.value = '';
    fileRef.current.click();
  }

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        // Find the first row (within the first 5) that contains a 'code' column.
        // This handles files with a title row before the actual header row.
        let colMap = null;
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(allRows.length, 5); i++) {
          const map = {};
          allRows[i].forEach((cell, j) => {
            const field = HEADER_MAP[String(cell).trim()];
            if (field) map[j] = field;
          });
          if (Object.values(map).includes('code')) {
            colMap = map;
            headerRowIdx = i;
            break;
          }
        }

        if (!colMap) return toast.error('ไม่พบคอลัมน์รหัสพนักงาน — ตรวจสอบชื่อหัวคอลัมน์');

        let skipped = 0;
        const validRows = [];
        for (let i = headerRowIdx + 1; i < allRows.length; i++) {
          const rawRow = allRows[i];
          const row = {};
          for (const [colIdx, field] of Object.entries(colMap)) {
            row[field] = String(rawRow[colIdx] ?? '').trim();
          }
          if (!row.code || !row.full_name) { skipped++; continue; }
          validRows.push(row);
        }
        if (!validRows.length) return toast.error('ไม่พบข้อมูลพนักงานในไฟล์');
        setImporting({ rows: validRows, skipped });
      } catch {
        toast.error('อ่านไฟล์ไม่ได้');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function confirmImport() {
    setImportSaving(true);
    try {
      const { count } = await api.post('/employees/import', { rows: importing.rows });
      toast.success(`นำเข้าสำเร็จ ${count} รายการ`);
      setImporting(null);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setImportSaving(false);
    }
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFile}
      />

      <DataGrid
        title="ข้อมูลพนักงาน"
        rows={rows}
        searchKeys={['code', 'full_name', 'nickname', 'department', 'position_th']}
        onNew={openNew}
        onEdit={openEdit}
        onDelete={remove}
        onImport={openImport}
        excel={{
          filename: 'employees',
          map: (r) => ({
            ลำดับ: r.sequence,
            รหัส: r.code,
            'ชื่อ นามสกุล': r.full_name,
            ชื่อเล่น: r.nickname,
            Email: r.email,
            ตำแหน่ง: r.position_th,
            Position: r.position_en,
            ฝ่าย: r.department,
          }),
        }}
        columns={[
          { key: 'sequence', header: 'ลำดับ', className: 'w-16 text-center' },
          { key: 'code', header: 'รหัส', className: 'font-medium' },
          { key: 'full_name', header: 'ชื่อ นามสกุล' },
          { key: 'nickname', header: 'ชื่อเล่น' },
          { key: 'department', header: 'ฝ่าย' },
          { key: 'position_th', header: 'ตำแหน่ง' },
          { key: 'position_en', header: 'Position' },
        ]}
      />

      <Modal
        open={!!importing}
        onClose={() => setImporting(null)}
        title={`ตรวจสอบข้อมูลก่อนนำเข้า (${importing?.rows.length ?? 0} รายการ)`}
        footer={
          <ModalFooter
            onCancel={() => setImporting(null)}
            onSave={confirmImport}
            saving={importSaving}
            saveLabel="ยืนยันนำเข้า"
          />
        }
      >
        {importing && (
          <div className="space-y-3">
            {importing.skipped > 0 && (
              <p className="text-sm text-amber-600">ข้ามไป {importing.skipped} แถวที่ไม่มีรหัสหรือชื่อ</p>
            )}
            <p className="text-sm text-slate-500">รหัสพนักงานที่มีอยู่แล้วจะถูกอัปเดต</p>
            <div className="max-h-64 overflow-y-auto rounded border border-slate-200">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">รหัส</th>
                    <th className="px-3 py-2 font-medium">ชื่อ นามสกุล</th>
                    <th className="px-3 py-2 font-medium">ฝ่าย</th>
                    <th className="px-3 py-2 font-medium">ตำแหน่ง</th>
                    <th className="px-3 py-2 font-medium">Position</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {importing.rows.slice(0, 50).map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5 font-medium">{r.code}</td>
                      <td className="px-3 py-1.5">{r.full_name}</td>
                      <td className="px-3 py-1.5 text-slate-500">{r.department}</td>
                      <td className="px-3 py-1.5 text-slate-500">{r.position_th}</td>
                      <td className="px-3 py-1.5 text-slate-500">{r.position_en}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {importing.rows.length > 50 && (
              <p className="text-xs text-slate-400">แสดง 50 รายการแรก จากทั้งหมด {importing.rows.length} รายการ</p>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.isNew ? 'เพิ่มพนักงาน' : `แก้ไขพนักงาน: ${form.full_name}`}
        footer={<ModalFooter onCancel={() => setEditing(null)} onSave={save} saving={saving} />}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="ลำดับ">
            <Input type="number" min="0" value={form.sequence} onChange={(e) => set('sequence', e.target.value)} placeholder="1" />
          </Field>
          <Field label="รหัสพนักงาน" required>
            <Input value={form.code} disabled={!editing?.isNew} invalid={errors.code} onChange={(e) => set('code', e.target.value)} placeholder="EMP-001" />
          </Field>
          <Field label="ชื่อ นามสกุล" required>
            <Input value={form.full_name} invalid={errors.full_name} onChange={(e) => set('full_name', e.target.value)} />
          </Field>
          <Field label="ชื่อเล่น">
            <Input value={form.nickname} onChange={(e) => set('nickname', e.target.value)} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </Field>
          <Field label="ฝ่าย">
            <Select
              value={String(form.department_id ?? '')}
              onChange={(e) => {
                const dept = departments.find((d) => d.id === Number(e.target.value));
                setForm((f) => ({
                  ...f,
                  department_id: dept?.id ?? '',
                  department: dept?.name ?? '',
                  position_id: '',
                  position_th: '',
                }));
              }}
            >
              <option value="">-- เลือกฝ่าย --</option>
              {departments.map((d) => (
                <option key={d.id} value={String(d.id)}>{d.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="ตำแหน่ง (ภาษาไทย)">
            <Select
              value={String(form.position_id ?? '')}
              onChange={(e) => {
                const pos = positions.find((p) => p.id === Number(e.target.value));
                set('position_id', pos?.id ?? '');
                set('position_th', pos?.name ?? '');
              }}
            >
              <option value="">-- เลือกตำแหน่ง --</option>
              {positions.map((p) => (
                <option key={p.id} value={String(p.id)}>{p.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="ตำแหน่ง (ภาษาอังกฤษ)">
            <Input value={form.position_en} onChange={(e) => set('position_en', e.target.value)} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
