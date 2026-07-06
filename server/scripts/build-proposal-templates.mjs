// One-time template builder: turns the company's original proposal+schedule docx
// (server/templates/proposal_source.docx — "กำหนดการอบรม Sales Admin Chat (3).docx")
// into two docxtemplater templates:
//   server/templates/proposal_pack_template.docx  (page 1 Training Proposal + page 2 กำหนดการอบรม)
//   server/templates/schedule_template.docx       (กำหนดการอบรม only — for the future DSD bundle)
//
// Re-run with `node server/scripts/build-proposal-templates.mjs` if the company
// ever sends a new original. The script finds paragraphs by their sample text,
// so it will throw loudly (instead of silently mis-tagging) if the layout changed.
//
// Structural changes applied on purpose:
// - The schedule table is floating in the original (w:tblpPr anchored at a fixed
//   page Y). It is converted to an inline table so it can repeat once per
//   training day ({#days} loop) without every copy stacking on the same anchor.
// - Multi-day support: {#days} wraps [optional centered date line ({#show_date})
//   + the table]. Single-day fills render one iteration and look like the original.
// - Break rows (พักเที่ยง) keep the original centered/non-bold styling via a
//   {#is_break} conditional paragraph cloned from the original lunch row.

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import PizZip from 'pizzip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES = join(__dirname, '..', 'templates');
const SOURCE = join(TEMPLATES, 'proposal_source.docx');

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

// ---------- generic OOXML helpers ----------

function elChildren(node, name) {
  const out = [];
  for (let c = node.firstChild; c; c = c.nextSibling) {
    if (c.nodeType === 1 && c.nodeName === name) out.push(c);
  }
  return out;
}

function descendants(node, name) {
  return Array.from(node.getElementsByTagName(name));
}

function paraText(p) {
  return descendants(p, 'w:t').map((t) => t.textContent).join('');
}

function bodyOf(doc) {
  return doc.getElementsByTagName('w:body')[0];
}

function bodyParas(doc) {
  return elChildren(bodyOf(doc), 'w:p');
}

function findPara(doc, predicate, label) {
  const hit = bodyParas(doc).find((p) => predicate(paraText(p)));
  if (!hit) throw new Error(`landmark paragraph not found: ${label}`);
  return hit;
}

// runs of a paragraph that carry visible content (w:t or w:tab)
function contentRuns(p) {
  return elChildren(p, 'w:r').filter(
    (r) => descendants(r, 'w:t').length || descendants(r, 'w:tab').length
  );
}

function makeEl(doc, name) {
  return doc.createElementNS(W_NS, name);
}

function makeText(doc, text) {
  const t = makeEl(doc, 'w:t');
  t.setAttribute('xml:space', 'preserve');
  t.appendChild(doc.createTextNode(text));
  return t;
}

// Build a run: optional cloned rPr, then ordered pieces [{tab:true} | {text}]
function makeRun(doc, rPrSource, pieces) {
  const r = makeEl(doc, 'w:r');
  if (rPrSource) {
    const rPr = descendants(rPrSource, 'w:rPr')[0];
    if (rPr) r.appendChild(rPr.cloneNode(true));
  }
  for (const piece of pieces) {
    if (piece.tab) r.appendChild(makeEl(doc, 'w:tab'));
    else r.appendChild(makeText(doc, piece.text));
  }
  return r;
}

// Replace a label-value paragraph's value: keep the first `keep` content runs
// (the label), drop the rest, append a new run cloned from the first dropped run.
function replaceValueRuns(doc, p, keep, pieces, label) {
  const runs = contentRuns(p);
  if (runs.length <= keep) throw new Error(`expected >${keep} content runs on: ${label}`);
  const style = runs[keep]; // first dropped run defines the value formatting
  const newRun = makeRun(doc, style, pieces);
  p.insertBefore(newRun, runs[keep]);
  for (const r of runs.slice(keep)) p.removeChild(r);
}

// Set the whole visible text of a paragraph, keeping the first content run's style.
function setParaText(doc, p, text, label) {
  replaceValueRuns(doc, p, 0, [{ text }], label);
}

