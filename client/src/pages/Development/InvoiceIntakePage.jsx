import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Receipt, Sparkles, Upload, Loader2, Plus, Trash2, X,
  CheckCircle2, CircleAlert, PencilLine, FileText, ArrowRight,
} from 'lucide-react';
import { api } from '../../lib/api.js';
import { useProject } from './ProjectShell.jsx';

const money = (n) =>
  Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const EMPTY_ITEM = { description: '', quantity: '', unit: '', unit_price: '', amount: '' };
const EMPTY_EXTRACTION = {
  invoice_number: '', invoice_date: '', due_date: '',
  vendor_name: '', vendor_tax_id: '',
  line_items: [{ ...EMPTY_ITEM }],
  subtotal: '', vat_amount: '', total_amount: '',
  uncertain_fields: [],
};

// แปลงผลจาก AI (null ได้ทุกช่อง) ให้เป็นค่าที่ input ควบคุมได้
function toFormShape(ex) {
  return {
    ...EMPTY_EXTRACTION,
    ...ex,
    invoice_number: ex.invoice_number ?? '',
    invoice_date: ex.invoice_date ?? '',
    due_date: ex.due_date ?? '',
    vendor_name: ex.vendor_name ?? '',
    vendor_tax_id: ex.vendor_tax_id ?? '',
    subtotal: ex.subtotal ?? '',
    vat_amount: ex.vat_amount ?? '',
    total_amount: ex.total_amount ?? '',
    line_items: (ex.line_items?.length ? ex.line_items : [{ ...EMPTY_ITEM }]).map((it) => ({
      description: it.description ?? '',
      quantity: it.quantity ?? '',
      unit: it.unit ?? '',
      unit_price: it.unit_price ?? '',
      amount: it.amount ?? '',
    })),
    uncertain_fields: ex.uncertain_fields || [],
  };
}

// แปลงกลับเป็นตัวเลขก่อนส่งขึ้น server
function toPayload(form) {
  const num = (v) => (v === '' || v == null ? null : Number(v));
  return {
    invoice_number: form.invoice_number || null,
    invoice_date: form.invoice_date || null,
    due_date: form.due_date || null,
    vendor_name: form.vendor_name || null,
    vendor_tax_id: form.vendor_tax_id || null,
    line_items: form.line_items
      .filter((it) => String(it.description).trim())
      .map((it) => ({
        description: it.description,
        quantity: num(it.quantity) ?? 0,
        unit: it.unit || null,
        unit_price: num(it.unit_price) ?? 0,
        amount: num(it.amount) ?? 0,
      })),
    subtotal: num(form.subtotal),
    vat_amount: num(form.vat_amount),
    total_amount: num(form.total_amount),
    uncertain_fields: [],
  };
}

const FIELD_LABELS = {
  invoice_number: 'เลขที่ Invoice',
  invoice_date: 'วันที่ Invoice',
  due_date: 'วันที่ต้องทำจ่าย',
  vendor_name: 'ชื่อผู้ขาย',
  vendor_tax_id: 'เลขผู้เสียภาษี',
  subtotal: 'ยอดก่อน VAT',
  vat_amount: 'VAT',
  total_amount: 'ยอดรวม',
  subtotal_mismatch: 'ผลรวมรายการไม่ตรงกับยอดรวม',
};

const inputCls =
  'mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-maroon-300';
const cellCls =
  'h-8 w-full rounded border border-ink-200 px-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-maroon-300';

