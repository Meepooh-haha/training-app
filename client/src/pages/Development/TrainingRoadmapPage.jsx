import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FileSpreadsheet, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api.js';
import { Button, Select, Badge, Card, Field } from '../../components/ui.jsx';
import { exportToExcel } from '../../lib/excel-generator.js';

const STATUS_LABELS = {
  not_started: 'ยังไม่เริ่ม',
  in_progress: 'กำลังอบรม',
  completed:   'เสร็จแล้ว',
  waived:      'ยกเว้น',
};

const STATUS_COLORS = {
  not_started: 'slate',
  in_progress: 'blue',
  completed:   'green',
  waived:      'amber',
};

export default function TrainingRoadmapPage() {
  const [employees, setEmployees] = useState([]);
  const [selectedCode, setSelectedCode] = useState('');
  const [employee, setEmployee] = useState(null);
  const [roadmap, setRoadmap] = useState([]);
  const [gapRows, setGapRows] = useState([]);
  const [courses, setCourses] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/employees').then(setEmployees).catch(e => toast.error(e.message));
    api.get('/courses').then(setCourses).catch(e => toast.error(e.message));
  }, []);

  async function selectEmployee(code) {
    setSelectedCode(code);
    if (!code) { setEmployee(null); setRoadmap([]); setGapRows([]); return; }
    const emp = employees.find(e => e.code === code);
    setEmployee(emp || null);
    try {
      const [rm, gap] = await Promise.all([
        api.get(`/roadmap/${code}`),
        api.get(`/gap-analysis?employee_code=${code}`),
      ]);
      setRoadmap(rm);
      setGapRows(gap.filter(r => r.priority !== 'passed'));
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function generateFromGap() {
    if (!selectedCode) return;
    setSaving(true);
    try {
      const needsDev = gapRows.filter(r => r.priority !== 'passed');
      await Promise.all(needsDev.map((r, i) =>
        api.post(`/roadmap/${selectedCode}`, {
          competency_id: r.competency_id,
          priority_order: i + 1,
          status: 'not_started',
        })
      ));
      const rm = await api.get(`/roadmap/${selectedCode}`);
      setRoadmap(rm);
      toast.success('สร้าง Roadmap จาก Gap สำเร็จ');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateRow(id, field, value) {
    try {
      const row = roadmap.find(r => r.id === id);
      await api.put(`/roadmap/${selectedCode}/${id}`, {
        status: field === 'status' ? value : row.status,
        target_quarter: field === 'target_quarter' ? value : row.target_quarter,
        course_code: field === 'course_code' ? value : row.course_code,
        notes: row.notes || '',
      });
      setRoadmap(rm => rm.map(r => r.id === id ? { ...r, [field]: value } : r));
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Training Roadmap</h1>
        <p className="text-sm text-slate-500">แผนพัฒนารายบุคคล (IDP)</p>
      </div>

      {/* Employee selector */}
      <div className="flex items-center gap-3">
        <Field label="เลือกพนักงาน" className="flex-1 max-w-sm">
          <Select value={selectedCode} onChange={e => selectEmployee(e.target.value)}>
            <option value="">— เลือกพนักงาน —</option>
            {employees.map(e => (
              <option key={e.code} value={e.code}>{e.full_name} ({e.code})</option>
            ))}
          </Select>
        </Field>
      </div>

      {employee && (
        <>
          {/* Employee card */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold text-slate-800">{employee.full_name}</div>
                <div className="text-sm text-slate-500">{employee.position_th} · {employee.department}</div>
              </div>
              <div className="flex gap-2">
                {gapRows.length > 0 && (
                  <Button variant="secondary" size="sm" onClick={generateFromGap} disabled={saving}>
                    <RefreshCw size={14} /> Auto-generate จาก Gap
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={() =>
                  exportToExcel(
                    roadmap.map((r, i) => ({
                      ลำดับ: i + 1,
                      Competency: r.competency_name,
                      Gap: r.gap ?? '—',
                      หลักสูตรแนะนำ: r.course_name || '—',
                      สถานะ: STATUS_LABELS[r.status] || r.status,
                      เป้าหมาย: r.target_quarter || '—',
                    })),
                    `roadmap-${employee.code}`, `Roadmap — ${employee.full_name}`
                  )
                }>
                  <FileSpreadsheet size={14} /> Export Excel
                </Button>
              </div>
            </div>
          </Card>

          {/* Gap summary (non-passed) */}
          {gapRows.length > 0 && roadmap.length === 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              พบ {gapRows.length} Competency ที่ต้องพัฒนา — กด "Auto-generate จาก Gap" เพื่อสร้าง Roadmap อัตโนมัติ
            </div>
          )}

          {/* Roadmap table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5 font-medium w-8">ลำดับ</th>
                    <th className="px-4 py-2.5 font-medium">Competency</th>
                    <th className="px-4 py-2.5 font-medium text-center">Gap</th>
                    <th className="px-4 py-2.5 font-medium">หลักสูตรแนะนำ</th>
                    <th className="px-4 py-2.5 font-medium">สถานะ</th>
                    <th className="px-4 py-2.5 font-medium">เป้าหมาย</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {roadmap.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                        ยังไม่มี Roadmap — กด "Auto-generate จาก Gap" หรือเพิ่มด้วยตนเอง
                      </td>
                    </tr>
                  )}
                  {roadmap.map((r, i) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-center text-slate-400">{i + 1}</td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{r.competency_name}</div>
                        <div className="text-xs text-slate-400">{r.competency_code}</div>
                      </td>
                      <td className="px-4 py-2.5 text-center font-medium">
                        <GapCell priority={r.priority} gap={r.gap} />
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          value={r.course_code || ''}
                          onChange={e => updateRow(r.id, 'course_code', e.target.value || null)}
                          className="h-8 w-full max-w-xs rounded border border-slate-300 px-2 text-sm"
                        >
                          <option value="">— ไม่ระบุ —</option>
                          {courses.map(c => <option key={c.code} value={c.code}>{c.name_th}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          value={r.status}
                          onChange={e => updateRow(r.id, 'status', e.target.value)}
                          className="h-8 rounded border border-slate-300 px-2 text-sm"
                        >
                          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="text"
                          value={r.target_quarter || ''}
                          onChange={e => updateRow(r.id, 'target_quarter', e.target.value)}
                          placeholder="เช่น Q3/2568"
                          className="h-8 w-28 rounded border border-slate-300 px-2 text-sm"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {!employee && (
        <div className="flex h-48 items-center justify-center rounded-xl border-2 border-dashed border-slate-200 text-slate-400 text-sm">
          เลือกพนักงานเพื่อดู Training Roadmap
        </div>
      )}
    </div>
  );
}

function GapCell({ priority, gap }) {
  if (priority === 'not_assessed') return <span className="text-slate-400 text-xs">ยังไม่ประเมิน</span>;
  if (gap == null) return <span className="text-slate-400">—</span>;
  if (gap >= 0) return <span className="text-green-600">+{gap}</span>;
  return <span className="text-red-600">{gap}</span>;
}
