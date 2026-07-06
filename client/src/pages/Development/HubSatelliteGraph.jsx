import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stamp, Users, ClipboardCheck, Trophy, X } from 'lucide-react';
import { workflowHubs } from '../../config/workflowHubs.js';
import { api } from '../../lib/api.js';

// Canvas coordinate system: CANVAS_W × CANVAS_H SVG units (CANVAS_H, HUB_Y and
// HUB_CX are derived below from the actual satellite layout so the deepest
// configured chain never clips the canvas edge — see the "canvas sizing"
// block after getSatelliteOffsets).
// Hub centers sit at HUB_Y; satellites orbit above them.
// HTML divs are positioned via CSS percentages — the SVG layer only draws lines.
const CANVAS_W  = 1000;
const ORBIT_R   = 90;    // satellite orbit radius (SVG units)
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

// Returns {x, y} offsets from hub center for each satellite, in SVG units,
// laid out as a radial tree: depth = distance from the hub along the
// `parent` chain (radius grows per level via RADIUS_BASE/RADIUS_STEP),
// angle is inherited from the parent unless a sibling group shares that
// parent, in which case the group spreads symmetrically around it. Root
// satellites (no parent) spread around 270° (directly above the hub).
const RADIUS_BASE = ORBIT_R; // depth-1 radius — unchanged from the original single-ring layout

// Satellite circles render as a fixed 44px (`w-11 h-11`) HTML div — 22px
// radius. HUB_R_SVG (52 units for a 96px/48px-radius hub circle) already
// encodes this file's px→SVG-unit ratio (52/48 ≈ 1.083); apply the same
// ratio here instead of guessing a separate constant for satellites.
const SAT_R_SVG = (44 / 2) * (HUB_R_SVG / (96 / 2)); // ≈ 23.8

// Extra clearance (SVG units) between two same-branch nodes' edges so the
// dashed connector between them stays visible instead of the circles
// touching or overlapping.
const NODE_GAP_MARGIN = 16;

// Minimum center-to-center distance between consecutive depths: both nodes'
// real radii plus the gap margin above.
const RADIUS_STEP = SAT_R_SVG * 2 + NODE_GAP_MARGIN; // ≈ 63.7

function getSatelliteOffsets(satellites) {
  if (satellites.length === 0) return [];

  const byId = Object.fromEntries(satellites.map(s => [s.id, s]));

  // Group by parent, treating an unresolvable parent id (typo, or a parent
  // that isn't in this hub) as "no parent" so a bad config value degrades
  // to a root slot instead of breaking the layout.
  const childrenOf = {};
  satellites.forEach(s => {
    const key = (s.parent && byId[s.parent]) ? s.parent : '';
    (childrenOf[key] = childrenOf[key] || []).push(s);
  });

  // count=2 uses a narrower arc than the original single-ring table (was 90°):
  // at deeper radii a 90° fork pushes past the hub's canvas margin (verified
  // against the leftmost hub, which has the least horizontal clearance).
  const arcBySiblingCount = [0, 0, 60, 60, 120, 140];
  const angleById = {};
  const depthById = {};

  function assignAngles(parentKey, baseAngle, depth) {
    const group = childrenOf[parentKey] || [];
    const arc = arcBySiblingCount[Math.min(group.length, arcBySiblingCount.length - 1)];
    group.forEach((sat, i) => {
      if (angleById[sat.id] != null) return; // already placed — guards against a parent cycle re-entering a group
      const frac = group.length === 1 ? 0.5 : i / (group.length - 1);
      angleById[sat.id] = group.length === 1 ? baseAngle : baseAngle - arc / 2 + frac * arc;
      depthById[sat.id] = depth;
      assignAngles(sat.id, angleById[sat.id], depth + 1); // recurse into this satellite's own children
    });
  }

  assignAngles('', 270, 1);

  // A parent cycle among non-root satellites (config typo) is never reached
  // from the root walk above — place any leftovers as extra root slots
  // instead of rendering at NaN.
  satellites.forEach(sat => {
    if (angleById[sat.id] == null) {
      angleById[sat.id] = 270;
      depthById[sat.id] = 1;
    }
  });

  return satellites.map(sat => {
    const rad = angleById[sat.id] * (Math.PI / 180);
    const r   = RADIUS_BASE + RADIUS_STEP * (depthById[sat.id] - 1);
    return { x: Math.cos(rad) * r, y: Math.sin(rad) * r };
  });
}

// --- Canvas sizing -----------------------------------------------------
// CANVAS_H, HUB_Y and HUB_CX are derived from the actual satellite offsets
// (computed above) rather than a guessed viewBox, so the deepest configured
// chain across any hub — currently 4 levels, in the 'approve' hub — never
// clips the outermost node's edge. If a hub's chain gets deeper still, these
// recompute automatically from the same real offsets.
const CANVAS_PADDING  = 20; // breathing room beyond the outermost node's edge
const allSatOffsets   = workflowHubs.flatMap(hub => getSatelliteOffsets(hub.satellites));
const maxUpOffset     = allSatOffsets.reduce((m, { y }) => Math.max(m, -y), 0);
const maxSideOffset   = allSatOffsets.reduce((m, { x }) => Math.max(m, Math.abs(x)), 0);

