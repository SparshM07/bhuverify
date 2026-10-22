import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { publicVerifyAPI } from '../services/api';
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertOctagon,
  FileText,
  Calendar,
  Layers,
  ExternalLink,
  Lock,
  ArrowRight
} from 'lucide-react';

export default function PublicVerifyPage() {
  const { token } = useParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState(null);

  useEffect(() => {
    if (token) {
      setLoading(true);
      setErrorStatus(null);
      publicVerifyAPI.verifyToken(token)
        .then((res) => {
          if (res.status === 200) {
            setResult(res.data);
          } else if (res.status === 404) {
            setErrorStatus(404);
          } else if (res.status === 429) {
            setErrorStatus(429);
          } else {
            setErrorStatus(res.status);
          }
        })
        .catch(() => {
          setErrorStatus(500);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [token]);

  const formatDate = (isoString) => {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Top Header */}
      <header className="max-w-3xl mx-auto w-full flex items-center justify-between pb-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-bold shadow-lg shadow-emerald-500/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">BhuVerify Public Registry</h1>
            <p className="text-xs text-slate-400">Department of Revenue & Land Records Verification</p>
          </div>
        </div>
        <div className="text-[11px] font-mono px-2.5 py-1 rounded bg-slate-900 text-slate-400 border border-slate-800">
          SECURE PROTOCOL
        </div>
      </header>

      {/* Main Content Card */}
      <main className="max-w-2xl mx-auto w-full my-8">
        {loading ? (
          <div className="p-12 rounded-3xl bg-slate-900/90 border border-slate-800 text-center space-y-4 shadow-xl">
            <div className="w-10 h-10 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto" />
            <div className="text-sm font-medium text-slate-300">Validating Cryptographic Share Token...</div>
            <p className="text-xs text-slate-500">Checking revocation registry and ledger signatures.</p>
          </div>
        ) : errorStatus === 429 ? (
          <div className="p-8 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-center space-y-4 shadow-xl">
            <Clock className="w-12 h-12 text-amber-400 mx-auto" />
            <h2 className="text-xl font-bold text-white">Rate Limit Exceeded</h2>
            <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
              Too many verification requests received from this address. Please wait 60 seconds before checking again.
            </p>
          </div>
        ) : errorStatus === 404 || !result ? (
          <div className="p-8 rounded-3xl bg-rose-500/10 border border-rose-500/30 text-center space-y-4 shadow-xl">
            <AlertOctagon className="w-12 h-12 text-rose-400 mx-auto" />
            <h2 className="text-xl font-bold text-white">Invalid Verification Token</h2>
            <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
              This verification token was not recognized in the departmental registry. The link or QR code may be corrupted or forged.
            </p>
          </div>
        ) : result.status === 'revoked' ? (
          /* REVOKED TOKEN STATE: Shows ONLY Revoked Status (Zero PII / details leaked) */
          <div className="p-8 rounded-3xl bg-rose-500/10 border border-rose-500/30 text-center space-y-4 shadow-xl">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase tracking-wider font-mono">
              Status: Revoked
            </div>
            <h2 className="text-2xl font-bold text-white">Share Token Revoked</h2>
            <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
              This public verification share token was officially revoked by departmental reviewers. The underlying record cannot be verified through this link.
            </p>
            <div className="pt-2 text-[11px] text-slate-500 font-mono">
              {result.disclaimer}
            </div>
          </div>
        ) : result.status === 'expired' ? (
          /* EXPIRED TOKEN STATE: Shows ONLY Expired Status (Zero PII / details leaked) */
          <div className="p-8 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-center space-y-4 shadow-xl">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
              <Clock className="w-8 h-8" />
            </div>
            <div className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider font-mono">
              Status: Expired
            </div>
            <h2 className="text-2xl font-bold text-white">Share Token Expired</h2>
            <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
              This public verification share token has expired after its designated retention window. Please request an updated QR code or verification link.
            </p>
            <div className="pt-2 text-[11px] text-slate-500 font-mono">
              {result.disclaimer}
            </div>
          </div>
        ) : (
          /* VALID APPROVED VERIFICATION STATE */
          <div className="p-8 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-6 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-md shadow-emerald-500/10">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white tracking-tight">Record Verified</h2>
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                      OFFICIAL REVIEW COMPLETED
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">Authenticity confirmed via cryptographic checksum and clerk approval.</p>
                </div>
              </div>
            </div>

            {/* Sanitized Minimal Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Document Reference</span>
                <div className="text-sm font-semibold text-white truncate font-mono">
                  {result.document_reference || 'Khatauni Record Specimen'}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Review Status</span>
                <div className="text-sm font-semibold text-emerald-400 capitalize flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  {result.review_status || 'Approved'}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Ingestion Timestamp</span>
                <div className="text-xs font-mono text-slate-300">
                  {formatDate(result.upload_date)}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Cryptographic Integrity</span>
                <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  {result.integrity_status || 'Verified Intact'}
                </div>
              </div>
            </div>

            {/* Verification Method & Live Verification Timestamp */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Verification Method:</span>
                <span className="text-slate-200 font-mono text-right">{result.verification_method}</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/60">
                <span className="text-slate-400 font-medium">Checked At:</span>
                <span className="text-emerald-400 font-mono">{formatDate(result.last_checked_time)}</span>
              </div>
            </div>

            {/* Disclaimer Banner */}
            <div className="p-3 rounded-xl bg-slate-950 text-center border border-slate-800/80">
              <p className="text-[11px] text-amber-300/80 font-mono">
                {result.disclaimer || 'Demo registry match - not an official government verification'}
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-3xl mx-auto w-full pt-6 border-t border-slate-800 text-center text-xs text-slate-500">
        <p>© 2026 BhuVerify Prototype • Secure State Cadastral Verification System</p>
      </footer>
    </div>
  );
}
