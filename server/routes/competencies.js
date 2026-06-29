import { Router } from 'express';
import db from '../db/db.js';

const router = Router();
const h = (fn) => (req, res, next) => {
  try { fn(req, res); } catch (e) { next(e); }
};

// ── Competency Dictionary ──────────────────────────────────────────

router.get('/competencies', h((req, res) => {
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
  const params = [];
  if (type) { sql += ' WHERE c.type = ?'; params.push(type); }
  sql += ' ORDER BY c.competency_code';
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(r => ({
    ...r,
    dept_codes: r.dept_codes ? r.dept_codes.split(',') : [],
    dept_ids: r.dept_ids ? r.dept_ids.split(',') : [],
    pos_codes: r.pos_codes ? r.pos_codes.split(',') : [],
    pos_ids: r.pos_ids ? r.pos_ids.split(',') : [],
  })));
}));

router.post('/competencies', h((req, res) => {
  const { competency_code, name, type, description, department_ids,
          position_ids, default_required_level,
          level_1_desc, level_2_desc, level_3_desc, level_4_desc, level_5_desc } = req.body;

  const id = db.transaction(() => {
    const { lastInsertRowid } = db.prepare(`
      INSERT INTO competencies
        (competency_code, name, type, description, max_level,
         level_1_desc, level_2_desc, level_3_desc, level_4_desc, level_5_desc)
      VALUES
        (@competency_code, @name, @type, @description, @max_level,
         @level_1_desc, @level_2_desc, @level_3_desc, @level_4_desc, @level_5_desc)
    `).run({
      competency_code, name, type,
      description: description || '',
      max_level: 3,
      level_1_desc: level_1_desc || '', level_2_desc: level_2_desc || '',
      level_3_desc: level_3_desc || '', level_4_desc: level_4_desc || '',
      level_5_desc: level_5_desc || '',
    });

    if (type === 'functional' && Array.isArray(department_ids) && department_ids.length) {
      const ins = db.prepare('INSERT OR IGNORE INTO competency_departments (competency_id, department_id) VALUES (?, ?)');
      department_ids.forEach(did => ins.run(lastInsertRowid, did));
    }

    if (type === 'functional' && Array.isArray(position_ids) && position_ids.length) {
      const level = Number(default_required_level) || 3;
      const ins = db.prepare('INSERT OR IGNORE INTO position_competency_profiles (position_id, competency_id, required_level) VALUES (?, ?, ?)');
      position_ids.forEach(pid => ins.run(pid, lastInsertRowid, level));
    }

    if (type === 'organizational' || type === 'leadership') {
      const allPositions = db.prepare('SELECT id FROM positions').all();
      const ins = db.prepare('INSERT OR IGNORE INTO position_competency_profiles (position_id, competency_id, required_level) VALUES (?, ?, 3)');
      allPositions.forEach(p => ins.run(p.id, lastInsertRowid));
    }

    return lastInsertRowid;
  })();

  res.json({ ok: true, id });
}));

router.put('/competencies/:id', h((req, res) => {
  const { name, type, description, department_ids,
          position_ids, default_required_level,
          level_1_desc, level_2_desc, level_3_desc, level_4_desc, level_5_desc } = req.body;

  db.transaction(() => {
    db.prepare(`
      UPDATE competencies SET
        name=@name, type=@type, description=@description, max_level=@max_level,
        level_1_desc=@level_1_desc, level_2_desc=@level_2_desc, level_3_desc=@level_3_desc,
        level_4_desc=@level_4_desc, level_5_desc=@level_5_desc, updated_at=CURRENT_TIMESTAMP
      WHERE id=@id
    `).run({
      name, type,
      description: description || '',
      max_level: 3,
      level_1_desc: level_1_desc || '', level_2_desc: level_2_desc || '',
      level_3_desc: level_3_desc || '', level_4_desc: level_4_desc || '',
      level_5_desc: level_5_desc || '',
      id: req.params.id,
    });

    db.prepare('DELETE FROM competency_departments WHERE competency_id = ?').run(req.params.id);
    if (type === 'functional' && Array.isArray(department_ids) && department_ids.length) {
      const ins = db.prepare('INSERT OR IGNORE INTO competency_departments (competency_id, department_id) VALUES (?, ?)');
      department_ids.forEach(did => ins.run(req.params.id, did));
    }

    const newPosIds = (Array.isArray(position_ids) ? position_ids : []).map(String);

    if (type === 'functional') {
      const allCurrentPosIds = db.prepare(
        'SELECT position_id FROM position_competency_profiles WHERE competency_id = ?'
      ).all(req.params.id).map(r => String(r.position_id));

      const toRemove = allCurrentPosIds.filter(pid => !newPosIds.includes(pid));
      if (toRemove.length) {
        const remPh = toRemove.map(() => '?').join(',');
        db.prepare(
          `DELETE FROM position_competency_profiles WHERE competency_id = ? AND position_id IN (${remPh})`
        ).run(req.params.id, ...toRemove);
      }

      const toAdd = newPosIds.filter(pid => !allCurrentPosIds.includes(pid));
      if (toAdd.length) {
        const level = Number(default_required_level) || 3;
        const ins = db.prepare('INSERT OR IGNORE INTO position_competency_profiles (position_id, competency_id, required_level) VALUES (?, ?, ?)');
        toAdd.forEach(pid => ins.run(pid, req.params.id, level));
      }
    } else if (type === 'organizational' || type === 'leadership') {
      db.prepare('DELETE FROM position_competency_profiles WHERE competency_id = ?').run(req.params.id);
      const allPositions = db.prepare('SELECT id FROM positions').all();
      const ins = db.prepare('INSERT OR IGNORE INTO position_competency_profiles (position_id, competency_id, required_level) VALUES (?, ?, 3)');
      allPositions.forEach(p => ins.run(p.id, req.params.id));
    }
  })();

  res.json({ ok: true });
}));

