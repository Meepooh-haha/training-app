import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Database, CalendarRange, FileText, FileOutput, Receipt, ClipboardList, ClipboardCheck, Menu, BarChart3, Route, UserCheck } from 'lucide-react';

const NAV = [
  { to: '/', label: 'แดชบอร์ด', icon: LayoutDashboard, end: true },
  { to: '/setup', label: 'ข้อมูลหลัก', icon: Database },
  { to: '/course-plan', label: 'กำหนดหลักสูตร', icon: CalendarRange },
  { to: '/requests', label: 'ขออนุมัติอบรม', icon: FileText },
  { to: '/pr-form', label: 'ออกใบ PR', icon: Receipt },
  { to: '/memo-form', label: 'ออกใบ Memo', icon: FileOutput },
  { to: '/registration', label: 'ลงทะเบียน', icon: ClipboardList },
  { to: '/evaluation', label: 'ประเมินผล', icon: ClipboardCheck },
  { type: 'section', label: 'พัฒนาบุคลากร' },
  { to: '/development/competency-scores', label: 'ประเมินสมรรถนะ', icon: UserCheck },
  { to: '/development/gap-analysis', label: 'Gap Analysis', icon: BarChart3 },
  { to: '/development/roadmap', label: 'Training Roadmap', icon: Route },
];

export default function Layout() {
  const [open, setOpen] = useState(false);

  const NavItems = () => (
    <nav className="p-3">
      {NAV.map((item, i) => {
        if (item.type === 'section') {
          return (
            <div key={i} className="mt-3 mb-1 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-400 border-t border-slate-200 pt-3">
              {item.label}
            </div>
          );
        }
        const { to, label, icon: Icon, end } = item;
        return (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`
            }
          >
            <Icon size={18} /> {label}
          </NavLink>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen lg:flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white lg:block">
        <Brand />
        <NavItems />
      </aside>

      {/* Sidebar (mobile drawer) */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-white shadow-xl">
            <Brand />
            <NavItems />
          </aside>
        </div>
      )}

      <div className="flex-1">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <button onClick={() => setOpen(true)} className="rounded p-1.5 hover:bg-slate-100">
            <Menu size={20} />
          </button>
          <span className="font-semibold text-slate-800">ระบบจัดการการฝึกอบรม</span>
        </header>
        <main className="mx-auto max-w-7xl p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 font-bold text-white">L</div>
      <div className="leading-tight">
        <div className="text-sm font-semibold text-slate-800">LivPlus Training</div>
        <div className="text-xs text-slate-400">ระบบจัดการการฝึกอบรม</div>
      </div>
    </div>
  );
}
