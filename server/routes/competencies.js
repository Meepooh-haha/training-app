import { Router } from 'express';
import db, { q } from '../db/db.js';

const router = Router();
const h = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (e) { next(e); }
};

// ── Competency Dictionary ──────────────────────────────────────────

router.get('/competencies', h(async (req, res) => {
  const { type } = req.query;
  let sql = `
    SELECT c.*,
      (SELECT GROUP_CONCAT(d.code, ',')
       FROM competency_departments cd JOIN departments d ON cd.department_id = d.id
       WHERE cd.competency_id = c.id) AS dept_codes,
      (SELECT GROUP_CONCAT(cd.department_id, ',')
       FROM competency_departments cd
       WHERE cd.competency_id = c.id) AS dept_ids,
      (SELECT GROUP_CONCAT(p.code, ',')
       FROM position_competency_profiles pcp JOIN positions p ON pcp.position_id = p.id
       WHERE pcp.competency_id = c.id) AS pos_codes,
      (SELECT GROUP_CONCAT(pcp.position_id, ',')
       FROM position_competency_profiles pcp
       WHERE pcp.competency_id = c.id) AS pos_ids
    FROM competencies c
  `;
  const args = [];
  if (type) { sql += ' WHERE c.type = ?'; args.push(type); }
  sql += ' ORDER BY c.competency_code';
  const rows = await q.all(sql, args);
  res.json(rows.map((r) => ({
    ...r,
    dept_codes: r.dept_codes ? String(r.dept_codes).split(',') : [],
    dept_ids: r.dept_ids ? String(r.dept_ids).split(',') : [],
    pos_codes: r.pos_codes ? String(r.pos_codes).split(',') : [],
    pos_ids: r.pos_ids ? String(r.pos_ids).split(',') : [],
  })));
}));

