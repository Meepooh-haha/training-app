import { Trash2 } from 'lucide-react';
import { Card } from '../components/ui.jsx';

export function Header({ title, subtitle }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
      <p className="text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}

export function Section({ title, action, children }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-slate-800">{title}</h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

export function InlineTable({ head, rows, render, empty }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px] text-sm">
        <thead className="bg-slate-50 text-left text-slate-500">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="px-2 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 && (
            <tr>
              <td colSpan={head.length} className="px-2 py-6 text-center text-slate-400">
                {empty}
              </td>
            </tr>
          )}
          {rows.map((r, i) => (
            <tr key={i}>{render(r, i)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const Cell = ({ children }) => <td className="px-2 py-1.5">{children}</td>;

export const DelCell = ({ onClick }) => (
  <td className="px-2 py-1.5 text-right">
    <button onClick={onClick} className="text-slate-400 hover:text-red-600">
      <Trash2 size={15} />
    </button>
  </td>
);
