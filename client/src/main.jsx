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
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
