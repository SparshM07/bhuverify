import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { publicVerifyAPI } from '../services/api';
import {
  Check,
  Clock,
  Ban,
  AlertOctagon,
  Info,
  X,
  FileCheck2,
  Database,
  UserCheck
} from 'lucide-react';
import StatusChip from '../components/ui/StatusChip';

export default function PublicVerifyPage() {
  const { token } = useParams();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState(null);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

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
      return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return isoString;
    }
  };

  // Determine variant
  const isRevoked = result?.status === 'revoked';
  const isExpired = result?.status === 'expired';
  const isInvalid = errorStatus === 404 || (!loading && !result);
  const isRateLimited = errorStatus === 429;
  const isGenericError = errorStatus && errorStatus !== 404 && errorStatus !== 429;
  const isValid = !loading && result && !isRevoked && !isExpired;

  return (
    <div className="min-h-screen bg-[#eff3fe] sm:bg-[#f1f5f9] flex flex-col items-center justify-center p-3.5 sm:p-6 antialiased font-sans">
      {/* Brand Header matching 11.png */}
      <div className="text-center mb-4">
        <h1 className="text-xl font-bold tracking-tight text-[#061b6a]">
          BhuVerify
        </h1>
        <p className="text-xs text-slate-500 font-normal mt-0.5">
          Land record verification
        </p>
      </div>

      {/* Single Centered Verification Card matching 11.png (responsive at 390px) */}
      <div className="w-full max-w-[390px] bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 text-slate-900 transition-all">
        {loading ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-10 h-10 border-3 border-blue-600/20 border-t-[#044eed] rounded-full animate-spin mx-auto" />
            <p className="text-xs font-medium text-slate-600">Verifying security token...</p>
          </div>
        ) : isRevoked ? (
          /* =================================================================== */
          /* VARIANT 3: LINK REVOKED (Zero document details shown)               */
          /* =================================================================== */
          <div className="space-y-4">
            <div className="bg-[#feecec] rounded-xl p-5 text-center">
              <div className="w-14 h-14 bg-[#fed7d7] rounded-full mx-auto flex items-center justify-center mb-3 text-[#dc2626]">
                <Ban className="w-7 h-7 stroke-[2.2]" />
              </div>
              <h2 className="text-lg font-bold text-[#991b1b]">
                Link revoked
              </h2>
              <p className="text-xs text-[#991b1b]/85 mt-1 leading-snug">
                This verification link has been revoked and is no longer available.
              </p>
            </div>

            <div className="text-center text-xs text-slate-500 py-4 px-2 leading-relaxed">
              The link may have been revoked by the authorised user.
            </div>

            {/* Bordered Demo Notice */}
            <div className="bg-[#fffbeb] border border-[#fef08a] rounded-xl p-3.5 flex items-start gap-2.5 text-left">
              <Info className="w-4 h-4 text-[#a16207] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-xs text-[#854d0e] leading-snug">
                  This is a demonstration.
                </p>
                <p className="font-semibold text-xs text-[#854d0e] leading-snug mb-1">
                  Not an official government verification.
                </p>
                <p className="text-[11px] leading-relaxed text-[#a16207]">
                  This is a demo system with synthetic data and should not be used as proof of ownership or for any legal purpose.
                </p>
              </div>
            </div>
          </div>
        ) : isExpired ? (
          /* =================================================================== */
          /* VARIANT 2: LINK EXPIRED (Zero document details shown)               */
          /* =================================================================== */
          <div className="space-y-4">
            <div className="bg-[#feecec] rounded-xl p-5 text-center">
              <div className="w-14 h-14 bg-[#fed7d7] rounded-full mx-auto flex items-center justify-center mb-3 text-[#dc2626]">
                <Clock className="w-7 h-7 stroke-[2.2]" />
              </div>
              <h2 className="text-lg font-bold text-[#991b1b]">
                Link expired
              </h2>
              <p className="text-xs text-[#991b1b]/85 mt-1 leading-snug">
                This verification link has expired and is no longer available.
              </p>
            </div>

            <div className="text-center text-xs text-slate-500 py-4 px-2 leading-relaxed">
              For security reasons, verification links are valid only for a limited time.
            </div>

            {/* Bordered Demo Notice */}
            <div className="bg-[#fffbeb] border border-[#fef08a] rounded-xl p-3.5 flex items-start gap-2.5 text-left">
              <Info className="w-4 h-4 text-[#a16207] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-xs text-[#854d0e] leading-snug">
                  This is a demonstration.
                </p>
                <p className="font-semibold text-xs text-[#854d0e] leading-snug mb-1">
                  Not an official government verification.
                </p>
                <p className="text-[11px] leading-relaxed text-[#a16207]">
                  This is a demo system with synthetic data and should not be used as proof of ownership or for any legal purpose.
                </p>
              </div>
            </div>
          </div>
        ) : isRateLimited ? (
          /* RATE LIMIT VARIANT */
          <div className="space-y-4">
            <div className="bg-amber-50 rounded-xl p-5 text-center">
              <div className="w-14 h-14 bg-amber-100 rounded-full mx-auto flex items-center justify-center mb-3 text-amber-600">
                <Clock className="w-7 h-7 stroke-[2.2]" />
              </div>
              <h2 className="text-lg font-bold text-amber-900">
                Rate limit reached
              </h2>
              <p className="text-xs text-amber-800/85 mt-1 leading-snug">
                Too many requests. Please wait 60 seconds before checking again.
              </p>
            </div>

            <div className="bg-[#fffbeb] border border-[#fef08a] rounded-xl p-3.5 flex items-start gap-2.5 text-left">
              <Info className="w-4 h-4 text-[#a16207] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-xs text-[#854d0e] leading-snug">
                  This is a demonstration.
                </p>
                <p className="text-[11px] leading-relaxed text-[#a16207]">
                  Public token lookups are rate-limited to preserve service availability.
                </p>
              </div>
            </div>
          </div>
        ) : isInvalid || isGenericError ? (
          /* INVALID / 404 VARIANT */
          <div className="space-y-4">
            <div className="bg-[#feecec] rounded-xl p-5 text-center">
              <div className="w-14 h-14 bg-[#fed7d7] rounded-full mx-auto flex items-center justify-center mb-3 text-[#dc2626]">
                <AlertOctagon className="w-7 h-7 stroke-[2.2]" />
              </div>
              <h2 className="text-lg font-bold text-[#991b1b]">
                Invalid verification link
              </h2>
              <p className="text-xs text-[#991b1b]/85 mt-1 leading-snug">
                This verification link was not recognized or is no longer valid.
              </p>
            </div>

            <div className="text-center text-xs text-slate-500 py-4 px-2 leading-relaxed">
              The link or QR code may be corrupted, expired, or the document was revoked.
            </div>

            <div className="bg-[#fffbeb] border border-[#fef08a] rounded-xl p-3.5 flex items-start gap-2.5 text-left">
              <Info className="w-4 h-4 text-[#a16207] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-xs text-[#854d0e] leading-snug">
                  This is a demonstration.
                </p>
                <p className="font-semibold text-xs text-[#854d0e] leading-snug mb-1">
                  Not an official government verification.
                </p>
                <p className="text-[11px] leading-relaxed text-[#a16207]">
                  This is a demo system with synthetic data and should not be used as proof of ownership or for any legal purpose.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* =================================================================== */
          /* VARIANT 1: REVIEWED AND APPROVED (Minimal details, ZERO PII)        */
          /* =================================================================== */
          <div className="space-y-3.5">
            {/* Status Block matching 11.png */}
            <div className="bg-[#eef9f2] rounded-xl p-5 text-center">
              <div className="w-14 h-14 bg-[#c8eed5] rounded-full mx-auto flex items-center justify-center mb-3 text-[#16a34a]">
                <Check className="w-7 h-7 stroke-[2.8]" />
              </div>
              <h2 className="text-lg font-bold text-[#166534]">
                Reviewed and approved
              </h2>
              <p className="text-xs text-[#166534]/85 mt-1 leading-snug">
                This land record has been reviewed and verified in the BhuVerify system.
              </p>
            </div>

            {/* Minimal Details List matching 11.png (Zero Personal Data) */}
            <div className="divide-y divide-slate-100 text-xs">
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500">Document reference</span>
                <span className="font-semibold text-slate-900 font-mono">
                  {result.document_reference || 'BV-2026-000129'}
                </span>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500">Upload date</span>
                <span className="text-slate-700 font-medium">
                  {formatDate(result.upload_date)}
                </span>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500">Review status</span>
                <StatusChip status={result.review_status || 'approved'} />
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500">Verification method</span>
                <span className="text-slate-700 font-medium">Demo registry</span>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500">File integrity</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#eef9f2] text-[#166534] border border-[#c8eed5]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
                  Unchanged
                </span>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500">Last checked</span>
                <span className="text-slate-700 font-medium">
                  {formatDate(result.last_checked_time)}
                </span>
              </div>
            </div>

            {/* Bordered Demo Notice Box matching 11.png */}
            <div className="bg-[#fffbeb] border border-[#fef08a] rounded-xl p-3.5 flex items-start gap-2.5 text-left mt-3">
              <Info className="w-4 h-4 text-[#a16207] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-xs text-[#854d0e] leading-snug">
                  This is a demonstration.
                </p>
                <p className="font-semibold text-xs text-[#854d0e] leading-snug mb-1">
                  Not an official government verification.
                </p>
                <p className="text-[11px] leading-relaxed text-[#a16207]">
                  This record is part of a demo system with synthetic data and should not be used as proof of ownership or for any legal purpose.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* "How verification works →" Link matching 11.png */}
      <div className="text-center mt-4">
        <button
          type="button"
          onClick={() => setShowHowItWorks(true)}
          className="text-xs font-medium text-[#044eed] hover:underline inline-flex items-center gap-1 transition cursor-pointer"
        >
          How verification works &rarr;
        </button>
      </div>

      {/* Informational Modal: How Verification Works */}
      {showHowItWorks && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 p-5 shadow-xl space-y-4 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                How Verification Works
              </h3>
              <button
                type="button"
                onClick={() => setShowHowItWorks(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              BhuVerify uses a multi-layered verification protocol to confirm document integrity without exposing confidential owner information:
            </p>

            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-blue-50 text-[#044eed] flex items-center justify-center shrink-0 mt-0.5">
                  <FileCheck2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <strong className="text-slate-800 block">1. File Integrity</strong>
                  <span className="text-slate-500 text-[11px] leading-relaxed">
                    A cryptographic SHA-256 checksum guarantees the digital document is authentic and unmodified.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-emerald-50 text-[#16a34a] flex items-center justify-center shrink-0 mt-0.5">
                  <Database className="w-3.5 h-3.5" />
                </div>
                <div>
                  <strong className="text-slate-800 block">2. Demo Registry Match</strong>
                  <span className="text-slate-500 text-[11px] leading-relaxed">
                    Extracted attributes are validated against simulated land revenue registry datasets.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                  <UserCheck className="w-3.5 h-3.5" />
                </div>
                <div>
                  <strong className="text-slate-800 block">3. Authorized Reviewer Signoff</strong>
                  <span className="text-slate-500 text-[11px] leading-relaxed">
                    Official verification decisions are signed by authorized Tehsil reviewers before public token issuance.
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHowItWorks(false)}
                className="px-4 py-1.5 rounded-lg bg-[#044eed] hover:bg-blue-700 text-white text-xs font-medium transition"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
