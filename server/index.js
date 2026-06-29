import express from 'express';
import cors from 'cors';
import './db/db.js'; // initialises DB + seeds on import
import topicsRoutes from './routes/topics.js';
import coursesRoutes from './routes/courses.js';
import evalItemsRoutes from './routes/evalItems.js';
import evalFormsRoutes from './routes/evalForms.js';
import planRoutes from './routes/plans.js';
import requestsRoutes from './routes/requests.js';
import registrationsRoutes from './routes/registrations.js';
import dashboardRoutes from './routes/dashboard.js';
import evaluationRoutes from './routes/evaluation.js';
import employeesRoutes from './routes/employees.js';
import departmentsRoutes from './routes/departments.js';
import positionsRoutes from './routes/positions.js';
import competenciesRoutes from './routes/competencies.js';
import developmentRoutes from './routes/development.js';
import memoRoutes from './routes/memo.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' })); // headroom for base64 attachments

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api', topicsRoutes);
app.use('/api', coursesRoutes);
app.use('/api', evalItemsRoutes);
app.use('/api', evalFormsRoutes);
app.use('/api', planRoutes);
app.use('/api', requestsRoutes);
app.use('/api', registrationsRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', evaluationRoutes);
app.use('/api', employeesRoutes);
app.use('/api', departmentsRoutes);
app.use('/api', positionsRoutes);
app.use('/api', competenciesRoutes);
app.use('/api', developmentRoutes);
app.use('/api', memoRoutes);

// Centralised error handler so route handlers can just throw.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`[server] http://localhost:${PORT}`));
