// เหลือเฉพาะเอกสารภายในที่ไม่มีฟอร์มบริษัท (รายงานสรุปโครงการ)
// เอกสาร format บริษัท (Proposal/กำหนดการ = docx, ใบลงทะเบียน/PR = xlsx, Memo = docx,
// ฟอร์ม DSD = xlsx) ทั้งหมด fill template จริงฝั่ง server — ดู CLAUDE.md
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ensureThaiFont, registerThaiFont, hasThaiFont } from './thai-font.js';
import { thaiDate } from './thai-utils.js';

const FONT_ERR =
  'ไม่พบฟอนต์ภาษาไทย\nกรุณาวางไฟล์ THSarabunNew.ttf ใน client/public/fonts/ แล้วรีเฟรชหน้าเว็บ';

async function requireFont() {
  await ensureThaiFont();
  if (!hasThaiFont()) throw new Error(FONT_ERR);
}

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

// ============================================================
// รายงานสรุปโครงการ (เอกสารภายใน — ใช้ข้อมูลจาก GET /training-projects/:id/summary)
// ============================================================
export async function exportProjectSummary(data) {
  await requireFont();
  const doc = createDoc('รายงานสรุปโครงการฝึกอบรม (Training Project Summary)');
  const p = data.project;
  let y = 30;

  doc.setFont(doc._thaiFont, 'normal');
  doc.setFontSize(13);
  doc.text(p.name || '-', MARGIN, y);
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`${p.req_no || ''} · ${p.quarter || ''}/${p.year || ''}`, MARGIN, y + 5.5);
  doc.setTextColor(40);
  y += 13;

  const APPROVAL_TH = { draft: 'ร่าง', pending: 'รออนุมัติ', approved: 'อนุมัติแล้ว', rejected: 'ไม่อนุมัติ' };
  y = table(doc, {
    startY: y,
    head: [['ข้อมูลโครงการ', '']],
    body: [
      ['หลักสูตร', p.course_name_th || '-'],
      ['วันที่อบรม', p.training_date ? `${thaiDate(p.training_date)}${p.end_date && p.end_date !== p.training_date ? ` – ${thaiDate(p.end_date)}` : ''}` : '-'],
      ['สถานที่', p.location || '-'],
      ['วิทยากร', `${p.trainer_name || '-'}${p.trainer_org ? ` (${p.trainer_org})` : ''}`],
      ['วัตถุประสงค์', p.objective || '-'],
      ['กลุ่มเป้าหมาย', p.target_group || '-'],
      ['สถานะอนุมัติ', `${APPROVAL_TH[p.approval_status] || '-'}${p.approved_by ? ` โดย ${p.approved_by}` : ''}${p.approved_at ? ` (${thaiDate(p.approved_at)})` : ''}`],
    ],
    columnStyles: { 0: { cellWidth: 40, fontStyle: 'bold' } },
  });

  y = table(doc, {
    startY: y + 6,
    head: [['งบประมาณ', 'จำนวนเงิน (บาท)']],
    body: [
      ['ค่าวิทยากร', money(data.budget.instructor)],
      ['ค่าสถานที่', money(data.budget.venue)],
      ['ค่าอาหารและเครื่องดื่ม', money(data.budget.food)],
      ['ค่าเอกสารและอุปกรณ์', money(data.budget.material)],
      ['อื่น ๆ', money(data.budget.other)],
      [{ content: 'รวมทั้งสิ้น', styles: { fontStyle: 'bold' } }, { content: money(data.budget.total), styles: { fontStyle: 'bold' } }],
    ],
    columnStyles: { 1: { halign: 'right', cellWidth: 45 } },
  });

  const evalTxt = data.evaluation.count
    ? `${data.evaluation.avg_score ?? '-'} / 5 (${data.evaluation.latest?.status === 'pass' ? 'ผ่าน' : data.evaluation.latest?.status === 'fail' ? 'ไม่ผ่าน' : '-'})`
    : 'ยังไม่มีผลประเมิน';
  y = table(doc, {
    startY: y + 6,
    head: [['ผลการดำเนินการ', '']],
    body: [
      ['ผู้เข้าอบรม (ลงทะเบียน/เข้าจริง)', `${data.participants.total} / ${data.participants.checked_in} คน (${data.participants.rate}%)`],
      ['จำนวนหัวข้อ / ชั่วโมงอบรม', `${data.schedule.topics.length} หัวข้อ / ${(data.schedule.total_minutes / 60).toFixed(1)} ชม.`],
      ['คะแนนประเมินเฉลี่ย', evalTxt],
      ['เลขที่ PR ที่ออก', data.prs.length ? data.prs.map((x) => x.pr_no).join(', ') : '-'],
      ['บันทึกประวัติเข้าแฟ้ม', data.records.count ? `${data.records.count} รายการ (${data.records.last_recorded_at})` : 'ยังไม่บันทึก'],
    ],
    columnStyles: { 0: { cellWidth: 62, fontStyle: 'bold' } },
  });

  if (data.participants.list.length) {
    y = table(doc, {
      startY: y + 6,
      head: [['ลำดับ', 'ชื่อ-นามสกุล', 'ฝ่าย/แผนก', 'ตำแหน่ง', 'เข้าอบรม']],
      body: data.participants.list.map((a, i) => [
        i + 1, a.name || '', a.department || '', a.position || '', a.checked_in ? '✓' : '✗',
      ]),
      columnStyles: { 0: { halign: 'center', cellWidth: 14 }, 4: { halign: 'center', cellWidth: 20 } },
    });
  }

  decorate(doc);
  doc.save(`Project-Summary-${p.req_no || p.id}.pdf`);
}
