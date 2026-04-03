/**
 * KAIR.OS Panel — Dashboard component
 * Design: Dark terminal aesthetic, amber/gold accents, biblical milestone badges
 * Shows all scheduled tasks with health, pattern, milestones and adaptive intervals
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface KairosTask {
  name: string;
  url: string;
  active: boolean;
  health: number;
  pattern: string;
  lastResult: string;
  intervalS: number;
  successes: number;
  failures: number;
  totalRuns: number;
  milestones: {
    promisedLand: boolean;
    pentecost: boolean;
    abundance: boolean;
    sabbath: boolean;
    jubileeCount: number;
  };
  nextRunIn: number | null;
}

interface KairosInfo {
  system: string;
  version: string;
  runtime: string;
  dependencies: string;
  stats: {
    totalTasks: number;
    activeTasks: number;
    totalRuns: number;
    totalSuccesses: number;
    totalFailures: number;
    promisedLandCount: number;
    abundanceCount: number;
  };
}

interface KairosPanelProps {
  meshUrl: string;
}

const PATTERN_COLORS: Record<string, string> = {
  learning:  'text-blue-400',
  stable:    'text-emerald-400',
  improving: 'text-cyan-400',
  degrading: 'text-red-400',
};

const PATTERN_ICONS: Record<string, string> = {
  learning:  '◎',
  stable:    '◉',
  improving: '▲',
  degrading: '▼',
};

function HealthBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct > 80 ? '#10b981' : pct > 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-mono" style={{ color }}>{pct}%</span>
    </div>
  );
}

function MilestoneBadge({ label, active, icon }: { label: string; active: boolean; icon: string }) {
  if (!active) return null;
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold"
      style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
      {icon} {label}
    </span>
  );
}

function CountdownTimer({ ms }: { ms: number | null }) {
  const [remaining, setRemaining] = useState(ms);
  useEffect(() => {
    if (ms === null) return;
    setRemaining(ms);
    const interval = setInterval(() => setRemaining(r => Math.max(0, (r ?? 0) - 1000)), 1000);
    return () => clearInterval(interval);
  }, [ms]);
  if (remaining === null) return <span className="text-white/30">—</span>;
  const s = Math.round(remaining / 1000);
  return <span className="font-mono text-xs text-white/50">{s}s</span>;
}

export function KairosPanel({ meshUrl }: KairosPanelProps) {
  const [tasks, setTasks] = useState<KairosTask[]>([]);
  const [info, setInfo] = useState<KairosInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'degrading'>('all');
  const [liveEvents, setLiveEvents] = useState<Array<{ name: string; ok: boolean; ms: number; t: number }>>([]);

  const fetchData = useCallback(async () => {
    try {
      const [tasksRes, infoRes] = await Promise.all([
        fetch(`${meshUrl}/kairos/tasks`),
        fetch(`${meshUrl}/kairos`),
      ]);
      if (tasksRes.ok) setTasks(await tasksRes.json());
      if (infoRes.ok) setInfo(await infoRes.json());
      setError(null);
    } catch (e) {
      setError('KAIR.OS unreachable — mesh.ofshore.dev offline');
    } finally {
      setLoading(false);
    }
  }, [meshUrl]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // WebSocket live events
  useEffect(() => {
    const wsUrl = meshUrl.replace('https://', 'wss://').replace('http://', 'ws://') + '/ws';
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'KAIROS_TICK') {
            setLiveEvents(prev => [
              { name: msg.name, ok: msg.ok, ms: msg.ms, t: Date.now() },
              ...prev.slice(0, 9),
            ]);
            // Update task health in real-time
            setTasks(prev => prev.map(t =>
              t.name === msg.name
                ? { ...t, health: msg.health, pattern: msg.pattern, lastResult: msg.lastResult, intervalS: msg.intervalS }
                : t
            ));
          }
        } catch {}
      };
    } catch {}
    return () => { try { ws?.close(); } catch {} };
  }, [meshUrl]);

  const filteredTasks = tasks.filter(t => {
    if (filter === 'active') return t.active;
    if (filter === 'degrading') return t.pattern === 'degrading';
    return true;
  });

  const stats = info?.stats;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            <span style={{ color: '#fbbf24' }}>KAIR.OS</span>
            <span className="text-white/40 text-sm font-normal ml-3">v2.0.0 · zero dependencies · native Node.js</span>
          </h2>
          <p className="text-white/40 text-sm mt-1">
            Adaptive scheduler z filozofią biblijną — alternatywa CRON bez żadnych zależności
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: error ? '#ef4444' : '#10b981' }} />
          <span className="text-xs text-white/40">{error ? 'offline' : 'live'}</span>
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Zadania', value: stats.totalTasks, sub: `${stats.activeTasks} aktywnych` },
            { label: 'Uruchomienia', value: stats.totalRuns.toLocaleString(), sub: `${stats.totalSuccesses} sukces` },
            { label: 'Promised Land', value: stats.promisedLandCount, sub: '40 sukcesów z rzędu' },
            { label: 'Abundance', value: stats.abundanceCount, sub: '153 sukcesy' },
          ].map(s => (
            <div key={s.label} className="rounded-lg p-3"
              style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.15)' }}>
              <div className="text-2xl font-bold font-mono" style={{ color: '#fbbf24' }}>{s.value}</div>
              <div className="text-xs text-white/60 mt-0.5">{s.label}</div>
              <div className="text-[10px] text-white/30 mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Biblical principles */}
      <div className="rounded-lg p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">Zasady Kairotyczne</div>
        <div className="grid grid-cols-4 gap-2">
          {[
            { n: '3', label: 'Trinity', desc: 'Rotacja 3 ścieżek' },
            { n: '7', label: 'Sabbath', desc: 'Odpoczynek co 7. cykl' },
            { n: '40', label: 'Desert', desc: 'Ziemia Obiecana' },
            { n: '50', label: 'Pentecost', desc: 'Interval / 2' },
            { n: '50', label: 'Jubilee', desc: 'Reset długów' },
            { n: '70×7', label: 'Forgiveness', desc: '490 tolerancja błędów' },
            { n: '153', label: 'Abundance', desc: 'Tryb Obfitości' },
            { n: '12', label: 'Apostles', desc: 'Max batch' },
          ].map(p => (
            <div key={p.label} className="text-center p-2 rounded" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div className="text-lg font-bold font-mono" style={{ color: '#fbbf24' }}>{p.n}</div>
              <div className="text-[10px] font-semibold text-white/60">{p.label}</div>
              <div className="text-[9px] text-white/30 mt-0.5">{p.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Live events feed */}
      {liveEvents.length > 0 && (
        <div className="rounded-lg p-3" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">Live Feed</div>
          <div className="space-y-1">
            <AnimatePresence>
              {liveEvents.slice(0, 5).map((ev, i) => (
                <motion.div key={`${ev.name}-${ev.t}`}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-3 text-xs font-mono">
                  <span style={{ color: ev.ok ? '#10b981' : '#ef4444' }}>{ev.ok ? '✓' : '✗'}</span>
                  <span className="text-white/60 w-32 truncate">{ev.name}</span>
                  <span className="text-white/30">{ev.ms}ms</span>
                  <span className="text-white/20">{new Date(ev.t).toLocaleTimeString()}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'active', 'degrading'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-3 py-1 rounded text-xs font-medium transition-all"
            style={{
              background: filter === f ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.05)',
              color: filter === f ? '#fbbf24' : 'rgba(255,255,255,0.4)',
              border: `1px solid ${filter === f ? 'rgba(251,191,36,0.3)' : 'transparent'}`,
            }}>
            {f === 'all' ? `Wszystkie (${tasks.length})` : f === 'active' ? `Aktywne (${tasks.filter(t => t.active).length})` : `Degrading (${tasks.filter(t => t.pattern === 'degrading').length})`}
          </button>
        ))}
      </div>

      {/* Tasks table */}
      {loading ? (
        <div className="text-center py-12 text-white/30">
          <div className="text-4xl mb-3 animate-spin">⏳</div>
          <div>Łączenie z KAIR.OS...</div>
        </div>
      ) : error ? (
        <div className="text-center py-12 rounded-lg" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <div className="text-4xl mb-3">⚠</div>
          <div className="text-red-400 text-sm">{error}</div>
          <div className="text-white/30 text-xs mt-2">KAIR.OS uruchamia się na mesh.ofshore.dev — deploy w toku</div>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-12 text-white/30">Brak zadań</div>
      ) : (
        <div className="space-y-2">
          {filteredTasks.map(task => (
            <motion.div key={task.name}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-lg p-4 transition-all hover:bg-white/[0.03]"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-start justify-between gap-4">
                {/* Left: name + milestones */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-semibold text-white/90 truncate">{task.name}</span>
                    <span className={`text-xs font-mono ${PATTERN_COLORS[task.pattern] || 'text-white/40'}`}>
                      {PATTERN_ICONS[task.pattern]} {task.pattern}
                    </span>
                    {!task.active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">STOPPED</span>}
                  </div>
                  <div className="text-[11px] text-white/30 mt-0.5 truncate">{task.url}</div>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <MilestoneBadge label="Promised Land" active={task.milestones.promisedLand} icon="🌟" />
                    <MilestoneBadge label="Pentecost" active={task.milestones.pentecost} icon="🔥" />
                    <MilestoneBadge label="Abundance" active={task.milestones.abundance} icon="🐟" />
                    <MilestoneBadge label="Sabbath" active={task.milestones.sabbath} icon="✦" />
                    {task.milestones.jubileeCount > 0 && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold"
                        style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)' }}>
                        🎺 Jubilee ×{task.milestones.jubileeCount}
                      </span>
                    )}
                  </div>
                </div>
                {/* Right: stats */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <HealthBar value={task.health} />
                  <div className="flex items-center gap-3 text-[11px] text-white/40">
                    <span className="font-mono">
                      <span className="text-emerald-400">{task.successes}</span>
                      <span className="text-white/20"> / </span>
                      <span className="text-red-400">{task.failures}</span>
                    </span>
                    <span>every <span className="text-white/60 font-mono">{task.intervalS}s</span></span>
                    <span>next: <CountdownTimer ms={task.nextRunIn} /></span>
                  </div>
                  <div className="text-[10px]" style={{ color: task.lastResult === 'ok' ? '#10b981' : task.lastResult === 'sabbath' ? '#fbbf24' : '#ef4444' }}>
                    {task.lastResult}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-[10px] text-white/20 pt-2">
        KAIR.OS · {info?.runtime || 'Node.js native'} · {info?.dependencies || 'ZERO dependencies'} · auto-refresh 15s
      </div>
    </div>
  );
}
