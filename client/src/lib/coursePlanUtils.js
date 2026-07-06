export const MODE_LABELS = {
  single: 'วันเดียว',
  consecutive: 'หลายวันติดกัน',
  separate: 'หลายวันแยกกัน',
};

export function addMinutes(timeStr, minutes) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + Math.round(Number(minutes) || 0);
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

export function addDays(dateStr, days) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function fmtDuration(mins) {
  if (!mins) return '-';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h} ชม.${m > 0 ? ` ${m} น.` : ''}` : `${m} น.`;
}

function toMin(timeStr) {
  if (!timeStr) return null;
  const [h, m] = String(timeStr).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

// ช่วงพักเที่ยงจาก settings — คืน null ถ้าปิด (ค่าว่าง/ไม่ถูกต้อง/เริ่ม >= จบ)
export function lunchWindow(settings) {
  const s = toMin(settings?.lunch_start);
  const e = toMin(settings?.lunch_end);
  if (s == null || e == null || s >= e) return null;
  return { start: s, end: e, label: `${settings.lunch_start} - ${settings.lunch_end}` };
}

// วางหัวข้อลง timeline โดยข้ามช่วงพักเที่ยง:
// เริ่มในช่วงพัก → เลื่อนไปเริ่มหลังพัก; คร่อมเวลาเริ่มพัก → เวลาจบบวกช่วงพักเข้าไป
function placeWithLunch(curMin, dur, lunch) {
  let start = curMin;
  if (lunch && start >= lunch.start && start < lunch.end) start = lunch.end;
  let end = start + dur;
  if (lunch && start < lunch.start && end > lunch.start) end += lunch.end - lunch.start;
  return { start, end };
}

const fmtMin = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export function computeSchedule(topics, mode, settings) {
  if (!topics.length) return topics;
  const startTime = settings.daily_start_time || '09:00';
  const startDate = settings.start_date || '';
  const lunch = lunchWindow(settings);

  if (mode === 'single') {
    let cur = toMin(startTime) ?? 540;
    return topics.map((t) => {
      const { start, end } = placeWithLunch(cur, Math.round(Number(t.duration_minutes) || 0), lunch);
      cur = end;
      return { ...t, date: startDate, start_time: fmtMin(start), end_time: fmtMin(end) };
    });
  }

  if (mode === 'consecutive') {
    const limitMins = (parseFloat(settings.hours_per_day) || 6) * 60;
    let curDate = startDate;
    let curTime = toMin(startTime) ?? 540;
    let usedMins = 0;
    return topics.map((t) => {
      const dur = Math.round(Number(t.duration_minutes) || 0);
      // Move to next day if adding this topic would exceed the daily limit
      // (but never advance if we're still at the very start of the day)
      if (usedMins > 0 && usedMins + dur > limitMins) {
        curDate = addDays(curDate, 1);
        curTime = toMin(startTime) ?? 540;
        usedMins = 0;
      }
      const { start, end } = placeWithLunch(curTime, dur, lunch);
      curTime = end;
      usedMins += dur;
      return { ...t, date: curDate, start_time: fmtMin(start), end_time: fmtMin(end) };
    });
  }

  if (mode === 'separate') {
    // Keep user-set dates; only auto-fill end_time from start_time + duration
    return topics.map((t) => ({
      ...t,
      end_time: t.start_time ? addMinutes(t.start_time, t.duration_minutes) : (t.end_time || ''),
    }));
  }

  return topics;
}

const dotTime = (t) => String(t || '').replace(':', '.');

// "09.00 – 16.00 น." จากแถวที่คำนวณเวลาแล้ว — ใช้ทั้งบนเอกสาร proposal และ footer กำหนดการ
export function timeRangeLabel(rows, settings) {
  const first = rows.find((r) => r.start_time);
  let lastEnd = '';
  for (const r of rows) if (r.end_time) lastEnd = r.end_time;
  const start = first?.start_time || settings?.daily_start_time || '';
  if (!start || !lastEnd) return '';
  return `${dotTime(start)} – ${dotTime(lastEnd)} น.`;
}

// payload สำหรับ POST export-proposal-docx / export-schedule-docx:
// จัดกลุ่มแถว (รวมแถวพักเที่ยง) เป็นรายวัน — เวลาคำนวณฝั่ง client เท่านั้น
// รับ scheduleData ทั้งจาก GET /schedule (seeded) และ state ของหน้า SchedulePage
export function buildDocExportPayload(scheduleData) {
  const settings = scheduleData;
  const topics = scheduleData.seeded
    ? computeSchedule(scheduleData.topics, settings.date_mode, settings)
    : scheduleData.topics;
  const rows = withBreakRows(topics, settings.date_mode === 'separate' ? {} : settings);
  const days = [];
  let cur = null;
  for (const r of rows) {
    const date = r.date || '';
    if (!cur || cur.date !== date) {
      cur = { date, rows: [] };
      days.push(cur);
    }
    cur.rows.push({
      start_time: r.start_time || '',
      end_time: r.end_time || '',
      topic_name: r.topic_name || '',
      subtopics: r.subtopics || '',
      is_break: !!r.is_break,
    });
  }
  return { time_label: timeRangeLabel(topics, settings), days };
}

// แถวสำหรับแสดงผล (ตาราง UI + PDF): แทรกแถวพักเที่ยง { is_break: true } ระหว่าง
// หัวข้อที่จบก่อน/ตอนเริ่มพัก กับหัวข้อถัดไปที่เริ่มหลังพัก (ต่อวัน)
export function withBreakRows(topics, settings) {
  const lunch = lunchWindow(settings);
  if (!lunch) return topics;
  const breakRow = (date) => ({
    is_break: true,
    topic_name: 'พักรับประทานอาหารกลางวัน',
    date: date || '',
    start_time: settings.lunch_start,
    end_time: settings.lunch_end,
    duration_minutes: lunch.end - lunch.start,
  });
  const out = [];
  for (let i = 0; i < topics.length; i++) {
    const t = topics[i];
    out.push(t);
    const next = topics[i + 1];
    if (!next || (next.date || '') !== (t.date || '')) continue;
    const endT = toMin(t.end_time);
    const startNext = toMin(next.start_time);
    if (endT != null && startNext != null && endT <= lunch.start && startNext >= lunch.end) {
      out.push(breakRow(t.date));
    }
  }
  return out;
}
