import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, X, Loader2, Calendar, Phone, Trophy } from 'lucide-react';
import { api } from '../../lib/api.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  const be = String(Number(dateStr.slice(0, 4)) + 543);
  return {
    col: { day: days[d.getDay()], dd: dateStr.slice(8) + '/' + dateStr.slice(5, 7) },
    full: `${days[d.getDay()]} ${dateStr.slice(8)}/${dateStr.slice(5, 7)}/${be}`,
  };
}

const STATUS_CYCLE = ['available', 'unavailable', 'tentative'];
const STATUS_CFG = {
  available:   { bg: '#E3F4EC', color: '#1E7A52', label: 'ว่าง' },
  unavailable: { bg: '#FCEBEC', color: '#710F16', label: 'ติด' },
  tentative:   { bg: '#FEF3C7', color: '#92400E', label: '??' },
};

function cycleStatus(cur) {
  if (!cur) return 'available';
  return STATUS_CYCLE[(STATUS_CYCLE.indexOf(cur) + 1) % STATUS_CYCLE.length];
}

// ── Shared small components ───────────────────────────────────────────────────

function SourceBadge({ type }) {
  if (!type) return null;
  const isInt = type === 'internal';
  return (
    <span
      className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded"
      style={{ background: isInt ? '#E3F4EC' : '#EFF6FF', color: isInt ? '#1E7A52' : '#1D4ED8' }}
    >
      {isInt ? 'In' : 'Ex'}
    </span>
  );
}

function SectionRow({ label, colCount }) {
  return (
    <tr>
      <td colSpan={colCount + 1} className="px-3 py-2 text-xs font-semibold uppercase tracking-wider font-display border-b border-slate-200" style={{ background: '#F4F0EF', color: '#78716E' }}>
        {label}
      </td>
    </tr>
  );
}

function AddRow({ label, onClick, colCount }) {
  return (
    <tr>
      <td colSpan={colCount + 1} className="border-b border-slate-200 px-3 py-1.5" style={{ background: '#FAF7F6' }}>
        <button onClick={onClick} className="flex items-center gap-1.5 text-xs text-ink-500 hover:text-ink-800 transition-colors font-body">
          <Plus className="w-3.5 h-3.5" /> {label}
        </button>
      </td>
    </tr>
  );
}

function EntityRow({ entity, dates, onToggle, onRemove, savingKeys }) {
  return (
    <tr>
      <td className="border border-slate-200 px-3 py-2 text-sm whitespace-nowrap font-body" style={{ minWidth: 200, maxWidth: 230, background: '#FAF7F6' }}>
        <div className="flex items-center gap-1 group">
          <span className="text-ink-800 flex-1 truncate">{entity.entity_name || entity.entity_ref}</span>
          <SourceBadge type={entity.source_type} />
          <button
            onClick={() => onRemove(entity)}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-ink-300 hover:text-red-600 shrink-0"
            title="ลบออก"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
      {dates.map(date => {
        const key = `${entity.entity_type}:${entity.entity_ref}:${date}`;
        const slot = entity.slots[date];
        const cfg = slot ? STATUS_CFG[slot.status] : null;
        const isSaving = savingKeys.has(key);
        return (
          <td
            key={date}
            onClick={isSaving ? undefined : () => onToggle(entity, date, slot?.status)}
            className="border border-slate-200 text-center text-xs font-semibold select-none transition-colors"
            style={{
              width: 80, minWidth: 80, height: 40,
              cursor: isSaving ? 'default' : 'pointer',
              background: isSaving ? '#F1ECEA' : (cfg ? cfg.bg : '#F8F5F4'),
              color: isSaving ? '#C4BDBA' : (cfg ? cfg.color : '#C4BDBA'),
            }}
          >
            {isSaving ? '…' : (cfg ? cfg.label : '')}
          </td>
        );
      })}
    </tr>
  );
}

