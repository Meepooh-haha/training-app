import { computeSchedule } from './coursePlanUtils.js';

export const TRAINING_DATE_MODE_MAP = {
  single_day: 'single',
  continuous_days: 'consecutive',
  separate_days: 'separate',
  unknown: 'separate',
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const OUTLINE_FIELDS = [
  ['name', 'ชื่อหลักสูตร/โครงการ'],
  ['objective', 'วัตถุประสงค์'],
  ['target_group', 'กลุ่มเป้าหมาย'],
  ['location', 'สถานที่'],
  ['success_quantitative', 'การวัดผลเชิงปริมาณ'],
  ['success_qualitative', 'การวัดผลเชิงคุณภาพ'],
  ['trainer_name', 'วิทยากรหลัก'],
  ['trainer_org', 'หน่วยงานวิทยากร'],
  ['training_date', 'วันเริ่มอบรม'],
  ['end_date', 'วันสิ้นสุดอบรม'],
];

export function parseProposalJson(text) {
  if (!String(text || '').trim()) {
    return { ok: false, error: 'กรุณาวาง JSON ก่อนตรวจสอบ' };
  }
  try {
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { ok: false, error: 'JSON ต้องเป็น object ของ proposal' };
    }
    if (!data.outline && !Array.isArray(data.trainingDays)) {
      return { ok: false, error: 'ไม่พบข้อมูล proposal' };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'อ่าน JSON ไม่ได้ กรุณาตรวจรูปแบบข้อมูล' };
  }
}

export function mapProposalToNode(data, { project = {} } = {}) {
  const warnings = uniqueText([...(asArray(data?.warnings).map(toText))]);
  const missingFields = uniqueText([...(asArray(data?.missingFields).map(toText))]);

  const outlineSource = isObject(data?.outline) ? data.outline : {};
  if (!data?.outline) missingFields.push('outline');
  if (!Array.isArray(data?.trainingDays)) missingFields.push('trainingDays');

  const speakerNames = collectSpeakers(data, outlineSource);
  const derivedTrainer = deriveTrainer(outlineSource.trainerName, speakerNames, warnings);
  const dateInfo = normalizeDates(data, warnings);

  const outline = buildOutline(outlineSource, dateInfo, derivedTrainer, warnings);
  const scheduleSettings = isObject(data?.scheduleSettings) ? data.scheduleSettings : null;
  const settings = {
    date_mode: dateInfo.dateMode,
    daily_start_time: normalizeTime(scheduleSettings?.dailyStartTime, project.schedule_start_time || '09:00', warnings, 'dailyStartTime'),
    hours_per_day: Number(scheduleSettings?.hoursPerDay ?? project.schedule_hours_per_day ?? 6) || 6,
    lunch_start: normalizeTime(scheduleSettings?.lunchStart, project.schedule_lunch_start ?? '12:00', warnings, 'lunchStart', true),
    lunch_end: normalizeTime(scheduleSettings?.lunchEnd, project.schedule_lunch_end ?? '13:00', warnings, 'lunchEnd', true),
    start_date: dateInfo.trainingDate || '',
  };

  const rawTopics = mapSessions(data, dateInfo.dateMode, warnings, missingFields);
  const topics = computeSchedule(rawTopics, dateInfo.dateMode, settings);
  const days = groupPreviewDays(topics);
  const outlineRows = OUTLINE_FIELDS
    .filter(([key]) => key in outline)
    .map(([key, label]) => ({
      key,
      label,
      value: outline[key] ?? '',
      willClear: key !== 'name' && String(outline[key] ?? '').trim() === '',
    }));

  return {
    outline,
    settings,
    separateDates: dateInfo.separateDates,
    topics,
    preview: {
      outlineRows,
      dateMode: dateInfo.dateMode,
      trainingDateMode: dateInfo.trainingDateMode,
      dates: dateInfo.dates,
      days,
      participantCount: outlineSource.participantCount ?? null,
    },
    speakers: speakerNames.map((name) => ({ name, foundInMasterData: false })),
    warnings: uniqueText(warnings),
    missingFields: uniqueText(missingFields),
  };
}

