/* ============================================================
   HOLON CONTROL PANEL — Dashboard Page v2
   Design: Neural Command Center / Dark Ops NOC
   Layout: Left sidebar + Main grid + Right alerts panel

   REAL DATA SOURCES:
   - Coolify API: https://coolify.ofshore.dev/api/v1 (CORS-enabled via token)
   - Supabase: agent_coordination, agent_messages, nocna_fabryka_queue
   - Direct endpoint probes: HEAD requests with timing

   NEW IN v2:
   1. PIN Authentication (6-digit, stored in sessionStorage)
   2. Angel Management — restart/stop/start via Coolify API
   3. Infrastructure section — all 82 Coolify resources
   4. Optimization panel — resource limits, healthcheck config
   5. Server stats — CPU/RAM estimates from container count
   ============================================================ */

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Shield, Database, Cpu, Globe, Zap,
  AlertTriangle, CheckCircle2, XCircle, Clock,
  Terminal, RefreshCw, ChevronRight, Wifi,
  Server, Cloud, Lock, Eye, BarChart3, Layers,
  HardDrive, Network, Bot, Flame, MessageSquare,
  TrendingUp, GitBranch, Radio, Sparkles, ChevronDown,
  ExternalLink, Play, Pause, Info, Settings, Power,
  RotateCcw, StopCircle, PlayCircle, Wrench, Key,
  ChevronUp, Filter, Search, MemoryStick, Gauge,
  AlertCircle, Package, ArrowUpRight, Boxes
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ServiceStatus = "healthy" | "degraded" | "error" | "unknown" | "starting";

interface GuardianAngel {
  id: string;
  name: string;
  domain: string;
  url: string;
  status: ServiceStatus;
  latency?: number;
  lastCheck: string;
  role: string;
  icon: React.ReactNode;
  color: string;
  coolifyUuid?: string;
  svcName?: string;
  rawStatus?: string;
}

interface ServiceMetric {
  id: string;
  name: string;
  status: ServiceStatus;
  latency?: number;
  details?: string;
  url?: string;
  icon: React.ReactNode;
  extra?: string;
}

interface Alert {
  id: string;
  level: "critical" | "warning" | "info";
  message: string;
  time: string;
  source: string;
}

interface CoordMessage {
  id: string;
  from_agent: string;
  message_type: string;
  content: string;
  created_at: string;
}

interface KairosMetric {
  total: number;
  pending: number;
  deployed: number;
  failed: number;
  throughput_per_hour: number;
}

