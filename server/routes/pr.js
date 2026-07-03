import { Router } from 'express';
import { execFile } from 'child_process';
import { readFileSync, writeFileSync, unlinkSync, rmSync } from 'fs';
import { join, basename, dirname } from 'path';
import { tmpdir } from 'os';
import { promisify } from 'util';
import { fillPrTemplate } from '../lib/renderXlsx.js';

const execFileAsync = promisify(execFile);
const router = Router();

const SOFFICE = 'C:\\Program Files\\LibreOffice\\program\\soffice.exe';

router.post('/pr/export-xlsx', async (req, res, next) => {
  try {
    const buf = await fillPrTemplate(req.body);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="pr.xlsx"');
    res.send(buf);
  } catch (err) {
    next(err);
  }
});

router.post('/pr/export-pdf', async (req, res, next) => {
  const tmpDir = tmpdir();
  const tmpXlsx = join(tmpDir, `pr_${Date.now()}.xlsx`);
  const tmpPdf = join(dirname(tmpXlsx), basename(tmpXlsx, '.xlsx') + '.pdf');
  const profileId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const profileDirPath = join('C:\\tmp', `soffice_${profileId}`);
  const profileDirUrl = `file:///C:/tmp/soffice_${profileId}`;

  try {
    const buf = await fillPrTemplate(req.body);
    writeFileSync(tmpXlsx, buf);

    await execFileAsync(SOFFICE, [
      '--headless',
      '--convert-to', 'pdf',
      '--outdir', tmpDir,
      `-env:UserInstallation=${profileDirUrl}`,
      tmpXlsx,
    ], { timeout: 15000 });

    const pdf = readFileSync(tmpPdf);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="pr.pdf"');
    res.send(pdf);
  } catch (err) {
    next(err);
  } finally {
    try { unlinkSync(tmpXlsx); } catch {}
    try { unlinkSync(tmpPdf); } catch {}
    try { rmSync(profileDirPath, { recursive: true, force: true }); } catch {}
  }
});

export default router;
