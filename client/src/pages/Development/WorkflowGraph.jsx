import { useState } from 'react';
import {
  Stamp,
  Users,
  ClipboardCheck,
  Trophy,
  X,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// DEFAULT PRESET — HR-SOP-003 with Livplus status enum.
// Override via the `preset` prop for a specific project.
// ---------------------------------------------------------------------------
export const workflowPreset = {
  id: 'hr-sop-003',
  title: 'Training Workflow',
  subtitle: 'HR-SOP-003',
  canvas: { width: 1000, height: 560 },
  nodes: [
    { id: 'approve',  label: 'ขออนุมัติ',       code: 'HR-TR-F02',   desc: 'ขออนุมัติก่อนจัดอบรม 3-7 วันทำการ แยกสาย In-House / Public', icon: 'Stamp',          status: 'in_progress', x: 820, y: 120 },
    { id: 'execute',  label: 'เตรียม-จัดอบรม', code: 'HR-TR-F03',   desc: 'ลงทะเบียนผู้เข้าอบรม บันทึกภาพ และชั่วโมงรายบุคคล',          icon: 'Users',          status: 'planned',     x: 580, y: 370 },
    { id: 'evaluate', label: 'ประเมินผล',        code: 'HR-TR-F04',   desc: 'Post-test และติดตามผล Transfer of Learning 30-60 วัน',      icon: 'ClipboardCheck', status: 'planned',     x: 340, y: 460 },
    { id: 'record',   label: 'บันทึก-รายงาน',  code: 'ภายใน 7 วัน', desc: 'บันทึกลง Training Record Database และสรุปส่ง HR Manager',   icon: 'Trophy',         status: 'planned',     x: 140, y: 270 },
  ],
  edges: [
    { from: 'approve', to: 'execute'  },
    { from: 'execute', to: 'evaluate' },
    { from: 'evaluate', to: 'record'  },
  ],
};

// Build a preset for a specific project from its current_step (1-4)
export function buildProjectPreset(project) {
  const cs = project.current_step ?? 1;
  const STEPS = [
    { id: 'approve',  step: 1, label: 'ขออนุมัติ',       code: 'HR-TR-F02',   desc: 'ขออนุมัติก่อนจัดอบรม 3-7 วันทำการ แยกสาย In-House / Public', icon: 'Stamp',          x: 820, y: 120 },
    { id: 'execute',  step: 2, label: 'เตรียม-จัดอบรม', code: 'HR-TR-F03',   desc: 'ลงทะเบียนผู้เข้าอบรม บันทึกภาพ และชั่วโมงรายบุคคล',          icon: 'Users',          x: 580, y: 370 },
    { id: 'evaluate', step: 3, label: 'ประเมินผล',        code: 'HR-TR-F04',   desc: 'Post-test และติดตามผล Transfer of Learning 30-60 วัน',      icon: 'ClipboardCheck', x: 340, y: 460 },
    { id: 'record',   step: 4, label: 'บันทึก-รายงาน',  code: 'ภายใน 7 วัน', desc: 'บันทึกลง Training Record Database และสรุปส่ง HR Manager',   icon: 'Trophy',         x: 140, y: 270 },
  ];
  return {
    id:       `project-${project.id}`,
    title:    project.name,
    subtitle: `HR-SOP-003 · ${project.quarter ?? ''}/${project.year ?? ''}`,
    canvas:   { width: 1000, height: 560 },
    nodes: STEPS.map(s => ({
      ...s,
      status: s.step < cs ? 'completed' : s.step === cs ? 'in_progress' : 'planned',
    })),
    edges: [
      { from: 'approve', to: 'execute'  },
      { from: 'execute', to: 'evaluate' },
      { from: 'evaluate', to: 'record'  },
    ],
  };
}

const ICONS = { Stamp, Users, ClipboardCheck, Trophy };

// Node ring colors per status (inline — dynamic data, avoid Tailwind purge issues)
const NODE_COLORS = {
  completed:   { bg: '#E3F4EC', border: '#1E7A52', icon: '#1E7A52' },
  in_progress: { bg: '#FCEBEC', border: '#710F16', icon: '#710F16' },
  planned:     { bg: '#F1ECEA', border: '#C4BDBA', icon: '#78716E' },
};

const LABEL_COLOR = {
  completed:   '#1E7A52',
  in_progress: '#710F16',
  planned:     '#9B9491',
};

function edgePath(a, b) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const cx = mx + nx * 55;
  const cy = my + ny * 55;
  return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
}

