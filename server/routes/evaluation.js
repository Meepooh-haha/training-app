import { Router } from 'express';
import db, { q } from '../db/db.js';

const router = Router();
const h = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (e) { next(e); }
};

router.get('/evaluations', h(async (req, res) => {
  const { req_id } = req.query;
  const rows = req_id
    ? await q.all('SELECT * FROM training_evaluations WHERE req_id=? ORDER BY id DESC', [req_id])
    : await q.all('SELECT * FROM training_evaluations ORDER BY id DESC');
  res.json(rows);
}));

router.get('/evaluations/:id', h(async (req, res) => {
  const e = await q.get('SELECT * FROM training_evaluations WHERE id=?', [req.params.id]);
  if (!e) return res.status(404).json({ error: 'not found' });
  e.responses = await q.all('SELECT * FROM eval_responses WHERE eval_id=?', [e.id]);
  e.attachments = await q.all(
    'SELECT id,filename,uploaded_at FROM eval_attachments WHERE eval_id=?',
    [e.id],
  );
  res.json(e);
}));

async function computeScore(formCode, responses) {
  const weights = {};
  (await q.all('SELECT item_code,weight FROM eval_form_items WHERE form_code=?', [formCode]))
    .forEach((r) => (weights[r.item_code] = r.weight || 1));
  let sum = 0, wsum = 0;
  for (const r of responses) {
    const w = weights[r.item_code] ?? 1;
    if (r.score == null || r.score === '') continue;
    sum += Number(r.score) * w;
    wsum += w;
  }
  return wsum ? Math.round((sum / wsum) * 100) / 100 : 0;
}

async function saveEval(id, body) {
  const responses = body.responses || [];
  const total = await computeScore(body.eval_form_code, responses);
  const status = total >= 3 ? 'pass' : 'fail';
  const params = {
    req_id: body.req_id || null,
    eval_form_code: body.eval_form_code || '',
    evaluator_name: body.evaluator_name || '',
    eval_date: body.eval_date || new Date().toISOString().slice(0, 10),
    total_score: total,
    status,
  };

  const tx = await db.transaction('write');
  try {
    let evalId = id;
    if (evalId) {
      await tx.execute({
        sql: `UPDATE training_evaluations SET req_id=@req_id,eval_form_code=@eval_form_code,
                evaluator_name=@evaluator_name,eval_date=@eval_date,total_score=@total_score,status=@status
              WHERE id=@id`,
        args: { ...params, id: evalId },
      });
    } else {
      const r = await tx.execute({
        sql: `INSERT INTO training_evaluations (req_id,eval_form_code,evaluator_name,eval_date,total_score,status)
              VALUES (@req_id,@eval_form_code,@evaluator_name,@eval_date,@total_score,@status)
              RETURNING id`,
        args: params,
      });
      evalId = r.rows[0].id;
    }

    await tx.execute({ sql: 'DELETE FROM eval_responses WHERE eval_id=?', args: [evalId] });
    for (const x of responses) {
      await tx.execute({
        sql: 'INSERT INTO eval_responses (eval_id,item_code,score,comment) VALUES (?,?,?,?)',
        args: [evalId, x.item_code, x.score === '' || x.score == null ? null : Number(x.score), x.comment || ''],
      });
    }

    await tx.commit();
    return { id: evalId, total_score: total, status };
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

router.post('/evaluations', h(async (req, res) => {
  res.json({ ok: true, ...(await saveEval(null, req.body)) });
}));

router.put('/evaluations/:id', h(async (req, res) => {
  res.json({ ok: true, ...(await saveEval(Number(req.params.id), req.body)) });
}));

router.delete('/evaluations/:id', h(async (req, res) => {
  await q.run('DELETE FROM training_evaluations WHERE id=?', [req.params.id]);
  res.json({ ok: true });
}));

router.post('/evaluations/:id/attachments', h(async (req, res) => {
  const evalId = Number(req.params.id);
  const files = req.body.files || [];
  const now = new Date().toISOString();
  await db.batch(
    files.map((f) => ({
      sql: 'INSERT INTO eval_attachments (eval_id,filename,file_data,uploaded_at) VALUES (?,?,?,?)',
      args: [evalId, f.filename, f.data, now],
    })),
    'write',
  );
  res.json({ ok: true, count: files.length });
}));

router.get('/attachments/:attId', h(async (req, res) => {
  const a = await q.get('SELECT * FROM eval_attachments WHERE id=?', [req.params.attId]);
  if (!a) return res.status(404).json({ error: 'not found' });
  res.json(a);
}));

router.delete('/attachments/:attId', h(async (req, res) => {
  await q.run('DELETE FROM eval_attachments WHERE id=?', [req.params.attId]);
  res.json({ ok: true });
}));

export default router;