// A minimal paragraph holding only a docxtemplater tag (paragraphLoop removes it).
function tagOnlyPara(doc, tag) {
  const p = makeEl(doc, 'w:p');
  p.appendChild(makeRun(doc, null, [{ text: tag }]));
  return p;
}

function insertBefore(refNode, newNode) {
  refNode.parentNode.insertBefore(newNode, refNode);
}

function insertAfter(refNode, newNode) {
  refNode.parentNode.insertBefore(newNode, refNode.nextSibling);
}

// Wrap a node in loop/conditional tag paragraphs: {#tag} node {/tag}
function wrapNode(doc, node, tag) {
  insertBefore(node, tagOnlyPara(doc, `{#${tag}}`));
  insertAfter(node, tagOnlyPara(doc, `{/${tag}}`));
}

// Turn N consecutive sample list paragraphs into a single looped item paragraph.
function loopifyList(doc, paras, itemTag, loopTag) {
  const [first, ...rest] = paras;
  setParaText(doc, first, itemTag, loopTag);
  wrapNode(doc, first, loopTag);
  for (const p of rest) p.parentNode.removeChild(p);
}

// ---------- page-specific transforms ----------

function transformProposalPage(doc) {
  // Header label lines. keep = how many leading runs form the fixed label.
  const labelLines = [
    { find: (t) => t.startsWith('ชื่อหลักสูตร'), keep: 2, pieces: [{ text: ' {course_name}' }] },
    { find: (t) => t.startsWith('สถานที่อบรม'), keep: 2, pieces: [{ text: '{location}' }] }, // ':' run carries the tab
    { find: (t) => t.startsWith('วันที่จัดอบรม'), keep: 3, pieces: [{ text: '{date_label}' }] }, // run 2 is the tab run
    { find: (t) => t.startsWith('เวลาอบรม'), keep: 2, pieces: [{ tab: true }, { text: '{time_label}' }] },
    { find: (t) => t.startsWith('จำนวน'), keep: 2, pieces: [{ tab: true }, { tab: true }, { text: '{participant_count} คน' }] },
  ];
  for (const spec of labelLines) {
    const p = findPara(doc, spec.find, spec.pieces.map((x) => x.text || '\\t').join(''));
    replaceValueRuns(doc, p, spec.keep, spec.pieces, paraText(p).slice(0, 20));
  }

  // วัตถุประสงค์: the 4 sample numbered items share numId 3 → one looped item.
  const objectiveParas = bodyParas(doc).filter((p) =>
    descendants(p, 'w:numId').some((n) => n.getAttribute('w:val') === '3')
  );
  if (objectiveParas.length !== 4) throw new Error(`expected 4 objective paragraphs, got ${objectiveParas.length}`);
  loopifyList(doc, objectiveParas, '{.}', 'objectives');

  // กลุ่มเป้าหมาย: first item lives on the label line, items 2-6 are plain paragraphs.
  const targetHead = findPara(doc, (t) => t.startsWith('กลุ่มเป้าหมาย'), 'กลุ่มเป้าหมาย');
  replaceValueRuns(doc, targetHead, 2, [{ text: ': {targets_first}' }], 'กลุ่มเป้าหมาย');
  const targetItems = bodyParas(doc).filter((p) => /^[2-9]\.\s/.test(paraText(p).trim()));
  if (targetItems.length !== 5) throw new Error(`expected 5 target item paragraphs, got ${targetItems.length}`);
  loopifyList(doc, targetItems, '{.}', 'targets_rest');

  // การวัดผลความสำเร็จ: quantitative has 2 sample bullets, qualitative has 1.
  const quantParas = [
    findPara(doc, (t) => t.startsWith('DSD Pass Rate'), 'quant sample 1'),
    findPara(doc, (t) => t.startsWith('Practice Completion'), 'quant sample 2'),
  ];
  loopifyList(doc, quantParas, '{.}', 'quant_items');
  const qualParas = [findPara(doc, (t) => t.startsWith('Satisfaction Score'), 'qual sample')];
  loopifyList(doc, qualParas, '{.}', 'qual_items');

  // คาดการณ์งบประมาณ: 5 fixed lines, label + tab(s) + value in a single style.
  // NOTE: the อื่นๆ paragraph's pPr holds a sectPr (page-1 column layout) — only
  // its runs are replaced, never the paragraph itself.
  const budgetLines = [
    { label: 'ค่าวิทยากร:', tabs: 1, tag: '{budget_instructor}' },
    { label: 'ค่าสถานที่:', tabs: 1, tag: '{budget_venue}' },
    { label: 'ค่าอาหาร:', tabs: 1, tag: '{budget_food}' },
    { label: 'ค่าอุปกรณ์:', tabs: 1, tag: '{budget_material}' },
    { label: 'อื่นๆ:', tabs: 2, tag: '{budget_other}' },
  ];
  for (const { label, tabs, tag } of budgetLines) {
    const p = findPara(doc, (t) => t.startsWith(label), label);
    const runs = contentRuns(p);
    const pieces = [{ text: label }];
    for (let i = 0; i < tabs; i++) pieces.push({ tab: true });
    pieces.push({ text: tag });
    const newRun = makeRun(doc, runs[0], pieces);
    p.insertBefore(newRun, runs[0]);
    for (const r of runs) p.removeChild(r);
  }
}

