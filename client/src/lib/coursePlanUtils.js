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

export function computeSchedule(topics, mode, settings) {
  if (!topics.length) return topics;
  const startTime = settings.daily_start_time || '09:00';
  const startDate = settings.start_date || '';

  if (mode === 'single') {
    let cur = startTime;
    return topics.map((t) => {
      const start = cur;
      const end = addMinutes(start, t.duration_minutes);
      cur = end;
      return { ...t, date: startDate, start_time: start, end_time: end };
    });
  }

  if (mode === 'consecutive') {
    const limitMins = (parseFloat(settings.hours_per_day) || 6) * 60;
    let curDate = startDate;
    let curTime = startTime;
    let usedMins = 0;
    return topics.map((t) => {
      const dur = Number(t.duration_minutes) || 0;
      // Move to next day if adding this topic would exceed the daily limit
      // (but never advance if we're still at the very start of the day)
      if (usedMins > 0 && usedMins + dur > limitMins) {
        curDate = addDays(curDate, 1);
        curTime = startTime;
        usedMins = 0;
      }
      const start = curTime;
      const end = addMinutes(start, dur);
      curTime = end;
      usedMins += dur;
      return { ...t, date: curDate, start_time: start, end_time: end };
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
