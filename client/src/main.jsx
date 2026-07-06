import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import './index.css';
import { ensureThaiFont } from './lib/thai-font.js';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Setup from './pages/Setup.jsx';
import GapAnalysisPage from './pages/Development/GapAnalysisPage.jsx';
import TrainingRoadmapPage from './pages/Development/TrainingRoadmapPage.jsx';
import CompetencyScoresPage from './pages/Development/CompetencyScoresPage.jsx';
import TrainingWorkflowPage from './pages/Development/TrainingWorkflowPage.jsx';
import ProjectShell from './pages/Development/ProjectShell.jsx';
import WorkflowDetailPage from './pages/Development/WorkflowDetailPage.jsx';
import AvailabilityMatrixPage from './pages/Development/AvailabilityMatrixPage.jsx';
import VendorCheckPage from './pages/Development/VendorCheckPage.jsx';
import InvoiceIntakePage from './pages/Development/InvoiceIntakePage.jsx';
import PRIssuancePage from './pages/Development/PRIssuancePage.jsx';
import MemoIssuancePage from './pages/Development/MemoIssuancePage.jsx';
import ParticipantsPage from './pages/Development/ParticipantsPage.jsx';
import RegistrationPage from './pages/Development/RegistrationPage.jsx';
import EvaluationPage from './pages/Development/EvaluationPage.jsx';
import SchedulePage from './pages/Development/SchedulePage.jsx';
import TrainingRecordsPage from './pages/Development/TrainingRecordsPage.jsx';
import SummaryReportPage from './pages/Development/SummaryReportPage.jsx';
import DSDExportPage from './pages/Development/DSDExportPage.jsx';

// Preload Thai font immediately so it's ready before any export button is clicked
ensureThaiFont();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ style: { fontFamily: 'Sarabun, sans-serif' } }} />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="setup" element={<Setup />} />
          <Route path="development/competency-scores" element={<CompetencyScoresPage />} />
          <Route path="development/gap-analysis" element={<GapAnalysisPage />} />
          <Route path="development/roadmap" element={<TrainingRoadmapPage />} />
          <Route path="development/workflow" element={<TrainingWorkflowPage />} />
          {/* ทุกหน้าเครื่องมืออยู่ใต้ร่มโครงการ — ProjectShell ใส่ header + แถบ phase ให้ */}
          <Route path="development/workflow/:projectId" element={<ProjectShell />}>
            <Route index element={<WorkflowDetailPage />} />
            <Route path="participants" element={<ParticipantsPage />} />
            <Route path="availability" element={<AvailabilityMatrixPage />} />
            <Route path="vendor-check" element={<VendorCheckPage />} />
            <Route path="invoice-intake" element={<InvoiceIntakePage />} />
            <Route path="pr-issuance" element={<PRIssuancePage />} />
            <Route path="memo-issuance" element={<MemoIssuancePage />} />
            <Route path="registration" element={<RegistrationPage />} />
            <Route path="schedule" element={<SchedulePage />} />
            <Route path="evaluation" element={<EvaluationPage />} />
            <Route path="records" element={<TrainingRecordsPage />} />
            <Route path="summary" element={<SummaryReportPage />} />
            <Route path="dsd" element={<DSDExportPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
