import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../lib/api.js';
import FileUpload from '../components/FileUpload.jsx';
import { Field, Input, Select, Textarea, Button, Card, Badge } from '../components/ui.jsx';

// ประเมินผลของโครงการ — ผูกกับ training_projects โดยตรง (ไม่มี dropdown เลือกคำขอแล้ว)
export default function Evaluation({ project, onSaved }) {
  const [forms, setForms] = useState([]);
  const [formCode, setFormCode] = useState('');
  const [form, setForm] = useState(null); // loaded eval form (with items)
  const [evalId, setEvalId] = useState(null);
  const [evaluator, setEvaluator] = useState('');
  const [evalDate, setEvalDate] = useState(new Date().toISOString().slice(0, 10));
  const [responses, setResponses] = useState({}); // item_code -> { score, comment }
  const [attachments, setAttachments] = useState([]); // existing
  const [staged, setStaged] = useState([]); // new files
  const [result, setResult] = useState(null); // { total_score, status } after save
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/eval-forms').then(setForms).catch(() => {});
  }, []);

  // โหลดผลประเมินเดิมของโครงการนี้ (ถ้ามี) มาแก้ต่อ
  useEffect(() => {
    resetEval();
    api.get(`/evaluations?project_id=${project.id}`)
      .then((existing) => { if (existing.length) return loadEvaluation(existing[0].id); })
      .catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  function resetEval() {
    setFormCode('');
    setForm(null);
    setEvalId(null);
    setResponses({});
    setAttachments([]);
    setStaged([]);
    setResult(null);
  }

  async function loadForm(code, initialResponses) {
    setFormCode(code);
    if (!code) return setForm(null);
    const f = await api.get(`/eval-forms/${code}`);
    setForm(f);
    const next = {};
    f.items.forEach((it) => {
      next[it.item_code] = initialResponses?.[it.item_code] || { score: '', comment: '' };
    });
    setResponses(next);
  }

  async function loadEvaluation(id) {
    const ev = await api.get(`/evaluations/${id}`);
    setEvalId(ev.id);
    setEvaluator(ev.evaluator_name || '');
    setEvalDate(ev.eval_date || evalDate);
    setAttachments(ev.attachments || []);
    setResult({ total_score: ev.total_score, status: ev.status });
    const initial = {};
    (ev.responses || []).forEach((r) => (initial[r.item_code] = { score: r.score ?? '', comment: r.comment || '' }));
    await loadForm(ev.eval_form_code, initial);
  }

  const setResp = (code, k, v) => setResponses((r) => ({ ...r, [code]: { ...r[code], [k]: v } }));

  // live average preview (simple mean of entered scores)
  const entered = Object.values(responses).filter((r) => r.score !== '' && r.score != null);
  const liveAvg = entered.length ? entered.reduce((s, r) => s + Number(r.score), 0) / entered.length : 0;

  async function save() {
    if (!formCode) return toast.error('กรุณาเลือกแบบประเมิน');
    setSaving(true);
    try {
      const payload = {
        project_id: project.id,
        eval_form_code: formCode,
        evaluator_name: evaluator,
        eval_date: evalDate,
        responses: Object.entries(responses).map(([item_code, r]) => ({ item_code, score: r.score, comment: r.comment })),
      };
      const res = evalId ? await api.put(`/evaluations/${evalId}`, payload) : await api.post('/evaluations', payload);
      const id = res.id;
      setEvalId(id);
      setResult({ total_score: res.total_score, status: res.status });

      if (staged.length) {
        await api.post(`/evaluations/${id}/attachments`, { files: staged });
        setStaged([]);
        const reloaded = await api.get(`/evaluations/${id}`);
        setAttachments(reloaded.attachments || []);
      }
      toast.success('บันทึกผลประเมินสำเร็จ');
      onSaved?.();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeAttachment(att) {
    if (!confirm(`ลบไฟล์ ${att.filename} ?`)) return;
    try {
      await api.del(`/attachments/${att.id}`);
      setAttachments((a) => a.filter((x) => x.id !== att.id));
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-800">ประเมินผลการอบรม</h2>
        <p className="text-sm text-slate-500">บันทึกผลการประเมินและแนบเอกสาร</p>
      </div>

      <Card className="p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="แบบประเมิน (จากข้อมูลหลัก)">
            <Select value={formCode} onChange={(e) => loadForm(e.target.value)}>
              <option value="">— เลือกแบบประเมิน —</option>
              {forms.map((f) => (
                <option key={f.code} value={f.code}>
                  {f.code} · {f.name_th}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="ผู้ประเมิน">
            <Input value={evaluator} onChange={(e) => setEvaluator(e.target.value)} />
          </Field>
          <Field label="วันที่ประเมิน">
            <Input type="date" value={evalDate} onChange={(e) => setEvalDate(e.target.value)} />
          </Field>
        </div>
      </Card>

      {form && (
        <>
          <Card className="p-5">
            <h2 className="mb-4 font-semibold text-slate-800">หัวข้อการประเมิน</h2>
            <div className="space-y-3">
              {form.items.map((it) => {
                const r = responses[it.item_code] || { score: '', comment: '' };
                const numeric = it.scale_type === 'คะแนน';
                return (
                  <div key={it.item_code} className="rounded-lg border border-slate-200 p-3">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <span className="text-sm font-medium text-slate-700">{it.item_name_th || it.item_code}</span>
                      <span className="shrink-0 text-xs text-slate-400">น้ำหนัก {it.weight}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto,1fr]">
                      {numeric ? (
                        <Input
                          type="number"
                          className="w-28"
                          placeholder="คะแนน"
                          value={r.score}
                          onChange={(e) => setResp(it.item_code, 'score', e.target.value)}
                        />
                      ) : (
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button
                              key={n}
                              onClick={() => setResp(it.item_code, 'score', n)}
                              className={`h-9 w-9 rounded-md border text-sm font-medium ${
                                Number(r.score) === n
                                  ? 'border-brand-600 bg-brand-600 text-white'
                                  : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      )}
                      <Input placeholder="ความคิดเห็น (ถ้ามี)" value={r.comment} onChange={(e) => setResp(it.item_code, 'comment', e.target.value)} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 font-semibold text-slate-800">เอกสารแนบ</h2>
            <FileUpload existing={attachments} onRemoveExisting={removeAttachment} onFiles={setStaged} />
          </Card>

          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <div>
                  <div className="text-xs text-slate-500">คะแนนเฉลี่ย (ตัวอย่าง)</div>
                  <div className="text-2xl font-bold text-brand-700">{liveAvg.toFixed(2)} / 5</div>
                </div>
                {result && (
                  <div>
                    <div className="text-xs text-slate-500">ผลที่บันทึก</div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-slate-800">{result.total_score}</span>
                      <Badge color={result.status === 'pass' ? 'green' : 'red'}>
                        {result.status === 'pass' ? 'ผ่าน' : 'ไม่ผ่าน'}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button onClick={save} disabled={saving}>
                  {saving ? 'กำลังบันทึก...' : 'บันทึกผลประเมิน'}
                </Button>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
