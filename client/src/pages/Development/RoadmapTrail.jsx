import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';

// ── Status helpers ────────────────────────────────────────────────────────────
const QUARTER_ORDER = { Q1: 0, Q2: 1, Q3: 2, Q4: 3 };

function getStatus(step) {
  if (step >= 4) return 'completed';
  if (step >= 2) return 'in_progress';
  return 'planned';
}

const STATUS_META = {
  completed:   { color: '#1E7A52', bg: '#E3F4EC', border: '#1E7A52', label: 'เสร็จสิ้น' },
  in_progress: { color: '#710F16', bg: '#FCEBEC', border: '#710F16', label: 'กำลังดำเนินการ' },
  planned:     { color: '#78716E', bg: '#F1ECEA', border: '#C4BDBA', label: 'วางแผน' },
};

// ── Layout constants ──────────────────────────────────────────────────────────
const TRAIL_W  = 150;  // SVG width (left column)
const CARD_X   = 170;  // detail card left offset
const CARD_W   = 460;  // detail card width
const NODE_R   = 30;   // circle radius
const GAP_Y    = 148;  // vertical gap between node tops
const HDR_H    = 52;   // quarter header height
const START_Y  = 10;
const TRAIL_L  = 24;   // left column trail x
const TRAIL_R  = 84;   // right column trail x

// ── SVG icons (inline, avoids icon library coupling) ─────────────────────────
function CheckIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.5 2.5L16 9" />
    </svg>
  );
}
function BoltIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2 4 14h6l-1 8 10-14h-7l1-6z" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

// ── Build layout from raw projects ───────────────────────────────────────────
function buildLayout(projects) {
  const sorted = [...projects].sort((a, b) => {
    const qDiff = (QUARTER_ORDER[a.quarter] ?? 0) - (QUARTER_ORDER[b.quarter] ?? 0);
    if (qDiff !== 0) return qDiff;
    return (a.order_index ?? 0) - (b.order_index ?? 0) || a.id - b.id;
  });

  // Build flat list: header rows + project rows
  const rows = [];
  let lastQ = null;
  for (const p of sorted) {
    if (p.quarter !== lastQ) {
      rows.push({ type: 'header', label: `${p.quarter}/${p.year ?? 2569}` });
      lastQ = p.quarter;
    }
    rows.push({ type: 'project', data: p });
  }

  // Assign Y positions
  let y = START_Y;
  let nodeIdx = 0;
  const positioned = rows.map(row => {
    const thisY = y;
    if (row.type === 'header') {
      y += HDR_H;
      return { ...row, y: thisY };
    }
    const isLeft = nodeIdx % 2 === 0;
    const trailX = isLeft ? TRAIL_L : TRAIL_R;
    const result = { ...row, y: thisY, trailX, nodeIdx };
    y += GAP_Y;
    nodeIdx++;
    return result;
  });

  const containerH = y + 60;

  // SVG polyline for the project nodes
  const nodes = positioned.filter(r => r.type === 'project');
  const trailPoints = nodes
    .map(n => `${n.trailX + NODE_R},${n.y + NODE_R}`)
    .join(' ');

  // Completed / in-progress portion of trail
  let doneUpTo = -1;
  nodes.forEach((n, i) => { if (getStatus(n.data.current_step) !== 'planned') doneUpTo = i; });
  const trailPointsDone = doneUpTo >= 0
    ? nodes.slice(0, doneUpTo + 1).map(n => `${n.trailX + NODE_R},${n.y + NODE_R}`).join(' ')
    : '';

  return { positioned, containerH, trailPoints, trailPointsDone };
}