function transformSchedulePage(doc) {
  // Header lines above the table.
  const coursePara = findPara(doc, (t) => t.startsWith('หลักสูตร '), 'หลักสูตร (page 2)');
  replaceValueRuns(doc, coursePara, 1, [{ text: '{course_name}' }], 'หลักสูตร (page 2)');
  const placePara = findPara(doc, (t) => t.startsWith('ณ '), 'ณ (page 2)');
  setParaText(doc, placePara, 'ณ {location}', 'ณ (page 2)');

  // The table: convert floating → inline, then reduce to header + one loop row.
  const tbl = descendants(doc, 'w:tbl')[0];
  if (!tbl) throw new Error('schedule table not found');
  const tblPr = elChildren(tbl, 'w:tblPr')[0];
  for (const anchor of descendants(tblPr, 'w:tblpPr')) anchor.parentNode.removeChild(anchor);

  const rows = elChildren(tbl, 'w:tr');
  if (rows.length !== 6) throw new Error(`expected 6 table rows, got ${rows.length}`);
  const [headerRow, sampleRow, , lunchRow] = rows;

  // Loop row — time cell: "{#rows}{time}"
  const cells = elChildren(sampleRow, 'w:tc');
  if (cells.length !== 2) throw new Error('expected 2 cells in sample row');
  const timePara = elChildren(cells[0], 'w:p')[0];
  setParaText(doc, timePara, '{#rows}{time}', 'time cell');

  // Topic cell: conditional regular block (bold topic + bullet subtopics) or
  // centered break line, then the row-loop closer.
  const topicCell = cells[1];
  const topicParas = elChildren(topicCell, 'w:p');
  const topicPara = topicParas[0]; // bold heading
  const bulletPara = topicParas[1]; // first bullet — becomes the {#subtopics} item
  setParaText(doc, topicPara, '{topic_name}', 'topic heading');
  setParaText(doc, bulletPara, '{.}', 'subtopic bullet');
  for (const p of topicParas.slice(2)) topicCell.removeChild(p); // extra sample bullets

  // Break-row paragraph: clone the original lunch row's centered cell paragraph
  // so พักเที่ยง keeps its exact original styling.
  const lunchCellPara = elChildren(elChildren(lunchRow, 'w:tc')[1], 'w:p')[0];
  const breakPara = lunchCellPara.cloneNode(true);
  setParaText(doc, breakPara, '{topic_name}', 'break line');

  wrapNode(doc, topicPara, 'reg');
  wrapNode(doc, bulletPara, 'subtopics');
  const breakOpen = tagOnlyPara(doc, '{#is_break}');
  const breakClose = tagOnlyPara(doc, '{/is_break}');
  topicCell.appendChild(breakOpen);
  topicCell.appendChild(breakPara);
  topicCell.appendChild(breakClose);
  topicCell.appendChild(tagOnlyPara(doc, '{/rows}'));

  // Drop the remaining sample rows (2nd topic, lunch, afternoon topics).
  for (const r of rows.slice(2)) tbl.removeChild(r);
}

