/**
 * NeuralMesh.tsx — Holon Neural Mesh Visualization
 * Design: NOC dark theme, D3 force-directed graph, animated signal pulses
 * Architecture: Tier-0 Archangels (gold) ↔ Tier-1 Angels (cyan) ↔ Mesh Router (purple)
 */

import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Radio, GitBranch, Activity, RotateCcw, Send } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────
export type NodeStatus = "healthy" | "degraded" | "offline" | "unknown";

export interface MeshNode {
  id: string;
  name: string;
  tier: 0 | 1 | 2; // 0=orchestrator, 1=archangel, 2=angel
  status: NodeStatus;
  domain: string;
  color: string;
  load?: number; // 0-100
  latency?: number; // ms
}

export interface MeshEdge {
  source: string;
  target: string;
  weight: number; // 0-1 bandwidth
  latency?: number;
  active: boolean;
}

export interface MeshSignal {
  id: string;
  sourceId: string;
  targetId: string;
  type: "HEARTBEAT" | "TASK" | "BROADCAST" | "QUERY" | "RESPONSE";
  progress: number; // 0-1 along edge
  color: string;
}

interface NeuralMeshProps {
  nodes: MeshNode[];
  edges: MeshEdge[];
  signals?: MeshSignal[];
  onNodeClick?: (node: MeshNode) => void;
  onSendSignal?: (sourceId: string, targetId: string, type: string) => void;
  width?: number;
  height?: number;
}

// ── Status colors ─────────────────────────────────────────────────────────────
const statusColor = (s: NodeStatus) => ({
  healthy: "#00ff88",
  degraded: "#ffd700",
  offline: "#ff3366",
  unknown: "#444466",
}[s]);

const signalColor = (t: MeshSignal["type"]) => ({
  HEARTBEAT: "#00d4ff",
  TASK: "#00ff88",
  BROADCAST: "#ffd700",
  QUERY: "#b44fff",
  RESPONSE: "#ff8c00",
}[t]);

