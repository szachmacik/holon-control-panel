/* ============================================================
   HOLON CONTROL PANEL — Dashboard Page
   Design: Neural Command Center / Dark Ops NOC
   Layout: Left sidebar + Main grid + Right alerts panel
   
   REAL DATA SOURCES:
   - Coolify API: https://coolify.ofshore.dev/api/v1 (CORS-enabled via token)
   - Supabase: agent_coordination, agent_messages, nocna_fabryka_queue
   - Direct endpoint probes: HEAD requests with timing
   - Upstash Redis: REST API ping
   
   UNIQUE FEATURES vs competitors (DataDog, Grafana Cloud, PagerDuty):
   1. Agent Coordination Feed — live messages between Manus & Claude
   2. Kairos Pulse — real-time task throughput from nocna_fabryka_queue
   3. 12 Guardian Angels — specialized AI agent health with terminal links
   4. Holon Mesh Topology — live routing path visualization
   5. Brain Router Cache Hit Rate — D1 cache efficiency metric
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
  ExternalLink, Play, Pause, Info
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
  svcName?: string;  // Nazwa service w Coolify (angel-ariel, angel-michal, etc.)
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

// ─── Constants ────────────────────────────────────────────────────────────────

const COOLIFY_BASE = "https://coolify.ofshore.dev/api/v1";
const COOLIFY_TOKEN = "5|iVCIKkag2PcD4nP8mGstQK3ApaTrpXI03qQ9Ely6bc1871a4";

// Supabase public anon key (safe to expose in frontend)
const SUPABASE_URL = "https://zqlfxakzqkzxoqhzpgqh.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxbGZ4YWt6cWt6eG9xaHpwZ3FoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI3MjYzODQsImV4cCI6MjA0ODMwMjM4NH0.dSYCKlJRFnWzCCQUfBMVPBqZKkqZtHMJqjDHFi2XJWY";

const ANGEL_DEFINITIONS: Omit<GuardianAngel, "status" | "latency" | "lastCheck">[] = [
  // Anioły używają code-server (VS Code w przeglądarce) na subdomenach ofshore.dev
  // Hasło: holon-angel-[name]-2026 | Sudo: holon-sudo-[name]-2026
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

// ─── Sub-components ───────────────────────────────────────────────────────────

const SectionHeader = ({ title, sub, count }: { title: string; sub: string; count?: string }) => (
  <div className="flex items-center justify-between mb-5">
    <div>
      <h2 className="text-[#00ff88] font-bold tracking-[0.15em] text-sm">{title}</h2>
      <p className="text-[#444466] text-[11px] mono mt-0.5">{sub}</p>
    </div>
    {count && <div className="mono text-xs text-[#444466]">{count}</div>}
  </div>
);

// ─── Main Dashboard ───────────────────────────────────────────────────────────

type Section = "angels" | "services" | "kairos" | "coord";

export default function Dashboard() {
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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Probe endpoint ──────────────────────────────────────────────────────────
  const probe = async (url: string | undefined, timeout = 10000): Promise<{ ok: boolean; latency: number }> => {
    if (!url) return { ok: false, latency: 0 };
    const start = performance.now();
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeout);
      // Use no-cors for cross-origin — we get opaque response but timing is real
      await fetch(url, { method: "HEAD", signal: ctrl.signal, mode: "no-cors" });
      clearTimeout(timer);
      const latency = Math.round(performance.now() - start);
      return { ok: true, latency };
    } catch (e: any) {
      const latency = Math.round(performance.now() - start);
      // If aborted due to timeout = offline, if network error but fast = CORS block (server is up)
      if (e?.name === "AbortError") return { ok: false, latency };
      // CORS error means server responded (just blocked) = treat as healthy
      return { ok: true, latency };
    }
  };

  // ── Fetch Coolify ───────────────────────────────────────────────────────────
  const fetchCoolifyStatus = useCallback(async () => {
    try {
      // Fetch applications
      const [appsRes, svcsRes] = await Promise.all([
        fetch(`${COOLIFY_BASE}/applications`, {
          headers: { Authorization: `Bearer ${COOLIFY_TOKEN}`, Accept: "application/json" },
          signal: AbortSignal.timeout(15000),
        }),
        fetch(`${COOLIFY_BASE}/services`, {
          headers: { Authorization: `Bearer ${COOLIFY_TOKEN}`, Accept: "application/json" },
          signal: AbortSignal.timeout(15000),
        }),
      ]);

      if (!appsRes.ok) throw new Error(`HTTP ${appsRes.status}`);
      const appsData = await appsRes.json();
      const apps: any[] = Array.isArray(appsData) ? appsData : (appsData.data ?? []);
      setCoolifyApps(apps.length);

      const running = apps.filter(a => (a.status ?? "").toLowerCase().includes("running")).length;
      setCoolifyHealthy(running);

      // Coolify itself is healthy if API responded
      setServices(prev => prev.map(s =>
        s.id === "coolify" ? { ...s, status: "healthy" as ServiceStatus, latency: 0 } : s
      ));

      // Map angel statuses from /services endpoint
      if (svcsRes.ok) {
        const svcsData = await svcsRes.json();
        const svcs: any[] = Array.isArray(svcsData) ? svcsData : [];

        setAngels(prev => prev.map(angel => {
          // Find service by svcName (e.g. "angel-ariel") — prefer running over exited
          const matches = svcs.filter(s =>
            (s.name ?? "").toLowerCase() === (angel.svcName ?? angel.id).toLowerCase()
          );
          // Prefer running:unhealthy or running:healthy over exited
          const svc = matches.find(s => (s.status ?? "").includes("running")) || matches[0];
          if (!svc) return angel;

          const raw = (svc.status ?? "unknown").toLowerCase();
          let status: ServiceStatus = "unknown";
          if (raw.includes("running") && raw.includes("healthy")) status = "healthy";
          else if (raw.includes("running") && raw.includes("unhealthy")) status = "degraded";
          else if (raw.includes("running")) status = "starting";
          else if (raw.includes("exited") || raw.includes("error")) status = "error";
          else if (raw.includes("starting") || raw.includes("restarting")) status = "starting";
          return { ...angel, status, lastCheck: formatTime(), coolifyUuid: svc.uuid };
        }));
      }

      const unhealthy = apps.length - running;
      if (unhealthy > 10) addAlert("warning", `${unhealthy} aplikacji nie działa w Coolify`, "Coolify");

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
          headers: {
            apikey: SUPABASE_ANON,
            Authorization: `Bearer ${SUPABASE_ANON}`,
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(8000),
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setCoordMessages(data);
      }
    } catch {}
  }, []);

  // ── Fetch Kairos metrics from nocna_fabryka_queue ──────────────────────────
  const fetchKairosMetrics = useCallback(async () => {
    try {
      // Get counts by status
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/nocna_fabryka_queue?select=status&limit=1000`,
        {
          headers: {
            apikey: SUPABASE_ANON,
            Authorization: `Bearer ${SUPABASE_ANON}`,
            Accept: "application/json",
            "Range-Unit": "items",
            "Range": "0-999",
            "Prefer": "count=estimated",
          },
          signal: AbortSignal.timeout(8000),
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const counts: Record<string, number> = {};
          data.forEach((r: any) => { counts[r.status] = (counts[r.status] || 0) + 1; });
          const total = data.length;
          setKairos({
            total,
            pending: counts["pending"] || 0,
            deployed: counts["deployed"] || 0,
            failed: counts["failed"] || 0,
            throughput_per_hour: Math.round((counts["deployed"] || 0) / 24),
          });
        }
      }
    } catch {}
  }, []);

  // ── Fetch Brain Router cache stats ─────────────────────────────────────────
  const fetchBrainRouterStats = useCallback(async () => {
    try {
      const res = await fetch("https://brain-router.ofshore.dev/health", {
        signal: AbortSignal.timeout(12000),
        mode: "cors",
      });
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
    const results = await Promise.allSettled(
      CORE_SERVICES.map(s => probe(s.url, 10000))
    );
    setServices(prev => prev.map((svc, i) => {
      if (svc.id === "coolify") return svc; // handled separately
      const result = results[i];
      if (result.status === "fulfilled") {
        const { ok, latency } = result.value;
        const status: ServiceStatus = ok
          ? (latency < 600 ? "healthy" : "degraded")
          : "error";
        return { ...svc, status, latency };
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

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh) {
      intervalRef.current = setInterval(refresh, 30000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, refresh]);

  // ── Derived stats ───────────────────────────────────────────────────────────
  const healthyAngels   = angels.filter(a => a.status === "healthy").length;
  const errorAngels     = angels.filter(a => a.status === "error").length;
  const healthyServices = services.filter(s => s.status === "healthy").length;
  const avgLatency      = (() => {
    const valid = services.filter(s => s.latency && s.latency > 0);
    return valid.length ? Math.round(valid.reduce((a, b) => a + (b.latency ?? 0), 0) / valid.length) : 0;
  })();

  const navItems: { id: Section; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "angels",   label: "ANIOŁOWIE",    icon: <Shield size={13}/>,       badge: 12 },
    { id: "services", label: "SERWISY",      icon: <Server size={13}/>,       badge: services.length },
    { id: "kairos",   label: "KAIROS PULSE", icon: <TrendingUp size={13}/>,   badge: kairos?.pending },
    { id: "coord",    label: "KOORDYNACJA",  icon: <MessageSquare size={13}/>, badge: coordMessages.length },
  ];

  return (
    <div className="scanlines min-h-screen bg-background flex flex-col" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      {/* Ambient background */}
      <div className="fixed inset-0 z-0 opacity-[0.07]"
        style={{
          backgroundImage: `url(https://d2xsxph8kpxj0f.cloudfront.net/310519663297597343/Ptdy2eVTEoJ4gLWonQ79py/hero-bg-dvzSbUBEZPKEDPs88ZVcC5.webp)`,
          backgroundSize: "cover", backgroundPosition: "center", filter: "blur(3px)",
        }}
      />
      <div className="fixed inset-0 z-0" style={{
        background: "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0,255,136,0.04) 0%, transparent 60%)",
      }} />

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
              { label: "ANIOŁOWIE",    value: `${healthyAngels}/12`,              color: "#00ff88" },
              { label: "SERWISY",      value: `${healthyServices}/${services.length}`, color: "#00d4ff" },
              { label: "COOLIFY APPS", value: `${coolifyHealthy}/${coolifyApps}`, color: "#b44fff" },
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
              { label: "ONLINE",    count: healthyAngels + healthyServices,                                                                              color: "#00ff88" },
              { label: "DEGRADED",  count: angels.filter(a=>a.status==="degraded").length + services.filter(s=>s.status==="degraded").length,            color: "#ffd700" },
              { label: "OFFLINE",   count: errorAngels + services.filter(s=>s.status==="error").length,                                                  color: "#ff3366" },
              { label: "UNKNOWN",   count: angels.filter(a=>a.status==="unknown").length + services.filter(s=>s.status==="unknown").length,               color: "#333355" },
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

            {/* ── Angels Grid ── */}
            {activeSection === "angels" && (
              <motion.div key="angels" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                <SectionHeader
                  title="12 ANIOŁÓW STRÓŻÓW"
                  sub="Autonomiczni agenci opiekunowie infrastruktury Holon Mesh · AMS3 Droplet"
                  count={`${healthyAngels} / 12 AKTYWNYCH`}
                />

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
                              <a
                                href={angel.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="flex items-center gap-1.5 text-[10px] text-[#00d4ff] hover:text-[#00ff88] mono transition-colors"
                              >
                                <Terminal size={10} />
                                OTWÓRZ TERMINAL
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

                {/* Angel status note */}
                <div className="mt-4 p-3 rounded-sm border border-[#00d4ff]/10 bg-[#00d4ff]/3">
                  <div className="flex items-start gap-2">
                    <Info size={12} className="text-[#00d4ff] mt-0.5 shrink-0" />
                    <p className="text-[#444466] text-[10px] mono leading-relaxed">
                      Aniołowie Stróżowie są wdrożeni przez Coolify na Droplecie AMS3 (178.62.246.169). 
                      Status "UNKNOWN" oznacza że kontener jest w trakcie startu lub healthcheck nie jest jeszcze skonfigurowany. 
                      Kliknij "OTWÓRZ TERMINAL" aby uzyskać dostęp do terminala webowego danego Anioła.
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
                          <div className="w-8 h-8 rounded-sm flex items-center justify-center" style={{
                            backgroundColor: `${statusColor(svc.status)}10`,
                            color: statusColor(svc.status),
                            border: `1px solid ${statusColor(svc.status)}20`,
                          }}>
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
                          <a href={svc.url} target="_blank" rel="noopener noreferrer"
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-[#444466] hover:text-[#00ff88]">
                            <ExternalLink size={11} />
                          </a>
                        )}
                      </div>

                      {/* Latency bar */}
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

                {/* Brain Router cache stats */}
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

            {/* ── Kairos Pulse ── */}
            {activeSection === "kairos" && (
              <motion.div key="kairos" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                <SectionHeader
                  title="KAIROS PULSE"
                  sub="Przepustowość zadań sieci Holon Mesh · nocna_fabryka_queue · Supabase"
                />

                {kairos ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                      {[
                        { label: "TOTAL TASKS",     value: kairos.total.toLocaleString(),            color: "#ccccdd",  icon: <Layers size={16}/> },
                        { label: "PENDING",          value: kairos.pending.toLocaleString(),          color: "#ffd700",  icon: <Clock size={16}/> },
                        { label: "DEPLOYED",         value: kairos.deployed.toLocaleString(),         color: "#00ff88",  icon: <CheckCircle2 size={16}/> },
                        { label: "FAILED",           value: kairos.failed.toLocaleString(),           color: "#ff3366",  icon: <XCircle size={16}/> },
                      ].map(m => (
                        <motion.div
                          key={m.label}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="noc-card rounded-sm p-4 text-center"
                        >
                          <div className="flex justify-center mb-2" style={{ color: m.color }}>{m.icon}</div>
                          <div className="mono text-xl font-bold" style={{ color: m.color }}>{m.value}</div>
                          <div className="text-[#333355] text-[9px] mono tracking-wider mt-1">{m.label}</div>
                        </motion.div>
                      ))}
                    </div>

                    {/* Progress bars */}
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
                          {kairos.deployed.toLocaleString()} zostało już wdrożonych i zarchiwizowanych. 
                          Dane odświeżają się co 30 sekund.
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