const HUB_Y      = Math.ceil(maxUpOffset + SAT_R_SVG + CANVAS_PADDING);
const CANVAS_H   = HUB_Y + HUB_R_SVG + 70; // 70 ≈ label text + bottom breathing room (matches the original 320 − 200 − 52 = 68)
const HUB_MARGIN_X = Math.ceil(maxSideOffset + SAT_R_SVG + CANVAS_PADDING);
const HUB_CX = workflowHubs.map((_, i) =>
  HUB_MARGIN_X + i * ((CANVAS_W - 2 * HUB_MARGIN_X) / Math.max(workflowHubs.length - 1, 1))
);

// สีตามสถานะจริงของงานใน satellite นั้น: done = เสร็จแล้ว, warning = เริ่มแล้ว
// แต่ยังไม่จบ, none = ยังไม่เริ่ม (มาจาก GET /training-projects/:id/status)
const SAT_STATE_COLORS = {
  done:    { bg: '#E3F4EC', border: '#1E7A52', color: '#1E7A52' },
  warning: { bg: '#FEF3C7', border: '#F59E0B', color: '#92400E' },
  none:    { bg: '#F1ECEA', border: '#C4BDBA', color: '#78716E' },
};

function satState(sat, status, vendorStatus) {
  if (sat.id === 'vendor_check') {
    return vendorStatus === 'ok' ? 'done' : vendorStatus === 'warning' ? 'warning' : 'none';
  }
  if (!status) return 'none';
  switch (sat.id) {
    case 'availability':
      return status.availability?.date_confirmed ? 'done'
        : (status.availability?.candidate_dates > 0 ? 'warning' : 'none');
    case 'pr_issuance':
      return status.pr?.issued > 0 ? 'done' : 'none';
    case 'memo_issuance':
      // memo ไม่มีตารางของตัวเอง — อนุมานจากสถานะอนุมัติ (pending = ส่ง Memo แล้ว)
      return status.approval?.status === 'approved' ? 'done'
        : status.approval?.status === 'pending' ? 'warning' : 'none';
    case 'registration':
      return status.registration?.exists ? 'done' : 'none';
    case 'schedule':
      return status.schedule?.topics > 0 ? 'done' : 'none';
    case 'evaluation':
      return status.evaluation?.count > 0 ? 'done' : 'none';
    case 'training_records':
      return status.records?.count > 0 ? 'done' : 'none';
    case 'summary_report':
    case 'dsd_export':
      // หน้ารายงานอ่านอย่างเดียว — ถือว่าพร้อมเมื่อบันทึกประวัติแล้ว
      return status.records?.count > 0 ? 'done' : 'none';
    default:
      return 'none'; // invoice_intake ฯลฯ — ยังไม่มีข้อมูลให้อนุมาน
  }
}

function satStyle(sat, status, vendorStatus) {
  const cfg = SAT_STATE_COLORS[satState(sat, status, vendorStatus)];
  return { background: cfg.bg, border: `2px solid ${cfg.border}`, color: cfg.color };
}

export default function HubSatelliteGraph({ preset, projectId, status, delivery = 'inhouse' }) {
  const [selectedId, setSelectedId] = useState(null);
  const [vendorStatus, setVendorStatus] = useState('none');
  const navigate = useNavigate();

  useEffect(() => {
    if (!projectId) return;
    api.get(`/training-projects/${projectId}/vendor-check`)
      .then(d => setVendorStatus(d.status ?? 'none'))
      .catch(() => {});
  }, [projectId]);

  // Public = ส่งไปเรียนข้างนอก — ซ่อน satellite ที่ไม่เกี่ยว (หาวัน/ลงทะเบียน);
  // ลูกที่ parent หายไปจะถูก getSatelliteOffsets จัดเป็น root ให้เอง
  const visibleSats = (hub) =>
    delivery === 'public' ? hub.satellites.filter(s => !s.publicHidden) : hub.satellites;

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
            const sats     = visibleSats(hub);
            const offsets  = getSatelliteOffsets(sats);
            const posById  = Object.fromEntries(sats.map((s, j) => [s.id, offsets[j]]));
            return sats.map((sat, j) => {
              const { x, y } = offsets[j];
              const from = (sat.parent && posById[sat.parent]) ? posById[sat.parent] : { x: 0, y: 0 };
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
          const sats    = visibleSats(hub);
          const offsets = getSatelliteOffsets(sats);
          return sats.map((sat, j) => {
            const { x, y } = offsets[j];
            const satX = HUB_CX[i] + x;
            const satY = HUB_Y + y;
            return (
              <button
                key={`${hub.id}-${sat.id}`}
                onClick={() => navigate(`/development/workflow/${projectId}/${sat.route}`)}
                title={sat.label}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group"
                style={{
                  left: `${(satX / CANVAS_W) * 100}%`,
                  top:  `${(satY / CANVAS_H) * 100}%`,
                }}
              >
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm"
                  style={satStyle(sat, status, vendorStatus)}
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
