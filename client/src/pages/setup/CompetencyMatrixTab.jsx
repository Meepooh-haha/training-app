import { Fragment, useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Loader2, FileSpreadsheet } from 'lucide-react';
import { api } from '../../lib/api.js';
import { LEVEL_OPTIONS } from '../../lib/competency-levels.js';
import { Button, Select, Field } from '../../components/ui.jsx';
import { exportToExcel } from '../../lib/excel-generator.js';

const TYPE_ORDER = ['organizational', 'functional', 'leadership'];
const TYPE_LABEL = { organizational: 'Core', functional: 'Functional', leadership: 'Leadership' };

export default function CompetencyMatrixTab() {
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [deptId, setDeptId] = useState('');
  const [posId, setPosId] = useState('');
  const [posName, setPosName] = useState('');
  const [competencies, setCompetencies] = useState([]);
  const [levels, setLevels] = useState({});   // competency_id → required_level
  const [saving, setSaving] = useState(new Set());

  useEffect(() => {
    api.get('/departments').then(setDepartments).catch(e => toast.error(e.message));
  }, []);

  async function onDeptChange(id) {
    setDeptId(id);
    setPosId('');
    setPosName('');
    setCompetencies([]);
    setLevels({});
    if (!id) { setPositions([]); return; }
    try {
      setPositions(await api.get(`/positions?department_id=${id}`));
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function onPosChange(id) {
    setPosId(id);
    setCompetencies([]);
    setLevels({});
    if (!id) { setPosName(''); return; }
    const pos = positions.find(p => String(p.id) === String(id));
    setPosName(pos?.name || '');
    try {
      const comps = await api.get(`/positions/${id}/competencies`);
      setCompetencies(comps);
      const map = {};
      comps.forEach(c => { map[c.competency_id] = c.required_level; });
      setLevels(map);
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function changeLevel(competencyId, newLevel) {
    setLevels(prev => ({ ...prev, [competencyId]: Number(newLevel) }));
    setSaving(prev => new Set(prev).add(competencyId));
    try {
      await api.put(`/positions/${posId}/competencies/${competencyId}`, {
        required_level: Number(newLevel),
      });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(prev => { const s = new Set(prev); s.delete(competencyId); return s; });
    }
  }

  const grouped = useMemo(() => {
    const g = { organizational: [], functional: [], leadership: [] };
    competencies.forEach(c => { (g[c.type] ?? g.organizational).push(c); });
    return g;
  }, [competencies]);

  function handleExport() {
    const rows = competencies.map(c => ({
      ประเภท: TYPE_LABEL[c.type] || c.type,
      รหัส: c.competency_code,
      ชื่อสมรรถนะ: c.name,
      ระดับที่ต้องการ: levels[c.competency_id] ? `Lv ${levels[c.competency_id]}` : '—',
    }));
    exportToExcel(rows, `matrix-${posId}`, `ตารางสมรรถนะ — ${posName}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="ฝ่าย/แผนก" className="w-64">
          <Select value={deptId} onChange={e => onDeptChange(e.target.value)}>
            <option value="">— เลือกฝ่าย/แผนก —</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </Field>

        <Field label="ตำแหน่งงาน" className="w-72">
          <Select value={posId} onChange={e => onPosChange(e.target.value)} disabled={!deptId}>
            <option value="">— เลือกตำแหน่ง —</option>
            {positions.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
          </Select>
        </Field>

        {competencies.length > 0 && (
          <Button variant="secondary" size="sm" onClick={handleExport} className="mb-0.5">
            <FileSpreadsheet size={15} /> Export
          </Button>
        )}
      </div>

      {!deptId && (
        <div className="rounded-lg border border-slate-200 py-16 text-center text-slate-400 text-sm">
          เลือกฝ่าย/แผนก และตำแหน่งเพื่อดูและแก้ไขระดับ Competency
        </div>
      )}

      {deptId && !posId && positions.length > 0 && (
        <div className="rounded-lg border border-slate-200 py-16 text-center text-slate-400 text-sm">
          เลือกตำแหน่งงานเพื่อดู Competency Profile
        </div>
      )}

      {posId && competencies.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-800">
          ตำแหน่งนี้ยังไม่มี Competency Profile — เพิ่ม Competency ใน Dictionary แล้วกำหนดตำแหน่งที่ใช้
        </div>
      )}

      {competencies.length > 0 && (
        <div className="space-y-4">
          <div className="text-sm font-medium text-slate-700">
            {posName} — {competencies.length} สมรรถนะ
            <span className="ml-2 text-xs text-slate-400">เปลี่ยนระดับแล้วบันทึกอัตโนมัติ</span>
          </div>

          {TYPE_ORDER.map(type => {
            const comps = grouped[type];
            if (!comps.length) return null;
            return (
              <Fragment key={type}>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {TYPE_LABEL[type]}
                </div>
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-slate-500">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">สมรรถนะ</th>
                        <th className="px-4 py-2.5 font-medium w-52">ระดับที่ต้องการ</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {comps.map(c => (
                        <tr key={c.competency_id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5">
                            <div className="font-medium text-slate-700">{c.name}</div>
                            <div className="text-xs text-slate-400">{c.competency_code}</div>
                          </td>
                          <td className="px-4 py-2.5">
                            <Select
                              value={levels[c.competency_id] ?? ''}
                              onChange={e => changeLevel(c.competency_id, e.target.value)}
                              className="w-44"
                            >
                              {LEVEL_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </Select>
                          </td>
                          <td className="pr-4 text-slate-400">
                            {saving.has(c.competency_id) && <Loader2 size={14} className="animate-spin" />}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
