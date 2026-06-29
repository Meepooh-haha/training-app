import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ensureThaiFont, registerThaiFont, hasThaiFont } from './thai-font.js';

const FONT_ERR =
  'ไม่พบฟอนต์ภาษาไทย\nกรุณาวางไฟล์ THSarabunNew.ttf ใน client/public/fonts/ แล้วรีเฟรชหน้าเว็บ';

async function requireFont() {
  await ensureThaiFont();
  if (!hasThaiFont()) throw new Error(FONT_ERR);
}

// Logo loader — fetches /images/Logo.png once and caches as base64
let _logoData = null;
let _logoPromise = null;
async function loadLogo() {
  if (_logoData) return _logoData;
  if (_logoPromise) return _logoPromise;
  _logoPromise = fetch('/images/Logo.png')
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer(); })
    .then((buf) => {
      let bin = '';
      new Uint8Array(buf).forEach((b) => (bin += String.fromCharCode(b)));
      _logoData = btoa(bin);
      return _logoData;
    })
    .catch(() => null);
  return _logoPromise;
}
import { thaiDate, thaiDateRange, bahtText } from './thai-utils.js';

const COMPANY = 'LivPlus Health Solution Co., Ltd.';
const MARGIN = 20; // mm (per spec)

// ---------------- low-level helpers ----------------
function createDoc(title) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const font = registerThaiFont(doc);
  doc.setFont(font, 'normal');
  doc._thaiFont = font;
  doc._title = title;

  // Safety net: patch getCharWidthsArray so a broken font.metadata.Unicode never crashes.
  // Internal jsPDF calls use API.getCharWidthsArray which is the same ref as doc.getCharWidthsArray.
  const _origCWA = doc.getCharWidthsArray.bind(doc);
  doc.getCharWidthsArray = function (text, options) {
    const f = (options && options.font) || this.internal.getFont();
    if (f && f.metadata && !f.metadata.Unicode) {
      f.metadata.Unicode = { encoding: {}, kerning: {}, widths: [] };
    }
    try {
      return _origCWA(text, options);
    } catch (_) {
      return new Array(typeof text === 'string' ? text.length : 1).fill(0.5);
    }
  };

  const _origSplit = doc.splitTextToSize.bind(doc);
  doc.splitTextToSize = function (text, maxWidth, options) {
    try {
      return _origSplit(text, maxWidth, options);
    } catch (_) {
      const charsPerLine = Math.max(1, Math.floor(maxWidth / 3.5));
      const lines = [];
      let rem = String(text || '');
      while (rem.length > charsPerLine) {
        const sp = rem.lastIndexOf(' ', charsPerLine);
        const cut = sp > charsPerLine * 0.6 ? sp + 1 : charsPerLine;
        lines.push(rem.slice(0, cut));
        rem = rem.slice(cut);
      }
      if (rem) lines.push(rem);
      return lines;
    }
  };

  return doc;
}

const money = (n) =>
  Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function pageWidth(doc) {
  return doc.internal.pageSize.getWidth();
}

// Draw company header + page footer on every page (called last).
function decorate(doc) {
  const font = doc._thaiFont;
  const w = pageWidth(doc);
  const hgt = doc.internal.pageSize.getHeight();
  const pages = doc.internal.getNumberOfPages();
  const today = new Date().toLocaleDateString('th-TH');
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    // logo placeholder
    doc.setDrawColor(190);
    doc.rect(MARGIN, 9, 16, 11);
    doc.setFont(font, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(130);
    doc.text('LOGO', MARGIN + 8, 15.5, { align: 'center' });
    // company + title
    doc.setFontSize(13);
    doc.setTextColor(30);
    doc.text(COMPANY, MARGIN + 20, 14);
    doc.setFontSize(10);
    doc.setTextColor(110);
    doc.text(doc._title, MARGIN + 20, 19);
    doc.setDrawColor(150);
    doc.line(MARGIN, 23, w - MARGIN, 23);
    // footer
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.line(MARGIN, hgt - 14, w - MARGIN, hgt - 14);
    doc.text(`หน้า ${i}/${pages}`, MARGIN, hgt - 9);
    doc.text(`พิมพ์เมื่อ ${today}`, w - MARGIN, hgt - 9, { align: 'right' });
  }
}

function table(doc, opts) {
  autoTable(doc, {
    margin: { top: 28, left: MARGIN, right: MARGIN, bottom: 18 },
    styles: { font: doc._thaiFont, fontSize: 10, cellPadding: 2, textColor: 40 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, font: doc._thaiFont },
    ...opts,
  });
  return doc.lastAutoTable.finalY;
}

function sectionTitle(doc, text, y) {
  doc.setFont(doc._thaiFont, 'normal');
  doc.setFontSize(12);
  doc.setTextColor(37, 99, 235);
  doc.text(text, MARGIN, y);
  doc.setTextColor(40);
  return y + 6;
}

function paragraph(doc, text, y, size = 11) {
  doc.setFont(doc._thaiFont, 'normal');
  doc.setFontSize(size);
  const lines = doc.splitTextToSize(text || '-', pageWidth(doc) - MARGIN * 2);
  doc.text(lines, MARGIN, y);
  return y + lines.length * (size * 0.45) + 3;
}

function budgetRows(r) {
  return [
    ['ค่าวิทยากร', money(r.budget_instructor)],
    ['ค่าสถานที่', money(r.budget_venue)],
    ['ค่าอาหารและเครื่องดื่ม', money(r.budget_food)],
    ['ค่าเอกสาร/วัสดุ', money(r.budget_material)],
    ['ค่าใช้จ่ายอื่นๆ', money(r.budget_other)],
  ];
}

function budgetTotal(r) {
  return (
    Number(r.budget_instructor || 0) +
    Number(r.budget_venue || 0) +
    Number(r.budget_food || 0) +
    Number(r.budget_material || 0) +
    Number(r.budget_other || 0)
  );
}

