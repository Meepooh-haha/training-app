import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { initDb } from './db/db.js';
import topicsRoutes from './routes/topics.js';
import coursesRoutes from './routes/courses.js';
import evalItemsRoutes from './routes/evalItems.js';
import evalFormsRoutes from './routes/evalForms.js';
import planRoutes from './routes/plans.js';
import registrationsRoutes from './routes/registrations.js';
import dashboardRoutes from './routes/dashboard.js';
import evaluationRoutes from './routes/evaluation.js';
import employeesRoutes from './routes/employees.js';
import departmentsRoutes from './routes/departments.js';
import positionsRoutes from './routes/positions.js';
import competenciesRoutes from './routes/competencies.js';
import developmentRoutes from './routes/development.js';
import memoRoutes from './routes/memo.js';
import prRoutes from './routes/pr.js';
import trainingProjectsRoutes from './routes/training-projects.js';
import availabilityRoutes from './routes/availability.js';
import vendorsRoutes from './routes/vendors.js';
import registrationExportRoutes from './routes/registration.js';
import projectDocsRoutes from './routes/projectDocs.js';
import invoicesRoutes from './routes/invoices.js';
import dsdRoutes from './routes/dsd.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api', topicsRoutes);
app.use('/api', coursesRoutes);
app.use('/api', evalItemsRoutes);
app.use('/api', evalFormsRoutes);
app.use('/api', planRoutes);
app.use('/api', registrationsRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', evaluationRoutes);
app.use('/api', employeesRoutes);
app.use('/api', departmentsRoutes);
app.use('/api', positionsRoutes);
app.use('/api', competenciesRoutes);
app.use('/api', developmentRoutes);
app.use('/api', memoRoutes);
app.use('/api', prRoutes);
app.use('/api', trainingProjectsRoutes);
app.use('/api', availabilityRoutes);
app.use('/api', vendorsRoutes);
app.use('/api', registrationExportRoutes);
app.use('/api', projectDocsRoutes);
app.use('/api', dsdRoutes);
app.use('/api/invoices', invoicesRoutes);

const clientDist = join(__dirname, '../client/dist');
const indexHtml = join(clientDist, 'index.html');
if (existsSync(indexHtml)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(indexHtml));
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal error' });
});

await initDb();

const PORT = process.env.PORT || 3001;
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => console.log(`[server] http://localhost:${PORT}`));
}

export default app;
