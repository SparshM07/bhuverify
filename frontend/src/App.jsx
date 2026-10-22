import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UploadPage from './pages/UploadPage';
import DocumentsPage from './pages/DocumentsPage';
import DocumentDetailPage from './pages/DocumentDetailPage';
import ReviewWorkbenchPage from './pages/ReviewWorkbenchPage';
import PublicVerifyPage from './pages/PublicVerifyPage';
import CasesPage from './pages/CasesPage';
import AdminPage from './pages/AdminPage';
import SearchPage from './pages/SearchPage';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes (No authentication required) */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verify/:token" element={<PublicVerifyPage />} />

          {/* Protected Application Routes inside Left-Nav Layout */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/cases" element={<CasesPage />} />
            
            {/* Upload is Clerk / Admin only */}
            <Route
              path="/upload"
              element={
                <ProtectedRoute allowedRoles={['admin', 'clerk']}>
                  <UploadPage />
                </ProtectedRoute>
              }
            />

            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/documents/:id" element={<DocumentDetailPage />} />
            <Route path="/documents/:id/review" element={<ReviewWorkbenchPage />} />

            {/* Admin Center is Admin only */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
