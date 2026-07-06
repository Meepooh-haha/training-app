import { Router } from 'express';
import { fillRegistrationTemplate } from '../lib/renderRegistrationXlsx.js';

const router = Router();

// Every training day in the project range gets its own sheet (TZ-safe manual
// formatting — toISOString would shift the date west of UTC+0).
function enumerateDays(startIso, endIso) {
  if (!startIso) return [''];
  const start = new Date(`${startIso}T00:00:00`);
  if (Number.isNaN(start.getTime())) return [startIso];
  const end = endIso ? new Date(`${endIso}T00:00:00`) : start;
  const out = [];
  for (let d = start; d <= end && out.length < 31; d.setDate(d.getDate() + 1)) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  return out.length ? out : [startIso];
}

// Build the template data object from the registration record, its source
// project (sent as `request` — the project carries all ใบขอ fields), and course.
function buildData(reg, r, course) {
  return {
    course_name: course?.name_th || r?.course_code || '',
    days: enumerateDays(r?.training_date, r?.end_date),
    start_time: reg?.start_time || '09:00',
    end_time: reg?.end_time || '',
    location: r?.location || '',
    trainer_name: r?.trainer_name || '',
    attendees: (reg?.attendees || []).map((a) => ({
      employee_id: a.employee_code || a.employee_id || '',
      name: a.name || '',
      position: a.position || '',
    })),
  };
}

router.post('/registration/export-xlsx', async (req, res, next) => {
  try {
    const data = buildData(req.body.reg, req.body.request, req.body.course);
    const buf = await fillRegistrationTemplate(data);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="registration.xlsx"');
    res.send(buf);
  } catch (err) {
    next(err);
  }
});

export default router;
