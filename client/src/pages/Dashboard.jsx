import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from 'recharts';
import { CalendarDays, Wallet, Star, FileText, Landmark } from 'lucide-react';
import { api } from '../lib/api.js';
import { Card, Badge, STATUS_META } from '../components/ui.jsx';

const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/dashboard/stats').then(setStats).catch(() => {});
  }, []);

  if (!stats) return <div className="text-slate-400">กำลังโหลด...</div>;

  const monthData = stats.byMonth.map((m) => ({ name: MONTHS[m.month - 1], count: m.count, planned: m.planned, used: m.used }));
  const gauge = [{ name: 'avg', value: stats.avgScore, fill: '#2563eb' }];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">แดชบอร์ด</h1>
        <p className="text-sm text-slate-500">ภาพรวมการฝึกอบรมประจำปี {stats.year + 543}</p>
      </div>

      {/* เตือนยื่น ยป. กรมพัฒนาฝีมือแรงงาน — โครงการ กพร. ที่ใกล้/เลยกำหนดยื่นแล้วยังไม่ยื่น */}
      {(stats.dsdAlerts || []).length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
            <Landmark size={16} /> ต้องยื่น ยป. กรมพัฒนาฝีมือแรงงาน ({stats.dsdAlerts.length} โครงการ)
          </div>
          <ul className="space-y-1">
            {stats.dsdAlerts.map((a) => (
              <li
                key={a.id}
                onClick={() => navigate(`/development/workflow/${a.id}`)}
                className="flex flex-wrap items-center gap-x-2 text-sm cursor-pointer hover:underline underline-offset-2"
              >
                <span className={`font-semibold ${a.days_left < 0 ? 'text-red-700' : 'text-amber-800'}`}>
                  {a.days_left < 0 ? `เลยกำหนดมา ${-a.days_left} วัน` : `เหลือ ${a.days_left} วัน`}
                </span>
                <span className="text-slate-700">— {a.req_no} {a.name}</span>
                <span className="text-xs text-slate-500">(กำหนดยื่น {a.deadline} · อบรม {a.training_date})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={CalendarDays} color="bg-brand-600" label="การอบรมปีนี้" value={`${stats.totalThisYear} ครั้ง`} />
        <Kpi icon={Wallet} color="bg-emerald-600" label="งบประมาณที่วางแผน" value={`${stats.totalPlanned.toLocaleString('th-TH')} ฿`} />
        <Kpi icon={Wallet} color="bg-amber-500" label="งบที่อนุมัติแล้ว" value={`${stats.totalUsed.toLocaleString('th-TH')} ฿`} />
        <Kpi icon={Star} color="bg-violet-600" label="คะแนนประเมินเฉลี่ย" value={`${stats.avgScore} / 5`} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Trainings by month */}
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 font-semibold text-slate-800">จำนวนการอบรมรายเดือน</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthData}>
              <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="count" name="จำนวนครั้ง" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Avg score gauge */}
        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-slate-800">คะแนนประเมินเฉลี่ย</h2>
          <ResponsiveContainer width="100%" height={260}>
            <RadialBarChart innerRadius="70%" outerRadius="100%" data={gauge} startAngle={210} endAngle={-30}>
              <PolarAngleAxis type="number" domain={[0, 5]} tick={false} />
              <RadialBar dataKey="value" cornerRadius={10} background />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="-mt-16 text-center">
            <div className="text-3xl font-bold text-brand-700">{stats.avgScore}</div>
            <div className="text-xs text-slate-400">จากคะแนนเต็ม 5</div>
          </div>
        </Card>
      </div>

      {/* Budget planned vs used */}
      <Card className="p-5">
        <h2 className="mb-4 font-semibold text-slate-800">งบประมาณ: วางแผน vs อนุมัติ (รายเดือน)</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={monthData}>
            <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis fontSize={12} tickLine={false} axisLine={false} width={70} tickFormatter={(v) => v.toLocaleString('th-TH')} />
            <Tooltip formatter={(v) => `${Number(v).toLocaleString('th-TH')} ฿`} />
            <Legend />
            <Bar dataKey="planned" name="วางแผน" fill="#93c5fd" radius={[4, 4, 0, 0]} />
            <Bar dataKey="used" name="อนุมัติแล้ว" fill="#2563eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Recent projects */}
      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 p-4">
          <h2 className="font-semibold text-slate-800">โครงการอบรมล่าสุด</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">เลขที่</th>
                <th className="px-4 py-2.5 font-medium">โครงการ</th>
                <th className="px-4 py-2.5 font-medium">วันที่อบรม</th>
                <th className="px-4 py-2.5 font-medium">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.recent.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400">ยังไม่มีข้อมูล</td>
                </tr>
              )}
              {stats.recent.map((r) => (
                <tr
                  key={r.id}
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => navigate(`/development/workflow/${r.id}`)}
                >
                  <td className="px-4 py-2.5 font-medium">{r.req_no}</td>
                  <td className="px-4 py-2.5">{r.name || r.course_name_th || '-'}</td>
                  <td className="px-4 py-2.5">{r.training_date || '-'}</td>
                  <td className="px-4 py-2.5">
                    <Badge color={STATUS_META[r.status]?.color}>{STATUS_META[r.status]?.label}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Kpi({ icon: Icon, color, label, value }) {
  return (
    <Card className="flex items-center gap-4 p-4">
      <div className={`flex h-12 w-12 items-center justify-center rounded-lg text-white ${color}`}>
        <Icon size={22} />
      </div>
      <div>
        <div className="text-sm text-slate-500">{label}</div>
        <div className="text-xl font-bold text-slate-800">{value}</div>
      </div>
    </Card>
  );
}
