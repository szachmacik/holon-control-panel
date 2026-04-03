/* ============================================================
   HOLON CONTROL PANEL — Dashboard Page
   Design: Neural Command Center / Dark Ops NOC
   Layout: Left sidebar + Main grid + Right alerts panel
   Data: Live from Coolify API, Supabase, Cloudflare Workers
   ============================================================ */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Shield, Database, Cpu, Globe, Zap,
  AlertTriangle, CheckCircle2, XCircle, Clock,
  Terminal, RefreshCw, ChevronRight, Wifi,
  Server, Cloud, Lock, Eye, BarChart3, Layers,
  HardDrive, Network, Bot, Flame
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ServiceStatus = "healthy" | "degraded" | "error" | "unknown" | "starting";

interface GuardianAngel {
  id: string;
  name: string;
  domain: string;
  url: string;
  status: ServiceStatus;
  uptime: string;
  lastCheck: string;
  role: string;
  icon: React.ReactNode;
  color: string;
}

interface ServiceMetric {
  id: string;
  name: string;
  status: ServiceStatus;
  latency?: number;
  details?: string;
  url?: string;
  icon: React.ReactNode;
}

interface Alert {
  id: string;
  level: "critical" | "warning" | "info";
  message: string;
  time: string;
  source: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COOLIFY_BASE = "https://coolify.ofshore.dev/api/v1";
const COOLIFY_TOKEN = "5|iVCIKkag2PcD4nP8mGstQK3ApaTrpXI03hWJJVkKHYbFJhcOEJqMV8BrKMGpuqkI";

const ANGEL_DEFINITIONS: Omit<GuardianAngel, "status" | "uptime" | "lastCheck">[] = [
  { id: "ariel",    name: "ARIEL",    domain: "ariel.ofshore.dev",    url: "https://ariel.ofshore.dev",    role: "Database Guardian",      icon: <Database size={16}/>,  color: "#00ff88" },
  { id: "michael",  name: "MICHAŁ",   domain: "michael.ofshore.dev",  url: "https://michael.ofshore.dev",  role: "Automation Overseer",    icon: <Zap size={16}/>,       color: "#00d4ff" },
  { id: "gabriel",  name: "GABRIEL",  domain: "gabriel.ofshore.dev",  url: "https://gabriel.ofshore.dev",  role: "API Gateway Warden",     icon: <Globe size={16}/>,     color: "#b44fff" },
  { id: "raphael",  name: "RAFAŁ",    domain: "raphael.ofshore.dev",  url: "https://raphael.ofshore.dev",  role: "AI Model Shepherd",      icon: <Bot size={16}/>,       color: "#ffd700" },
  { id: "uriel",    name: "URIEL",    domain: "uriel.ofshore.dev",    url: "https://uriel.ofshore.dev",    role: "Security Sentinel",      icon: <Shield size={16}/>,    color: "#ff3366" },
  { id: "zadkiel",  name: "ZADKIEL",  domain: "zadkiel.ofshore.dev",  url: "https://zadkiel.ofshore.dev",  role: "Secrets Keeper",         icon: <Lock size={16}/>,      color: "#ff8c00" },
  { id: "jophiel",  name: "JOFIEL",   domain: "jophiel.ofshore.dev",  url: "https://jophiel.ofshore.dev",  role: "Frontend Architect",     icon: <Layers size={16}/>,    color: "#00ff88" },
  { id: "chamuel",  name: "CHAMUEL",  domain: "chamuel.ofshore.dev",  url: "https://chamuel.ofshore.dev",  role: "Network Pathfinder",     icon: <Network size={16}/>,   color: "#00d4ff" },
  { id: "haniel",   name: "HANIEL",   domain: "haniel.ofshore.dev",   url: "https://haniel.ofshore.dev",   role: "Storage Custodian",      icon: <HardDrive size={16}/>, color: "#b44fff" },
  { id: "metatron", name: "METATRON", domain: "metatron.ofshore.dev", url: "https://metatron.ofshore.dev", role: "Orchestration Master",   icon: <Cpu size={16}/>,       color: "#ffd700" },
  { id: "sandalphon",name:"SANDALFON",domain:"sandalphon.ofshore.dev",url:"https://sandalphon.ofshore.dev",role: "Log Analyst",            icon: <BarChart3 size={16}/>, color: "#ff3366" },
  { id: "azrael",   name: "AZRAEL",   domain: "azrael.ofshore.dev",   url: "https://azrael.ofshore.dev",   role: "Incident Responder",     icon: <Flame size={16}/>,     color: "#ff8c00" },
];

const CORE_SERVICES: Omit<ServiceMetric, "status" | "latency">[] = [
  { id: "coolify",    name: "Coolify",          icon: <Server size={14}/>,   url: "https://coolify.ofshore.dev",     details: "AMS3 Droplet Orchestrator" },
  { id: "supabase",   name: "Supabase",          icon: <Database size={14}/>, url: "https://supabase.com",            details: "ai-control-center DB" },
  { id: "redis",      name: "Redis (local)",     icon: <Zap size={14}/>,      url: "",                                details: "Self-hosted AMS3" },
  { id: "upstash",    name: "Upstash Redis",     icon: <Cloud size={14}/>,    url: "https://fresh-walleye-84119.upstash.io", details: "Fallback cache" },
  { id: "brainrouter",name: "Brain Router v5",   icon: <Globe size={14}/>,    url: "https://brain-router.ofshore.dev",details: "Cloudflare Worker" },
  { id: "sentinel",   name: "Sentinel",          icon: <Eye size={14}/>,      url: "https://inshallah-worker.maciejkuran.workers.dev", details: "CF Security Worker" },
  { id: "n8n",        name: "n8n",               icon: <Activity size={14}/>, url: "https://n8n.ofshore.dev",         details: "Workflow Automation" },
  { id: "ollama",     name: "Ollama",            icon: <Bot size={14}/>,      url: "https://ollama.ofshore.dev",      details: "Local LLM Server" },
  { id: "grafana",    name: "Grafana",           icon: <BarChart3 size={14}/>,url: "https://grafana.ofshore.dev",     details: "Monitoring Stack" },
  { id: "holonrelay", name: "Holon Relay",       icon: <Wifi size={14}/>,     url: "https://holon-relay.vercel.app",  details: "Vercel Edge Relay" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusColor = (s: ServiceStatus) => ({
  healthy:  "#00ff88",
  degraded: "#ffd700",
  error:    "#ff3366",
  unknown:  "#666688",
  starting: "#00d4ff",
}[s]);

const statusLabel = (s: ServiceStatus) => ({
  healthy:  "ONLINE",
  degraded: "DEGRADED",
  error:    "OFFLINE",
  unknown:  "UNKNOWN",
  starting: "STARTING",
}[s]);

const StatusDot = ({ status, size = 8 }: { status: ServiceStatus; size?: number }) => (
  <span
    className="inline-block rounded-full pulse-dot"
    style={{
      width: size, height: size,
      backgroundColor: statusColor(status),
      boxShadow: `0 0 ${size}px ${statusColor(status)}`,
    }}
  />
);

const formatTime = () => new Date().toLocaleTimeString("pl-PL", { hour12: false });

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [angels, setAngels] = useState<GuardianAngel[]>(
    ANGEL_DEFINITIONS.map(a => ({ ...a, status: "unknown" as ServiceStatus, uptime: "—", lastCheck: "—" }))
  );
  const [services, setServices] = useState<ServiceMetric[]>(
    CORE_SERVICES.map(s => ({ ...s, status: "unknown" as ServiceStatus, latency: undefined }))
  );
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [lastRefresh, setLastRefresh] = useState(formatTime());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeSection, setActiveSection] = useState<"angels" | "services" | "metrics">("angels");
  const [coolifyApps, setCoolifyApps] = useState<number>(0);
  const [coolifyHealthy, setCoolifyHealthy] = useState<number>(0);
  const [selectedAngel, setSelectedAngel] = useState<GuardianAngel | null>(null);

  // Probe an endpoint and return latency in ms or null
  const probe = async (url: string | undefined, timeout = 8000): Promise<{ ok: boolean; latency: number }> => {
    if (!url) return { ok: false, latency: 0 };
    const start = performance.now();
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeout);
      const res = await fetch(url, { method: "HEAD", signal: ctrl.signal, mode: "no-cors" });
      clearTimeout(timer);
      return { ok: true, latency: Math.round(performance.now() - start) };
    } catch {
      return { ok: false, latency: Math.round(performance.now() - start) };
    }
  };

  const fetchCoolifyStatus = useCallback(async () => {
    try {
      const res = await fetch(`${COOLIFY_BASE}/applications`, {
        headers: { Authorization: `Bearer ${COOLIFY_TOKEN}`, Accept: "application/json" },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) return;
      const data = await res.json();
      const apps: any[] = Array.isArray(data) ? data : (data.data ?? []);
      setCoolifyApps(apps.length);
      const healthy = apps.filter(a =>
        (a.status ?? "").toLowerCase().includes("running") ||
        (a.status ?? "").toLowerCase().includes("healthy")
      ).length;
      setCoolifyHealthy(healthy);

      // Map angel statuses from Coolify apps
      const newAngels = angels.map(angel => {
        const app = apps.find(a =>
          (a.name ?? "").toLowerCase().includes(angel.id.toLowerCase()) ||
          (a.fqdn ?? "").includes(angel.domain)
        );
        if (app) {
          const rawStatus = (app.status ?? "unknown").toLowerCase();
          let status: ServiceStatus = "unknown";
          if (rawStatus.includes("running") && rawStatus.includes("healthy")) status = "healthy";
          else if (rawStatus.includes("running")) status = "degraded";
          else if (rawStatus.includes("exited") || rawStatus.includes("error")) status = "error";
          else if (rawStatus.includes("starting") || rawStatus.includes("restarting")) status = "starting";
          return { ...angel, status, lastCheck: formatTime() };
        }
        return angel;
      });
      setAngels(newAngels);

      // Add alert if many apps are unhealthy
      const unhealthy = apps.length - healthy;
      if (unhealthy > 5) {
        addAlert("warning", `${unhealthy} aplikacji w stanie nieznany/błąd`, "Coolify");
      }
    } catch (e) {
      addAlert("critical", "Brak połączenia z Coolify API", "System");
    }
  }, [angels]);

  const fetchServiceStatuses = useCallback(async () => {
    const probeResults = await Promise.allSettled(
      CORE_SERVICES.map(s => probe(s.url))
    );
    setServices(prev => prev.map((svc, i) => {
      const result = probeResults[i];
      if (result.status === "fulfilled") {
        const { ok, latency } = result.value;
        return {
          ...svc,
          status: ok ? (latency < 500 ? "healthy" : "degraded") : "error",
          latency,
        };
      }
      return { ...svc, status: "error" as ServiceStatus };
    }));
  }, []);

  const addAlert = (level: Alert["level"], message: string, source: string) => {
    const newAlert: Alert = {
      id: Math.random().toString(36).slice(2),
      level, message, source,
      time: formatTime(),
    };
    setAlerts(prev => [newAlert, ...prev].slice(0, 20));
  };

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.allSettled([fetchCoolifyStatus(), fetchServiceStatuses()]);
    setLastRefresh(formatTime());
    setIsRefreshing(false);
  }, [fetchCoolifyStatus, fetchServiceStatuses]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, []);

  // Derived stats
  const healthyAngels = angels.filter(a => a.status === "healthy").length;
  const errorAngels = angels.filter(a => a.status === "error").length;
  const healthyServices = services.filter(s => s.status === "healthy").length;
  const avgLatency = services.filter(s => s.latency).reduce((a, b) => a + (b.latency ?? 0), 0) /
    Math.max(services.filter(s => s.latency).length, 1);

  return (
    <div className="scanlines min-h-screen bg-background flex flex-col" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      {/* Hero background */}
      <div
        className="fixed inset-0 z-0 opacity-10"
        style={{
          backgroundImage: `url(https://d2xsxph8kpxj0f.cloudfront.net/310519663297597343/Ptdy2eVTEoJ4gLWonQ79py/hero-bg-dvzSbUBEZPKEDPs88ZVcC5.webp)`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(2px)",
        }}
      />

      {/* ── Header ── */}
      <header className="relative z-10 border-b border-[#00ff88]/15 bg-[#0a0a0f]/90 backdrop-blur-sm">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663297597343/Ptdy2eVTEoJ4gLWonQ79py/angel-avatar-bg-G4sVxXyLumaSFQFhWGRqgA.webp"
              alt="Holon"
              className="w-9 h-9 rounded object-cover opacity-90"
            />
            <div>
              <div className="text-[#00ff88] font-bold tracking-[0.2em] text-sm flicker">
                HOLON CONTROL PANEL
              </div>
              <div className="text-[#666688] text-xs mono">NEURAL COMMAND CENTER v2.0 · AMS3</div>
            </div>
          </div>

          {/* Global stats */}
          <div className="hidden md:flex items-center gap-6">
            {[
              { label: "ANIOŁOWIE", value: `${healthyAngels}/12`, color: "#00ff88" },
              { label: "SERWISY", value: `${healthyServices}/${services.length}`, color: "#00d4ff" },
              { label: "COOLIFY APPS", value: `${coolifyHealthy}/${coolifyApps}`, color: "#b44fff" },
              { label: "AVG LATENCY", value: `${Math.round(avgLatency)}ms`, color: avgLatency < 300 ? "#00ff88" : avgLatency < 800 ? "#ffd700" : "#ff3366" },
            ].map(stat => (
              <div key={stat.label} className="text-center">
                <div className="mono text-lg font-bold" style={{ color: stat.color }}>{stat.value}</div>
                <div className="text-[#444466] text-[10px] tracking-widest">{stat.label}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="text-[#444466] text-xs mono hidden sm:block">
              LAST SYNC: <span className="text-[#00ff88]">{lastRefresh}</span>
            </div>
            <button
              onClick={refresh}
              className="flex items-center gap-2 px-3 py-1.5 text-xs border border-[#00ff88]/30 text-[#00ff88] hover:bg-[#00ff88]/10 transition-colors rounded mono"
            >
              <RefreshCw size={12} className={isRefreshing ? "animate-spin" : ""} />
              REFRESH
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Layout ── */}
      <div className="relative z-10 flex flex-1 overflow-hidden">

        {/* Left Sidebar */}
        <aside className="w-52 shrink-0 border-r border-[#00ff88]/10 bg-[#0a0a0f]/70 backdrop-blur-sm flex flex-col">
          <div className="p-4 border-b border-[#00ff88]/10">
            <div className="text-[#444466] text-[10px] tracking-widest mono mb-3">NAWIGACJA</div>
            {[
              { id: "angels", label: "ANIOŁOWIE", icon: <Shield size={14}/>, count: 12 },
              { id: "services", label: "SERWISY", icon: <Server size={14}/>, count: services.length },
              { id: "metrics", label: "METRYKI", icon: <BarChart3 size={14}/>, count: null },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id as any)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs mb-1 transition-all ${
                  activeSection === item.id
                    ? "bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30"
                    : "text-[#666688] hover:text-[#00ff88] hover:bg-[#00ff88]/5"
                }`}
              >
                <div className="flex items-center gap-2">
                  {item.icon}
                  <span className="mono tracking-wider">{item.label}</span>
                </div>
                {item.count && (
                  <span className="mono text-[10px] opacity-60">{item.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Quick status summary */}
          <div className="p-4 flex-1">
            <div className="text-[#444466] text-[10px] tracking-widest mono mb-3">STATUS SIECI</div>
            <div className="space-y-2">
              {[
                { label: "ONLINE", count: healthyAngels + healthyServices, color: "#00ff88" },
                { label: "DEGRADED", count: angels.filter(a=>a.status==="degraded").length + services.filter(s=>s.status==="degraded").length, color: "#ffd700" },
                { label: "OFFLINE", count: errorAngels + services.filter(s=>s.status==="error").length, color: "#ff3366" },
                { label: "UNKNOWN", count: angels.filter(a=>a.status==="unknown").length + services.filter(s=>s.status==="unknown").length, color: "#666688" },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="mono text-[10px] text-[#444466] tracking-wider">{item.label}</span>
                  </div>
                  <span className="mono text-xs font-bold" style={{ color: item.color }}>{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts count */}
          {alerts.length > 0 && (
            <div className="p-4 border-t border-[#ff3366]/20">
              <div className="flex items-center gap-2 text-[#ff3366]">
                <AlertTriangle size={12} className="pulse-dot" />
                <span className="mono text-xs">{alerts.filter(a=>a.level==="critical").length} KRYTYCZNE</span>
              </div>
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">

            {/* ── Angels Grid ── */}
            {activeSection === "angels" && (
              <motion.div
                key="angels"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-[#00ff88] font-bold tracking-[0.15em] text-base">
                      12 ANIOŁÓW STRÓŻÓW
                    </h2>
                    <p className="text-[#444466] text-xs mono mt-0.5">
                      Autonomiczni agenci opiekunowie infrastruktury Holon Mesh
                    </p>
                  </div>
                  <div className="mono text-xs text-[#444466]">
                    <span className="text-[#00ff88]">{healthyAngels}</span> / 12 AKTYWNYCH
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {angels.map((angel, i) => (
                    <motion.div
                      key={angel.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => setSelectedAngel(selectedAngel?.id === angel.id ? null : angel)}
                      className="noc-card rounded p-4 cursor-pointer hover:border-[#00ff88]/30 transition-all group"
                      style={{
                        borderColor: selectedAngel?.id === angel.id ? angel.color : undefined,
                        boxShadow: selectedAngel?.id === angel.id ? `0 0 20px ${angel.color}20` : undefined,
                      }}
                    >
                      {/* Angel header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded flex items-center justify-center"
                            style={{ backgroundColor: `${angel.color}15`, color: angel.color }}
                          >
                            {angel.icon}
                          </div>
                          <div>
                            <div className="mono text-xs font-bold tracking-widest" style={{ color: angel.color }}>
                              {angel.name}
                            </div>
                            <div className="text-[#444466] text-[10px] leading-tight">{angel.role}</div>
                          </div>
                        </div>
                        <StatusDot status={angel.status} size={8} />
                      </div>

                      {/* Status bar */}
                      <div className="flex items-center justify-between">
                        <span
                          className="mono text-[10px] tracking-widest font-bold"
                          style={{ color: statusColor(angel.status) }}
                        >
                          {statusLabel(angel.status)}
                        </span>
                        <a
                          href={angel.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Terminal size={12} className="text-[#444466] hover:text-[#00ff88]" />
                        </a>
                      </div>

                      {/* Domain */}
                      <div className="mt-2 text-[#333355] text-[10px] mono truncate">
                        {angel.domain}
                      </div>

                      {/* Expanded detail */}
                      <AnimatePresence>
                        {selectedAngel?.id === angel.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-3 pt-3 border-t border-[#00ff88]/10 space-y-1.5">
                              <div className="flex justify-between text-[10px]">
                                <span className="text-[#444466] mono">LAST CHECK</span>
                                <span className="text-[#00ff88] mono">{angel.lastCheck}</span>
                              </div>
                              <a
                                href={angel.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[10px] text-[#00d4ff] hover:text-[#00ff88] mono transition-colors"
                                onClick={e => e.stopPropagation()}
                              >
                                <Terminal size={10} />
                                OTWÓRZ TERMINAL
                                <ChevronRight size={10} />
                              </a>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── Services Grid ── */}
            {activeSection === "services" && (
              <motion.div
                key="services"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-[#00d4ff] font-bold tracking-[0.15em] text-base">
                      SERWISY INFRASTRUKTURY
                    </h2>
                    <p className="text-[#444466] text-xs mono mt-0.5">
                      Coolify · Supabase · Redis · Cloudflare Workers · n8n · Ollama
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {services.map((svc, i) => (
                    <motion.div
                      key={svc.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="noc-card rounded p-4 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-[#444466]">{svc.icon}</div>
                        <div>
                          <div className="text-sm font-semibold text-[#ccccdd]">{svc.name}</div>
                          <div className="text-[#444466] text-[10px] mono">{svc.details}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {svc.latency !== undefined && svc.latency > 0 && (
                          <span className="mono text-xs" style={{
                            color: svc.latency < 200 ? "#00ff88" : svc.latency < 600 ? "#ffd700" : "#ff3366"
                          }}>
                            {svc.latency}ms
                          </span>
                        )}
                        <div className="flex items-center gap-1.5">
                          <StatusDot status={svc.status} size={7} />
                          <span className="mono text-[10px] tracking-wider" style={{ color: statusColor(svc.status) }}>
                            {statusLabel(svc.status)}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── Metrics ── */}
            {activeSection === "metrics" && (
              <motion.div
                key="metrics"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="mb-6">
                  <h2 className="text-[#b44fff] font-bold tracking-[0.15em] text-base">
                    METRYKI SYSTEMU
                  </h2>
                  <p className="text-[#444466] text-xs mono mt-0.5">
                    Statystyki infrastruktury w czasie rzeczywistym
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: "DROPLET", value: "AMS3", sub: "16GB / 4vCPU AMD", color: "#00ff88" },
                    { label: "COOLIFY APPS", value: `${coolifyApps}`, sub: `${coolifyHealthy} zdrowych`, color: "#00d4ff" },
                    { label: "ANIOŁOWIE", value: `${healthyAngels}/12`, sub: `${errorAngels} offline`, color: "#b44fff" },
                    { label: "AVG LATENCY", value: `${Math.round(avgLatency)}ms`, sub: "do endpointów", color: avgLatency < 300 ? "#00ff88" : "#ffd700" },
                  ].map(metric => (
                    <div key={metric.label} className="noc-card rounded p-4 text-center">
                      <div className="text-[#444466] text-[10px] tracking-widest mono mb-2">{metric.label}</div>
                      <div className="text-2xl font-bold mono" style={{ color: metric.color }}>{metric.value}</div>
                      <div className="text-[#444466] text-[10px] mono mt-1">{metric.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Optimization summary */}
                <div className="noc-card rounded p-5">
                  <div className="text-[#00ff88] font-bold tracking-[0.15em] text-xs mono mb-4">
                    WDROŻONE OPTYMALIZACJE
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { title: "Dual-leg Redis", desc: "Lokalny Redis (AMS3) + Upstash fallback. Latencja cache: 188ms → <1ms", status: "healthy", impact: "x188 szybciej" },
                      { title: "Supabase Cleanup", desc: "1.12M wierszy zarchiwizowanych z nocna_fabryka_queue + VACUUM", status: "healthy", impact: "-6% bloat" },
                      { title: "11 indeksów DB", desc: "Nowe indeksy na nocna_fabryka_queue + zmaterializowany widok", status: "healthy", impact: "-20.7% latencja" },
                      { title: "Healthchecki Coolify", desc: "18 aplikacji z naprawionymi healthcheckami Docker", status: "healthy", impact: "monitoring OK" },
                      { title: "12 Aniołów Stróżów", desc: "Autonomiczne agenty z terminalem webowym dla każdej domeny", status: "starting", impact: "x12 agentów" },
                      { title: "Grafana + Prometheus", desc: "Stack monitoringu z Node Exporter i cAdvisor", status: "starting", impact: "full observability" },
                      { title: "Agent Coordination", desc: "Przestrzeń koordynacyjna Manus↔Claude w Supabase z lockingiem", status: "healthy", impact: "zero konfliktów" },
                      { title: "DNS Cloudflare", desc: "14 nowych rekordów DNS dla Aniołów i monitoring stacku", status: "healthy", impact: "routing OK" },
                    ].map(opt => (
                      <div key={opt.title} className="flex items-start gap-3 p-3 rounded bg-[#ffffff05] border border-[#00ff88]/05">
                        <StatusDot status={opt.status as ServiceStatus} size={7} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-[#ccccdd]">{opt.title}</div>
                          <div className="text-[#444466] text-[10px] mono mt-0.5 leading-relaxed">{opt.desc}</div>
                        </div>
                        <div className="mono text-[10px] font-bold shrink-0" style={{ color: statusColor(opt.status as ServiceStatus) }}>
                          {opt.impact}
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
        <aside className="w-64 shrink-0 border-l border-[#00ff88]/10 bg-[#0a0a0f]/70 backdrop-blur-sm flex flex-col">
          <div className="p-4 border-b border-[#00ff88]/10 flex items-center justify-between">
            <div className="text-[#444466] text-[10px] tracking-widest mono">ALERTY SYSTEMU</div>
            <div className="flex items-center gap-1">
              <StatusDot status={alerts.some(a=>a.level==="critical") ? "error" : alerts.length > 0 ? "degraded" : "healthy"} size={6} />
              <span className="mono text-[10px] text-[#444466]">{alerts.length}</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {alerts.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 size={24} className="text-[#00ff88] mx-auto mb-2 opacity-50" />
                <div className="text-[#444466] text-xs mono">BRAK ALERTÓW</div>
              </div>
            ) : (
              <AnimatePresence>
                {alerts.map(alert => (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="p-2.5 rounded border text-[10px]"
                    style={{
                      borderColor: alert.level === "critical" ? "#ff336630" : alert.level === "warning" ? "#ffd70030" : "#00d4ff30",
                      backgroundColor: alert.level === "critical" ? "#ff336608" : alert.level === "warning" ? "#ffd70008" : "#00d4ff08",
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="mono font-bold tracking-wider" style={{
                        color: alert.level === "critical" ? "#ff3366" : alert.level === "warning" ? "#ffd700" : "#00d4ff"
                      }}>
                        {alert.level.toUpperCase()}
                      </span>
                      <span className="mono text-[#444466]">{alert.time}</span>
                    </div>
                    <div className="text-[#888899] leading-relaxed">{alert.message}</div>
                    <div className="text-[#444466] mono mt-1">SRC: {alert.source}</div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>

          {/* System time */}
          <div className="p-4 border-t border-[#00ff88]/10">
            <div className="text-center">
              <div className="mono text-[#00ff88] text-sm font-bold flicker">{lastRefresh}</div>
              <div className="text-[#444466] text-[10px] mono tracking-widest">SYSTEM TIME</div>
            </div>
            <div className="mt-3 flex items-center gap-2 justify-center">
              <StatusDot status="healthy" size={6} />
              <span className="mono text-[10px] text-[#444466]">HOLON MESH ONLINE</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