function buildOutline(src, dateInfo, trainerName, warnings) {
  const outline = {
    objective: joinText(src.objectives),
    target_group: toText(src.targetAudience),
    location: toText(src.venue),
    success_quantitative: toText(src.successQuantitative),
    success_qualitative: toText(src.successQualitative),
    trainer_name: trainerName,
    trainer_org: toText(src.trainerOrg),
    training_date: dateInfo.trainingDate || null,
    end_date: dateInfo.endDate || null,
  };

  const name = toText(src.courseName);
  if (name) outline.name = name;

  if (!outline.success_qualitative && toText(src.evaluationMethod)) {
    outline.success_qualitative = toText(src.evaluationMethod);
    warnings.push('แปลงวิธีประเมินผลเป็นเชิงคุณภาพ ตรวจการแยกปริมาณ/คุณภาพ');
  }

  return outline;
}

function normalizeDates(data, warnings) {
  const trainingDateMode = TRAINING_DATE_MODE_MAP[data?.trainingDateMode]
    ? data.trainingDateMode
    : 'unknown';
  const dateMode = TRAINING_DATE_MODE_MAP[trainingDateMode];
  const dates = uniqueSortedDates([
    ...datesFromTrainingDays(data?.trainingDays, warnings),
    ...datesFromInput(data?.trainingDateInput, trainingDateMode, warnings),
  ]);

  if (trainingDateMode === 'unknown' && dates.length === 0) {
    warnings.push('ต้องเลือกวันอบรมใน Step 1 ก่อนสร้างเอกสาร');
  }

  if (trainingDateMode === 'single_day') {
    return {
      trainingDateMode,
      dateMode,
      dates: dates.slice(0, 1),
      separateDates: [],
      trainingDate: dates[0] || null,
      endDate: dates[0] || null,
    };
  }

  if (trainingDateMode === 'continuous_days') {
    return {
      trainingDateMode,
      dateMode,
      dates,
      separateDates: [],
      trainingDate: dates[0] || null,
      endDate: dates.at(-1) || null,
    };
  }

  return {
    trainingDateMode,
    dateMode,
    dates,
    separateDates: dates,
    trainingDate: dates[0] || null,
    endDate: dates.at(-1) || null,
  };
}

function mapSessions(data, dateMode, warnings, missingFields) {
  const days = Array.isArray(data?.trainingDays) ? data.trainingDays : [];
  const topics = [];
  for (const [dayIndex, day] of days.entries()) {
    const rawDate = toText(day?.date);
    if (rawDate && !isDate(rawDate)) {
      warnings.push(`รูปแบบวันที่ไม่ถูกต้อง: ${rawDate}`);
      continue;
    }
    const sessions = Array.isArray(day?.sessions) ? day.sessions : [];
    for (const [sessionIndex, session] of sessions.entries()) {
      const rowLabel = `วันที่ ${rawDate || '-'} session ${sessionIndex + 1}`;
      const startTime = normalizeSessionTime(session?.startTime, warnings, rowLabel, 'startTime');
      const endTime = normalizeSessionTime(session?.endTime, warnings, rowLabel, 'endTime');
      const theory = numberOrZero(session?.theoryMinutes);
      const practice = numberOrZero(session?.practiceMinutes);
      const duration = resolveDuration(session, startTime, endTime, theory, practice, warnings, rowLabel);
      const subtopics = normalizeSubtopics(session);
      const topicName = toText(session?.topic);

      if (!topicName && subtopics) missingFields.push(`หัวข้อ (${rowLabel})`);
      if (theory + practice !== duration) {
        warnings.push(`ผลรวมนาทีทฤษฎี/ปฏิบัติไม่เท่าระยะเวลา (${rowLabel})`);
      }

      topics.push({
        topic_code: null,
        topic_name: topicName,
        sequence: topics.length + 1,
        date: dateMode === 'separate' ? rawDate : '',
        start_time: dateMode === 'separate' ? startTime : '',
        end_time: dateMode === 'separate' ? endTime : '',
        duration_minutes: duration,
        subtopics,
        theory_minutes: theory,
        practice_minutes: practice,
        source_day_index: dayIndex,
      });
    }
  }
  return topics;
}

function resolveDuration(session, startTime, endTime, theory, practice, warnings, label) {
  const explicit = numberOrNull(session?.durationMinutes);
  if (explicit != null) return explicit;

  const fromTimes = minutesBetween(startTime, endTime);
  if (fromTimes != null) return fromTimes;
  if (startTime && endTime) warnings.push(`เวลาเริ่ม/จบไม่ถูกต้อง: ${label}`);

  if (theory + practice > 0) return theory + practice;
  warnings.push(`หัวข้อไม่มีระยะเวลา: ${label}`);
  return 0;
}