// ── Modals ────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4 font-body">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-ink-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100" style={{ background: '#FCEBEC' }}>
          <span className="font-semibold text-ink-900 font-display">{title}</span>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700 transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function ModalFooter({ onClose, onConfirm, saving, disabled }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-ink-600 hover:bg-ink-100 transition-colors">ยกเลิก</button>
      <button
        type="button" onClick={onConfirm} disabled={saving || disabled}
        className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60 transition-colors"
        style={{ background: (saving || disabled) ? '#9B9491' : '#710F16' }}
      >
        {saving ? 'กำลังบันทึก…' : 'ยืนยัน'}
      </button>
    </div>
  );
}

const NO_DEPARTMENT_LABEL = 'ไม่ระบุแผนก';

function groupByDepartment(employees) {
  const groups = new Map();
  for (const e of employees) {
    const dept = e.department?.trim() || NO_DEPARTMENT_LABEL;
    if (!groups.has(dept)) groups.set(dept, []);
    groups.get(dept).push(e);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a === NO_DEPARTMENT_LABEL ? 1 : b === NO_DEPARTMENT_LABEL ? -1 : a.localeCompare(b, 'th'))
    .map(([dept, emps]) => [dept, emps.sort((a, b) => a.full_name.localeCompare(b.full_name, 'th'))]);
}

