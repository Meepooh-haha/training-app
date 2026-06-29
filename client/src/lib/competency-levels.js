export const LEVEL_OPTIONS = [
  { value: 1, label: 'Lv 1 — พื้นฐาน' },
  { value: 2, label: 'Lv 2 — ชำนาญ' },
  { value: 3, label: 'Lv 3 — เชี่ยวชาญ' },
];

export function levelLabel(n) {
  const opt = LEVEL_OPTIONS.find(o => o.value === Number(n));
  return opt ? opt.label : `Lv ${n}`;
}