// ============================================================
// 2A — Training Proposal
// ============================================================
export async function exportTrainingProposal(r, course) {
  await requireFont();
  const doc = createDoc('เอกสารนำเสนอการฝึกอบรม (Training Proposal)');
  let y = 30;

  y = sectionTitle(doc, 'ชื่อหลักสูตร', y);
  y = paragraph(doc, `${course?.name_th || r.course_code || '-'}  (${r.req_no || ''})`, y);

  y = sectionTitle(doc, 'สถานที่ / วันที่ / เวลา / จำนวนผู้เข้าอบรม', y + 2);
  y = paragraph(
    doc,
    `สถานที่: ${r.location || '-'}\nวันที่อบรม: ${r.training_date || '-'} ถึง ${r.end_date || r.training_date || '-'}\nจำนวนผู้เข้าอบรม: ${r.attendee_count || 0} คน`,
    y
  );

  y = sectionTitle(doc, 'วัตถุประสงค์', y + 2);
  y = paragraph(doc, r.objective, y);

  y = sectionTitle(doc, 'กลุ่มเป้าหมาย', y + 2);
  y = paragraph(doc, r.target_group, y);

  y = sectionTitle(doc, 'การวัดผลความสำเร็จ', y + 2);
  y = paragraph(doc, r.success_measure || 'ประเมินผลผ่านแบบประเมินความพึงพอใจ และคะแนนเฉลี่ยไม่ต่ำกว่า 3.5/5', y);

  y = sectionTitle(doc, 'คาดการณ์งบประมาณ', y + 2);
  y = table(doc, {
    startY: y,
    head: [['รายการ', 'จำนวนเงิน (บาท)']],
    body: budgetRows(r),
    foot: [['รวมทั้งสิ้น', money(budgetTotal(r))]],
    columnStyles: { 1: { halign: 'right' } },
    footStyles: { fillColor: [219, 234, 254], textColor: 30, fontStyle: 'normal', font: doc._thaiFont },
  });

  y = sectionTitle(doc, 'กำหนดการอบรม', y + 8);
  const sched = (r.schedule || []).map((s, i) => [
    i + 1,
    s.date || '',
    `${s.start_time || ''} - ${s.end_time || ''}`,
    s.topic || '',
    s.trainer || '',
  ]);
  y = table(doc, {
    startY: y,
    head: [['ลำดับ', 'วันที่', 'เวลา', 'หัวข้อ', 'วิทยากร']],
    body: sched.length ? sched : [['-', '-', '-', '-', '-']],
  });

  y = sectionTitle(doc, 'วิทยากร', y + 8);
  y = paragraph(doc, `${r.trainer_name || '-'}${r.trainer_org ? ' (' + r.trainer_org + ')' : ''}`, y);

  y = paragraph(doc, `วันที่จัดทำ: ${r.created_at || new Date().toLocaleDateString('th-TH')}`, y + 4);

  decorate(doc);
  doc.save(`Training-Proposal-${r.req_no || 'draft'}.pdf`);
}

