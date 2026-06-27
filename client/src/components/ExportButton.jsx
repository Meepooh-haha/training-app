import { useState, useRef, useEffect } from 'react';
import { Download, ChevronDown } from 'lucide-react';
import { Button } from './ui.jsx';

// Dropdown of export actions: actions = [{ label, onClick }]
export default function ExportButton({ actions, label = 'พิมพ์เอกสาร', disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <Button variant="secondary" onClick={() => setOpen((o) => !o)} disabled={disabled}>
        <Download size={15} /> {label} <ChevronDown size={14} />
      </Button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={() => {
                setOpen(false);
                a.onClick();
              }}
              className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-brand-50 hover:text-brand-700"
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
