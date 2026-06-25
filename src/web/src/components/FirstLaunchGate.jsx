import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Key, Shield, Zap, Crown, ArrowRight, ArrowLeft, Loader2, ChevronRight,
  User, Lock, Mail, Eye, EyeOff, CheckCircle2, Server, Palette,
  Film, Tv, Music, Sparkles, AlertTriangle, Copy, RefreshCw,
  FolderOpen, Rocket, PlayCircle, Terminal, Check, SkipForward,
} from 'lucide-react';
import { Button } from './ui/button';
import { LanguageSwitcher } from './LanguageSwitcher';
import { toast } from 'sonner';
import axios from 'axios';
import { BACKEND_URL } from '../lib/config';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/watchnexus-logo.png';

const API = BACKEND_URL;

const WELCOME_BG = 'https://images.unsplash.com/photo-1561722798-9a732d141027?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzZ8MHwxfHNlYXJjaHwzfHxob21lJTIwdGhlYXRlciUyMGNpbmVtYXRpY3xlbnwwfHx8fDE3ODIzODc3NjF8MA&ixlib=rb-4.1.0&q=85';
const FINISH_BG = 'https://images.pexels.com/photos/19374140/pexels-photo-19374140.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940';

const ACCENTS = [
  { id: 'amber',   hex: '#F59E0B', name: 'Amber' },
  { id: 'crimson', hex: '#E11D48', name: 'Crimson' },
  { id: 'emerald', hex: '#10B981', name: 'Emerald' },
  { id: 'sky',     hex: '#0EA5E9', name: 'Sky' },
  { id: 'violet',  hex: '#8B5CF6', name: 'Violet' },
  { id: 'rose',    hex: '#FB7185', name: 'Rose' },
];

const LIB_TYPES = [
  { id: 'movies', name: 'Movies', icon: Film },
  { id: 'tv',     name: 'TV Shows', icon: Tv },
  { id: 'music',  name: 'Music', icon: Music },
  { id: 'anime',  name: 'Anime', icon: Sparkles },
];

const TIERS = [
  { id: 'standard', name: 'Standard', icon: Shield, free: true,
    desc: 'Core media server — library management, streaming, discovery, basic gadgets.' },
  { id: 'pro', name: 'Pro', icon: Zap, free: false,
    desc: 'Automation, analytics, scheduled tasks, network tools, advanced search.' },
  { id: 'ultra', name: 'Ultra', icon: Crown, free: false, glow: true,
    desc: 'Full suite — security, media processing, disc ripping, all integrations.' },
];

const fade = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
};

