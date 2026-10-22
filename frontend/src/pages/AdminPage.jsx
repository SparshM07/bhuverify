import React, { useState, useEffect } from 'react';
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
  FileText
} from 'lucide-react';

export default function AdminPage() {
  const { user } = useAuth();

  const [users, setUsers] = useState([]);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

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
      setError('Failed to fetch administrative records. Make sure you hold Administrator clearance.');
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
      setSuccess(`User status changed to ${!currentActive ? 'ACTIVE' : 'SUSPENDED'}`);
    } catch (err) {
      console.error('Failed to toggle status', err);
      setError(err.response?.data?.detail || 'Failed to toggle user status.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-mono mb-1.5">
          <Shield className="w-3.5 h-3.5" /> Departmental Administration & Policy
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">System Administration</h1>
        <p className="text-sm text-slate-400">
          Manage officer roles, access levels, and external registry integration providers.
        </p>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-slate-400 hover:text-white">
            &times;
          </button>
        </div>
      )}
      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="text-slate-400 hover:text-white">
            &times;
          </button>
        </div>
      )}

      {/* Section 1: Verification Source Status */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-400" />
              Registry Source Providers
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Configured revenue and land registry connectors for official ground-truth cross-checks.
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs text-slate-300 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Sources
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sources.map((source, idx) => (
            <div
              key={idx}
              className={`p-5 rounded-2xl border transition-all ${
                source.is_demo
                  ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/20 border-amber-500/30'
                  : 'bg-slate-900 border-slate-800'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white">{source.name}</span>
                    {source.is_demo && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] tracking-wider uppercase shadow-md shadow-amber-500/20 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 fill-slate-950" /> DEMO
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 font-mono">
                    Provider ID: {source.provider_id || 'synthetic_registry'}
                  </p>
                </div>

                <div className="text-right">
                  <span
                    className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded border ${
                      source.status?.includes('OPERATIONAL')
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {source.status}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                {source.description ||
                  'Synthetic registry database containing curated Uttar Pradesh Mauza records used for deterministic automated checks and discrepancy testing.'}
              </p>

              {source.is_demo && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300/90 flex items-start gap-2 mb-4">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <span>
                    <strong>Simulated Prototype Notice:</strong> Not connected to the closed NIC UP Bhulekh production VPN. All matches and mismatches are generated against verifiable synthetic land parcels.
                  </span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>Latency: {source.latency_ms || '~12ms'}</span>
                <span>Indexed Parcels: {source.records_indexed || '300+ sample plots'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: Departmental Users & Roles */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            Officer Directory & Role Assignments
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure access controls and permission tiers (Admin, Clerk, Viewer) for portal operators.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-5 py-3.5">Officer / Email</th>
                  <th className="px-4 py-3.5">Role Authorization</th>
                  <th className="px-4 py-3.5">Account Status</th>
                  <th className="px-4 py-3.5 text-center">Docs Uploaded</th>
                  <th className="px-4 py-3.5">Registered</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {users.map((u) => {
                  const isCurrent = u.id === user?.id;
                  const isUpdating = updatingId === u.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-4 font-medium text-white">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-slate-300 text-xs">
                            {u.email.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span>{u.email}</span>
                            {isCurrent && (
                              <span className="ml-2 text-[10px] font-mono bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/20">
                                You
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <select
                          disabled={isUpdating}
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-purple-500 capitalize font-medium"
                        >
                          <option value="admin">Admin</option>
                          <option value="clerk">Clerk</option>
                          <option value="reviewer">Reviewer</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                            u.is_active
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              u.is_active ? 'bg-emerald-400' : 'bg-rose-400'
                            }`}
                          />
                          {u.is_active ? 'Active' : 'Suspended'}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-center font-mono text-slate-400">
                        {u.documents_count ?? 0}
                      </td>

                      <td className="px-4 py-4 text-slate-500 font-mono text-[11px]">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          disabled={isUpdating || isCurrent}
                          onClick={() => handleToggleActive(u.id, u.is_active)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                            u.is_active
                              ? 'text-rose-400 hover:bg-rose-500/10 disabled:opacity-30'
                              : 'text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-30'
                          }`}
                        >
                          {isUpdating ? (
                            <RefreshCw className="w-3 h-3 animate-spin inline mr-1" />
                          ) : null}
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
