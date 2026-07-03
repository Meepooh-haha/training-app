import { useEffect, useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { Pencil, Trash2, Plus, Search, FileSpreadsheet, ChevronDown, ChevronUp, Upload } from 'lucide-react';
import { api } from '../../lib/api.js';
import { LEVEL_OPTIONS } from '../../lib/competency-levels.js';
import Modal, { ModalFooter } from '../../components/Modal.jsx';
import { Button, Input, Select, Field, Textarea, Badge, Card } from '../../components/ui.jsx';
import { exportToExcel } from '../../lib/excel-generator.js';

const HEADER_MAP = {
  'รหัส': 'competency_code', 'Competency Code': 'competency_code', 'รหัสสมรรถนะ': 'competency_code',
  'ชื่อสมรรถนะ': 'name', 'Name': 'name', 'ชื่อ': 'name',
  'ประเภท': 'type', 'Type': 'type',
  'คำจำกัดความ': 'description', 'Description': 'description',
  'ระดับ 1': 'level_1_desc', 'Level 1': 'level_1_desc',
  'ระดับ 2': 'level_2_desc', 'Level 2': 'level_2_desc',
  'ระดับ 3': 'level_3_desc', 'Level 3': 'level_3_desc',
  'ฝ่าย': 'department_codes', 'Departments': 'department_codes', 'รหัสฝ่าย': 'department_codes',
  'Required Level': 'default_required_level', 'ระดับที่ต้องการ': 'default_required_level',
};

const TYPE_MAP = {
  organizational: 'organizational', 'องค์กร': 'organizational',
  functional: 'functional', 'สายงาน': 'functional', 'เฉพาะหน้าที่': 'functional',
  leadership: 'leadership', 'ผู้นำ': 'leadership', 'ภาวะผู้นำ': 'leadership',
};

const TYPE_LABEL = {
  organizational: 'Organizational', functional: 'Functional', leadership: 'Leadership',
};

const TEMPLATE_ROWS = [
  { รหัส: 'ORG-001', ชื่อสมรรถนะ: 'การสื่อสาร', ประเภท: 'organizational', คำจำกัดความ: 'สื่อสารได้มีประสิทธิภาพ', 'ระดับ 1': 'รับรู้การสื่อสารพื้นฐาน', 'ระดับ 2': 'สื่อสารได้ชัดเจน', 'ระดับ 3': 'โค้ชผู้อื่นด้านการสื่อสารได้', ฝ่าย: '', 'Required Level': '' },
  { รหัส: 'LD-001', ชื่อสมรรถนะ: 'ภาวะผู้นำ', ประเภท: 'leadership', คำจำกัดความ: 'นำทีมและสร้างแรงบันดาลใจ', 'ระดับ 1': 'รู้จักบทบาทผู้นำ', 'ระดับ 2': 'นำทีมเล็กได้', 'ระดับ 3': 'พัฒนา Leader รุ่นถัดไปได้', ฝ่าย: '', 'Required Level': '' },
  { รหัส: 'FN-HR-001', ชื่อสมรรถนะ: 'การสรรหาบุคลากร', ประเภท: 'functional', คำจำกัดความ: 'กระบวนการ Recruitment', 'ระดับ 1': 'รู้จัก JD เบื้องต้น', 'ระดับ 2': 'ทำ Recruitment ได้', 'ระดับ 3': 'วางกลยุทธ์ได้', ฝ่าย: 'HR', 'Required Level': '2' },
];

const EMPTY = {
  type: 'organizational',
  competency_code: '',
  name: '',
  description: '',
  max_level: 3,
  department_ids: [],
  position_ids: [],
  default_required_level: 1,
  level_1_desc: '',
  level_2_desc: '',
  level_3_desc: '',
  level_4_desc: '',
  level_5_desc: '',
};

export default function CompetencyTab() {
  const [rows, setRows] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [showLevels, setShowLevels] = useState(false);
  const [importing, setImporting] = useState(null);
  const [importSaving, setImportSaving] = useState(false);
  const fileRef = useRef(null);

  const load = () => api.get('/competencies').then(setRows).catch(e => toast.error(e.message));

  useEffect(() => {
    load();
    api.get('/departments').then(setDepartments).catch(e => toast.error(e.message));
    api.get('/positions').then(setPositions).catch(e => toast.error(e.message));
  }, []);

  const filtered = useMemo(() =>
    rows
      .filter(r => typeFilter === 'all' || r.type === typeFilter)
      .filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()) ||
                   r.competency_code.toLowerCase().includes(search.toLowerCase())),
    [rows, typeFilter, search]
  );

  function openNew() {
    setForm({ ...EMPTY, department_ids: [] });
    setErrors({});
    setShowLevels(false);
    setEditing({ isNew: true });
  }

  function openEdit(row) {
    const deptIds = row.dept_ids || [];
    const validPosIds = new Set(
      positions.filter(p => deptIds.includes(String(p.department_id))).map(p => String(p.id))
    );
    setForm({
      type: row.type,
      competency_code: row.competency_code,
      name: row.name,
      description: row.description || '',
      max_level: 3,
      department_ids: deptIds,
      position_ids: (row.pos_ids || []).filter(pid => validPosIds.has(pid)),
      default_required_level: 1,
      level_1_desc: row.level_1_desc || '',
      level_2_desc: row.level_2_desc || '',
      level_3_desc: row.level_3_desc || '',
      level_4_desc: row.level_4_desc || '',
      level_5_desc: row.level_5_desc || '',
    });
    setErrors({});
    setShowLevels(false);
    setEditing({ isNew: false, id: row.id });
  }

  async function save() {
    const errs = {};
    if (!form.competency_code.trim()) errs.competency_code = true;
    if (!form.name.trim()) errs.name = true;
    if (form.type === 'functional' && form.department_ids.length === 0) errs.department_ids = true;
    setErrors(errs);
    if (Object.keys(errs).length) return toast.error('กรุณากรอกข้อมูลที่จำเป็น');
    setSaving(true);
    try {
      const payload = { ...form, max_level: 3 };
      if (editing.isNew) {
        await api.post('/competencies', payload);
        toast.success('เพิ่ม Competency สำเร็จ');
      } else {
        await api.put(`/competencies/${editing.id}`, payload);
        toast.success('บันทึกสำเร็จ');
      }
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function del(row) {
    if (!confirm(`ลบ "${row.name}" ใช่หรือไม่?`)) return;
    try {
      await api.del(`/competencies/${row.id}`);
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

        let colMap = null;
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(allRows.length, 5); i++) {
          const map = {};
          allRows[i].forEach((cell, j) => {
            const field = HEADER_MAP[String(cell).trim()];
            if (field) map[j] = field;
          });
          if (Object.values(map).includes('competency_code')) {
            colMap = map;
            headerRowIdx = i;
            break;
          }
        }
        if (!colMap) return toast.error('ไม่พบคอลัมน์ "รหัส" — ตรวจสอบชื่อหัวคอลัมน์');

        let skipped = 0;
        const validRows = [];
        for (let i = headerRowIdx + 1; i < allRows.length; i++) {
          const rawRow = allRows[i];
          const row = {};
          for (const [colIdx, field] of Object.entries(colMap)) {
            row[field] = String(rawRow[colIdx] ?? '').trim();
          }
          if (!row.competency_code || !row.name) { skipped++; continue; }
          const normalizedType = TYPE_MAP[row.type?.toLowerCase?.().trim()] || row.type?.toLowerCase?.().trim();
          if (!['organizational', 'functional', 'leadership'].includes(normalizedType)) { skipped++; continue; }
          row.type = normalizedType;
          validRows.push(row);
        }
        if (!validRows.length) return toast.error('ไม่พบข้อมูลที่ถูกต้องในไฟล์');
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
      const { count } = await api.post('/competencies/import', { rows: importing.rows });
      toast.success(`นำเข้าสำเร็จ ${count} รายการ`);
      setImporting(null);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setImportSaving(false);
    }
  }

  function downloadTemplate() {
    exportToExcel(TEMPLATE_ROWS, 'competency-template', 'Competency Dictionary');
  }

  function toggleDept(id) {
    const sid = String(id);
    setForm(f => {
      const newDeptIds = f.department_ids.includes(sid)
        ? f.department_ids.filter(d => d !== sid)
        : [...f.department_ids, sid];
      const validPosIds = positions
        .filter(p => newDeptIds.includes(String(p.department_id)))
        .map(p => String(p.id));
      return {
        ...f,
        department_ids: newDeptIds,
        position_ids: f.position_ids.filter(pid => validPosIds.includes(pid)),
      };
    });
  }

  function togglePosition(id) {
    const sid = String(id);
    setForm(f => ({
      ...f,
      position_ids: f.position_ids.includes(sid)
        ? f.position_ids.filter(p => p !== sid)
        : [...f.position_ids, sid],
    }));
  }

  const filteredPositions = useMemo(
    () => positions.filter(p => form.department_ids.includes(String(p.department_id))),
    [positions, form.department_ids]
  );

  const orgCount = rows.filter(r => r.type === 'organizational').length;
  const funcCount = rows.filter(r => r.type === 'functional').length;
  const leaderCount = rows.filter(r => r.type === 'leadership').length;

  const Pill = ({ k, label, count }) => (
    <button
      onClick={() => setTypeFilter(k)}
      className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
        typeFilter === k ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {label} ({count})
    </button>
  );

  return (
    <div className="space-y-4">
      <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />

      {/* Filter pills + toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Pill k="all" label="ทั้งหมด" count={rows.length} />
          <Pill k="organizational" label="Organizational" count={orgCount} />
          <Pill k="functional" label="Functional" count={funcCount} />
          <Pill k="leadership" label="Leadership" count={leaderCount} />
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={15} className="absolute left-2.5 top-2.5 text-slate-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา..." className="h-9 w-44 pl-8" />
          </div>
          <Button variant="secondary" size="sm" onClick={downloadTemplate} title="ดาวน์โหลด Template Excel">
            <FileSpreadsheet size={15} /> Template
          </Button>
          <Button variant="secondary" size="sm" onClick={() =>
            exportToExcel(
              filtered.map(r => ({ รหัส: r.competency_code, ชื่อสมรรถนะ: r.name, ประเภท: r.type })),
              'competencies', 'Competency Dictionary'
            )
          }>
            <FileSpreadsheet size={15} /> Export
          </Button>
          <Button variant="secondary" size="sm" onClick={openImport}>
            <Upload size={15} /> Import Excel
          </Button>
          <Button size="sm" onClick={openNew}>
            <Plus size={15} /> เพิ่ม Competency
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">รหัส</th>
                <th className="px-4 py-2.5 font-medium">ชื่อสมรรถนะ</th>
                <th className="px-4 py-2.5 font-medium">ประเภท</th>
                <th className="px-4 py-2.5 font-medium">ผูกกับ</th>
                <th className="px-4 py-2.5 font-medium text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">ไม่มีข้อมูล</td>
                </tr>
              )}
              {filtered.map(row => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{row.competency_code}</td>
                  <td className="px-4 py-2.5 font-medium">{row.name}</td>
                  <td className="px-4 py-2.5">
                    <Badge color={row.type === 'organizational' ? 'blue' : row.type === 'leadership' ? 'purple' : 'green'}>
                      {row.type === 'organizational' ? 'Organizational' : row.type === 'leadership' ? 'Leadership' : 'Functional'}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    {(row.type === 'organizational' || row.type === 'leadership')
                      ? <span className="text-xs text-slate-400">ทุกตำแหน่ง</span>
                      : <span className="flex flex-wrap gap-1">
                          {(row.dept_codes || []).map(code => (
                            <Badge key={code} color="slate">{code}</Badge>
                          ))}
                          {(row.pos_codes || []).length > 0 && (
                            <Badge color="indigo">{(row.pos_codes || []).length} ตำแหน่ง</Badge>
                          )}
                          {(row.dept_codes || []).length === 0 && <span className="text-xs text-slate-400">—</span>}
                        </span>
                    }
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(row)} className="rounded p-1.5 text-slate-500 hover:bg-brand-50 hover:text-brand-600" title="แก้ไข">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => del(row)} className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600" title="ลบ">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Import Preview Modal */}
      <Modal
        open={!!importing}
        onClose={() => setImporting(null)}
        title={`ตรวจสอบข้อมูลก่อนนำเข้า (${importing?.rows.length ?? 0} รายการ)`}
        wide
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
              <p className="text-sm text-amber-600">ข้าม {importing.skipped} แถวที่ไม่สมบูรณ์ (ไม่มีรหัส/ชื่อ/ประเภทไม่ถูกต้อง)</p>
            )}
            <p className="text-sm text-slate-500">รหัสที่มีอยู่แล้วจะถูกอัปเดต — รหัสใหม่จะถูกเพิ่ม</p>
            <div className="max-h-72 overflow-y-auto rounded border border-slate-200">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">รหัส</th>
                    <th className="px-3 py-2 font-medium">ชื่อสมรรถนะ</th>
                    <th className="px-3 py-2 font-medium">ประเภท</th>
                    <th className="px-3 py-2 font-medium">ฝ่าย</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {importing.rows.slice(0, 50).map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5 font-mono text-xs text-slate-600">{r.competency_code}</td>
                      <td className="px-3 py-1.5 font-medium">{r.name}</td>
                      <td className="px-3 py-1.5">
                        <Badge color={r.type === 'organizational' ? 'blue' : r.type === 'leadership' ? 'purple' : 'green'}>
                          {TYPE_LABEL[r.type] ?? r.type}
                        </Badge>
                      </td>
                      <td className="px-3 py-1.5 text-slate-500 text-xs">{r.department_codes || '—'}</td>
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

      {/* Add / Edit Modal */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.isNew ? 'เพิ่ม Competency' : 'แก้ไข Competency'}
        wide
        footer={<ModalFooter onCancel={() => setEditing(null)} onSave={save} saving={saving} />}
      >
        <div className="space-y-4">
          {/* Type */}
          <Field label="ประเภท" required>
            <div className="mt-1 flex gap-6">
              {[
                { v: 'organizational', label: 'Organizational Competency' },
                { v: 'functional',     label: 'Functional Competency' },
                { v: 'leadership',     label: 'Leadership Competency' },
              ].map(({ v, label }) => (
                <label key={v} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="radio" value={v} checked={form.type === v}
                    onChange={() => setForm(f => ({ ...f, type: v }))} />
                  {label}
                </label>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="รหัส" required>
              <Input
                value={form.competency_code}
                onChange={e => setForm(f => ({ ...f, competency_code: e.target.value }))}
                invalid={errors.competency_code}
                placeholder="เช่น ORG-001"
                disabled={!editing?.isNew}
              />
            </Field>
            <Field label="ชื่อสมรรถนะ" required>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                invalid={errors.name}
                placeholder="ชื่อสมรรถนะ"
              />
            </Field>
          </div>

          <Field label="คำจำกัดความ (Definition)">
            <Textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              placeholder="อธิบายว่า Competency นี้คืออะไร"
            />
          </Field>

          {form.type === 'functional' && (
            <Field label="ผูกกับฝ่าย" required>
              <div className={`flex flex-wrap gap-3 rounded-md border p-3 ${errors.department_ids ? 'border-red-400' : 'border-slate-300'}`}>
                {departments.map(d => (
                  <label key={d.id} className="flex cursor-pointer items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={form.department_ids.includes(String(d.id))}
                      onChange={() => toggleDept(d.id)}
                    />
                    <span className="font-mono text-xs">{d.code}</span>
                    <span className="text-slate-500 text-xs">{d.name}</span>
                  </label>
                ))}
              </div>
            </Field>
          )}

          {form.type === 'functional' && filteredPositions.length > 0 && (
            <Field label="ตำแหน่งที่ต้องการ Competency นี้">
              <div className="flex flex-wrap gap-3 rounded-md border border-slate-300 p-3">
                {filteredPositions.map(p => (
                  <label key={p.id} className="flex cursor-pointer items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={form.position_ids.includes(String(p.id))}
                      onChange={() => togglePosition(p.id)}
                    />
                    <span className="font-mono text-xs">{p.code}</span>
                    <span className="text-slate-500 text-xs">{p.name}</span>
                  </label>
                ))}
              </div>
            </Field>
          )}

          {form.type === 'functional' && form.position_ids.length > 0 && (
            <Field label="Required Level (สำหรับตำแหน่งที่เพิ่มใหม่)">
              <Select
                value={form.default_required_level}
                onChange={e => setForm(f => ({ ...f, default_required_level: e.target.value }))}
                className="w-52"
              >
                {LEVEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </Field>
          )}

          {/* Proficiency level descriptions — expandable */}
          <div className="rounded-md border border-slate-200">
            <button
              type="button"
              onClick={() => setShowLevels(v => !v)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <span>ระดับความสามารถ (Proficiency Level)</span>
              {showLevels ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {showLevels && (
              <div className="space-y-2 border-t border-slate-200 px-4 py-3">
                {[1, 2, 3].map(n => (
                  <div key={n} className="flex items-center gap-3">
                    <span className="w-16 shrink-0 text-sm text-slate-500">ระดับ {n}:</span>
                    <Input
                      value={form[`level_${n}_desc`]}
                      onChange={e => setForm(f => ({ ...f, [`level_${n}_desc`]: e.target.value }))}
                      placeholder={n === 1 ? 'Awareness — รู้ว่ามีเรื่องนี้' : ''}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