// ── Main component ────────────────────────────────────────────────────────────
export default function RoadmapTrail() {
  const navigate  = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/training-projects')
      .then(setProjects)
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-ink-400 text-sm font-body">
        กำลังโหลด…
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center text-ink-400 font-body gap-2">
        <p className="text-sm">ยังไม่มีโครงการฝึกอบรม</p>
        <p className="text-xs text-ink-300">เพิ่มโครงการด้านขวาเพื่อเริ่มวางแผนปีงบประมาณ</p>
      </div>
    );
  }

  const completedCount = projects.filter(p => getStatus(p.current_step) === 'completed').length;
  const inProgressCount = projects.filter(p => getStatus(p.current_step) === 'in_progress').length;
  const totalCount = projects.length;
  const progressPct = Math.round((completedCount / totalCount) * 100);
  const xp = completedCount * 100 + inProgressCount * 40;

  const { positioned, containerH, trailPoints, trailPointsDone } = buildLayout(projects);

  return (
    <div
      className="w-full rounded-2xl border border-ink-200 px-6 pt-7 pb-10 font-display"
      style={{ background: 'linear-gradient(180deg,#FAF7F6 0%,#FFFFFF 100%)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-lg font-semibold text-ink-900 leading-snug">เส้นทางฝึกอบรม {projects[0]?.year ?? 2569}</div>
          <div className="text-xs text-ink-500 mt-1 font-body">{completedCount}/{totalCount} โครงการสำเร็จแล้ว</div>
        </div>
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold"
          style={{ background: '#FCEBEC', border: '1px solid #F7D2D4', color: '#710F16' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" /></svg>
          {xp} XP
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-ink-100 overflow-hidden mb-7">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${progressPct}%`, background: 'linear-gradient(135deg,#C71620 0%,#710F16 60%,#4A0A0E 100%)' }}
        />
      </div>

      {/* Trail + cards */}
      <div className="relative w-full" style={{ height: containerH }}>
        {/* Trail SVG */}
        <svg
          width={TRAIL_W}
          height={containerH}
          style={{ position: 'absolute', top: 0, left: 0 }}
          viewBox={`0 0 ${TRAIL_W} ${containerH}`}
        >
          {trailPoints && (
            <polyline
              points={trailPoints}
              fill="none"
              stroke="#E4DEDC"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {trailPointsDone && (
            <polyline
              points={trailPointsDone}
              fill="none"
              stroke="#710F16"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>

        {/* Rows */}
        {positioned.map((row, i) => {
          if (row.type === 'header') {
            return (
              <div
                key={`h-${i}`}
                className="absolute flex items-center gap-2"
                style={{ top: row.y + 12, left: CARD_X }}
              >
                <span className="text-xs font-bold text-ink-900 bg-ink-900 text-white px-3 py-1 rounded-full font-display">
                  {row.label}
                </span>
                <div className="flex-1 h-px bg-ink-200" style={{ width: CARD_W - 100 }} />
              </div>
            );
          }

          const p = row.data;
          const status = getStatus(p.current_step);
          const meta = STATUS_META[status];
          const isActive = status === 'in_progress';
          const isPlanned = status === 'planned';

          return (
            <button
              key={p.id}
              onClick={() => navigate(`/development/workflow/${p.id}`)}
              className="absolute text-left focus-visible:outline-none"
              style={{ top: row.y, left: 0, width: TRAIL_W + CARD_W + CARD_X }}
            >
              {/* Node circle */}
              <div
                className={`absolute flex items-center justify-center transition-transform hover:scale-105 ${isActive ? 'animate-pulse-ring' : ''}`}
                style={{
                  top: 0,
                  left: row.trailX,
                  width: NODE_R * 2,
                  height: NODE_R * 2,
                  borderRadius: '50%',
                  background: meta.bg,
                  border: `3px ${isPlanned ? 'dashed' : 'solid'} ${meta.border}`,
                  color: meta.color,
                  boxShadow: '0 1px 3px rgba(35,31,32,.08)',
                  opacity: isPlanned ? 0.65 : 1,
                }}
              >
                {status === 'completed'   && <CheckIcon />}
                {status === 'in_progress' && <BoltIcon />}
                {status === 'planned'     && <LockIcon />}
              </div>

              {/* Detail card */}
              <div
                className="absolute rounded-xl p-3 transition-shadow hover:shadow-md"
                style={{
                  top: 0,
                  left: CARD_X,
                  width: CARD_W,
                  background: '#F1ECEA',
                  border: '1px solid #E4DEDC',
                  boxShadow: '0 1px 2px rgba(35,31,32,.05)',
                  opacity: isPlanned ? 0.6 : 1,
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold text-ink-500 font-display">#{row.nodeIdx + 1}</span>
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full font-body"
                    style={{ background: meta.bg, color: meta.color }}
                  >
                    {meta.label}
                  </span>
                  <span className="ml-auto text-[10px] text-ink-400 font-body">{p.quarter}/{p.year}</span>
                </div>
                <div className="text-[13px] font-semibold text-ink-900 leading-snug mb-0.5 font-display">
                  {p.name}
                </div>
                {p.description && (
                  <div className="text-[11.5px] text-ink-500 leading-normal mb-1.5 font-body">
                    {p.description}
                  </div>
                )}
                <div className="text-[11px] text-ink-400 font-body">
                  {isPlanned
                    ? `เป้าหมาย ${p.participant_count} คน`
                    : `${p.participant_count} คนเข้าอบรม`}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
