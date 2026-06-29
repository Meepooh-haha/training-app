import { useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Save, ClipboardPen } from 'lucide-react';
import { api } from '../../lib/api.js';
import { LEVEL_OPTIONS, levelLabel } from '../../lib/competency-levels.js';
import { Button, Select, Field, Card, Badge } from '../../components/ui.jsx';

const TYPE_LABEL = { organizational: 'Core', functional: 'Functional', leadership: 'Leadership' };
const TYPE_ORDER = ['organizational', 'functional', 'leadership'];

const LEVEL_BADGE = {
  1: 'bg-brand-100 text-brand-700',
  2: 'bg-green-100 text-green-700',
  3: 'bg-purple-100 text-purple-700',
};

export default function CompetencyScoresPage() {
  const [employees, setEmployees] = useState([]);
  const [selectedCode, setSelectedCode] = useState('');
  const [employee, setEmployee] = useState(null);
  const [required, setRequired] = useState([]);   // from position profile
  const [scores, setScores] = useState({});        // competency_id → { actual_level, assessed_date }
  const [saving, setSaving] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    api.get('/employees').then(setEmployees).catch(e => toast.error(e.message));
  }, []);

  async function selectEmployee(code) {
    setSelectedCode(code);
    setRequired([]);
    setScores({});
    if (!code) { setEmployee(null); return; }

    const emp = employees.find(e => e.code === code);
    setEmployee(emp || null);
    if (!emp?.position_id) return;

    try {
      const [posComps, empScores] = await Promise.all([
        api.get(`/positions/${emp.position_id}/competencies`),
        api.get(`/employees/${code}/competency-scores`),
      ]);
      setRequired(posComps);

      const map = {};
      empScores.forEach(s => {
        map[s.competency_id] = {
          actual_level: s.actual_level,
          assessed_date: s.assessed_date || today,
        };
      });
      setScores(map);
    } catch (e) {
      toast.error(e.message);
    }
  }

  function setScore(competencyId, field, value) {
    setScores(prev => ({
      ...prev,
      [competencyId]: {
        actual_level: prev[competencyId]?.actual_level ?? '',
        assessed_date: prev[competencyId]?.assessed_date ?? today,
        ...prev[competencyId],
        [field]: value,
      },
    }));
  }

  async function saveAll() {
    const toSave = required.filter(c => scores[c.competency_id]?.actual_level);
    if (!toSave.length) { toast.error('กรุณาระบุระดับจริงอย่างน้อย 1 รายการ'); return; }

    setSaving(true);
    try {
      await Promise.all(toSave.map(c =>
        api.post(`/employees/${selectedCode}/competency-scores`, {
          competency_id: c.competency_id,
          actual_level: Number(scores[c.competency_id].actual_level),
          assessed_date: scores[c.competency_id].assessed_date || today,
          assessor_type: 'manager',
        })
      ));
      toast.success(`บันทึก ${toSave.length} รายการสำเร็จ`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  const grouped = useMemo(() => {
    const g = { organizational: [], functional: [], leadership: [] };
    required.forEach(c => { (g[c.type] ?? g.organizational).push(c); });
    return g;
  }, [required]);

  const filledCount = required.filter(c => scores[c.competency_id]?.actual_level).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">ประเมินสมรรถนะพนักงาน</h1>
        <p className="text-sm text-slate-500">บันทึกระดับสมรรถนะจริงของพนักงาน เพื่อใช้ใน Gap Analysis</p>
      </div>

      <div className="flex items-end gap-3">
        <Field label="เลือกพนักงาน" className="flex-1 max-w-sm">
          <Select value={selectedCode} onChange={e => selectEmployee(e.target.value)}>
            <option value="">— เลือกพนักงาน —</option>
            {employees.map(e => (
              <option key={e.code} value={e.code}>{e.full_name} ({e.code})</option>
            ))}
          </Select>
        </Field>
        {required.length > 0 && (
          <Button onClick={saveAll} disabled={saving || !filledCount}>
            <Save size={15} /> บันทึก ({filledCount}/{required.length})
          </Button>
        )}
      </div>

      {employee && required.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ตำแหน่ง "{employee.position_th}" ยังไม่มีการกำหนด Competency Profile — กรุณาตั้งค่าใน Setup → ตารางสมรรถนะ ก่อน
        </div>
      )}

      {!employee && (
        <div className="flex h-48 items-center justify-center rounded-xl border-2 border-dashed border-slate-200 text-slate-400 text-sm">
          <div className="flex flex-col items-center gap-2">
            <ClipboardPen size={28} className="text-slate-300" />
            เลือกพนักงานเพื่อเริ่มประเมินสมรรถนะ
          </div>
        </div>
      )}

      {employee && required.length > 0 && (
        <>
          <Card className="p-4">
            <div className="text-lg font-semibold text-slate-800">{employee.full_name}</div>
            <div className="text-sm text-slate-500">{employee.position_th} · {employee.department}</div>
          </Card>

          {TYPE_ORDER.map(type => {
            const comps = grouped[type];
            if (!comps.length) return null;
            return (
              <div key={type}>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {TYPE_LABEL[type]}
                </div>
                <Card className="overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-slate-500">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">สมรรถนะ</th>
                        <th className="px-4 py-2.5 font-medium text-center w-32">ระดับที่ต้องการ</th>
                        <th className="px-4 py-2.5 font-medium w-44">ระดับจริง</th>
                        <th className="px-4 py-2.5 font-medium w-36">วันที่ประเมิน</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {comps.map(c => {
                        const score = scores[c.competency_id] || {};
                        const gap = score.actual_level
                          ? Number(score.actual_level) - c.required_level
                          : null;
                        return (
                          <tr key={c.competency_id} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5">
                              <div className="font-medium text-slate-700">{c.name}</div>
                              <div className="text-xs text-slate-400">{c.competency_code}</div>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${LEVEL_BADGE[c.required_level] ?? 'bg-slate-100 text-slate-600'}`}>
                                {levelLabel(c.required_level)}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <select
                                  value={score.actual_level ?? ''}
                                  onChange={e => setScore(c.competency_id, 'actual_level', e.target.value)}
                                  className="h-8 rounded border border-slate-300 px-2 text-sm w-36"
                                >
                                  <option value="">— ยังไม่ประเมิน —</option>
                                  {LEVEL_OPTIONS.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                  ))}
                                </select>
                                {gap !== null && (
                                  <span className={`text-xs font-semibold ${gap < 0 ? 'text-red-500' : 'text-green-600'}`}>
                                    {gap > 0 ? `+${gap}` : gap}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <input
                                type="date"
                                value={score.assessed_date ?? today}
                                onChange={e => setScore(c.competency_id, 'assessed_date', e.target.value)}
                                className="h-8 w-full rounded border border-slate-300 px-2 text-sm"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Card>
              </div>
            );
          })}

          <div className="flex justify-end">
            <Button onClick={saveAll} disabled={saving || !filledCount}>
              <Save size={15} /> บันทึก ({filledCount}/{required.length})
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
