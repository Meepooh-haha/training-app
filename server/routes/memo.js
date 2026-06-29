import { Router } from 'express';
import { execFile } from 'child_process';
import { readFileSync, writeFileSync, unlinkSync, rmSync } from 'fs';
import { join, basename, dirname } from 'path';
import { tmpdir } from 'os';
import { promisify } from 'util';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const execFileAsync = promisify(execFile);
const router = Router();

const TEMPLATE_PATH = join(__dirname, '..', 'templates', 'memo_template.docx');
const SOFFICE = 'C:\\Program Files\\LibreOffice\\program\\soffice.exe';

router.post('/memo/export-pdf', async (req, res, next) => {
  const tmpDir = tmpdir();
  const tmpDocx = join(tmpDir, `memo_${Date.now()}.docx`);
  const tmpPdf = join(dirname(tmpDocx), basename(tmpDocx, '.docx') + '.pdf');
  const profileId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const profileDirPath = join('C:\\tmp', `soffice_${profileId}`);
  const profileDirUrl = `file:///C:/tmp/soffice_${profileId}`;

  try {
    const content = readFileSync(TEMPLATE_PATH, 'binary');
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

    doc.render(req.body);

    const buf = doc.getZip().generate({ type: 'nodebuffer' });
    writeFileSync(tmpDocx, buf);

    await execFileAsync(SOFFICE, [
      '--headless',
      '--convert-to', 'pdf',
      '--outdir', tmpDir,
      `-env:UserInstallation=${profileDirUrl}`,
      tmpDocx,
    ], { timeout: 15000 });

    const pdf = readFileSync(tmpPdf);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="memo.pdf"');
    res.send(pdf);
  } catch (err) {
    next(err);
  } finally {
    try { unlinkSync(tmpDocx); } catch {}
    try { unlinkSync(tmpPdf); } catch {}
    try { rmSync(profileDirPath, { recursive: true, force: true }); } catch {}
  }
});

router.post('/memo/export-docx', async (req, res, next) => {
  try {
    const content = readFileSync(TEMPLATE_PATH, 'binary');
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
    doc.render(req.body);
    const buf = doc.getZip().generate({ type: 'nodebuffer' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="memo.docx"');
    res.send(buf);
  } catch (err) {
    next(err);
  }
});

export default router;