function normalizeSubtopics(session) {
  const subtopics = session?.subtopics;
  if (Array.isArray(subtopics)) return subtopics.map(toText).filter(Boolean).join('\n');
  if (subtopics != null && toText(subtopics)) return toText(subtopics);
  return toText(session?.content);
}

function collectSpeakers(data, outline) {
  const names = [];
  if (toText(outline?.trainerName)) names.push(toText(outline.trainerName));
  for (const speaker of asArray(data?.speakers)) {
    if (typeof speaker === 'string') names.push(toText(speaker));
    else if (isObject(speaker)) names.push(toText(speaker.name));
  }
  for (const day of asArray(data?.trainingDays)) {
    for (const session of asArray(day?.sessions)) {
      names.push(toText(session?.speakerName));
      if (typeof session?.speaker === 'string') names.push(toText(session.speaker));
      else if (isObject(session?.speaker)) names.push(toText(session.speaker.name));
    }
  }
  return uniqueText(names.filter(Boolean));
}

function deriveTrainer(outlineTrainerName, speakerNames, warnings) {
  const trainerName = toText(outlineTrainerName);
  if (trainerName) return trainerName;
  if (speakerNames.length === 1) return speakerNames[0];
  if (speakerNames.length > 1) {
    warnings.push('มีวิทยากรหลายคนในกำหนดการ ตรวจชื่อวิทยากรหลักในโครงร่าง');
    return speakerNames[0];
  }
  return '';
}

function datesFromTrainingDays(trainingDays, warnings) {
  return asArray(trainingDays)
    .map((d) => toText(d?.date))
    .filter((date) => {
      if (!date) return false;
      if (isDate(date)) return true;
      warnings.push(`รูปแบบวันที่ไม่ถูกต้อง: ${date}`);
      return false;
    });
}

function datesFromInput(input, mode, warnings) {
  if (!isObject(input)) return [];
  const candidates = mode === 'single_day'
    ? [input.singleDate]
    : mode === 'continuous_days'
      ? [input.startDate, input.endDate]
      : asArray(input.separateDates);
  return candidates.map(toText).filter((date) => {
    if (!date) return false;
    if (isDate(date)) return true;
    warnings.push(`รูปแบบวันที่ไม่ถูกต้อง: ${date}`);
    return false;
  });
}

function groupPreviewDays(topics) {
  const groups = [];
  for (const t of topics) {
    const date = t.date || '';
    let group = groups.find((g) => g.date === date);
    if (!group) {
      group = { date, rows: [] };
      groups.push(group);
    }
    group.rows.push({
      start_time: t.start_time || '',
      end_time: t.end_time || '',
      topic_name: t.topic_name || '',
      subtopics: t.subtopics || '',
      duration_minutes: Number(t.duration_minutes) || 0,
      theory_minutes: Number(t.theory_minutes) || 0,
      practice_minutes: Number(t.practice_minutes) || 0,
      minutesMismatch: (Number(t.theory_minutes) || 0) + (Number(t.practice_minutes) || 0) !== (Number(t.duration_minutes) || 0),
    });
  }
  return groups;
}

function normalizeSessionTime(value, warnings, label, field) {
  const text = toText(value);
  if (!text) return '';
  if (isTime(text)) return text;
  warnings.push(`รูปแบบเวลาไม่ถูกต้อง (${field}): ${label}`);
  return '';
}

function normalizeTime(value, fallback, warnings, field, allowBlank = false) {
  if (value == null) return fallback;
  const text = toText(value);
  if (allowBlank && !text) return '';
  if (isTime(text)) return text;
  warnings.push(`รูปแบบเวลาไม่ถูกต้อง (${field})`);
  return fallback;
}

function minutesBetween(start, end) {
  if (!isTime(start) || !isTime(end)) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const diff = eh * 60 + em - (sh * 60 + sm);
  return diff >= 0 ? diff : null;
}

function uniqueSortedDates(dates) {
  return uniqueText(dates.filter(isDate)).sort();
}

function uniqueText(values) {
  return [...new Set(values.map(toText).filter(Boolean))];
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isDate(value) {
  return DATE_RE.test(String(value || ''));
}

function isTime(value) {
  return TIME_RE.test(String(value || ''));
}

function toText(value) {
  return String(value ?? '').trim();
}

function joinText(value) {
  return Array.isArray(value) ? value.map(toText).filter(Boolean).join('\n') : toText(value);
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

function numberOrZero(value) {
  return numberOrNull(value) ?? 0;
}