function AddParticipantModal({ projectId, existingRefs, onClose, onAdded }) {
  const [employees, setEmployees] = useState([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/employees')
      .then(list => { setEmployees(list.filter(e => !existingRefs.has(e.code))); setLoading(false); })
      .catch(e => { toast.error(e.message); setLoading(false); });
  }, []);

  async function confirm() {
    if (!selected) { toast.error('กรุณาเลือกพนักงาน'); return; }
    setSaving(true);
    try {
      await api.post('/availability', { training_project_id: projectId, entity_type: 'participant', entity_ref: selected, slot_date: todayStr(), status: 'available', note: null });
      toast.success('เพิ่มผู้เข้าอบรมแล้ว');
      onAdded(); onClose();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  const departmentGroups = groupByDepartment(employees);

  return (
    <Modal title="เพิ่มผู้เข้าอบรม" onClose={onClose}>
      {loading ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-ink-400" /></div> : (
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="text-ink-700 font-medium">พนักงาน</span>
            <select className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm" value={selected} onChange={e => setSelected(e.target.value)}>
              <option value="">— เลือก —</option>
              {departmentGroups.map(([dept, emps]) => (
                <optgroup key={dept} label={dept}>
                  {emps.map(e => <option key={e.code} value={e.code}>{e.full_name} ({e.code})</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          {employees.length === 0 && (
            <p className="text-xs text-ink-400">พนักงานทั้งหมดถูกเพิ่มไว้ในโครงการนี้แล้ว</p>
          )}
          <ModalFooter onClose={onClose} onConfirm={confirm} saving={saving} disabled={!selected} />
        </div>
      )}
    </Modal>
  );
}

function AddInstructorModal({ projectId, existingRefs, onClose, onAdded }) {
  const [instructors, setInstructors] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/instructors')
      .then(insts => setInstructors(insts.filter(i => !existingRefs.has(String(i.id)))))
      .catch(e => toast.error(e.message));
  }, []);

  async function confirm() {
    if (!selectedId) { toast.error('กรุณาเลือกวิทยากร'); return; }
    setSaving(true);
    try {
      await api.post('/availability', { training_project_id: projectId, entity_type: 'instructor', entity_ref: selectedId, slot_date: todayStr(), status: 'available', note: null });
      toast.success('เพิ่มวิทยากรแล้ว');
      onAdded(); onClose();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  return (
    <Modal title="เพิ่มวิทยากร" onClose={onClose}>
      <div className="space-y-4">
        <label className="block text-sm">
          <span className="text-ink-700 font-medium">วิทยากร</span>
          <select className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
            <option value="">— เลือก —</option>
            {instructors.map(i => <option key={i.id} value={String(i.id)}>{i.name} [{i.source_type === 'internal' ? 'In' : 'Ex'}]</option>)}
          </select>
        </label>
        {instructors.length === 0 && (
          <p className="text-xs text-ink-400">ยังไม่มีวิทยากรใน Setup — เพิ่มได้ที่ Setup &gt; วิทยากร/สถานที่</p>
        )}
        <ModalFooter onClose={onClose} onConfirm={confirm} saving={saving} disabled={!selectedId} />
      </div>
    </Modal>
  );
}

function AddVenueModal({ projectId, existingRefs, onClose, onAdded }) {
  const [venues, setVenues] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/venues')
      .then(list => setVenues(list.filter(v => !existingRefs.has(String(v.id)))))
      .catch(e => toast.error(e.message));
  }, []);

  async function confirm() {
    if (!selectedId) { toast.error('กรุณาเลือกสถานที่'); return; }
    setSaving(true);
    try {
      await api.post('/availability', { training_project_id: projectId, entity_type: 'venue', entity_ref: selectedId, slot_date: todayStr(), status: 'available', note: null });
      toast.success('เพิ่มสถานที่แล้ว');
      onAdded(); onClose();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  return (
    <Modal title="เพิ่มสถานที่" onClose={onClose}>
      <div className="space-y-4">
        <label className="block text-sm">
          <span className="text-ink-700 font-medium">สถานที่</span>
          <select className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm" value={selectedId} onChange={e => setSelectedId(e.target.value)}>
            <option value="">— เลือก —</option>
            {venues.map(v => <option key={v.id} value={String(v.id)}>{v.name} [{v.source_type === 'internal' ? 'In' : 'Ex'}]{v.capacity ? ` · ${v.capacity} คน` : ''}</option>)}
          </select>
        </label>
        {venues.length === 0 && (
          <p className="text-xs text-ink-400">ยังไม่มีสถานที่ใน Setup — เพิ่มได้ที่ Setup &gt; วิทยากร/สถานที่</p>
        )}
        <ModalFooter onClose={onClose} onConfirm={confirm} saving={saving} disabled={!selectedId} />
      </div>
    </Modal>
  );
}

// ── Step indicator ────────────────────────────────────────────────────────────

const STEPS = [
  { n: 1, label: 'กำหนดวันและทรัพยากร' },
  { n: 2, label: 'กรอกความพร้อม' },
  { n: 3, label: 'ผลลัพธ์' },
];

function StepIndicator({ step, onSelect }) {
  return (
    <div className="flex items-center gap-1 mb-6 flex-wrap">
      {STEPS.map((s, i) => (
        <div key={s.n} className="flex items-center gap-1">
          <button
            onClick={() => onSelect(s.n)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: step === s.n ? '#710F16' : 'transparent',
              color: step === s.n ? 'white' : step > s.n ? '#1E7A52' : '#9B9491',
            }}
          >
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{
                background: step === s.n ? 'rgba(255,255,255,0.2)' : step > s.n ? '#E3F4EC' : '#F4F0EF',
                color: step === s.n ? 'white' : step > s.n ? '#1E7A52' : '#9B9491',
              }}
            >
              {s.n}
            </span>
            {s.label}
          </button>
          {i < STEPS.length - 1 && <div className="w-5 h-px" style={{ background: '#D6D0CE' }} />}
        </div>
      ))}
    </div>
  );
}

// ── Step 1 ────────────────────────────────────────────────────────────────────

function ResourceCard({ title, items, onAdd, onRemove, badge }) {
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 text-sm font-semibold font-display border-b border-slate-200 flex items-center justify-between" style={{ background: '#F4F0EF', color: '#78716E' }}>
        <span>{title}</span>
        <span className="text-ink-400 font-normal text-xs">{items.length} รายการ</span>
      </div>
      <div className="p-3 space-y-1" style={{ background: '#FAF7F6', minHeight: 80 }}>
        {items.length === 0 && <p className="text-xs text-ink-400 py-2">ยังไม่มี</p>}
        {items.map(item => (
          <div key={item.entity_ref} className="flex items-center gap-1 text-sm text-ink-800 group">
            <span className="flex-1 truncate">{item.entity_name || item.entity_ref}</span>
            {badge && badge(item)}
            <button
              onClick={() => onRemove(item)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-ink-300 hover:text-red-600 shrink-0"
              title="ลบออก"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <button onClick={onAdd} className="flex items-center gap-1 text-xs text-ink-500 hover:text-ink-800 transition-colors pt-2">
          <Plus className="w-3 h-3" /> เพิ่ม
        </button>
      </div>
    </div>
  );
}

function Step1({ projectId, candidateDates, onAddDate, onRemoveDate, matrixData, onAddModal, onRemove, onNext }) {
  const [newDate, setNewDate] = useState('');

  function handleAdd() {
    if (!newDate) { toast.error('กรุณาเลือกวันที่'); return; }
    onAddDate(newDate);
    setNewDate('');
  }

  return (
    <div className="space-y-6">
      {/* Candidate dates picker */}
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 text-sm font-semibold font-display border-b border-slate-200 flex items-center gap-2" style={{ background: '#F4F0EF', color: '#78716E' }}>
          <Calendar className="w-4 h-4" /> วันที่ต้องการพิจารณา
        </div>
        <div className="p-4 space-y-3" style={{ background: '#FAF7F6' }}>
          {candidateDates.length === 0 && (
            <p className="text-sm text-ink-400">ยังไม่มีวันที่ผู้สมัคร — เพิ่มวันด้านล่าง</p>
          )}
          <div className="flex flex-wrap gap-2">
            {candidateDates.map(cd => (
              <div key={cd.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border" style={{ background: 'white', borderColor: '#D6D0CE', color: '#3B3330' }}>
                {formatDate(cd.date).full}
                <button onClick={() => onRemoveDate(cd.id)} className="text-ink-400 hover:text-red-600 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 items-center pt-1">
            <input
              type="date"
              className="rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-300"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
            />
            <button onClick={handleAdd} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#710F16' }}>
              <Plus className="w-4 h-4" /> เพิ่มวัน
            </button>
          </div>
        </div>
      </div>

      {/* Resources */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ResourceCard title="วิทยากร" items={matrixData.instructors} onAdd={() => onAddModal('instructor')} onRemove={onRemove} badge={e => <SourceBadge type={e.source_type} />} />
        <ResourceCard title="สถานที่" items={matrixData.venues} onAdd={() => onAddModal('venue')} onRemove={onRemove} badge={e => <SourceBadge type={e.source_type} />} />
        <ResourceCard title="ผู้เข้าอบรม" items={matrixData.participants} onAdd={() => onAddModal('participant')} onRemove={onRemove} />
      </div>

      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={candidateDates.length === 0}
          className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-colors"
          style={{ background: '#710F16' }}
        >
          ถัดไป: กรอกความพร้อม →
        </button>
      </div>
    </div>
  );
}

// ── Step 2 ────────────────────────────────────────────────────────────────────

function Step2({ candidateDates, matrixData, onToggle, onRemove, savingKeys, onAddModal, onPrev, onNext }) {
  const dates = candidateDates.map(cd => cd.date);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border px-4 py-3" style={{ background: '#FEF3C7', borderColor: '#FCD34D' }}>
        <Phone className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" />
        <p className="text-sm text-amber-800">
          <span className="font-semibold">ขั้นตอนนี้:</span> ติดต่อวิทยากร สถานที่ และผู้เข้าอบรม แล้วกรอกความพร้อมในตารางด้านล่าง — คลิก cell เพื่อสลับสถานะ (ว่าง → ติด → ??) · hover ที่ชื่อเพื่อลบออก
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs font-body">
        {Object.entries(STATUS_CFG).map(([s, cfg]) => (
          <div key={s} className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded" style={{ background: cfg.bg, border: `1px solid ${cfg.color}40` }} />
            <span className="text-ink-500">{cfg.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded" style={{ background: '#F8F5F4', border: '1px solid #C4BDBA' }} />
          <span className="text-ink-500">ยังไม่กรอก</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
        <table className="border-collapse" style={{ tableLayout: 'fixed', minWidth: 220 + dates.length * 80 }}>
          <colgroup>
            <col style={{ width: 220 }} />
            {dates.map(d => <col key={d} style={{ width: 80 }} />)}
          </colgroup>
          <thead>
            <tr style={{ background: '#F4F0EF' }}>
              <th className="border border-slate-200 px-3 py-2 text-left text-xs font-semibold text-ink-500 font-display">ชื่อ</th>
              {dates.map(d => {
                const { col } = formatDate(d);
                return (
                  <th key={d} className="border border-slate-200 text-center text-xs font-display" style={{ color: '#710F16' }}>
                    <div className="font-semibold">{col.day}</div>
                    <div className="text-ink-500 font-normal">{col.dd}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <SectionRow label="วิทยากร" colCount={dates.length} />
            {matrixData.instructors.map(e => <EntityRow key={e.entity_ref} entity={e} dates={dates} onToggle={onToggle} onRemove={onRemove} savingKeys={savingKeys} />)}
            <AddRow label="+ เพิ่มวิทยากร" colCount={dates.length} onClick={() => onAddModal('instructor')} />

            <SectionRow label="สถานที่" colCount={dates.length} />
            {matrixData.venues.map(e => <EntityRow key={e.entity_ref} entity={e} dates={dates} onToggle={onToggle} onRemove={onRemove} savingKeys={savingKeys} />)}
            <AddRow label="+ เพิ่มสถานที่" colCount={dates.length} onClick={() => onAddModal('venue')} />

            <SectionRow label="ผู้เข้าอบรม" colCount={dates.length} />
            {matrixData.participants.map(e => <EntityRow key={e.entity_ref} entity={e} dates={dates} onToggle={onToggle} onRemove={onRemove} savingKeys={savingKeys} />)}
            <AddRow label="+ เพิ่มผู้เข้าอบรม" colCount={dates.length} onClick={() => onAddModal('participant')} />
          </tbody>
        </table>
      </div>

      <div className="flex justify-between">
        <button onClick={onPrev} className="px-4 py-2 rounded-lg text-sm text-ink-600 hover:bg-ink-100 border border-ink-200 transition-colors">← กลับ</button>
        <button onClick={onNext} className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors" style={{ background: '#710F16' }}>ดูผลลัพธ์ →</button>
      </div>
    </div>
  );
}

// ── Step 3 ────────────────────────────────────────────────────────────────────

function StatusTag({ ok, label }) {
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: ok ? '#E3F4EC' : '#FCEBEC', color: ok ? '#1E7A52' : '#710F16' }}>
      {label}: {ok ? 'ว่าง' : 'ติด'}
    </span>
  );
}

function Step3({ ranking, onPrev, onRefresh, loading }) {
  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-ink-400" /></div>;
  }
  if (ranking.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-ink-500">ไม่มีข้อมูล — กลับไปเพิ่มวันที่ผู้สมัครก่อน</p>
        <button onClick={onPrev} className="px-4 py-2 rounded-lg text-sm text-ink-600 hover:bg-ink-100 border border-ink-200">← กลับ</button>
      </div>
    );
  }

  const best = ranking.find(r => r.instructor_ok && r.venue_ok) || ranking[0];

  return (
    <div className="space-y-4">
      {best.instructor_ok && best.venue_ok && (
        <div className="flex items-center gap-3 rounded-xl border px-5 py-4" style={{ background: '#E3F4EC', borderColor: '#6EE7B7' }}>
          <Trophy className="w-5 h-5 text-emerald-700 shrink-0" />
          <div>
            <div className="font-semibold text-emerald-900 font-display">วันที่แนะนำ: {formatDate(best.date).full}</div>
            <div className="text-sm text-emerald-700 mt-0.5">
              วิทยากร ✓ · สถานที่ ✓ · ผู้เข้าอบรมว่าง {best.participant_available}/{best.participant_total} คน
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {ranking.map((r, i) => {
          const blocked = !r.instructor_ok || !r.venue_ok;
          const pct = r.participant_total > 0 ? Math.round(r.participant_available / r.participant_total * 100) : 0;
          const isBest = r.candidate_id === best.candidate_id;
          return (
            <div key={r.candidate_id} className="rounded-xl border px-4 py-3 space-y-2"
              style={{ background: blocked ? '#FAF7F6' : (isBest ? '#F0FDF4' : 'white'), borderColor: blocked ? '#E7E3E0' : (isBest ? '#6EE7B7' : '#E7E3E0'), opacity: blocked ? 0.65 : 1 }}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: blocked ? '#F4F0EF' : (isBest ? '#E3F4EC' : '#F4F0EF'), color: blocked ? '#9B9491' : (isBest ? '#1E7A52' : '#78716E') }}>
                    {i + 1}
                  </span>
                  <span className="font-semibold text-ink-900 font-display">{formatDate(r.date).full}</span>
                  {blocked && <span className="text-xs font-medium" style={{ color: '#710F16' }}>(ทรัพยากรติด)</span>}
                </div>
                <div className="flex items-center gap-2">
                  <StatusTag ok={r.instructor_ok} label="วิทยากร" />
                  <StatusTag ok={r.venue_ok} label="สถานที่" />
                </div>
              </div>

              {r.participant_total > 0 ? (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-ink-500">
                    <span>ผู้เข้าอบรม</span>
                    <span>{r.participant_available}/{r.participant_total} ว่าง ({pct}%)</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: '#F4F0EF' }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: blocked ? '#9B9491' : '#1E7A52' }} />
                  </div>
                  <div className="flex gap-3 text-xs text-ink-400">
                    {r.participant_unavailable > 0 && <span style={{ color: '#710F16' }}>ติด {r.participant_unavailable} คน</span>}
                    {r.participant_tentative > 0 && <span style={{ color: '#92400E' }}>?? {r.participant_tentative} คน</span>}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-ink-400">ยังไม่มีข้อมูลผู้เข้าอบรม</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between">
        <button onClick={onPrev} className="px-4 py-2 rounded-lg text-sm text-ink-600 hover:bg-ink-100 border border-ink-200 transition-colors">← กลับแก้ไข</button>
        <button onClick={onRefresh} className="px-4 py-2 rounded-lg text-sm text-ink-600 hover:bg-ink-100 border border-ink-200 transition-colors">รีเฟรชผล</button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AvailabilityMatrixPage() {
  const [searchParams] = useSearchParams();
  const deepLinkId = searchParams.get('projectId');

  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [step, setStep] = useState(1);
  const [candidateDates, setCandidateDates] = useState([]);
  const [matrixData, setMatrixData] = useState({ participants: [], instructors: [], venues: [] });
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(false);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [savingKeys, setSavingKeys] = useState(new Set());
  const [addModal, setAddModal] = useState(null);

  useEffect(() => {
    api.get('/training-projects').then(list => {
      setProjects(list);
      if (deepLinkId && list.some(p => String(p.id) === deepLinkId)) setProjectId(deepLinkId);
    }).catch(e => toast.error(e.message));
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const loadAll = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [matrix, dates] = await Promise.all([
        api.get(`/availability/${projectId}`),
        api.get(`/candidate-dates/${projectId}`),
      ]);
      setMatrixData(matrix);
      setCandidateDates(dates);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const loadRanking = useCallback(async () => {
    if (!projectId) return;
    setRankingLoading(true);
    try {
      setRanking(await api.get(`/availability/${projectId}/ranking`));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setRankingLoading(false);
    }
  }, [projectId]);

  async function addCandidateDate(date) {
    try {
      await api.post('/candidate-dates', { training_project_id: Number(projectId), date });
      await loadAll();
    } catch (e) {
      toast.error(e.message?.includes('UNIQUE') ? 'วันนี้มีอยู่แล้ว' : e.message);
    }
  }

  async function removeCandidateDate(id) {
    try {
      await api.del(`/candidate-dates/${id}`);
      await loadAll();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function handleRemove(entity) {
    if (!window.confirm(`ลบ "${entity.entity_name || entity.entity_ref}" ออกจากโครงการนี้?`)) return;
    try {
      await api.del(`/availability/${projectId}/entity/${entity.entity_type}/${entity.entity_ref}`);
      toast.success('ลบออกแล้ว');
      await loadAll();
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function handleToggle(entity, date, currentStatus) {
    const key = `${entity.entity_type}:${entity.entity_ref}:${date}`;
    setSavingKeys(prev => new Set(prev).add(key));
    const newStatus = cycleStatus(currentStatus);
    try {
      await api.post('/availability', {
        training_project_id: Number(projectId),
        entity_type: entity.entity_type,
        entity_ref: entity.entity_ref,
        slot_date: date,
        status: newStatus,
        note: null,
      });
      const section = entity.entity_type === 'participant' ? 'participants'
        : entity.entity_type === 'instructor' ? 'instructors' : 'venues';
      setMatrixData(prev => ({
        ...prev,
        [section]: prev[section].map(e =>
          e.entity_ref === entity.entity_ref
            ? { ...e, slots: { ...e.slots, [date]: { status: newStatus, note: null } } }
            : e,
        ),
      }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingKeys(prev => { const s = new Set(prev); s.delete(key); return s; });
    }
  }

  const existingRefs = {
    participant: new Set(matrixData.participants.map(e => e.entity_ref)),
    instructor: new Set(matrixData.instructors.map(e => e.entity_ref)),
    venue: new Set(matrixData.venues.map(e => e.entity_ref)),
  };

  const backProject = deepLinkId ? projects.find(p => String(p.id) === deepLinkId) : null;

  function goStep3() { setStep(3); loadRanking(); }

  return (
    <div className="space-y-5 font-body">
      {backProject && (
        <Link to={`/development/workflow/${deepLinkId}`} className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800 transition-colors">
          <ArrowLeft className="w-4 h-4" /> กลับไปที่ Workflow: {backProject.name}
        </Link>
      )}

      <div>
        <h1 className="text-2xl font-bold text-ink-900 font-display">จัดหาวันจัดอบรม</h1>
        <p className="text-sm text-ink-500 mt-0.5">กรอง → ถาม → จัดอันดับ ทีละขั้นตอน</p>
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
            className="rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-maroon-300 w-72"
            value={projectId}
            onChange={e => { setProjectId(e.target.value); setStep(1); }}
          >
            <option value="">— เลือกโครงการ —</option>
            {projects.map(p => <option key={p.id} value={String(p.id)}>{p.name} ({p.quarter}/{p.year})</option>)}
          </select>
        )}
      </div>

      {!projectId && (
        <div className="rounded-xl border border-slate-200 py-20 text-center text-sm text-ink-400" style={{ background: '#FAF7F6' }}>
          เลือกโครงการฝึกอบรมเพื่อเริ่ม
        </div>
      )}

      {projectId && loading && (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-ink-400" /></div>
      )}

      {projectId && !loading && (
        <>
          <StepIndicator step={step} onSelect={setStep} />

          {step === 1 && (
            <Step1
              projectId={projectId}
              candidateDates={candidateDates}
              onAddDate={addCandidateDate}
              onRemoveDate={removeCandidateDate}
              matrixData={matrixData}
              onAddModal={setAddModal}
              onRemove={handleRemove}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <Step2
              candidateDates={candidateDates}
              matrixData={matrixData}
              onToggle={handleToggle}
              onRemove={handleRemove}
              savingKeys={savingKeys}
              onAddModal={setAddModal}
              onPrev={() => setStep(1)}
              onNext={goStep3}
            />
          )}
          {step === 3 && (
            <Step3
              ranking={ranking}
              onPrev={() => setStep(2)}
              onRefresh={loadRanking}
              loading={rankingLoading}
            />
          )}
        </>
      )}

      {addModal === 'participant' && (
        <AddParticipantModal projectId={Number(projectId)} existingRefs={existingRefs.participant} onClose={() => setAddModal(null)} onAdded={loadAll} />
      )}
      {addModal === 'instructor' && (
        <AddInstructorModal projectId={Number(projectId)} existingRefs={existingRefs.instructor} onClose={() => setAddModal(null)} onAdded={loadAll} />
      )}
      {addModal === 'venue' && (
        <AddVenueModal projectId={Number(projectId)} existingRefs={existingRefs.venue} onClose={() => setAddModal(null)} onAdded={loadAll} />
      )}
    </div>
  );
}
