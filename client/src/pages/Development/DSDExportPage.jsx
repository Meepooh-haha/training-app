import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Landmark, FileDown, Save, RefreshCw, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import { useProject } from './ProjectShell.jsx';

// สเกลของกรม: 0-3 ต่อหัวข้อ
const SCALE = { 0: '0 ไม่เปลี่ยนแปลง', 1: '1 ดีขึ้นเล็กน้อย', 2: '2 ปานกลาง', 3: '3 ชัดเจน' };
const TITLE_OPTIONS = ['นาย', 'นาง', 'นางสาว'];

const inputCls = 'w-full rounded border border-ink-200 px-1.5 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-maroon-300';

// Phase 4: กรอกฟอร์มรายงานผลกรมพัฒนาฝีมือแรงงานอัตโนมัติ —
// รายชื่อ+เลขบัตรจาก Setup, คะแนน 5 หัวข้อ convert จากผลประเมิน (ปรับรายคนได้)
// แล้ว export เป็นไฟล์ฟอร์มกรมจริง (.xlsx) ส่งได้เลย
export default function DSDExportPage() {
  const { project } = useProject();
  const [data, setData] = useState(null);
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.get(`/training-projects/${project.id}/dsd`);
      setData(d);
      setRows(d.rows);
    } catch (e) {
      toast.error(e.message);
    }
  }, [project.id]);

  useEffect(() => { load(); }, [load]);

  const setRow = (i, patch) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const setTopic = (i, k, v) =>
    setRows((rs) => rs.map((r, idx) =>
      idx === i ? { ...r, topics: r.topics.map((t, ti) => (ti === k ? Number(v) : t)) } : r));

  function resetFromEval() {
    if (!window.confirm('ดึงคะแนน 5 หัวข้อจากผลประเมินใหม่ทุกคน (ทับค่าที่ปรับไว้)?')) return;
    setRows((rs) => rs.map((r) => ({ ...r, topics: [...data.defaults] })));
  }

  async function save() {
    setSaving(true);
    try {
      await api.put(`/training-projects/${project.id}/dsd`, { rows });
      toast.success('บันทึกผลประเมินรายคนแล้ว');
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function exportXlsx() {
    setExporting(true);
    try {
      // บันทึกก่อนเสมอ — ไฟล์ต้องตรงกับสิ่งที่เห็นบนจอ
      await api.put(`/training-projects/${project.id}/dsd`, { rows });
      const res = await fetch(`/api/training-projects/${project.id}/dsd/export-xlsx`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Server error ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DSD-${project.req_no || project.id}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('สร้างไฟล์ฟอร์มกรมแล้ว — พร้อมส่ง');
      await load();
    } catch (e) {
      toast.error(e.message, { duration: 8000 });
    } finally {
      setExporting(false);
    }
  }

  if (!data) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-ink-400" /></div>;
  }

  const idProblems = rows.filter((r) => !r.id_ok || r.id_duplicate);

  return (
    <div className="space-y-5 font-body">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink-900 font-display flex items-center gap-2">
            <Landmark className="w-5 h-5" /> รายงานผลกรมพัฒนาฝีมือแรงงาน
          </h2>
          <p className="text-sm text-ink-500 mt-0.5">
            กรอกฟอร์มราชการให้อัตโนมัติ — คะแนน 5 หัวข้อแปลงจากผลประเมิน ปรับรายคนได้ก่อนสร้างไฟล์
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={resetFromEval}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-ink-600 hover:bg-ink-100 border border-ink-200 transition-colors"
            title={`ค่าจากผลประเมิน: [${data.defaults.join(', ')}]`}
          >
            <RefreshCw className="w-3.5 h-3.5" /> ดึงจากผลประเมิน
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-ink-600 hover:bg-ink-100 border border-ink-200 transition-colors disabled:opacity-60"
          >
            <Save className="w-3.5 h-3.5" /> {saving ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
          <button
            onClick={exportXlsx}
            disabled={exporting || !rows.length}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: '#710F16' }}
          >
            <FileDown className="w-4 h-4" /> {exporting ? 'กำลังสร้าง…' : 'Export ไฟล์กรม (.xlsx)'}
          </button>
        </div>
      </div>

      {!project.course_send_to_dsd && (
        <div className="rounded-lg px-4 py-2.5 text-xs" style={{ background: '#F1ECEA', color: '#78716E' }}>
          หลักสูตรของโครงการนี้ยังไม่ได้ติ๊ก "ส่งกรมพัฒนาฝีมือแรงงาน" ใน{' '}
          <Link to="/setup?tab=courses" className="underline underline-offset-2">ข้อมูลหลัก › หลักสูตร</Link>
          {' '}— ยัง export ได้ แต่ควรตรวจสอบว่าโครงการนี้ต้องยื่นจริง
        </div>
      )}

      {data.mapped_items === 0 && (
        <div className="rounded-lg px-4 py-2.5 text-xs" style={{ background: '#FEF3C7', color: '#92400E' }}>
          ยังไม่มีหัวข้อประเมินไหนติดป้าย "สอดคล้องกับหัวข้อกรมฯ" — คะแนนตั้งต้นจึงเป็น 0 ทั้งหมด
          ติดป้ายได้ที่ <Link to="/setup?tab=items" className="underline underline-offset-2 font-semibold">ข้อมูลหลัก › หัวข้อประเมิน</Link>{' '}
          แล้วกด "ดึงจากผลประเมิน"
        </div>
      )}

      {idProblems.length > 0 && (
        <div className="rounded-lg px-4 py-2.5 text-xs space-y-1" style={{ background: '#FEE2E2', color: '#B91C1C' }}>
          <p className="font-semibold flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" /> เลขบัตรประชาชนมีปัญหา {idProblems.length} คน (export ไม่ได้จนกว่าจะแก้):
          </p>
          <ul className="list-disc list-inside">
            {idProblems.map((r) => (
              <li key={r.participant_id}>
                {r.full_name} — {r.id_duplicate ? 'เลขซ้ำกับคนอื่น' : r.id_msg}
              </li>
            ))}
          </ul>
          <p>
            แก้ที่ <Link to="/setup?tab=employees" className="underline underline-offset-2 font-semibold">ข้อมูลหลัก › ข้อมูลพนักงาน</Link> แล้วรีเฟรชหน้านี้
          </p>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-200 py-16 text-center text-sm text-ink-400" style={{ background: '#FAF7F6' }}>
          ยังไม่มีผู้เข้าอบรม (ต้องเช็คอินที่ใบลงทะเบียนก่อน — โครงการ Public ใช้รายชื่อทั้งหมด)
        </div>
      ) : (
        <div className="rounded-2xl border border-ink-200 bg-white overflow-x-auto">
          <table className="w-full text-xs min-w-[980px]">
            <thead className="text-left text-ink-400" style={{ background: '#FAF7F6' }}>
              <tr>
                <th className="px-2 py-2 font-medium w-8">#</th>
                <th className="px-2 py-2 font-medium w-32">เลขบัตร ปชช.</th>
                <th className="px-2 py-2 font-medium w-20">คำนำหน้า</th>
                <th className="px-2 py-2 font-medium w-28">ชื่อ</th>
                <th className="px-2 py-2 font-medium w-28">สกุล</th>
                <th className="px-2 py-2 font-medium">ตำแหน่ง</th>
                {data.topics.map((t, i) => (
                  <th key={i} className="px-1 py-2 font-medium w-24 text-center" title={t}>
                    {i + 1}. {t.length > 14 ? t.slice(0, 14) + '…' : t}
                  </th>
                ))}
                <th className="px-2 py-2 font-medium w-20 text-center">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {rows.map((r, i) => (
                <tr key={r.participant_id} className={!r.id_ok || r.id_duplicate ? 'bg-red-50/50' : ''}>
                  <td className="px-2 py-1.5 text-ink-400">{i + 1}</td>
                  <td className="px-2 py-1.5 font-mono">
                    {r.national_id || <span className="text-red-500">ไม่มี</span>}
                    {r.national_id && (!r.id_ok || r.id_duplicate) && (
                      <span className="block text-[10px] text-red-500">{r.id_duplicate ? 'ซ้ำ' : r.id_msg}</span>
                    )}
                  </td>
                  <td className="px-1 py-1.5">
                    <select className={inputCls} value={r.title} onChange={(e) => setRow(i, { title: e.target.value })}>
                      {!TITLE_OPTIONS.includes(r.title) && <option value={r.title}>{r.title || '—'}</option>}
                      {TITLE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td className="px-1 py-1.5">
                    <input className={inputCls} value={r.first_name} onChange={(e) => setRow(i, { first_name: e.target.value })} />
                  </td>
                  <td className="px-1 py-1.5">
                    <input className={inputCls} value={r.last_name} onChange={(e) => setRow(i, { last_name: e.target.value })} />
                  </td>
                  <td className="px-2 py-1.5 text-ink-500 truncate max-w-[9rem]" title={r.position}>{r.position}</td>
                  {r.topics.map((t, k) => (
                    <td key={k} className="px-1 py-1.5">
                      <select
                        className={inputCls}
                        style={{ color: t > 0 ? '#1E7A52' : '#9B9491' }}
                        value={t}
                        onChange={(e) => setTopic(i, k, e.target.value)}
                      >
                        {Object.entries(SCALE).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                      </select>
                    </td>
                  ))}
                  <td className="px-1 py-1.5 text-center">
                    <button
                      onClick={() => setRow(i, { status: r.status === 'fail' ? 'passed' : 'fail' })}
                      className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                      style={r.status === 'fail'
                        ? { background: '#FEE2E2', color: '#B91C1C' }
                        : { background: '#E3F4EC', color: '#1E7A52' }}
                    >
                      {r.status === 'fail' ? 'ไม่ผ่าน' : 'ผ่าน'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-xs text-ink-400 space-y-1">
        <p>สเกลกรม: 0 = ไม่เปลี่ยนแปลง · 1 = ดีขึ้นเล็กน้อย · 2 = ดีขึ้นปานกลาง · 3 = ดีขึ้นชัดเจน — ช่วงรายได้ระบบใส่ "N/A (ไม่ระบุ)" ให้ทุกคนตามที่กำหนด</p>
        <p>ไฟล์ที่ได้คือฟอร์มราชการฉบับจริง (ชีท Summary + Data ครบ) — ปุ่ม macro ตรวจซ้ำของเจ้าหน้าที่ไม่ติดไปด้วย ระบบตรวจเลขบัตรและคนซ้ำให้ก่อน export แทน</p>
      </div>
    </div>
  );
}
