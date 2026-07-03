import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Trash2, Loader2, Pencil, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import { buildProjectPreset } from './WorkflowGraph.jsx';
import HubSatelliteGraph from './HubSatelliteGraph.jsx';

const STEP_LABELS = ['ขออนุมัติ', 'เตรียม-จัดอบรม', 'ประเมินผล', 'บันทึก-รายงาน'];

function getStatus(step) {
  if (step >= 4) return 'completed';
  if (step >= 2) return 'in_progress';
  return 'planned';
}

const STATUS_LABEL = { completed: 'เสร็จสิ้น', in_progress: 'กำลังดำเนินการ', planned: 'วางแผน' };
const STATUS_COLOR = {
  completed:   { text: '#1E7A52', bg: '#E3F4EC' },
  in_progress: { text: '#710F16', bg: '#FCEBEC' },
  planned:     { text: '#78716E', bg: '#F1ECEA' },
};

function StepNavigator({ project, onStepChange }) {
  const [advancing, setAdvancing] = useState(false);

  async function setStep(step) {
    setAdvancing(true);
    try {
      await api.patch(`/training-projects/${project.id}/step`, { step });
      onStepChange(step);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setAdvancing(false);
    }
  }

  const cs     = project.current_step;
  const status = getStatus(cs);
  const sc     = STATUS_COLOR[status];

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full font-body"
          style={{ background: sc.bg, color: sc.text }}
        >
          {STATUS_LABEL[status]}
        </span>
        <span className="text-xs text-ink-400 font-body">
          ขั้นตอน {cs}/4 — {STEP_LABELS[cs - 1]}
        </span>
      </div>
      <div className="flex gap-1">
        <button
          disabled={cs <= 1 || advancing}
          onClick={() => setStep(cs - 1)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-ink-600 hover:bg-ink-100 disabled:opacity-40 transition-colors font-body"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> ย้อนกลับ
        </button>
        <button
          disabled={cs >= 4 || advancing}
          onClick={() => setStep(cs + 1)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40 transition-colors font-body"
          style={{ background: cs < 4 ? '#710F16' : '#C4BDBA' }}
        >
          ถัดไป <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function EditProjectModal({ project, onClose, onSaved }) {
  const [name, setName] = useState(project.name || '');
  const [description, setDescription] = useState(project.description || '');
  const [notes, setNotes] = useState(project.notes || '');
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) { toast.error('กรุณาระบุชื่อโครงการ'); return; }
    setSaving(true);
    try {
      await api.patch(`/training-projects/${project.id}/details`, { name, description, notes });
      toast.success('บันทึกรายละเอียดโครงการแล้ว');
      onSaved({ ...project, name, description, notes });
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4 font-body">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-ink-200 overflow-hidden">
        <div
          className="flex items-center justify-between px-5 py-4 border-b border-ink-100"
          style={{ background: '#FCEBEC' }}
        >
          <span className="font-semibold text-ink-900 font-display">แก้ไขรายละเอียดโครงการ</span>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          <label className="block text-sm">
            <span className="text-ink-700 font-medium">ชื่อโครงการ <span className="text-red-500">*</span></span>
            <input
              className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-300"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="เช่น ปฐมนิเทศพนักงานใหม่"
            />
          </label>

          <label className="block text-sm">
            <span className="text-ink-700 font-medium">วัตถุประสงค์</span>
            <textarea
              className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-maroon-300"
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="วัตถุประสงค์หรือกลุ่มเป้าหมาย…"
            />
          </label>

          <label className="block text-sm">
            <span className="text-ink-700 font-medium">หมายเหตุเพิ่มเติม</span>
            <textarea
              className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-maroon-300"
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="ข้อมูลเพิ่มเติมสำหรับโครงการนี้…"
            />
          </label>

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
              {saving ? 'กำลังบันทึก…' : 'บันทึก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function WorkflowDetailPage() {
  const { projectId } = useParams();
  const navigate      = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = await api.get(`/training-projects/${projectId}`);
      setProject(p);
    } catch (e) {
      toast.error(e.message);
      navigate('/development/workflow');
    } finally {
      setLoading(false);
    }
  }, [projectId, navigate]);

  useEffect(() => { load(); }, [load]);

  function handleStepChange(newStep) {
    setProject(prev => prev ? { ...prev, current_step: newStep } : prev);
  }

  async function handleDelete() {
    if (!window.confirm(`ลบโครงการ "${project.name}" ?\nการกระทำนี้ไม่สามารถย้อนกลับได้`)) return;
    try {
      await api.del(`/training-projects/${project.id}`);
      toast.success('ลบโครงการแล้ว');
      navigate('/development/workflow');
    } catch (err) {
      toast.error(err.message);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-ink-400" />
      </div>
    );
  }

  if (!project) return null;

  const preset = buildProjectPreset(project);

  return (
    <div className="space-y-5 font-body">
      {/* Back link */}
      <button
        onClick={() => navigate('/development/workflow')}
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> กลับไปรายการโครงการ
      </button>

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 font-display">{project.name}</h1>
          <p className="text-sm text-ink-500 mt-0.5">
            HR-SOP-003 · {project.quarter}/{project.year}
            {project.participant_count > 0 && ` · ${project.participant_count} คน`}
          </p>
          {project.description && (
            <p className="text-sm text-ink-600 mt-2 whitespace-pre-wrap">{project.description}</p>
          )}
          {project.notes && (
            <p className="text-xs text-ink-400 mt-1.5 whitespace-pre-wrap">หมายเหตุ: {project.notes}</p>
          )}
        </div>
        <button
          onClick={() => setShowEdit(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-ink-600 hover:bg-ink-100 border border-ink-200 transition-colors font-body shrink-0"
        >
          <Pencil className="w-3.5 h-3.5" /> แก้ไขรายละเอียด
        </button>
      </div>

      {showEdit && (
        <EditProjectModal
          project={project}
          onClose={() => setShowEdit(false)}
          onSaved={setProject}
        />
      )}

      {/* Hub-and-satellite diagram */}
      <HubSatelliteGraph preset={preset} projectId={projectId} />

      {/* Step controls */}
      <div
        className="rounded-2xl border border-ink-200 p-4 space-y-3"
        style={{ background: '#FAF7F6' }}
      >
        <StepNavigator project={project} onStepChange={handleStepChange} />

        <div className="flex justify-end border-t border-ink-100 pt-3">
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-ink-400 hover:text-red-600 hover:bg-red-50 transition-colors font-body"
          >
            <Trash2 className="w-3.5 h-3.5" /> ลบโครงการนี้
          </button>
        </div>
      </div>
    </div>
  );
}