router.delete('/competencies/:id', h((req, res) => {
  db.prepare('DELETE FROM competencies WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
}));

// ── Competency Matrix ──────────────────────────────────────────────

router.get('/competency-matrix', h((req, res) => {
  const { department_id } = req.query;
  const posWhere = department_id ? 'WHERE p.department_id = ?' : '';
  const posParams = department_id ? [department_id] : [];

  const positions = db.prepare(`
    SELECT DISTINCT p.id, p.code, p.name, p.department_id, d.name AS department_name
    FROM positions p
    JOIN position_competency_profiles pcp ON p.id = pcp.position_id
    LEFT JOIN departments d ON p.department_id = d.id
    ${posWhere}
    ORDER BY d.name, p.code
  `).all(...posParams);

  if (!positions.length) return res.json({ positions: [], competencies: [], profiles: [] });

  const posIds = positions.map(p => p.id);
  const ph = posIds.map(() => '?').join(',');

  const competencies = db.prepare(`
    SELECT DISTINCT c.id, c.competency_code, c.name, c.type
    FROM competencies c
    JOIN position_competency_profiles pcp ON c.id = pcp.competency_id
    WHERE pcp.position_id IN (${ph})
    ORDER BY c.type, c.competency_code
  `).all(...posIds);

  const profiles = db.prepare(`
    SELECT position_id, competency_id, required_level
    FROM position_competency_profiles
    WHERE position_id IN (${ph})
  `).all(...posIds);

  res.json({ positions, competencies, profiles });
}));

// ── Position Competency Profile ────────────────────────────────────

router.get('/positions/:id/competencies', h((req, res) => {
  res.json(db.prepare(`
    SELECT pcp.id, pcp.competency_id, pcp.required_level,
           c.competency_code, c.name, c.type
    FROM position_competency_profiles pcp
    JOIN competencies c ON pcp.competency_id = c.id
    WHERE pcp.position_id = ?
    ORDER BY c.type, c.competency_code
  `).all(req.params.id));
}));

router.post('/positions/:id/competencies', h((req, res) => {
  const { competency_id, required_level } = req.body;
  try {
    db.prepare(`
      INSERT INTO position_competency_profiles (position_id, competency_id, required_level)
      VALUES (?, ?, ?)
    `).run(req.params.id, competency_id, required_level);
  } catch (e) {
    if (e.message.includes('UNIQUE')) throw Object.assign(new Error('Competency นี้มีอยู่แล้วในตำแหน่งนี้'), { status: 409 });
    throw e;
  }
  res.json({ ok: true });
}));

router.put('/positions/:id/competencies/:cid', h((req, res) => {
  const { required_level } = req.body;
  db.prepare(`
    UPDATE position_competency_profiles SET required_level=?
    WHERE position_id=? AND competency_id=?
  `).run(required_level, req.params.id, req.params.cid);
  res.json({ ok: true });
}));

router.delete('/positions/:id/competencies/:cid', h((req, res) => {
  db.prepare(`
    DELETE FROM position_competency_profiles WHERE position_id=? AND competency_id=?
  `).run(req.params.id, req.params.cid);
  res.json({ ok: true });
}));

// ── Employee Competency Scores ─────────────────────────────────────

router.get('/employees/:code/competency-scores', h((req, res) => {
  res.json(db.prepare(`
    SELECT ecs.*, c.competency_code, c.name, c.type
    FROM employee_competency_scores ecs
    JOIN competencies c ON ecs.competency_id = c.id
    WHERE ecs.employee_code = ?
  `).all(req.params.code));
}));

router.post('/employees/:code/competency-scores', h((req, res) => {
  const { competency_id, actual_level, assessor_type, assessed_date, notes } = req.body;
  db.prepare(`
    INSERT INTO employee_competency_scores
      (employee_code, competency_id, actual_level, assessor_type, assessed_date, notes)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(employee_code, competency_id) DO UPDATE SET
      actual_level=excluded.actual_level,
      assessor_type=excluded.assessor_type,
      assessed_date=excluded.assessed_date,
      notes=excluded.notes
  `).run(
    req.params.code, competency_id, actual_level,
    assessor_type || 'manager',
    assessed_date || new Date().toISOString().slice(0, 10),
    notes || ''
  );
  res.json({ ok: true });
}));

export default router;
