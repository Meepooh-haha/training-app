import { useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Search, FileSpreadsheet, Users, AlertTriangle, TrendingDown, Building2 } from 'lucide-react';
import { api } from '../../lib/api.js';
import { levelLabel } from '../../lib/competency-levels.js';
import { Button, Input, Select, Badge, Card } from '../../components/ui.jsx';
import { exportToExcel } from '../../lib/excel-generator.js';

const PRIORITY_META = {
  urgent:       { label: 'เร่งด่วน',     color: 'red' },
  develop:      { label: 'ควรพัฒนา',     color: 'amber' },
  passed:       { label: 'ผ่าน',          color: 'green' },
  not_assessed: { label: 'ยังไม่ประเมิน', color: 'slate' },
};

export default function GapAnalysisPage() {
  const [rows, setRows] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [deptFilter, setDeptFilter] = useState('');
  const [posFilter, setPosFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/gap-analysis'),
      api.get('/departments'),
      api.get('/positions'),
    ]).then(([gap, depts, pos]) => {
      setRows(gap);
      setDepartments(depts);
      setPositions(pos);
    }).catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function reload() {
    const params = new URLSearchParams();
    if (deptFilter) params.set('department_id', deptFilter);
    if (posFilter)  params.set('position_id', posFilter);
    try {
      setRows(await api.get(`/gap-analysis?${params}`));
    } catch (e) {
      toast.error(e.message);
    }
  }

  useEffect(() => { reload(); }, [deptFilter, posFilter]);

  const filtered = useMemo(() =>
    !search ? rows : rows.filter(r => r.employee_name.toLowerCase().includes(search.toLowerCase())),
    [rows, search]
  );

  // Summary stats (computed from all rows, before name search)
  const uniqueEmployees = new Set(rows.map(r => r.employee_code)).size;
  const urgentRows     = rows.filter(r => r.priority === 'urgent');
  const urgentCount    = new Set(urgentRows.map(r => r.employee_code)).size;

  const competencyUrgency = {};
  urgentRows.forEach(r => { competencyUrgency[r.competency_name] = (competencyUrgency[r.competency_name] || 0) + 1; });
  const topCompetency = Object.entries(competencyUrgency).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

  const deptGap = {};
  rows.filter(r => r.priority !== 'passed').forEach(r => {
    if (r.department_name) deptGap[r.department_name] = (deptGap[r.department_name] || 0) + 1;
  });
  const topDept = Object.entries(deptGap).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

  const summaryCards = [
    { icon: Users,         label: 'พนักงานทั้งหมด',              value: uniqueEmployees, color: 'text-brand-600' },
    { icon: AlertTriangle, label: 'มี Gap เร่งด่วน',              value: `${urgentCount} คน`, color: 'text-red-600' },
    { icon: TrendingDown,  label: 'Competency ที่ขาดมากที่สุด',   value: topCompetency, color: 'text-amber-600' },
    { icon: Building2,     label: 'ฝ่ายที่มี Gap สูงสุด',         value: topDept, color: 'text-purple-600' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Gap Analysis</h1>
        <p className="text-sm text-slate-500">วิเคราะห์ช่องว่างสมรรถนะของพนักงาน</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {summaryCards.map(({ icon: Icon, label, value, color }) => (
          <Card key={label} className="p-4">
            <div className="flex items-start gap-3">
              <Icon size={20} className={color} />
              <div>
                <div className="text-xs text-slate-500">{label}</div>
                <div className="mt-0.5 text-lg font-bold text-slate-800 leading-tight">{value}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} className="w-48">
          <option value="">ฝ่าย/แผนก — ทั้งหมด</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select>
        <Select value={posFilter} onChange={e => setPosFilter(e.target.value)} className="w-56">
          <option value="">ตำแหน่ง — ทั้งหมด</option>
          {positions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-2.5 top-2.5 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาชื่อพนักงาน..." className="pl-8" />
        </div>
        <Button variant="secondary" size="sm" onClick={() =>
          exportToExcel(
            filtered.map(r => ({
              พนักงาน: r.employee_name,
              ตำแหน่ง: r.position_code,
              Competency: r.competency_name,
              Required: levelLabel(r.required_level),
              Actual: r.priority === 'not_assessed' ? 'ยังไม่ประเมิน' : levelLabel(r.actual_level),
              Gap: r.priority === 'not_assessed' ? '' : r.gap,
              Priority: PRIORITY_META[r.priority]?.label || r.priority,
            })),
            'gap-analysis', 'Gap Analysis'
          )
        }>
          <FileSpreadsheet size={15} /> Export Excel
        </Button>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-400 text-sm">กำลังโหลด...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">ชื่อพนักงาน</th>
                  <th className="px-4 py-2.5 font-medium">ตำแหน่ง</th>
                  <th className="px-4 py-2.5 font-medium">Competency</th>
                  <th className="px-4 py-2.5 font-medium text-center">Required</th>
                  <th className="px-4 py-2.5 font-medium text-center">Actual</th>
                  <th className="px-4 py-2.5 font-medium text-center">Gap</th>
                  <th className="px-4 py-2.5 font-medium">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                      ไม่มีข้อมูล — ตรวจสอบว่ากำหนด Competency Profile ให้ตำแหน่งงานแล้วหรือยัง
                    </td>
                  </tr>
                )}
                {filtered.map((r, i) => {
                  const meta = PRIORITY_META[r.priority] || PRIORITY_META.not_assessed;
                  return (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-medium">{r.employee_name}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{r.position_code}</td>
                      <td className="px-4 py-2.5">{r.competency_name}</td>
                      <td className="px-4 py-2.5 text-center">{levelLabel(r.required_level)}</td>
                      <td className="px-4 py-2.5 text-center">
                        {r.priority === 'not_assessed' ? <span className="text-slate-400">—</span> : levelLabel(r.actual_level)}
                      </td>
                      <td className="px-4 py-2.5 text-center font-medium">
                        {r.priority === 'not_assessed'
                          ? <span className="text-slate-400">—</span>
                          : <span className={r.gap < 0 ? 'text-red-600' : 'text-green-600'}>{r.gap > 0 ? `+${r.gap}` : r.gap}</span>
                        }
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge color={meta.color}>{meta.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
