import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Archive, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import { fmtDuration } from '../../lib/coursePlanUtils.js';
import { useProject } from './ProjectShell.jsx';

const RESULT_BADGE = {
  pass: { label: 'ผ่าน', bg: '#E3F4EC', color: '#1E7A52' },
  fail: { label: 'ไม่ผ่าน', bg: '#FEE2E2', color: '#B91C1C' },
};

// Phase 4: บันทึกประวัติการอบรมเข้าแฟ้มพนักงานรายคน + อัปเดต Roadmap (IDP)
// ของคนที่เข้าอบรมเป็น completed อัตโนมัติ — ปิดลูป Setup → Workflow → กลับไป Setup
export default function TrainingRecordsPage() {
  const { project, status, reload: reloadShell } = useProject();
  const [records, setRecords] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setRecords(await api.get(`/training-projects/${project.id}/records`));
    } catch (e) {
      toast.error(e.message);
    }
  }, [project.id]);

  useEffect(() => { load(); }, [load]);

  async function record() {
    const isPublic = project.delivery_type === 'public';
    const attended = status?.registration?.checked_in ?? 0;
    const lines = [
      `บันทึกประวัติผู้เข้าอบรม ${project.participant_count} คนเข้าแฟ้มพนักงาน`,
      isPublic
        ? 'โครงการ Public: ทุกคนในรายชื่อถือว่าไปเรียนแล้ว (ถ้าใครไม่ได้ไป เอาออกจากรายชื่อก่อน)'
        : attended === 0
          ? '⚠ ยังไม่มีใครเช็คอิน — ทุกคนจะถูกบันทึกเป็น "ไม่เข้าอบรม"'
          : `ผู้เข้าอบรมจริง (เช็คอิน) ${attended} คน`,
      'Roadmap/IDP ของคนที่เข้าอบรมในหลักสูตรนี้จะถูกปรับเป็น "สำเร็จ" อัตโนมัติ',
      records?.length ? 'ประวัติชุดเดิมของโครงการนี้จะถูกแทนที่' : '',
    ].filter(Boolean);
    if (!window.confirm(lines.join('\n'))) return;

    setSaving(true);
    try {
      const res = await api.post(`/training-projects/${project.id}/records`, {});
      toast.success(
        `บันทึกประวัติ ${res.records} รายการ (เข้าอบรม ${res.attended} คน)` +
        (res.roadmaps_completed ? ` · อัปเดต IDP สำเร็จ ${res.roadmaps_completed} รายการ` : ''),
        { duration: 6000 },
      );
      await load();
      await reloadShell();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (records === null) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-ink-400" /></div>;
  }

  const hasRecords = records.length > 0;

  return (
    <div className="space-y-5 font-body">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink-900 font-display flex items-center gap-2">
            <Archive className="w-5 h-5" /> ประวัติการอบรม
          </h2>
          <p className="text-sm text-ink-500 mt-0.5">
            บันทึกผลเข้าแฟ้มพนักงานรายคน — Roadmap/IDP ของผู้เข้าอบรมอัปเดตให้อัตโนมัติ
          </p>
        </div>
        <button
          onClick={record}
          disabled={saving || !project.participant_count}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: '#710F16' }}
        >
          {hasRecords ? <RefreshCw className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
          {saving ? 'กำลังบันทึก…' : hasRecords ? 'บันทึกใหม่ (แทนที่ชุดเดิม)' : 'บันทึกประวัติเข้าแฟ้ม'}
        </button>
      </div>

      {!project.participant_count && (
        <div className="rounded-lg px-4 py-2.5 text-xs" style={{ background: '#FCEBEC', color: '#710F16' }}>
          ยังไม่มีรายชื่อผู้เข้าอบรม — เพิ่มที่หน้า{' '}
          <Link to={`/development/workflow/${project.id}/participants`} className="underline underline-offset-2 font-semibold">
            ผู้เข้าอบรม
          </Link>{' '}
          ก่อน
        </div>
      )}

      {hasRecords ? (
        <>
          <p className="text-xs text-ink-400">
            บันทึกล่าสุดเมื่อ {records[0].recorded_at} · หลักสูตร {records[0].course_name || '—'} · {fmtDuration(Math.round((records[0].hours || 0) * 60))}
          </p>
          <div className="rounded-2xl border border-ink-200 bg-white overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="text-left text-ink-400 text-xs" style={{ background: '#FAF7F6' }}>
                <tr>
                  <th className="px-4 py-2.5 font-medium">รหัส</th>
                  <th className="px-4 py-2.5 font-medium">ชื่อ-นามสกุล</th>
                  <th className="px-4 py-2.5 font-medium">ฝ่าย/แผนก</th>
                  <th className="px-4 py-2.5 font-medium text-center">เข้าอบรม</th>
                  <th className="px-4 py-2.5 font-medium text-right">ชั่วโมง</th>
                  <th className="px-4 py-2.5 font-medium text-center">ผล</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {records.map((r) => {
                  const badge = RESULT_BADGE[r.result];
                  return (
                    <tr key={r.id} className={r.attended ? '' : 'opacity-60'}>
                      <td className="px-4 py-2 font-mono text-xs text-ink-400">{r.employee_code || '—'}</td>
                      <td className="px-4 py-2 text-ink-800">{r.name}</td>
                      <td className="px-4 py-2 text-ink-500">{r.department || ''}</td>
                      <td className="px-4 py-2 text-center">
                        {r.attended
                          ? <CheckCircle2 className="w-4 h-4 inline" style={{ color: '#1E7A52' }} />
                          : <XCircle className="w-4 h-4 inline text-ink-300" />}
                      </td>
                      <td className="px-4 py-2 text-right text-ink-600">{r.attended ? r.hours : '—'}</td>
                      <td className="px-4 py-2 text-center">
                        {badge ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.color }}>
                            {badge.label}
                          </span>
                        ) : <span className="text-xs text-ink-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div
          className="rounded-xl border border-dashed border-ink-200 py-16 text-center text-sm text-ink-400"
          style={{ background: '#FAF7F6' }}
        >
          <Archive className="w-8 h-8 mx-auto mb-2 text-ink-200" />
          ยังไม่ได้บันทึกประวัติ — ควรบันทึกหลังจบการอบรม เช็คอิน และประเมินผลแล้ว
          <br />
          <span className="text-xs">
            ระบบจะเก็บ: ใครเข้า/ไม่เข้า · จำนวนชั่วโมง (จากกำหนดการ) · ผลผ่าน/ไม่ผ่าน (จากประเมินผล)
          </span>
        </div>
      )}
    </div>
  );
}