router.post('/competencies', h(async (req, res) => {
  const { competency_code, name, type, description, department_ids,
          position_ids, default_required_level,
          level_1_desc, level_2_desc, level_3_desc, level_4_desc, level_5_desc } = req.body;

  const tx = await db.transaction('write');
  try {
    const r = await tx.execute({
      sql: `INSERT INTO competencies
              (competency_code,name,type,description,max_level,
               level_1_desc,level_2_desc,level_3_desc,level_4_desc,level_5_desc)
            VALUES
              (@competency_code,@name,@type,@description,@max_level,
               @level_1_desc,@level_2_desc,@level_3_desc,@level_4_desc,@level_5_desc)
            RETURNING id`,
      args: {
        competency_code, name, type,
        description: description || '',
        max_level: 3,
        level_1_desc: level_1_desc || '', level_2_desc: level_2_desc || '',
        level_3_desc: level_3_desc || '', level_4_desc: level_4_desc || '',
        level_5_desc: level_5_desc || '',
      },
    });
    const id = r.rows[0].id;

    if (type === 'functional' && Array.isArray(department_ids) && department_ids.length) {
      for (const did of department_ids) {
        await tx.execute({
          sql: 'INSERT OR IGNORE INTO competency_departments (competency_id, department_id) VALUES (?, ?)',
          args: [id, did],
        });
      }
    }

    if (type === 'functional' && Array.isArray(position_ids) && position_ids.length) {
      const level = Number(default_required_level) || 3;
      for (const pid of position_ids) {
        await tx.execute({
          sql: 'INSERT OR IGNORE INTO position_competency_profiles (position_id, competency_id, required_level) VALUES (?, ?, ?)',
          args: [pid, id, level],
        });
      }
    }

    if (type === 'organizational' || type === 'leadership') {
      const allPositions = (await tx.execute('SELECT id FROM positions')).rows;
      for (const p of allPositions) {
        await tx.execute({
          sql: 'INSERT OR IGNORE INTO position_competency_profiles (position_id, competency_id, required_level) VALUES (?, ?, 3)',
          args: [p.id, id],
        });
      }
    }

    await tx.commit();
    res.json({ ok: true, id });
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}));

router.put('/competencies/:id', h(async (req, res) => {
  const { name, type, description, department_ids,
          position_ids, default_required_level,
          level_1_desc, level_2_desc, level_3_desc, level_4_desc, level_5_desc } = req.body;
  const cid = req.params.id;

  const tx = await db.transaction('write');
  try {
    await tx.execute({
      sql: `UPDATE competencies SET
              name=@name,type=@type,description=@description,max_level=@max_level,
              level_1_desc=@level_1_desc,level_2_desc=@level_2_desc,level_3_desc=@level_3_desc,
              level_4_desc=@level_4_desc,level_5_desc=@level_5_desc,updated_at=CURRENT_TIMESTAMP
            WHERE id=@id`,
      args: {
        name, type,
        description: description || '',
        max_level: 3,
        level_1_desc: level_1_desc || '', level_2_desc: level_2_desc || '',
        level_3_desc: level_3_desc || '', level_4_desc: level_4_desc || '',
        level_5_desc: level_5_desc || '',
        id: cid,
      },
    });

    await tx.execute({ sql: 'DELETE FROM competency_departments WHERE competency_id = ?', args: [cid] });
    if (type === 'functional' && Array.isArray(department_ids) && department_ids.length) {
      for (const did of department_ids) {
        await tx.execute({
          sql: 'INSERT OR IGNORE INTO competency_departments (competency_id, department_id) VALUES (?, ?)',
          args: [cid, did],
        });
      }
    }

    const newPosIds = (Array.isArray(position_ids) ? position_ids : []).map(String);

    if (type === 'functional') {
      const allCurrentPosIds = (await tx.execute({
        sql: 'SELECT position_id FROM position_competency_profiles WHERE competency_id = ?',
        args: [cid],
      })).rows.map((r) => String(r.position_id));

      const toRemove = allCurrentPosIds.filter((pid) => !newPosIds.includes(pid));
      if (toRemove.length) {
        const ph = toRemove.map(() => '?').join(',');
        await tx.execute({
          sql: `DELETE FROM position_competency_profiles WHERE competency_id = ? AND position_id IN (${ph})`,
          args: [cid, ...toRemove],
        });
      }

      const toAdd = newPosIds.filter((pid) => !allCurrentPosIds.includes(pid));
      const level = Number(default_required_level) || 3;
      for (const pid of toAdd) {
        await tx.execute({
          sql: 'INSERT OR IGNORE INTO position_competency_profiles (position_id, competency_id, required_level) VALUES (?, ?, ?)',
          args: [pid, cid, level],
        });
      }
    } else if (type === 'organizational' || type === 'leadership') {
      await tx.execute({ sql: 'DELETE FROM position_competency_profiles WHERE competency_id = ?', args: [cid] });
      const allPositions = (await tx.execute('SELECT id FROM positions')).rows;
      for (const p of allPositions) {
        await tx.execute({
          sql: 'INSERT OR IGNORE INTO position_competency_profiles (position_id, competency_id, required_level) VALUES (?, ?, 3)',
          args: [p.id, cid],
        });
      }
    }

    await tx.commit();
    res.json({ ok: true });
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}));

router.delete('/competencies/:id', h(async (req, res) => {
  await q.run('DELETE FROM competencies WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));

// ── Competency Matrix ──────────────────────────────────────────────

router.get('/competency-matrix', h(async (req, res) => {
  const { department_id } = req.query;
  const posWhere = department_id ? 'WHERE p.department_id = ?' : '';
  const posArgs = department_id ? [department_id] : [];

  const positions = await q.all(
    `SELECT DISTINCT p.id, p.code, p.name, p.department_id, d.name AS department_name
     FROM positions p
     JOIN position_competency_profiles pcp ON p.id = pcp.position_id
     LEFT JOIN departments d ON p.department_id = d.id
     ${posWhere}
     ORDER BY d.name, p.code`,
    posArgs,
  );

  if (!positions.length) return res.json({ positions: [], competencies: [], profiles: [] });

  const posIds = positions.map((p) => p.id);
  const ph = posIds.map(() => '?').join(',');

  const [competencies, profiles] = await Promise.all([
    q.all(
      `SELECT DISTINCT c.id, c.competency_code, c.name, c.type
       FROM competencies c
       JOIN position_competency_profiles pcp ON c.id = pcp.competency_id
       WHERE pcp.position_id IN (${ph})
       ORDER BY c.type, c.competency_code`,
      posIds,
    ),
    q.all(
      `SELECT position_id, competency_id, required_level
       FROM position_competency_profiles
       WHERE position_id IN (${ph})`,
      posIds,
    ),
  ]);

  res.json({ positions, competencies, profiles });
}));

// ── Position Competency Profile ────────────────────────────────────

router.get('/positions/:id/competencies', h(async (req, res) => {
  res.json(await q.all(
    `SELECT pcp.id, pcp.competency_id, pcp.required_level,
            c.competency_code, c.name, c.type
     FROM position_competency_profiles pcp
     JOIN competencies c ON pcp.competency_id = c.id
     WHERE pcp.position_id = ?
     ORDER BY c.type, c.competency_code`,
    [req.params.id],
  ));
}));

router.post('/positions/:id/competencies', h(async (req, res) => {
  const { competency_id, required_level } = req.body;
  try {
    await q.run(
      'INSERT INTO position_competency_profiles (position_id, competency_id, required_level) VALUES (?, ?, ?)',
      [req.params.id, competency_id, required_level],
    );
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) {
      throw Object.assign(new Error('Competency นี้มีอยู่แล้วในตำแหน่งนี้'), { status: 409 });
    }
    throw e;
  }
  res.json({ ok: true });
}));

router.put('/positions/:id/competencies/:cid', h(async (req, res) => {
  await q.run(
    'UPDATE position_competency_profiles SET required_level=? WHERE position_id=? AND competency_id=?',
    [req.body.required_level, req.params.id, req.params.cid],
  );
  res.json({ ok: true });
}));

router.delete('/positions/:id/competencies/:cid', h(async (req, res) => {
  await q.run(
    'DELETE FROM position_competency_profiles WHERE position_id=? AND competency_id=?',
    [req.params.id, req.params.cid],
  );
  res.json({ ok: true });
}));

// ── Employee Competency Scores ─────────────────────────────────────

router.get('/employees/:code/competency-scores', h(async (req, res) => {
  res.json(await q.all(
    `SELECT ecs.*, c.competency_code, c.name, c.type
     FROM employee_competency_scores ecs
     JOIN competencies c ON ecs.competency_id = c.id
     WHERE ecs.employee_code = ?`,
    [req.params.code],
  ));
}));

router.post('/employees/:code/competency-scores', h(async (req, res) => {
  const { competency_id, actual_level, assessor_type, assessed_date, notes } = req.body;
  await q.run(
    `INSERT INTO employee_competency_scores
       (employee_code, competency_id, actual_level, assessor_type, assessed_date, notes)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(employee_code, competency_id) DO UPDATE SET
       actual_level=excluded.actual_level,
       assessor_type=excluded.assessor_type,
       assessed_date=excluded.assessed_date,
       notes=excluded.notes`,
    [req.params.code, competency_id, actual_level,
     assessor_type || 'manager',
     assessed_date || new Date().toISOString().slice(0, 10),
     notes || ''],
  );
  res.json({ ok: true });
}));

export default router;