// ══════════════════════════════════════════════════════════════════════
//  FirstLaunchGate — premium cinematic OOBE wizard
//  welcome → admin → server-identity → ffmpeg → library → license → finish
// ══════════════════════════════════════════════════════════════════════
export const FirstLaunchGate = ({ children }) => {
  const [checking, setChecking] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [needsLicense, setNeedsLicense] = useState(false);
  const [steps, setSteps] = useState([]);
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);
  const [accent, setAccent] = useState('#F59E0B');
  const [summary, setSummary] = useState({});

  const { setUser, setIsAuthenticated } = useAuth();

  useEffect(() => { bootstrap(); }, []);

  const bootstrap = async () => {
    try {
      const [setupRes, licenseRes] = await Promise.all([
        axios.get(`${API}/api/auth/setup-status`),
        axios.get(`${API}/api/cellar/first-launch`),
      ]);
      const needsAdmin = !!setupRes.data?.needs_setup;
      const needsLic = !!licenseRes.data?.needs_activation && !licenseRes.data?.setup_completed;
      setNeedsSetup(needsAdmin);
      setNeedsLicense(needsLic);

      let seq;
      if (needsAdmin) {
        seq = ['welcome', 'admin', 'identity', 'ffmpeg', 'library'];
        if (needsLic) seq.push('license');
        seq.push('finish');
      } else if (needsLic) {
        seq = ['license', 'finish'];
      } else {
        seq = [];
      }
      setSteps(seq);
      if (seq.length === 0) setDone(true);
    } catch {
      setDone(true);
    } finally {
      setChecking(false);
    }
  };

  const current = steps[idx];
  const next = () => { if (idx < steps.length - 1) setIdx(idx + 1); else setDone(true); };
  const back = () => { if (idx > 0) setIdx(idx - 1); };
  const merge = (patch) => setSummary((s) => ({ ...s, ...patch }));

  const onAdminCreated = ({ user }) => {
    if (setUser) setUser(user);
    if (setIsAuthenticated) setIsAuthenticated(true);
    merge({ admin: user?.username });
    // Welcome + Admin are irreversible once the account exists (POST /setup then
    // 409s). Drop them from the sequence so Back can never trap the user on a
    // dead step; Identity becomes the new first (back-disabled) step.
    setSteps((prev) => {
      const i = prev.indexOf('identity');
      return i >= 0 ? prev.slice(i) : prev;
    });
    setIdx(0);
  };

  const finishWizard = () => {
    window.dispatchEvent(new Event('watchnexus_license_changed'));
    setDone(true);
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: accent }} data-testid="first-launch-loading" />
      </div>
    );
  }

  if (done || steps.length === 0) return children;

  const showRail = needsSetup; // full flow shows the rail; license-only path is compact

  return (
    <div
      className="min-h-screen bg-[#050505] text-white flex flex-col lg:flex-row overflow-hidden"
      data-testid="first-launch-gate"
      style={{ '--wn-accent': accent }}
    >
      {/* grain + radial glow */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.04]"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'120\' height=\'120\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")' }} />
      <div className="pointer-events-none fixed -top-40 -left-40 w-[480px] h-[480px] rounded-full blur-[140px] opacity-20"
        style={{ background: accent }} />

      {showRail && <ProgressRail steps={steps} idx={idx} accent={accent} />}

      <div className="relative flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="absolute top-5 right-5 z-20" data-testid="oobe-language-picker">
          <LanguageSwitcher compact align="right" />
        </div>

        <AnimatePresence mode="wait">
          {current === 'welcome' && <WelcomeStep key="welcome" accent={accent} onNext={next} />}
          {current === 'admin' && <AdminStep key="admin" accent={accent} onCreated={onAdminCreated} onBack={idx > 0 ? back : null} />}
          {current === 'identity' && <IdentityStep key="identity" accent={accent} setAccent={setAccent} initialName={summary.server || ''} onNext={(p) => { merge(p); next(); }} onBack={idx > 0 ? back : null} />}
          {current === 'ffmpeg' && <FfmpegStep key="ffmpeg" accent={accent} onNext={(p) => { merge(p); next(); }} onBack={idx > 0 ? back : null} />}
          {current === 'library' && <LibraryStep key="library" accent={accent} onNext={(p) => { merge(p); next(); }} onBack={idx > 0 ? back : null} />}
          {current === 'license' && <LicenseStep key="license" accent={accent} onNext={(p) => { merge(p); next(); }} onBack={idx > 0 ? back : null} />}
          {current === 'finish' && <FinishStep key="finish" accent={accent} summary={summary} onLaunch={finishWizard} />}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ── Progress rail ─────────────────────────────────────────────────────
const RAIL_META = {
  welcome:  { label: 'Welcome', icon: Sparkles },
  admin:    { label: 'Administrator', icon: User },
  identity: { label: 'Server Identity', icon: Server },
  ffmpeg:   { label: 'FFmpeg', icon: Terminal },
  library:  { label: 'First Library', icon: FolderOpen },
  license:  { label: 'Edition', icon: Key },
  finish:   { label: "You're all set", icon: Rocket },
};

