import { Router } from 'express';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = Router();

const TEMPLATE_PATH = join(__dirname, '..', 'templates', 'memo_template.docx');

function normalizeDetails(details) {
  if (!details) return details;
  return details
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('-')) {
        return '- ' + trimmed.replace(/^-+\s*/, '');
      }
      return trimmed;
    })
    .join('\n');
}

function normalizeBody(body) {
  if (!body?.budget_items) return body;
  return {
    ...body,
    budget_items: body.budget_items.map((it) => ({
      ...it,
      details: normalizeDetails(it.details),
    })),
  };
}

router.post('/memo/export-docx', async (req, res, next) => {
  try {
    const content = readFileSync(TEMPLATE_PATH, 'binary');
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
    doc.render(normalizeBody(req.body));
    const buf = doc.getZip().generate({ type: 'nodebuffer' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="memo.docx"');
    res.send(buf);
  } catch (err) {
    next(err);
  }
});

export default router;
