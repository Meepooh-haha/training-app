import { Router } from 'express';
import db from '../db/db.js';

const router = Router();
const h = (fn) => (req, res, next) => {
  try {
    fn(req, res);
  } catch (e) {
    next(e);
  }
};

// List evaluations (optionally by request).
router.get('/evaluations', h((req, res) => {
  const { req_id } = req.query;
  const rows = req_id
    ? db.prepare('SELECT * FROM training_evaluations WHERE req_id=? ORDER BY id DESC').all(req_id)
    : db.prepare('SELECT * FROM training_evaluations ORDER BY id DESC').all();
  res.json(rows);
}));

router.get('/evaluations/:id', h((req, res) => {
  const e = db.prepare('SELECT * FROM training_evaluations WHERE id=?').get(req.params.id);
  if (!e) return res.status(404).json({ error: 'not found' });
  e.responses = db.prepare('SELECT * FROM eval_responses WHERE eval_id=?').all(e.id);
  // Attachment metadata only (omit file_data blob to keep the payload light).
  e.attachments = db
    .prepare('SELECT id,filename,uploaded_at FROM eval_attachments WHERE eval_id=?')
    .all(e.id);
  res.json(e);
}));

// Compute weighted average across responses using the form's item weights.
function computeScore(formCode, responses) {
  const weights = {};
  db.prepare('SELECT item_code,weight FROM eval_form_items WHERE form_code=?')
    .all(formCode)
    .forEach((r) => (weights[r.item_code] = r.weight || 1));
  let sum = 0;
  let wsum = 0;
  for (const r of responses) {
    const w = weights[r.item_code] ?? 1;
    if (r.score == null || r.score === '') continue;
    sum += Number(r.score) * w;
    wsum += w;
  }
  return wsum ? Math.round((sum / wsum) * 100) / 100 : 0;
}

const saveEval = db.transaction((id, body) => {
  const responses = body.responses || [];
  const total = computeScore(body.eval_form_code, responses);
  const status = total >= 3 ? 'pass' : 'fail'; // 3/5 threshold
  const params = {
    req_id: body.req_id || null,
    eval_form_code: body.eval_form_code || '',
    evaluator_name: body.evaluator_name || '',
    eval_date: body.eval_date || new Date().toISOString().slice(0, 10),
    total_score: total,
    status,
  };

  let evalId = id;
  if (evalId) {
    db.prepare(
      `UPDATE training_evaluations SET req_id=@req_id,eval_form_code=@eval_form_code,
        evaluator_name=@evaluator_name,eval_date=@eval_date,total_score=@total_score,status=@status
       WHERE id=@id`
    ).run({ ...params, id: evalId });
  } else {
    evalId = db
      .prepare(
        `INSERT INTO training_evaluations (req_id,eval_form_code,evaluator_name,eval_date,total_score,status)
         VALUES (@req_id,@eval_form_code,@evaluator_name,@eval_date,@total_score,@status)`
      )
      .run(params).lastInsertRowid;
  }

  db.prepare('DELETE FROM eval_responses WHERE eval_id=?').run(evalId);
  const r = db.prepare('INSERT INTO eval_responses (eval_id,item_code,score,comment) VALUES (?,?,?,?)');
  responses.forEach((x) =>
    r.run(evalId, x.item_code, x.score === '' || x.score == null ? null : Number(x.score), x.comment || '')
  );

  return { id: evalId, total_score: total, status };
});

router.post('/evaluations', h((req, res) => {
  res.json({ ok: true, ...saveEval(null, req.body) });
}));
router.put('/evaluations/:id', h((req, res) => {
  res.json({ ok: true, ...saveEval(Number(req.params.id), req.body) });
}));
router.delete('/evaluations/:id', h((req, res) => {
  db.prepare('DELETE FROM training_evaluations WHERE id=?').run(req.params.id);
  res.json({ ok: true });
}));

// ---------------- Attachments (stored as base64 data URLs) ----------------
router.post('/evaluations/:id/attachments', h((req, res) => {
  const evalId = Number(req.params.id);
  const files = req.body.files || []; // [{ filename, data }]
  const stmt = db.prepare(
    'INSERT INTO eval_attachments (eval_id,filename,file_data,uploaded_at) VALUES (?,?,?,?)'
  );
  const now = new Date().toISOString();
  const insert = db.transaction(() => files.forEach((f) => stmt.run(evalId, f.filename, f.data, now)));
  insert();
  res.json({ ok: true, count: files.length });
}));

router.get('/attachments/:attId', h((req, res) => {
  const a = db.prepare('SELECT * FROM eval_attachments WHERE id=?').get(req.params.attId);
  if (!a) return res.status(404).json({ error: 'not found' });
  res.json(a); // includes file_data data URL for client download
}));

router.delete('/attachments/:attId', h((req, res) => {
  db.prepare('DELETE FROM eval_attachments WHERE id=?').run(req.params.attId);
  res.json({ ok: true });
}));

export default router;
