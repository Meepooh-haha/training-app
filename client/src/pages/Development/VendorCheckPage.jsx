import { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, CheckCircle2, AlertCircle, Building2, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';

const STATUS_CFG = {
  ok:      { bg: '#E3F4EC', border: '#6EE7B7', icon: CheckCircle2, iconColor: '#1E7A52', label: 'ขึ้นทะเบียนครบแล้ว' },
  warning: { bg: '#FEF3C7', border: '#FCD34D', icon: AlertCircle,  iconColor: '#92400E', label: 'บางรายยังไม่ขึ้นทะเบียน' },
  none:    { bg: '#F1ECEA', border: '#E4DEDC', icon: Building2,    iconColor: '#78716E', label: 'ไม่มีวิทยากรภายนอก' },
};

function VendorBadge({ vendor }) {
  if (!vendor.vendor_id) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: '#F1ECEA', color: '#78716E' }}>
        ยังไม่ผูก Vendor
      </span>
    );
  }
  if (vendor.is_registered) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#E3F4EC', color: '#1E7A52' }}>
        🟢 ขึ้นทะเบียนแล้ว
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#FEF3C7', color: '#92400E' }}>
      🟡 รอเอกสาร
    </span>
  );
}

export default function VendorCheckPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const deepLinkId = searchParams.get('projectId');

  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState(deepLinkId || '');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/training-projects').then(setProjects).catch(e => toast.error(e.message));
  }, []);

  useEffect(() => {
    if (!projectId) { setData(null); return; }
    setLoading(true);
    api.get(`/training-projects/${projectId}/vendor-check`)
      .then(setData)
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [projectId]);

  const backProject = deepLinkId ? projects.find(p => String(p.id) === deepLinkId) : null;
  const cfg = data ? (STATUS_CFG[data.status] ?? STATUS_CFG.none) : null;
  const StatusIcon = cfg?.icon;

  return (
    <div className="space-y-5 font-body">
      {backProject && (
        <Link to={`/development/workflow/${deepLinkId}`} className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800 transition-colors">
          <ArrowLeft className="w-4 h-4" /> กลับไปที่ Workflow: {backProject.name}
        </Link>
      )}

      <div>
        <h1 className="text-2xl font-bold text-ink-900 font-display">ตรวจสอบ Vendor</h1>
        <p className="text-sm text-ink-500 mt-0.5">สถานะการขึ้นทะเบียนของวิทยากรภายนอกในโครงการ</p>
      </div>

      <div>
        <span className="text-ink-700 font-medium text-sm block mb-1">โครงการฝึกอบรม</span>
        {backProject ? (
          <div className="rounded-lg border border-ink-200 px-3 py-2 text-sm w-72 font-semibold text-ink-900" style={{ background: '#FAF7F6' }}>
            {backProject.name}
            <span className="ml-1.5 text-xs font-normal text-ink-400">({backProject.quarter}/{backProject.year})</span>
          </div>
        ) : (
          <select
            className="rounded-lg border border-ink-200 px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-maroon-300"
            value={projectId}
            onChange={e => setProjectId(e.target.value)}
          >
            <option value="">— เลือกโครงการ —</option>
            {projects.map(p => <option key={p.id} value={String(p.id)}>{p.name} ({p.quarter}/{p.year})</option>)}
          </select>
        )}
      </div>

      {!projectId && (
        <div className="rounded-xl border border-slate-200 py-20 text-center text-sm text-ink-400" style={{ background: '#FAF7F6' }}>
          เลือกโครงการฝึกอบรมเพื่อตรวจสอบ Vendor
        </div>
      )}

      {projectId && loading && (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-ink-400" /></div>
      )}

      {projectId && !loading && data && (
        <div className="space-y-4">
          {/* Summary banner */}
          <div
            className="flex items-center gap-4 rounded-xl border px-5 py-4"
            style={{ background: cfg.bg, borderColor: cfg.border }}
          >
            {StatusIcon && <StatusIcon className="w-6 h-6 shrink-0" style={{ color: cfg.iconColor }} />}
            <div>
              <div className="font-semibold text-ink-900 font-display">{cfg.label}</div>
              <div className="text-sm text-ink-600 mt-0.5">
                {data.total_external === 0
                  ? 'ไม่มีวิทยากรภายนอกในโครงการนี้'
                  : `วิทยากรภายนอก ${data.total_external} คน · ผูก Vendor ${data.linked} คน · ขึ้นทะเบียนแล้ว ${data.registered} คน`}
              </div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-3xl font-bold font-display" style={{ color: cfg.iconColor }}>
                {data.total_external > 0 ? `${data.registered}/${data.total_external}` : '—'}
              </div>
              <div className="text-xs text-ink-400">ขึ้นทะเบียนแล้ว</div>
            </div>
          </div>

          {/* Instructor list */}
          {data.total_external === 0 ? (
            <div className="rounded-xl border border-slate-200 py-16 text-center text-sm text-ink-400" style={{ background: '#FAF7F6' }}>
              <Building2 className="w-8 h-8 mx-auto mb-2 text-ink-200" />
              ยังไม่มีวิทยากรภายนอกที่เพิ่มเข้ามาในโครงการนี้
              <div className="mt-2">
                <Link
                  to={`/development/availability?projectId=${projectId}`}
                  className="text-xs text-blue-600 hover:underline"
                >
                  → ไปที่ตารางวันว่าง เพื่อเพิ่มวิทยากร
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 text-sm font-semibold font-display border-b border-slate-200" style={{ background: '#F4F0EF', color: '#78716E' }}>
                รายชื่อวิทยากรภายนอก
              </div>
              <div className="divide-y divide-slate-100">
                {data.instructors.map(inst => (
                  <div key={inst.id} className="flex items-center gap-3 px-4 py-3" style={{ background: 'white' }}>
                    <div className="flex-1">
                      <div className="font-medium text-ink-900 text-sm">{inst.name}</div>
                      {inst.vendor_name && (
                        <div className="text-xs text-ink-500 mt-0.5">
                          Vendor: {inst.vendor_name}
                          {inst.contact_name && ` · ผู้ติดต่อ: ${inst.contact_name}`}
                          {inst.contact_phone && ` · ${inst.contact_phone}`}
                        </div>
                      )}
                      {inst.registered_date && (
                        <div className="text-xs text-ink-400">ขึ้นทะเบียนเมื่อ {inst.registered_date}</div>
                      )}
                    </div>
                    <VendorBadge vendor={inst} />
                    <Link
                      to="/setup?tab=vendors"
                      className="shrink-0 flex items-center gap-1 text-xs text-ink-400 hover:text-blue-600 transition-colors"
                      title="จัดการ Vendor"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 text-xs text-ink-500 pt-1">
            <Link to={`/development/availability?projectId=${projectId}`} className="hover:text-ink-800 underline underline-offset-2">
              ← ตารางวันว่าง
            </Link>
            <Link to="/setup?tab=vendors" className="hover:text-ink-800 underline underline-offset-2">
              จัดการ Vendor ใน Setup →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
