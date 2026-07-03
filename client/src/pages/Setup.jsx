import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import TopicsTab from './setup/TopicsTab.jsx';
import CoursesTab from './setup/CoursesTab.jsx';
import EvalItemsTab from './setup/EvalItemsTab.jsx';
import EvalFormsTab from './setup/EvalFormsTab.jsx';
import DepartmentsTab from './setup/DepartmentsTab.jsx';
import PositionsTab from './setup/PositionsTab.jsx';
import EmployeesTab from './setup/EmployeesTab.jsx';
import CompetencyTab from './setup/CompetencyTab.jsx';
import CompetencyMatrixTab from './setup/CompetencyMatrixTab.jsx';
import CompetencyCompareTab from './setup/CompetencyCompareTab.jsx';
import VendorsTab from './setup/VendorsTab.jsx';
import InstructorVenueTab from './setup/InstructorVenueTab.jsx';

const TABS = [
  { key: 'topics', label: 'หัวข้ออบรม', Comp: TopicsTab },
  { key: 'courses', label: 'หลักสูตร', Comp: CoursesTab },
  { key: 'items', label: 'หัวข้อประเมิน', Comp: EvalItemsTab },
  { key: 'forms', label: 'รูปแบบประเมิน', Comp: EvalFormsTab },
  { key: 'departments', label: 'ฝ่าย/แผนก', Comp: DepartmentsTab },
  { key: 'positions', label: 'ตำแหน่งงาน', Comp: PositionsTab },
  { key: 'employees', label: 'ข้อมูลพนักงาน', Comp: EmployeesTab },
  { key: 'competency', label: 'Competency Dictionary', Comp: CompetencyTab },
  { key: 'matrix', label: 'ตารางสมรรถนะ', Comp: CompetencyMatrixTab },
  { key: 'compare', label: 'เปรียบเทียบตำแหน่ง', Comp: CompetencyCompareTab },
  { key: 'vendors', label: 'Vendor', Comp: VendorsTab },
  { key: 'instructor-venue', label: 'วิทยากร / สถานที่', Comp: InstructorVenueTab },
];

export default function Setup() {
  const [searchParams] = useSearchParams();
  const initialTab = TABS.find(t => t.key === searchParams.get('tab'))?.key ?? 'topics';
  const [tab, setTab] = useState(initialTab);

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && TABS.find(x => x.key === t)) setTab(t);
  }, [searchParams]);

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
