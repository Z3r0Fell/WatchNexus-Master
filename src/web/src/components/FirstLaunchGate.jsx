import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Key, Shield, Zap, Crown, ArrowRight, Loader2, ChevronRight,
  User, Lock, Mail, Eye, EyeOff, CheckCircle2,
  Film, AlertTriangle, Copy, RefreshCw
} from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';
import axios from 'axios';
import { BACKEND_URL } from '../lib/config';
import { useAuth } from '../context/AuthContext';

const API = BACKEND_URL;

const TIERS = [
  { id: 'standard', name: 'Standard', icon: Shield, gradient: 'from-gray-600 to-gray-700',
    desc: 'Core media server — library management, streaming, discovery, basic gadgets' },
  { id: 'pro', name: 'Pro', icon: Zap, gradient: 'from-blue-600 to-cyan-600',
    desc: 'Automation, analytics, scheduled tasks, network tools, advanced search' },
  { id: 'ultra', name: 'Ultra', icon: Crown, gradient: 'from-violet-600 to-purple-600',
    desc: 'Full suite — security, media processing, disc ripping, all integrations' },
];

// ══════════════════════════════════════════════════════════════════════
//  FirstLaunchGate — Jellyfin-style OOBE wizard
//  ────────────────────────────────────────────────────────────────
//  Two steps, both blocking the rest of the app until completed:
//    1. Create admin account  (POST /api/auth/setup)
//    2. License tier select   (POST /api/cellar/activate-first-launch)
//  After step 2 the gate dissolves and the user is dropped into the
//  dashboard already authenticated.
// ══════════════════════════════════════════════════════════════════════
export const FirstLaunchGate = ({ children }) => {
  const [checking, setChecking] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [needsLicense, setNeedsLicense] = useState(false);
  const [step, setStep] = useState('admin'); // 'admin' | 'ffmpeg' | 'license' | 'done'
  const [ffmpegStatus, setFfmpegStatus] = useState(null);

  const { setUser, setIsAuthenticated } = useAuth();

  useEffect(() => {
    bootstrap();
  }, []);

  const bootstrap = async () => {
    try {
      const [setupRes, licenseRes] = await Promise.all([
        axios.get(`${API}/api/auth/setup-status`),
        axios.get(`${API}/api/cellar/first-launch`),
      ]);
      const needsAdmin = !!setupRes.data?.needs_setup;
      const needsLic   = !!licenseRes.data?.needs_activation && !licenseRes.data?.setup_completed;
      setNeedsSetup(needsAdmin);
      setNeedsLicense(needsLic);
      setStep(needsAdmin ? 'admin' : (needsLic ? 'license' : 'done'));
    } catch {
      setNeedsSetup(false);
      setNeedsLicense(false);
      setStep('done');
    } finally {
      setChecking(false);
    }
  };

  const onAdminCreated = ({ access_token, user }) => {
    try { localStorage.setItem('token', access_token); } catch { /* SSR/private mode */ }
    if (setUser) setUser(user);
    if (setIsAuthenticated) setIsAuthenticated(true);
    setNeedsSetup(false);
    // Always show FFmpeg step after admin creation so the user knows up front
    // whether transcoding/repair/disc-ripping will work on this machine.
    setStep('ffmpeg');
  };

  const onFfmpegDone = (status) => {
    setFfmpegStatus(status);
    setStep(needsLicense ? 'license' : 'done');
  };

  const onLicenseFinished = () => {
    setNeedsLicense(false);
    setStep('done');
    window.dispatchEvent(new Event('watchnexus_license_changed'));
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-400" data-testid="first-launch-loading" />
      </div>
    );
  }

  if (step === 'done') return children;

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6" data-testid="first-launch-gate">
      <AnimatePresence mode="wait">
        {step === 'admin' && (
          <AdminStep key="admin" onCreated={onAdminCreated} />
        )}
        {step === 'ffmpeg' && (
          <FfmpegStep key="ffmpeg" onDone={onFfmpegDone} />
        )}
        {step === 'license' && (
          <LicenseStep key="license" onFinished={onLicenseFinished} />
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Step 1: create the first admin ────────────────────────────────────
const AdminStep = ({ onCreated }) => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const canSubmit =
    email.trim() && username.trim() && password.length >= 8 && password === confirm && !busy;

  const submit = async (e) => {
    e?.preventDefault();
    if (!canSubmit) {
      if (password.length < 8) toast.error('Password must be at least 8 characters');
      else if (password !== confirm) toast.error('Passwords do not match');
      return;
    }
    setBusy(true);
    try {
      const res = await axios.post(`${API}/api/auth/setup`, {
        email: email.trim(), username: username.trim(), password,
      });
      toast.success(`Admin account created — welcome, ${res.data.user.username}!`);
      onCreated(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create admin account');
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }}
      className="max-w-md w-full space-y-7"
    >
      <div className="text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-2xl shadow-violet-500/30">
          <User className="w-9 h-9 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Welcome to WatchNexus</h1>
        <p className="text-gray-400">Create your administrator account to get started.</p>
        <p className="text-xs text-gray-600 mt-2">Step 1 of 3 — Admin account</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Field icon={Mail} type="email" value={email} onChange={setEmail}
          placeholder="admin@example.com" testid="setup-email" />
        <Field icon={User} type="text" value={username} onChange={setUsername}
          placeholder="Username" testid="setup-username" />
        <Field icon={Lock} type={showPassword ? 'text' : 'password'} value={password}
          onChange={setPassword} placeholder="Password (min 8 chars)" testid="setup-password"
          right={
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="text-gray-500 hover:text-gray-300">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          } />
        <Field icon={Lock} type={showPassword ? 'text' : 'password'} value={confirm}
          onChange={setConfirm} placeholder="Confirm password" testid="setup-confirm" />

        <Button type="submit" disabled={!canSubmit}
          className="w-full h-12 bg-violet-600 hover:bg-violet-700 disabled:opacity-40"
          data-testid="setup-submit-btn">
          {busy
            ? <Loader2 className="w-5 h-5 animate-spin" />
            : <>Create admin <ArrowRight className="w-4 h-4 ml-2" /></>}
        </Button>
      </form>

      <p className="text-xs text-gray-600 text-center">
        This is a fresh install. The first user becomes the administrator and can invite others later.
      </p>
    </motion.div>
  );
};

const Field = ({ icon: Icon, type, value, onChange, placeholder, testid, right }) => (
  <div className="relative">
    <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      data-testid={testid}
      className="w-full h-12 pl-10 pr-10 bg-black/40 border border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
    />
    {right && <div className="absolute right-3 top-1/2 -translate-y-1/2">{right}</div>}
  </div>
);

// ── Step 2: FFmpeg detection ─────────────────────────────────────────
const FfmpegStep = ({ onDone }) => {
  const [status, setStatus] = useState(null);
  const [checking, setChecking] = useState(true);
  const [copied, setCopied] = useState(false);

  const probe = async () => {
    setChecking(true);
    try {
      const token = (() => { try { return localStorage.getItem('token'); } catch { return null; } })();
      const res = await axios.get(`${API}/api/crucible/ffmpeg-status`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setStatus(res.data);
    } catch (err) {
      setStatus({ ffmpeg_installed: false, error: err.message });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => { probe(); }, []);

  const installed = !!status?.ffmpeg_installed;
  const probeInstalled = !!status?.ffprobe_installed;
  const hint = status?.install_hint;

  const copy = () => {
    if (!hint) return;
    try { navigator.clipboard.writeText(hint); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { /* clipboard unavailable */ }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }}
      className="max-w-xl w-full space-y-7"
    >
      <div className="text-center">
        <div className={`w-20 h-20 mx-auto mb-6 rounded-3xl flex items-center justify-center shadow-2xl ${
          installed
            ? 'bg-gradient-to-br from-emerald-600 to-green-700 shadow-emerald-500/30'
            : 'bg-gradient-to-br from-amber-600 to-orange-700 shadow-amber-500/30'
        }`}>
          {installed ? <Film className="w-9 h-9 text-white" /> : <AlertTriangle className="w-9 h-9 text-white" />}
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">FFmpeg detection</h1>
        <p className="text-gray-400">
          {installed
            ? 'FFmpeg is installed. Transcoding, playback, repair and disc-ripping are all available.'
            : "FFmpeg isn't installed on this machine. WatchNexus runs without it, but transcoding, repair and disc-ripping will be disabled until you install it."}
        </p>
        <p className="text-xs text-gray-600 mt-2">Step 2 of 3 — FFmpeg</p>
      </div>

      {checking && (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 flex items-center justify-center gap-3 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" /> Probing system for ffmpeg / ffprobe...
        </div>
      )}

      {!checking && status && (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 space-y-3">
          <DetectionRow label="ffmpeg"  installed={installed}        path={status.ffmpeg_path}  />
          <DetectionRow label="ffprobe" installed={probeInstalled}   path={status.ffprobe_path} />
          {status.ffmpeg_version && (
            <p className="text-xs text-gray-500 mt-2 pt-3 border-t border-white/5 font-mono break-all">
              {status.ffmpeg_version}
            </p>
          )}
        </div>
      )}

      {!checking && !installed && hint && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5">
          <p className="text-amber-200 text-sm font-medium mb-3">Install command for this system:</p>
          <div className="flex items-center gap-2 bg-black/40 border border-amber-500/20 rounded-lg p-3">
            <code className="flex-1 text-amber-100 text-sm font-mono break-all">{hint}</code>
            <button onClick={copy} className="shrink-0 p-2 hover:bg-amber-500/10 rounded-md transition-colors"
              data-testid="ffmpeg-copy-hint">
              {copied
                ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                : <Copy className="w-4 h-4 text-amber-300" />}
            </button>
          </div>
          <p className="text-xs text-amber-300/70 mt-3">
            Run the command above in a terminal, then click <strong>Re-check</strong> below.
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={probe} disabled={checking}
          className="flex-1 h-12 bg-white/5 border-white/10 text-white hover:bg-white/10"
          data-testid="ffmpeg-recheck-btn">
          {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <><RefreshCw className="w-4 h-4 mr-2" /> Re-check</>}
        </Button>
        <Button onClick={() => onDone(status)}
          className="flex-1 h-12 bg-violet-600 hover:bg-violet-700"
          data-testid="ffmpeg-continue-btn">
          {installed ? 'Continue' : 'Continue without FFmpeg'} <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </motion.div>
  );
};

const DetectionRow = ({ label, installed, path }) => (
  <div className="flex items-center gap-3">
    {installed
      ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
      : <div className="w-5 h-5 rounded-full border-2 border-amber-500/50 shrink-0" />}
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <span className="text-white font-medium">{label}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          installed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
        }`}>
          {installed ? 'detected' : 'not found'}
        </span>
      </div>
      {path && <p className="text-xs text-gray-500 font-mono truncate" title={path}>{path}</p>}
    </div>
  </div>
);

// ── Step 3: pick license tier ────────────────────────────────────────
const LicenseStep = ({ onFinished }) => {
  const [serial, setSerial] = useState('');
  const [busy, setBusy] = useState(false);

  const activate = async () => {
    if (!serial.trim()) { toast.error('Enter a serial number or click Skip'); return; }
    setBusy(true);
    try {
      const res = await axios.post(`${API}/api/cellar/activate-first-launch`, { serial: serial.trim() });
      if (res.data.success) {
        toast.success(res.data.message || 'License activated');
        onFinished();
      } else {
        toast.error(res.data.message || 'Activation failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid serial number');
    } finally {
      setBusy(false);
    }
  };

  const skip = async () => {
    setBusy(true);
    try { await axios.post(`${API}/api/cellar/activate-first-launch`, { skip: true }); } catch { /* ignore */ }
    onFinished();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }}
      className="max-w-2xl w-full space-y-8"
    >
      <div className="text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-2xl shadow-violet-500/30">
          <Key className="w-9 h-9 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Choose your edition</h1>
        <p className="text-gray-400">Enter your serial number to unlock Pro or Ultra, or continue with Standard.</p>
        <p className="text-xs text-gray-600 mt-2">Step 3 of 3 — License</p>
      </div>

      <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
        <div className="flex gap-3">
          <input
            type="text"
            value={serial}
            onChange={(e) => setSerial(e.target.value.toUpperCase())}
            placeholder="Enter serial number..."
            className="flex-1 px-4 py-3.5 bg-black/40 border border-white/10 rounded-xl text-white font-mono text-lg tracking-wider placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            data-testid="first-launch-serial-input"
            onKeyDown={(e) => e.key === 'Enter' && activate()}
          />
          <Button
            onClick={activate}
            disabled={busy || !serial.trim()}
            className="px-6 shrink-0 bg-violet-600 hover:bg-violet-700"
            data-testid="first-launch-activate-btn"
          >
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {TIERS.map((t) => {
          const Icon = t.icon;
          return (
            <div key={t.id} className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${t.gradient} flex items-center justify-center`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-white text-sm">{t.name}</span>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">{t.desc}</p>
            </div>
          );
        })}
      </div>

      <div className="text-center">
        <button
          onClick={skip}
          disabled={busy}
          className="text-sm text-gray-500 hover:text-gray-300 transition-colors inline-flex items-center"
          data-testid="first-launch-skip-btn"
        >
          Continue with Standard (free) <ChevronRight className="w-3 h-3 inline ml-0.5" />
        </button>
      </div>
    </motion.div>
  );
};
