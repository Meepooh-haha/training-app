import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api.js';
import ExportButton from '../components/ExportButton.jsx';
import { Field, Input, Select, Button, Card } from '../components/ui.jsx';
import { exportRegistrationSheet } from '../lib/pdf-generator.js';

export default function Registration() {
  const [requests, setRequests] = useState([]);
  const [courses, setCourses] = useState([]);
  const [reqId, setReqId] = useState('');
  const [reg, setReg] = useState(null); // { reg_date, attendees: [] }
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/requests').then(setRequests).catch((e) => toast.error(e.message));
    api.get('/courses').then(setCourses).catch(() => {});
  }, []);

  async function selectRequest(id) {
    setReqId(id);
    setReg(null);
    if (!id) return;
    try {
      const data = await api.get(`/registrations/${id}`);
      setReg({
        reg_date: data.reg_date || new Date().toISOString().slice(0, 10),
        attendees: (data.attendees || []).map((a) => ({ ...a, checked_in: !!a.checked_in })),
      });
    } catch (e) {
      toast.error(e.message);
    }
  }

  const upd = (i, k, v) => setReg((r) => ({ ...r, attendees: r.attendees.map((a, idx) => (idx === i ? { ...a, [k]: v } : a)) }));
  const add = () => setReg((r) => ({ ...r, attendees: [...r.attendees, { name: '', department: '', position: '', checked_in: false, note: '' }] }));
  const del = (i) => setReg((r) => ({ ...r, attendees: r.attendees.filter((_, idx) => idx !== i) }));

  async function save() {
    setSaving(true);
    try {
      await api.post('/registrations', { req_id: Number(reqId), reg_date: reg.reg_date, attendees: reg.attendees });
      toast.success('บันทึกการลงทะเบียนสำเร็จ');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  const request = requests.find((r) => String(r.id) === String(reqId));
  const course = courses.find((c) => c.code === request?.course_code);
  const checkedIn = reg?.attendees.filter((a) => a.checked_in).length || 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">ใบลงทะเบียน</h1>
        <p className="text-sm text-slate-500">บันทึกการลงทะเบียนและเช็คอินผู้เข้าอบรม</p>
      </div>

      <Card className="p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="เลือกคำขออบรม">
            <Select value={reqId} onChange={(e) => selectRequest(e.target.value)}>
              <option value="">— เลือกคำขอ —</option>
              {requests.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.req_no} · {r.course_name_th} ({r.training_date})
                </option>
              ))}
            </Select>
          </Field>
          {reg && (
            <Field label="วันที่ลงทะเบียน">
              <Input type="date" value={reg.reg_date} onChange={(e) => setReg((r) => ({ ...r, reg_date: e.target.value }))} />
            </Field>
          )}
        </div>
      </Card>

      {reg && (
        <Card className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-800">รายชื่อผู้เข้าอบรม</h2>
              <span className="text-sm text-slate-500">
                เช็คอินแล้ว {checkedIn} / {reg.attendees.length} คน
              </span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="subtle" onClick={add}>
                <Plus size={14} /> เพิ่ม
              </Button>
              <ExportButton
                label="พิมพ์ใบลงทะเบียน"
                actions={[{ label: 'Registration Sheet (PDF)', onClick: () => exportRegistrationSheet(reg, request, course).catch(e => toast.error(e.message, { duration: 8000 })) }]}
              />
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
                  <th className="px-2 py-2 font-medium">ชื่อ-นามสกุล</th>
                  <th className="px-2 py-2 font-medium">แผนก</th>
                  <th className="px-2 py-2 font-medium">ตำแหน่ง</th>
                  <th className="px-2 py-2 font-medium">หมายเหตุ</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reg.attendees.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-2 py-6 text-center text-slate-400">
                      ยังไม่มีรายชื่อ
                    </td>
                  </tr>
                )}
                {reg.attendees.map((a, i) => (
                  <tr key={i} className={a.checked_in ? 'bg-green-50/50' : ''}>
                    <td className="px-2 py-1.5 text-center">
                      <input type="checkbox" checked={a.checked_in} onChange={(e) => upd(i, 'checked_in', e.target.checked)} />
                    </td>
                    <td className="px-2 py-1.5"><Input className="h-8" value={a.name} onChange={(e) => upd(i, 'name', e.target.value)} /></td>
                    <td className="px-2 py-1.5"><Input className="h-8" value={a.department} onChange={(e) => upd(i, 'department', e.target.value)} /></td>
                    <td className="px-2 py-1.5"><Input className="h-8" value={a.position} onChange={(e) => upd(i, 'position', e.target.value)} /></td>
                    <td className="px-2 py-1.5"><Input className="h-8" value={a.note} onChange={(e) => upd(i, 'note', e.target.value)} /></td>
                    <td className="px-2 py-1.5 text-right">
                      <button onClick={() => del(i)} className="text-slate-400 hover:text-red-600">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
