import { Router } from 'express';
import { fillPrTemplate } from '../lib/renderXlsx.js';
import db, { q } from '../db/db.js';

const router = Router();

// Issues the next PR number for a department+type inside a single write
// transaction (SELECT MAX(seq) + INSERT is atomic under libSQL 'write' mode,
// same pattern as nextReqNo() in requests.js) so concurrent exports can never
// collide. The insert itself IS the audit row — pr_no is never handed out
// without a corresponding ledger entry.
async function issuePrNumber(department, prType, requester, projectId) {
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
      sql: 'INSERT INTO purchase_requisitions (pr_no, department, pr_type, seq, requester, project_id) VALUES (?,?,?,?,?,?)',
      args: [pr_no, dept, type, seq, requester || '', projectId ? Number(projectId) : null],
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
    const pr_no = await issuePrNumber(req.body.department, req.body.pr_type, req.body.requester, req.body.project_id);
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
