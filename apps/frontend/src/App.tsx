import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ResetPassword from './pages/auth/ResetPassword';
import OtpVerification from './pages/auth/OtpVerification';
import NewPassword from './pages/auth/NewPassword';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import TeamManagement from './pages/team/TeamManagement';
import WorkflowDashboard from './pages/workflows/WorkflowDashboard';
import WorkflowBuilder from './pages/workflows/WorkflowBuilder';
import AssistantDashboard from './pages/ai/AssistantDashboard';
import SettingsPage from './pages/settings/SettingsPage';
import AnalyticsDashboard from './pages/analytics/AnalyticsDashboard';
import AuditComplianceDashboard from './pages/audit/AuditComplianceDashboard';
import DocumentManager from './pages/documents/DocumentManager';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public auth routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Legacy token-link reset (kept for any outstanding reset emails) */}
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* New OTP-based reset flow */}
        <Route path="/verify-otp" element={<OtpVerification />} />
        <Route path="/reset-password-new" element={<NewPassword />} />

        {/* Protected Dashboard Routes */}
        <Route path="/" element={<DashboardLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="assistant" element={<AssistantDashboard />} />
          <Route path="workflows" element={<WorkflowDashboard />} />
          <Route path="workflows/:id/edit" element={<WorkflowBuilder />} />
          <Route path="analytics" element={<AnalyticsDashboard />} />
          <Route path="team" element={<TeamManagement />} />
          <Route path="audit" element={<AuditComplianceDashboard />} />
          <Route path="documents" element={<DocumentManager />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
