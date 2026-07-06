import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FileDown, RefreshCw } from 'lucide-react';
import { Field, Input, Select, Textarea, Button, Card } from '../components/ui.jsx';

const EMPTY_ITEM = { gl_code: '', item_code: '', description: '', qty: '', unit: '', unit_price: '' };

const PR_TYPES = [
  { value: '1', label: '1 — จัดซื้อ / Purchasing' },
  { value: '2', label: '2 — จัดจ้าง / Contracting' },
];

// pr_no is assigned by the server at export time (see server/routes/pr.js
// issuePrNumber) — never generated or edited client-side, so the locked
// running sequence can't be skipped or collided with by a typo.
const EMPTY = {
  pr_no: '',
  pr_type: '1',
  date: new Date().toISOString().slice(0, 10),
  department: '',
  required_date: '',
  requester: '',
  expense_type: '',
  items: Array.from({ length: 10 }, () => ({ ...EMPTY_ITEM })),
  wht: '',
  reason: '',
  sig1_name: '',
  sig1_title: '',
  sig2_name: '',
  sig2_title: '',
  sig3_name: '',
  sig3_title: 'Chief Executive Officer (CEO)',
};

const money = (n) =>
  Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// เติมตารางรายการจาก Invoice ที่ AI อ่าน/ผู้ใช้ยืนยันแล้ว (รวมทุกใบ, สูงสุด 10 แถวตามฟอร์ม)
// และตั้งวันที่ต้องการสินค้า = วันทำจ่ายที่เร็วที่สุด
function seedFromInvoices(invoices) {
  if (!invoices?.length) return {};
  const lines = invoices.flatMap((ex) => ex.line_items || []).slice(0, 10);
  if (!lines.length) return {};
  const items = Array.from({ length: 10 }, (_, i) => {
    const l = lines[i];
    return l
      ? { ...EMPTY_ITEM, description: l.description || '', qty: l.quantity ?? '', unit: l.unit || '', unit_price: l.unit_price ?? '' }
      : { ...EMPTY_ITEM };
  });
  const dueDates = invoices.map((ex) => ex.due_date).filter(Boolean).sort();
  return { items, ...(dueDates[0] ? { required_date: dueDates[0] } : {}) };
}

