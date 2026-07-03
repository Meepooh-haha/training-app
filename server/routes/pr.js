import { Router } from 'express';
import { execFile } from 'child_process';
import { readFileSync, writeFileSync, unlinkSync, rmSync } from 'fs';
import { join, basename, dirname } from 'path';
import { tmpdir } from 'os';
import { promisify } from 'util';
import { fillPrTemplate } from '../lib/renderXlsx.js';
import db, { q } from '../db/db.js';

const execFileAsync = promisify(execFile);
const router = Router();

const SOFFICE = 'C:\\Program Files\\LibreOffice\\program\\soffice.exe';

// Issues the next PR number for a department+type inside a single write
// transaction (SELECT MAX(seq) + INSERT is atomic under libSQL 'write' mode,
// same pattern as nextReqNo() in requests.js) so concurrent exports can never
// collide. The insert itself IS the audit row — pr_no is never handed out
// without a corresponding ledger entry.
async function issuePrNumber(department, prType, requester) {
  const dept = String(department || '').trim();
  if (!dept) throw Object.assign(new Error('department is required to issue a PR number'), { status: 400 });
  const type = Number(prType);
  if (type !== 1 && type !== 2) {
    throw Object.assign(new Error('pr_type must be 1 (จัดซื้อ) or 2 (จัดจ้าง)'), { status: 400 });
  }

  const tx = await db.transaction('write');
  try {
    const row = (await tx.execute({
      sql: 'SELECT MAX(seq) AS max_seq FROM purchase_requisitions WHERE department=? AND pr_type=?',
      args: [dept, type],
    })).rows[0];
    const seq = (row?.max_seq || 0) + 1;
    const pr_no = `${dept}${type}${String(seq).padStart(3, '0')}`;

    await tx.execute({
      sql: 'INSERT INTO purchase_requisitions (pr_no, department, pr_type, seq, requester) VALUES (?,?,?,?,?)',
      args: [pr_no, dept, type, seq, requester || ''],
    });
    await tx.commit();
    return pr_no;
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

// department is a short code (e.g. "HR") for the number prefix and ledger,
// but the printed form should show the full Thai department name.
async function resolveDepartmentName(code) {
  const row = await q.get('SELECT name FROM departments WHERE code=?', [code]);
  return row?.name || code;
}

router.post('/pr/export-xlsx', async (req, res, next) => {
  try {
    // pr_no is always server-assigned — any client-supplied value is ignored
    // so a typo or a bad AI-filled request can never collide with or skip
    // the locked sequence.
    const pr_no = await issuePrNumber(req.body.department, req.body.pr_type, req.body.requester);
    const department = await resolveDepartmentName(req.body.department);
    const buf = await fillPrTemplate({ ...req.body, pr_no, department });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('X-Pr-No', pr_no);
    res.setHeader('Content-Disposition', `attachment; filename="${pr_no}.xlsx"`);
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
    const pr_no = await issuePrNumber(req.body.department, req.body.pr_type, req.body.requester);
    const department = await resolveDepartmentName(req.body.department);
    const buf = await fillPrTemplate({ ...req.body, pr_no, department });
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
    res.setHeader('X-Pr-No', pr_no);
    res.setHeader('Content-Disposition', `attachment; filename="${pr_no}.pdf"`);
    res.send(pdf);
  } catch (err) {
    next(err);
  } finally {
    try { unlinkSync(tmpXlsx); } catch {}
    try { unlinkSync(tmpPdf); } catch {}
    try { rmSync(profileDirPath, { recursive: true, force: true }); } catch {}
  }
});

// Ledger, for reconciling issued numbers against files actually saved to Drive.
router.get('/pr/requisitions', async (req, res, next) => {
  try {
    res.json(await q.all('SELECT * FROM purchase_requisitions ORDER BY id DESC'));
  } catch (err) {
    next(err);
  }
});

// Marks a wrongly-issued number void. The number itself is never deleted or
// reissued — the next real export still continues from the next seq.
router.patch('/pr/requisitions/:pr_no/void', async (req, res, next) => {
  try {
    const reason = String(req.body?.reason || '').trim();
    if (!reason) throw Object.assign(new Error('reason is required to void a PR number'), { status: 400 });
    const result = await q.run(
      "UPDATE purchase_requisitions SET status='void', void_reason=?, voided_at=datetime('now') WHERE pr_no=? AND status='issued'",
      [reason, req.params.pr_no],
    );
    if (result.rowsAffected === 0) {
      throw Object.assign(new Error('PR number not found or already void'), { status: 404 });
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