// ============================================================
// 2A — PR Form (ใบ PR)
// ============================================================
export async function exportPRForm(r, course) {
  await requireFont();
  const doc = createDoc('ใบขอซื้อ / ขออนุมัติงบประมาณ (PR Form)');
  let y = 30;

  doc.setFont(doc._thaiFont, 'normal');
  doc.setFontSize(11);
  doc.text(`ชื่อหลักสูตร: ${course?.name_th || r.course_code || '-'}`, MARGIN, y);
  doc.text(`วันที่: ${r.training_date || '-'}`, MARGIN, y + 6);
  doc.text(`ผู้ขอ: ${r.requester || 'ฝ่ายทรัพยากรบุคคล'}`, pageWidth(doc) - MARGIN, y, { align: 'right' });
  doc.text(`แผนก: ${r.department || 'HR'}`, pageWidth(doc) - MARGIN, y + 6, { align: 'right' });
  y += 12;

  const items = budgetRows(r).filter((row) => Number(String(row[1]).replace(/,/g, '')) > 0);
  const body = items.map((row, i) => {
    const amount = Number(String(row[1]).replace(/,/g, ''));
    return [i + 1, row[0], '1', money(amount), money(amount)];
  });
  const subtotal = budgetTotal(r);
  const vat = subtotal * 0.07;
  const grand = subtotal + vat;

  y = table(doc, {
    startY: y,
    head: [['ลำดับ', 'รายการ', 'จำนวน', 'ราคาต่อหน่วย', 'รวม']],
    body: body.length ? body : [['-', '-', '-', '-', '-']],
    columnStyles: { 0: { halign: 'center', cellWidth: 16 }, 2: { halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
    foot: [
      [{ content: 'รวมเป็นเงิน', colSpan: 4, styles: { halign: 'right' } }, money(subtotal)],
      [{ content: 'ภาษีมูลค่าเพิ่ม (VAT 7%)', colSpan: 4, styles: { halign: 'right' } }, money(vat)],
      [{ content: 'รวมทั้งหมด', colSpan: 4, styles: { halign: 'right' } }, money(grand)],
    ],
    footStyles: { fillColor: [219, 234, 254], textColor: 30, font: doc._thaiFont },
  });

  y += 20;
  doc.setFontSize(11);
  doc.text('ผู้ขอ ............................................', MARGIN, y);
  doc.text('ผู้อนุมัติ ............................................', pageWidth(doc) - MARGIN - 60, y);

  decorate(doc);
  doc.save(`PR-Form-${r.req_no || 'draft'}.pdf`);
}

// ============================================================
// 2A — Memo
// ============================================================
export async function exportMemo(r, course) {
  await requireFont();
  const doc = createDoc('บันทึกข้อความ (Memo)');
  let y = 32;
  const total = budgetTotal(r);

  doc.setFont(doc._thaiFont, 'normal');
  doc.setFontSize(14);
  doc.text('บันทึกข้อความ', pageWidth(doc) / 2, y, { align: 'center' });
  y += 10;

  doc.setFontSize(11);
  doc.text(`เรียน  ผู้จัดการฝ่ายทรัพยากรบุคคล`, MARGIN, y);
  y += 6;
  doc.text(`เรื่อง  ขออนุมัติงบประมาณการฝึกอบรม`, MARGIN, y);
  y += 6;
  doc.text(`วันที่  ${r.created_at || new Date().toLocaleDateString('th-TH')}`, MARGIN, y);
  y += 4;
  doc.setDrawColor(150);
  doc.line(MARGIN, y, pageWidth(doc) - MARGIN, y);
  y += 8;

  const bodyText =
    `ด้วยฝ่ายทรัพยากรบุคคลมีความประสงค์จะจัดการฝึกอบรมหลักสูตร "${course?.name_th || r.course_code || '-'}" ` +
    `ให้แก่ ${r.target_group || 'พนักงาน'} จำนวน ${r.attendee_count || 0} คน ` +
    `ณ ${r.location || '-'} ในวันที่ ${r.training_date || '-'}${r.end_date && r.end_date !== r.training_date ? ' ถึง ' + r.end_date : ''} ` +
    `โดยมีวัตถุประสงค์เพื่อ ${r.objective || 'พัฒนาศักยภาพของบุคลากร'} ` +
    `วิทยากรโดย ${r.trainer_name || '-'}${r.trainer_org ? ' จาก ' + r.trainer_org : ''} ` +
    `ทั้งนี้ใช้งบประมาณรวมทั้งสิ้น ${money(total)} บาท (ไม่รวมภาษีมูลค่าเพิ่ม)`;
  y = paragraph(doc, bodyText, y);
  y += 2;
  y = paragraph(doc, 'จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ', y);

  y += 20;
  const rightX = pageWidth(doc) - MARGIN - 55;
  doc.setFontSize(11);
  doc.text('ขอแสดงความนับถือ', rightX, y);
  doc.text('....................................', rightX, y + 16);
  doc.text('(ผู้ขออนุมัติ)', rightX + 6, y + 22);

  decorate(doc);
  doc.save(`Memo-${r.req_no || 'draft'}.pdf`);
}

// ============================================================
// 2A — Memo (สำหรับหน้า MemoForm)
// ============================================================
export async function exportMemoSimple(data) {
  await requireFont();
  const doc = createDoc('บันทึกข้อความ');
  const font = doc._thaiFont;
  const W = pageWidth(doc);
  const ML = 20;
  const MR = 15;
  const CW = W - ML - MR;
  let y = 18;

  // ── Title ──
  doc.setFont(font, 'normal');
  doc.setFontSize(18);
  doc.setTextColor(20);
  doc.text('บันทึกข้อความ', W / 2, y, { align: 'center' });
  y += 8;

  doc.setDrawColor(60);
  doc.setLineWidth(0.5);
  doc.line(ML, y, W - MR, y);
  y += 8;

  // ── Header fields ──
  const LBL = 42;
  const hFields = [
    ['หน่วยงานผู้ส่ง', data.from_dept || '-'],
    ['เรียน', data.to_dept || '-'],
    ...(data.cc_dept ? [['สำเนา', data.cc_dept]] : []),
    ['เรื่อง', data.subject || '-'],
    ['วันที่', thaiDate(data.doc_date)],
  ];

  doc.setFontSize(14);
  for (const [lbl, val] of hFields) {
    doc.setTextColor(60);
    doc.text(lbl, ML, y);
    doc.text(':', ML + LBL - 6, y);
    doc.setTextColor(20);
    const vLines = doc.splitTextToSize(val, CW - LBL);
    doc.text(vLines, ML + LBL, y);
    y += vLines.length * 7 + 1;
  }

  y += 4;
  doc.setDrawColor(150);
  doc.setLineWidth(0.3);
  doc.line(ML, y, W - MR, y);
  y += 9;

  // ── Intro paragraph ──
  doc.setFontSize(14);
  doc.setTextColor(20);
  const introLines = doc.splitTextToSize(data.intro_text || '', CW);
  doc.text(introLines, ML, y);
  y += introLines.length * 7 + 7;

  // ── Budget table ──
  const items = data.budget_items || [];
  const total = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);

  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR, bottom: 20 },
    head: [['ลำดับที่', 'รายการ', 'ค่าใช้จ่ายรวม (บาท)']],
    body: [
      [
        {
          content: 'รายการขออนุมัติงบประมาณ',
          colSpan: 3,
          styles: { halign: 'center', fillColor: [240, 240, 240], textColor: 20, font, fontSize: 12 },
        },
      ],
      ...items.map((it, i) => [`${i + 1}`, it.description || '-', money(Number(it.amount) || 0)]),
    ],
    foot: [
      [
        {
          content: `รวมค่าใช้จ่ายทั้งหมด  (${bahtText(total)})`,
          colSpan: 2,
          styles: { halign: 'left', font, fontSize: 12 },
        },
        { content: money(total), styles: { halign: 'right', font, fontSize: 12 } },
      ],
    ],
    headStyles: { fillColor: [37, 99, 235], textColor: 255, font, fontSize: 12, halign: 'center' },
    styles: { font, fontSize: 12, cellPadding: 3, textColor: 20 },
    footStyles: { fillColor: [219, 234, 254], textColor: 20, font, fontSize: 12 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 20 },
      2: { halign: 'right', cellWidth: 50 },
    },
  });
  y = doc.lastAutoTable.finalY + 10;

  // ── Closing ──
  doc.setFontSize(14);
  doc.setFont(font, 'normal');
  doc.setTextColor(20);
  const c1 = doc.splitTextToSize(
    'ทั้งนี้ ทางฝ่าย จะดำเนินการเคลียร์ค่าใช้จ่ายกับทางบัญชี ตามระเบียบบริษัทต่อไป',
    CW
  );
  doc.text(c1, ML, y);
  y += c1.length * 7 + 9;
  doc.text('จึงเรียนมาเพื่อโปรดพิจารณา', ML, y);

  // ── Footer ──
  const pages = doc.internal.getNumberOfPages();
  const today = new Date().toLocaleDateString('th-TH');
  const pageH = doc.internal.pageSize.getHeight();
  for (let pg = 1; pg <= pages; pg++) {
    doc.setPage(pg);
    doc.setFontSize(9);
    doc.setTextColor(130);
    doc.setDrawColor(180);
    doc.line(ML, pageH - 14, W - MR, pageH - 14);
    doc.text(`หน้า ${pg}/${pages}`, ML, pageH - 8);
    doc.text(`พิมพ์เมื่อ ${today}`, W - MR, pageH - 8, { align: 'right' });
  }

  const dateStr = (data.doc_date || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
  doc.save(`Memo-${dateStr}.pdf`);
}

