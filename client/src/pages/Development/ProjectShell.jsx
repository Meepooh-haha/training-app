import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Outlet, Link, NavLink, useOutletContext } from 'react-router-dom';
import { ArrowLeft, Loader2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import { workflowHubs } from '../../config/workflowHubs.js';
import { CompetencyBadge, DeliveryBadge } from '../../config/projectTypes.jsx';

export const APPROVAL_BADGE = {
  draft:    { label: 'ร่างใบขอ',     bg: '#F1ECEA', color: '#78716E' },
  pending:  { label: 'รออนุมัติ',    bg: '#FEF3C7', color: '#92400E' },
  approved: { label: 'อนุมัติแล้ว',  bg: '#E3F4EC', color: '#1E7A52' },
  rejected: { label: 'ไม่อนุมัติ',   bg: '#FEE2E2', color: '#B91C1C' },
};

// hook สำหรับหน้า child — ดึง project/status ที่ shell โหลดไว้แล้ว
export function useProject() {
  return useOutletContext();
}

function PhaseBar({ project, projectId }) {
  const cs = project.current_step;
  const isPublic = project.delivery_type === 'public';

  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {workflowHubs.map((hub, i) => {
          const step = i + 1;
          const sats = isPublic ? hub.satellites.filter((s) => !s.publicHidden) : hub.satellites;
          const state = step < cs ? 'completed' : step === cs ? 'in_progress' : 'planned';
          const circle = {
            completed:   { background: '#1E7A52', color: '#fff', border: '2px solid #1E7A52' },
            in_progress: { background: '#710F16', color: '#fff', border: '2px solid #710F16' },
            planned:     { background: '#fff', color: '#9B9491', border: '2px dashed #C4BDBA' },
          }[state];
          return (
            <div key={hub.id} className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  style={circle}
                >
                  {step < cs ? '✓' : step}
                </span>
                <span
                  className="text-xs font-semibold truncate font-display"
                  style={{ color: state === 'planned' ? '#9B9491' : state === 'completed' ? '#1E7A52' : '#710F16' }}
                >
                  {hub.label}
                </span>
              </div>
              {sats.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1 pl-9 sm:pl-0 sm:ml-9">
                  {sats.map((sat) => (
                    <NavLink
                      key={sat.id}
                      to={`/development/workflow/${projectId}/${sat.route}`}
                      className={({ isActive }) =>
                        `rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
                          isActive ? '' : 'bg-ink-50 text-ink-500 hover:bg-ink-100 hover:text-ink-800'
                        }`
                      }
                      style={({ isActive }) => (isActive ? { background: '#710F16', color: '#fff' } : undefined)}
                    >
                      {sat.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Layout ครอบทุกหน้าใต้โครงการ: header + แถบ phase ค้างตลอด แล้วค่อย render หน้า child
export default function ProjectShell() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([
        api.get(`/training-projects/${projectId}`),
        api.get(`/training-projects/${projectId}/status`).catch(() => null),
      ]);
      setProject(p);
      setStatus(s);
    } catch (e) {
      toast.error(e.message);
      navigate('/development/workflow');
    } finally {
      setLoading(false);
    }
  }, [projectId, navigate]);

  useEffect(() => { setLoading(true); reload(); }, [reload]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-ink-400" />
      </div>
    );
  }

  if (!project) return null;

  const badge = APPROVAL_BADGE[project.approval_status] ?? APPROVAL_BADGE.draft;

  return (
    <div className="space-y-4 font-body">
      <button
        onClick={() => navigate('/development/workflow')}
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> กลับไปรายการโครงการ
      </button>

      {/* Project header — ค้างอยู่ทุกหน้าใต้โครงการ */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/development/workflow/${projectId}`} className="hover:underline underline-offset-4">
              <h1 className="text-2xl font-bold text-ink-900 font-display truncate">{project.name}</h1>
            </Link>
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: badge.bg, color: badge.color }}
            >
              {badge.label}
            </span>
            <DeliveryBadge type={project.delivery_type} />
            <CompetencyBadge type={project.competency_type} />
          </div>
          <p className="text-sm text-ink-500 mt-0.5">
            {project.req_no && <span className="font-mono">{project.req_no}</span>}
            {project.course_name_th && <> · {project.course_name_th}</>}
            {' '}· {project.quarter}/{project.year}
            {project.training_date && <> · อบรม {project.training_date}{project.end_date && project.end_date !== project.training_date ? ` – ${project.end_date}` : ''}</>}
          </p>
        </div>
        <Link
          to={`/development/workflow/${projectId}/participants`}
          className="flex items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-50 transition-colors shrink-0"
        >
          <Users className="w-3.5 h-3.5" />
          ผู้เข้าอบรม {project.participant_count ?? 0} คน
        </Link>
      </div>

      <PhaseBar project={project} projectId={projectId} />

      <Outlet context={{ project, status, reload, projectId: Number(projectId) }} />
    </div>
  );
}
