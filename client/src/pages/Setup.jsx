import { useState } from 'react';
import TopicsTab from './setup/TopicsTab.jsx';
import CoursesTab from './setup/CoursesTab.jsx';
import EvalItemsTab from './setup/EvalItemsTab.jsx';
import EvalFormsTab from './setup/EvalFormsTab.jsx';

const TABS = [
  { key: 'topics', label: 'หัวข้ออบรม', Comp: TopicsTab },
  { key: 'courses', label: 'หลักสูตร', Comp: CoursesTab },
  { key: 'items', label: 'หัวข้อประเมิน', Comp: EvalItemsTab },
  { key: 'forms', label: 'รูปแบบประเมิน', Comp: EvalFormsTab },
];

export default function Setup() {
  const [tab, setTab] = useState('topics');
  const Active = TABS.find((t) => t.key === tab).Comp;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">ข้อมูลหลัก</h1>
        <p className="text-sm text-slate-500">จัดการข้อมูลพื้นฐานสำหรับการฝึกอบรม</p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Active />
    </div>
  );
}
