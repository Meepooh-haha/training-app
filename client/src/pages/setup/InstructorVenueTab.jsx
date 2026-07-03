import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, BookOpen, X } from 'lucide-react';
import { api } from '../../lib/api.js';
import Modal, { ModalFooter } from '../../components/Modal.jsx';
import { Button, Field, Input, Select } from '../../components/ui.jsx';

// ── Shared display helpers ────────────────────────────────────────────────────

function SourceBadge({ type }) {
  const isInt = type === 'internal';
  return (
    <span
      className="inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded"
      style={isInt
        ? { background: '#E3F4EC', color: '#1E7A52' }
        : { background: '#EFF6FF', color: '#1D4ED8' }}
    >
      {isInt ? 'In' : 'Ex'}
    </span>
  );
}

function VendorCell({ vendor_id, vendor_name, is_registered }) {
  if (!vendor_id) return <span className="text-xs text-slate-400">—</span>;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-semibold">{is_registered ? '🟢' : '🟡'}</span>
      <span className="text-xs text-slate-600 truncate max-w-[140px]">{vendor_name}</span>
    </div>
  );
}

// ── VendorPicker — inline search-and-select ───────────────────────────────────

function VendorPicker({ vendorId, vendorName, onChange }) {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    api.get(`/vendors?search=${encodeURIComponent(query)}`).then(setResults).catch(() => {});
  }, [query]);

  if (vendorId && !query) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
          {vendorName || `Vendor #${vendorId}`}
        </span>
        <button
          type="button"
          onClick={() => onChange(null, null)}
          className="text-xs text-slate-400 hover:text-red-600 whitespace-nowrap"
        >
          ยกเลิก
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <input
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        placeholder="ค้นหา Vendor (ชื่อ / เลขภาษี)..."
        value={query}
        onChange={e => setQuery(e.target.value)}
      />
      {query && results.length > 0 && (
        <ul className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100 bg-white shadow-sm">
          {results.map(v => (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => { onChange(v.id, v.vendor_name); setQuery(''); }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 text-slate-800"
              >
                {v.vendor_name}
                {v.tax_id && <span className="ml-2 text-xs text-slate-400">{v.tax_id}</span>}
                <span className="ml-2">{v.is_registered ? '🟢' : '🟡'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {query && results.length === 0 && (
        <p className="text-xs text-slate-400 px-1">ไม่พบ Vendor — เพิ่มได้ใน Setup &gt; Vendor</p>
      )}
    </div>
  );
}

// ── Instructors panel ─────────────────────────────────────────────────────────

const INST_EMPTY = {
  source_type: 'external', name: '',
  vendor_id: null, vendor_name: '', notes: '',
};

function InstructorsPanel() {
  const [instructors, setInstructors] = useState([]);
  const [editing, setEditing]         = useState(null);
  const [form, setForm]               = useState(INST_EMPTY);
  const [saving, setSaving]           = useState(false);

  // Topics modal state
  const [topicsInst, setTopicsInst]   = useState(null);
  const [topics, setTopics]           = useState([]);
  const [allTopics, setAllTopics]     = useState([]);
  const [addingTopic, setAddingTopic] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function load() {
    setInstructors(await api.get('/instructors').catch(() => []));
  }

  useEffect(() => { load(); }, []);

  function openNew() { setForm(INST_EMPTY); setEditing({ isNew: true }); }

  function openEdit(i) {
    setForm({
      source_type: i.source_type,
      name:        i.name,
      vendor_id:   i.vendor_id   || null,
      vendor_name: i.vendor_name || '',
      notes:       i.notes       || '',
    });
    setEditing({ isNew: false, id: i.id });
  }

  async function save() {
    if (!form.name.trim()) return toast.error('กรุณากรอกชื่อวิทยากร');
    setSaving(true);
    try {
      const payload = {
        name:      form.name.trim(),
        vendor_id: form.source_type === 'external' ? form.vendor_id : null,
        notes:     form.notes || null,
      };
      if (editing.isNew) await api.post('/instructors', { ...payload, source_type: form.source_type });
      else               await api.patch(`/instructors/${editing.id}`, payload);
      toast.success('บันทึกสำเร็จ');
      setEditing(null);
      load();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function remove(id, name) {
    if (!window.confirm(`ลบวิทยากร "${name}"?\nการกระทำนี้ไม่สามารถย้อนกลับได้`)) return;
    try {
      await api.del(`/instructors/${id}`);
      toast.success('ลบแล้ว');
      load();
    } catch (e) { toast.error(e.message); }
  }

  async function openTopics(inst) {
    setTopicsInst(inst);
    setAddingTopic('');
    const [linked, all] = await Promise.all([
      api.get(`/instructors/${inst.id}/topics`).catch(() => []),
      api.get('/topics').catch(() => []),
    ]);
    setTopics(linked);
    setAllTopics(all);
  }

  async function addTopic() {
    if (!addingTopic) return;
    try {
      await api.post(`/instructors/${topicsInst.id}/topics`, { topic_code: addingTopic });
      const linked = await api.get(`/instructors/${topicsInst.id}/topics`);
      setTopics(linked);
      setAddingTopic('');
      load();
    } catch (e) { toast.error(e.message); }
  }

  async function removeTopic(code) {
    try {
      await api.del(`/instructors/${topicsInst.id}/topics/${code}`);
      const linked = await api.get(`/instructors/${topicsInst.id}/topics`);
      setTopics(linked);
      load();
    } catch (e) { toast.error(e.message); }
  }

  const linkedCodes     = new Set(topics.map(t => t.code));
  const availableTopics = allTopics.filter(t => !linkedCodes.has(t.code));

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="text-base font-semibold text-slate-800">รายชื่อวิทยากร</h3>
          <Button size="sm" onClick={openNew}><Plus size={14} /> เพิ่มวิทยากร</Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">ชื่อวิทยากร</th>
                <th className="px-4 py-2.5 font-medium">ประเภท</th>
                <th className="px-4 py-2.5 font-medium">Vendor</th>
                <th className="px-4 py-2.5 font-medium">หมายเหตุ</th>
                <th className="px-4 py-2.5 font-medium">หัวข้ออบรม</th>
                <th className="px-4 py-2.5 text-right font-medium">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {instructors.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    ยังไม่มีวิทยากร — เพิ่มจากปุ่มด้านบน
                  </td>
                </tr>
              )}
              {instructors.map(i => (
                <tr key={i.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{i.name}</td>
                  <td className="px-4 py-2.5"><SourceBadge type={i.source_type} /></td>
                  <td className="px-4 py-2.5">
                    <VendorCell vendor_id={i.vendor_id} vendor_name={i.vendor_name} is_registered={i.is_registered} />
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs max-w-[180px] truncate">{i.notes || '—'}</td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => openTopics(i)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      <BookOpen size={12} />
                      {i.topic_count ?? 0} หัวข้อ
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEdit(i)}
                        className="rounded p-1.5 text-slate-500 hover:bg-brand-50 hover:text-brand-600"
                        title="แก้ไข"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => remove(i.id, i.name)}
                        className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                        title="ลบ"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit / Add modal */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.isNew ? 'เพิ่มวิทยากรใหม่' : 'แก้ไขข้อมูลวิทยากร'}
        footer={<ModalFooter onCancel={() => setEditing(null)} onSave={save} saving={saving} />}
      >
        <div className="space-y-4">
          {editing?.isNew && (
            <Field label="ประเภท">
              <Select value={form.source_type} onChange={e => set('source_type', e.target.value)}>
                <option value="external">External — วิทยากรภายนอก</option>
                <option value="internal">Internal — พนักงาน</option>
              </Select>
            </Field>
          )}
          <Field label="ชื่อวิทยากร" required>
            <Input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="ชื่อ-นามสกุล / ชื่อบริษัท"
            />
          </Field>
          {form.source_type === 'external' && (
            <Field label="ผูก Vendor">
              <VendorPicker
                vendorId={form.vendor_id}
                vendorName={form.vendor_name}
                onChange={(id, name) => setForm(f => ({ ...f, vendor_id: id, vendor_name: name || '' }))}
              />
            </Field>
          )}
          <Field label="หมายเหตุ">
            <textarea
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 resize-none"
              rows={3}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="ข้อมูลเพิ่มเติม เช่น ความเชี่ยวชาญ, เบอร์ติดต่อ ฯลฯ"
            />
          </Field>
        </div>
      </Modal>

      {/* Topics modal */}
      <Modal
        open={!!topicsInst}
        onClose={() => setTopicsInst(null)}
        title={`หัวข้ออบรมของ ${topicsInst?.name || ''}`}
        wide
      >
        <div className="space-y-4">
          {topics.length === 0 ? (
            <p className="text-sm text-slate-400 py-2">ยังไม่มีหัวข้ออบรมที่ผูกไว้</p>
          ) : (
            <div className="space-y-2">
              {topics.map(t => (
                <div
                  key={t.code}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{t.name_th}</div>
                    <div className="text-xs text-slate-400">
                      {t.code}
                      {t.type && ` · ${t.type}`}
                      {(t.duration_hours > 0 || t.duration_minutes > 0) &&
                        ` · ${t.duration_hours}ชม. ${t.duration_minutes}น.`}
                    </div>
                  </div>
                  <button
                    onClick={() => removeTopic(t.code)}
                    className="shrink-0 text-slate-400 hover:text-red-600 transition-colors"
                    title="ลบออก"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 border-t border-slate-100 pt-4">
            <select
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              value={addingTopic}
              onChange={e => setAddingTopic(e.target.value)}
            >
              <option value="">— เลือกหัวข้ออบรมที่ต้องการเพิ่ม —</option>
              {availableTopics.map(t => (
                <option key={t.code} value={t.code}>
                  {t.name_th} ({t.code})
                </option>
              ))}
            </select>
            <Button size="sm" onClick={addTopic} disabled={!addingTopic}>
              <Plus size={14} /> เพิ่ม
            </Button>
          </div>

          {availableTopics.length === 0 && topics.length > 0 && (
            <p className="text-xs text-slate-400 text-center">ผูกหัวข้ออบรมครบทุกหัวข้อแล้ว</p>
          )}
        </div>
      </Modal>
    </>
  );
}

// ── Venues panel ──────────────────────────────────────────────────────────────

const VENUE_EMPTY = {
  source_type: 'external', name: '',
  vendor_id: null, vendor_name: '', notes: '',
};

function VenuesPanel() {
  const [venues, setVenues]   = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm]       = useState(VENUE_EMPTY);
  const [saving, setSaving]   = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function load() {
    setVenues(await api.get('/venues').catch(() => []));
  }

  useEffect(() => { load(); }, []);

  function openNew() { setForm(VENUE_EMPTY); setEditing({ isNew: true }); }

  function openEdit(v) {
    setForm({
      source_type: v.source_type,
      name:        v.name,
      vendor_id:   v.vendor_id   || null,
      vendor_name: v.vendor_name || '',
      notes:       v.notes       || '',
    });
    setEditing({ isNew: false, id: v.id });
  }

  async function save() {
    if (!form.name.trim()) return toast.error('กรุณากรอกชื่อสถานที่');
    setSaving(true);
    try {
      const payload = {
        name:      form.name.trim(),
        vendor_id: form.source_type === 'external' ? form.vendor_id : null,
        notes:     form.notes || null,
      };
      if (editing.isNew) await api.post('/venues', { ...payload, source_type: form.source_type });
      else               await api.patch(`/venues/${editing.id}`, payload);
      toast.success('บันทึกสำเร็จ');
      setEditing(null);
      load();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function remove(id, name) {
    if (!window.confirm(`ลบสถานที่ "${name}"?\nการกระทำนี้ไม่สามารถย้อนกลับได้`)) return;
    try {
      await api.del(`/venues/${id}`);
      toast.success('ลบแล้ว');
      load();
    } catch (e) { toast.error(e.message); }
  }

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="text-base font-semibold text-slate-800">สถานที่จัดอบรม</h3>
          <Button size="sm" onClick={openNew}><Plus size={14} /> เพิ่มสถานที่</Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">ชื่อสถานที่</th>
                <th className="px-4 py-2.5 font-medium">ประเภท</th>
                <th className="px-4 py-2.5 font-medium">Vendor</th>
                <th className="px-4 py-2.5 font-medium">หมายเหตุ</th>
                <th className="px-4 py-2.5 text-right font-medium">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {venues.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    ยังไม่มีสถานที่ — เพิ่มจากปุ่มด้านบน
                  </td>
                </tr>
              )}
              {venues.map(v => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{v.name}</td>
                  <td className="px-4 py-2.5"><SourceBadge type={v.source_type} /></td>
                  <td className="px-4 py-2.5">
                    <VendorCell vendor_id={v.vendor_id} vendor_name={v.vendor_name} is_registered={v.is_registered} />
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs max-w-[220px] truncate">{v.notes || '—'}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEdit(v)}
                        className="rounded p-1.5 text-slate-500 hover:bg-brand-50 hover:text-brand-600"
                        title="แก้ไข"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => remove(v.id, v.name)}
                        className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                        title="ลบ"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit / Add modal */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.isNew ? 'เพิ่มสถานที่ใหม่' : 'แก้ไขข้อมูลสถานที่'}
        footer={<ModalFooter onCancel={() => setEditing(null)} onSave={save} saving={saving} />}
      >
        <div className="space-y-4">
          {editing?.isNew && (
            <Field label="ประเภท">
              <Select value={form.source_type} onChange={e => set('source_type', e.target.value)}>
                <option value="external">External — สถานที่ภายนอก</option>
                <option value="internal">Internal — ห้องภายในองค์กร</option>
              </Select>
            </Field>
          )}
          <Field label="ชื่อสถานที่" required>
            <Input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="เช่น ห้องฝึกอบรม A / โรงแรม XYZ"
            />
          </Field>
          {form.source_type === 'external' && (
            <Field label="ผูก Vendor">
              <VendorPicker
                vendorId={form.vendor_id}
                vendorName={form.vendor_name}
                onChange={(id, name) => setForm(f => ({ ...f, vendor_id: id, vendor_name: name || '' }))}
              />
            </Field>
          )}
          <Field label="หมายเหตุ">
            <textarea
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 resize-none"
              rows={3}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="ข้อมูลเพิ่มเติม เช่น ที่อยู่, ความจุ, เบอร์ติดต่อ ฯลฯ"
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function InstructorVenueTab() {
  const [subTab, setSubTab] = useState('instructors');

  const SUB_TABS = [
    { key: 'instructors', label: 'วิทยากร' },
    { key: 'venues',      label: 'สถานที่จัดอบรม' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-slate-200">
        {SUB_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              subTab === t.key
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'instructors' && <InstructorsPanel />}
      {subTab === 'venues'      && <VenuesPanel />}
    </div>
  );
}
