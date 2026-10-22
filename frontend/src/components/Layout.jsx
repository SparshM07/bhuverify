import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  UploadCloud,
  FileText,
  LogOut,
  Menu,
  X,
  Shield,
  AlertTriangle,
  Building2,
  Lock,
  ChevronRight,
  ExternalLink,
  Briefcase
} from 'lucide-react';

export default function Layout() {
  const { user, logout, hasRole } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    {
      name: 'Dashboard',
      path: '/dashboard',
      icon: LayoutDashboard,
      description: 'Overview & registry stats',
      roles: ['admin', 'clerk', 'viewer', 'reviewer'],
    },
    {
      name: 'Cases & Bundles',
      path: '/cases',
      icon: Briefcase,
      description: 'Parcel dispute bundles',
      roles: ['admin', 'clerk', 'viewer', 'reviewer'],
    },
    {
      name: 'Upload Record',
      path: '/upload',
      icon: UploadCloud,
      description: 'Secure ingest & validation',
      roles: ['admin', 'clerk'],
    },
    {
      name: 'Land Records',
      path: '/documents',
      icon: FileText,
      description: 'Search & registry ledger',
      roles: ['admin', 'clerk', 'viewer', 'reviewer'],
    },
    {
      name: 'Admin Center',
      path: '/admin',
      icon: Shield,
      description: 'Users & source status',
      roles: ['admin'],
    },
  ];

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'clerk':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'viewer':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'reviewer':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      default:
        return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row selection:bg-emerald-500 selection:text-white">
      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800 z-30 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
              भू-Verify <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">UP Prototype</span>
            </span>
          </div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700"
          aria-label="Toggle Navigation Menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-20 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed md:sticky top-0 h-screen w-72 bg-slate-900/95 md:bg-slate-900 border-r border-slate-800/80 flex flex-col z-30 transition-transform duration-200 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-600/30 border border-emerald-400/30">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-lg text-white tracking-tight">भू-Verify</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30">
                  AI-CADASTRE
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">UP Land Registry Prototype</p>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          <div className="px-3 py-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            Core Modules
          </div>
          {navItems.map((item) => {
            const hasAccess = item.roles.includes(user?.role || '');
            const Icon = item.icon;

            if (!hasAccess) {
              return (
                <div
                  key={item.path}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl text-slate-400 opacity-60 cursor-not-allowed group border border-transparent"
                  title="Clerk/Admin authorization required"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 text-slate-400" />
                    <div>
                      <div className="text-sm font-medium flex items-center gap-1.5">
                        {item.name}
                        <Lock className="w-3 h-3 text-slate-400" />
                      </div>
                      <div className="text-[11px] text-slate-400">{item.description}</div>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase font-mono px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400">
                    Clerk only
                  </span>
                </div>
              );
            }

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all duration-150 group border ${
                    isActive
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 font-medium shadow-sm shadow-emerald-950'
                      : 'border-transparent text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`w-5 h-5 transition-colors ${
                          isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-200'
                        }`}
                      />
                      <div>
                        <div className="text-sm font-medium">{item.name}</div>
                        <div className={`text-[11px] ${isActive ? 'text-emerald-400/80' : 'text-slate-400'}`}>
                          {item.description}
                        </div>
                      </div>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 transition-transform ${
                        isActive ? 'text-emerald-400 translate-x-0.5' : 'text-slate-400 group-hover:text-slate-400'
                      }`}
                    />
                  </>
                )}
              </NavLink>
            );
          })}

          <div className="pt-4 px-3">
            <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-800 text-[11px] text-slate-400 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-slate-300">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                Proof-of-Concept
              </div>
              <p className="leading-relaxed">
                UP Khatauni digitisation model testing SHA-256 integrity, OCR pipeline, and append-only audit trail.
              </p>
            </div>
          </div>
        </nav>

        {/* User Profile & Session Controls */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/60">
          <div className="p-2.5 rounded-xl bg-slate-800/70 border border-slate-750 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded font-semibold border ${getRoleBadge(
                    user?.role
                  )}`}
                >
                  {user?.role || 'Guest'}
                </span>
                <span className="text-[11px] text-slate-400 truncate font-mono">
                  {user?.userId ? `#${user.userId.slice(0, 8)}` : ''}
                </span>
              </div>
              <div className="text-xs text-slate-200 font-medium truncate" title={user?.email}>
                {user?.email}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-500/30 transition-colors"
              title="Sign Out"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Disclaimer Banner */}
        <div className="bg-amber-950/40 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between text-xs text-amber-300/90 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="truncate">
              <strong>Notice:</strong> Demo registry match - not an official government verification. Synthetic UP land record specimen environment.
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-3 shrink-0 font-mono text-[11px] text-amber-400/80">
            <span>UP Revenue Board Specimen</span>
          </div>
        </div>

        {/* Child Views */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
