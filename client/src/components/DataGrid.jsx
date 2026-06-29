import { useState, useMemo } from 'react';
import { Pencil, Trash2, Plus, FileSpreadsheet, Search, Upload } from 'lucide-react';
import { Button, Input, Card } from './ui.jsx';
import { exportToExcel } from '../lib/excel-generator.js';

/**
 * Generic data grid.
 * columns: [{ key, header, render?(row), className? }]
 * rows: object[]
 * onNew/onEdit/onDelete: callbacks (omit to hide the control)
 * excel: { filename, map(row) } to enable an Excel export button
 * searchKeys: string[] of fields to filter on
 */
export default function DataGrid({
  title,
  columns,
  rows,
  onNew,
  onEdit,
  onDelete,
  onRowClick,
  onImport,
  excel,
  searchKeys = [],
  newLabel = 'เพิ่มใหม่',
}) {
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    if (!q.trim() || !searchKeys.length) return rows;
    const lower = q.toLowerCase();
    return rows.filter((r) => searchKeys.some((k) => String(r[k] ?? '').toLowerCase().includes(lower)));
  }, [rows, q, searchKeys]);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {searchKeys.length > 0 && (
            <div className="relative">
              <Search size={15} className="absolute left-2.5 top-2.5 text-slate-400" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ค้นหา..."
                className="h-9 w-44 pl-8"
              />
            </div>
          )}
          {onImport && (
            <Button variant="secondary" size="sm" onClick={onImport}>
              <Upload size={15} /> นำเข้า
            </Button>
          )}
          {excel && (
            <Button variant="secondary" size="sm" onClick={() => exportToExcel(filtered.map(excel.map), excel.filename, title)}>
              <FileSpreadsheet size={15} /> Excel
            </Button>
          )}
          {onNew && (
            <Button size="sm" onClick={onNew}>
              <Plus size={15} /> {newLabel}
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`px-4 py-2.5 font-medium ${c.className || ''}`}>
                  {c.header}
                </th>
              ))}
              {(onEdit || onDelete) && <th className="px-4 py-2.5 text-right font-medium">จัดการ</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-8 text-center text-slate-400">
                  ไม่มีข้อมูล
                </td>
              </tr>
            )}
            {filtered.map((row, i) => (
              <tr
                key={row.id ?? row.code ?? i}
                className={`hover:bg-slate-50 ${onRowClick ? 'cursor-pointer' : ''}`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-2.5 ${c.className || ''}`}>
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
                {(onEdit || onDelete) && (
                  <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      {onEdit && (
                        <button onClick={() => onEdit(row)} className="rounded p-1.5 text-slate-500 hover:bg-brand-50 hover:text-brand-600" title="แก้ไข">
                          <Pencil size={15} />
                        </button>
                      )}
                      {onDelete && (
                        <button onClick={() => onDelete(row)} className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600" title="ลบ">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
