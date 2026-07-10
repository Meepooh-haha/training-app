import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TRAINING_DATE_MODE_MAP,
  mapProposalToNode,
  parseProposalJson,
} from './proposalImport.js';

const project = {
  schedule_start_time: '09:00',
  schedule_hours_per_day: 6,
  schedule_lunch_start: '',
  schedule_lunch_end: '',
};

function baseProposal(overrides = {}) {
  return {
    outline: {
      courseName: 'หลักสูตร A',
      objectives: ['เข้าใจงาน', 'ทำได้จริง'],
      targetAudience: 'ทีมขาย',
      venue: 'ห้องอบรม',
      successQuantitative: 'ผ่าน 80%',
      successQualitative: 'ทำ workshop ได้',
    },
    trainingDateMode: 'single_day',
    trainingDays: [
      {
        date: '2026-08-01',
        sessions: [
          {
            startTime: '09:00',
            endTime: '10:00',
            topic: 'บทนำ',
            content: 'ภาพรวม',
            speakerName: 'อาจารย์หนึ่ง',
          },
        ],
      },
    ],
    ...overrides,
  };
}

test('exports the locked trainingDateMode map', () => {
  assert.deepEqual(TRAINING_DATE_MODE_MAP, {
    single_day: 'single',
    continuous_days: 'consecutive',
    separate_days: 'separate',
    unknown: 'separate',
  });
});

test('parseProposalJson returns Thai errors for invalid input', () => {
  assert.equal(parseProposalJson('').ok, false);
  assert.equal(parseProposalJson('{bad').ok, false);
  assert.equal(parseProposalJson('[]').ok, false);
  assert.equal(parseProposalJson('{"warnings":[]}').error, 'ไม่พบข้อมูล proposal');
});

test('maps single_day outline, dates, content, and derived trainer', () => {
  const mapped = mapProposalToNode(baseProposal(), { project });
  assert.equal(mapped.settings.date_mode, 'single');
  assert.equal(mapped.outline.name, 'หลักสูตร A');
  assert.equal(mapped.outline.objective, 'เข้าใจงาน\nทำได้จริง');
  assert.equal(mapped.outline.training_date, '2026-08-01');
  assert.equal(mapped.outline.end_date, '2026-08-01');
  assert.equal(mapped.outline.trainer_name, 'อาจารย์หนึ่ง');
  assert.equal(mapped.topics[0].date, '2026-08-01');
  assert.equal(mapped.topics[0].subtopics, 'ภาพรวม');
});

test('maps continuous_days to consecutive with first and last date', () => {
  const mapped = mapProposalToNode(baseProposal({
    trainingDateMode: 'continuous_days',
    trainingDays: [
      { date: '2026-08-03', sessions: [] },
      { date: '2026-08-01', sessions: [] },
      { date: '2026-08-02', sessions: [] },
    ],
  }), { project });
  assert.equal(mapped.settings.date_mode, 'consecutive');
  assert.equal(mapped.outline.training_date, '2026-08-01');
  assert.equal(mapped.outline.end_date, '2026-08-03');
});

test('maps separate_days with sorted deduped dates', () => {
  const mapped = mapProposalToNode(baseProposal({
    trainingDateMode: 'separate_days',
    trainingDays: [
      { date: '2026-08-05', sessions: [] },
      { date: '2026-08-01', sessions: [] },
      { date: '2026-08-05', sessions: [] },
    ],
  }), { project });
  assert.equal(mapped.settings.date_mode, 'separate');
  assert.deepEqual(mapped.separateDates, ['2026-08-01', '2026-08-05']);
});

test('unknown with no dates is importable with a warning', () => {
  const mapped = mapProposalToNode(baseProposal({
    trainingDateMode: 'unknown',
    trainingDays: [{ sessions: [] }],
  }), { project });
  assert.equal(mapped.settings.date_mode, 'separate');
  assert.equal(mapped.outline.training_date, null);
  assert.match(mapped.warnings.join('\n'), /ต้องเลือกวันอบรมใน Step 1/);
});

test('subtopics array wins over content and theory practice are preserved', () => {
  const mapped = mapProposalToNode(baseProposal({
    trainingDays: [{
      date: '2026-08-01',
      sessions: [{
        startTime: '09:00',
        endTime: '09:30',
        durationMinutes: 45,
        theoryMinutes: 20,
        practiceMinutes: 10,
        topic: 'ฝึก',
        content: 'ไม่ใช้',
        subtopics: ['หนึ่ง', 'สอง'],
      }],
    }],
  }), { project });
  assert.equal(mapped.topics[0].subtopics, 'หนึ่ง\nสอง');
  assert.equal(mapped.topics[0].duration_minutes, 45);
  assert.equal(mapped.topics[0].theory_minutes, 20);
  assert.equal(mapped.topics[0].practice_minutes, 10);
  assert.match(mapped.warnings.join('\n'), /ผลรวมนาทีทฤษฎี\/ปฏิบัติไม่เท่าระยะเวลา/);
});

test('duration precedence falls back from time range to theory plus practice', () => {
  const mapped = mapProposalToNode(baseProposal({
    trainingDateMode: 'separate_days',
    trainingDays: [{
      date: '2026-08-01',
      sessions: [
        { startTime: '09:00', endTime: '10:15', topic: 'เวลา' },
        { theoryMinutes: 15, practiceMinutes: 20, topic: 'รวม' },
      ],
    }],
  }), { project });
  assert.equal(mapped.topics[0].duration_minutes, 75);
  assert.equal(mapped.topics[1].duration_minutes, 35);
});

test('multiple speakers pick the first and warn without adding master data', () => {
  const mapped = mapProposalToNode(baseProposal({
    outline: { courseName: 'หลักสูตร A' },
    speakers: [{ name: 'อาจารย์หนึ่ง' }, { name: 'อาจารย์สอง' }],
    trainingDays: [
      { date: '2026-08-01', sessions: [{ topic: 'x', durationMinutes: 30, speakerName: 'อาจารย์สอง' }] },
    ],
  }), { project });
  assert.equal(mapped.outline.trainer_name, 'อาจารย์หนึ่ง');
  assert.deepEqual(mapped.speakers.map((s) => s.name), ['อาจารย์หนึ่ง', 'อาจารย์สอง']);
  assert.match(mapped.warnings.join('\n'), /มีวิทยากรหลายคน/);
});