// `project` (optional): เมื่อออก PR จากใต้โครงการอบรม — เลขที่ PR จะถูกผูกกับ
// โครงการใน ledger และเหตุผลการขอถูก prefill จากชื่อโครงการ
// `invoices` (optional): extraction_data ของ Invoice ที่ยืนยันแล้ว → เติมตารางรายการให้
export default function PRForm({ project, invoices }) {
  const [form, setForm] = useState(() => ({
    ...EMPTY,
    reason: project ? `ค่าใช้จ่ายโครงการฝึกอบรม "${project.name}" (${project.req_no || ''})`.trim() : EMPTY.reason,
    ...seedFromInvoices(invoices),
  }));
  const [errors, setErrors] = useState({});
  const [exporting, setExporting] = useState(false);
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    fetch('/api/departments')
      .then((r) => r.json())
      .then((list) => {
        setDepartments(list);
        const hr = list.find((d) => d.code === 'HR');
        if (hr) setForm((f) => (f.department ? f : { ...f, department: hr.code }));
      })
      .catch(() => {});
  }, []);

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: false }));
  };

  const setItem = (i, k, v) =>
    setForm((f) => {
      const items = [...f.items];
      items[i] = { ...items[i], [k]: v };
      return { ...f, items };
    });

  const subtotal = form.items.reduce(
    (s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0),
    0
  );
  const vat = subtotal * 0.07;
  const wht = Number(form.wht) || 0;
  const total = subtotal + vat - wht;

  function validate() {
    const errs = {};
    if (!form.date) errs.date = true;
    if (!form.department) errs.department = true;
    if (!form.pr_type) errs.pr_type = true;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleExport() {
    if (!validate()) return toast.error('กรุณาเลือกฝ่าย ประเภท PR และกรอกวันที่ให้ครบ');
    setExporting(true);
    try {
      const { pr_no, ...payload } = form; // pr_no is always server-assigned
      if (project?.id) payload.project_id = project.id;
      const res = await fetch('/api/pr/export-xlsx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Server error ${res.status}`);
      }
      const issuedPrNo = res.headers.get('X-Pr-No') || 'draft';
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${issuedPrNo}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setForm((f) => ({ ...f, pr_no: issuedPrNo }));
      toast.success(`ออกเลขที่เอกสาร ${issuedPrNo} เรียบร้อย`);
    } catch (e) {
      console.error(e);
      toast.error(`เกิดข้อผิดพลาด: ${e.message}`);
    } finally {
      setExporting(false);
    }
  }

  const Req = ({ k }) =>
    errors[k] ? <span className="ml-1 text-xs text-red-500">*จำเป็น</span> : null;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">ออกใบ PR</h1>
          <p className="text-sm text-slate-500">ใบขอซื้อ / Purchase Requisition</p>
          {invoices?.length > 0 && (
            <p className="mt-1 text-xs text-emerald-700">
              ✓ เติมรายการจาก Invoice ที่ยืนยันแล้ว {invoices.length} ใบให้อัตโนมัติ — แก้ไขต่อได้อิสระ
            </p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={() => { setForm({ ...EMPTY, department: form.department }); setErrors({}); }}>
          <RefreshCw size={14} /> ล้างฟอร์ม
        </Button>
      </div>

      {/* ── General Info ── */}
      <Card className="p-5">
        <h2 className="mb-4 font-semibold text-slate-800">ข้อมูลทั่วไป</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="เลขที่เอกสาร / PR No.">
            <Input
              value={form.pr_no || 'จะออกเลขอัตโนมัติเมื่อกด Export'}
              disabled
              className="text-slate-400"
            />
          </Field>
          <Field label={<>วันที่สร้างเอกสาร / Date <Req k="date" /></>}>
            <Input type="date" value={form.date} invalid={errors.date} onChange={(e) => set('date', e.target.value)} />
          </Field>
          <Field label={<>ฝ่าย / Department <Req k="department" /></>}>
            <Select value={form.department} invalid={errors.department} onChange={(e) => set('department', e.target.value)}>
              <option value="">— เลือกฝ่าย —</option>
              {departments.map((d) => (
                <option key={d.code} value={d.code}>{d.code} — {d.name}</option>
              ))}
            </Select>
          </Field>
          <Field label={<>ประเภท PR / PR Type <Req k="pr_type" /></>}>
            <Select value={form.pr_type} invalid={errors.pr_type} onChange={(e) => set('pr_type', e.target.value)}>
              {PR_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="วันที่ต้องการสินค้า / Required Date">
            <Input type="date" value={form.required_date} onChange={(e) => set('required_date', e.target.value)} />
          </Field>
          <Field label="ผู้ขอซื้อ / Requester">
            <Input value={form.requester} onChange={(e) => set('requester', e.target.value)} />
          </Field>
          <Field label="ประเภทค่าใช้จ่าย / Expense Type">
            <Input value={form.expense_type} onChange={(e) => set('expense_type', e.target.value)} />
          </Field>
        </div>
      </Card>

      {/* ── Items Table ── */}
      <Card className="p-5">
        <h2 className="mb-4 font-semibold text-slate-800">รายการสินค้า / บริการ</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="bg-blue-900 text-white text-xs">
                <th className="px-2 py-2.5 text-center font-medium w-8">ลำดับ</th>
                <th className="px-2 py-2.5 text-left font-medium w-24">เลขที่บัญชี<br />(GL Code)</th>
                <th className="px-2 py-2.5 text-left font-medium w-24">รหัสสินค้า<br />(Item Code)</th>
                <th className="px-2 py-2.5 text-left font-medium">รายละเอียด / บริการ<br />(Description / Services)</th>
                <th className="px-2 py-2.5 text-center font-medium w-16">จำนวน<br />(Qty)</th>
                <th className="px-2 py-2.5 text-center font-medium w-16">หน่วย<br />(Unit)</th>
                <th className="px-2 py-2.5 text-right font-medium w-28">ราคา/หน่วย บาท<br />(Unit Price)</th>
                <th className="px-2 py-2.5 text-right font-medium w-28">จำนวนเงิน บาท<br />(Amount)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {form.items.map((it, i) => {
                const amount = (Number(it.qty) || 0) * (Number(it.unit_price) || 0);
                return (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                    <td className="px-2 py-1 text-center text-slate-400 text-xs">{i + 1}</td>
                    <td className="px-1 py-1">
                      <Input className="h-7 text-xs" value={it.gl_code}
                        onChange={(e) => setItem(i, 'gl_code', e.target.value)} />
                    </td>
                    <td className="px-1 py-1">
                      <Input className="h-7 text-xs" value={it.item_code}
                        onChange={(e) => setItem(i, 'item_code', e.target.value)} />
                    </td>
                    <td className="px-1 py-1">
                      <Input className="h-7 text-xs" value={it.description}
                        onChange={(e) => setItem(i, 'description', e.target.value)} />
                    </td>
                    <td className="px-1 py-1">
                      <Input className="h-7 text-xs text-center" type="number" min="0" value={it.qty}
                        onChange={(e) => setItem(i, 'qty', e.target.value)} />
                    </td>
                    <td className="px-1 py-1">
                      <Input className="h-7 text-xs text-center" value={it.unit}
                        onChange={(e) => setItem(i, 'unit', e.target.value)} />
                    </td>
                    <td className="px-1 py-1">
                      <Input className="h-7 text-xs text-right" type="number" min="0" step="0.01"
                        value={it.unit_price} onChange={(e) => setItem(i, 'unit_price', e.target.value)} />
                    </td>
                    <td className="px-2 py-1 text-right text-sm font-medium text-slate-700 whitespace-nowrap">
                      {amount > 0 ? money(amount) : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div className="mt-5 flex justify-end">
          <table className="w-80 text-sm border border-slate-200 rounded-lg overflow-hidden">
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-2 text-slate-500">จำนวนเงิน / TOTAL</td>
                <td className="px-4 py-2 text-right font-medium text-slate-800">{money(subtotal)} ฿</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-2 text-slate-500">ภาษีมูลค่าเพิ่ม 7% / VAT</td>
                <td className="px-4 py-2 text-right font-medium text-slate-800">{money(vat)} ฿</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-2 text-slate-500 align-middle">หักภาษี ณ ที่จ่าย 3%</td>
                <td className="px-2 py-1.5 text-right">
                  <Input
                    className="h-8 text-right text-sm"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.wht}
                    onChange={(e) => set('wht', e.target.value)}
                    placeholder="0.00"
                  />
                </td>
              </tr>
              <tr className="bg-blue-50">
                <td className="px-4 py-2.5 font-semibold text-slate-700">จำนวนเงินรวมทั้งหมด / TOTAL AMOUNT</td>
                <td className="px-4 py-2.5 text-right font-bold text-brand-700">{money(total)} ฿</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Reason ── */}
      <Card className="p-5">
        <h2 className="mb-1 font-semibold text-slate-800">เหตุผลการขอซื้อ / Reason for Request</h2>
        <p className="mb-3 text-xs text-slate-500">
          ระบุเดือนในการบันทึกบัญชี, วัตถุประสงค์ในการขอซื้อ
        </p>
        <Textarea
          rows={3}
          value={form.reason}
          onChange={(e) => set('reason', e.target.value)}
          placeholder="เช่น การจัดอบรมแบบ Public Training"
        />
      </Card>

      {/* ── Signatures ── */}
      <Card className="p-5">
        <h2 className="mb-4 font-semibold text-slate-800">ลายเซ็นต์ผู้เกี่ยวข้อง (ไม่บังคับ)</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {[
            { role: 'ผู้ขอซื้อ / Requested By', nk: 'sig1_name', tk: 'sig1_title' },
            { role: 'ผู้อนุมัติ / Approved By', nk: 'sig2_name', tk: 'sig2_title' },
            { role: 'ผู้อนุมัติ / Approved By (CEO)', nk: 'sig3_name', tk: 'sig3_title' },
          ].map((s) => (
            <div key={s.nk} className="space-y-2 rounded-lg border border-slate-100 p-4">
              <p className="text-xs font-semibold text-slate-600">{s.role}</p>
              <Field label="ชื่อ-นามสกุล">
                <Input value={form[s.nk]} onChange={(e) => set(s.nk, e.target.value)} placeholder="ระบุชื่อ..." />
              </Field>
              <Field label="ตำแหน่ง">
                <Input value={form[s.tk]} onChange={(e) => set(s.tk, e.target.value)} />
              </Field>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Export ── */}
      <Card className="p-5">
        <Button onClick={handleExport} disabled={exporting} size="lg">
          <FileDown size={18} />
          {exporting ? 'กำลังสร้างเอกสาร...' : 'ออกใบ PR (XLSX)'}
        </Button>
        {form.pr_no && (
          <p className="mt-3 text-sm text-slate-600">
            เลขที่เอกสารที่ออกล่าสุด: <span className="font-semibold text-slate-800">{form.pr_no}</span>
          </p>
        )}
      </Card>
    </div>
  );
}
