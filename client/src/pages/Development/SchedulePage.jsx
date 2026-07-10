import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Plus, Trash2, ArrowUp, ArrowDown, RefreshCw, CalendarClock, FileDown, ClipboardList } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import { MODE_LABELS, fmtDuration, computeSchedule, withBreakRows, buildDocExportPayload } from '../../lib/coursePlanUtils.js';
import { useProject } from './ProjectShell.jsx';

const inputCls = 'w-full rounded-lg border border-ink-200 px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-maroon-300';
const outlineInputCls = 'mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-maroon-300';

function hasObjectiveAssessmentMismatch(outline) {
  const objective = String(outline.objective || '');
  const evaluation = `${outline.success_quantitative || ''}\n${outline.success_qualitative || ''}`;
  const practiceGoal = /ปฏิบัติ|ฝึก|ทักษะ|ทำได้|workshop|ลงมือ/i.test(objective);
  const practiceAssessment = /ปฏิบัติ|สังเกต|ชิ้นงาน|สาธิต|workshop|performance/i.test(evaluation);
  return practiceGoal && !practiceAssessment;
}

function uniqueSortedDates(dates) {
  return [...new Set((dates || []).filter(Boolean))].sort();
}

// กำหนดการของโครงการ: seed หัวข้อ+ระยะเวลาจากหลักสูตรใน Setup,
// วันเริ่มจากวันอบรมที่สรุปใน Phase 1 แล้วคำนวณเวลารายหัวข้ออัตโนมัติ
export default function SchedulePage() {
  const { project, reload: reloadShell } = useProject();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingOutline, setSavingOutline] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [step, setStep] = useState('outline');
  const [settings, setSettings] = useState({ date_mode: 'single', daily_start_time: '09:00', hours_per_day: 6, lunch_start: '12:00', lunch_end: '13:00', start_date: '' });
  const [outline, setOutline] = useState({
    name: project.name || '',
    training_date: project.training_date || '',
    end_date: project.end_date || project.training_date || '',
    location: project.location || '',
    trainer_name: project.trainer_name || '',
    trainer_org: project.trainer_org || '',
    objective: project.objective || '',
    target_group: project.target_group || '',
    success_quantitative: project.success_quantitative || '',
    success_qualitative: project.success_qualitative || '',
  });
  const [separateDateDraft, setSeparateDateDraft] = useState('');
  const [separateDates, setSeparateDates] = useState([]);
  const [topics, setTopics] = useState([]);

  const recompute = useCallback((nextTopics, nextSettings) => {
    setTopics(computeSchedule(nextTopics, nextSettings.date_mode, nextSettings));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get(`/training-projects/${project.id}/schedule`);
      const s = {
        date_mode: data.date_mode,
        daily_start_time: data.daily_start_time,
        hours_per_day: data.hours_per_day,
        lunch_start: data.lunch_start ?? '12:00',
        lunch_end: data.lunch_end ?? '13:00',
        start_date: data.start_date || '',
      };
      setSettings(s);
      setSeeded(data.seeded);
      // seed ใหม่ยังไม่มีเวลา — คำนวณให้เห็นทันที; ของที่บันทึกแล้วแสดงตามที่เก็บ
      const nextTopics = data.seeded ? computeSchedule(data.topics, s.date_mode, s) : data.topics;
      setTopics(nextTopics);
      setSeparateDates(uniqueSortedDates(nextTopics.map((t) => t.date)));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setOutline({
      name: project.name || '',
      training_date: project.training_date || '',
      end_date: project.end_date || project.training_date || '',
      location: project.location || '',
      trainer_name: project.trainer_name || '',
      trainer_org: project.trainer_org || '',
      objective: project.objective || '',
      target_group: project.target_group || '',
      success_quantitative: project.success_quantitative || '',
      success_qualitative: project.success_qualitative || '',
    });
  }, [project]);

  function setSetting(k, v) {
    const next = { ...settings, [k]: v };
    setSettings(next);
    recompute(topics, next);
  }

  function setOutlineField(k, v) {
    setOutline((f) => ({ ...f, [k]: v }));
  }

  function addSeparateDate() {
    if (!separateDateDraft) return;
    setSeparateDates((dates) => uniqueSortedDates([...dates, separateDateDraft]));
    setSeparateDateDraft('');
  }

  function removeSeparateDate(date) {
    setSeparateDates((dates) => dates.filter((d) => d !== date));
  }

  function setTopic(i, k, v) {
    const next = topics.map((t, idx) => (idx === i ? { ...t, [k]: v } : t));
    // แก้ระยะเวลา/เวลาเริ่ม/วันที่ → คำนวณเวลาใหม่ทั้งชุด
    if (['duration_minutes', 'start_time', 'date'].includes(k)) recompute(next, settings);
    else setTopics(next);
  }

  function addTopic() {
    const date = settings.date_mode === 'separate' ? separateDates[0] || '' : '';
    recompute([...topics, { topic_code: null, topic_name: '', duration_minutes: 60, date, start_time: '', end_time: '', subtopics: '' }], settings);
  }

  function removeTopic(i) {
    recompute(topics.filter((_, idx) => idx !== i), settings);
  }

  function moveTopic(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= topics.length) return;
    const next = [...topics];
    [next[i], next[j]] = [next[j], next[i]];
    recompute(next, settings);
  }

  async function reseed() {
    if (topics.length && !window.confirm('ดึงหัวข้อจากหลักสูตรใหม่ จะแทนที่รายการปัจจุบันทั้งหมด?')) return;
    try {
      // ล้างของเดิมใน state แล้วให้ GET seed ใหม่จากหลักสูตร (ยังไม่บันทึกจนกว่าจะกดบันทึก)
      const data = await api.get(`/training-projects/${project.id}/schedule`);
      const source = data.seeded ? data.topics : null;
      if (source) {
        recompute(source, settings);
      } else {
        // มีของบันทึกไว้แล้ว — ต้อง seed เองจากหลักสูตร
        if (!project.course_code) { toast.error('โครงการนี้ไม่ได้ผูกหลักสูตร'); return; }
        const course = await api.get(`/courses/${project.course_code}`);
        const master = await api.get('/topics');
        const masterMap = Object.fromEntries(master.map((t) => [t.code, t]));
        const seededTopics = (course.topics || [])
          .sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
          .map((ct, i) => {
            const m = masterMap[ct.topic_code] || {};
            const dur = (Number(m.duration_hours) || 0) * 60 + (Number(m.duration_minutes) || 0);
            return {
              topic_code: ct.topic_code || null,
              topic_name: m.name_th || ct.topic_code || `หัวข้อ ${i + 1}`,
              duration_minutes: dur || Number(ct.duration) || 0,
              date: '', start_time: '', end_time: '',
            };
          });
        if (!seededTopics.length) { toast.error('หลักสูตรนี้ยังไม่มีหัวข้อใน Setup'); return; }
        recompute(seededTopics, settings);
      }
      toast.success('ดึงหัวข้อจากหลักสูตรแล้ว — อย่าลืมกดบันทึก');
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function save() {
    setSaving(true);
    try {
      await api.put(`/training-projects/${project.id}/schedule`, { ...settings, topics });
      toast.success('บันทึกกำหนดการแล้ว');
      setSeeded(false);
      await reloadShell();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  function validateOutline() {
    const missing = [];
    if (!outline.name.trim()) missing.push('ชื่อหลักสูตร/โครงการ');
    if (settings.date_mode !== 'separate' && !outline.training_date) {
      missing.push(settings.date_mode === 'consecutive' ? 'วันที่เริ่มต้น' : 'วันที่อบรม');
    }
    if (settings.date_mode === 'consecutive' && !outline.end_date) missing.push('วันที่สิ้นสุด');
    if (settings.date_mode === 'consecutive' && outline.training_date && outline.end_date && outline.end_date < outline.training_date) {
      missing.push('วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น');
    }
    if (settings.date_mode === 'separate' && separateDates.length === 0) missing.push('วันที่อบรมแยกกันอย่างน้อย 1 วัน');
    if (!outline.location.trim()) missing.push('สถานที่');
    if (!outline.objective.trim()) missing.push('วัตถุประสงค์');
    if (!outline.success_quantitative.trim() && !outline.success_qualitative.trim()) missing.push('วิธีการประเมินผล');
    return missing;
  }

  function applyOutlineDates(nextSettings) {
    if (nextSettings.date_mode === 'separate') {
      const dates = uniqueSortedDates(separateDates);
      const mapped = topics.map((t, i) => ({
        ...t,
        date: dates.includes(t.date) ? t.date : dates[Math.min(i, dates.length - 1)] || dates[0] || '',
        start_time: t.start_time || nextSettings.daily_start_time || '09:00',
      }));
      return computeSchedule(mapped, nextSettings.date_mode, nextSettings);
    }
    return computeSchedule(topics, nextSettings.date_mode, nextSettings);
  }

  async function saveOutlineAndContinue() {
    const missing = validateOutline();
    if (missing.length) {
      toast.error(`กรอก Step 1 ให้ครบก่อน: ${missing.join(', ')}`, { duration: 6000 });
      return;
    }
    setSavingOutline(true);
    try {
      const dates = uniqueSortedDates(settings.date_mode === 'separate' ? separateDates : [outline.training_date, outline.end_date]);
      const nextOutline = {
        ...outline,
        end_date: settings.date_mode === 'single'
          ? outline.training_date
          : settings.date_mode === 'separate'
            ? dates.at(-1) || outline.training_date
            : outline.end_date,
      };
      await api.patch(`/training-projects/${project.id}/details`, {
        ...nextOutline,
        training_date: settings.date_mode === 'separate' ? dates[0] || null : nextOutline.training_date || null,
        end_date: nextOutline.end_date || null,
      });
      const nextSettings = { ...settings, start_date: settings.date_mode === 'separate' ? dates[0] || '' : nextOutline.training_date };
      setOutline(nextOutline);
      setSettings(nextSettings);
      setTopics(applyOutlineDates(nextSettings));
      await reloadShell();
      setStep('schedule');
      toast.success('บันทึกโครงร่างแล้ว ไปกรอกกำหนดการต่อได้');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSavingOutline(false);
    }
  }

  async function saveAndExportProposal() {
    setExporting(true);
    try {
      await api.put(`/training-projects/${project.id}/schedule`, { ...settings, topics });
      setSeeded(false);
      await reloadShell();
      await api.download(
        `/training-projects/${project.id}/export-proposal-docx`,
        buildDocExportPayload({ ...settings, seeded: false, topics }),
        `Training-Proposal-${project.req_no || project.id}.docx`,
      );
      toast.success('บันทึกและสร้างเอกสารรวมแล้ว');
    } catch (e) {
      toast.error(e.message, { duration: 8000 });
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-ink-400" /></div>;
  }

  const totalMins = topics.reduce((s, t) => s + (Number(t.duration_minutes) || 0), 0);
  const isSeparate = settings.date_mode === 'separate';
  const outlineMismatch = hasObjectiveAssessmentMismatch(outline);

  return (
    <div className="space-y-5 font-body">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink-900 font-display flex items-center gap-2">
            <CalendarClock className="w-5 h-5" /> โครงร่างและกำหนดการอบรม
          </h2>
          <p className="text-sm text-ink-500 mt-0.5">
            Step 1 กรอกโครงร่างอบรมก่อน แล้ว Step 2 จึงใช้ข้อมูลนั้นสร้างกำหนดการและเอกสารรวมไฟล์เดียว
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={reseed}
            disabled={step !== 'schedule'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-ink-600 hover:bg-ink-100 border border-ink-200 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> ดึงหัวข้อจากหลักสูตร
          </button>
          <button
            onClick={() =>
              api.download(
                `/training-projects/${project.id}/export-schedule-docx`,
                buildDocExportPayload({ ...settings, seeded: false, topics }),
                `Schedule-${project.req_no || project.id}.docx`,
              ).catch((e) => toast.error(e.message, { duration: 8000 }))
            }
            disabled={!topics.length}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-ink-600 hover:bg-ink-100 border border-ink-200 transition-colors disabled:opacity-40"
            title="DOCX เฉพาะหน้ากำหนดการ format บริษัท (ไว้รวมไฟล์ส่งกรมพัฒนาฝีมือแรงงาน)"
          >
            <FileDown className="w-3.5 h-3.5" /> DOCX กำหนดการ
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-ink-200 bg-white p-2 flex flex-wrap gap-2">
        <button
          onClick={() => setStep('outline')}
          className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${step === 'outline' ? 'text-white' : 'text-ink-600 hover:bg-ink-50'}`}
          style={step === 'outline' ? { background: '#710F16' } : undefined}
        >
          <ClipboardList className="w-4 h-4" /> 1. โครงร่างอบรม
        </button>
        <button
          onClick={() => {
            const missing = validateOutline();
            if (missing.length) {
              toast.error(`กรอก Step 1 ให้ครบก่อน: ${missing.join(', ')}`, { duration: 6000 });
              return;
            }
            saveOutlineAndContinue();
          }}
          className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${step === 'schedule' ? 'text-white' : 'text-ink-600 hover:bg-ink-50'}`}
          style={step === 'schedule' ? { background: '#710F16' } : undefined}
        >
          <CalendarClock className="w-4 h-4" /> 2. กำหนดการอบรม
        </button>
      </div>

      {step === 'outline' && (
        <div className="rounded-2xl border border-ink-200 p-4 space-y-4" style={{ background: '#FAF7F6' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-sm sm:col-span-2">
              <span className="text-ink-700 font-medium">ชื่อหลักสูตร/โครงการ</span>
              <input className={outlineInputCls} value={outline.name} onChange={(e) => setOutlineField('name', e.target.value)} />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-ink-700 font-medium">วัตถุประสงค์</span>
              <textarea className={`${outlineInputCls} resize-none`} rows={3} value={outline.objective} onChange={(e) => setOutlineField('objective', e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="text-ink-700 font-medium">การวัดผลเชิงปริมาณ</span>
              <textarea className={`${outlineInputCls} resize-none`} rows={3} value={outline.success_quantitative} onChange={(e) => setOutlineField('success_quantitative', e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="text-ink-700 font-medium">การวัดผลเชิงคุณภาพ</span>
              <textarea className={`${outlineInputCls} resize-none`} rows={3} value={outline.success_qualitative} onChange={(e) => setOutlineField('success_qualitative', e.target.value)} />
            </label>
            {outlineMismatch && (
              <div className="sm:col-span-2 rounded-lg px-3 py-2 text-xs" style={{ background: '#FEF3C7', color: '#92400E' }}>
                วัตถุประสงค์เน้นทักษะปฏิบัติ แต่วิธีการประเมินผลยังไม่สะท้อนการปฏิบัติ ควรตรวจให้สอดคล้องกันก่อนสร้างเอกสาร
              </div>
            )}
            <label className="block text-sm">
              <span className="text-ink-700 font-medium">กลุ่มเป้าหมาย</span>
              <input className={outlineInputCls} value={outline.target_group} onChange={(e) => setOutlineField('target_group', e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="text-ink-700 font-medium">สถานที่</span>
              <input className={outlineInputCls} value={outline.location} onChange={(e) => setOutlineField('location', e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="text-ink-700 font-medium">วิทยากร</span>
              <input className={outlineInputCls} value={outline.trainer_name} onChange={(e) => setOutlineField('trainer_name', e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="text-ink-700 font-medium">สังกัด/บริษัทวิทยากร</span>
              <input className={outlineInputCls} value={outline.trainer_org} onChange={(e) => setOutlineField('trainer_org', e.target.value)} />
            </label>
          </div>

          <div className="border-t border-ink-100 pt-4 space-y-3">
            <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider">รูปแบบวันอบรม</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {Object.entries(MODE_LABELS).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSettings((s) => ({ ...s, date_mode: value }))}
                  className="rounded-xl border px-3 py-2 text-left text-sm transition-colors"
                  style={settings.date_mode === value
                    ? { background: '#FCEBEC', borderColor: '#710F16', color: '#710F16' }
                    : { borderColor: '#E4DEDC', color: '#78716E', background: '#fff' }}
                >
                  {value === 'single' ? 'จัดอบรมวันเดียว' : value === 'consecutive' ? 'จัดอบรมหลายวันติดกัน' : 'จัดอบรมหลายวันแยกกัน'}
                </button>
              ))}
            </div>

            {settings.date_mode === 'single' && (
              <label className="block text-sm max-w-xs">
                <span className="text-ink-700 font-medium">วันที่อบรม</span>
                <input type="date" className={outlineInputCls} value={outline.training_date} onChange={(e) => setOutlineField('training_date', e.target.value)} />
              </label>
            )}
            {settings.date_mode === 'consecutive' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
                <label className="block text-sm">
                  <span className="text-ink-700 font-medium">วันที่เริ่มต้น</span>
                  <input type="date" className={outlineInputCls} value={outline.training_date} onChange={(e) => setOutlineField('training_date', e.target.value)} />
                </label>
                <label className="block text-sm">
                  <span className="text-ink-700 font-medium">วันที่สิ้นสุด</span>
                  <input type="date" className={outlineInputCls} value={outline.end_date} onChange={(e) => setOutlineField('end_date', e.target.value)} />
                </label>
              </div>
            )}
            {settings.date_mode === 'separate' && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-end gap-2">
                  <label className="block text-sm">
                    <span className="text-ink-700 font-medium">เพิ่มวันที่อบรม</span>
                    <input type="date" className={outlineInputCls} value={separateDateDraft} onChange={(e) => setSeparateDateDraft(e.target.value)} />
                  </label>
                  <button type="button" onClick={addSeparateDate} className="h-9 px-3 rounded-lg text-xs font-semibold text-white" style={{ background: '#710F16' }}>
                    เพิ่มวัน
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {separateDates.length === 0 && <span className="text-xs text-ink-400">ยังไม่ได้เพิ่มวันที่</span>}
                  {separateDates.map((date) => (
                    <button
                      key={date}
                      type="button"
                      onClick={() => removeSeparateDate(date)}
                      className="rounded-full border border-ink-200 bg-white px-3 py-1 text-xs text-ink-600 hover:bg-red-50 hover:text-red-600"
                      title="คลิกเพื่อลบวันที่นี้"
                    >
                      {date} ×
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={saveOutlineAndContinue}
              disabled={savingOutline}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ background: '#710F16' }}
            >
              {savingOutline ? 'กำลังบันทึก…' : 'บันทึกโครงร่าง แล้วไปกำหนดการ'}
            </button>
          </div>
        </div>
      )}

      {step === 'schedule' && (
        <>

      {seeded && topics.length > 0 && (
        <div className="rounded-lg px-4 py-2.5 text-xs" style={{ background: '#FEF3C7', color: '#92400E' }}>
          ตารางนี้ seed จากหลักสูตรอัตโนมัติ ยังไม่ถูกบันทึก — ปรับแต่งแล้วกด "บันทึกกำหนดการ"
        </div>
      )}

      {!settings.start_date && !isSeparate && (
        <div className="rounded-lg px-4 py-2.5 text-xs" style={{ background: '#FCEBEC', color: '#710F16' }}>
          โครงการนี้ยังไม่มีวันอบรม — สรุปวันจาก{' '}
          <Link to={`/development/workflow/${project.id}/availability`} className="underline underline-offset-2 font-semibold">
            ตารางวันว่าง
          </Link>{' '}
          หรือกรอกวันเริ่มด้านล่างชั่วคราว
        </div>
      )}

      {/* ตั้งค่ากำหนดการ — วันอบรมถูกกำหนดจาก Step 1 เท่านั้น */}
      <div className="rounded-2xl border border-ink-200 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3" style={{ background: '#FAF7F6' }}>
        <label className="block text-xs text-ink-500">
          รูปแบบการจัดวัน
          <select className={`mt-1 ${inputCls}`} value={settings.date_mode} disabled>
            {Object.entries(MODE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="block text-xs text-ink-500">
          วันเริ่มอบรม <span className="text-ink-400">(จาก Step 1)</span>
          <input
            type="date"
            className={`mt-1 ${inputCls}`}
            value={settings.start_date || ''}
            disabled
          />
        </label>
        <label className="block text-xs text-ink-500">
          เวลาเริ่มแต่ละวัน
          <input
            type="time"
            className={`mt-1 ${inputCls}`}
            value={settings.daily_start_time}
            onChange={(e) => setSetting('daily_start_time', e.target.value)}
            disabled={isSeparate}
          />
        </label>
        <label className="block text-xs text-ink-500">
          ชั่วโมงอบรม/วัน (หลายวันติดกัน)
          <input
            type="number" min="1" step="0.5"
            className={`mt-1 ${inputCls}`}
            value={settings.hours_per_day}
            onChange={(e) => setSetting('hours_per_day', e.target.value)}
            disabled={settings.date_mode !== 'consecutive'}
          />
        </label>
        <label className="block text-xs text-ink-500">
          พักเที่ยง เริ่ม <span className="text-ink-300">(ล้างค่า = ไม่พัก)</span>
          <input
            type="time"
            className={`mt-1 ${inputCls}`}
            value={settings.lunch_start || ''}
            onChange={(e) => setSetting('lunch_start', e.target.value)}
            disabled={isSeparate}
          />
        </label>
        <label className="block text-xs text-ink-500">
          พักเที่ยง จบ
          <input
            type="time"
            className={`mt-1 ${inputCls}`}
            value={settings.lunch_end || ''}
            onChange={(e) => setSetting('lunch_end', e.target.value)}
            disabled={isSeparate}
          />
        </label>
      </div>

      {/* ตารางหัวข้อ */}
      <div className="rounded-2xl border border-ink-200 bg-white overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="text-left text-ink-400 text-xs" style={{ background: '#FAF7F6' }}>
            <tr>
              <th className="px-3 py-2.5 font-medium w-10">#</th>
              <th className="px-3 py-2.5 font-medium">หัวข้อ</th>
              <th className="px-3 py-2.5 font-medium w-28">ระยะเวลา (นาที)</th>
              <th className="px-3 py-2.5 font-medium w-36">วันที่</th>
              <th className="px-3 py-2.5 font-medium w-24">เริ่ม</th>
              <th className="px-3 py-2.5 font-medium w-24">จบ</th>
              <th className="w-24" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-50">
            {topics.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-ink-400 text-sm">
                  ยังไม่มีหัวข้อ — กด "ดึงหัวข้อจากหลักสูตร" หรือเพิ่มเอง
                </td>
              </tr>
            )}
            {(() => {
              let ti = -1;
              // แถวพักเที่ยงเป็น display-only — index ของหัวข้อจริงเดินแยกด้วย ti
              return withBreakRows(topics, isSeparate ? {} : settings).map((row, ri) => {
                if (row.is_break) {
                  return (
                    <tr key={`break-${ri}`} style={{ background: '#FAF7F6' }}>
                      <td className="px-3 py-2" />
                      <td className="px-3 py-2 text-ink-400 text-xs italic" colSpan={2}>{row.topic_name}</td>
                      <td className="px-3 py-2 text-ink-400 text-xs">{row.date || '—'}</td>
                      <td className="px-3 py-2 text-ink-400 text-xs">{row.start_time}</td>
                      <td className="px-3 py-2 text-ink-400 text-xs">{row.end_time}</td>
                      <td />
                    </tr>
                  );
                }
                ti += 1;
                const i = ti;
                const t = row;
                return (
              <tr key={i}>
                <td className="px-3 py-2 text-ink-400 text-xs">{i + 1}</td>
                <td className="px-3 py-2">
                  <input className={inputCls} value={t.topic_name || ''} onChange={(e) => setTopic(i, 'topic_name', e.target.value)} placeholder="ชื่อหัวข้อ" />
                  <textarea
                    className={`mt-1 ${inputCls} resize-y min-h-[34px] text-xs`}
                    rows={Math.min(4, Math.max(1, String(t.subtopics || '').split('\n').length))}
                    value={t.subtopics || ''}
                    onChange={(e) => setTopic(i, 'subtopics', e.target.value)}
                    placeholder="หัวข้อย่อย (1 บรรทัด = 1 ข้อ — ขึ้นเป็น bullet ใน PDF)"
                  />
                  {t.topic_code && <span className="block mt-0.5 font-mono text-[10px] text-ink-300">{t.topic_code}</span>}
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number" min="0" step="5"
                    className={inputCls}
                    value={t.duration_minutes ?? ''}
                    onChange={(e) => setTopic(i, 'duration_minutes', Number(e.target.value))}
                  />
                  <span className="block mt-0.5 text-[10px] text-ink-300">{fmtDuration(Number(t.duration_minutes) || 0)}</span>
                </td>
                <td className="px-3 py-2">
                  <span className="text-ink-600 text-xs">{t.date || '—'}</span>
                </td>
                <td className="px-3 py-2">
                  {isSeparate ? (
                    <input type="time" className={inputCls} value={t.start_time || ''} onChange={(e) => setTopic(i, 'start_time', e.target.value)} />
                  ) : (
                    <span className="text-ink-600 text-xs">{t.start_time || '—'}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-ink-600 text-xs">{t.end_time || '—'}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => moveTopic(i, -1)} disabled={i === 0} className="text-ink-300 hover:text-ink-700 disabled:opacity-30"><ArrowUp size={14} /></button>
                    <button onClick={() => moveTopic(i, +1)} disabled={i === topics.length - 1} className="text-ink-300 hover:text-ink-700 disabled:opacity-30"><ArrowDown size={14} /></button>
                    <button onClick={() => removeTopic(i)} className="text-ink-300 hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
                );
              });
            })()}
          </tbody>
          {topics.length > 0 && (
            <tfoot>
              <tr className="border-t border-ink-100 text-xs text-ink-500" style={{ background: '#FAF7F6' }}>
                <td className="px-3 py-2" colSpan={2}>รวม {topics.length} หัวข้อ</td>
                <td className="px-3 py-2 font-semibold">{fmtDuration(totalMins)}</td>
                <td className="px-3 py-2" colSpan={4} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <button
        onClick={addTopic}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-ink-500 hover:bg-ink-100 border border-dashed border-ink-300 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> เพิ่มหัวข้อเอง
      </button>

      <div className="flex flex-wrap justify-end gap-2 rounded-2xl border border-ink-200 bg-white p-4">
        <button
          onClick={() => setStep('outline')}
          className="px-4 py-2 rounded-lg text-sm text-ink-600 hover:bg-ink-100 border border-ink-200 transition-colors"
        >
          กลับไปแก้โครงร่าง
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded-lg text-sm text-ink-600 hover:bg-ink-100 border border-ink-200 transition-colors disabled:opacity-60"
        >
          {saving ? 'กำลังบันทึก…' : 'บันทึกอย่างเดียว'}
        </button>
        <button
          onClick={saveAndExportProposal}
          disabled={exporting || !topics.length}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ background: '#710F16' }}
        >
          <FileDown className="w-4 h-4" /> {exporting ? 'กำลังสร้าง…' : 'บันทึกและสร้างเอกสารรวม'}
        </button>
      </div>
        </>
      )}
    </div>
  );
}
