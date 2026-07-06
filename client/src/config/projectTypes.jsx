// การจัดประเภทโครงการอบรม — ใช้ร่วมกันทั้ง badge, ฟอร์มสร้าง/แก้ไข และตัวกรอง

export const COMPETENCY_TYPES = {
  organizational: {
    label: 'Organizational',
    labelTh: 'ทุกคนเข้าได้',
    desc: 'สมรรถนะองค์กร — ทุกคนเข้าได้ เช่น ทักษะการสื่อสาร การทำงานร่วมกัน',
    bg: '#EFF6FF', color: '#1D4ED8',
  },
  functional: {
    label: 'Functional',
    labelTh: 'ตามสายงาน',
    desc: 'สมรรถนะตามสายงาน/แผนก เช่น ความรู้ HR ความรู้บัญชี',
    bg: '#F5F3FF', color: '#6D28D9',
  },
  leadership: {
    label: 'Leadership',
    labelTh: 'หัวหน้างานขึ้นไป',
    desc: 'สมรรถนะผู้นำ — หัวหน้างานขึ้นไป หรือผู้ที่กำลังจะขึ้นเป็นหัวหน้างาน',
    bg: '#FFF7ED', color: '#C2410C',
  },
};

export const DELIVERY_TYPES = {
  inhouse: {
    label: 'In-house',
    desc: 'จัดอบรมเอง — จัดหาวัน วิทยากร สถานที่ ลงทะเบียนครบวงจร',
    bg: '#FCEBEC', color: '#710F16',
  },
  public: {
    label: 'Public',
    desc: 'ส่งพนักงานไปเรียนหลักสูตรภายนอก — ทำเรื่องจ่ายเงินให้ไปเรียน แล้วค่อยประเมิน/บันทึกผลทีหลัง',
    bg: '#F0FDFA', color: '#0F766E',
  },
};

export function CompetencyBadge({ type, className = '' }) {
  const cfg = COMPETENCY_TYPES[type];
  if (!cfg) return null;
  return (
    <span
      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${className}`}
      style={{ background: cfg.bg, color: cfg.color }}
      title={cfg.desc}
    >
      {cfg.label} · {cfg.labelTh}
    </span>
  );
}

export function DeliveryBadge({ type, className = '' }) {
  const cfg = DELIVERY_TYPES[type] ?? DELIVERY_TYPES.inhouse;
  return (
    <span
      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${className}`}
      style={{ background: cfg.bg, color: cfg.color }}
      title={cfg.desc}
    >
      {cfg.label}
    </span>
  );
}
