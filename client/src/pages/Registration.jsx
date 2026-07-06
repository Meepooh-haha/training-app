import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FileDown, UserPlus } from 'lucide-react';
import { api } from '../lib/api.js';
import { Field, Input, Button, Card } from '../components/ui.jsx';

// ใบลงทะเบียนของโครงการ — รายชื่ออ่านจากรายชื่อกลาง (project_participants)
// หน้านี้แก้เฉพาะเช็คอิน/หมายเหตุ; เพิ่ม-ลบคนทำที่หน้า "ผู้เข้าอบรม"
export default function Registration({ project, onSaved }) {
  const [reg, setReg] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.get(`/registrations/${project.id}`)
      .then((data) => setReg({
        reg_date: data.reg_date || new Date().toISOString().slice(0, 10),
        start_time: data.start_time || '09:00',
        end_time: data.end_time || '',
        attendees: (data.attendees || []).map((a) => ({ ...a, checked_in: !!a.checked_in })),
      }))
      .catch((e) => toast.error(e.message));
  }, [project.id]);

  useEffect(() => { load(); }, [load]);

  const upd = (i, k, v) => setReg((r) => ({ ...r, attendees: r.attendees.map((a, idx) => (idx === i ? { ...a, [k]: v } : a)) }));

  async function save() {
    setSaving(true);
    try {
      await api.post('/registrations', {
        project_id: project.id,
        reg_date: reg.reg_date,
        start_time: reg.start_time,
        end_time: reg.end_time,
        attendees: reg.attendees,
      });
      toast.success('บันทึกการลงทะเบียนสำเร็จ');
      onSaved?.();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  const course = { name_th: project.course_name_th, code: project.course_code };
  const checkedIn = reg?.attendees.filter((a) => a.checked_in).length || 0;

  // ── XLSX export via server endpoint (fills the real company template) ──
  // โครงการมีฟิลด์ใบขอครบในตัว จึงส่งเป็น request ได้เลย
  // หลายวัน = 1 tab ต่อวัน; เกิน 28 คน = tab "(ต่อ)" — ผู้ใช้พิมพ์/แปลง PDF เองบนเครื่อง
  async function exportXlsx() {
    try {
      await api.download(
        '/registration/export-xlsx',
        { reg, request: project, course },
        `registration-${project.req_no || 'sheet'}.xlsx`,
      );
    } catch (e) {
      console.error(e);
      toast.error(`เกิดข้อผิดพลาด: ${e.message}`);
    }
  }

  if (!reg) return null;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-800">ใบลงทะเบียน</h2>
        <p className="text-sm text-slate-500">บันทึกการลงทะเบียนและเช็คอินผู้เข้าอบรม</p>
      </div>

      <Card className="p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="วันที่ลงทะเบียน">
            <Input type="date" value={reg.reg_date} onChange={(e) => setReg((r) => ({ ...r, reg_date: e.target.value }))} />
          </Field>
          <Field label="เวลา">
            <div className="flex items-center gap-2">
              <Input type="time" value={reg.start_time} onChange={(e) => setReg((r) => ({ ...r, start_time: e.target.value }))} />
              <span className="text-slate-400">–</span>
              <Input type="time" value={reg.end_time} onChange={(e) => setReg((r) => ({ ...r, end_time: e.target.value }))} />
            </div>
          </Field>
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-800">รายชื่อผู้เข้าอบรม</h2>
            <span className="text-sm text-slate-500">
              เช็คอินแล้ว {checkedIn} / {reg.attendees.length} คน
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/development/workflow/${project.id}/participants`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <UserPlus size={14} /> จัดการรายชื่อ
            </Link>
            <Button size="sm" variant="secondary" onClick={exportXlsx} title="ใบลงทะเบียน format บริษัท — หลายวันแยก tab ต่อวัน (เปิด/พิมพ์ด้วย Excel หรือ LibreOffice)">
              <FileDown size={14} /> พิมพ์ใบลงทะเบียน (XLSX)
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-2 py-2 font-medium">เช็คอิน</th>
                <th className="px-2 py-2 font-medium">รหัสพนักงาน</th>
                <th className="px-2 py-2 font-medium">ชื่อ-นามสกุล</th>
                <th className="px-2 py-2 font-medium">แผนก</th>
                <th className="px-2 py-2 font-medium">ตำแหน่ง</th>
                <th className="px-2 py-2 font-medium">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reg.attendees.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-2 py-6 text-center text-slate-400">
                    ยังไม่มีรายชื่อ — เพิ่มได้ที่ปุ่ม "จัดการรายชื่อ"
                  </td>
                </tr>
              )}
              {reg.attendees.map((a, i) => (
                <tr key={a.id} className={a.checked_in ? 'bg-green-50/50' : ''}>
                  <td className="px-2 py-1.5 text-center">
                    <input type="checkbox" checked={a.checked_in} onChange={(e) => upd(i, 'checked_in', e.target.checked)} />
                  </td>
                  <td className="px-2 py-1.5 font-mono text-xs text-slate-400">{a.employee_code || '—'}</td>
                  <td className="px-2 py-1.5 text-slate-800">{a.name}</td>
                  <td className="px-2 py-1.5 text-slate-500">{a.department || ''}</td>
                  <td className="px-2 py-1.5 text-slate-500">{a.position || ''}</td>
                  <td className="px-2 py-1.5"><Input className="h-8" value={a.note || ''} onChange={(e) => upd(i, 'note', e.target.value)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