export default function WorkflowGraph({ preset = workflowPreset, onNodeClick }) {
  const [selectedId, setSelectedId] = useState(null);
  const { width, height } = preset.canvas;
  const byId = Object.fromEntries(preset.nodes.map((n) => [n.id, n]));
  const selected = selectedId ? byId[selectedId] : null;

  function handleClick(node) {
    setSelectedId(prev => prev === node.id ? null : node.id);
    onNodeClick?.(node);
  }

  return (
    <div className="w-full rounded-2xl border border-ink-200 bg-ink-50 p-5 font-display">
      <div className="mb-4">
        <p className="text-ink-900 text-lg font-semibold leading-tight">{preset.title}</p>
        <p className="text-ink-500 text-xs font-mono mt-0.5">{preset.subtitle}</p>
      </div>

      <div className="relative w-full" style={{ paddingBottom: `${(height / width) * 100}%` }}>
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
        >
          <defs>
            <marker id="wf-arrow-active" markerWidth="10" markerHeight="10" refX="7" refY="5" orient="auto">
              <path d="M0,0 L10,5 L0,10 Z" fill="#710F16" />
            </marker>
            <marker id="wf-arrow-dim" markerWidth="10" markerHeight="10" refX="7" refY="5" orient="auto">
              <path d="M0,0 L10,5 L0,10 Z" fill="#C4BDBA" />
            </marker>
          </defs>

          {preset.edges.map((e, i) => {
            const a = byId[e.from];
            const b = byId[e.to];
            if (!a || !b) return null;
            const active = b.status !== 'planned';
            return (
              <path
                key={i}
                d={edgePath(a, b)}
                fill="none"
                stroke={active ? '#710F16' : '#C4BDBA'}
                strokeWidth={active ? 3 : 2}
                strokeDasharray={active ? '0' : '10 8'}
                strokeLinecap="round"
                markerEnd={active ? 'url(#wf-arrow-active)' : 'url(#wf-arrow-dim)'}
                opacity={active ? 0.85 : 0.5}
              />
            );
          })}
        </svg>

        {preset.nodes.map((node) => {
          const Icon = ICONS[node.icon];
          const colors = NODE_COLORS[node.status] ?? NODE_COLORS.planned;
          const isSelected = node.id === selectedId;
          const isActive = node.status === 'in_progress';

          return (
            <button
              key={node.id}
              onClick={() => handleClick(node)}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group"
              style={{ left: `${(node.x / width) * 100}%`, top: `${(node.y / height) * 100}%` }}
            >
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-transform group-hover:scale-105 ${isSelected ? 'scale-110' : ''} ${isActive ? 'animate-pulse-ring' : ''}`}
                style={{
                  background: colors.bg,
                  border: `2px ${node.status === 'planned' ? 'dashed' : 'solid'} ${colors.border}`,
                  color: colors.icon,
                  opacity: node.status === 'planned' ? 0.65 : 1,
                  boxShadow: isSelected ? `0 0 0 3px ${colors.border}40` : undefined,
                }}
              >
                {Icon && <Icon className="w-6 h-6" />}
              </div>
              <span
                className="mt-1.5 text-xs font-medium whitespace-nowrap font-display"
                style={{ color: LABEL_COLOR[node.status] ?? LABEL_COLOR.planned }}
              >
                {node.label}
              </span>
            </button>
          );
        })}
      </div>

      {selected && (
        <div
          className="mt-5 rounded-xl p-4 border"
          style={{ background: '#fff', borderColor: NODE_COLORS[selected.status]?.border ?? '#C4BDBA' }}
        >
          <div className="flex items-start justify-between mb-1">
            <div>
              <p className="text-ink-900 font-semibold font-display">{selected.label}</p>
              <p className="text-ink-400 text-xs font-mono">{selected.code}</p>
            </div>
            <button onClick={() => setSelectedId(null)} className="text-ink-400 hover:text-ink-700 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-ink-700 text-sm mt-2 leading-relaxed font-body">{selected.desc}</p>
        </div>
      )}
    </div>
  );
}
