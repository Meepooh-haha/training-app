import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES = join(__dirname, '..', 'templates');

// Templates are derived from the company original (proposal_source.docx) by
// server/scripts/build-proposal-templates.mjs — re-run that script if the
// company ever sends a new original; never hand-edit the generated files.
const PROPOSAL_TEMPLATE = join(TEMPLATES, 'proposal_pack_template.docx');
const SCHEDULE_TEMPLATE = join(TEMPLATES, 'schedule_template.docx');

const THAI_WEEKDAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

function parseIso(iso) {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// '2026-07-14' -> 'วันอังคารที่ 14 กรกฎาคม 2569'
export function thaiDateFull(iso) {
  const d = parseIso(iso);
  if (!d) return '';
  return `วัน${THAI_WEEKDAYS[d.getDay()]}ที่ ${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

// '2026-07-14' -> '14 กรกฎาคม 2569' (footer style — no weekday, per the original doc)
function thaiDateShort(iso) {
  const d = parseIso(iso);
  if (!d) return '';
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

// '14 – 15 กรกฎาคม 2569' | '30 กรกฎาคม – 1 สิงหาคม 2569' | full both sides across years
export function thaiDateRange(startIso, endIso) {
  const s = parseIso(startIso);
  const e = parseIso(endIso);
  if (!s) return '';
  if (!e || e.getTime() === s.getTime()) return thaiDateShort(startIso);
  if (s.getFullYear() !== e.getFullYear()) return `${thaiDateShort(startIso)} – ${thaiDateShort(endIso)}`;
  if (s.getMonth() !== e.getMonth()) {
    return `${s.getDate()} ${THAI_MONTHS[s.getMonth()]} – ${e.getDate()} ${THAI_MONTHS[e.getMonth()]} ${e.getFullYear() + 543}`;
  }
  return `${s.getDate()} – ${e.getDate()} ${THAI_MONTHS[e.getMonth()]} ${e.getFullYear() + 543}`;
}

function dotTime(t) {
  return String(t || '').replace(':', '.');
}

function splitLines(text) {
  return String(text || '').split('\n').map((s) => s.trim()).filter(Boolean);
}

function money(n) {
  return Number(n).toLocaleString('en-US');
}

function budgetLabel(v) {
  return Number(v) > 0 ? `${money(v)} บาท` : '-';
}

// Assemble the docxtemplater data object. `project` is the DB row (joined with
// course name + participant_count); `payload` is what the client computed:
// { time_label, days: [{ date, rows: [{ start_time, end_time, topic_name, subtopics, is_break }] }] }
// Schedule time math stays client-side (coursePlanUtils.computeSchedule) — the
// server only formats, it never recomputes.
export function buildProposalDocData(project, payload = {}) {
  const timeLabel = String(payload.time_label || '').trim();
  const daysIn = Array.isArray(payload.days) ? payload.days : [];
  const multiDay = daysIn.length > 1;

  const days = daysIn.map((d) => ({
    show_date: multiDay,
    day_date_label: thaiDateFull(d.date) || 'ไม่ระบุวัน',
    rows: (Array.isArray(d.rows) ? d.rows : []).map((r) => ({
      time: r.start_time && r.end_time ? `${dotTime(r.start_time)} – ${dotTime(r.end_time)}` : '',
      topic_name: String(r.topic_name || ''),
      is_break: !!r.is_break,
      reg: !r.is_break,
      subtopics: splitLines(r.subtopics),
    })),
  }));
  if (!days.length) days.push({ show_date: false, day_date_label: '', rows: [] });
  for (const day of days) {
    if (!day.rows.length) {
      day.rows.push({ time: '', topic_name: 'ยังไม่มีหัวข้อในกำหนดการ', is_break: true, reg: false, subtopics: [] });
    }
  }

  const targets = splitLines(project.target_group);
  const objectives = splitLines(project.objective);
  const quantItems = splitLines(project.success_quantitative);
  const qualItems = splitLines(project.success_qualitative);

  const singleDate = !project.end_date || project.end_date === project.training_date;
  const dateLabel = singleDate
    ? thaiDateFull(project.training_date)
    : thaiDateRange(project.training_date, project.end_date);
  const footerDate = thaiDateRange(project.training_date, project.end_date);

  const trainer = String(project.trainer_name || '').trim();
  const trainerOrg = String(project.trainer_org || '').trim();

  return {
    course_name: project.name || project.course_name_th || project.course_code || '-',
    location: String(project.location || '').trim() || '-',
    date_label: dateLabel || '-',
    time_label: timeLabel || '-',
    participant_count: Number(project.participant_count) || 0,
    objectives: objectives.length ? objectives : ['-'],
    targets_first: targets.length ? `1. ${targets[0]}` : '-',
    targets_rest: targets.slice(1).map((t, i) => `${i + 2}.   ${t}`),
    quant_items: quantItems.length ? quantItems : ['-'],
    qual_items: qualItems.length ? qualItems : ['-'],
    budget_instructor: budgetLabel(project.budget_instructor),
    budget_venue: budgetLabel(project.budget_venue),
    budget_food: budgetLabel(project.budget_food),
    budget_material: budgetLabel(project.budget_material),
    budget_other: budgetLabel(project.budget_other),
    days,
    has_trainer: !!trainer,
    trainer_line: trainer ? `วิทยากร: ${trainer}${trainerOrg ? ` (${trainerOrg})` : ''}` : '',
    has_footer: !!footerDate,
    footer_line: footerDate ? `วันที่ ${footerDate}${timeLabel ? ` เวลา ${timeLabel}` : ''}` : '',
  };
}

function fill(templatePath, data) {
  const zip = new PizZip(readFileSync(templatePath));
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
  doc.render(data);
  return doc.getZip().generate({ type: 'nodebuffer' });
}

export function fillProposalPack(data) {
  return fill(PROPOSAL_TEMPLATE, data);
}

export function fillScheduleDoc(data) {
  return fill(SCHEDULE_TEMPLATE, data);
}
