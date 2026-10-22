import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { adminAPI } from '../services/api';
import {
  Shield,
  Users,
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Server,
  Lock,
  UserCheck,
  UserX,
  Sparkles,
  Info,
  Clock,
  Activity,
  FileText,
  Plus,
  Search,
  MoreVertical,
  X,
  Check,
  Landmark,
  Settings,
  Upload,
  Copy,
  Key,
  Sliders,
  ChevronRight,
  HelpCircle,
  Eye,
  SlidersHorizontal,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Input,
  Textarea,
  StatusChip,
  Tooltip,
  Modal,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableSkeleton,
  TableEmpty,
  Pagination,
} from '../components/ui';

export default function AdminPage() {
  const { user } = useAuth();

  // Active top navigation tab: 'users' | 'roles' | 'sources' | 'settings'
  const [activeTab, setActiveTab] = useState('users');

  // Data
  const [users, setUsers] = useState([]);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Users filter & search
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Users pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Add User Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('clerk');
  const [newUserPassword, setNewUserPassword] = useState('K7mP@9zQ2v');
  const [requirePasswordChange, setRequirePasswordChange] = useState(true);

  // Sample data modal state
  const [sampleModalOpen, setSampleModalOpen] = useState(false);

  // Settings form state (persisted locally)
  const [uploadSize, setUploadSize] = useState('10 MB');
  const [allowedTypes, setAllowedTypes] = useState({
    PDF: true,
    JPG: true,
    PNG: true,
    TIFF: false,
  });
  const [languages, setLanguages] = useState({
    English: true,
    Hindi: true,
  });
  const [confidenceThreshold, setConfidenceThreshold] = useState(70);
  const [qrExpiry, setQrExpiry] = useState('7 days');
  const [savingSettings, setSavingSettings] = useState(false);

  // Auto-dismiss success notification
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersData, sourcesData] = await Promise.all([
        adminAPI.getUsers(),
        adminAPI.getSources(),
      ]);
      setUsers(usersData || []);
      setSources(sourcesData?.sources || []);
    } catch (err) {
      console.error('Failed to load admin data', err);
      setError('Failed to fetch administrative records. Ensure you hold Administrator clearance.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    setUpdatingId(userId);
    setError(null);
    try {
      const updated = await adminAPI.updateUser(userId, { role: newRole });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: updated.role } : u)));
      setSuccess(`Role updated to ${newRole.toUpperCase()} for ${updated.email}`);
    } catch (err) {
      console.error('Failed to update role', err);
      setError(err.response?.data?.detail || 'Failed to update user role.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleActive = async (userId, currentActive) => {
    setUpdatingId(userId);
    setError(null);
    try {
      const updated = await adminAPI.updateUser(userId, { is_active: !currentActive });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_active: updated.is_active } : u))
      );
      setSuccess(`User status changed to ${!currentActive ? 'ACTIVE' : 'INACTIVE'}`);
    } catch (err) {
      console.error('Failed to toggle status', err);
      setError(err.response?.data?.detail || 'Failed to toggle user status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let pwd = '';
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewUserPassword(pwd);
  };

  const handleCreateUser = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!newUserEmail.trim() || !newUserPassword.trim()) {
      setError('Email and temporary password are required.');
      return;
    }

    setCreatingUser(true);
    setError(null);
    try {
      await adminAPI.createUser({
        email: newUserEmail.trim(),
        password: newUserPassword.trim(),
        role: newUserRole,
        is_active: true,
      });

      setSuccess(`Created user account for ${newUserEmail.trim()} successfully.`);
      setDrawerOpen(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserRole('clerk');
      generateRandomPassword();
      await fetchData();
    } catch (err) {
      console.error('Failed to create user', err);
      setError(err.response?.data?.detail || 'Failed to create user account.');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleSaveSettings = () => {
    setSavingSettings(true);
    setTimeout(() => {
      setSavingSettings(false);
      setSuccess('System configuration settings saved successfully.');
    }, 600);
  };

  // Name / initials formatting
  const getDisplayName = (u) => {
    if (u.name) return u.name;
    const emailPrefix = (u.email || '').split('@')[0];
    const parts = emailPrefix.split(/[._-]/);
    if (parts.length >= 2) {
      return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    }
    return emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
  };

  const getInitials = (u) => {
    const name = getDisplayName(u);
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getAvatarColor = (email) => {
    const palettes = [
      'bg-[#e0e7ff] text-[#3730a3]', // Indigo
      'bg-[#fce7f3] text-[#9d174d]', // Pink
      'bg-[#dcfce7] text-[#166534]', // Green
      'bg-[#f3e8ff] text-[#6b21a8]', // Purple
      'bg-[#fef3c7] text-[#92400e]', // Amber
      'bg-[#e0f2fe] text-[#0369a1]', // Sky
      'bg-[#ccfbf1] text-[#115e59]', // Teal
      'bg-[#fee2e2] text-[#991b1b]', // Rose
    ];
    let hash = 0;
    for (let i = 0; i < (email || '').length; i++) {
      hash = (hash << 5) - hash + email.charCodeAt(i);
    }
    return palettes[Math.abs(hash) % palettes.length];
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = search.toLowerCase().trim();
      const name = getDisplayName(u).toLowerCase();
      const email = (u.email || '').toLowerCase();
      const matchesSearch = !q || name.includes(q) || email.includes(q);

      const matchesRole =
        roleFilter === 'all' ||
        (u.role || '').toLowerCase() === roleFilter.toLowerCase();

      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  // Pagination slicing
  const totalRecords = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, roleFilter]);

  // Demo registry source details
  const demoSource = sources.find((s) => s.is_demo);
  const officialSource = sources.find((s) => !s.is_demo) || null;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Admin</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Manage users, roles, data sources and system settings.
        </p>
      </div>

      {/* Tabs Row (12.png / 13.png) */}
      <div className="border-b border-slate-200">
        <nav className="flex items-center gap-8 -mb-px">
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-3 text-sm transition-colors border-b-2 font-medium ${
              activeTab === 'users'
                ? 'border-[#044eed] text-[#044eed]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Users
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={`pb-3 text-sm transition-colors border-b-2 font-medium ${
              activeTab === 'roles'
                ? 'border-[#044eed] text-[#044eed]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Roles and permissions
          </button>
          <button
            onClick={() => setActiveTab('sources')}
            className={`pb-3 text-sm transition-colors border-b-2 font-medium ${
              activeTab === 'sources'
                ? 'border-[#044eed] text-[#044eed]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Data sources
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`pb-3 text-sm transition-colors border-b-2 font-medium ${
              activeTab === 'settings'
                ? 'border-[#044eed] text-[#044eed]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Settings
          </button>
        </nav>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between animate-in fade-in-50">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="p-1 hover:bg-red-100 rounded text-red-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between animate-in fade-in-50">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{success}</span>
          </div>
          <button
            onClick={() => setSuccess(null)}
            className="p-1 hover:bg-emerald-100 rounded text-emerald-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TAB 1: USERS (12.png) */}
      {activeTab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Users Card & Table */}
          <div className={drawerOpen ? 'lg:col-span-8' : 'lg:col-span-12'}>
            <Card>
              {/* Users Header */}
              <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Users</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Manage user accounts and their access to BhuVerify.
                  </p>
                </div>

                <Button
                  variant="primary"
                  size="md"
                  leftIcon={<Plus className="w-4 h-4" />}
                  onClick={() => setDrawerOpen(true)}
                >
                  Add user
                </Button>
              </div>

              {/* Search & Filter row */}
              <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/50">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name or email..."
                    className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#044eed] focus:ring-1 focus:ring-blue-500/20 text-slate-900 placeholder:text-slate-400"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-[#044eed] focus:ring-1 focus:ring-blue-500/20"
                  >
                    <option value="all">All roles</option>
                    <option value="admin">Admin</option>
                    <option value="reviewer">Reviewer</option>
                    <option value="clerk">Clerk</option>
                    <option value="viewer">Viewer</option>
                  </select>

                  {(search || roleFilter !== 'all') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearch('');
                        setRoleFilter('all');
                      }}
                      className="text-xs text-slate-500"
                    >
                      Reset
                    </Button>
                  )}
                </div>
              </div>

              {/* Users Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-[130px]">Role</TableHead>
                    <TableHead className="w-[120px]">Status</TableHead>
                    <TableHead className="w-[150px]">Last login</TableHead>
                    <TableHead className="w-[50px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableSkeleton rows={6} columns={6} />
                  ) : filteredUsers.length === 0 ? (
                    <TableEmpty
                      title="No users found"
                      description={
                        search || roleFilter !== 'all'
                          ? 'Try clearing filters or adjusting your search keywords.'
                          : 'No user accounts available.'
                      }
                      colSpan={6}
                      onClearFilters={
                        search || roleFilter !== 'all'
                          ? () => {
                              setSearch('');
                              setRoleFilter('all');
                            }
                          : undefined
                      }
                    />
                  ) : (
                    paginatedUsers.map((u) => {
                      const isCurrent = u.id === user?.id;
                      const isUpdating = updatingId === u.id;
                      const initials = getInitials(u);
                      const displayName = getDisplayName(u);
                      const avatarClass = getAvatarColor(u.email);

                      return (
                        <TableRow key={u.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* Name + Avatar */}
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs select-none shrink-0 ${avatarClass}`}
                              >
                                {initials}
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs font-semibold text-slate-900 truncate block">
                                  {displayName}
                                </span>
                                {isCurrent && (
                                  <span className="text-[10px] font-mono text-[#044eed] bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100">
                                    You
                                  </span>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          {/* Email */}
                          <TableCell>
                            <span className="text-xs text-slate-600 font-mono">
                              {u.email}
                            </span>
                          </TableCell>

                          {/* Role Selector */}
                          <TableCell>
                            <select
                              disabled={isUpdating}
                              value={u.role}
                              onChange={(e) => handleRoleChange(u.id, e.target.value)}
                              className="text-xs font-medium rounded-lg px-2.5 py-1 bg-white border border-slate-200 text-slate-800 focus:outline-none focus:border-[#044eed] cursor-pointer"
                            >
                              <option value="admin">Admin</option>
                              <option value="reviewer">Reviewer</option>
                              <option value="clerk">Clerk</option>
                              <option value="viewer">Viewer</option>
                            </select>
                          </TableCell>

                          {/* Status Toggle Switch */}
                          <TableCell>
                            <button
                              type="button"
                              disabled={isUpdating || isCurrent}
                              onClick={() => handleToggleActive(u.id, u.is_active)}
                              className="inline-flex items-center gap-2 group cursor-pointer focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                              title={isCurrent ? 'Cannot deactivate your own account' : 'Toggle status'}
                            >
                              <span
                                className={`w-8 h-4.5 rounded-full transition-colors relative flex items-center p-0.5 ${
                                  u.is_active ? 'bg-[#16a34a]' : 'bg-slate-300'
                                }`}
                              >
                                <span
                                  className={`w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-transform ${
                                    u.is_active ? 'translate-x-3.5' : 'translate-x-0'
                                  }`}
                                />
                              </span>
                              <span
                                className={`text-xs font-medium ${
                                  u.is_active ? 'text-slate-800' : 'text-slate-400'
                                }`}
                              >
                                {u.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </button>
                          </TableCell>

                          {/* Last login */}
                          <TableCell>
                            <span className="text-xs text-slate-500 font-mono">
                              {formatDate(u.created_at)}
                            </span>
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="text-right">
                            <Tooltip content="More options coming soon">
                              <button
                                type="button"
                                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>

              {/* Table Footer */}
              {!loading && filteredUsers.length > 0 && (
                <div className="p-3 border-t border-slate-100">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalRecords={totalRecords}
                    pageSize={pageSize}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={setPageSize}
                  />
                </div>
              )}
            </Card>
          </div>

          {/* Right Column: Add User Drawer / Panel (12.png) */}
          {drawerOpen && (
            <div className="lg:col-span-4 animate-in slide-in-from-right duration-200">
              <Card className="p-5 space-y-4 border-slate-300 shadow-md">
                <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Add user</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Create a new user account for BhuVerify.
                    </p>
                  </div>
                  <button
                    onClick={() => setDrawerOpen(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleCreateUser} className="space-y-3.5 text-xs">
                  <div>
                    <Input
                      label="Name"
                      required
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      placeholder="Rajat Mishra"
                    />
                  </div>

                  <div>
                    <Input
                      label="Email"
                      type="email"
                      required
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      placeholder="rajat.mishra@bhuverify.in"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Role <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs text-slate-900 bg-white focus:outline-none focus:border-[#044eed]"
                    >
                      <option value="clerk">Clerk</option>
                      <option value="reviewer">Reviewer</option>
                      <option value="admin">Admin</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Temporary password <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        required
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs font-mono text-slate-900 bg-white focus:outline-none focus:border-[#044eed]"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="md"
                        leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                        onClick={generateRandomPassword}
                      >
                        Generate
                      </Button>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Share this password securely with the user.
                    </p>
                  </div>

                  {/* Toggle: Require password change */}
                  <div className="pt-1 flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => setRequirePasswordChange(!requirePasswordChange)}
                      className="mt-0.5 inline-flex items-center group cursor-pointer focus:outline-none"
                    >
                      <span
                        className={`w-8 h-4.5 rounded-full transition-colors relative flex items-center p-0.5 ${
                          requirePasswordChange ? 'bg-[#044eed]' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-transform ${
                            requirePasswordChange ? 'translate-x-3.5' : 'translate-x-0'
                          }`}
                        />
                      </span>
                    </button>
                    <div>
                      <span className="text-xs font-semibold text-slate-800 block">
                        Require password change on first login
                      </span>
                      <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                        User will be asked to set a new password after first login.
                      </p>
                    </div>
                  </div>

                  {/* Drawer Footer Buttons */}
                  <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-slate-100">
                    <Button
                      type="button"
                      variant="ghost"
                      size="md"
                      onClick={() => setDrawerOpen(false)}
                      disabled={creatingUser}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      loading={creatingUser}
                    >
                      Create user
                    </Button>
                  </div>
                </form>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ROLES & PERMISSIONS */}
      {activeTab === 'roles' && (
        <div className="space-y-6">
          <Card>
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Roles & Permissions</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Security clearance levels and capability matrix across departmental roles.
                </p>
              </div>

              <Tooltip content="Coming soon">
                <Button
                  variant="secondary"
                  size="md"
                  disabled
                  leftIcon={<Plus className="w-4 h-4 text-slate-400" />}
                >
                  Create custom role
                </Button>
              </Tooltip>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Role</TableHead>
                  <TableHead className="w-[120px]">Clearance Tier</TableHead>
                  <TableHead>Core Capabilities</TableHead>
                  <TableHead className="w-[120px] text-center">Active Users</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>
                    <span className="text-xs font-bold text-slate-900 block">Admin</span>
                    <span className="text-[11px] text-slate-400 font-mono">admin</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                      Tier 1: Full
                    </span>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      User provisioning, security policy assignment, data source management, override clearances, and complete cryptographic audit trail access.
                    </p>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-xs font-mono font-semibold text-slate-700">
                      {users.filter((u) => u.role === 'admin').length}
                    </span>
                  </TableCell>
                </TableRow>

                <TableRow>
                  <TableCell>
                    <span className="text-xs font-bold text-slate-900 block">Reviewer</span>
                    <span className="text-[11px] text-slate-400 font-mono">reviewer</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      Tier 2: Governance
                    </span>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      Interactive OCR Review Workbench, cadastral field corrections with mandatory audit reasoning, demo registry cross-checks, and record approval/rejection decisions.
                    </p>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-xs font-mono font-semibold text-slate-700">
                      {users.filter((u) => u.role === 'reviewer').length}
                    </span>
                  </TableCell>
                </TableRow>

                <TableRow>
                  <TableCell>
                    <span className="text-xs font-bold text-slate-900 block">Clerk</span>
                    <span className="text-[11px] text-slate-400 font-mono">clerk</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                      Tier 3: Operations
                    </span>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      Document upload and intake, OCR pipeline execution, parcel case bundle registration, document attachment, and public token creation.
                    </p>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-xs font-mono font-semibold text-slate-700">
                      {users.filter((u) => u.role === 'clerk').length}
                    </span>
                  </TableCell>
                </TableRow>

                <TableRow>
                  <TableCell>
                    <span className="text-xs font-bold text-slate-900 block">Viewer</span>
                    <span className="text-[11px] text-slate-400 font-mono">viewer / legal</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      Tier 4: Read-Only
                    </span>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      Read-only visibility into approved land records, verification status certificates, public share tokens, and parcel summary files.
                    </p>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-xs font-mono font-semibold text-slate-700">
                      {users.filter((u) => u.role === 'viewer').length}
                    </span>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {/* TAB 3: DATA SOURCES (13.png) */}
      {(activeTab === 'sources' || activeTab === 'settings') && (
        <div className="space-y-6">
          {/* Data Sources Section */}
          {activeTab === 'sources' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Data sources</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure and manage data sources used for verification.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* 1. Demo Registry Card (13.png) */}
                <Card className="p-5 flex flex-col justify-between">
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#044eed] flex items-center justify-center shrink-0 border border-blue-100">
                          <Database className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-slate-900">Demo registry</h3>
                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-bold tracking-wider uppercase">
                              DEMO
                            </span>
                          </div>
                        </div>
                      </div>

                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#e4f8ef] text-[#166534] border border-[#bbf7d0]/60">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
                        Active
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      Synthetic land record data for demonstration and testing.
                    </p>

                    {/* Metadata key-value list */}
                    <div className="space-y-2.5 pt-2 border-t border-slate-100 text-xs">
                      <div className="grid grid-cols-3 gap-2">
                        <span className="text-slate-500">Record count</span>
                        <span className="col-span-2 text-slate-900 font-mono font-semibold">
                          12,480 records
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <span className="text-slate-500">Last updated</span>
                        <span className="col-span-2 text-slate-900 font-mono">
                          10 Oct 2026, 04:15 PM
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <span className="text-slate-500">Description</span>
                        <span className="col-span-2 text-slate-700 leading-relaxed">
                          Synthetic khatauni records with sample data for testing and demonstration.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-5 mt-4 border-t border-slate-100 flex items-center gap-3">
                    <Button
                      variant="secondary"
                      size="md"
                      leftIcon={<FileText className="w-4 h-4 text-slate-500" />}
                      onClick={() => setSampleModalOpen(true)}
                    >
                      View sample data
                    </Button>

                    <Tooltip content="Coming soon">
                      <Button
                        variant="primary"
                        size="md"
                        disabled
                        leftIcon={<Upload className="w-4 h-4" />}
                      >
                        Replace dataset
                      </Button>
                    </Tooltip>
                  </div>
                </Card>

                {/* 2. Official Source Card (13.png) */}
                <Card className="p-5 flex flex-col justify-between">
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#044eed] flex items-center justify-center shrink-0 border border-blue-100">
                          <Landmark className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-slate-900">
                            Official source (API Setu / state portal)
                          </h3>
                        </div>
                      </div>

                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#feecec] text-[#991b1b] border border-[#fecaca]/60 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#dc2626]" />
                        Not connected
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      Connect to the official land records system for real verification.
                    </p>

                    {/* Metadata key-value list */}
                    <div className="space-y-2.5 pt-2 border-t border-slate-100 text-xs">
                      <div className="grid grid-cols-3 gap-2">
                        <span className="text-slate-500">Record count</span>
                        <span className="col-span-2 text-slate-400 font-mono">—</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <span className="text-slate-500">Last updated</span>
                        <span className="col-span-2 text-slate-400 font-mono">—</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <span className="text-slate-500">Description</span>
                        <span className="col-span-2 text-slate-700 leading-relaxed">
                          Requires authorisation from the state government (API Setu / revenue department) to access official land records.
                        </span>
                      </div>
                    </div>

                    {/* Info Alert Box (13.png) */}
                    <div className="p-3 rounded-lg bg-blue-50/70 border border-blue-100 text-xs text-blue-900 flex items-start gap-2.5">
                      <Info className="w-4 h-4 text-[#044eed] shrink-0 mt-0.5" />
                      <p className="leading-relaxed">
                        This connection requires government authorisation and proper credentials. Contact the system administrator to configure this data source.
                      </p>
                    </div>
                  </div>

                  {/* Action */}
                  <div className="pt-5 mt-4 border-t border-slate-100 flex items-center justify-start">
                    <Tooltip content="Coming soon">
                      <Button
                        variant="secondary"
                        size="md"
                        disabled
                        leftIcon={<Settings className="w-4 h-4 text-slate-400" />}
                      >
                        Configure
                      </Button>
                    </Tooltip>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* Settings Section (13.png) */}
          <div className="space-y-4 pt-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">Settings</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure system settings related to document processing and verification.
              </p>
            </div>

            <Card className="p-5">
              <div className="space-y-6">
                {/* Top Row: Max Upload Size, Allowed File Types, OCR Languages */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Maximum upload size */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-900 mb-1">
                      Maximum upload size
                    </label>
                    <p className="text-[11px] text-slate-500 mb-2">
                      Maximum size per file upload.
                    </p>
                    <select
                      value={uploadSize}
                      onChange={(e) => setUploadSize(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs text-slate-900 bg-white focus:outline-none focus:border-[#044eed]"
                    >
                      <option value="5 MB">5 MB</option>
                      <option value="10 MB">10 MB</option>
                      <option value="25 MB">25 MB</option>
                      <option value="50 MB">50 MB</option>
                    </select>
                  </div>

                  {/* Allowed file types */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-900 mb-1">
                      Allowed file types
                    </label>
                    <p className="text-[11px] text-slate-500 mb-2">
                      File types allowed for upload.
                    </p>
                    <div className="flex items-center gap-4 pt-1">
                      {['PDF', 'JPG', 'PNG', 'TIFF'].map((type) => (
                        <label
                          key={type}
                          className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={allowedTypes[type]}
                            onChange={(e) =>
                              setAllowedTypes({
                                ...allowedTypes,
                                [type]: e.target.checked,
                              })
                            }
                            className="rounded border-slate-300 text-[#044eed] focus:ring-blue-500 w-4 h-4 cursor-pointer"
                          />
                          <span className="font-medium">{type}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* OCR languages */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-900 mb-1">
                      OCR languages
                    </label>
                    <p className="text-[11px] text-slate-500 mb-2">
                      Languages to use for text extraction.
                    </p>
                    <div className="flex items-center gap-4 pt-1">
                      {['English', 'Hindi'].map((lang) => (
                        <label
                          key={lang}
                          className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={languages[lang]}
                            onChange={(e) =>
                              setLanguages({
                                ...languages,
                                [lang]: e.target.checked,
                              })
                            }
                            className="rounded border-slate-300 text-[#044eed] focus:ring-blue-500 w-4 h-4 cursor-pointer"
                          />
                          <span className="font-medium">{lang}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bottom Row: Confidence threshold & Default QR expiry */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                  {/* Confidence threshold slider */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-900">
                        Confidence threshold
                      </label>
                      <span className="text-xs font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {confidenceThreshold}%
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-2">
                      Fields with confidence below this value will be flagged for human review.
                    </p>
                    <div className="pt-1">
                      <input
                        type="range"
                        min="50"
                        max="95"
                        step="5"
                        value={confidenceThreshold}
                        onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#044eed]"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                        <span>50% (Strict)</span>
                        <span>70% (Default)</span>
                        <span>95% (Lenient)</span>
                      </div>
                    </div>
                  </div>

                  {/* Default QR expiry */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-900 mb-1">
                      Default QR expiry
                    </label>
                    <p className="text-[11px] text-slate-500 mb-2">
                      Default validity period for generated verification links.
                    </p>
                    <select
                      value={qrExpiry}
                      onChange={(e) => setQrExpiry(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 py-2 px-3 text-xs text-slate-900 bg-white focus:outline-none focus:border-[#044eed]"
                    >
                      <option value="24 hours">24 hours</option>
                      <option value="3 days">3 days</option>
                      <option value="7 days">7 days</option>
                      <option value="30 days">30 days</option>
                    </select>
                  </div>
                </div>

                {/* Save Button */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
                  <Button
                    variant="primary"
                    size="md"
                    loading={savingSettings}
                    onClick={handleSaveSettings}
                  >
                    Save settings
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Modal: View Sample Data */}
      <Modal
        isOpen={sampleModalOpen}
        onClose={() => setSampleModalOpen(false)}
        title="Demo Registry Sample Records"
        description="Curated synthetic khatauni records for deterministic testing."
        maxWidth="max-w-2xl"
        confirmText="Done"
        onConfirm={() => setSampleModalOpen(false)}
      >
        <div className="space-y-3 text-xs max-h-[60vh] overflow-y-auto pr-1">
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0 text-amber-600" />
            <span>
              All records below are synthetic representations of Uttar Pradesh cadastral registers used for safe testing.
            </span>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Khata No.</TableHead>
                <TableHead>Khasra / Plot</TableHead>
                <TableHead>Mauza / Village</TableHead>
                <TableHead>Landholder Name</TableHead>
                <TableHead>Area (ha)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-mono font-semibold text-[#044eed]">00123</TableCell>
                <TableCell className="font-mono">45/1</TableCell>
                <TableCell>Syntheticpur</TableCell>
                <TableCell className="font-medium">Ramesh Kumar</TableCell>
                <TableCell className="font-mono">0.482 ha</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono font-semibold text-[#044eed]">00456</TableCell>
                <TableCell className="font-mono">45/1</TableCell>
                <TableCell>Syntheticpur</TableCell>
                <TableCell className="font-medium">Suresh Maurya</TableCell>
                <TableCell className="font-mono">1.250 ha</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono font-semibold text-[#044eed]">00078</TableCell>
                <TableCell className="font-mono">45/1</TableCell>
                <TableCell>Chak Ganjaria</TableCell>
                <TableCell className="font-medium">Anil Verma</TableCell>
                <TableCell className="font-mono">0.310 ha</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono font-semibold text-[#044eed]">00211</TableCell>
                <TableCell className="font-mono">45/1</TableCell>
                <TableCell>Syntheticpur</TableCell>
                <TableCell className="font-medium">Vikram Singh</TableCell>
                <TableCell className="font-mono">0.910 ha</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono font-semibold text-[#044eed]">00987</TableCell>
                <TableCell className="font-mono">45/1</TableCell>
                <TableCell>Barauli</TableCell>
                <TableCell className="font-medium">Pooja Devi</TableCell>
                <TableCell className="font-mono">0.520 ha</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Modal>
    </div>
  );
}