// ── Main Component ────────────────────────────────────────────────────────────
export default function NeuralMesh({
  nodes,
  edges,
  signals = [],
  onNodeClick,
  width = 800,
  height = 500,
}: NeuralMeshProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simRef = useRef<d3.Simulation<any, any> | null>(null);
  const [hoveredNode, setHoveredNode] = useState<MeshNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<MeshNode | null>(null);
  const [activeSignals, setActiveSignals] = useState<MeshSignal[]>(signals);
  const [routingMode, setRoutingMode] = useState<"SHORTEST_PATH" | "BROADCAST" | "REDUNDANT">("SHORTEST_PATH");
  const [signalLog, setSignalLog] = useState<{ time: string; msg: string; color: string }[]>([]);
  const animFrameRef = useRef<number>(0);
  const signalProgressRef = useRef<Map<string, number>>(new Map());

  // ── Build D3 graph ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const defs = svg.append("defs");

    // Glow filters
    const glowColors = ["#00ff88", "#ffd700", "#00d4ff", "#b44fff", "#ff3366", "#ff8c00"];
    glowColors.forEach((color, i) => {
      const filter = defs.append("filter").attr("id", `glow-${i}`);
      filter.append("feGaussianBlur").attr("stdDeviation", "3").attr("result", "coloredBlur");
      const merge = filter.append("feMerge");
      merge.append("feMergeNode").attr("in", "coloredBlur");
      merge.append("feMergeNode").attr("in", "SourceGraphic");
    });

    // Arrow marker
    defs.append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 20)
      .attr("refY", 0)
      .attr("markerWidth", 4)
      .attr("markerHeight", 4)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#00d4ff30");

    // Build node map
    const nodeMap = new Map(nodes.map(n => [n.id, { ...n, x: 0, y: 0, vx: 0, vy: 0 }]));
    const simNodes = Array.from(nodeMap.values());
    const simEdges = edges
      .filter(e => nodeMap.has(e.source) && nodeMap.has(e.target))
      .map(e => ({ ...e, source: e.source, target: e.target }));

    // Position orchestrator in center, archangels in ring, angels in outer ring
    const cx = width / 2, cy = height / 2;
    simNodes.forEach(n => {
      if (n.tier === 0) { n.x = cx; n.y = cy; }
      else if (n.tier === 1) {
        const idx = simNodes.filter(x => x.tier === 1).indexOf(n);
        const total = simNodes.filter(x => x.tier === 1).length;
        const angle = (idx / total) * 2 * Math.PI - Math.PI / 2;
        n.x = cx + Math.cos(angle) * 130;
        n.y = cy + Math.sin(angle) * 110;
      } else {
        const idx = simNodes.filter(x => x.tier === 2).indexOf(n);
        const total = simNodes.filter(x => x.tier === 2).length;
        const angle = (idx / total) * 2 * Math.PI - Math.PI / 2;
        n.x = cx + Math.cos(angle) * 220;
        n.y = cy + Math.sin(angle) * 185;
      }
    });

    // Force simulation
    const sim = d3.forceSimulation(simNodes)
      .force("link", d3.forceLink(simEdges).id((d: any) => d.id).distance((e: any) => {
        const s = nodeMap.get(typeof e.source === "string" ? e.source : e.source.id);
        const t = nodeMap.get(typeof e.target === "string" ? e.target : e.target.id);
        if (!s || !t) return 120;
        if (s.tier === 0 || t.tier === 0) return 130;
        if (s.tier === 1 || t.tier === 1) return 100;
        return 80;
      }).strength(0.4))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(cx, cy).strength(0.05))
      .force("collision", d3.forceCollide().radius((d: any) => d.tier === 0 ? 40 : d.tier === 1 ? 30 : 22))
      .alphaDecay(0.02);

    simRef.current = sim;

    // Background grid
    const gridG = svg.append("g").attr("class", "grid");
    for (let x = 0; x < width; x += 40) {
      gridG.append("line")
        .attr("x1", x).attr("y1", 0).attr("x2", x).attr("y2", height)
        .attr("stroke", "#0d0d1a").attr("stroke-width", 0.5);
    }
    for (let y = 0; y < height; y += 40) {
      gridG.append("line")
        .attr("x1", 0).attr("y1", y).attr("x2", width).attr("y2", y)
        .attr("stroke", "#0d0d1a").attr("stroke-width", 0.5);
    }

    // Edges
    const linkG = svg.append("g").attr("class", "links");
    const linkSel = linkG.selectAll("line")
      .data(simEdges)
      .join("line")
      .attr("stroke", (e: any) => e.active ? "#00d4ff18" : "#111122")
      .attr("stroke-width", (e: any) => e.active ? Math.max(0.5, e.weight * 2) : 0.5)
      .attr("stroke-dasharray", (e: any) => e.active ? "none" : "3,6")
      .attr("marker-end", "url(#arrow)");

    // Signal pulse layer (circles that travel along edges)
    const pulseG = svg.append("g").attr("class", "pulses");

    // Nodes
    const nodeG = svg.append("g").attr("class", "nodes");
    const nodeSel = nodeG.selectAll("g")
      .data(simNodes)
      .join("g")
      .attr("cursor", "pointer")
      .call(d3.drag<any, any>()
        .on("start", (event, d) => { if (!event.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on("end", (event, d) => { if (!event.active) sim.alphaTarget(0); d.fx = null; d.fy = null; })
      )
      .on("click", (_event, d: any) => {
        const node = nodes.find(n => n.id === d.id);
        if (node) { setSelectedNode(prev => prev?.id === node.id ? null : node); onNodeClick?.(node); }
      })
      .on("mouseenter", (_event, d: any) => {
        const node = nodes.find(n => n.id === d.id);
        if (node) setHoveredNode(node);
      })
      .on("mouseleave", () => setHoveredNode(null));

    // Outer glow ring
    nodeSel.append("circle")
      .attr("r", (d: any) => d.tier === 0 ? 26 : d.tier === 1 ? 20 : 14)
      .attr("fill", "none")
      .attr("stroke", (d: any) => statusColor(d.status))
      .attr("stroke-width", 1)
      .attr("stroke-opacity", 0.3)
      .attr("filter", (d: any) => d.status === "healthy" ? "url(#glow-0)" : "none");

    // Main circle
    nodeSel.append("circle")
      .attr("r", (d: any) => d.tier === 0 ? 20 : d.tier === 1 ? 15 : 10)
      .attr("fill", (d: any) => `${d.color}18`)
      .attr("stroke", (d: any) => d.color)
      .attr("stroke-width", (d: any) => d.tier === 0 ? 2 : 1.5);

    // Inner dot
    nodeSel.append("circle")
      .attr("r", (d: any) => d.tier === 0 ? 5 : d.tier === 1 ? 4 : 3)
      .attr("fill", (d: any) => statusColor(d.status));

    // Label
    nodeSel.append("text")
      .attr("dy", (d: any) => d.tier === 0 ? 34 : d.tier === 1 ? 26 : 20)
      .attr("text-anchor", "middle")
      .attr("font-family", "monospace")
      .attr("font-size", (d: any) => d.tier === 0 ? "9px" : d.tier === 1 ? "8px" : "7px")
      .attr("font-weight", (d: any) => d.tier <= 1 ? "bold" : "normal")
      .attr("fill", (d: any) => d.tier === 0 ? "#b44fff" : d.tier === 1 ? d.color : "#555577")
      .attr("letter-spacing", "0.1em")
      .text((d: any) => d.name.toUpperCase());

    // Tier badge for archangels
    nodeSel.filter((d: any) => d.tier === 1).append("text")
      .attr("dy", -18)
      .attr("text-anchor", "middle")
      .attr("font-size", "8px")
      .attr("fill", (d: any) => d.color)
      .text("✦");

    // Simulation tick
    sim.on("tick", () => {
      linkSel
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      nodeSel.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    // Animate signal pulses
    const animatePulses = () => {
      pulseG.selectAll("*").remove();

      activeSignals.forEach(sig => {
        const srcNode = simNodes.find(n => n.id === sig.sourceId);
        const tgtNode = simNodes.find(n => n.id === sig.targetId);
        if (!srcNode || !tgtNode) return;

        const t = sig.progress;
        const x = (srcNode as any).x + ((tgtNode as any).x - (srcNode as any).x) * t;
        const y = (srcNode as any).y + ((tgtNode as any).y - (srcNode as any).y) * t;

        pulseG.append("circle")
          .attr("cx", x).attr("cy", y)
          .attr("r", 4)
          .attr("fill", sig.color)
          .attr("opacity", 0.9)
          .attr("filter", "url(#glow-0)");

        // Trail
        for (let i = 1; i <= 3; i++) {
          const tt = Math.max(0, t - i * 0.05);
          const tx = (srcNode as any).x + ((tgtNode as any).x - (srcNode as any).x) * tt;
          const ty = (srcNode as any).y + ((tgtNode as any).y - (srcNode as any).y) * tt;
          pulseG.append("circle")
            .attr("cx", tx).attr("cy", ty)
            .attr("r", 4 - i)
            .attr("fill", sig.color)
            .attr("opacity", 0.3 / i);
        }
      });

      animFrameRef.current = requestAnimationFrame(animatePulses);
    };

    animFrameRef.current = requestAnimationFrame(animatePulses);

    return () => {
      sim.stop();
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [nodes, edges, width, height]);

  // ── Advance signal pulses ──────────────────────────────────────────────────
  useEffect(() => {
    if (activeSignals.length === 0) return;
    const interval = setInterval(() => {
      setActiveSignals(prev => prev
        .map(s => ({ ...s, progress: s.progress + 0.025 }))
        .filter(s => s.progress <= 1.05)
      );
    }, 30);
    return () => clearInterval(interval);
  }, [activeSignals.length]);

  // ── Simulate heartbeats ────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const healthyNodes = nodes.filter(n => n.status === "healthy" || n.status === "degraded");
      if (healthyNodes.length < 2) return;

      const src = healthyNodes[Math.floor(Math.random() * healthyNodes.length)];
      const tgt = healthyNodes.filter(n => n.id !== src.id)[Math.floor(Math.random() * (healthyNodes.length - 1))];
      if (!tgt) return;

      const types: MeshSignal["type"][] = ["HEARTBEAT", "HEARTBEAT", "HEARTBEAT", "TASK", "QUERY"];
      const type = types[Math.floor(Math.random() * types.length)];

      const newSig: MeshSignal = {
        id: `sig-${Date.now()}-${Math.random()}`,
        sourceId: src.id,
        targetId: tgt.id,
        type,
        progress: 0,
        color: signalColor(type),
      };

      setActiveSignals(prev => [...prev.slice(-20), newSig]);

      if (type !== "HEARTBEAT") {
        setSignalLog(prev => [{
          time: new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          msg: `${src.name} → ${tgt.name} [${type}]`,
          color: signalColor(type),
        }, ...prev.slice(0, 19)]);
      }
    }, 800);
    return () => clearInterval(interval);
  }, [nodes]);

  // ── Manual broadcast ───────────────────────────────────────────────────────
  const sendBroadcast = useCallback(() => {
    const orchestrator = nodes.find(n => n.tier === 0);
    if (!orchestrator) return;

    const newSignals: MeshSignal[] = nodes
      .filter(n => n.id !== orchestrator.id && (n.status === "healthy" || n.status === "degraded"))
      .map((n, i) => ({
        id: `broadcast-${Date.now()}-${i}`,
        sourceId: orchestrator.id,
        targetId: n.id,
        type: "BROADCAST" as const,
        progress: 0,
        color: "#ffd700",
      }));

    setActiveSignals(prev => [...prev, ...newSignals]);
    setSignalLog(prev => [{
      time: new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      msg: `MESH BROADCAST → ALL NODES (${newSignals.length})`,
      color: "#ffd700",
    }, ...prev.slice(0, 19)]);
  }, [nodes]);

  return (
    <div className="flex flex-col gap-3">
      {/* Controls bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Radio size={11} className="text-[#b44fff]" />
          <span className="mono text-[10px] text-[#b44fff] tracking-widest">ROUTING MODE</span>
        </div>
        {(["SHORTEST_PATH", "BROADCAST", "REDUNDANT"] as const).map(mode => (
          <button
            key={mode}
            onClick={() => setRoutingMode(mode)}
            className="mono text-[9px] px-2 py-1 rounded-sm transition-all"
            style={{
              border: `1px solid ${routingMode === mode ? "#b44fff" : "#222233"}`,
              color: routingMode === mode ? "#b44fff" : "#444466",
              background: routingMode === mode ? "#b44fff15" : "transparent",
            }}
          >{mode.replace("_", " ")}</button>
        ))}
        <div className="flex-1" />
        <button
          onClick={sendBroadcast}
          className="flex items-center gap-1.5 mono text-[9px] px-3 py-1.5 rounded-sm transition-all hover:opacity-80"
          style={{ border: "1px solid #ffd70040", color: "#ffd700", background: "#ffd70010" }}
        >
          <Zap size={9} /> BROADCAST ALL
        </button>
        <button
          onClick={() => setActiveSignals([])}
          className="flex items-center gap-1.5 mono text-[9px] px-2 py-1.5 rounded-sm transition-all hover:opacity-80"
          style={{ border: "1px solid #333344", color: "#444466" }}
        >
          <RotateCcw size={9} /> CLEAR
        </button>
      </div>

      {/* Main graph + log */}
      <div className="flex gap-3">
        {/* SVG Canvas */}
        <div className="flex-1 relative rounded-sm overflow-hidden" style={{ background: "#06060f", border: "1px solid #0d0d1a" }}>
          {/* Corner labels */}
          <div className="absolute top-2 left-2 mono text-[8px] text-[#1a1a2e] tracking-widest">HOLON NEURAL MESH v1.0</div>
          <div className="absolute top-2 right-2 mono text-[8px] text-[#1a1a2e]">
            {nodes.filter(n => n.status === "healthy").length}/{nodes.length} NODES ONLINE
          </div>

          <svg ref={svgRef} width={width} height={height} style={{ display: "block" }} />

          {/* Legend */}
          <div className="absolute bottom-2 left-2 flex items-center gap-3">
            {[
              { color: "#b44fff", label: "ORCHESTRATOR" },
              { color: "#ffd700", label: "ARCHANIOŁ ✦" },
              { color: "#00d4ff", label: "ANIOŁ" },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                <span className="mono text-[7px]" style={{ color: l.color }}>{l.label}</span>
              </div>
            ))}
          </div>

          {/* Signal type legend */}
          <div className="absolute bottom-2 right-2 flex items-center gap-2">
            {(["HEARTBEAT", "TASK", "BROADCAST", "QUERY"] as const).map(t => (
              <div key={t} className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: signalColor(t) }} />
                <span className="mono text-[7px] text-[#333355]">{t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel: hovered node info + signal log */}
        <div className="w-48 flex flex-col gap-2">
          {/* Node info */}
          <div className="rounded-sm p-3 flex-shrink-0" style={{ background: "#08080f", border: "1px solid #111122", minHeight: 100 }}>
            <div className="mono text-[9px] text-[#333355] tracking-widest mb-2">NODE INFO</div>
            {(hoveredNode || selectedNode) ? (() => {
              const n = hoveredNode || selectedNode!;
              return (
                <div className="space-y-1.5">
                  <div className="mono text-[11px] font-bold" style={{ color: n.color }}>{n.name}</div>
                  <div className="mono text-[8px] text-[#333355]">{n.domain}</div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor(n.status) }} />
                    <span className="mono text-[9px]" style={{ color: statusColor(n.status) }}>{n.status.toUpperCase()}</span>
                  </div>
                  <div className="mono text-[8px] text-[#222244]">
                    TIER {n.tier === 0 ? "0 — ORCHESTRATOR" : n.tier === 1 ? "1 — ARCHANIOŁ" : "2 — ANIOŁ"}
                  </div>
                  {n.latency && <div className="mono text-[8px] text-[#333355]">LATENCY: {n.latency}ms</div>}
                  {n.load !== undefined && (
                    <div>
                      <div className="mono text-[8px] text-[#333355] mb-0.5">LOAD: {n.load}%</div>
                      <div className="h-1 rounded-full bg-[#111122] overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${n.load}%`, background: n.load > 80 ? "#ff3366" : n.load > 50 ? "#ffd700" : "#00ff88" }} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })() : (
              <div className="mono text-[8px] text-[#1a1a2e]">Hover lub kliknij węzeł</div>
            )}
          </div>

          {/* Signal log */}
          <div className="flex-1 rounded-sm p-2 overflow-hidden" style={{ background: "#06060f", border: "1px solid #0d0d1a" }}>
            <div className="flex items-center gap-1.5 mb-2">
              <Activity size={9} className="text-[#00d4ff]" />
              <span className="mono text-[9px] text-[#333355] tracking-widest">SIGNAL LOG</span>
            </div>
            <div className="space-y-1 overflow-y-auto" style={{ maxHeight: 200 }}>
              <AnimatePresence>
                {signalLog.map((entry, i) => (
                  <motion.div
                    key={`${entry.time}-${i}`}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="mono text-[7px] leading-relaxed"
                  >
                    <span className="text-[#1a1a2e]">{entry.time} </span>
                    <span style={{ color: entry.color }}>{entry.msg}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {signalLog.length === 0 && (
                <div className="mono text-[7px] text-[#111122]">Oczekiwanie na sygnały...</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "AKTYWNE SYGNAŁY", value: activeSignals.length, color: "#00d4ff" },
          { label: "WĘZŁY ONLINE", value: nodes.filter(n => n.status !== "offline").length, color: "#00ff88" },
          { label: "POŁĄCZENIA", value: edges.filter(e => e.active).length, color: "#b44fff" },
          { label: "ROUTING", value: routingMode.replace("_", " "), color: "#ffd700" },
        ].map(s => (
          <div key={s.label} className="rounded-sm p-2 text-center" style={{ background: "#08080f", border: "1px solid #0d0d1a" }}>
            <div className="mono font-bold text-sm" style={{ color: s.color }}>{s.value}</div>
            <div className="mono text-[7px] text-[#222233] tracking-widest">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
