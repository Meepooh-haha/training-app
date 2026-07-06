import { useState, useEffect, useCallback } from 'react';
import { Loader2, FileText, FileDown, Users, Wallet, Star, CalendarClock } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import { exportProjectSummary } from '../../lib/pdf-generator.js';
import { useProject, APPROVAL_BADGE } from './ProjectShell.jsx';

const money = (n) => Number(n || 0).toLocaleString('th-TH');

function Stat({ icon: Icon, label, value, sub }) {
  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-4">
      <div className="flex items-center gap-2 text-xs text-ink-400">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="mt-1 text-xl font-bold text-ink-900 font-display">{value}</div>
      {sub && <div className="text-xs text-ink-400 mt-0.5">{sub}</div>}
    </div>
  );
}

// Phase 4: รายงานสรุปโครงการ — รวมทุกมิติจากข้อมูลที่กรอกไว้แล้วตลอด workflow
// ไม่ต้องกรอกอะไรเพิ่ม อ่านอย่างเดียว + export PDF
export default function SummaryReportPage() {
  const { project } = useProject();
  const [data, setData] = useState(null);

  const load = useCallback(() => {
    api.get(`/training-projects/${project.id}/summary`).then(setData).catch((e) => toast.error(e.message));
  }, [project.id]);

  useEffect(() => { load(); }, [load]);

  if (!data) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-ink-400" /></div>;
  }

  const p = data.project;
  const badge = APPROVAL_BADGE[p.approval_status] ?? APPROVAL_BADGE.draft;
  const evalLatest = data.evaluation.latest;

  return (
    <div className="space-y-5 font-body">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink-900 font-display flex items-center gap-2">
            <FileText className="w-5 h-5" /> รายงานสรุปโครงการ
          </h2>
          <p className="text-sm text-ink-500 mt-0.5">สรุปอัตโนมัติจากข้อมูลทุก phase — ไม่ต้องกรอกซ้ำ</p>
        </div>
        <button
          onClick={() => exportProjectSummary(data).catch((e) => toast.error(e.message, { duration: 8000 }))}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: '#710F16' }}
        >
          <FileDown className="w-4 h-4" /> Export PDF
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          icon={Users}
          label="ผู้เข้าอบรม"
          value={`${data.participants.checked_in}/${data.participants.total} คน`}
          sub={`อัตราเข้าอบรม ${data.participants.rate}%`}
        />
        <Stat
          icon={Wallet}
          label="งบประมาณที่ขอ"
          value={`${money(data.budget.total)} ฿`}
          sub={data.prs.length ? `PR: ${data.prs.map((x) => x.pr_no).join(', ')}` : 'ยังไม่ออก PR'}
        />
        <Stat
          icon={Star}
          label="คะแนนประเมินเฉลี่ย"
          value={data.evaluation.avg_score != null ? `${data.evaluation.avg_score} / 5` : '—'}
          sub={evalLatest ? (evalLatest.status === 'pass' ? 'ผ่านเกณฑ์' : 'ไม่ผ่านเกณฑ์') : 'ยังไม่ประเมิน'}
        />
        <Stat
          icon={CalendarClock}
          label="ชั่วโมงอบรม"
          value={`${(data.schedule.total_minutes / 60).toFixed(1)} ชม.`}
          sub={`${data.schedule.topics.length} หัวข้อ`}
        />
      </div>

      {/* รายละเอียดโครงการ */}
      <div className="rounded-2xl border border-ink-200 bg-white p-5 space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-ink-800 font-display">ข้อมูลโครงการ</h3>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.color }}>
            {badge.label}{p.approved_by ? ` · ${p.approved_by}` : ''}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div><p className="text-xs text-ink-400">หลักสูตร</p><p className="text-ink-800">{p.course_name_th || '—'}</p></div>
          <div><p className="text-xs text-ink-400">วันที่อบรม</p><p className="text-ink-800">{p.training_date || '—'}{p.end_date && p.end_date !== p.training_date ? ` – ${p.end_date}` : ''}</p></div>
          <div><p className="text-xs text-ink-400">สถานที่</p><p className="text-ink-800">{p.location || '—'}</p></div>
          <div><p className="text-xs text-ink-400">วิทยากร</p><p className="text-ink-800">{p.trainer_name || '—'}{p.trainer_org ? ` (${p.trainer_org})` : ''}</p></div>
          <div><p className="text-xs text-ink-400">กลุ่มเป้าหมาย</p><p className="text-ink-800">{p.target_group || '—'}</p></div>
          <div><p className="text-xs text-ink-400">บันทึกประวัติ</p><p className="text-ink-800">{data.records.count ? `${data.records.count} รายการ` : 'ยังไม่บันทึก'}</p></div>
          {p.objective && (
            <div className="col-span-2 sm:col-span-3"><p className="text-xs text-ink-400">วัตถุประสงค์</p><p className="text-ink-800 whitespace-pre-wrap">{p.objective}</p></div>
          )}
        </div>
      </div>

      {/* งบประมาณ */}
      <div className="rounded-2xl border border-ink-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-ink-100 font-semibold text-ink-800 font-display text-sm">งบประมาณ</div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-ink-50">
            {[
              ['ค่าวิทยากร', data.budget.instructor],
              ['ค่าสถานที่', data.budget.venue],
              ['ค่าอาหารและเครื่องดื่ม', data.budget.food],
              ['ค่าเอกสารและอุปกรณ์', data.budget.material],
              ['อื่น ๆ', data.budget.other],
            ].map(([label, amt]) => (
              <tr key={label}>
                <td className="px-5 py-2 text-ink-600">{label}</td>
                <td className="px-5 py-2 text-right text-ink-800">{money(amt)}</td>
              </tr>
            ))}
            <tr style={{ background: '#FAF7F6' }}>
              <td className="px-5 py-2.5 font-semibold text-ink-900">รวมทั้งสิ้น</td>
              <td className="px-5 py-2.5 text-right font-bold text-ink-900">{money(data.budget.total)} บาท</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* กำหนดการ */}
      {data.schedule.topics.length > 0 && (
        <div className="rounded-2xl border border-ink-200 bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-ink-100 font-semibold text-ink-800 font-display text-sm">กำหนดการ</div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-ink-50">
              {data.schedule.topics.map((t, i) => (
                <tr key={t.id ?? i}>
                  <td className="px-5 py-2 text-ink-400 text-xs w-10">{i + 1}</td>
                  <td className="px-5 py-2 text-ink-800">{t.topic_name}</td>
                  <td className="px-5 py-2 text-ink-500 text-xs whitespace-nowrap">{t.date || '—'}</td>
                  <td className="px-5 py-2 text-ink-500 text-xs whitespace-nowrap">{t.start_time ? `${t.start_time}–${t.end_time || ''}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