function transformScheduleFooterAndDays(doc) {
  const tbl = descendants(doc, 'w:tbl')[0];

  // {#days} [ {#show_date} date line {/show_date} table ] {/days}
  const datePara = makeEl(doc, 'w:p');
  {
    const pPr = makeEl(doc, 'w:pPr');
    const spacing = makeEl(doc, 'w:spacing');
    spacing.setAttribute('w:before', '240');
    spacing.setAttribute('w:after', '60');
    spacing.setAttribute('w:line', '240');
    spacing.setAttribute('w:lineRule', 'auto');
    const jc = makeEl(doc, 'w:jc');
    jc.setAttribute('w:val', 'center');
    pPr.appendChild(spacing);
    pPr.appendChild(jc);
    datePara.appendChild(pPr);
    const r = makeEl(doc, 'w:r');
    const rPr = makeEl(doc, 'w:rPr');
    const fonts = makeEl(doc, 'w:rFonts');
    for (const attr of ['w:ascii', 'w:cs', 'w:eastAsia', 'w:hAnsi']) fonts.setAttribute(attr, 'Prompt');
    const b = makeEl(doc, 'w:b'); b.setAttribute('w:val', '1');
    const bCs = makeEl(doc, 'w:bCs'); bCs.setAttribute('w:val', '1');
    const sz = makeEl(doc, 'w:sz'); sz.setAttribute('w:val', '24');
    const szCs = makeEl(doc, 'w:szCs'); szCs.setAttribute('w:val', '24');
    rPr.appendChild(fonts); rPr.appendChild(b); rPr.appendChild(bCs); rPr.appendChild(sz); rPr.appendChild(szCs);
    r.appendChild(rPr);
    r.appendChild(makeText(doc, '{day_date_label}'));
    datePara.appendChild(r);
  }

  insertBefore(tbl, tagOnlyPara(doc, '{#days}'));
  insertBefore(tbl, tagOnlyPara(doc, '{#show_date}'));
  insertBefore(tbl, datePara);
  insertBefore(tbl, tagOnlyPara(doc, '{/show_date}'));
  insertAfter(tbl, tagOnlyPara(doc, '{/days}'));

  // Footer lines — hidden entirely when the project has no trainer/date.
  const trainerPara = findPara(doc, (t) => t.startsWith('วิทยากร:'), 'วิทยากร footer');
  setParaText(doc, trainerPara, '{trainer_line}', 'วิทยากร footer');
  wrapNode(doc, trainerPara, 'has_trainer');
  const footerDatePara = findPara(doc, (t) => t.startsWith('วันที่ '), 'วันที่ footer');
  setParaText(doc, footerDatePara, '{footer_line}', 'วันที่ footer');
  wrapNode(doc, footerDatePara, 'has_footer');
}

// Remove everything before the schedule page (title page-break paragraph included).
function stripProposalPage(doc) {
  const body = bodyOf(doc);
  const breakPara = bodyParas(doc).find((p) =>
    descendants(p, 'w:br').some((b) => b.getAttribute('w:type') === 'page')
  );
  if (!breakPara) throw new Error('page-break paragraph not found');
  while (body.firstChild && body.firstChild !== breakPara) body.removeChild(body.firstChild);
  body.removeChild(breakPara);
}

// ---------- build ----------

function build({ scheduleOnly }) {
  const zip = new PizZip(readFileSync(SOURCE));
  const xml = zip.file('word/document.xml').asText();
  const doc = new DOMParser().parseFromString(xml, 'application/xml');

  if (scheduleOnly) stripProposalPage(doc);
  else transformProposalPage(doc);
  transformSchedulePage(doc);
  transformScheduleFooterAndDays(doc);

  zip.file('word/document.xml', new XMLSerializer().serializeToString(doc));
  return zip.generate({ type: 'nodebuffer' });
}

writeFileSync(join(TEMPLATES, 'proposal_pack_template.docx'), build({ scheduleOnly: false }));
console.log('wrote proposal_pack_template.docx');
writeFileSync(join(TEMPLATES, 'schedule_template.docx'), build({ scheduleOnly: true }));
console.log('wrote schedule_template.docx');
