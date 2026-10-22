import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { Activity, ShieldCheck, AlertCircle, RefreshCw, FileText, CheckCircle2, Layers } from 'lucide-react';

export default function HomePage() {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/health');
      setHealthData(response.data);
      setLastChecked(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err.message || 'Failed to connect to backend server');
      setHealthData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold tracking-tight text-white">BhuVerify</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                  Prototype
                </span>
              </div>
              <p className="text-xs text-slate-400">AI-Assisted UP Land-Record Digitisation & Verification</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
              <span className="relative flex h-2 w-2">
                {healthData?.status === 'ok' ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                )}
              </span>
              <span className="text-slate-300">
                Backend: <strong className={healthData?.status === 'ok' ? 'text-emerald-400' : 'text-amber-400'}>{healthData?.status || 'Connecting'}</strong>
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-12 flex-1 w-full flex flex-col justify-center">
        {/* Banner Alert for Prototype Disclaimer */}
        <div className="mb-8 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200/90 text-sm flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-amber-300">Hackathon Prototype Notice: </span>
            {healthData?.disclaimer || 'Demo registry match - not an official government verification'}
          </div>
        </div>

        {/* Backend Status Hero Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="md:col-span-2 p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2.5">
                <Activity className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-semibold text-white">System Connectivity Status</h2>
              </div>
              <button
                id="refresh-health-btn"
                onClick={fetchHealth}
                disabled={loading}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors border border-slate-700 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Re-check</span>
              </button>
            </div>

            {loading ? (
              <div className="py-8 flex items-center justify-center space-x-3 text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
                <span>Connecting to backend at {import.meta.env.VITE_API_URL || 'http://localhost:8000'}...</span>
              </div>
            ) : error ? (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
                <div className="flex items-center space-x-2 font-medium mb-1">
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                  <span>Connection Error</span>
                </div>
                <p className="text-xs text-rose-200/80">{error}</p>
                <p className="text-xs text-slate-400 mt-2">Ensure FastAPI server is running on port 8000.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center space-x-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-emerald-300">
                      Backend Status: <span id="backend-status-badge" className="uppercase font-mono">{healthData?.status}</span>
                    </div>
                    <div className="text-xs text-emerald-400/80">
                      FastAPI service is running and accepting requests.
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400 block mb-1">App</span>
                    <span className="text-slate-200 font-medium font-mono">{healthData?.app}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400 block mb-1">Version</span>
                    <span className="text-slate-200 font-medium font-mono">{healthData?.version}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400 block mb-1">Environment</span>
                    <span className="text-slate-200 font-medium font-mono capitalize">{healthData?.environment}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400 block mb-1">Last Checked</span>
                    <span className="text-slate-200 font-medium font-mono">{lastChecked || 'N/A'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Specifications Card */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-2.5 mb-4">
                <ShieldCheck className="w-5 h-5 text-teal-400" />
                <h3 className="text-sm font-semibold text-white">System Architecture</h3>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-300">
                <li className="flex items-center space-x-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span><strong>Records:</strong> UP-Style Khatauni (ROR)</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span><strong>OCR Engine:</strong> Tesseract (eng + hin)</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span><strong>Vision/PDF:</strong> PyMuPDF & OpenCV</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span><strong>Audit Trail:</strong> Append-Only Ledger</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 text-[11px] text-slate-400">
              Raw uploads preserved immutably. Missing fields flagged for human review.
            </div>
          </div>
        </div>

        {/* Workflow Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-xl bg-slate-900/40 border border-slate-800 hover:border-slate-700 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold mb-3 text-sm">
              1
            </div>
            <h4 className="text-sm font-medium text-white mb-1">Upload & Immutability</h4>
            <p className="text-xs text-slate-400">
              Original scanned land records are securely archived without alteration.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/40 border border-slate-800 hover:border-slate-700 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center font-bold mb-3 text-sm">
              2
            </div>
            <h4 className="text-sm font-medium text-white mb-1">OCR & Field Extraction</h4>
            <p className="text-xs text-slate-400">
              Extracts Khata, Khasra, Fasli year, and Landholder shares with confidence scoring.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/40 border border-slate-800 hover:border-slate-700 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold mb-3 text-sm">
              3
            </div>
            <h4 className="text-sm font-medium text-white mb-1">Verification & Audit</h4>
            <p className="text-xs text-slate-400">
              Human review for low-confidence fields, cross-checks against demo registry, and append-only audits.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 text-center text-xs text-slate-400">
        BhuVerify Prototype &bull; Demo registry match - not an official government verification
      </footer>
    </div>
  );
}