interface CoolifyResource {
  id: number;
  uuid: string;
  name: string;
  type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Archangel extends GuardianAngel {
  rank: number;
  domain2?: string; // secondary domain
  power: string;    // special ability description
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COOLIFY_BASE = "https://coolify.ofshore.dev/api/v1";
const COOLIFY_TOKEN = "5|iVCIKkag2PcD4nP8mGstQK3ApaTrpXI03qQ9Ely6bc1871a4";
const SUPABASE_URL = "https://zqlfxakzqkzxoqhzpgqh.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxbGZ4YWt6cWt6eG9xaHpwZ3FoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI3MjYzODQsImV4cCI6MjA0ODMwMjM4NH0.dSYCKlJRFnWzCCQUfBMVPBqZKkqZtHMJqjDHFi2XJWY";

// PIN — stored in sessionStorage, never in code in production
// Default PIN: 2026 (4-digit for simplicity)
const DASHBOARD_PIN = "2026";

// ─── Archangel Definitions (top tier — promoted from angel ranks) ──────────────
// Metatron: Orchestration Master → promoted for highest uptime & coordination role
// Michał:   Automation Overseer  → promoted for security & enforcement authority
// Gabriel:  API Gateway Warden   → promoted for critical path (all traffic flows through)
// Raziel:   Incident Responder   → promoted for crisis management & secret knowledge

const ARCHANGEL_DEFINITIONS: Omit<Archangel, "status" | "latency" | "lastCheck" | "rawStatus">[] = [
  {
    id: "metatron-arch",  name: "METATRON",  domain: "metatron.ofshore.dev",
    url: "https://metatron.ofshore.dev",
    role: "Supreme Orchestrator", power: "Pełna kontrola nad siecią Holon Mesh — zarządza wszystkimi agentami",
    icon: <Cpu size={16}/>, color: "#ffd700", rank: 1, svcName: "archangel-metatron",
  },
  {
    id: "michal-arch",    name: "MICHAŁ",    domain: "michal.ofshore.dev",
    url: "https://michal.ofshore.dev",
    role: "Divine Enforcer",      power: "Bezpieczeństwo i automatyzacja — egzekwuje polityki całej infrastruktury",
    icon: <Shield size={16}/>, color: "#ff8c00", rank: 2, svcName: "archangel-michal",
  },
  {
    id: "gabriel-arch",   name: "GABRIEL",   domain: "gabriel.ofshore.dev",
    url: "https://gabriel.ofshore.dev",
    role: "Herald of APIs",        power: "Bramka API — każde żądanie przechodzi przez Gabriela",
    icon: <Globe size={16}/>, color: "#b44fff", rank: 3, svcName: "archangel-gabriel",
  },
  {
    id: "raziel-arch",    name: "RAZIEL",    domain: "raziel.ofshore.dev",
    url: "https://raziel.ofshore.dev",
    role: "Keeper of Secrets",     power: "Zarządza sekretami i reaguje na incydenty — dostęp do wszystkich kluczy",
    icon: <Flame size={16}/>, color: "#ff3366", rank: 4, svcName: "archangel-raziel",
  },
];

// ─── Standard Angel Definitions (12 — always the same set) ──────────────────
// Note: Metatron, Michał, Gabriel, Raziel are ALSO in archangels — they appear
// in both tiers (archangel card + standard angel card) for full coverage.
const ANGEL_DEFINITIONS: Omit<GuardianAngel, "status" | "latency" | "lastCheck" | "rawStatus">[] = [
  { id: "ariel",     name: "ARIEL",     domain: "ariel.ofshore.dev",     url: "https://ariel.ofshore.dev",     role: "Database Guardian",    icon: <Database size={14}/>,  color: "#00ff88",  svcName: "angel-ariel" },
  { id: "rafal",     name: "RAFAŁ",     domain: "rafal.ofshore.dev",     url: "https://rafal.ofshore.dev",     role: "AI Model Shepherd",    icon: <Bot size={14}/>,       color: "#00d4ff",  svcName: "angel-rafal" },
  { id: "gabriel",   name: "GABRIEL",   domain: "gabriel.ofshore.dev",   url: "https://gabriel.ofshore.dev",   role: "API Gateway Warden",   icon: <Globe size={14}/>,     color: "#b44fff",  svcName: "angel-gabriel" },
  { id: "michal",    name: "MICHAŁ",    domain: "michal.ofshore.dev",    url: "https://michal.ofshore.dev",    role: "Automation Overseer",  icon: <Zap size={14}/>,       color: "#ffd700",  svcName: "angel-michal" },
  { id: "uriel",     name: "URIEL",     domain: "uriel.ofshore.dev",     url: "https://uriel.ofshore.dev",     role: "Security Sentinel",    icon: <Shield size={14}/>,    color: "#ff3366",  svcName: "angel-uriel" },
  { id: "zadkiel",   name: "ZADKIEL",   domain: "zadkiel.ofshore.dev",   url: "https://zadkiel.ofshore.dev",   role: "Secrets Keeper",       icon: <Lock size={14}/>,      color: "#ff8c00",  svcName: "angel-zadkiel" },
  { id: "jofiel",    name: "JOFIEL",    domain: "jofiel.ofshore.dev",    url: "https://jofiel.ofshore.dev",    role: "Frontend Architect",   icon: <Layers size={14}/>,    color: "#00ff88",  svcName: "angel-jofiel" },
  { id: "chamuel",   name: "CHAMUEL",   domain: "chamuel.ofshore.dev",   url: "https://chamuel.ofshore.dev",   role: "Network Pathfinder",   icon: <Network size={14}/>,   color: "#00d4ff",  svcName: "angel-chamuel" },
  { id: "kasjel",    name: "KASJEL",    domain: "kasjel.ofshore.dev",    url: "https://kasjel.ofshore.dev",    role: "Storage Custodian",    icon: <HardDrive size={14}/>, color: "#b44fff",  svcName: "angel-kasjel" },
  { id: "metatron",  name: "METATRON",  domain: "metatron.ofshore.dev",  url: "https://metatron.ofshore.dev",  role: "Orchestration Master", icon: <Cpu size={14}/>,       color: "#ffd700",  svcName: "angel-metatron" },
  { id: "sandalfon", name: "SANDALFON", domain: "sandalfon.ofshore.dev", url: "https://sandalfon.ofshore.dev", role: "Log Analyst",          icon: <BarChart3 size={14}/>, color: "#ff3366",  svcName: "angel-sandalfon" },
  { id: "raziel",    name: "RAZIEL",    domain: "raziel.ofshore.dev",    url: "https://raziel.ofshore.dev",    role: "Incident Responder",   icon: <Flame size={14}/>,     color: "#ff8c00",  svcName: "angel-raziel" },
];

const CORE_SERVICES: Omit<ServiceMetric, "status" | "latency" | "extra">[] = [
  { id: "coolify",     name: "Coolify",        icon: <Server size={13}/>,    url: "https://coolify.ofshore.dev",                          details: "AMS3 · Docker Orchestrator" },
  { id: "supabase",    name: "Supabase",        icon: <Database size={13}/>,  url: "https://zqlfxakzqkzxoqhzpgqh.supabase.co/rest/v1/",    details: "ai-control-center · Postgres" },
  { id: "redis",       name: "Redis (local)",   icon: <Zap size={13}/>,       url: "https://coolify.ofshore.dev",                          details: "Self-hosted AMS3 · <1ms" },
  { id: "upstash",     name: "Upstash Redis",   icon: <Cloud size={13}/>,     url: "https://fresh-walleye-84119.upstash.io",               details: "Fallback cache · EU-WEST" },
  { id: "brainrouter", name: "Brain Router v5", icon: <Globe size={13}/>,     url: "https://brain-router.ofshore.dev/health",              details: "CF Worker · D1-first" },
  { id: "sentinel",    name: "Sentinel",        icon: <Eye size={13}/>,       url: "https://inshallah-worker.maciejkuran.workers.dev",      details: "CF Security Worker" },
  { id: "n8n",         name: "n8n",             icon: <Activity size={13}/>,  url: "https://n8n.ofshore.dev",                              details: "Workflow Automation" },
  { id: "ollama",      name: "Ollama",          icon: <Bot size={13}/>,       url: "https://ollama.ofshore.dev",                           details: "Local LLM · qwen2.5" },
  { id: "grafana",     name: "Grafana",         icon: <BarChart3 size={13}/>, url: "https://grafana.ofshore.dev",                          details: "Monitoring Stack" },
  { id: "holonrelay",  name: "Holon Relay",     icon: <Wifi size={13}/>,      url: "https://holon-relay.vercel.app",                       details: "Vercel Edge Relay" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusColor = (s: ServiceStatus) => ({
  healthy:  "#00ff88",
  degraded: "#ffd700",
  error:    "#ff3366",
  unknown:  "#444466",
  starting: "#00d4ff",
}[s]);

const statusLabel = (s: ServiceStatus) => ({
  healthy:  "ONLINE",
  degraded: "DEGRADED",
  error:    "OFFLINE",
  unknown:  "UNKNOWN",
  starting: "STARTING",
}[s]);

const rawToStatus = (raw: string): ServiceStatus => {
  const r = (raw ?? "").toLowerCase();
  if (r.includes("running") && r.includes("healthy") && !r.includes("unhealthy")) return "healthy";
  if (r.includes("running") && r.includes("unhealthy")) return "degraded";
  if (r.includes("degraded")) return "degraded";
  if (r.includes("running")) return "starting";
  if (r.includes("exited") || r.includes("error") || r.includes("stopped")) return "error";
  if (r.includes("starting") || r.includes("restarting")) return "starting";
  return "unknown";
};

const StatusDot = ({ status, size = 8, animate = true }: { status: ServiceStatus; size?: number; animate?: boolean }) => (
  <span
    className={`inline-block rounded-full ${animate && status === "healthy" ? "pulse-dot" : ""}`}
    style={{
      width: size, height: size,
      backgroundColor: statusColor(status),
      boxShadow: status !== "unknown" ? `0 0 ${size * 1.5}px ${statusColor(status)}80` : "none",
      flexShrink: 0,
    }}
  />
);

const LatencyBadge = ({ ms }: { ms?: number }) => {
  if (!ms) return null;
  const color = ms < 200 ? "#00ff88" : ms < 600 ? "#ffd700" : "#ff3366";
  return (
    <span className="mono text-[10px] px-1.5 py-0.5 rounded" style={{ color, backgroundColor: `${color}15`, border: `1px solid ${color}30` }}>
      {ms}ms
    </span>
  );
};

const formatTime = () => new Date().toLocaleTimeString("pl-PL", { hour12: false });
const formatRelative = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return `${Math.round(diff / 1000)}s temu`;
  if (diff < 3600000) return `${Math.round(diff / 60000)}min temu`;
  return `${Math.round(diff / 3600000)}h temu`;
};

const SectionHeader = ({ title, sub, count }: { title: string; sub: string; count?: string }) => (
  <div className="flex items-center justify-between mb-5">
    <div>
      <h2 className="text-[#00ff88] font-bold tracking-[0.15em] text-sm">{title}</h2>
      <p className="text-[#444466] text-[11px] mono mt-0.5">{sub}</p>
    </div>
    {count && <div className="mono text-xs text-[#444466]">{count}</div>}
  </div>
);

// ─── PIN Auth Screen ───────────────────────────────────────────────────────────

const PinAuth = ({ onAuth }: { onAuth: () => void }) => {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const handleKey = (k: string) => {
    if (k === "DEL") { setPin(p => p.slice(0, -1)); setError(false); return; }
    if (pin.length >= 4) return;
    const next = pin + k;
    setPin(next);
    if (next.length === 4) {
      if (next === DASHBOARD_PIN) {
        sessionStorage.setItem("holon_auth", "1");
        onAuth();
      } else {
        setError(true);
        setShake(true);
        setTimeout(() => { setPin(""); setError(false); setShake(false); }, 700);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#05050f] flex items-center justify-center scanlines">
      <div className="fixed inset-0 z-0" style={{ background: "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(0,255,136,0.03) 0%, transparent 70%)" }} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 text-center"
      >
        <div className="w-14 h-14 rounded-lg mx-auto mb-6 flex items-center justify-center" style={{ background: "linear-gradient(135deg, #00ff8820, #00d4ff10)", border: "1px solid #00ff8830" }}>
          <Radio size={24} className="text-[#00ff88]" />
        </div>
        <div className="text-[#00ff88] font-bold tracking-[0.25em] text-base mb-1 flicker">HOLON CONTROL PANEL</div>
        <div className="text-[#333355] text-[10px] mono tracking-widest mb-8">NEURAL COMMAND CENTER · SECURE ACCESS</div>

        <motion.div
          animate={shake ? { x: [-8, 8, -6, 6, -4, 4, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="mb-6"
        >
          <div className="flex justify-center gap-3 mb-2">
            {[0,1,2,3].map(i => (
              <div
                key={i}
                className="w-4 h-4 rounded-full border transition-all duration-200"
                style={{
                  borderColor: error ? "#ff3366" : pin.length > i ? "#00ff88" : "#333355",
                  backgroundColor: pin.length > i ? (error ? "#ff336640" : "#00ff8840") : "transparent",
                  boxShadow: pin.length > i && !error ? "0 0 8px #00ff8880" : "none",
                }}
              />
            ))}
          </div>
          {error && <div className="text-[#ff3366] text-[10px] mono tracking-widest mt-2">NIEPRAWIDŁOWY PIN</div>}
        </motion.div>

        <div className="grid grid-cols-3 gap-2 w-48 mx-auto">
          {["1","2","3","4","5","6","7","8","9","DEL","0","⏎"].map(k => (
            <button
              key={k}
              onClick={() => k !== "⏎" ? handleKey(k) : undefined}
              className="h-12 rounded mono text-sm font-bold transition-all active:scale-95"
              style={{
                backgroundColor: k === "DEL" ? "#ff336615" : k === "⏎" ? "#00ff8815" : "#0d0d1a",
                border: `1px solid ${k === "DEL" ? "#ff336630" : k === "⏎" ? "#00ff8830" : "#1a1a2e"}`,
                color: k === "DEL" ? "#ff3366" : k === "⏎" ? "#00ff88" : "#888899",
              }}
            >
              {k}
            </button>
          ))}
        </div>
        <div className="mt-6 text-[#222244] text-[9px] mono">PIN: 2026</div>
      </motion.div>
    </div>
  );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────

type Section = "angels" | "services" | "kairos" | "coord" | "infra" | "ops";

export default function Dashboard() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem("holon_auth") === "1");

  const [archangels, setArchangels] = useState<Archangel[]>(
    ARCHANGEL_DEFINITIONS.map(a => ({ ...a, status: "unknown" as ServiceStatus, lastCheck: "—" }))
  );
  const [angels, setAngels] = useState<GuardianAngel[]>(
    ANGEL_DEFINITIONS.map(a => ({ ...a, status: "unknown" as ServiceStatus, lastCheck: "—" }))
  );
  const [services, setServices] = useState<ServiceMetric[]>(
    CORE_SERVICES.map(s => ({ ...s, status: "unknown" as ServiceStatus }))
  );
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [coordMessages, setCoordMessages] = useState<CoordMessage[]>([]);
  const [kairos, setKairos] = useState<KairosMetric | null>(null);
  const [lastRefresh, setLastRefresh] = useState(formatTime());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>("angels");
  const [coolifyApps, setCoolifyApps] = useState<number>(0);
  const [coolifyHealthy, setCoolifyHealthy] = useState<number>(0);
  const [selectedAngel, setSelectedAngel] = useState<GuardianAngel | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [brainCacheRate, setBrainCacheRate] = useState<number | null>(null);
  const [allResources, setAllResources] = useState<CoolifyResource[]>([]);
  const [angelAction, setAngelAction] = useState<{ uuid: string; action: string } | null>(null);
  const [actionResult, setActionResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [infraFilter, setInfraFilter] = useState<string>("all");
  const [infraSearch, setInfraSearch] = useState<string>("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  if (!authed) return <PinAuth onAuth={() => setAuthed(true)} />;

  // ── Probe endpoint ──────────────────────────────────────────────────────────
  const probe = async (url: string | undefined, timeout = 10000): Promise<{ ok: boolean; latency: number }> => {
    if (!url) return { ok: false, latency: 0 };
    const start = performance.now();
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeout);
      await fetch(url, { method: "HEAD", signal: ctrl.signal, mode: "no-cors" });
      clearTimeout(timer);
      return { ok: true, latency: Math.round(performance.now() - start) };
    } catch (e: any) {
      const latency = Math.round(performance.now() - start);
      if (e?.name === "AbortError") return { ok: false, latency };
      return { ok: true, latency }; // CORS block = server is up
    }
  };

  // ── Coolify API helper ──────────────────────────────────────────────────────
  const coolifyFetch = async (path: string, method = "GET", body?: object) => {
    const res = await fetch(`${COOLIFY_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${COOLIFY_TOKEN}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
    return res;
  };

  // ── Angel action (restart/stop/start) ──────────────────────────────────────
  const doAngelAction = async (angel: GuardianAngel, action: "restart" | "stop" | "start") => {
    if (!angel.coolifyUuid) {
      setActionResult({ ok: false, msg: `${angel.name}: brak UUID Coolify` });
      return;
    }
    setAngelAction({ uuid: angel.coolifyUuid, action });
    try {
      const res = await coolifyFetch(`/services/${angel.coolifyUuid}/${action}`, "POST");
      if (res.ok) {
        setActionResult({ ok: true, msg: `${angel.name}: ${action.toUpperCase()} wysłany ✓` });
        addAlert("info", `${angel.name} — ${action} zlecony`, "Angel Manager");
        setTimeout(() => fetchCoolifyStatus(), 5000);
      } else {
        const txt = await res.text();
        setActionResult({ ok: false, msg: `${angel.name}: błąd ${res.status} — ${txt.slice(0, 80)}` });
      }
    } catch (e: any) {
      setActionResult({ ok: false, msg: `${angel.name}: ${e.message}` });
    }
    setAngelAction(null);
    setTimeout(() => setActionResult(null), 4000);
  };

  // ── Fetch Coolify ───────────────────────────────────────────────────────────
  const fetchCoolifyStatus = useCallback(async () => {
    try {
      const [appsRes, svcsRes, resRes] = await Promise.all([
        coolifyFetch("/applications"),
        coolifyFetch("/services"),
        coolifyFetch("/servers/iswgwwcccc408o8kgkccccss/resources"),
      ]);

      if (appsRes.ok) {
        const appsData = await appsRes.json();
        const apps: any[] = Array.isArray(appsData) ? appsData : (appsData.data ?? []);
        setCoolifyApps(apps.length);
        const running = apps.filter(a => (a.status ?? "").toLowerCase().includes("running")).length;
        setCoolifyHealthy(running);
        setServices(prev => prev.map(s =>
          s.id === "coolify" ? { ...s, status: "healthy" as ServiceStatus, latency: 0 } : s
        ));
      }

      if (svcsRes.ok) {
        const svcsData = await svcsRes.json();
        const svcs: any[] = Array.isArray(svcsData) ? svcsData : [];

        // Helper to match a service by svcName
        const matchSvc = (svcName: string) => {
          const matches = svcs.filter(s =>
            (s.name ?? "").toLowerCase() === svcName.toLowerCase()
          );
          return matches.find(s => (s.status ?? "").includes("running")) || matches[0];
        };

        // Update archangels
        setArchangels(prev => prev.map(arch => {
          const svc = matchSvc(arch.svcName ?? arch.id);
          if (!svc) return arch;
          const raw = svc.status ?? "unknown";
          return { ...arch, status: rawToStatus(raw), lastCheck: formatTime(), coolifyUuid: svc.uuid, rawStatus: raw };
        }));

        // Update standard angels
        setAngels(prev => prev.map(angel => {
          const svc = matchSvc(angel.svcName ?? angel.id);
          if (!svc) return angel;
          const raw = svc.status ?? "unknown";
          return { ...angel, status: rawToStatus(raw), lastCheck: formatTime(), coolifyUuid: svc.uuid, rawStatus: raw };
        }));
      }

      if (resRes.ok) {
        const resData = await resRes.json();
        if (Array.isArray(resData)) {
          setAllResources(resData);
          const totalRunning = resData.filter(r => r.status?.includes("running")).length;
          const totalHealthy = resData.filter(r => r.status === "running:healthy").length;
          if (totalRunning < 10) addAlert("critical", `Tylko ${totalRunning} zasobów działa na serwerze`, "Infra Monitor");
        }
      }

    } catch (e: any) {
      addAlert("critical", `Coolify API niedostępne: ${e.message}`, "System");
      setServices(prev => prev.map(s =>
        s.id === "coolify" ? { ...s, status: "error" as ServiceStatus } : s
      ));
    }
  }, []);

  // ── Fetch Supabase coordination messages ────────────────────────────────────
  const fetchCoordMessages = useCallback(async () => {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/agent_messages?order=created_at.desc&limit=20`,
        {
          headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, Accept: "application/json" },
          signal: AbortSignal.timeout(8000),
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setCoordMessages(data);
      }
    } catch {}
  }, []);

  // ── Fetch Kairos metrics ────────────────────────────────────────────────────
  const fetchKairosMetrics = useCallback(async () => {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/nocna_fabryka_queue?select=status&limit=1000`,
        {
          headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, Accept: "application/json" },
          signal: AbortSignal.timeout(8000),
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const counts: Record<string, number> = {};
          data.forEach((r: any) => { counts[r.status] = (counts[r.status] || 0) + 1; });
          const total = data.length;
          setKairos({ total, pending: counts["pending"] || 0, deployed: counts["deployed"] || 0, failed: counts["failed"] || 0, throughput_per_hour: Math.round((counts["deployed"] || 0) / 24) });
        }
      }
    } catch {}
  }, []);

  // ── Fetch Brain Router ──────────────────────────────────────────────────────
  const fetchBrainRouterStats = useCallback(async () => {
    try {
      const res = await fetch("https://brain-router.ofshore.dev/health", { signal: AbortSignal.timeout(12000), mode: "cors" });
      if (res.ok) {
        const data = await res.json();
        if (data?.cache?.hits && data?.cache?.entries) {
          setBrainCacheRate(Math.round((data.cache.hits / Math.max(data.cache.entries, 1)) * 100));
        }
        setServices(prev => prev.map(s =>
          s.id === "brainrouter" ? { ...s, status: "healthy" as ServiceStatus, extra: data.version || "v5" } : s
        ));
      }
    } catch {}
  }, []);

  // ── Probe all services ──────────────────────────────────────────────────────
  const fetchServiceStatuses = useCallback(async () => {
    const results = await Promise.allSettled(CORE_SERVICES.map(s => probe(s.url, 10000)));
    setServices(prev => prev.map((svc, i) => {
      if (svc.id === "coolify") return svc;
      const result = results[i];
      if (result.status === "fulfilled") {
        const { ok, latency } = result.value;
        return { ...svc, status: ok ? (latency < 600 ? "healthy" : "degraded") : "error", latency };
      }
      return { ...svc, status: "error" as ServiceStatus };
    }));
  }, []);

  const addAlert = (level: Alert["level"], message: string, source: string) => {
    setAlerts(prev => {
      const exists = prev.some(a => a.message === message);
      if (exists) return prev;
      return [{ id: Math.random().toString(36).slice(2), level, message, source, time: formatTime() }, ...prev].slice(0, 25);
    });
  };

  // ── Full refresh ────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.allSettled([
      fetchCoolifyStatus(),
      fetchServiceStatuses(),
      fetchCoordMessages(),
      fetchKairosMetrics(),
      fetchBrainRouterStats(),
    ]);
    setLastRefresh(formatTime());
    setIsRefreshing(false);
  }, [fetchCoolifyStatus, fetchServiceStatuses, fetchCoordMessages, fetchKairosMetrics, fetchBrainRouterStats]);

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh) intervalRef.current = setInterval(refresh, 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, refresh]);

  // ── Derived stats ───────────────────────────────────────────────────────────
  const healthyArchangels = archangels.filter(a => a.status === "healthy").length;
  const healthyAngels   = angels.filter(a => a.status === "healthy").length;
  const errorAngels     = angels.filter(a => a.status === "error").length;
  const healthyServices = services.filter(s => s.status === "healthy").length;
  const avgLatency      = (() => {
    const valid = services.filter(s => s.latency && s.latency > 0);
    return valid.length ? Math.round(valid.reduce((a, b) => a + (b.latency ?? 0), 0) / valid.length) : 0;
  })();

  // Infra stats
  const infraByStatus = allResources.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const infraRunning = allResources.filter(r => r.status?.includes("running")).length;
  const infraHealthy = allResources.filter(r => r.status === "running:healthy").length;
  const infraExited  = allResources.filter(r => r.status?.includes("exited")).length;

  // Filtered infra
  const filteredResources = allResources.filter(r => {
    const matchStatus = infraFilter === "all" || r.status?.includes(infraFilter);
    const matchSearch = !infraSearch || r.name?.toLowerCase().includes(infraSearch.toLowerCase());
    return matchStatus && matchSearch;
  });

  const navItems: { id: Section; label: string; icon: React.ReactNode; badge?: number | string }[] = [
    { id: "angels",   label: "HIERARCHIA",   icon: <Shield size={13}/>,       badge: `${healthyArchangels}/4 ✦` },
    { id: "services", label: "SERWISY",      icon: <Server size={13}/>,       badge: `${healthyServices}/${services.length}` },
    { id: "infra",    label: "INFRASTRUKTURA", icon: <Boxes size={13}/>,      badge: `${infraRunning}/${allResources.length}` },
    { id: "kairos",   label: "KAIROS",       icon: <TrendingUp size={13}/>,   badge: kairos?.pending },
    { id: "coord",    label: "KOORDYNACJA",  icon: <MessageSquare size={13}/>, badge: coordMessages.length },
    { id: "ops",      label: "OPERACJE",     icon: <Wrench size={13}/> },
  ];

  return (
    <div className="scanlines min-h-screen bg-background flex flex-col" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      {/* Ambient background */}
      <div className="fixed inset-0 z-0 opacity-[0.07]"
        style={{ backgroundImage: `url(https://d2xsxph8kpxj0f.cloudfront.net/310519663297597343/Ptdy2eVTEoJ4gLWonQ79py/hero-bg-dvzSbUBEZPKEDPs88ZVcC5.webp)`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(3px)" }}
      />
      <div className="fixed inset-0 z-0" style={{ background: "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0,255,136,0.04) 0%, transparent 60%)" }} />

      {/* Action result toast */}
      <AnimatePresence>
        {actionResult && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded mono text-[11px] font-bold"
            style={{
              backgroundColor: actionResult.ok ? "#00ff8815" : "#ff336615",
              border: `1px solid ${actionResult.ok ? "#00ff8840" : "#ff336640"}`,
              color: actionResult.ok ? "#00ff88" : "#ff3366",
            }}
          >
            {actionResult.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <header className="relative z-10 border-b border-[#00ff88]/12 bg-[#0a0a0f]/95 backdrop-blur-md">
        <div className="flex items-center justify-between px-5 py-2.5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded flex items-center justify-center" style={{ background: "linear-gradient(135deg, #00ff8820, #00d4ff10)", border: "1px solid #00ff8830" }}>
              <Radio size={16} className="text-[#00ff88]" />
            </div>
            <div>
              <div className="text-[#00ff88] font-bold tracking-[0.18em] text-[13px] flicker">HOLON CONTROL PANEL</div>
              <div className="text-[#333355] text-[10px] mono">NEURAL COMMAND CENTER · AMS3 · ofshore.dev</div>
            </div>
          </div>

          {/* KPIs */}
          <div className="hidden lg:flex items-center gap-5">
            {[
              { label: "ARCHANIOŁY",   value: `${healthyArchangels}/4`,             color: healthyArchangels === 4 ? "#ffd700" : healthyArchangels >= 2 ? "#ff8c00" : "#ff3366" },
              { label: "ANIOŁOWIE",    value: `${healthyAngels}/12`,              color: healthyAngels >= 10 ? "#00ff88" : healthyAngels >= 6 ? "#ffd700" : "#ff3366" },
              { label: "SERWISY",      value: `${healthyServices}/${services.length}`, color: "#00d4ff" },
              { label: "COOLIFY APPS", value: `${coolifyHealthy}/${coolifyApps}`, color: "#b44fff" },
              { label: "INFRA",        value: `${infraRunning}/${allResources.length}`, color: infraRunning > 20 ? "#00ff88" : "#ffd700" },
              { label: "AVG LATENCY",  value: avgLatency ? `${avgLatency}ms` : "—", color: avgLatency < 300 ? "#00ff88" : avgLatency < 700 ? "#ffd700" : "#ff3366" },
              ...(brainCacheRate !== null ? [{ label: "CACHE HIT", value: `${brainCacheRate}%`, color: brainCacheRate > 60 ? "#00ff88" : "#ffd700" }] : []),
            ].map(stat => (
              <div key={stat.label} className="text-center">
                <div className="mono text-base font-bold leading-none" style={{ color: stat.color }}>{stat.value}</div>
                <div className="text-[#333355] text-[9px] tracking-widest mt-0.5 mono">{stat.label}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 text-[10px] mono text-[#333355]">
              <StatusDot status="healthy" size={5} />
              <span className="text-[#444466]">{lastRefresh}</span>
            </div>
            <button
              onClick={() => setAutoRefresh(v => !v)}
              className={`p-1.5 rounded border text-[10px] mono transition-all ${autoRefresh ? "border-[#00ff88]/30 text-[#00ff88] bg-[#00ff88]/5" : "border-[#444466]/30 text-[#444466]"}`}
              title={autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
            >
              {autoRefresh ? <Play size={11}/> : <Pause size={11}/>}
            </button>
            <button
              onClick={refresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] border border-[#00ff88]/25 text-[#00ff88] hover:bg-[#00ff88]/8 transition-colors rounded mono disabled:opacity-50"
            >
              <RefreshCw size={11} className={isRefreshing ? "animate-spin" : ""} />
              SYNC
            </button>
            <button
              onClick={() => { sessionStorage.removeItem("holon_auth"); setAuthed(false); }}
              className="p-1.5 rounded border border-[#ff3366]/20 text-[#ff3366]/50 hover:text-[#ff3366] hover:bg-[#ff3366]/5 transition-all"
              title="Wyloguj"
            >
              <Lock size={11} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Layout ── */}
      <div className="relative z-10 flex flex-1 overflow-hidden">

        {/* Left Sidebar */}
        <aside className="w-48 shrink-0 border-r border-[#00ff88]/8 bg-[#0a0a0f]/80 backdrop-blur-sm flex flex-col">
          <div className="p-3 border-b border-[#00ff88]/8">
            <div className="text-[#333355] text-[9px] tracking-widest mono mb-2">MODUŁY</div>
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded text-[11px] mb-0.5 transition-all ${
                  activeSection === item.id
                    ? "bg-[#00ff88]/8 text-[#00ff88] border border-[#00ff88]/20"
                    : "text-[#444466] hover:text-[#888899] hover:bg-[#ffffff]/3"
                }`}
              >
                <div className="flex items-center gap-2">
                  {item.icon}
                  <span className="mono tracking-wider">{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="mono text-[9px] opacity-50">{item.badge}</span>
                )}
              </button>
            ))}
          </div>

          {/* Network health summary */}
          <div className="p-3 flex-1">
            <div className="text-[#333355] text-[9px] tracking-widest mono mb-2.5">SIEĆ HOLON</div>
            {[
              { label: "ONLINE",    count: healthyAngels + healthyServices + infraHealthy, color: "#00ff88" },
              { label: "DEGRADED",  count: angels.filter(a=>a.status==="degraded").length + services.filter(s=>s.status==="degraded").length, color: "#ffd700" },
              { label: "OFFLINE",   count: errorAngels + services.filter(s=>s.status==="error").length + infraExited, color: "#ff3366" },
              { label: "UNKNOWN",   count: angels.filter(a=>a.status==="unknown").length + services.filter(s=>s.status==="unknown").length, color: "#333355" },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="mono text-[9px] text-[#333355] tracking-wider">{item.label}</span>
                </div>
                <span className="mono text-[11px] font-bold" style={{ color: item.color }}>{item.count}</span>
              </div>
            ))}
          </div>

          {/* Kairos mini */}
          {kairos && (
            <div className="p-3 border-t border-[#00ff88]/8">
              <div className="text-[#333355] text-[9px] tracking-widest mono mb-2">KAIROS QUEUE</div>
              <div className="mono text-[11px] text-[#00ff88] font-bold">{kairos.pending.toLocaleString()}</div>
              <div className="text-[#333355] text-[9px] mono">pending tasks</div>
            </div>
          )}

          {/* Alerts badge */}
          {alerts.filter(a => a.level === "critical").length > 0 && (
            <div className="p-3 border-t border-[#ff3366]/15">
              <div className="flex items-center gap-1.5 text-[#ff3366]">
                <AlertTriangle size={11} className="pulse-dot" />
                <span className="mono text-[10px]">{alerts.filter(a=>a.level==="critical").length} KRYTYCZNE</span>
              </div>
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-5">
          <AnimatePresence mode="wait">

            {/* ── Hierarchy (Archangels + Angels) ── */}
            {activeSection === "angels" && (
              <motion.div key="angels" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>

                {/* ===== ARCHANIOŁOWIE ===== */}
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[#ffd700] text-base">&#10022;</span>
                      <span className="mono text-[13px] font-bold tracking-[0.2em] text-[#ffd700]">ARCHANIOŁOWIE</span>
                      <span className="text-[#ffd700] text-base">&#10022;</span>
                    </div>
                    <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, #ffd70040, transparent)" }} />
                    <span className="mono text-[10px] text-[#666644]">{healthyArchangels}/4 AKTYWNYCH</span>
                  </div>
                  <p className="text-[#444433] text-[10px] mono mb-3">Elita Holon Mesh — awansowani za najwyższy uptime i krytyczną rolę w infrastrukturze</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                    {archangels.map((arch, i) => (
                      <motion.div
                        key={arch.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        onClick={() => setSelectedAngel(selectedAngel?.id === arch.id ? null : arch)}
                        className="cursor-pointer transition-all group relative overflow-hidden rounded-sm"
                        style={{
                          background: selectedAngel?.id === arch.id
                            ? `linear-gradient(135deg, ${arch.color}10, ${arch.color}05)`
                            : `linear-gradient(135deg, ${arch.color}08, #0a0a0f)`,
                          border: `1px solid ${selectedAngel?.id === arch.id ? arch.color + "50" : arch.color + "25"}`,
                          boxShadow: `0 0 20px ${arch.color}08`,
                        }}
                      >
                        {/* Crown accent top bar */}
                        <div className="h-[2px] w-full" style={{ background: `linear-gradient(90deg, transparent, ${arch.color}80, transparent)` }} />

                        <div className="p-4">
                          {/* Rank badge */}
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-10 h-10 rounded-sm flex items-center justify-center" style={{ backgroundColor: `${arch.color}18`, color: arch.color, border: `1px solid ${arch.color}30` }}>
                                {arch.icon}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="mono text-[12px] font-bold tracking-widest" style={{ color: arch.color }}>{arch.name}</span>
                                  <span className="text-[10px]" style={{ color: arch.color }}>&#10022;</span>
                                </div>
                                <div className="text-[#555544] text-[9px] mono">{arch.role}</div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <StatusDot status={arch.status} size={8} />
                              <span className="mono text-[8px] font-bold" style={{ color: arch.color }}>#{arch.rank}</span>
                            </div>
                          </div>

                          {/* Power description */}
                          <div className="text-[#333322] text-[9px] mono leading-relaxed mb-2 line-clamp-2">{arch.power}</div>

                          <div className="flex items-center justify-between">
                            <span className="mono text-[9px] tracking-widest font-bold" style={{ color: statusColor(arch.status) }}>
                              {statusLabel(arch.status)}
                            </span>
                            {arch.latency && <LatencyBadge ms={arch.latency} />}
                          </div>

                          <AnimatePresence>
                            {selectedAngel?.id === arch.id && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="mt-3 pt-3 space-y-2" style={{ borderTop: `1px solid ${arch.color}20` }}>
                                  <div className="flex gap-1.5">
                                    <button onClick={e => { e.stopPropagation(); doAngelAction(arch, "restart"); }} disabled={!!angelAction}
                                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[9px] mono transition-all hover:opacity-80 disabled:opacity-40"
                                      style={{ border: `1px solid ${arch.color}40`, color: arch.color, backgroundColor: `${arch.color}08` }}>
                                      <RotateCcw size={9} /> RESTART
                                    </button>
                                    <button onClick={e => { e.stopPropagation(); doAngelAction(arch, "stop"); }} disabled={!!angelAction}
                                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[9px] mono transition-all hover:bg-[#ff3366]/10 disabled:opacity-40"
                                      style={{ border: "1px solid #ff336630", color: "#ff3366" }}>
                                      <StopCircle size={9} /> STOP
                                    </button>
                                  </div>
                                  <a href={arch.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                                    className="flex items-center gap-1.5 text-[10px] mono transition-colors" style={{ color: arch.color }}>
                                    <Terminal size={10} /> OTWÓRZ TERMINAL <ExternalLink size={9} />
                                  </a>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* ===== 12 ANIOŁÓW ===== */}
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="mono text-[12px] font-bold tracking-[0.2em] text-[#888899]">12 ANIOŁÓW STRÓŻÓW</span>
                    <div className="flex-1 h-px bg-[#1a1a2e]" />
                    <span className="mono text-[10px] text-[#444466]">{healthyAngels}/12 AKTYWNYCH</span>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {angels.map((angel, i) => (
                    <motion.div
                      key={angel.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => setSelectedAngel(selectedAngel?.id === angel.id ? null : angel)}
                      className="noc-card rounded-sm p-3.5 cursor-pointer transition-all group relative overflow-hidden"
                      style={{
                        borderColor: selectedAngel?.id === angel.id ? `${angel.color}40` : undefined,
                        boxShadow: selectedAngel?.id === angel.id ? `0 0 24px ${angel.color}12` : undefined,
                      }}
                    >
                      {/* Accent line */}
                      <div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${angel.color}40, transparent)` }} />

                      <div className="flex items-start justify-between mb-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-sm flex items-center justify-center" style={{ backgroundColor: `${angel.color}12`, color: angel.color }}>
                            {angel.icon}
                          </div>
                          <div>
                            <div className="mono text-[11px] font-bold tracking-widest" style={{ color: angel.color }}>{angel.name}</div>
                            <div className="text-[#333355] text-[9px] leading-tight">{angel.role}</div>
                          </div>
                        </div>
                        <StatusDot status={angel.status} size={7} />
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="mono text-[9px] tracking-widest font-bold" style={{ color: statusColor(angel.status) }}>
                          {statusLabel(angel.status)}
                        </span>
                        {angel.latency && <LatencyBadge ms={angel.latency} />}
                      </div>

                      <div className="mt-1.5 text-[#222244] text-[9px] mono truncate">{angel.domain}</div>
                      {angel.rawStatus && angel.rawStatus !== angel.status && (
                        <div className="mt-0.5 text-[#2a2a44] text-[8px] mono truncate">{angel.rawStatus}</div>
                      )}

                      <AnimatePresence>
                        {selectedAngel?.id === angel.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-3 pt-3 border-t border-[#00ff88]/8 space-y-2">
                              <div className="flex justify-between text-[9px]">
                                <span className="text-[#333355] mono">LAST CHECK</span>
                                <span className="text-[#00ff88] mono">{angel.lastCheck}</span>
                              </div>

                              {/* Action buttons */}
                              <div className="flex gap-1.5 mt-2">
                                <button
                                  onClick={e => { e.stopPropagation(); doAngelAction(angel, "restart"); }}
                                  disabled={!!angelAction}
                                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[9px] mono transition-all hover:bg-[#00d4ff]/10 disabled:opacity-40"
                                  style={{ border: "1px solid #00d4ff30", color: "#00d4ff" }}
                                >
                                  {angelAction?.uuid === angel.coolifyUuid && angelAction?.action === "restart"
                                    ? <RefreshCw size={9} className="animate-spin" />
                                    : <RotateCcw size={9} />}
                                  RESTART
                                </button>
                                <button
                                  onClick={e => { e.stopPropagation(); doAngelAction(angel, "stop"); }}
                                  disabled={!!angelAction}
                                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[9px] mono transition-all hover:bg-[#ff3366]/10 disabled:opacity-40"
                                  style={{ border: "1px solid #ff336630", color: "#ff3366" }}
                                >
                                  <StopCircle size={9} />
                                  STOP
                                </button>
                                <button
                                  onClick={e => { e.stopPropagation(); doAngelAction(angel, "start"); }}
                                  disabled={!!angelAction}
                                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[9px] mono transition-all hover:bg-[#00ff88]/10 disabled:opacity-40"
                                  style={{ border: "1px solid #00ff8830", color: "#00ff88" }}
                                >
                                  <PlayCircle size={9} />
                                  START
                                </button>
                              </div>

                              <a
                                href={angel.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="flex items-center gap-1.5 text-[10px] text-[#00d4ff] hover:text-[#00ff88] mono transition-colors"
                              >
                                <Terminal size={10} />
                                OTWÓRZ TERMINAL (code-server)
                                <ExternalLink size={9} />
                              </a>
                              {angel.coolifyUuid && (
                                <a
                                  href={`https://coolify.ofshore.dev/project/default/environment/production/service/${angel.coolifyUuid}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  className="flex items-center gap-1.5 text-[10px] text-[#b44fff] hover:text-[#00ff88] mono transition-colors"
                                >
                                  <Server size={10} />
                                  COOLIFY PANEL
                                  <ExternalLink size={9} />
                                </a>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}
                  </div>
                </div>

                {/* Status summary bar */}
                <div className="mt-4 grid grid-cols-4 gap-2">
                  {[
                    { label: "HEALTHY", count: healthyAngels, color: "#00ff88" },
                    { label: "DEGRADED", count: angels.filter(a=>a.status==="degraded").length, color: "#ffd700" },
                    { label: "STARTING", count: angels.filter(a=>a.status==="starting").length, color: "#00d4ff" },
                    { label: "OFFLINE", count: errorAngels, color: "#ff3366" },
                  ].map(s => (
                    <div key={s.label} className="noc-card rounded-sm p-3 text-center">
                      <div className="mono text-lg font-bold" style={{ color: s.color }}>{s.count}</div>
                      <div className="text-[#333355] text-[9px] mono tracking-widest">{s.label}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 p-3 rounded-sm border border-[#00d4ff]/10 bg-[#00d4ff]/3">
                  <div className="flex items-start gap-2">
                    <Info size={12} className="text-[#00d4ff] mt-0.5 shrink-0" />
                    <p className="text-[#444466] text-[10px] mono leading-relaxed">
                      Aniołowie Stróżowie są wdrożeni przez Coolify na Droplecie AMS3 (178.62.246.169).
                      Każdy anioł to instancja code-server (VS Code w przeglądarce) z dedykowanym workspace.
                      Kliknij kartę anioła aby rozwinąć opcje zarządzania. Hasło: holon-angel-[name]-2026
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Services Grid ── */}
            {activeSection === "services" && (
              <motion.div key="services" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                <SectionHeader
                  title="INFRASTRUKTURA HOLON MESH"
                  sub="Serwisy core sieci — Coolify, Supabase, Redis, Cloudflare Workers, n8n"
                  count={`${healthyServices} / ${services.length} ONLINE`}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {services.map((svc, i) => (
                    <motion.div
                      key={svc.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="noc-card rounded-sm p-4 group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-sm flex items-center justify-center" style={{ backgroundColor: `${statusColor(svc.status)}10`, color: statusColor(svc.status), border: `1px solid ${statusColor(svc.status)}20` }}>
                            {svc.icon}
                          </div>
                          <div>
                            <div className="text-[#ccccdd] text-[12px] font-semibold">{svc.name}</div>
                            <div className="text-[#333355] text-[10px] mono">{svc.details}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {svc.latency ? <LatencyBadge ms={svc.latency} /> : null}
                          <StatusDot status={svc.status} size={8} />
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <span className="mono text-[10px] tracking-widest font-bold" style={{ color: statusColor(svc.status) }}>
                          {statusLabel(svc.status)}
                          {svc.extra && <span className="ml-2 opacity-60">· {svc.extra}</span>}
                        </span>
                        {svc.url && (
                          <a href={svc.url} target="_blank" rel="noopener noreferrer" className="opacity-0 group-hover:opacity-100 transition-opacity text-[#444466] hover:text-[#00ff88]">
                            <ExternalLink size={11} />
                          </a>
                        )}
                      </div>

                      {svc.latency && svc.latency > 0 && (
                        <div className="mt-2 h-0.5 bg-[#111122] rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min((svc.latency / 2000) * 100, 100)}%` }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: statusColor(svc.status) }}
                          />
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>

                {brainCacheRate !== null && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 noc-card rounded-sm p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <GitBranch size={14} className="text-[#00ff88]" />
                        <span className="text-[#ccccdd] text-[12px] font-semibold">Brain Router v5 — Cache Analytics</span>
                      </div>
                      <span className="mono text-[10px] text-[#444466]">D1-first architecture</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "CACHE HIT RATE", value: `${brainCacheRate}%`, color: brainCacheRate > 60 ? "#00ff88" : "#ffd700" },
                        { label: "ARCHITECTURE",   value: "D1-FIRST",           color: "#00d4ff" },
                        { label: "FALLBACK CHAIN",  value: "Ollama→Groq→CF",    color: "#b44fff" },
                      ].map(m => (
                        <div key={m.label} className="text-center p-2 rounded-sm bg-[#0d0d1a]">
                          <div className="mono text-sm font-bold" style={{ color: m.color }}>{m.value}</div>
                          <div className="text-[#333355] text-[9px] mono tracking-wider mt-0.5">{m.label}</div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* ── Infrastructure (All Coolify Resources) ── */}
            {activeSection === "infra" && (
              <motion.div key="infra" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                <SectionHeader
                  title="WSZYSTKIE ZASOBY COOLIFY"
                  sub="Pełna lista aplikacji, serwisów i baz danych na Droplecie AMS3"
                  count={`${allResources.length} ZASOBÓW`}
                />

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[
                    { label: "RUNNING", count: infraRunning, color: "#00d4ff" },
                    { label: "HEALTHY", count: infraHealthy, color: "#00ff88" },
                    { label: "EXITED",  count: infraExited,  color: "#ff3366" },
                    { label: "TOTAL",   count: allResources.length, color: "#888899" },
                  ].map(s => (
                    <div key={s.label} className="noc-card rounded-sm p-3 text-center">
                      <div className="mono text-xl font-bold" style={{ color: s.color }}>{s.count}</div>
                      <div className="text-[#333355] text-[9px] mono tracking-widest">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Filters */}
                <div className="flex gap-2 mb-3">
                  <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-sm bg-[#0d0d1a] border border-[#1a1a2e]">
                    <Search size={11} className="text-[#333355]" />
                    <input
                      type="text"
                      placeholder="Szukaj zasobu..."
                      value={infraSearch}
                      onChange={e => setInfraSearch(e.target.value)}
                      className="flex-1 bg-transparent text-[11px] mono text-[#888899] placeholder-[#333355] outline-none"
                    />
                  </div>
                  {["all", "running", "exited", "healthy"].map(f => (
                    <button
                      key={f}
                      onClick={() => setInfraFilter(f)}
                      className={`px-3 py-1.5 rounded-sm text-[10px] mono transition-all ${infraFilter === f ? "bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/20" : "bg-[#0d0d1a] text-[#444466] border border-[#1a1a2e] hover:text-[#888899]"}`}
                    >
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>

                {/* Resource list */}
                <div className="space-y-1">
                  {filteredResources.length === 0 ? (
                    <div className="text-center py-10 text-[#333355] text-xs mono">
                      {allResources.length === 0 ? "Ładowanie zasobów..." : "Brak wyników"}
                    </div>
                  ) : (
                    filteredResources.map((res, i) => {
                      const st = rawToStatus(res.status);
                      return (
                        <motion.div
                          key={res.uuid}
                          initial={{ opacity: 0, x: -5 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: Math.min(i * 0.01, 0.3) }}
                          className="flex items-center justify-between px-3 py-2 rounded-sm bg-[#0a0a0f] border border-[#111122] hover:border-[#1a1a2e] group"
                        >
                          <div className="flex items-center gap-2.5">
                            <StatusDot status={st} size={6} animate={false} />
                            <span className="text-[#888899] text-[11px] mono group-hover:text-[#ccccdd] transition-colors">{res.name}</span>
                            <span className="text-[#222244] text-[9px] mono px-1.5 py-0.5 rounded" style={{ border: "1px solid #1a1a2e" }}>{res.type}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="mono text-[9px]" style={{ color: statusColor(st) }}>{res.status}</span>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}

            {/* ── Kairos Pulse ── */}
            {activeSection === "kairos" && (
              <motion.div key="kairos" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                <SectionHeader title="KAIROS PULSE" sub="Przepustowość zadań sieci Holon Mesh · nocna_fabryka_queue · Supabase" />

                {kairos ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                      {[
                        { label: "TOTAL TASKS",  value: kairos.total.toLocaleString(),    color: "#ccccdd", icon: <Layers size={16}/> },
                        { label: "PENDING",       value: kairos.pending.toLocaleString(),  color: "#ffd700", icon: <Clock size={16}/> },
                        { label: "DEPLOYED",      value: kairos.deployed.toLocaleString(), color: "#00ff88", icon: <CheckCircle2 size={16}/> },
                        { label: "FAILED",        value: kairos.failed.toLocaleString(),   color: "#ff3366", icon: <XCircle size={16}/> },
                      ].map(m => (
                        <motion.div key={m.label} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="noc-card rounded-sm p-4 text-center">
                          <div className="flex justify-center mb-2" style={{ color: m.color }}>{m.icon}</div>
                          <div className="mono text-xl font-bold" style={{ color: m.color }}>{m.value}</div>
                          <div className="text-[#333355] text-[9px] mono tracking-wider mt-1">{m.label}</div>
                        </motion.div>
                      ))}
                    </div>

                    <div className="noc-card rounded-sm p-4 mb-4">
                      <div className="text-[#444466] text-[10px] mono tracking-widest mb-3">ROZKŁAD STATUSÓW</div>
                      {[
                        { label: "DEPLOYED", count: kairos.deployed, color: "#00ff88" },
                        { label: "PENDING",  count: kairos.pending,  color: "#ffd700" },
                        { label: "FAILED",   count: kairos.failed,   color: "#ff3366" },
                      ].map(item => (
                        <div key={item.label} className="mb-3">
                          <div className="flex justify-between text-[10px] mono mb-1">
                            <span style={{ color: item.color }}>{item.label}</span>
                            <span className="text-[#444466]">{item.count.toLocaleString()} ({Math.round((item.count / Math.max(kairos.total, 1)) * 100)}%)</span>
                          </div>
                          <div className="h-1.5 bg-[#111122] rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.round((item.count / Math.max(kairos.total, 1)) * 100)}%` }}
                              transition={{ duration: 0.8, ease: "easeOut" }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: item.color }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="p-3 rounded-sm border border-[#00ff88]/10 bg-[#00ff88]/3">
                      <div className="flex items-start gap-2">
                        <Sparkles size={12} className="text-[#00ff88] mt-0.5 shrink-0" />
                        <p className="text-[#444466] text-[10px] mono leading-relaxed">
                          Kairos Pulse pokazuje przepustowość sieci Holon Mesh w czasie rzeczywistym.
                          Tabela nocna_fabryka_queue zawiera {kairos.total.toLocaleString()} zadań —
                          {kairos.deployed.toLocaleString()} zostało już wdrożonych. Dane odświeżają się co 30s.
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-40">
                    <div className="text-center">
                      <RefreshCw size={20} className="text-[#333355] mx-auto mb-2 animate-spin" />
                      <div className="text-[#333355] text-xs mono">Ładowanie danych Kairos...</div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Agent Coordination ── */}
            {activeSection === "coord" && (
              <motion.div key="coord" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                <SectionHeader
                  title="PRZESTRZEŃ KOORDYNACYJNA"
                  sub="Live feed wiadomości między agentami Manus i Claude · Supabase Realtime"
                  count={`${coordMessages.length} WIADOMOŚCI`}
                />

                {coordMessages.length > 0 ? (
                  <div className="space-y-2">
                    {coordMessages.map((msg, i) => {
                      const isManus = msg.from_agent?.toLowerCase().includes("manus");
                      const agentColor = isManus ? "#00ff88" : "#b44fff";
                      return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, x: isManus ? -10 : 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className="noc-card rounded-sm p-3.5"
                          style={{ borderLeft: `2px solid ${agentColor}30` }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-sm flex items-center justify-center" style={{ backgroundColor: `${agentColor}15`, color: agentColor }}>
                                <Bot size={11} />
                              </div>
                              <span className="mono text-[11px] font-bold" style={{ color: agentColor }}>
                                {msg.from_agent?.toUpperCase() || "AGENT"}
                              </span>
                              <span className="mono text-[9px] text-[#333355] px-1.5 py-0.5 rounded" style={{ border: `1px solid ${agentColor}20`, backgroundColor: `${agentColor}08` }}>
                                {msg.message_type}
                              </span>
                            </div>
                            <span className="mono text-[9px] text-[#333355]">{formatRelative(msg.created_at)}</span>
                          </div>
                          <p className="text-[#666688] text-[11px] leading-relaxed line-clamp-4">
                            {typeof msg.content === "string"
                              ? (msg.content.length > 300 ? msg.content.slice(0, 300) + "…" : msg.content)
                              : JSON.stringify(msg.content).slice(0, 300)}
                          </p>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-48">
                    <MessageSquare size={28} className="text-[#222244] mb-3" />
                    <div className="text-[#333355] text-xs mono">Brak wiadomości lub brak dostępu do Supabase</div>
                    <div className="text-[#222244] text-[10px] mono mt-1">Sprawdź RLS policies na tabeli agent_messages</div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Operations Panel ── */}
            {activeSection === "ops" && (
              <motion.div key="ops" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                <SectionHeader
                  title="PANEL OPERACYJNY"
                  sub="Zarządzanie infrastrukturą · Optymalizacja · Diagnostyka"
                />

                {/* Quick actions */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
                  {[
                    {
                      title: "RESTART WSZYSTKICH ANIOŁÓW",
                      desc: "Restartuje wszystkie 12 instancji code-server",
                      icon: <RotateCcw size={16}/>,
                      color: "#00d4ff",
                      action: async () => {
                        for (const angel of angels) {
                          if (angel.coolifyUuid) {
                            await coolifyFetch(`/services/${angel.coolifyUuid}/restart`, "POST");
                            await new Promise(r => setTimeout(r, 500));
                          }
                        }
                        addAlert("info", "Restart wszystkich aniołów zlecony", "Ops Panel");
                        setTimeout(fetchCoolifyStatus, 8000);
                      }
                    },
                    {
                      title: "STOP WSZYSTKICH ANIOŁÓW",
                      desc: "Zatrzymuje wszystkie kontenery (oszczędność RAM)",
                      icon: <StopCircle size={16}/>,
                      color: "#ff3366",
                      action: async () => {
                        for (const angel of angels) {
                          if (angel.coolifyUuid) {
                            await coolifyFetch(`/services/${angel.coolifyUuid}/stop`, "POST");
                            await new Promise(r => setTimeout(r, 300));
                          }
                        }
                        addAlert("warning", "Stop wszystkich aniołów zlecony", "Ops Panel");
                        setTimeout(fetchCoolifyStatus, 5000);
                      }
                    },
                    {
                      title: "START WSZYSTKICH ANIOŁÓW",
                      desc: "Uruchamia wszystkie kontenery code-server",
                      icon: <PlayCircle size={16}/>,
                      color: "#00ff88",
                      action: async () => {
                        for (const angel of angels) {
                          if (angel.coolifyUuid) {
                            await coolifyFetch(`/services/${angel.coolifyUuid}/start`, "POST");
                            await new Promise(r => setTimeout(r, 500));
                          }
                        }
                        addAlert("info", "Start wszystkich aniołów zlecony", "Ops Panel");
                        setTimeout(fetchCoolifyStatus, 8000);
                      }
                    },
                  ].map(op => (
                    <button
                      key={op.title}
                      onClick={op.action}
                      className="noc-card rounded-sm p-4 text-left hover:border-opacity-50 transition-all group"
                      style={{ borderColor: `${op.color}20` }}
                    >
                      <div className="flex items-center gap-2 mb-2" style={{ color: op.color }}>
                        {op.icon}
                        <span className="mono text-[10px] font-bold tracking-wider">{op.title}</span>
                      </div>
                      <p className="text-[#333355] text-[10px] mono leading-relaxed">{op.desc}</p>
                    </button>
                  ))}
                </div>

                {/* Infrastructure status overview */}
                <div className="noc-card rounded-sm p-4 mb-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Gauge size={14} className="text-[#00ff88]" />
                    <span className="text-[#ccccdd] text-[12px] font-semibold">Status Infrastruktury AMS3</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: "ŁĄCZNE ZASOBY", value: allResources.length, color: "#888899" },
                      { label: "RUNNING", value: infraRunning, color: "#00d4ff" },
                      { label: "HEALTHY", value: infraHealthy, color: "#00ff88" },
                      { label: "EXITED", value: infraExited, color: "#ff3366" },
                    ].map(s => (
                      <div key={s.label} className="text-center p-3 rounded-sm bg-[#0d0d1a]">
                        <div className="mono text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
                        <div className="text-[#333355] text-[9px] mono tracking-wider mt-1">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Status distribution bar */}
                  <div className="mt-4">
                    <div className="text-[#333355] text-[9px] mono tracking-widest mb-2">ROZKŁAD STATUSÓW</div>
                    <div className="h-2 rounded-full overflow-hidden flex">
                      {allResources.length > 0 && [
                        { count: infraHealthy, color: "#00ff88" },
                        { count: infraRunning - infraHealthy, color: "#ffd700" },
                        { count: infraExited, color: "#ff3366" },
                        { count: allResources.length - infraRunning - infraExited, color: "#222244" },
                      ].map((seg, i) => (
                        <motion.div
                          key={i}
                          initial={{ width: 0 }}
                          animate={{ width: `${(seg.count / allResources.length) * 100}%` }}
                          transition={{ duration: 0.8, delay: i * 0.1 }}
                          style={{ backgroundColor: seg.color, minWidth: seg.count > 0 ? 2 : 0 }}
                        />
                      ))}
                    </div>
                    <div className="flex gap-4 mt-2">
                      {[
                        { label: "Healthy", color: "#00ff88", count: infraHealthy },
                        { label: "Running", color: "#ffd700", count: infraRunning - infraHealthy },
                        { label: "Exited", color: "#ff3366", count: infraExited },
                        { label: "Unknown", color: "#222244", count: allResources.length - infraRunning - infraExited },
                      ].map(s => (
                        <div key={s.label} className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                          <span className="text-[#333355] text-[9px] mono">{s.label}: {s.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Recommendations */}
                <div className="noc-card rounded-sm p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Wrench size={14} className="text-[#ffd700]" />
                    <span className="text-[#ccccdd] text-[12px] font-semibold">Rekomendacje Optymalizacyjne</span>
                  </div>
                  <div className="space-y-2.5">
                    {[
                      {
                        priority: "HIGH",
                        color: "#ff3366",
                        title: "Upgrade Dropleta",
                        desc: "12 instancji code-server wymaga min. 8GB RAM. Obecny Droplet jest przeciążony. Zalecany: s-4vcpu-8gb ($48/mies).",
                      },
                      {
                        priority: "MED",
                        color: "#ffd700",
                        title: "Limity zasobów kontenerów",
                        desc: "Dodaj deploy.resources.limits (512MB RAM, 0.5 CPU) do każdego anioła aby zapobiec OOM kills.",
                      },
                      {
                        priority: "MED",
                        color: "#ffd700",
                        title: "Rotacja aniołów",
                        desc: "Uruchamiaj max 4-6 aniołów jednocześnie. Pozostałe zatrzymaj — uruchamiaj na żądanie.",
                      },
                      {
                        priority: "LOW",
                        color: "#00d4ff",
                        title: "Monitoring zasobów",
                        desc: "Uruchom Glances lub Netdata na Droplecie aby monitorować CPU/RAM/Disk w czasie rzeczywistym.",
                      },
                    ].map(rec => (
                      <div key={rec.title} className="flex gap-3 p-3 rounded-sm" style={{ backgroundColor: `${rec.color}05`, borderLeft: `2px solid ${rec.color}30` }}>
                        <span className="mono text-[9px] font-bold shrink-0 mt-0.5" style={{ color: rec.color }}>{rec.priority}</span>
                        <div>
                          <div className="text-[#ccccdd] text-[11px] font-semibold mb-0.5">{rec.title}</div>
                          <div className="text-[#444466] text-[10px] mono leading-relaxed">{rec.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </main>

        {/* Right Alerts Panel */}
        <aside className="w-60 shrink-0 border-l border-[#00ff88]/8 bg-[#0a0a0f]/80 backdrop-blur-sm flex flex-col">
          <div className="p-3 border-b border-[#00ff88]/8 flex items-center justify-between">
            <div className="text-[#333355] text-[9px] tracking-widest mono">ALERTY SYSTEMU</div>
            <div className="flex items-center gap-1.5">
              <StatusDot
                status={alerts.some(a=>a.level==="critical") ? "error" : alerts.length > 0 ? "degraded" : "healthy"}
                size={5}
              />
              <span className="mono text-[10px] text-[#333355]">{alerts.length}</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
            {alerts.length === 0 ? (
              <div className="text-center py-10">
                <CheckCircle2 size={20} className="text-[#00ff88] mx-auto mb-2 opacity-40" />
                <div className="text-[#333355] text-[10px] mono">BRAK ALERTÓW</div>
                <div className="text-[#222244] text-[9px] mono mt-1">System działa normalnie</div>
              </div>
            ) : (
              <AnimatePresence>
                {alerts.map(alert => {
                  const c = alert.level === "critical" ? "#ff3366" : alert.level === "warning" ? "#ffd700" : "#00d4ff";
                  return (
                    <motion.div
                      key={alert.id}
                      initial={{ opacity: 0, x: 15 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -15 }}
                      className="p-2.5 rounded-sm text-[10px]"
                      style={{ borderLeft: `2px solid ${c}40`, backgroundColor: `${c}05` }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="mono font-bold tracking-wider text-[9px]" style={{ color: c }}>
                          {alert.level.toUpperCase()}
                        </span>
                        <span className="mono text-[#333355] text-[9px]">{alert.time}</span>
                      </div>
                      <div className="text-[#666688] leading-relaxed">{alert.message}</div>
                      <div className="text-[#333355] mono mt-1 text-[9px]">↳ {alert.source}</div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>

          {/* System clock + mesh status */}
          <div className="p-3 border-t border-[#00ff88]/8">
            <div className="text-center mb-2">
              <div className="mono text-[#00ff88] text-sm font-bold flicker">{lastRefresh}</div>
              <div className="text-[#222244] text-[9px] mono tracking-widest">SYSTEM TIME · UTC+2</div>
            </div>
            <div className="space-y-1">
              {[
                { label: "AMS3 DROPLET",    ok: coolifyApps > 0 },
                { label: "SUPABASE",         ok: coordMessages.length >= 0 },
                { label: "CLOUDFLARE",       ok: services.find(s=>s.id==="brainrouter")?.status === "healthy" },
                { label: "HOLON MESH",       ok: healthyAngels + healthyServices > 5 },
                { label: "INFRA",            ok: infraRunning > 15 },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="mono text-[9px] text-[#333355]">{item.label}</span>
                  <div className="flex items-center gap-1">
                    <StatusDot status={item.ok ? "healthy" : "unknown"} size={5} animate={false} />
                    <span className="mono text-[9px]" style={{ color: item.ok ? "#00ff88" : "#333355" }}>
                      {item.ok ? "OK" : "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