const ProgressRail = ({ steps, idx, accent }) => (
  <aside className="relative shrink-0 w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-white/[0.06] bg-white/[0.02] backdrop-blur-xl px-6 py-7 lg:p-9 flex flex-col">
    <div className="flex items-center gap-3 mb-9">
      <img src={logo} alt="WatchNexus" className="w-10 h-10 object-contain drop-shadow-[0_0_14px_rgba(245,158,11,0.45)]" />
      <div>
        <div className="font-['Outfit'] font-extrabold text-lg tracking-tight leading-none">WatchNexus</div>
        <div className="font-['JetBrains_Mono'] text-[10px] text-zinc-500 mt-1">FIRST-RUN SETUP</div>
      </div>
    </div>

    <ol className="flex lg:flex-col gap-1 lg:gap-1.5 overflow-x-auto lg:overflow-visible">
      {steps.map((id, i) => {
        const m = RAIL_META[id];
        const Icon = m.icon;
        const state = i < idx ? 'done' : i === idx ? 'active' : 'todo';
        return (
          <li key={id} data-testid={`rail-step-${id}`}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl shrink-0 transition-colors"
            style={state === 'active' ? { background: 'rgba(255,255,255,0.05)' } : undefined}>
            <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all"
              style={{
                background: state === 'done' ? accent : state === 'active' ? 'rgba(255,255,255,0.08)' : 'transparent',
                border: state === 'todo' ? '1px solid rgba(255,255,255,0.1)' : 'none',
                boxShadow: state === 'active' ? `0 0 0 1px ${accent}` : 'none',
              }}>
              {state === 'done'
                ? <Check className="w-4 h-4 text-black" />
                : <Icon className="w-4 h-4" style={{ color: state === 'active' ? accent : '#71717a' }} />}
            </span>
            <span className="text-sm font-medium whitespace-nowrap"
              style={{ color: state === 'todo' ? '#71717a' : '#fff' }}>
              {m.label}
            </span>
          </li>
        );
      })}
    </ol>

    <div className="hidden lg:block mt-auto pt-8 font-['JetBrains_Mono'] text-[10px] text-zinc-600">
      WatchNexus v1.0.0 · Self-hosted
    </div>
  </aside>
);

// ── Shared input ──────────────────────────────────────────────────────
const Field = ({ icon: Icon, type, value, onChange, placeholder, testid, right, accent, onEnter }) => (
  <div className="relative group">
    <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none transition-colors group-focus-within:text-[var(--wn-accent)]" />
    <input
      type={type} value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder} data-testid={testid}
      onKeyDown={(e) => { if (e.key === 'Enter' && onEnter) onEnter(); }}
      className="w-full h-12 pl-11 pr-11 bg-black/50 border border-white/10 rounded-xl text-white font-['Manrope'] placeholder:text-zinc-600 focus:outline-none transition-all"
      style={{ caretColor: accent }}
      onFocus={(e) => { e.target.style.borderColor = accent; e.target.style.boxShadow = `0 0 0 1px ${accent}`; }}
      onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
    />
    {right && <div className="absolute right-3.5 top-1/2 -translate-y-1/2">{right}</div>}
  </div>
);

const PrimaryBtn = ({ accent, children, ...props }) => (
  <Button {...props}
    className="h-12 font-['Outfit'] font-semibold text-black rounded-xl px-6 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
    style={{ background: accent, boxShadow: `0 0 22px ${accent}55` }}>
    {children}
  </Button>
);

const BackBtn = ({ onBack }) => (
  onBack ? (
    <button onClick={onBack} data-testid="oobe-back-btn"
      className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
      <ArrowLeft className="w-4 h-4" /> Back
    </button>
  ) : <span />
);

const Heading = ({ kicker, title, sub }) => (
  <div>
    {kicker && <div className="font-['JetBrains_Mono'] text-[11px] uppercase tracking-[0.25em] text-zinc-500 mb-3">{kicker}</div>}
    <h1 className="font-['Outfit'] text-3xl sm:text-4xl font-semibold tracking-tight mb-3">{title}</h1>
    {sub && <p className="font-['Manrope'] text-zinc-400 leading-relaxed">{sub}</p>}
  </div>
);

// ── Step: Welcome ─────────────────────────────────────────────────────
const WelcomeStep = ({ accent, onNext }) => (
  <motion.div {...fade} className="relative w-full max-w-3xl rounded-3xl overflow-hidden border border-white/10">
    <img src={WELCOME_BG} alt="" className="absolute inset-0 w-full h-full object-cover" />
    <div className="absolute inset-0 bg-gradient-to-tr from-black via-black/85 to-black/40" />
    <div className="relative p-10 sm:p-14 min-h-[520px] flex flex-col justify-between">
      <img src={logo} alt="WatchNexus" className="w-16 h-16 object-contain drop-shadow-[0_0_24px_rgba(245,158,11,0.5)]" />
      <div>
        <div className="font-['JetBrains_Mono'] text-[11px] uppercase tracking-[0.3em] mb-4" style={{ color: accent }}>
          Welcome to WatchNexus
        </div>
        <h1 className="font-['Outfit'] text-5xl sm:text-6xl font-extrabold tracking-tight leading-[0.95] mb-5">
          Your media,<br />mastered.
        </h1>
        <p className="font-['Manrope'] text-zinc-300 max-w-md mb-9 leading-relaxed">
          A few quick steps and your private, self-hosted cinema is ready — accounts, libraries, transcoding and your edition, all set up your way.
        </p>
        <PrimaryBtn accent={accent} onClick={onNext} data-testid="welcome-begin-btn">
          <PlayCircle className="w-5 h-5 mr-2" /> Begin setup
        </PrimaryBtn>
      </div>
    </div>
  </motion.div>
);

