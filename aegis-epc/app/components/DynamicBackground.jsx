"use client";

import { useEffect, useRef } from "react";

// Government-grade: subtle, slow, formal network topology
// Inspired by data-centre connectivity maps — nodes drift very slowly,
// lines form only between nearby nodes. All at very low opacity.

const THEME = {
  nodePrimary:   "rgba(37, 99, 235, 0.45)",   // blue-600
  nodeSecondary: "rgba(71, 85, 105, 0.28)",   // slate-600
  nodeAccent:    "rgba(99, 102, 241, 0.38)",  // indigo-500
  line:          "rgba(37, 99, 235, 0.18)",
  lineFar:       "rgba(148, 163, 184, 0.12)", // slate-400
};

const NODE_COUNT  = 72;
const MAX_DIST    = 140;  // px — max distance to draw a line
const SPEED_MAX   = 0.22; // very slow drift

function randomBetween(a, b) {
  return a + Math.random() * (b - a);
}

function initNodes(w, h) {
  return Array.from({ length: NODE_COUNT }, () => {
    const r = Math.random();
    return {
      x:  Math.random() * w,
      y:  Math.random() * h,
      vx: randomBetween(-SPEED_MAX, SPEED_MAX),
      vy: randomBetween(-SPEED_MAX, SPEED_MAX),
      // mix of three types
      type: r < 0.55 ? "secondary" : r < 0.82 ? "primary" : "accent",
      radius: r < 0.55 ? randomBetween(1.5, 2.5) : r < 0.82 ? randomBetween(2.5, 4) : randomBetween(3, 5),
      // occasional "hub" nodes — slightly larger, pulse slowly
      isHub: Math.random() < 0.12,
      pulse: Math.random() * Math.PI * 2,
    };
  });
}

export default function DynamicBackground() {
  const canvasRef = useRef(null);
  const stateRef  = useRef({ nodes: [], raf: null, w: 0, h: 0, tick: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const state = stateRef.current;

    const resize = () => {
      state.w = canvas.width  = window.innerWidth;
      state.h = canvas.height = window.innerHeight;
      if (!state.nodes.length) {
        state.nodes = initNodes(state.w, state.h);
      }
    };

    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      state.raf = requestAnimationFrame(draw);
      state.tick++;

      ctx.clearRect(0, 0, state.w, state.h);

      const { nodes, w, h, tick } = state;

      // Update positions — bounce off edges
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
        if (n.isHub) n.pulse += 0.012; // slow pulse
      }

      // Draw lines between nearby nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > MAX_DIST) continue;

          const alpha = (1 - dist / MAX_DIST);
          const isBothHub = nodes[i].isHub && nodes[j].isHub;

          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.strokeStyle = isBothHub
            ? `rgba(37,99,235,${(0.35 * alpha).toFixed(3)})`
            : `rgba(100,116,139,${(0.18 * alpha).toFixed(3)})`;
          ctx.lineWidth = isBothHub ? 1.4 : 0.9;
          ctx.stroke();
        }
      }

      // Draw nodes
      for (const n of nodes) {
        let color, r = n.radius;
        if (n.type === "primary")   color = THEME.nodePrimary;
        else if (n.type === "accent") color = THEME.nodeAccent;
        else                          color = THEME.nodeSecondary;

        // Hub nodes get a soft outer glow ring
        if (n.isHub) {
          const pulseR = r + 3 + Math.sin(n.pulse) * 1.5;
          const grad = ctx.createRadialGradient(n.x, n.y, r * 0.5, n.x, n.y, pulseR);
          grad.addColorStop(0, "rgba(37,99,235,0.40)");
          grad.addColorStop(1, "rgba(37,99,235,0)");
          ctx.beginPath();
          ctx.arc(n.x, n.y, pulseR, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }
    };

    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(state.raf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position:  "fixed",
        inset:     0,
        zIndex:    0,
        pointerEvents: "none",
        opacity:   1,
      }}
    />
  );
}
