import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stamp, Users, ClipboardCheck, Trophy, X } from 'lucide-react';
import { workflowHubs } from '../../config/workflowHubs.js';
import { api } from '../../lib/api.js';

// Canvas coordinate system: 1000 × 320 SVG units.
// Hub centers sit at HUB_Y; satellites orbit above them.
// HTML divs are positioned via CSS percentages — the SVG layer only draws lines.
const CANVAS_W  = 1000;
const CANVAS_H  = 320;
const HUB_Y     = 200;   // hub center y (SVG units)
const ORBIT_R   = 90;    // satellite orbit radius (SVG units)
const HUB_CX    = [125, 375, 625, 875]; // hub center x per index (SVG units)
const HUB_R_SVG = 52;    // approximate hub radius in SVG units (for line endpoints)

const ICONS = { approve: Stamp, execute: Users, evaluate: ClipboardCheck, record: Trophy };

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

// Returns {x, y} offsets from hub center for each satellite, in SVG units.
// Arc is centered at 270° (directly above), spreads symmetrically.
function getSatelliteOffsets(count) {
  if (count === 0) return [];
  const arcByCount = [0, 0, 60, 90, 120, 140];
  const arc = arcByCount[Math.min(count, arcByCount.length - 1)];
  return Array.from({ length: count }, (_, i) => {
    const frac = count === 1 ? 0.5 : i / (count - 1);
    const deg  = 270 - arc / 2 + frac * arc;
    const rad  = deg * (Math.PI / 180);
    return { x: Math.cos(rad) * ORBIT_R, y: Math.sin(rad) * ORBIT_R };
  });
}

const VENDOR_SAT_COLORS = {
  ok:      { bg: '#E3F4EC', border: '#1E7A52', color: '#1E7A52' },
  warning: { bg: '#FEF3C7', border: '#F59E0B', color: '#92400E' },
  none:    { bg: '#F1ECEA', border: '#C4BDBA', color: '#78716E' },
};

function satStyle(sat, vendorStatus) {
  if (sat.dynamicStatus && sat.id === 'vendor_check') {
    const cfg = VENDOR_SAT_COLORS[vendorStatus] ?? VENDOR_SAT_COLORS.none;
    return { background: cfg.bg, border: `2px solid ${cfg.border}`, color: cfg.color };
  }
  return { background: '#FEF3C7', border: '2px solid #F59E0B', color: '#92400E' };
}

