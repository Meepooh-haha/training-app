import { useState, useEffect, useCallback, useMemo } from 'react';
import { Users, Plus, Trash2, X, Loader2, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import { useProject } from './ProjectShell.jsx';

// เลือกพนักงานจากข้อมูลหลัก (กรองตามฝ่าย + ค้นหา, ติ๊กหลายคนแล้วเพิ่มทีเดียว)
function AddFromSetupModal({ projectId, existingCodes, onClose, onAdded }) {
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/employees').then(setEmployees).catch((e) => toast.error(e.message));
  }, []);

  const departments = useMemo(
    () => [...new Set(employees.map((e) => e.department).filter(Boolean))].sort(),
    [employees],
  );

  const candidates = employees.filter((e) => {
    if (existingCodes.has(e.code)) return false;
    if (dept && e.department !== dept) return false;
    if (search.trim()) {
      const t = search.toLowerCase();
      return (e.full_name || '').toLowerCase().includes(t)
        || (e.code || '').toLowerCase().includes(t)
        || (e.nickname || '').toLowerCase().includes(t);
    }
    return true;
  });

  function toggle(code) {
    setSelected((prev) => {
      const s = new Set(prev);
      s.has(code) ? s.delete(code) : s.add(code);
      return s;
    });
  }

  function toggleAllVisible() {
    const allSelected = candidates.length > 0 && candidates.every((e) => selected.has(e.code));
    setSelected((prev) => {
      const s = new Set(prev);
      candidates.forEach((e) => (allSelected ? s.delete(e.code) : s.add(e.code)));
      return s;
    });
  }

  async function submit() {
    if (!selected.size) { toast.error('ยังไม่ได้เลือกพนักงาน'); return; }
    setSaving(true);
    try {
      const res = await api.post(`/training-projects/${projectId}/participants`, {
        participants: [...selected].map((employee_code) => ({ employee_code })),
      });
      toast.success(`เพิ่มผู้เข้าอบรม ${res.added} คน`);
      await onAdded();
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4 font-body">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-ink-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100" style={{ background: '#FCEBEC' }}>
          <span className="font-semibold text-ink-900 font-display">เลือกพนักงานจากข้อมูลหลัก</span>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              className="rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-300"
              placeholder="ค้นหาชื่อ / รหัส / ชื่อเล่น…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-300"
              value={dept}
              onChange={(e) => setDept(e.target.value)}
            >
              <option value="">ทุกฝ่าย/แผนก</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div className="flex items-center justify-between text-xs text-ink-500">
            <button type="button" onClick={toggleAllVisible} className="underline underline-offset-2 hover:text-ink-800">
              เลือก/ยกเลิกทั้งหมดที่แสดง ({candidates.length})
            </button>
            <span>เลือกแล้ว {selected.size} คน</span>
          </div>

          <div className="max-h-64 overflow-y-auto rounded-lg border border-ink-100 divide-y divide-ink-50">
            {candidates.length === 0 && (
              <p className="px-3 py-4 text-xs text-ink-400 text-center">ไม่มีพนักงานที่ตรงเงื่อนไข (หรือถูกเพิ่มไปแล้วทั้งหมด)</p>
            )}
            {candidates.map((e) => (
              <label key={e.code} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-ink-50 cursor-pointer">
                <input type="checkbox" checked={selected.has(e.code)} onChange={() => toggle(e.code)} />
                <span className="font-mono text-xs text-ink-400 w-16 shrink-0">{e.code}</span>
                <span className="flex-1 truncate">{e.full_name}</span>
                <span className="text-xs text-ink-400 truncate max-w-[10rem]">{e.department || ''}</span>
              </label>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-ink-600 hover:bg-ink-100 transition-colors">
              ยกเลิก
            </button>
            <button
              onClick={submit}
              disabled={saving || !selected.size}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60"
              style={{ background: saving ? '#9B9491' : '#710F16' }}
            >
              {saving ? 'กำลังเพิ่ม…' : `เพิ่ม ${selected.size} คน`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ParticipantsPage() {
  const { projectId, reload: reloadShell } = useProject();
  const [list, setList] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [manual, setManual] = useState({ name: '', department: '', position: '' });
  const [addingManual, setAddingManual] = useState(false);

  const load = useCallback(async () => {
    try {
      setList(await api.get(`/training-projects/${projectId}/participants`));
    } catch (e) {
      toast.error(e.message);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const refreshAll = useCallback(async () => {
    await load();
    await reloadShell(); // อัปเดตจำนวนคนบน header
  }, [load, reloadShell]);

  async function addManual(e) {
    e.preventDefault();
    if (!manual.name.trim()) { toast.error('กรุณาระบุชื่อ'); return; }
    setAddingManual(true);
    try {
      await api.post(`/training-projects/${projectId}/participants`, { participants: [manual] });
      setManual({ name: '', department: '', position: '' });
      await refreshAll();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAddingManual(false);
    }
  }

  async function remove(p) {
    if (!window.confirm(`นำ "${p.name}" ออกจากโครงการ?\nข้อมูลวันว่างและเช็คอินของคนนี้จะหายไปด้วย`)) return;
    try {
      await api.del(`/training-projects/${projectId}/participants/${p.id}`);
      await refreshAll();
    } catch (e) {
      toast.error(e.message);
    }
  }

  if (!list) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-ink-400" /></div>;
  }

  const existingCodes = new Set(list.map((p) => p.employee_code).filter(Boolean));

  return (
    <div className="space-y-5 font-body">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink-900 font-display flex items-center gap-2">
            <Users className="w-5 h-5" /> ผู้เข้าอบรม
          </h2>
          <p className="text-sm text-ink-500 mt-0.5">
            รายชื่อกลางของโครงการ — ตารางวันว่าง ใบลงทะเบียน และประเมินผล ใช้ชุดนี้ร่วมกัน กรอกที่เดียวพอ
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: '#710F16' }}
        >
          <UserPlus className="w-4 h-4" /> เลือกจากข้อมูลหลัก
        </button>
      </div>

      <div className="rounded-2xl border border-ink-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-left text-ink-400 text-xs" style={{ background: '#FAF7F6' }}>
            <tr>
              <th className="px-4 py-2.5 font-medium">รหัส</th>
              <th className="px-4 py-2.5 font-medium">ชื่อ-นามสกุล</th>
              <th className="px-4 py-2.5 font-medium">ฝ่าย/แผนก</th>
              <th className="px-4 py-2.5 font-medium">ตำแหน่ง</th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-50">
            {list.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-ink-400 text-sm">
                  ยังไม่มีผู้เข้าอบรม — กด "เลือกจากข้อมูลหลัก" เพื่อเริ่ม
                </td>
              </tr>
            )}
            {list.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2 font-mono text-xs text-ink-400">{p.employee_code || '—'}</td>
                <td className="px-4 py-2 text-ink-800">{p.name}</td>
                <td className="px-4 py-2 text-ink-500">{p.department || ''}</td>
                <td className="px-4 py-2 text-ink-500">{p.position || ''}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => remove(p)} className="text-ink-300 hover:text-red-600 transition-colors">
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* เพิ่มคนนอกข้อมูลหลัก (เช่น ผู้เข้าอบรมภายนอก) */}
      <form onSubmit={addManual} className="rounded-2xl border border-ink-200 p-4 flex flex-wrap items-end gap-2" style={{ background: '#FAF7F6' }}>
        <label className="block text-xs text-ink-500 flex-1 min-w-40">
          พิมพ์ชื่อเอง (คนนอกข้อมูลหลัก)
          <input
            className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-maroon-300"
            value={manual.name}
            onChange={(e) => setManual((m) => ({ ...m, name: e.target.value }))}
            placeholder="ชื่อ-นามสกุล"
          />
        </label>
        <label className="block text-xs text-ink-500 w-40">
          ฝ่าย/แผนก
          <input
            className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-maroon-300"
            value={manual.department}
            onChange={(e) => setManual((m) => ({ ...m, department: e.target.value }))}
          />
        </label>
        <label className="block text-xs text-ink-500 w-40">
          ตำแหน่ง
          <input
            className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-maroon-300"
            value={manual.position}
            onChange={(e) => setManual((m) => ({ ...m, position: e.target.value }))}
          />
        </label>
        <button
          type="submit"
          disabled={addingManual}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-ink-600 hover:bg-ink-100 border border-ink-200 transition-colors disabled:opacity-60"
        >
          <Plus className="w-4 h-4" /> เพิ่ม
        </button>
      </form>

      {showAdd && (
        <AddFromSetupModal
          projectId={projectId}
          existingCodes={existingCodes}
          onClose={() => setShowAdd(false)}
          onAdded={refreshAll}
        />
      )}
    </div>
  );
}
