// Thai locale utilities — no external dependency needed

const THAI_MONTHS = [
  'มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม',
];

/** Format a YYYY-MM-DD string to "D MMMM YYYY" in Thai (Buddhist Era) */
export function thaiDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

/** Format two dates as a range; collapse to single date when same */
export function thaiDateRange(start, end) {
  if (!start) return '-';
  if (!end || end === start) return thaiDate(start);
  // Same month+year → "4 - 5 กันยายน 2568"
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.getDate()} - ${e.getDate()} ${THAI_MONTHS[s.getMonth()]} ${s.getFullYear() + 543}`;
  }
  return `${thaiDate(start)} ถึง ${thaiDate(end)}`;
}

// ── Thai baht text ──────────────────────────────────────────────────────────

const DIGITS = ['ศูนย์','หนึ่ง','สอง','สาม','สี่','ห้า','หก','เจ็ด','แปด','เก้า'];
const PLACES = ['','สิบ','ร้อย','พัน','หมื่น','แสน'];

function groupText(n) {
  if (n === 0) return '';
  const s = String(n);
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const d = parseInt(s[i], 10);
    const place = s.length - 1 - i;
    if (d === 0) continue;
    if (place === 1 && d === 1) { out += 'สิบ'; continue; }
    if (place === 1 && d === 2) { out += 'ยี่สิบ'; continue; }
    if (place === 0 && d === 1 && s.length > 1) { out += 'เอ็ด'; continue; }
    out += DIGITS[d] + (place > 0 ? PLACES[place] : '');
  }
  return out;
}

/** Convert a numeric amount to Thai baht words (e.g. 74712.75 → "เจ็ดหมื่นสี่พัน...") */
export function bahtText(amount) {
  const n = Math.abs(Number(amount) || 0);
  const bahtInt = Math.floor(n);
  const satangInt = Math.round((n - bahtInt) * 100);

  const millions = Math.floor(bahtInt / 1000000);
  const rest = bahtInt % 1000000;
  let result = '';
  if (millions > 0) result += groupText(millions) + 'ล้าน';
  if (rest > 0) result += groupText(rest);
  if (bahtInt === 0) result = 'ศูนย์';

  result += 'บาท';
  result += satangInt === 0 ? 'ถ้วน' : groupText(satangInt) + 'สตางค์';
  return result;
}
