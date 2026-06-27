import { Trash2 } from 'lucide-react';

export default function TopicRow({ topic, mode, onUpdate, onDelete }) {
  const isSeparate = mode === 'separate';

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-3 py-2">
        <span className="text-xs text-slate-400">{topic.sequence}</span>
      </td>
      <td className="px-3 py-2">
        <input
          className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm focus:border-slate-300 focus:bg-white focus:outline-none"
          value={topic.topic_name}
          onChange={(e) => onUpdate('topic_name', e.target.value)}
          placeholder="ชื่อหัวข้อ"
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <input
            type="number"
            min="0"
            className="h-8 w-20 rounded border border-slate-200 bg-white px-2 text-sm focus:border-brand-500 focus:outline-none"
            value={topic.duration_minutes}
            onChange={(e) => onUpdate('duration_minutes', Number(e.target.value))}
          />
          <span className="text-xs text-slate-400">น.</span>
        </div>
      </td>
      <td className="px-3 py-2">
        {isSeparate ? (
          <input
            type="date"
            className="h-8 w-full rounded border border-slate-200 bg-white px-2 text-sm focus:border-brand-500 focus:outline-none"
            value={topic.date}
            onChange={(e) => onUpdate('date', e.target.value)}
          />
        ) : (
          <span className="text-sm text-slate-700">{topic.date || <span className="text-slate-300">-</span>}</span>
        )}
      </td>
      <td className="px-3 py-2">
        {isSeparate ? (
          <input
            type="time"
            className="h-8 w-full rounded border border-slate-200 bg-white px-2 text-sm focus:border-brand-500 focus:outline-none"
            value={topic.start_time}
            onChange={(e) => onUpdate('start_time', e.target.value)}
          />
        ) : (
          <span className="text-sm text-slate-700">{topic.start_time || <span className="text-slate-300">-</span>}</span>
        )}
      </td>
      <td className="px-3 py-2">
        <span className={`text-sm ${topic.end_time ? 'text-slate-700' : 'text-slate-300'}`}>
          {topic.end_time || '-'}
        </span>
      </td>
      <td className="px-3 py-2 text-right">
        <button onClick={onDelete} className="text-slate-300 hover:text-red-500">
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
}
