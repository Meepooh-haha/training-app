import { Fragment, useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Loader2, FileSpreadsheet, X } from 'lucide-react';
import { api } from '../../lib/api.js';
import { Button, Select } from '../../components/ui.jsx';
import { exportToExcel } from '../../lib/excel-generator.js';

const TYPE_ORDER = ['organizational', 'functional', 'leadership'];
const TYPE_LABEL = {
  organizational: '1. Organizational Competency',
  functional: '2. Functional Competency',
  leadership: '3. Leadership Competency',
};
const LEVEL_BADGE = {
  1: 'bg-slate-100 text-slate-600',
  2: 'bg-blue-100 text-blue-700',
  3: 'bg-emerald-100 text-emerald-700',
};

export default function CompetencyCompareTab() {
  const [departments, setDepartments] = useState([]);
  const [deptFilter, setDeptFilter] = useState('');
  const [allPositions, setAllPositions] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loadingIds, setLoadingIds] = useState(new Set());

  useEffect(() => {
    api.get('/departments').then(setDepartments).catch(e => toast.error(e.message));
    api.get('/positions').then(setAllPositions).catch(e => toast.error(e.message));
  }, []);

  async function addPosition(rawId) {
    if (!rawId) return;
    const id = String(rawId);
    if (selectedIds.includes(id)) return;
    setSelectedIds(prev => [...prev, id]);
    if (profiles[id]) return;
    setLoadingIds(prev => new Set(prev).add(id));
    try {
      const comps = await api.get(`/positions/${id}/competencies`);
      setProfiles(prev => ({ ...prev, [id]: comps }));
    } catch (e) {
      toast.error(e.message);
      setSelectedIds(prev => prev.filter(x => x !== id));
    } finally {
      setLoadingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  }

  function removePosition(id) {
    setSelectedIds(prev => prev.filter(x => x !== id));
    setProfiles(prev => { const p = { ...prev }; delete p[id]; return p; });
  }

  const { grouped, allComps } = useMemo(() => {
    const compMap = {};
    selectedIds.forEach(posId => {
      (profiles[posId] || []).forEach(c => {
        if (!compMap[c.competency_id]) {
          compMap[c.competency_id] = {
            id: c.competency_id,
            competency_code: c.competency_code,
            name: c.name,
            type: c.type,
          };
        }
      });
    });
    const all = Object.values(compMap);
    const g = { organizational: [], functional: [], leadership: [] };
    all.forEach(c => { (g[c.type] ?? g.organizational).push(c); });
    Object.values(g).forEach(arr =>
      arr.sort((a, b) => a.competency_code.localeCompare(b.competency_code))
    );
    return { grouped: g, allComps: all };
  }, [selectedIds, profiles]);

  function getLevel(posId, compId) {
    const found = (profiles[posId] || []).find(c => c.competency_id === compId);
    return found?.required_level ?? null;
  }

  function isDiff(compId) {
    const levels = selectedIds
      .map(id => getLevel(id, compId))
      .filter(l => l !== null);
    return levels.length >= 2 && new Set(levels).size > 1;
  }

  const selectedPosData = selectedIds
    .map(id => allPositions.find(p => String(p.id) === id))
    .filter(Boolean);

  const availablePosData = allPositions.filter(p =>
    !selectedIds.includes(String(p.id)) &&
    (!deptFilter || String(p.department_id) === deptFilter)
  );

  function handleExport() {
    const rows = [];
    TYPE_ORDER.forEach(type => {
      grouped[type].forEach(c => {
        const row = { ประเภท: TYPE_LABEL[type], รหัส: c.competency_code, สมรรถนะ: c.name };
        selectedPosData.forEach(p => {
          const lv = getLevel(String(p.id), c.id);
          row[`${p.name} (${p.code})`] = lv ? `Lv ${lv}` : '—';
        });
        rows.push(row);
      });
    });
    const tag = selectedPosData.map(p => p.code).join('-');
    exportToExcel(rows, `compare-${tag}`, 'Competency Matrix');
  }

  return (
    <div className="space-y-4">
      {/* Position chips + picker */}
      <div className="flex flex-wrap items-center gap-2">
        {selectedPosData.map(p => (
          <div
            key={p.id}
            className="flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700"
          >
            <span>{p.name}</span>
            {loadingIds.has(String(p.id)) && (
              <Loader2 size={12} className="animate-spin" />
            )}
            <button
              onClick={() => removePosition(String(p.id))}
              className="ml-0.5 rounded-full p-0.5 text-brand-400 hover:bg-brand-100 hover:text-brand-700"
              title="ลบออก"
            >
              <X size={12} />
            </button>
          </div>
        ))}

        <Select
          value={deptFilter}
          onChange={e => setDeptFilter(e.target.value)}
          className="h-8 w-48 text-sm"
        >
          <option value="">— ทุกแผนก —</option>
          {departments.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </Select>

        {availablePosData.length > 0 && (
          <Select
            value=""
            onChange={e => addPosition(e.target.value)}
            className="h-8 w-64 text-sm"
          >
            <option value="">+ เพิ่มตำแหน่ง...</option>
            {availablePosData.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
            ))}
          </Select>
        )}

        {allComps.length > 0 && (
          <Button variant="secondary" size="sm" onClick={handleExport}>
            <FileSpreadsheet size={15} /> Export
          </Button>
        )}
      </div>

      {/* Legend */}
      {selectedIds.length > 0 && allComps.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          {[1, 2, 3].map(lv => (
            <span key={lv} className="flex items-center gap-1">
              <span className={`rounded-full px-2 py-0.5 font-medium ${LEVEL_BADGE[lv]}`}>Lv {lv}</span>
              {lv === 1 ? 'พื้นฐาน' : lv === 2 ? 'ชำนาญ' : 'เชี่ยวชาญ'}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-5 rounded bg-amber-100" />
            ระดับต่างกันระหว่างตำแหน่ง
          </span>
        </div>
      )}

      {/* Empty states */}
      {selectedIds.length === 0 && (
        <div className="rounded-lg border border-slate-200 py-16 text-center text-sm text-slate-400">
          เพิ่มตำแหน่งที่ต้องการเปรียบเทียบ เพื่อดู Competency Matrix
        </div>
      )}

      {selectedIds.length > 0 && allComps.length === 0 && loadingIds.size === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-8 text-center text-sm text-amber-800">
          ตำแหน่งที่เลือกยังไม่มี Competency Profile
        </div>
      )}

      {/* Matrix */}
      {allComps.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="sticky left-0 z-20 w-64 min-w-[16rem] border-r border-slate-200 bg-slate-50 px-4 py-3 text-left font-medium text-slate-600">
                  สมรรถนะ
                </th>
                {selectedPosData.map(p => (
                  <th
                    key={p.id}
                    className="min-w-[140px] border-r border-slate-100 px-4 py-3 text-left font-medium text-slate-600 last:border-r-0"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span>{p.name}</span>
                      <button
                        onClick={() => removePosition(String(p.id))}
                        className="mt-0.5 shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                        title="ลบตำแหน่งนี้ออก"
                      >
                        <X size={13} />
                      </button>
                    </div>
                    <div className="mt-0.5 text-xs font-normal text-slate-400">{p.code}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TYPE_ORDER.map(type => {
                const comps = grouped[type];
                if (!comps.length) return null;
                return (
                  <Fragment key={type}>
                    <tr className="border-y border-slate-200 bg-slate-50">
                      <td
                        colSpan={selectedPosData.length + 1}
                        className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500"
                      >
                        {TYPE_LABEL[type]}
                      </td>
                    </tr>
                    {comps.map(c => {
                      const diff = isDiff(c.id);
                      return (
                        <tr
                          key={c.id}
                          className={`group border-b border-slate-100 ${diff ? 'bg-amber-50' : 'hover:bg-slate-50'}`}
                        >
                          <td
                            className={`sticky left-0 z-10 border-r border-slate-200 px-4 py-2.5 ${
                              diff ? 'bg-amber-50' : 'bg-white group-hover:bg-slate-50'
                            }`}
                          >
                            <div className="font-medium text-slate-700">{c.name}</div>
                            <div className="text-xs text-slate-400">{c.competency_code}</div>
                          </td>
                          {selectedPosData.map(p => {
                            const lv = getLevel(String(p.id), c.id);
                            return (
                              <td
                                key={p.id}
                                className="border-r border-slate-100 px-4 py-2.5 text-center last:border-r-0"
                              >
                                {loadingIds.has(String(p.id)) ? (
                                  <Loader2 size={14} className="mx-auto animate-spin text-slate-300" />
                                ) : lv !== null ? (
                                  <span
                                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${LEVEL_BADGE[lv] ?? 'bg-slate-100 text-slate-600'}`}
                                  >
                                    Lv {lv}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
