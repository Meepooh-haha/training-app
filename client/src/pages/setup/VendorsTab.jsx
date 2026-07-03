import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Search, Plus, FileText, Pencil, ExternalLink, FolderOpen } from 'lucide-react';
import { api } from '../../lib/api.js';
import Modal, { ModalFooter } from '../../components/Modal.jsx';
import { Button, Field, Input, Select, Badge } from '../../components/ui.jsx';

const DOC_TYPES = ['book_bank', 'pp20', 'company_cert', 'vendor_form'];

const DOC_LABELS = {
  book_bank:    'Book Bank',
  pp20:         'ภ.พ.20',
  company_cert: 'หนังสือรับรองบริษัท',
  vendor_form:  'Vendor Register Form',
};

const STATUS_META = {
  pending:  { label: 'รอส่ง',        color: 'slate' },
  received: { label: 'ได้รับแล้ว',   color: 'blue' },
  verified: { label: 'ตรวจสอบแล้ว', color: 'green' },
};

const TYPE_LABELS = { instructor: 'วิทยากร', venue: 'สถานที่', other: 'อื่นๆ' };

const EMPTY = {
  vendor_name: '', tax_id: '', vendor_type: 'instructor',
  contact_name: '', contact_phone: '', contact_email: '',
};

export default function VendorsTab() {
  const [vendors, setVendors]   = useState([]);
  const [search, setSearch]     = useState('');
  const [editing, setEditing]   = useState(null);   // null | { isNew, id? }
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);
  const [docModal, setDocModal] = useState(null);   // null | vendor object
  const [docs, setDocs]         = useState([]);
  const [driveUrl, setDriveUrl]     = useState('');   // folder URL input in doc modal
  const [savingDrive, setSavingDrive] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function closeDocModal() {
    setDocModal(null);
    setDriveUrl('');
  }

  async function load() {
    try {
      const url = search ? `/vendors?search=${encodeURIComponent(search)}` : '/vendors';
      setVendors(await api.get(url));
    } catch (e) { toast.error(e.message); }
  }

  useEffect(() => { load(); }, [search]);

  // ── Vendor CRUD ─────────────────────────────────────────────────────────────

  function openNew() { setForm(EMPTY); setEditing({ isNew: true }); }

  function openEdit(v) {
    setForm({
      vendor_name:   v.vendor_name,
      tax_id:        v.tax_id        || '',
      vendor_type:   v.vendor_type,
      contact_name:  v.contact_name  || '',
      contact_phone: v.contact_phone || '',
      contact_email: v.contact_email || '',
    });
    setEditing({ isNew: false, id: v.id });
  }

  async function save() {
    if (!form.vendor_name.trim()) return toast.error('กรุณากรอกชื่อ vendor');
    setSaving(true);
    try {
      if (editing.isNew) await api.post('/vendors', form);
      else               await api.patch(`/vendors/${editing.id}`, form);
      toast.success('บันทึกสำเร็จ');
      setEditing(null);
      load();
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  // ── Document checklist ───────────────────────────────────────────────────────

  async function openDocs(vendor) {
    setDocModal(vendor);
    setDriveUrl(vendor.drive_folder_url || '');
    setDocs(await api.get(`/vendors/${vendor.id}/documents`).catch(() => []));
  }

  async function saveDriveFolder() {
    const trimmed = driveUrl.trim();
    if (trimmed && !trimmed.startsWith('http')) return toast.error('URL ไม่ถูกต้อง');
    setSavingDrive(true);
    try {
      await api.patch(`/vendors/${docModal.id}`, { drive_folder_url: trimmed || null });
      setDocModal(v => ({ ...v, drive_folder_url: trimmed || null }));
      toast.success(trimmed ? 'บันทึกลิงก์โฟลเดอร์แล้ว' : 'ลบลิงก์โฟลเดอร์แล้ว');
      load();
    } catch (e) { toast.error(e.message); }
    finally { setSavingDrive(false); }
  }

  async function changeStatus(doc, status) {
    try {
      let result;
      if (!doc.id) {
        // ยังไม่มี row → POST สร้างใหม่ (status='received', ไม่มีไฟล์)
        result = await api.post(`/vendors/${docModal.id}/documents`, {
          doc_type: doc.doc_type, storage_type: 'base64',
        });
      } else {
        result = await api.patch(`/vendors/${docModal.id}/documents/${doc.id}`, { status });
      }
      toast.success('อัปเดต status สำเร็จ');
      setDocs(await api.get(`/vendors/${docModal.id}/documents`));
      setDocModal(v => ({ ...v, is_registered: result.is_registered, registered_date: result.registered_date }));
      load();
    } catch (e) { toast.error(e.message); }
  }

  const docsComplete = docs.filter(d => d.status === 'received' || d.status === 'verified').length;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Vendor list */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-800">จัดการ Vendor</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={15} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="ค้นหาชื่อ / เลขภาษี..."
                className="h-9 w-52 rounded-md border border-slate-300 bg-white pl-8 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <Button size="sm" onClick={openNew}>
              <Plus size={15} /> เพิ่ม Vendor
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">ชื่อ Vendor</th>
                <th className="px-4 py-2.5 font-medium">เลขผู้เสียภาษี</th>
                <th className="px-4 py-2.5 font-medium">ประเภท</th>
                <th className="px-4 py-2.5 font-medium">สถานะ</th>
                <th className="px-4 py-2.5 text-right font-medium">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vendors.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">ไม่มีข้อมูล</td>
                </tr>
              )}
              {vendors.map(v => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{v.vendor_name}</td>
                  <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">
                    {v.tax_id || <span className="text-slate-300 font-sans">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {TYPE_LABELS[v.vendor_type] || v.vendor_type}
                  </td>
                  <td className="px-4 py-2.5">
                    {v.is_registered
                      ? <span className="inline-flex items-center gap-1.5 text-green-700 text-xs font-medium">🟢 ขึ้นทะเบียนแล้ว</span>
                      : <span className="inline-flex items-center gap-1.5 text-amber-600 text-xs font-medium">🟡 รอเอกสาร {v.docs_complete ?? 0}/4</span>
                    }
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openDocs(v)}
                        className="rounded p-1.5 text-slate-500 hover:bg-brand-50 hover:text-brand-600"
                        title="จัดการเอกสาร"
                      >
                        <FileText size={15} />
                      </button>
                      <button
                        onClick={() => openEdit(v)}
                        className="rounded p-1.5 text-slate-500 hover:bg-brand-50 hover:text-brand-600"
                        title="แก้ไข"
                      >
                        <Pencil size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit vendor modal */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.isNew ? 'เพิ่ม Vendor ใหม่' : 'แก้ไขข้อมูล Vendor'}
        footer={<ModalFooter onCancel={() => setEditing(null)} onSave={save} saving={saving} />}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="ชื่อ Vendor" required className="sm:col-span-2">
            <Input
              value={form.vendor_name}
              onChange={e => set('vendor_name', e.target.value)}
              placeholder="ชื่อบริษัท / บุคคล"
            />
          </Field>
          <Field label="เลขผู้เสียภาษี">
            <Input
              value={form.tax_id}
              onChange={e => set('tax_id', e.target.value)}
              placeholder="13 หลัก (ถ้ามี)"
            />
          </Field>
          <Field label="ประเภท">
            <Select value={form.vendor_type} onChange={e => set('vendor_type', e.target.value)}>
              <option value="instructor">วิทยากร</option>
              <option value="venue">สถานที่</option>
              <option value="other">อื่นๆ</option>
            </Select>
          </Field>
          <Field label="ชื่อผู้ติดต่อ">
            <Input value={form.contact_name} onChange={e => set('contact_name', e.target.value)} />
          </Field>
          <Field label="เบอร์โทร">
            <Input value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} />
          </Field>
          <Field label="อีเมล" className="sm:col-span-2">
            <Input type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} />
          </Field>
        </div>
      </Modal>

      {/* Document checklist modal */}
      <Modal
        open={!!docModal}
        onClose={closeDocModal}
        title={`เอกสาร Vendor — ${docModal?.vendor_name || ''}`}
        wide
      >
        {/* Registration status banner */}
        <div className={`mb-4 flex items-center gap-3 rounded-lg border px-4 py-3 ${
          docModal?.is_registered
            ? 'border-green-200 bg-green-50'
            : 'border-amber-200 bg-amber-50'
        }`}>
          <span className="text-xl">{docModal?.is_registered ? '🟢' : '🟡'}</span>
          <div>
            <p className="text-sm font-semibold text-slate-800">
              {docModal?.is_registered ? 'ขึ้นทะเบียนแล้ว' : `รอเอกสาร (${docsComplete}/4)`}
            </p>
            {docModal?.registered_date && (
              <p className="text-xs text-slate-500">วันที่ขึ้นทะเบียน: {docModal.registered_date}</p>
            )}
          </div>
        </div>

        {/* Google Drive folder link — one link per vendor */}
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <FolderOpen size={15} className="shrink-0 text-slate-400" />
          <input
            type="url"
            value={driveUrl}
            onChange={e => setDriveUrl(e.target.value)}
            placeholder="วางลิงก์โฟลเดอร์ Google Drive ที่เก็บเอกสาร Vendor..."
            className="min-w-0 flex-1 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
          />
          {docModal?.drive_folder_url && (
            <a
              href={docModal.drive_folder_url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-100"
            >
              <ExternalLink size={11} /> เปิด
            </a>
          )}
          <button
            onClick={saveDriveFolder}
            disabled={savingDrive}
            className="shrink-0 rounded bg-slate-600 px-2.5 py-1 text-xs text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {savingDrive ? '...' : 'บันทึก'}
          </button>
        </div>

        {/* 4-doc checklist */}
        <div className="space-y-3">
          {DOC_TYPES.map(type => {
            const doc = docs.find(d => d.doc_type === type) || { doc_type: type, status: 'pending', id: null };
            const meta = STATUS_META[doc.status];

            return (
              <div key={type} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-800">{DOC_LABELS[type]}</span>
                    <Badge color={meta.color}>{meta.label}</Badge>
                    {doc.received_date && (
                      <span className="text-xs text-slate-400">รับเมื่อ {doc.received_date}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {doc.status === 'pending' && (
                      <button
                        onClick={() => changeStatus(doc, 'received')}
                        className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100"
                      >
                        ทำเครื่องหมายรับแล้ว
                      </button>
                    )}
                    {doc.id && doc.status === 'received' && (
                      <button
                        onClick={() => changeStatus(doc, 'verified')}
                        className="rounded border border-green-200 bg-green-50 px-2 py-1 text-xs text-green-700 hover:bg-green-100"
                      >
                        ตรวจสอบแล้ว ✓
                      </button>
                    )}
                    {doc.id && doc.status === 'verified' && (
                      <button
                        onClick={() => changeStatus(doc, 'pending')}
                        className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                      >
                        ยกเลิก
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Modal>
    </>
  );
}
