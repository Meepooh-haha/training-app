// Lightweight shadcn/ui-style primitives built on Tailwind.
// Kept in one file since each is tiny and they share a visual language.
import { clsx } from './clsx.js';

export function Button({ variant = 'primary', size = 'md', className, ...props }) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/40 disabled:opacity-50 disabled:pointer-events-none';
  const variants = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700',
    secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'text-slate-600 hover:bg-slate-100',
    subtle: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
  };
  const sizes = { sm: 'h-8 px-2.5 text-sm', md: 'h-9 px-3.5 text-sm', lg: 'h-10 px-4' };
  return <button className={clsx(base, variants[variant], sizes[size], className)} {...props} />;
}

export function Input({ className, invalid, ...props }) {
  return (
    <input
      className={clsx(
        'h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500',
        invalid && 'field-error',
        className
      )}
      {...props}
    />
  );
}

export function Textarea({ className, invalid, ...props }) {
  return (
    <textarea
      className={clsx(
        'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500',
        invalid && 'field-error',
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, invalid, children, ...props }) {
  return (
    <select
      className={clsx(
        'h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500',
        invalid && 'field-error',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({ className, required, children, ...props }) {
  return (
    <label className={clsx('mb-1 block text-sm font-medium text-slate-700', className)} {...props}>
      {children}
      {required && <span className="text-red-500"> *</span>}
    </label>
  );
}

export function Field({ label, required, children }) {
  return (
    <div>
      {label && <Label required={required}>{label}</Label>}
      {children}
    </div>
  );
}

export function Card({ className, children }) {
  return (
    <div className={clsx('rounded-xl border border-slate-200 bg-white shadow-sm', className)}>{children}</div>
  );
}

export function Badge({ color = 'slate', children }) {
  const colors = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-brand-100 text-brand-700',
    purple: 'bg-purple-100 text-purple-700',
  };
  return (
    <span className={clsx('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', colors[color])}>
      {children}
    </span>
  );
}

// Maps request status → label + badge colour (shared by multiple pages).
export const STATUS_META = {
  draft: { label: 'ร่าง', color: 'slate' },
  pending: { label: 'รออนุมัติ', color: 'amber' },
  approved: { label: 'อนุมัติแล้ว', color: 'green' },
  rejected: { label: 'ไม่อนุมัติ', color: 'red' },
};
