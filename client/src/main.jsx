import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import './index.css';
import { ensureThaiFont } from './lib/thai-font.js';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Setup from './pages/Setup.jsx';
import CoursePlan from './pages/CoursePlan.jsx';
import TrainingRequest from './pages/TrainingRequest.jsx';
import PRForm from './pages/PRForm.jsx';
import MemoForm from './pages/MemoForm.jsx';
import Registration from './pages/Registration.jsx';
import Evaluation from './pages/Evaluation.jsx';
import GapAnalysisPage from './pages/Development/GapAnalysisPage.jsx';
import TrainingRoadmapPage from './pages/Development/TrainingRoadmapPage.jsx';
import CompetencyScoresPage from './pages/Development/CompetencyScoresPage.jsx';
import TrainingWorkflowPage from './pages/Development/TrainingWorkflowPage.jsx';
import WorkflowDetailPage from './pages/Development/WorkflowDetailPage.jsx';
import AvailabilityMatrixPage from './pages/Development/AvailabilityMatrixPage.jsx';
import VendorCheckPage from './pages/Development/VendorCheckPage.jsx';
import InvoiceIntakePage from './pages/Development/InvoiceIntakePage.jsx';
import PRIssuancePage from './pages/Development/PRIssuancePage.jsx';
import MemoIssuancePage from './pages/Development/MemoIssuancePage.jsx';

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
          <Route path="course-plan" element={<CoursePlan />} />
          <Route path="requests" element={<TrainingRequest />} />
          <Route path="pr-form" element={<PRForm />} />
          <Route path="memo-form" element={<MemoForm />} />
          <Route path="registration" element={<Registration />} />
          <Route path="evaluation" element={<Evaluation />} />
          <Route path="development/competency-scores" element={<CompetencyScoresPage />} />
          <Route path="development/gap-analysis" element={<GapAnalysisPage />} />
          <Route path="development/roadmap" element={<TrainingRoadmapPage />} />
          <Route path="development/workflow" element={<TrainingWorkflowPage />} />
          <Route path="development/workflow/:projectId" element={<WorkflowDetailPage />} />
          <Route path="development/availability" element={<AvailabilityMatrixPage />} />
          <Route path="development/vendor-check" element={<VendorCheckPage />} />
          <Route path="development/invoice-intake" element={<InvoiceIntakePage />} />
          <Route path="development/pr-issuance" element={<PRIssuancePage />} />
          <Route path="development/memo-issuance" element={<MemoIssuancePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
