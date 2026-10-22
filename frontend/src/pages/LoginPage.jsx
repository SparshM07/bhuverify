import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button, Tooltip } from '../components/ui';
import {
  UploadCloud,
  CheckCircle2,
  Share2,
  Eye,
  EyeOff,
  User,
  ShieldCheck,
  Settings,
  Info,
  AlertCircle,
} from 'lucide-react';

const DEMO_ACCOUNTS = [
  {
    role: 'Clerk',
    email: 'clerk@bhuverify.test',
    password: 'ClerkPass123!',
    icon: User,
  },
  {
    role: 'Reviewer',
    email: 'reviewer@bhuverify.test',
    password: 'ReviewerPass123!',
    icon: ShieldCheck,
  },
  {
    role: 'Viewer',
    email: 'viewer@bhuverify.test',
    password: 'ViewerPass123!',
    icon: Eye,
  },
  {
    role: 'Admin',
    email: 'admin@bhuverify.test',
    password: 'AdminPass123!',
    icon: Settings,
  },
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isSessionExpired = new URLSearchParams(location.search).get('session_expired') === '1';
  const from = location.state?.from?.pathname || '/dashboard';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both email address and password.');
      return;
    }

    setErrorMsg('');
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);

    if (result.success) {
      navigate(from, { replace: true });
    } else {
      setErrorMsg(result.error);
    }
  };

  const handlePreFill = (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setErrorMsg('');
  };

  return (
    <div className="min-h-screen bg-[#eff3fe] flex items-center justify-center p-4 sm:p-6 md:p-8 antialiased font-sans">
      {/* Main Two-Column Card matching 1.png */}
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row border border-slate-200/80">
        {/* Left Column: Royal Navy Blue Panel */}
        <div className="w-full md:w-[42%] bg-[#1e4088] text-white p-8 md:p-10 flex flex-col justify-between relative overflow-hidden shrink-0 min-h-[480px]">
          {/* Content */}
          <div className="relative z-10">
            {/* Logo matching 1.png */}
            <div className="flex items-center gap-3.5 mb-6">
              <div className="shrink-0 text-white">
                <svg
                  className="w-12 h-12"
                  viewBox="0 0 48 48"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {/* Document outline */}
                  <rect
                    x="6"
                    y="4"
                    width="28"
                    height="38"
                    rx="4"
                    stroke="white"
                    strokeWidth="3.2"
                    fill="none"
                  />
                  {/* Lines inside document */}
                  <line x1="12" y1="12" x2="26" y2="12" stroke="white" strokeWidth="2.8" strokeLinecap="round" />
                  <line x1="12" y1="18" x2="26" y2="18" stroke="white" strokeWidth="2.8" strokeLinecap="round" />
                  <line x1="12" y1="24" x2="20" y2="24" stroke="white" strokeWidth="2.8" strokeLinecap="round" />
                  <line x1="12" y1="30" x2="18" y2="30" stroke="white" strokeWidth="2.8" strokeLinecap="round" />
                  {/* Circular checkmark badge overlapping bottom right */}
                  <circle cx="33" cy="34" r="8" fill="white" />
                  <path
                    d="M29 34l3 3 5-5"
                    stroke="#1e4088"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <span className="text-3xl md:text-4xl font-bold tracking-tight text-white">
                BhuVerify
              </span>
            </div>

            {/* Subtle Divider */}
            <div className="w-full h-px bg-white/20 my-6" />

            {/* Headline */}
            <h2 className="text-xl md:text-2xl font-bold text-white mb-8 tracking-tight">
              Land record digitisation and review
            </h2>

            {/* Feature Bullets matching 1.png */}
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center shrink-0 text-white">
                  <UploadCloud className="w-5 h-5 stroke-[2.2]" />
                </div>
                <span className="text-white font-medium text-sm md:text-base">
                  Upload and extract
                </span>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center shrink-0 text-white">
                  <CheckCircle2 className="w-5 h-5 stroke-[2.2]" />
                </div>
                <span className="text-white font-medium text-sm md:text-base">
                  Review and verify
                </span>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center shrink-0 text-white">
                  <Share2 className="w-5 h-5 stroke-[2.2]" />
                </div>
                <span className="text-white font-medium text-sm md:text-base">
                  Share a verification link
                </span>
              </div>
            </div>
          </div>

          {/* Heritage Architectural Skyline Silhouette matching 1.png */}
          <div className="relative mt-12 pt-6 -mx-8 md:-mx-10 -mb-8 md:-mb-10 pointer-events-none opacity-30 select-none">
            <svg
              className="w-full h-24 text-white"
              viewBox="0 0 400 100"
              preserveAspectRatio="none"
              fill="currentColor"
            >
              {/* Palace / Tehsil Silhouette */}
              <rect x="0" y="85" width="400" height="15" />
              {/* Left wing */}
              <rect x="15" y="65" width="40" height="20" />
              <rect x="25" y="55" width="20" height="10" />
              <polygon points="35,45 25,55 45,55" />
              {/* Left colonnade */}
              <rect x="60" y="60" width="70" height="25" />
              <rect x="68" y="50" width="12" height="10" />
              <polygon points="74,42 66,50 82,50" />
              <rect x="110" y="50" width="12" height="10" />
              <polygon points="116,42 108,50 124,50" />
              {/* Central grand dome */}
              <rect x="140" y="50" width="120" height="35" />
              <rect x="165" y="38" width="70" height="12" />
              <path d="M175,38 C175,18 225,18 225,38 Z" />
              <rect x="198" y="10" width="4" height="8" />
              {/* Right colonnade */}
              <rect x="270" y="60" width="70" height="25" />
              <rect x="278" y="50" width="12" height="10" />
              <polygon points="284,42 276,50 292,50" />
              <rect x="320" y="50" width="12" height="10" />
              <polygon points="326,42 318,50 334,50" />
              {/* Right wing */}
              <rect x="345" y="65" width="40" height="20" />
              <rect x="355" y="55" width="20" height="10" />
              <polygon points="365,45 355,55 375,55" />
              {/* Arched windows */}
              <circle cx="175" cy="62" r="3" fill="#1e4088" />
              <circle cx="190" cy="62" r="3" fill="#1e4088" />
              <circle cx="200" cy="62" r="3" fill="#1e4088" />
              <circle cx="210" cy="62" r="3" fill="#1e4088" />
              <circle cx="225" cy="62" r="3" fill="#1e4088" />
            </svg>
          </div>
        </div>

        {/* Right Column: White Form Panel */}
        <div className="w-full md:w-[58%] p-8 md:p-12 flex flex-col justify-between bg-white">
          <div>
            {/* Title & Subtitle matching 1.png */}
            <div className="mb-6">
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                Sign in
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Access your BhuVerify account
              </p>
            </div>

            {/* Error Banner */}
            {isSessionExpired && !errorMsg && (
              <div className="mb-5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>Your session has expired (401 Unauthorized). Please sign in again.</span>
              </div>
            )}

            {errorMsg && (
              <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-[#dc2626]" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Sign in Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Email <span className="text-[#dc2626]">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#044eed] focus:ring-2 focus:ring-blue-500/20 transition-colors"
                />
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Password <span className="text-[#dc2626]">*</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#044eed] focus:ring-2 focus:ring-blue-500/20 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-slate-400 hover:text-slate-600 p-0.5 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember me & Forgot password row */}
              <div className="flex items-center justify-between pt-1">
                <Tooltip content="Remember me (Coming soon)">
                  <label className="flex items-center gap-2 text-xs text-slate-500 cursor-not-allowed select-none">
                    <input
                      type="checkbox"
                      disabled
                      className="w-4 h-4 rounded border-slate-300 text-slate-400 cursor-not-allowed"
                    />
                    <span>Remember me</span>
                  </label>
                </Tooltip>

                <Tooltip content="Password recovery (Coming soon)">
                  <button
                    type="button"
                    disabled
                    className="text-xs font-medium text-[#1e4088] opacity-75 hover:opacity-100 cursor-not-allowed select-none transition-colors"
                  >
                    Forgot password?
                  </button>
                </Tooltip>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <Button
                  type="submit"
                  loading={loading}
                  className="w-full bg-[#1e4088] hover:bg-[#183570] text-white py-2.5 rounded-lg font-medium text-sm shadow-sm transition"
                >
                  Sign in
                </Button>
              </div>
            </form>

            {/* Demo Accounts Card matching 1.png */}
            <div className="mt-6 rounded-xl bg-[#f4f6fa] border border-slate-200/90 p-4">
              <h3 className="text-sm font-bold text-slate-900 leading-tight">
                Demo accounts
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 mb-3">
                Quickly try different roles using the demo accounts below:
              </p>

              <div className="space-y-2">
                {DEMO_ACCOUNTS.map((acc) => {
                  const Icon = acc.icon;
                  return (
                    <div
                      key={acc.role}
                      className="flex items-center justify-between py-1.5 px-1 group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className="w-4 h-4 text-[#1e4088] shrink-0" />
                        <span className="text-xs font-semibold text-slate-800">
                          {acc.role}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono hidden sm:inline truncate">
                          ({acc.email})
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handlePreFill(acc.email, acc.password)}
                        className="px-3 py-1 rounded-md bg-white border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400 transition shadow-xs"
                      >
                        Use
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Demo Environment Disclaimer matching 1.png */}
            <div className="mt-4 p-2.5 px-3 rounded-lg bg-[#fef8e2] border border-[#fde68a] flex items-center gap-2 text-xs text-[#74430b] font-medium select-none">
              <div className="w-4 h-4 rounded-full bg-[#74430b] text-white flex items-center justify-center shrink-0 text-[10px] font-bold">
                i
              </div>
              <span>Demo environment with synthetic data.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