export default function HubSatelliteGraph({ preset, projectId }) {
  const [selectedId, setSelectedId] = useState(null);
  const [vendorStatus, setVendorStatus] = useState('none');
  const navigate = useNavigate();

  useEffect(() => {
    if (!projectId) return;
    api.get(`/training-projects/${projectId}/vendor-check`)
      .then(d => setVendorStatus(d.status ?? 'none'))
      .catch(() => {});
  }, [projectId]);

  const byId     = Object.fromEntries((preset?.nodes ?? []).map(n => [n.id, n]));
  const selected = selectedId ? byId[selectedId] : null;

  return (
    <div className="w-full rounded-2xl border border-ink-200 bg-ink-50 p-5 font-display">
      <div className="mb-4">
        <p className="text-ink-900 text-lg font-semibold leading-tight">
          {preset?.title ?? 'Training Workflow'}
        </p>
        <p className="text-ink-500 text-xs font-mono mt-0.5">
          {preset?.subtitle ?? 'HR-SOP-003'}
        </p>
      </div>

      {/* Graph canvas */}
      <div
        className="relative w-full"
        style={{ paddingBottom: `${(CANVAS_H / CANVAS_W) * 100}%` }}
      >
        {/* SVG layer — edges only */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
          preserveAspectRatio="none"
        >
          <defs>
            <marker id="hs-arrow-active" markerWidth="10" markerHeight="10" refX="7" refY="5" orient="auto">
              <path d="M0,0 L10,5 L0,10 Z" fill="#710F16" />
            </marker>
            <marker id="hs-arrow-dim" markerWidth="10" markerHeight="10" refX="7" refY="5" orient="auto">
              <path d="M0,0 L10,5 L0,10 Z" fill="#C4BDBA" />
            </marker>
          </defs>

          {/* Hub-to-hub connector lines */}
          {workflowHubs.slice(0, -1).map((hub, i) => {
            const nextNode = byId[workflowHubs[i + 1].id];
            const active   = nextNode && nextNode.status !== 'planned';
            return (
              <line
                key={`edge-${i}`}
                x1={HUB_CX[i]     + HUB_R_SVG}
                y1={HUB_Y}
                x2={HUB_CX[i + 1] - HUB_R_SVG}
                y2={HUB_Y}
                stroke={active ? '#710F16' : '#C4BDBA'}
                strokeWidth={active ? 3 : 2}
                strokeDasharray={active ? '0' : '10 8'}
                strokeLinecap="round"
                markerEnd={active ? 'url(#hs-arrow-active)' : 'url(#hs-arrow-dim)'}
                opacity={active ? 0.85 : 0.5}
              />
            );
          })}

          {/* Hub-to-satellite connector lines — each satellite links from its
              `parent` sibling (chain), or from the hub center if it has none. */}
          {workflowHubs.map((hub, i) => {
            const offsets  = getSatelliteOffsets(hub.satellites.length);
            const posById  = Object.fromEntries(hub.satellites.map((s, j) => [s.id, offsets[j]]));
            return hub.satellites.map((sat, j) => {
              const { x, y } = offsets[j];
              const from = sat.parent ? posById[sat.parent] : { x: 0, y: 0 };
              return (
                <line
                  key={`sat-line-${hub.id}-${sat.id}`}
                  x1={HUB_CX[i] + from.x}
                  y1={HUB_Y + from.y}
                  x2={HUB_CX[i] + x}
                  y2={HUB_Y + y}
                  stroke="#D97706"
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                  opacity={0.4}
                />
              );
            });
          })}
        </svg>

        {/* Hub circles (HTML) */}
        {workflowHubs.map((hub, i) => {
          const node     = byId[hub.id];
          const status   = node?.status ?? 'planned';
          const colors   = NODE_COLORS[status] ?? NODE_COLORS.planned;
          const Icon     = ICONS[hub.id];
          const isSelected = hub.id === selectedId;

          return (
            <button
              key={hub.id}
              onClick={() => setSelectedId(prev => prev === hub.id ? null : hub.id)}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group"
              style={{
                left: `${(HUB_CX[i] / CANVAS_W) * 100}%`,
                top:  `${(HUB_Y     / CANVAS_H) * 100}%`,
              }}
            >
              <div
                className={`w-24 h-24 rounded-full flex items-center justify-center transition-transform group-hover:scale-105 ${isSelected ? 'scale-110' : ''} ${status === 'in_progress' ? 'animate-pulse-ring' : ''}`}
                style={{
                  background:  colors.bg,
                  border:      `3px ${status === 'planned' ? 'dashed' : 'solid'} ${colors.border}`,
                  color:       colors.icon,
                  opacity:     status === 'planned' ? 0.65 : 1,
                  boxShadow:   isSelected ? `0 0 0 4px ${colors.border}40` : undefined,
                }}
              >
                {Icon && <Icon className="w-10 h-10" />}
              </div>
              <span
                className="mt-2 text-sm font-semibold whitespace-nowrap font-display"
                style={{ color: LABEL_COLOR[status] ?? LABEL_COLOR.planned }}
              >
                {hub.label}
              </span>
            </button>
          );
        })}

        {/* Satellite circles (HTML) */}
        {workflowHubs.map((hub, i) => {
          const offsets = getSatelliteOffsets(hub.satellites.length);
          return hub.satellites.map((sat, j) => {
            const { x, y } = offsets[j];
            const satX = HUB_CX[i] + x;
            const satY = HUB_Y + y;
            return (
              <button
                key={`${hub.id}-${sat.id}`}
                onClick={() => navigate(`${sat.route}?projectId=${projectId}`)}
                title={sat.label}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group"
                style={{
                  left: `${(satX / CANVAS_W) * 100}%`,
                  top:  `${(satY / CANVAS_H) * 100}%`,
                }}
              >
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm"
                  style={satStyle(sat, vendorStatus)}
                >
                  <span className="text-[9px] font-semibold leading-tight text-center px-0.5">
                    {sat.label}
                  </span>
                </div>
              </button>
            );
          });
        })}
      </div>

      {/* Detail card — shown when a hub is clicked */}
      {selected && (
        <div
          className="mt-5 rounded-xl p-4 border"
          style={{
            background:   '#fff',
            borderColor:  NODE_COLORS[selected.status]?.border ?? '#C4BDBA',
          }}
        >
          <div className="flex items-start justify-between mb-1">
            <div>
              <p className="text-ink-900 font-semibold font-display">{selected.label}</p>
              <p className="text-ink-400 text-xs font-mono">{selected.code}</p>
            </div>
            <button
              onClick={() => setSelectedId(null)}
              className="text-ink-400 hover:text-ink-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-ink-700 text-sm mt-2 leading-relaxed font-body">{selected.desc}</p>
        </div>
      )}
    </div>
  );
}