// ── Step: Admin ───────────────────────────────────────────────────────
const AdminStep = ({ accent, onCreated, onBack }) => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const canSubmit = email.trim() && username.trim() && password.length >= 8 && password === confirm && !busy;

  const submit = async (e) => {
    e?.preventDefault();
    if (!canSubmit) {
      if (password.length < 8) toast.error('Password must be at least 8 characters');
      else if (password !== confirm) toast.error('Passwords do not match');
      return;
    }
    setBusy(true);
    try {
      const res = await axios.post(`${API}/api/auth/setup`, { email: email.trim(), username: username.trim(), password });
      toast.success(`Welcome, ${res.data.user.username}!`);
      onCreated(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create admin account');
    } finally { setBusy(false); }
  };

  return (
    <motion.div {...fade} className="w-full max-w-md space-y-8">
      <Heading kicker="Step · Administrator" title="Create your admin account"
        sub="The first account becomes the owner. You can add household members later from Settings." />
      <form onSubmit={submit} className="space-y-3.5">
        <Field icon={Mail} type="email" value={email} onChange={setEmail} placeholder="admin@example.com" testid="setup-email" accent={accent} />
        <Field icon={User} type="text" value={username} onChange={setUsername} placeholder="Username" testid="setup-username" accent={accent} />
        <Field icon={Lock} type={show ? 'text' : 'password'} value={password} onChange={setPassword}
          placeholder="Password (min 8 chars)" testid="setup-password" accent={accent}
          right={<button type="button" onClick={() => setShow(!show)} className="text-zinc-500 hover:text-zinc-300">{show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>} />
        <Field icon={Lock} type={show ? 'text' : 'password'} value={confirm} onChange={setConfirm} placeholder="Confirm password" testid="setup-confirm" accent={accent} />
        <div className="flex items-center justify-between pt-3">
          <BackBtn onBack={onBack} />
          <PrimaryBtn accent={accent} type="submit" disabled={!canSubmit} data-testid="setup-submit-btn">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4 ml-2" /></>}
          </PrimaryBtn>
        </div>
      </form>
    </motion.div>
  );
};

// ── Step: Server identity ─────────────────────────────────────────────
const IdentityStep = ({ accent, setAccent, onNext, onBack, initialName }) => {
  const [name, setName] = useState(initialName || '');
  const [busy, setBusy] = useState(false);
  const chosen = ACCENTS.find((a) => a.hex === accent)?.id || 'amber';

  const save = async () => {
    setBusy(true);
    const serverName = name.trim() || 'WatchNexus';
    try {
      await axios.put(`${API}/api/settings`, { server_name: serverName, ui_accent: chosen });
    } catch { /* non-blocking */ }
    setBusy(false);
    onNext({ server: serverName, accent: chosen });
  };

  return (
    <motion.div {...fade} className="w-full max-w-lg space-y-8">
      <Heading kicker="Step · Server Identity" title="Name your server"
        sub="Give your server a name and pick an accent. Your choice themes WatchNexus everywhere." />
      <Field icon={Server} type="text" value={name} onChange={setName} placeholder="Living Room Server" testid="identity-name" accent={accent} onEnter={save} />

      <div>
        <div className="font-['JetBrains_Mono'] text-[11px] uppercase tracking-[0.2em] text-zinc-500 mb-3 flex items-center gap-2">
          <Palette className="w-3.5 h-3.5" /> Accent color
        </div>
        <div className="grid grid-cols-6 gap-3">
          {ACCENTS.map((a) => (
            <button key={a.id} onClick={() => setAccent(a.hex)} title={a.name}
              data-testid={`accent-${a.id}`}
              className="aspect-square rounded-xl transition-all relative"
              style={{
                background: a.hex,
                transform: a.hex === accent ? 'scale(1.08)' : 'scale(1)',
                boxShadow: a.hex === accent ? `0 0 0 2px #050505, 0 0 0 4px ${a.hex}, 0 0 18px ${a.hex}88` : 'none',
              }}>
              {a.hex === accent && <Check className="w-4 h-4 text-black absolute inset-0 m-auto" />}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <BackBtn onBack={onBack} />
        <PrimaryBtn accent={accent} onClick={save} disabled={busy} data-testid="identity-continue-btn">
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4 ml-2" /></>}
        </PrimaryBtn>
      </div>
    </motion.div>
  );
};

// ── Step: FFmpeg ──────────────────────────────────────────────────────
const FfmpegStep = ({ accent, onNext, onBack }) => {
  const [status, setStatus] = useState(null);
  const [checking, setChecking] = useState(true);
  const [copied, setCopied] = useState(false);

  const probe = async () => {
    setChecking(true);
    try {
      const res = await axios.get(`${API}/api/crucible/ffmpeg-status`);
      setStatus(res.data);
    } catch (err) {
      setStatus({ ffmpeg_installed: false, error: err.message });
    } finally { setChecking(false); }
  };
  useEffect(() => { probe(); }, []);

  const installed = !!status?.ffmpeg_installed;
  const probeInstalled = !!status?.ffprobe_installed;
  const hint = status?.install_hint;

  const copy = () => {
    if (!hint) return;
    try { navigator.clipboard.writeText(hint); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* */ }
  };

  return (
    <motion.div {...fade} className="w-full max-w-xl space-y-7">
      <Heading kicker="Step · FFmpeg Diagnostic" title="Media engine check"
        sub={installed
          ? 'FFmpeg is ready — transcoding, playback, repair and disc-ripping are all available.'
          : "FFmpeg isn't installed. WatchNexus still runs, but transcoding, repair and disc-ripping stay off until you add it."} />

      {/* terminal card */}
      <div className="rounded-2xl border border-white/10 bg-[#080808] overflow-hidden font-['JetBrains_Mono']">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
          <span className="ml-2 text-[11px] text-zinc-500">system · media-engine</span>
        </div>
        <div className="p-5 space-y-3 text-sm">
          {checking ? (
            <div className="flex items-center gap-3 text-zinc-400"><Loader2 className="w-4 h-4 animate-spin" /> probing for ffmpeg / ffprobe…</div>
          ) : (
            <>
              <TermRow label="ffmpeg" ok={installed} path={status?.ffmpeg_path} accent={accent} />
              <TermRow label="ffprobe" ok={probeInstalled} path={status?.ffprobe_path} accent={accent} />
              {status?.ffmpeg_version && <p className="text-[11px] text-zinc-600 pt-2 border-t border-white/5 break-all">{status.ffmpeg_version}</p>}
            </>
          )}
        </div>
      </div>

      {!checking && !installed && hint && (
        <div className="rounded-xl border p-4" style={{ borderColor: `${accent}40`, background: `${accent}10` }}>
          <p className="text-sm font-['Manrope'] mb-2.5" style={{ color: accent }}>Install on this system:</p>
          <div className="flex items-center gap-2 bg-black/50 rounded-lg p-3 border border-white/5">
            <code className="flex-1 text-zinc-200 text-sm font-['JetBrains_Mono'] break-all">{hint}</code>
            <button onClick={copy} data-testid="ffmpeg-copy-hint" className="shrink-0 p-1.5 rounded hover:bg-white/5">
              {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-zinc-400" />}
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        <BackBtn onBack={onBack} />
        <div className="flex gap-3">
          <Button variant="outline" onClick={probe} disabled={checking} data-testid="ffmpeg-recheck-btn"
            className="h-12 bg-white/5 border-white/10 text-white hover:bg-white/10 rounded-xl px-5">
            {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <><RefreshCw className="w-4 h-4 mr-2" /> Re-check</>}
          </Button>
          <PrimaryBtn accent={accent} onClick={() => onNext({ ffmpeg: installed })} data-testid="ffmpeg-continue-btn">
            Continue <ArrowRight className="w-4 h-4 ml-2" />
          </PrimaryBtn>
        </div>
      </div>
    </motion.div>
  );
};

const TermRow = ({ label, ok, path, accent }) => (
  <div className="flex items-center gap-2">
    <span style={{ color: ok ? '#10B981' : '#EF4444' }}>{ok ? '✓' : '✗'}</span>
    <span className="text-zinc-200">{label}</span>
    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: ok ? '#10B98122' : '#EF444422', color: ok ? '#34d399' : '#f87171' }}>
      {ok ? 'detected' : 'not found'}
    </span>
    {path && <span className="text-[11px] text-zinc-600 truncate ml-1" title={path}>{path}</span>}
  </div>
);

// ── Step: First library ───────────────────────────────────────────────
const LibraryStep = ({ accent, onNext, onBack }) => {
  const [type, setType] = useState('movies');
  const [path, setPath] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!path.trim()) { toast.error('Enter a folder path or skip this step'); return; }
    setBusy(true);
    try {
      const name = LIB_TYPES.find((t) => t.id === type)?.name || 'Library';
      await axios.post(`${API}/api/marmalade/libraries`, null, { params: { name, path: path.trim(), media_type: type } });
      toast.success(`${name} library added`);
      onNext({ library: `${name} · ${path.trim()}` });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not create library');
      setBusy(false);
    }
  };

  return (
    <motion.div {...fade} className="w-full max-w-xl space-y-8">
      <Heading kicker="Step · First Library" title="Add your first library"
        sub="Point WatchNexus at a folder of media. You can add more (and scan them) later from the dashboard." />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {LIB_TYPES.map((t) => {
          const Icon = t.icon;
          const active = t.id === type;
          return (
            <button key={t.id} onClick={() => setType(t.id)} data-testid={`libtype-${t.id}`}
              className="rounded-2xl p-4 border flex flex-col items-center gap-2 transition-all"
              style={{
                background: active ? `${accent}14` : 'rgba(255,255,255,0.02)',
                borderColor: active ? accent : 'rgba(255,255,255,0.08)',
                boxShadow: active ? `0 0 18px ${accent}33` : 'none',
              }}>
              <Icon className="w-6 h-6" style={{ color: active ? accent : '#a1a1aa' }} />
              <span className="text-sm font-medium" style={{ color: active ? '#fff' : '#a1a1aa' }}>{t.name}</span>
            </button>
          );
        })}
      </div>

      <Field icon={FolderOpen} type="text" value={path} onChange={setPath}
        placeholder="/media/movies" testid="library-path" accent={accent} onEnter={create} />

      <div className="flex items-center justify-between pt-1">
        <BackBtn onBack={onBack} />
        <div className="flex items-center gap-4">
          <button onClick={() => onNext({ library: 'Skipped' })} data-testid="library-skip-btn"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
            <SkipForward className="w-4 h-4" /> Skip for now
          </button>
          <PrimaryBtn accent={accent} onClick={create} disabled={busy || !path.trim()} data-testid="library-create-btn">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Add library <ArrowRight className="w-4 h-4 ml-2" /></>}
          </PrimaryBtn>
        </div>
      </div>
    </motion.div>
  );
};

// ── Step: License ─────────────────────────────────────────────────────
const LicenseStep = ({ accent, onNext, onBack }) => {
  const [serial, setSerial] = useState('');
  const [busy, setBusy] = useState(false);

  const activate = async () => {
    if (!serial.trim()) { toast.error('Enter a serial or continue with Standard'); return; }
    setBusy(true);
    try {
      const res = await axios.post(`${API}/api/cellar/activate-first-launch`, { serial: serial.trim() });
      if (res.data.success) { toast.success(res.data.message || 'License activated'); onNext({ tier: res.data.tier_name || 'Activated' }); }
      else { toast.error(res.data.message || 'Activation failed'); setBusy(false); }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid serial number'); setBusy(false);
    }
  };

  const skip = async () => {
    setBusy(true);
    try { await axios.post(`${API}/api/cellar/activate-first-launch`, { skip: true }); } catch { /* */ }
    onNext({ tier: 'Standard' });
  };

  return (
    <motion.div {...fade} className="w-full max-w-2xl space-y-8">
      <Heading kicker="Step · Edition" title="Choose your edition"
        sub="Enter a serial to unlock Pro or Ultra, or continue free with Standard. Upgrade anytime in Settings." />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {TIERS.map((t) => {
          const Icon = t.icon;
          return (
            <div key={t.id} data-testid={`tier-${t.id}`}
              className="rounded-2xl p-5 border bg-white/[0.02] transition-all"
              style={t.glow ? { borderColor: `${accent}66`, boxShadow: `0 0 26px ${accent}26` } : { borderColor: 'rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: t.glow ? accent : 'rgba(255,255,255,0.06)' }}>
                  <Icon className="w-4 h-4" style={{ color: t.glow ? '#000' : '#fff' }} />
                </div>
                <span className="font-['Outfit'] font-bold">{t.name}</span>
                {t.free && <span className="ml-auto text-[10px] font-['JetBrains_Mono'] text-zinc-500">FREE</span>}
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed font-['Manrope']">{t.desc}</p>
            </div>
          );
        })}
      </div>

      <div className="flex gap-3">
        <input type="text" value={serial} onChange={(e) => setSerial(e.target.value.toUpperCase())}
          placeholder="ENTER SERIAL NUMBER…" data-testid="first-launch-serial-input"
          onKeyDown={(e) => e.key === 'Enter' && activate()}
          className="flex-1 px-4 h-13 py-3.5 bg-black/50 border border-white/10 rounded-xl text-white font-['JetBrains_Mono'] tracking-wider placeholder:text-zinc-600 focus:outline-none transition-all"
          onFocus={(e) => { e.target.style.borderColor = accent; e.target.style.boxShadow = `0 0 0 1px ${accent}`; }}
          onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }} />
        <PrimaryBtn accent={accent} onClick={activate} disabled={busy || !serial.trim()} data-testid="first-launch-activate-btn">
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
        </PrimaryBtn>
      </div>

      <div className="flex items-center justify-between">
        <BackBtn onBack={onBack} />
        <button onClick={skip} disabled={busy} data-testid="first-launch-skip-btn"
          className="text-sm text-zinc-400 hover:text-white transition-colors inline-flex items-center">
          Continue with Standard (free) <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
        </button>
      </div>
    </motion.div>
  );
};

// ── Step: Finish ──────────────────────────────────────────────────────
const FinishStep = ({ accent, summary, onLaunch }) => {
  const rows = [
    summary.admin && { label: 'Administrator', value: summary.admin },
    summary.server && { label: 'Server name', value: summary.server },
    summary.ffmpeg !== undefined && { label: 'FFmpeg', value: summary.ffmpeg ? 'Detected' : 'Not installed' },
    summary.library && { label: 'First library', value: summary.library },
    summary.tier && { label: 'Edition', value: summary.tier },
  ].filter(Boolean);

  return (
    <motion.div {...fade} className="relative w-full max-w-2xl rounded-3xl overflow-hidden border border-white/10">
      <img src={FINISH_BG} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/90 to-black/60" />
      <div className="relative p-10 sm:p-12">
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 14 }}
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
          style={{ background: accent, boxShadow: `0 0 30px ${accent}66` }}>
          <CheckCircle2 className="w-8 h-8 text-black" />
        </motion.div>

        <h1 className="font-['Outfit'] text-4xl sm:text-5xl font-extrabold tracking-tight mb-3">You're all set.</h1>
        <p className="font-['Manrope'] text-zinc-300 mb-8 max-w-md">Your WatchNexus server is configured and ready. Here's what we set up:</p>

        <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md divide-y divide-white/5 mb-9">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between px-5 py-3.5">
              <span className="flex items-center gap-2.5 text-sm text-zinc-400 font-['Manrope']">
                <Check className="w-4 h-4" style={{ color: accent }} /> {r.label}
              </span>
              <span className="text-sm text-white font-medium truncate max-w-[55%] text-right">{r.value}</span>
            </div>
          ))}
        </div>

        <PrimaryBtn accent={accent} onClick={onLaunch} data-testid="finish-launch-btn" className="w-full sm:w-auto">
          <Rocket className="w-5 h-5 mr-2" /> Launch WatchNexus
        </PrimaryBtn>
      </div>
    </motion.div>
  );
};