// ============================================================
// 2A — Memo Full (upgraded layout per LivPlus_Memo_Design_Spec)
// ============================================================
export async function exportMemoFull(data) {
  await requireFont();
  const logo = await loadLogo();
  const doc = createDoc('บันทึกข้อความ');
  const font = doc._thaiFont;
  const W = pageWidth(doc);   // 210 mm (A4)
  const ML = 13;              // left margin  (48px @ 96dpi)
  const MR = 13;              // right margin (48px @ 96dpi)
  const CW = W - ML - MR;    // 184 mm content width
  let y = 10;                 // top padding  (36px @ 96dpi)

  // Standalone mode (MemoForm) when sig1_name key present; course mode (DocumentRender) otherwise
  const isStandalone = 'sig1_name' in data;

  // ── SECTION 1: Header bar — Logo (left) + MEMORANDUM box (right) ──
  const LOGO_W = 29;  // 110px
  const LOGO_H = 14;  // ~52px auto height
  if (logo) {
    try { doc.addImage(logo, 'PNG', ML, y, LOGO_W, LOGO_H); } catch (_) {}
  } else {
    // HTML-spec fallback logo
    doc.setFont(font, 'normal');
    doc.setFontSize(16);
    doc.setTextColor(192, 34, 42);   // #C0222A
    doc.text('Liv+', ML, y + 8);
    doc.setFontSize(10);
    doc.setTextColor(45, 106, 63);   // #2D6A3F
    doc.text('Plus', ML + 2, y + 13);
  }

  // MEMORANDUM badge — navy #1C1C3A, width 160px=42mm, padding 8px top/bottom
  const BOX_W = 42;
  const BOX_H = 10;
  const boxX = W - MR - BOX_W;
  doc.setFillColor(28, 28, 58);      // #1C1C3A
  doc.rect(boxX, y + 1, BOX_W, BOX_H, 'F');
  doc.setFont(font, 'normal');
  doc.setFontSize(9.75);             // 13px
  doc.setTextColor(255, 255, 255);
  doc.text('MEMORANDUM', boxX + BOX_W / 2, y + 1 + BOX_H / 2 + 1.8, { align: 'center' });

  // header bar margin-bottom 16px = 4mm
  y += LOGO_H + 4;

  // ── SECTION 2: Date line (right-aligned, gap 6px = 1.5mm) ──
  y += 1.5;
  doc.setFont(font, 'normal');
  doc.setFontSize(11);               // 14px
  doc.setTextColor(0);
  doc.text(`วันที่ / Date:   ${thaiDate(data.doc_date)}`, W - MR, y, { align: 'right' });
  y += 5.5;  // line height (date line → divider: 0px gap per spec)

  // ── SECTION 3: Horizontal divider 1 — black 1.5px ──
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(ML, y, W - MR, y);
  y += 3.2;  // 12px gap

  // ── SECTION 4: Memo header fields (From / To / CC / Subject) ──
  const LBL_W = 40;   // 150px label column
  const VAL_X = ML + LBL_W;
  const VAL_W = CW - LBL_W;

  const headerFields = [
    { label: 'หน่วยงานผู้ส่ง / From:', value: data.from_dept || '-' },
    { label: 'เรียน / To:', value: data.to_dept || '-' },
    ...(data.cc_dept ? [{ label: 'สำเนา / CC:', value: data.cc_dept }] : []),
    { label: 'เรื่อง:', value: data.subject || '-' },
  ];

  doc.setFontSize(11);               // 14px
  for (const f of headerFields) {
    doc.setFont(font, 'normal');
    doc.setTextColor(0);
    doc.text(f.label, ML, y);
    const vLines = doc.splitTextToSize(f.value, VAL_W);
    doc.text(vLines, VAL_X, y);
    y += vLines.length * 6 + 1;     // line-height 1.6 + 4px row gap
  }

  // ── SECTION 5: Horizontal divider 2 — black 1.5px ──
  y += 2;    // 8px margin-top
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(ML, y, W - MR, y);
  y += 3.7;  // 14px gap

  // ── SECTION 6: Body text ──
  doc.setFont(font, 'normal');
  doc.setFontSize(11);               // 14px
  doc.setTextColor(0);

  if (isStandalone) {
    const bLines = doc.splitTextToSize(data.intro_text || '', CW);
    doc.text(bLines, ML, y);
    y += bLines.length * 6.6 + 9;
  } else {
    const courseName = data.course_name || '-';
    const dateRange = thaiDateRange(data.training_date, data.end_date);
    const attendees = data.attendee_names || [];
    const attendeeCount = attendees.length || Number(data.attendee_count) || 0;

    const bodyPara =
      `ตามที่ ${data.from_dept || 'ฝ่ายทรัพยากรบุคคล'} ได้รับการอนุมัติให้ส่งบุคลากรเข้าร่วมการอบรมภายนอก ` +
      `หลักสูตร ${courseName} ซึ่งกำหนดอบรมวันที่ ${dateRange} ` +
      `ณ ${data.location || '-'} โดยมีผู้เข้าร่วมจำนวน ${attendeeCount} ท่าน ได้แก่`;

    const bLines = doc.splitTextToSize(bodyPara, CW);
    doc.text(bLines, ML, y);
    y += bLines.length * 6.6 + 2;

    attendees.forEach((a, i) => {
      doc.text(`${i + 1}.  ${a.name || ''}`, ML + 8, y);
      y += 6;
    });
    y += 2;  // 8px after list

    const followUp = 'ทางฝ่าย ขออนุมัติค่าฝึกอบรมภายนอก ตามรายละเอียดดังนี้';
    const fuLines = doc.splitTextToSize(followUp, CW);
    doc.text(fuLines, ML, y);
    y += fuLines.length * 6.6 + 3.7;  // 14px gap before table
  }

  // ── SECTION 7: Budget table ──
  const items = data.budget_items || [];
  const effCount = isStandalone ? 1 : (data.attendee_names?.length || Number(data.attendee_count) || 1);

  const rowTypes = {};
  let bodyRowIdx = 0;
  const tableBody = [];

  // ROW TYPE B — sub-header (รายการขออนุมัติงบประมาณ)
  tableBody.push([{
    content: 'รายการขออนุมัติงบประมาณ',
    colSpan: 3,
    styles: {
      halign: 'left',
      fillColor: [232, 232, 232],   // #E8E8E8
      textColor: [0, 0, 0],
      font,
      fontSize: 10,
      cellPadding: { top: 2, bottom: 2, left: 4, right: 4 },
    },
  }]);
  rowTypes[bodyRowIdx++] = 'subheader';

  items.forEach((it, i) => {
    const amount = Number(it.amount) || (Number(it.price_per_person || 0) * effCount) || 0;
    const itemLabel = it.item_name || it.description || '-';

    // ROW TYPE C — data row
    tableBody.push([`${i + 1}`, itemLabel, money(amount)]);
    rowTypes[bodyRowIdx++] = 'name';

    // bullet detail sub-rows (price per person)
    const detailLines = [];
    if (it.details) {
      it.details.split('\n').filter(Boolean).forEach((line) => detailLines.push(`− ${line.trim()}`));
    }
    if (it.price_per_person) {
      detailLines.push(`− ${money(it.price_per_person)} บาท × ${effCount} คน`);
    }
    if (detailLines.length) {
      tableBody.push([{
        content: detailLines.join('\n'),
        colSpan: 3,
        styles: { halign: 'left', font, fontSize: 9.4, textColor: [26, 26, 26], cellPadding: { top: 1, bottom: 2, left: 30, right: 4 } },
      }]);
      rowTypes[bodyRowIdx++] = 'detail';
    }

    // vendor / invoice sub-row
    const vendorLines = [];
    if (it.vendor_name) vendorLines.push(`สั่งจ่ายในนาม ${it.vendor_name}`);
    const invParts = [];
    if (it.invoice_no || it.invoice_number) invParts.push(`${it.invoice_no || it.invoice_number}`);
    if (it.due_date || it.payment_date) invParts.push(`ที่จ่าย วันที่ ${thaiDate(it.due_date || it.payment_date)}`);
    if (invParts.length) vendorLines.push(invParts.join('   '));
    if (vendorLines.length) {
      tableBody.push([{
        content: vendorLines.join('\n'),
        colSpan: 3,
        styles: { halign: 'left', font, fontSize: 9, textColor: [120, 120, 120], cellPadding: { top: 1, bottom: 4, left: 30, right: 4 } },
      }]);
      rowTypes[bodyRowIdx++] = 'vendor';
    }
  });

  const grandTotal = items.reduce(
    (s, it) => s + (Number(it.amount) || (Number(it.price_per_person || 0) * effCount) || 0),
    0
  );

  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR, bottom: 20 },
    head: [['ลำดับที่', 'รายการ', 'ค่าใช้จ่ายรวม (บาท)']],
    body: tableBody.length > 1 ? tableBody : [
      [{ content: 'รายการขออนุมัติงบประมาณ', colSpan: 3, styles: { halign: 'left', fillColor: [232, 232, 232], textColor: [0,0,0], font, fontSize: 10 } }],
      ['1', '-', '0.00'],
    ],
    foot: [[
      { content: `รวมค่าใช้จ่ายทั้งหมด  (${bahtText(grandTotal)})`, colSpan: 2, styles: { halign: 'left', font, fontSize: 10 } },
      { content: money(grandTotal), styles: { halign: 'right', font, fontSize: 10 } },
    ]],
    headStyles: {
      fillColor: [192, 34, 42],      // #C0222A
      textColor: [255, 255, 255],
      font,
      fontSize: 10,                  // 13px
      halign: 'center',
      cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
    },
    styles: { font, fontSize: 10, cellPadding: { top: 3, bottom: 3, left: 4, right: 4 }, textColor: [26, 26, 26] },
    footStyles: {
      fillColor: [232, 232, 232],    // #E8E8E8
      textColor: [0, 0, 0],
      font,
      fontSize: 10,
      lineColor: [170, 170, 170],    // #AAAAAA top border
      lineWidth: 0.5,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 16 },   // ลำดับที่ 60px
      2: { halign: 'right',  cellWidth: 32 },   // ค่าใช้จ่าย 120px
    },
    didParseCell: (d) => {
      if (d.section === 'body' && rowTypes[d.row.index] === 'name' && d.column.index === 1) {
        d.cell.styles.textColor = [0, 0, 0];
      }
    },
  });
  y = doc.lastAutoTable.finalY + 2.6;  // 10px gap

  // ── SECTION 8: Footer note lines ──
  doc.setFont(font, 'normal');
  doc.setFontSize(10);               // 13px
  doc.setTextColor(0);

  const closingLine1 = isStandalone
    ? 'ทั้งนี้ ทางฝ่ายฯ จะดำเนินการเคลียร์ค่าใช้จ่ายกับทางบัญชี ตามระบบบริษัทต่อไป'
    : 'ทั้งนี้ ทางฝ่าย จะดำเนินการเคลียร์ค่าใช้จ่ายกับทางบัญชี ตามระเบียบบริษัทต่อไป';
  const c1 = doc.splitTextToSize(closingLine1, CW);
  doc.text(c1, ML, y);
  y += c1.length * 5.6 + 2.6;       // 10px gap between footer lines

  doc.text('จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ', ML, y);
  y += 5.6 + 14.8;                  // 56px gap before signature block

  // ── SECTION 9: Signature block ──
  const SIG_LINE_W = 42;            // 160px signature line width

  if (isStandalone) {
    // 2+1 layout: sig1 (top-left) + sig2 (top-right), sig3 (bottom-center)
    const halfW = CW / 2;
    const sig1X = ML + halfW / 2;
    const sig2X = ML + halfW + halfW / 2;

    [
      { cx: sig1X, name: data.sig1_name, title: data.sig1_title },
      { cx: sig2X, name: data.sig2_name, title: data.sig2_title },
    ].forEach((s) => {
      doc.setDrawColor(0);
      doc.setLineWidth(0.35);
      doc.line(s.cx - SIG_LINE_W / 2, y, s.cx + SIG_LINE_W / 2, y);
      doc.setFontSize(9.75);
      doc.setTextColor(0);
      doc.text(`(${s.name || '..............................'})`, s.cx, y + 5.6, { align: 'center' });
      if (s.title) {
        doc.setFontSize(9);
        const tl = doc.splitTextToSize(s.title, halfW - 6);
        doc.text(tl, s.cx, y + 5.6 + 4, { align: 'center' });
      }
    });

    y += 36;
    const sig3X = W / 2;
    doc.setDrawColor(0);
    doc.setLineWidth(0.35);
    doc.line(sig3X - SIG_LINE_W / 2, y, sig3X + SIG_LINE_W / 2, y);
    doc.setFontSize(9.75);
    doc.setTextColor(0);
    doc.text(`(${data.sig3_name || '..............................'})`, sig3X, y + 5.6, { align: 'center' });
    if (data.sig3_title) {
      doc.setFontSize(9);
      const tl = doc.splitTextToSize(data.sig3_title, halfW - 6);
      doc.text(tl, sig3X, y + 5.6 + 4, { align: 'center' });
    }
  } else {
    // 3-column: preparer (left) | reviewer (center) | approver (right, +21mm lower per spec)
    const sigColW = CW / 3;
    const APPROVER_DROP = 21;        // 80px lower

    const sigs = [
      { cx: ML + sigColW / 2,           name: data.preparer_name, title: data.preparer_title, dropY: 0 },
      { cx: ML + sigColW + sigColW / 2, name: data.reviewer_name, title: data.reviewer_title, dropY: 0 },
      { cx: ML + sigColW * 2 + sigColW / 2, name: data.approver_name, title: data.approver_title, dropY: APPROVER_DROP },
    ];

    sigs.forEach((s) => {
      const sy = y + s.dropY;
      doc.setDrawColor(0);
      doc.setLineWidth(0.35);
      doc.line(s.cx - SIG_LINE_W / 2, sy, s.cx + SIG_LINE_W / 2, sy);
      doc.setFont(font, 'normal');
      doc.setFontSize(9.75);         // 13px name
      doc.setTextColor(0);
      doc.text(`(${s.name || '..............................'})`, s.cx, sy + 5.6, { align: 'center' });
      if (s.title) {
        doc.setFontSize(9);          // 12px title
        const tl = doc.splitTextToSize(s.title, sigColW - 6);
        doc.text(tl, s.cx, sy + 5.6 + 4, { align: 'center' });
      }
    });
  }

  // ── Page footer ──
  const pages = doc.internal.getNumberOfPages();
  const today = new Date().toLocaleDateString('th-TH');
  const pageH = doc.internal.pageSize.getHeight();
  for (let pg = 1; pg <= pages; pg++) {
    doc.setPage(pg);
    doc.setFontSize(9);
    doc.setTextColor(130);
    doc.setLineWidth(0.3);
    doc.setDrawColor(180);
    doc.line(ML, pageH - 14, W - MR, pageH - 14);
    doc.text(`หน้า ${pg}/${pages}`, ML, pageH - 8);
    doc.text(`จัดทำโดย ${today}`, W - MR, pageH - 8, { align: 'right' });
  }

  const fileDateStr = (data.doc_date || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
  doc.save(`MEMO-${data.req_no || 'standalone'}-${fileDateStr}.pdf`);
}

