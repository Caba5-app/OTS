import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import { DependenciaAuthProvider } from './DependenciaAuthContext';
import RequireAuth from './pages/RequireAuth';
import RequireDependenciaAuth from './pages/RequireDependenciaAuth';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import AdminDependencias from './pages/AdminDependencias';
import TemplateEditor from './pages/TemplateEditor';
import TemplateData from './pages/TemplateData';
import DependenciaLogin from './pages/DependenciaLogin';
import DependenciaDashboard from './pages/DependenciaDashboard';
import PublicFillPage from './pages/PublicFillPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DependenciaAuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/admin" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dependencia/login" element={<DependenciaLogin />} />
            <Route
              path="/dependencia"
              element={
                <RequireDependenciaAuth>
                  <DependenciaDashboard />
                </RequireDependenciaAuth>
              }
            />
            <Route
              path="/f/:slug"
              element={
                <RequireDependenciaAuth>
                  <PublicFillPage />
                </RequireDependenciaAuth>
              }
            />
            <Route
              path="/admin"
              element={
                <RequireAuth>
                  <AdminDashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/dependencias"
              element={
                <RequireAuth>
                  <AdminDependencias />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/templates/new"
              element={
                <RequireAuth>
                  <TemplateEditor />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/templates/:id/edit"
              element={
                <RequireAuth>
                  <TemplateEditor />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/templates/:id/data"
              element={
                <RequireAuth>
                  <TemplateData />
                </RequireAuth>
              }
            />
          </Routes>
        </DependenciaAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