export default function InvoiceIntakePage() {
  const { project, projectId, reload: reloadShell } = useProject();
  const [aiReady, setAiReady] = useState(null); // null = ยังไม่รู้
  const [invoices, setInvoices] = useState([]);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  // draft: { id: string|null (null = กรอกเอง ยังไม่บันทึก), fileName, form }
  const [draft, setDraft] = useState(null);
  const fileRef = useRef(null);

  const loadList = useCallback(() => {
    api.get(`/invoices/extractions?project_id=${projectId}`).then(setInvoices).catch(() => {});
  }, [projectId]);

  useEffect(() => {
    api.get('/invoices/status').then((d) => setAiReady(!!d.ai_ready)).catch(() => setAiReady(false));
    loadList();
  }, [loadList]);

  // ── อัปโหลด + สกัดด้วย AI ─────────────────────────────────────────────────
  async function handleFile(file) {
    if (!file) return;
    setExtracting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('project_id', String(projectId));
      const res = await fetch('/api/invoices/extract', { method: 'POST', body: fd });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message || body?.error || `HTTP ${res.status}`);
      setDraft({ id: body.id, fileName: file.name, form: toFormShape(body.extraction) });
      loadList();
      toast.success('AI อ่าน Invoice เสร็จแล้ว — ตรวจสอบและแก้ไขก่อนกดยืนยัน');
    } catch (e) {
      toast.error(e.message, { duration: 8000 });
    } finally {
      setExtracting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  // ── บันทึก (ยืนยันผล AI หรือบันทึกที่กรอกเอง) ─────────────────────────────
  async function saveDraft() {
    if (!draft) return;
    setSaving(true);
    try {
      const extraction = toPayload(draft.form);
      if (draft.id) {
        await api.patch(`/invoices/extractions/${draft.id}/confirm`, { extraction });
      } else {
        await api.post('/invoices/extractions', {
          project_id: projectId,
          file_name: draft.fileName || 'กรอกเอง',
          extraction,
        });
      }
      toast.success('บันทึก Invoice แล้ว');
      setDraft(null);
      loadList();
      await reloadShell();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeInvoice(inv) {
    if (!window.confirm(`ลบ Invoice "${inv.extraction_data?.invoice_number || inv.file_name}" ?`)) return;
    try {
      await api.del(`/invoices/extractions/${inv.id}`);
      loadList();
      await reloadShell();
    } catch (e) {
      toast.error(e.message);
    }
  }

  const setF = (k, v) => setDraft((d) => ({ ...d, form: { ...d.form, [k]: v } }));
  const setItem = (i, k, v) =>
    setDraft((d) => {
      const items = [...d.form.line_items];
      items[i] = { ...items[i], [k]: v };
      // แก้จำนวนหรือราคา/หน่วย → คำนวณจำนวนเงินให้ (ยังแก้ทับเองได้)
      if (k === 'quantity' || k === 'unit_price') {
        const q = Number(items[i].quantity);
        const p = Number(items[i].unit_price);
        if (q > 0 && p > 0) items[i].amount = Math.round(q * p * 100) / 100;
      }
      return { ...d, form: { ...d.form, line_items: items } };
    });

  const uncertain = new Set(draft?.form.uncertain_fields || []);
  const warn = (k) => uncertain.has(k) ? { boxShadow: '0 0 0 2px #F59E0B inset' } : undefined;

  const confirmedCount = invoices.filter((v) => v.status === 'confirmed').length;

  return (
    <div className="space-y-5 font-body">
      <div>
        <h2 className="text-xl font-bold text-ink-900 font-display">รับ Invoice</h2>
        <p className="text-sm text-ink-500 mt-0.5">
          อัปโหลดใบแจ้งหนี้ให้ AI อ่าน แล้วนำข้อมูล (รายการ, เลขที่ Invoice, วันที่ต้องทำจ่าย) ไปเติมใบ PR และใบ Memo
        </p>
      </div>

      {aiReady === false && (
        <div className="flex items-start gap-2 rounded-xl border px-4 py-3 text-sm" style={{ background: '#FEF3C7', borderColor: '#FCD34D', color: '#92400E' }}>
          <CircleAlert className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            ยังไม่ได้ตั้งค่า AI (ใส่ <code className="font-mono text-xs">GEMINI_API_KEY</code> ในไฟล์ .env ของเซิร์ฟเวอร์แล้วรีสตาร์ต)
            — ระหว่างนี้ใช้ปุ่ม "กรอกข้อมูลเอง" ได้ตามปกติ
          </span>
        </div>
      )}

      {/* ── อัปโหลด ── */}
      {!draft && (
        <div className="rounded-2xl border border-dashed border-ink-300 p-8 text-center" style={{ background: '#FAF7F6' }}>
          <Receipt className="w-10 h-10 mx-auto mb-3 text-ink-300" />
          <p className="text-sm text-ink-600 mb-4">
            เลือกไฟล์ใบแจ้งหนี้ (PDF, JPG, PNG, WebP — ไม่เกิน 10MB)
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <div className="flex flex-wrap justify-center gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={extracting || aiReady === false}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: '#710F16' }}
            >
              {extracting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> AI กำลังอ่านเอกสาร…</>
                : <><Sparkles className="w-4 h-4" /> อัปโหลดให้ AI อ่าน</>}
            </button>
            <button
              onClick={() => setDraft({ id: null, fileName: '', form: { ...EMPTY_EXTRACTION, line_items: [{ ...EMPTY_ITEM }] } })}
              disabled={extracting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-ink-700 border border-ink-200 hover:bg-ink-100 transition-colors disabled:opacity-50"
            >
              <PencilLine className="w-4 h-4" /> กรอกข้อมูลเอง
            </button>
          </div>
        </div>
      )}

      {/* ── ฟอร์มตรวจ/แก้ไขก่อนยืนยัน ── */}
      {draft && (
        <div className="rounded-2xl border border-ink-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-ink-400" />
              <span className="text-sm font-semibold text-ink-800 font-display">
                {draft.id ? `ตรวจสอบผลที่ AI อ่านได้ — ${draft.fileName}` : 'กรอกข้อมูล Invoice เอง'}
              </span>
            </div>
            <button onClick={() => setDraft(null)} className="text-ink-400 hover:text-ink-700 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {uncertain.size > 0 && (
            <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: '#FEF3C7', color: '#92400E' }}>
              <CircleAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                AI ไม่มั่นใจช่อง: {[...uncertain].map((f) => FIELD_LABELS[f] || f).join(', ')} — กรุณาตรวจกับเอกสารจริงก่อนยืนยัน
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="block text-sm">
              <span className="text-ink-700 font-medium">เลขที่ Invoice</span>
              <input className={inputCls} style={warn('invoice_number')} value={draft.form.invoice_number}
                onChange={(e) => setF('invoice_number', e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="text-ink-700 font-medium">วันที่ Invoice</span>
              <input type="date" className={inputCls} style={warn('invoice_date')} value={draft.form.invoice_date}
                onChange={(e) => setF('invoice_date', e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="text-ink-700 font-medium">วันที่ต้องทำจ่าย (Due Date)</span>
              <input type="date" className={inputCls} style={warn('due_date')} value={draft.form.due_date}
                onChange={(e) => setF('due_date', e.target.value)} />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-ink-700 font-medium">ชื่อผู้ขาย / Vendor</span>
              <input className={inputCls} style={warn('vendor_name')} value={draft.form.vendor_name}
                onChange={(e) => setF('vendor_name', e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="text-ink-700 font-medium">เลขผู้เสียภาษี</span>
              <input className={inputCls} style={warn('vendor_tax_id')} value={draft.form.vendor_tax_id}
                onChange={(e) => setF('vendor_tax_id', e.target.value)} />
            </label>
          </div>

          {/* รายการสินค้า */}
          <div>
            <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2">รายการสินค้า / บริการ</p>
            <div className="overflow-x-auto rounded-xl border border-ink-100">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="text-left text-ink-400 text-xs" style={{ background: '#FAF7F6' }}>
                  <tr>
                    <th className="px-3 py-2 font-medium">รายละเอียด</th>
                    <th className="px-2 py-2 font-medium text-center w-20">จำนวน</th>
                    <th className="px-2 py-2 font-medium text-center w-20">หน่วย</th>
                    <th className="px-2 py-2 font-medium text-right w-28">ราคา/หน่วย</th>
                    <th className="px-2 py-2 font-medium text-right w-28">จำนวนเงิน</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-50">
                  {draft.form.line_items.map((it, i) => (
                    <tr key={i}>
                      <td className="px-2 py-1.5">
                        <input className={cellCls} value={it.description} onChange={(e) => setItem(i, 'description', e.target.value)} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input className={`${cellCls} text-center`} type="number" min="0" value={it.quantity}
                          onChange={(e) => setItem(i, 'quantity', e.target.value)} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input className={`${cellCls} text-center`} value={it.unit} onChange={(e) => setItem(i, 'unit', e.target.value)} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input className={`${cellCls} text-right`} type="number" min="0" step="0.01" value={it.unit_price}
                          onChange={(e) => setItem(i, 'unit_price', e.target.value)} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input className={`${cellCls} text-right`} type="number" min="0" step="0.01" value={it.amount}
                          onChange={(e) => setItem(i, 'amount', e.target.value)} />
                      </td>
                      <td className="px-1 text-center">
                        <button
                          onClick={() => setDraft((d) => ({
                            ...d,
                            form: { ...d.form, line_items: d.form.line_items.filter((_, j) => j !== i) },
                          }))}
                          disabled={draft.form.line_items.length <= 1}
                          className="p-1 text-ink-300 hover:text-red-500 disabled:opacity-30"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              onClick={() => setDraft((d) => ({ ...d, form: { ...d.form, line_items: [...d.form.line_items, { ...EMPTY_ITEM }] } }))}
              className="mt-2 flex items-center gap-1 text-xs text-ink-500 hover:text-ink-800 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> เพิ่มรายการ
            </button>
          </div>

          {/* ยอดเงิน */}
          <div className="grid grid-cols-3 gap-3 sm:max-w-md sm:ml-auto">
            {[['subtotal', 'ยอดก่อน VAT'], ['vat_amount', 'VAT'], ['total_amount', 'ยอดรวมทั้งสิ้น']].map(([k, label]) => (
              <label key={k} className="block text-sm">
                <span className="text-ink-700 font-medium">{label}</span>
                <input type="number" min="0" step="0.01" className={`${inputCls} text-right`} style={warn(k)}
                  value={draft.form[k]} onChange={(e) => setF(k, e.target.value)} />
              </label>
            ))}
          </div>

          <div className="flex justify-end gap-2 border-t border-ink-100 pt-3">
            <button onClick={() => setDraft(null)} className="px-4 py-2 rounded-lg text-sm text-ink-600 hover:bg-ink-100 transition-colors">
              ยกเลิก
            </button>
            <button
              onClick={saveDraft}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60"
              style={{ background: saving ? '#9B9491' : '#1E7A52' }}
            >
              <CheckCircle2 className="w-4 h-4" />
              {saving ? 'กำลังบันทึก…' : 'ยืนยันและบันทึก'}
            </button>
          </div>
        </div>
      )}

      {/* ── รายการ Invoice ของโครงการ ── */}
      <div className="rounded-2xl border border-ink-200 bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-ink-100" style={{ background: '#FAF7F6' }}>
          <span className="text-sm font-semibold text-ink-800 font-display">
            Invoice ของโครงการนี้ ({invoices.length})
          </span>
          {confirmedCount > 0 && (
            <div className="flex gap-2">
              <Link
                to={`/development/workflow/${project.id}/pr-issuance`}
                className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: '#710F16' }}
              >
                นำไปออกใบ PR <ArrowRight className="w-3 h-3" />
              </Link>
              <Link
                to={`/development/workflow/${project.id}/memo-issuance`}
                className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: '#710F16' }}
              >
                นำไปออกใบ Memo <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>
        {invoices.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink-400">ยังไม่มี Invoice — อัปโหลดหรือกรอกข้อมูลด้านบน</p>
        ) : (
          <div className="divide-y divide-ink-50">
            {invoices.map((inv) => {
              const ex = inv.extraction_data || {};
              const confirmed = inv.status === 'confirmed';
              return (
                <div key={inv.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
                    style={confirmed
                      ? { background: '#E3F4EC', color: '#1E7A52' }
                      : { background: '#FEF3C7', color: '#92400E' }}
                  >
                    {confirmed ? 'ยืนยันแล้ว' : 'รอตรวจสอบ'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink-800 truncate">
                      <span className="font-mono">{ex.invoice_number || '—'}</span>
                      {ex.vendor_name && <> · {ex.vendor_name}</>}
                    </p>
                    <p className="text-xs text-ink-400">
                      {inv.file_name}
                      {ex.due_date && <> · ทำจ่าย {ex.due_date}</>}
                      {ex.total_amount != null && <> · {money(ex.total_amount)} บาท</>}
                    </p>
                  </div>
                  <button
                    onClick={() => setDraft({ id: inv.id, fileName: inv.file_name, form: toFormShape(ex) })}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-ink-600 border border-ink-200 hover:bg-ink-50 transition-colors"
                  >
                    <PencilLine className="w-3 h-3" /> {confirmed ? 'แก้ไข' : 'ตรวจ/ยืนยัน'}
                  </button>
                  <button
                    onClick={() => removeInvoice(inv)}
                    className="p-1.5 rounded text-ink-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* AI ready hint */}
      {aiReady && !draft && (
        <p className="text-xs text-ink-400 flex items-center gap-1.5">
          <Upload className="w-3.5 h-3.5" />
          AI จะอ่านเลขที่ Invoice, ผู้ขาย, รายการสินค้า, ยอดเงิน และวันที่ต้องทำจ่ายให้อัตโนมัติ — ตรวจแก้ได้ก่อนกดยืนยันทุกครั้ง
        </p>
      )}
    </div>
  );
}
