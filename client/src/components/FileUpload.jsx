import { useRef, useState } from 'react';
import { Upload, File as FileIcon, X } from 'lucide-react';

// Drag-and-drop multi-file picker. Reads files as base64 data URLs and reports
// them via onFiles([{ filename, data }]). Purely client-side staging.
export default function FileUpload({ onFiles, existing = [], onRemoveExisting }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [staged, setStaged] = useState([]);

  function readFiles(fileList) {
    const files = Array.from(fileList);
    Promise.all(
      files.map(
        (f) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ filename: f.name, data: reader.result });
            reader.readAsDataURL(f);
          })
      )
    ).then((results) => {
      const next = [...staged, ...results];
      setStaged(next);
      onFiles?.(next);
    });
  }

  function removeStaged(idx) {
    const next = staged.filter((_, i) => i !== idx);
    setStaged(next);
    onFiles?.(next);
  }

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          readFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-6 text-center text-sm transition-colors ${
          dragging ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
        }`}
      >
        <Upload size={22} className="text-slate-400" />
        <span className="text-slate-600">ลากไฟล์มาวาง หรือคลิกเพื่อเลือกไฟล์</span>
        <span className="text-xs text-slate-400">รองรับหลายไฟล์</span>
        <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => readFiles(e.target.files)} />
      </div>

      {(existing.length > 0 || staged.length > 0) && (
        <ul className="mt-3 space-y-1.5">
          {existing.map((f) => (
            <li key={`e-${f.id}`} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-1.5 text-sm">
              <span className="flex items-center gap-2 truncate text-slate-700">
                <FileIcon size={15} className="text-slate-400" /> {f.filename}
              </span>
              {onRemoveExisting && (
                <button onClick={() => onRemoveExisting(f)} className="text-slate-400 hover:text-red-600">
                  <X size={15} />
                </button>
              )}
            </li>
          ))}
          {staged.map((f, i) => (
            <li key={`s-${i}`} className="flex items-center justify-between rounded-md border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm">
              <span className="flex items-center gap-2 truncate text-slate-700">
                <FileIcon size={15} className="text-brand-500" /> {f.filename}{' '}
                <span className="text-xs text-brand-600">(ใหม่)</span>
              </span>
              <button onClick={() => removeStaged(i)} className="text-slate-400 hover:text-red-600">
                <X size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
