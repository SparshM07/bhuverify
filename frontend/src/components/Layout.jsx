import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dashboardAPI } from '../services/api';
import Tooltip from './ui/Tooltip';
import StatusChip from './ui/StatusChip';
import {
  LayoutDashboard,
  UploadCloud,
  FileText,
  Briefcase,
  Search,
  Clock,
  Settings,
  HelpCircle,
  LogOut,
  Bell,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  FileSearch,
  Loader2,
  User as UserIcon,
  ArrowRight,
} from 'lucide-react';

export default function Layout() {
  const { user, logout, hasRole } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const searchInputRef = useRef(null);

  // Global search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchContainerRef = useRef(null);

  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global live search debounce
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed.length < 2) {
      setSearchResults(null);
      setSearching(false);
      setSearchOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await dashboardAPI.search(trimmed);
        setSearchResults(res);
        setSearchOpen(true);
      } catch (e) {
        console.error('Search error', e);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Synchronize search input with URL search param if on /search
  useEffect(() => {
    if (location.pathname === '/search') {
      const qParam = new URLSearchParams(location.search).get('q');
      if (qParam !== null && qParam !== searchQuery) {
        setSearchQuery(qParam);
      }
    }
  }, [location.pathname, location.search]);

  // Focus global search from sidebar nav click
  const handleNavSearchClick = () => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  // Derive user display info matching 2.png
  const getUserDisplay = () => {
    if (!user || !user.email) {
      return { name: 'Guest User', role: 'Guest', initials: 'GU' };
    }
    const email = user.email.toLowerCase();
    if (email.includes('clerk')) {
      return { name: 'Sparsh Maurya', role: 'Tehsil Clerk', initials: 'SM' };
    }
    if (email.includes('admin')) {
      return { name: 'Tehsil Admin', role: 'Tehsil Admin', initials: 'TA' };
    }
    if (email.includes('reviewer')) {
      return { name: 'Anil Kumar', role: 'Reviewer', initials: 'AK' };
    }
    if (email.includes('viewer')) {
      return { name: 'Public Citizen', role: 'Viewer', initials: 'PC' };
    }

    const username = user.email.split('@')[0];
    const formatted = username.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const initials = formatted.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() || 'U';
    return {
      name: formatted,
      role: (user.role || 'user').charAt(0).toUpperCase() + (user.role || 'user').slice(1),
      initials,
    };
  };

  const userDisplay = getUserDisplay();

  // Dynamic breadcrumbs based on pathname
  const getBreadcrumbs = () => {
    const path = location.pathname;
    if (path === '/' || path === '/dashboard') {
      return [
        { label: 'Home', path: '/dashboard' },
        { label: 'Dashboard', path: '/dashboard' },
      ];
    }
    if (path.startsWith('/documents')) {
      const parts = path.split('/').filter(Boolean);
      const crumbs = [
        { label: 'Home', path: '/dashboard' },
        { label: 'Documents', path: '/documents' },
      ];
      if (parts[1]) {
        crumbs.push({ label: `BV-${parts[1]}`, path: `/documents/${parts[1]}` });
      }
      return crumbs;
    }
    if (path.startsWith('/cases')) {
      return [
        { label: 'Home', path: '/dashboard' },
        { label: 'Cases', path: '/cases' },
      ];
    }
    if (path.startsWith('/upload')) {
      return [
        { label: 'Home', path: '/dashboard' },
        { label: 'Upload', path: '/upload' },
      ];
    }
    if (path.startsWith('/search')) {
      return [
        { label: 'Home', path: '/dashboard' },
        { label: 'Search', path: '/search' },
      ];
    }
    if (path.startsWith('/admin')) {
      return [
        { label: 'Home', path: '/dashboard' },
        { label: 'Admin', path: '/admin' },
      ];
    }
    return [
      { label: 'Home', path: '/dashboard' },
      { label: path.slice(1).charAt(0).toUpperCase() + path.slice(2), path },
    ];
  };

  const breadcrumbs = getBreadcrumbs();

  // Nav items specification:
  // Dashboard, Upload, Documents, Cases, Search, Audit log, Admin
  // (Help and Sign out are pinned at bottom)
  const mainNavItems = [
    {
      name: 'Dashboard',
      path: '/dashboard',
      icon: LayoutDashboard,
      roles: ['admin', 'clerk', 'viewer', 'reviewer'],
      type: 'link',
    },
    {
      name: 'Upload',
      path: '/upload',
      icon: UploadCloud,
      roles: ['admin', 'clerk'],
      type: 'link',
    },
    {
      name: 'Documents',
      path: '/documents',
      icon: FileText,
      roles: ['admin', 'clerk', 'viewer', 'reviewer'],
      type: 'link',
    },
    {
      name: 'Cases',
      path: '/cases',
      icon: Briefcase,
      roles: ['admin', 'clerk', 'viewer', 'reviewer'],
      type: 'link',
    },
    {
      name: 'Search',
      path: '/search',
      icon: Search,
      roles: ['admin', 'clerk', 'viewer', 'reviewer'],
      type: 'link',
    },
    {
      name: 'Audit log',
      icon: Clock,
      roles: ['admin', 'clerk', 'viewer', 'reviewer'],
      type: 'disabled',
      tooltip: 'Audit log (Coming soon)',
    },
    {
      name: 'Admin',
      path: '/admin',
      icon: Settings,
      roles: ['admin'],
      type: 'link',
    },
  ];

  // Filter items by user role
  const visibleNavItems = mainNavItems.filter((item) => hasRole(item.roles));

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col md:flex-row antialiased selection:bg-[#044eed] selection:text-white">
      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-slate-200 z-40 sticky top-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-[#044eed]">
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <path d="m9 15 2 2 4-4" />
            </svg>
          </div>
          <span className="font-bold text-lg tracking-tight text-[#061b6a]">
            BhuVerify
          </span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
          aria-label="Toggle Navigation"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* 240px White Sidebar matching 2.png */}
      <aside
        className={`fixed md:sticky top-0 h-screen w-[240px] min-w-[240px] max-w-[240px] bg-white border-r border-slate-200 flex flex-col z-40 transition-transform duration-200 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Logo Header */}
        <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-[#044eed] shrink-0">
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <path d="m9 15 2 2 4-4" />
            </svg>
          </div>
          <span className="font-bold text-xl tracking-tight text-[#061b6a]">
            BhuVerify
          </span>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;

            if (item.type === 'link') {
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150 select-none ${
                      isActive
                        ? 'bg-[#eef4ff] text-[#044eed] font-medium'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-normal'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-[#044eed]' : 'text-slate-500'
                        }`}
                      />
                      <span>{item.name}</span>
                    </>
                  )}
                </NavLink>
              );
            }

            if (item.type === 'action') {
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    if (item.onClick) item.onClick();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-normal transition-colors text-left select-none"
                >
                  <Icon className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>{item.name}</span>
                </button>
              );
            }

            if (item.type === 'disabled') {
              return (
                <Tooltip key={item.name} content={item.tooltip || 'Coming soon'} className="w-full">
                  <div className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 opacity-60 cursor-not-allowed select-none">
                    <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>{item.name}</span>
                  </div>
                </Tooltip>
              );
            }

            return null;
          })}
        </nav>

        {/* Bottom Navigation: Help & Sign out matching 2.png */}
        <div className="p-3 border-t border-slate-100 space-y-1">
          <Tooltip content="Help & documentation (Coming soon)" className="w-full">
            <div className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 opacity-60 cursor-not-allowed select-none">
              <HelpCircle className="w-4 h-4 text-slate-400 shrink-0" />
              <span>Help</span>
            </div>
          </Tooltip>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors text-left select-none font-normal"
          >
            <LogOut className="w-4 h-4 text-slate-500 shrink-0" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar matching 2.png */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30 gap-4">
          {/* Left: Breadcrumbs */}
          <nav
            aria-label="Breadcrumb"
            className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 font-medium shrink-0"
          >
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <React.Fragment key={crumb.path + idx}>
                  {idx > 0 && <span className="text-slate-400 select-none">›</span>}
                  {isLast ? (
                    <span className="text-slate-900 font-semibold">{crumb.label}</span>
                  ) : (
                    <Link
                      to={crumb.path}
                      className="hover:text-slate-800 transition-colors"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </React.Fragment>
              );
            })}
          </nav>

          {/* Center: Global Search */}
          <div ref={searchContainerRef} className="relative flex-1 max-w-md mx-auto">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (searchResults && searchQuery.trim().length >= 2) {
                    setSearchOpen(true);
                  }
                }}
                placeholder="Search khasra, khata, owner, village, case"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (searchQuery.trim()) {
                      setSearchOpen(false);
                      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                    }
                  }
                }}
                className="w-full py-1.5 pl-9 pr-8 text-xs md:text-sm rounded-lg border border-slate-200 bg-white placeholder:text-slate-400 text-slate-800 focus:outline-none focus:border-[#044eed] focus:ring-2 focus:ring-blue-500/15 transition-all shadow-sm"
              />
              {searching ? (
                <Loader2 className="w-3.5 h-3.5 text-slate-400 absolute right-3 animate-spin pointer-events-none" />
              ) : searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults(null);
                    setSearchOpen(false);
                  }}
                  className="p-1 rounded text-slate-400 hover:text-slate-600 absolute right-2"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>

            {/* Global Search Popover Dropdown */}
            {searchOpen && searchResults && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-slate-200 shadow-xl max-h-96 overflow-y-auto z-50 p-2 text-xs divide-y divide-slate-100 animate-in fade-in-0 zoom-in-95">
                <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Results for "{searchResults.query}"</span>
                  <span>{searchResults.total_results} found</span>
                </div>

                {searchResults.results && searchResults.results.length > 0 ? (
                  searchResults.results.map((item, idx) => (
                    <Link
                      key={`${item.result_type}-${item.id}-${idx}`}
                      to={item.link}
                      onClick={() => setSearchOpen(false)}
                      className="block p-2.5 rounded-lg hover:bg-slate-50 transition group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-900 group-hover:text-[#044eed] truncate">
                          {item.title}
                        </span>
                        {item.status && (
                          <StatusChip status={item.status} size="sm" />
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {item.subtitle}
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="p-4 text-center text-slate-400 text-xs">
                    No matching records found.
                  </div>
                )}

                {searchResults.query && (
                  <div className="p-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setSearchOpen(false);
                        navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                      }}
                      className="w-full py-2 px-3 text-xs font-semibold text-[#044eed] hover:bg-blue-50/50 rounded-lg flex items-center justify-between transition-colors"
                    >
                      <span>View all results for "{searchResults.query}"</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: DEMO chip, Notifications, and User Menu */}
          <div className="flex items-center gap-3 shrink-0">
            {/* DEMO - synthetic data Chip */}
            <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider bg-[#fef8e2] text-[#74430b] border border-[#fde68a] select-none">
              DEMO - synthetic data
            </span>

            {/* Notifications (Disabled with Coming soon tooltip) */}
            <Tooltip content="Notifications (Coming soon)">
              <button
                type="button"
                disabled
                className="relative p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-80 disabled:cursor-not-allowed transition"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5 text-slate-600" />
                <span className="absolute top-1 right-1 w-4 h-4 bg-[#dc2626] text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                  3
                </span>
              </button>
            </Tooltip>

            {/* User Menu */}
            <div ref={userMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2.5 p-1 rounded-lg hover:bg-slate-50 transition text-left"
              >
                <div className="w-8 h-8 rounded-full bg-blue-100 text-[#044eed] font-bold text-xs flex items-center justify-center shrink-0 border border-blue-200">
                  {userDisplay.initials}
                </div>
                <div className="hidden lg:block text-left">
                  <div className="text-xs font-semibold text-slate-900 leading-tight">
                    {userDisplay.name}
                  </div>
                  <div className="text-[11px] text-slate-500 leading-tight">
                    {userDisplay.role}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden lg:block" />
              </button>

              {/* User Dropdown */}
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl border border-slate-200 shadow-xl py-2 z-50 text-xs animate-in fade-in-0 zoom-in-95">
                  <div className="px-4 py-2.5 border-b border-slate-100">
                    <p className="font-semibold text-slate-900">{userDisplay.name}</p>
                    <p className="text-[11px] text-slate-500 truncate" title={user?.email}>
                      {user?.email}
                    </p>
                    <div className="mt-1.5">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold bg-blue-50 text-[#044eed] border border-blue-200">
                        {userDisplay.role}
                      </span>
                    </div>
                  </div>

                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 text-left font-medium transition"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content View */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
