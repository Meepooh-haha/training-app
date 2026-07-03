import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Plus, X } from 'lucide-react';
import { api } from '../../lib/api.js';
import RoadmapTrail from './RoadmapTrail.jsx';

function NewProjectModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '', description: '', quarter: 'Q1', year: 2569,
    current_step: 1, participant_count: 0,
  });
  const [saving, setSaving] = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('กรุณาระบุชื่อโครงการ'); return; }
    setSaving(true);
    try {
      await api.post('/training-projects', form);
      toast.success('เพิ่มโครงการสำเร็จ');
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const STEP_LABELS = ['ขออนุมัติ', 'เตรียม-จัดอบรม', 'ประเมินผล', 'บันทึก-รายงาน'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4 font-body">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-ink-200 overflow-hidden">
        <div
          className="flex items-center justify-between px-5 py-4 border-b border-ink-100"
          style={{ background: '#FCEBEC' }}
        >
          <span className="font-semibold text-ink-900 font-display">เพิ่มโครงการฝึกอบรมใหม่</span>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          <label className="block text-sm">
            <span className="text-ink-700 font-medium">ชื่อโครงการ <span className="text-red-500">*</span></span>
            <input
              className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-300"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="เช่น ปฐมนิเทศพนักงานใหม่"
            />
          </label>

          <label className="block text-sm">
            <span className="text-ink-700 font-medium">คำอธิบายสั้น</span>
            <textarea
              className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-maroon-300"
              rows={2}
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="วัตถุประสงค์หรือกลุ่มเป้าหมาย…"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-ink-700 font-medium">ไตรมาส</span>
              <select
                className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-300"
                value={form.quarter}
                onChange={e => set('quarter', e.target.value)}
              >
                {['Q1','Q2','Q3','Q4'].map(q => <option key={q} value={q}>{q}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-ink-700 font-medium">ปี (พ.ศ.)</span>
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-300"
                value={form.year}
                onChange={e => set('year', Number(e.target.value))}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-ink-700 font-medium">ขั้นตอนปัจจุบัน</span>
              <select
                className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-300"
                value={form.current_step}
                onChange={e => set('current_step', Number(e.target.value))}
              >
                {STEP_LABELS.map((l, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}. {l}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-ink-700 font-medium">จำนวนผู้เข้าอบรม</span>
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-300"
                value={form.participant_count}
                onChange={e => set('participant_count', Number(e.target.value))}
              />
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-ink-600 hover:bg-ink-100 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60"
              style={{ background: saving ? '#9B9491' : '#710F16' }}
            >
              {saving ? 'กำลังบันทึก…' : 'เพิ่มโครงการ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TrainingWorkflowPage() {
  const [showForm,  setShowForm]  = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey(k => k + 1), []);

  return (
    <div className="space-y-5 font-body">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 font-display">Training Workflow</h1>
          <p className="text-sm text-ink-500 mt-0.5">แผนโครงการฝึกอบรมประจำปีตาม HR-SOP-003</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: '#710F16' }}
        >
          <Plus className="w-4 h-4" /> เพิ่มโครงการ
        </button>
      </div>

      <RoadmapTrail key={reloadKey} />

      {showForm && (
        <NewProjectModal onClose={() => setShowForm(false)} onCreated={reload} />
      )}
    </div>
  );
}