// ============================================================
// 2B — Registration Sheet
// ============================================================
export async function exportRegistrationSheet(reg, r, course) {
  await requireFont();
  const doc = createDoc('ใบลงทะเบียนเข้าอบรม (Registration Sheet)');
  let y = 30;

  doc.setFont(doc._thaiFont, 'normal');
  doc.setFontSize(11);
  doc.text(`หลักสูตร: ${course?.name_th || r?.course_code || '-'}`, MARGIN, y);
  doc.text(`วันที่: ${r?.training_date || reg?.reg_date || '-'}`, MARGIN, y + 6);
  doc.text(`สถานที่: ${r?.location || '-'}`, MARGIN, y + 12);
  doc.text(`วิทยากร: ${r?.trainer_name || '-'}`, MARGIN, y + 18);
  y += 26;

  const rows = (reg?.attendees || []).map((a, i) => [
    i + 1,
    a.name || '',
    a.department || '',
    a.position || '',
    '', // signature column left blank
    a.note || (a.checked_in ? 'มาแล้ว' : ''),
  ]);
  table(doc, {
    startY: y,
    head: [['ลำดับ', 'ชื่อ-นามสกุล', 'แผนก', 'ตำแหน่ง', 'ลายมือชื่อ', 'หมายเหตุ']],
    body: rows.length ? rows : [['-', '-', '-', '-', '', '']],
    columnStyles: { 0: { halign: 'center', cellWidth: 14 }, 4: { cellWidth: 32 } },
    bodyStyles: { minCellHeight: 9 },
  });

  decorate(doc);
  doc.save(`Registration-${r?.req_no || 'sheet'}.pdf`);
}

