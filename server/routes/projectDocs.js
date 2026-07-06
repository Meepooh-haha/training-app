import { Router } from 'express';
import { q } from '../db/db.js';
import { buildProposalDocData, fillProposalPack, fillScheduleDoc } from '../lib/renderProposalDocx.js';

const router = Router();
const h = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (e) { next(e); }
};

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

async function loadProject(id) {
  return q.get(
    `SELECT p.*, c.name_th AS course_name_th,
            (SELECT COUNT(*) FROM project_participants pp WHERE pp.project_id = p.id) AS participant_count
     FROM training_projects p
     LEFT JOIN courses c ON c.code = p.course_code
     WHERE p.id = ?`,
    [id],
  );
}

// Body = client-computed schedule payload: { time_label, days: [{ date, rows }] }.
// Time computation stays client-side (coursePlanUtils.computeSchedule).
function makeExportRoute(filler, filePrefix) {
  return h(async (req, res) => {
    const project = await loadProject(Number(req.params.id));
    if (!project) return res.status(404).json({ error: 'not found' });
    const buf = filler(buildProposalDocData(project, req.body));
    res.setHeader('Content-Type', DOCX_MIME);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filePrefix}-${project.req_no || project.id}.docx"`,
    );
    res.send(buf);
  });
}

router.post('/training-projects/:id([0-9]+)/export-proposal-docx', makeExportRoute(fillProposalPack, 'Training-Proposal'));
router.post('/training-projects/:id([0-9]+)/export-schedule-docx', makeExportRoute(fillScheduleDoc, 'Schedule'));

export default router;