// ============================================================
// 2C — Evaluation Summary
// ============================================================
export async function exportEvalSummary(ev, form, r, course) {
  await requireFont();
  const doc = createDoc('สรุปผลการประเมินการอบรม (Evaluation Summary)');
  let y = 30;

  doc.setFont(doc._thaiFont, 'normal');
  doc.setFontSize(11);
  doc.text(`หลักสูตร: ${course?.name_th || r?.course_code || '-'}`, MARGIN, y);
  doc.text(`แบบประเมิน: ${form?.name_th || ev.eval_form_code || '-'}`, MARGIN, y + 6);
  doc.text(`ผู้ประเมิน: ${ev.evaluator_name || '-'}`, MARGIN, y + 12);
  doc.text(`วันที่ประเมิน: ${ev.eval_date || '-'}`, MARGIN, y + 18);
  y += 26;

  const itemName = {};
  (form?.items || []).forEach((it) => (itemName[it.item_code] = it.item_name_th || it.item_code));
  const rows = (ev.responses || []).map((res, i) => [
    i + 1,
    itemName[res.item_code] || res.item_code,
    res.score ?? '-',
    res.comment || '',
  ]);
  y = table(doc, {
    startY: y,
    head: [['ลำดับ', 'หัวข้อประเมิน', 'คะแนน', 'ความคิดเห็น']],
    body: rows.length ? rows : [['-', '-', '-', '-']],
    columnStyles: { 0: { halign: 'center', cellWidth: 14 }, 2: { halign: 'center', cellWidth: 22 } },
  });

  y += 10;
  doc.setFontSize(12);
  doc.text(`คะแนนเฉลี่ย: ${ev.total_score ?? '-'} / 5`, MARGIN, y);
  doc.text(
    `ผลการประเมิน: ${ev.status === 'pass' ? 'ผ่าน' : ev.status === 'fail' ? 'ไม่ผ่าน' : '-'}`,
    MARGIN,
    y + 7
  );

  decorate(doc);
  doc.save(`Eval-Summary-${r?.req_no || ev.id}.pdf`);
}

// ============================================================
// PR Form Full — ใบขอซื้อ (Purchase Requisition) full spec
// ============================================================
export async function exportPRFormFull(data) {
  await requireFont();
  const logo = await loadLogo();

  const doc = createDoc('ใบขอซื้อ / PURCHASE REQUISITION (PR)');
  const font = doc._thaiFont;
  const W = pageWidth(doc);   // 210 mm
  const ML = 12;
  const MR = 12;
  const CW = W - ML - MR;    // 186 mm

  let y = 10;

  // ── Logo (top-left) ──
  if (logo) {
    try { doc.addImage(logo, 'PNG', ML, y, 44, 20); } catch (_) {}
  }

  // ── Company name & address (center) ──
  doc.setFont(font, 'normal');
  doc.setFontSize(13);
  doc.setTextColor(20);
  doc.text('Livplus Health Solution Co., Ltd.', W / 2, y + 8, { align: 'center' });
  doc.setFontSize(8);
  doc.setTextColor(60);
  const addrText = 'Address: 38/88 Moo 5, Pak Kret Sub-district, Pak Kret District, Nonthaburi 11120, Thailand.';
  const addrLines = doc.splitTextToSize(addrText, 92);
  doc.text(addrLines, W / 2, y + 14, { align: 'center' });

  // ── Document reference box (top-right) ──
  const boxW = 52;
  const boxH = 24;
  const boxX = W - MR - boxW;
  doc.setDrawColor(100);
  doc.setLineWidth(0.3);
  doc.rect(boxX, y, boxW, boxH);
  doc.setFontSize(8);
  doc.setTextColor(30);
  doc.text('หมายเลขเอกสาร:', boxX + 2, y + 6);
  doc.text('PR01 (Rev.01)', boxX + 2, y + 12);
  doc.text('วันที่มีผลบังคับใช้:', boxX + 2, y + 18);
  doc.text('11 สิงหาคม 2569', boxX + 2, y + 23);

  y = 37;

  // ── Separator ──
  doc.setDrawColor(60);
  doc.setLineWidth(0.5);
  doc.line(ML, y, W - MR, y);
  y += 4;

  // ── Document title ──
  doc.setFont(font, 'normal');
  doc.setFontSize(14);
  doc.setTextColor(20);
  doc.text('ใบขอซื้อ / PURCHASE REQUISITION (PR)', W / 2, y + 5, { align: 'center' });
  y += 13;

  // ── Date formatter ──
  const fmtDate = (d) => {
    if (!d) return '-';
    const p = d.split('-');
    if (p.length !== 3) return d;
    const mo = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    return `${parseInt(p[2], 10)} ${mo[parseInt(p[1], 10) - 1]} ${parseInt(p[0], 10) + 543}`;
  };
  const fmt = (v) => v || '-';

  // ── General info table (4-column: label | value | label | value) ──
  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR },
    theme: 'grid',
    styles: { font, fontSize: 9, cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 }, textColor: 20 },
    columnStyles: {
      0: { cellWidth: 46, textColor: 50, fillColor: [245, 247, 250] },
      1: { cellWidth: 47 },
      2: { cellWidth: 46, textColor: 50, fillColor: [245, 247, 250] },
      3: { cellWidth: 47 },
    },
    body: [
      ['เลขที่เอกสาร / PR No.', fmt(data.pr_no), 'วันที่ / Date', fmtDate(data.date)],
      ['ฝ่าย / Department', fmt(data.department), 'วันที่ต้องการรับสินค้า\n/ Required Date', fmtDate(data.required_date)],
      ['ผู้ขอซื้อ / Requester', fmt(data.requester), 'ประเภทค่าใช้จ่าย\n/ Expense Type', fmt(data.expense_type)],
    ],
  });
  y = doc.lastAutoTable.finalY + 2;

  // ── Item table ──
  const items = data.items || [];
  const tableBody = Array.from({ length: 10 }, (_, i) => {
    const it = items[i] || {};
    const qty = Number(it.qty) || 0;
    const price = Number(it.unit_price) || 0;
    const amt = qty * price;
    return [
      String(i + 1),
      it.gl_code || '',
      it.item_code || '',
      it.description || '',
      qty ? String(qty) : '',
      it.unit || '',
      price ? money(price) : '',
      amt ? money(amt) : '',
    ];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: ML, right: MR },
    theme: 'grid',
    head: [[
      'ลำดับ\n(No.)',
      'เลขที่บัญชี\n(GL Code)',
      'รหัสสินค้า\n(Item Code)',
      'รายละเอียด / บริการ\n(Description / Services)',
      'จำนวน\n(Qty)',
      'หน่วย\n(Unit)',
      'ราคา/หน่วย บาท\n(Unit Price)',
      'จำนวนเงิน บาท\n(Amount)',
    ]],
    body: tableBody,
    styles: {
      font, fontSize: 8.5,
      cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 },
      textColor: 20, minCellHeight: 5.5,
    },
    headStyles: {
      fillColor: [30, 58, 138], textColor: 255, font, fontSize: 8.5,
      halign: 'center', valign: 'middle', minCellHeight: 12,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 22 },
      2: { cellWidth: 22 },
      3: { cellWidth: 55 },
      4: { halign: 'center', cellWidth: 13 },
      5: { halign: 'center', cellWidth: 13 },
      6: { halign: 'right', cellWidth: 27 },
      7: { halign: 'right', cellWidth: 24 },
    },
  });
  y = doc.lastAutoTable.finalY;

  // ── Summary (right-aligned) ──
  const subtotal = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0);
  const vat = subtotal * 0.07;
  const wht = subtotal * 0.03;
  const total = subtotal + vat - wht;

  autoTable(doc, {
    startY: y,
    margin: { left: ML + CW - 80, right: MR },
    theme: 'grid',
    styles: { font, fontSize: 9.5, cellPadding: { top: 2, bottom: 2, left: 3, right: 3 }, textColor: 40 },
    columnStyles: {
      0: { cellWidth: 52 },
      1: { cellWidth: 28, halign: 'right' },
    },
    body: [
      ['จำนวนเงิน / TOTAL', money(subtotal)],
      ['ภาษีมูลค่าเพิ่ม 7% / VAT', money(vat)],
      ['หักภาษี ณ ที่จ่าย 3%', `(${money(wht)})`],
    ],
    foot: [['จำนวนเงินรวมทั้งหมด / TOTAL AMOUNT', money(total)]],
    footStyles: { fillColor: [219, 234, 254], textColor: 20, font, fontSize: 9.5 },
    didParseCell: (d) => {
      if (d.section === 'foot') d.cell.styles.halign = d.column.index === 1 ? 'right' : 'left';
    },
  });
  y = doc.lastAutoTable.finalY + 4;

  // ── Reason for request ──
  doc.setFont(font, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(40);
  const reasonLabel = 'ระบุเหตุผลในการบันทึกปัญหา, วัตถุประสงค์และเหตุผลในการขอซื้อ / Reason for request';
  const rLbl = doc.splitTextToSize(reasonLabel, CW);
  doc.text(rLbl, ML, y);
  y += rLbl.length * 4.5 + 2;

  const reasonH = 20;
  doc.setDrawColor(120);
  doc.setLineWidth(0.3);
  doc.rect(ML, y, CW, reasonH);
  if (data.reason) {
    doc.setFontSize(10);
    doc.setTextColor(20);
    const rLines = doc.splitTextToSize(data.reason, CW - 6);
    doc.text(rLines.slice(0, 3), ML + 3, y + 5);
  }
  y += reasonH + 6;

  // ── Signatures (3 columns) ──
  const sigColW = CW / 3;
  const sigs = [
    { role: 'ผู้ขอซื้อ / Requested By', name: data.sig1_name, title: data.sig1_title },
    { role: 'ผู้อนุมัติ / Approved By', name: data.sig2_name, title: data.sig2_title },
    { role: 'ผู้อนุมัติ / Approved By', name: data.sig3_name, title: data.sig3_title || 'Chief Executive Officer (CEO)' },
  ];
  doc.setFont(font, 'normal');
  sigs.forEach((s, i) => {
    const cx = ML + sigColW * i + sigColW / 2;
    doc.setFontSize(9.5);
    doc.setTextColor(30);
    doc.text(s.role, cx, y, { align: 'center' });
    doc.setTextColor(80);
    doc.text('ลงชื่อ ....................................', cx, y + 14, { align: 'center' });
    doc.setTextColor(30);
    doc.text(`(${s.name || '..............................'})`, cx, y + 21, { align: 'center' });
    const titleLines = doc.splitTextToSize(s.title || '..............................', sigColW - 6);
    doc.text(titleLines, cx, y + 27, { align: 'center' });
    doc.text('วันที่ / Date: ................................', cx, y + 34, { align: 'center' });
  });

  // ── Page footer ──
  const pages = doc.internal.getNumberOfPages();
  const today = new Date().toLocaleDateString('th-TH');
  const pageH = doc.internal.pageSize.getHeight();
  for (let pg = 1; pg <= pages; pg++) {
    doc.setPage(pg);
    doc.setFontSize(8);
    doc.setTextColor(130);
    doc.setLineWidth(0.3);
    doc.setDrawColor(180);
    doc.line(ML, pageH - 10, W - MR, pageH - 10);
    doc.text(`หน้า ${pg}/${pages}`, ML, pageH - 5);
    doc.text(`พิมพ์เมื่อ ${today}`, W - MR, pageH - 5, { align: 'right' });
  }

  const dateStr = (data.date || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
  doc.save(`PR-${data.pr_no || 'draft'}-${dateStr}.pdf`);
}
