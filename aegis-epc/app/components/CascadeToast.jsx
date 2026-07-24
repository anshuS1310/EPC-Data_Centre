"use client";

import React, { useEffect, useState } from "react";
import { Zap, CheckCircle2, XCircle, X, ArrowRight } from "lucide-react";

const CONFIG = {
  warning: {
    icon: Zap,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    bar: "bg-amber-500",
    border: "border-l-4 border-l-amber-500",
    titleColor: "text-amber-800",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    pulse: true,
  },
  success: {
    icon: CheckCircle2,
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    bar: "bg-emerald-500",
    border: "border-l-4 border-l-emerald-500",
    titleColor: "text-emerald-800",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    pulse: false,
  },
  error: {
    icon: XCircle,
    iconBg: "bg-red-100",
    iconColor: "text-red-600",
    bar: "bg-red-500",
    border: "border-l-4 border-l-red-500",
    titleColor: "text-red-800",
    badge: "bg-red-100 text-red-700 border-red-200",
    pulse: false,
  },
};

export default function CascadeToast({ toast, onDismiss, onViewFeed }) {
  const [progress, setProgress] = useState(100);
  const [visible, setVisible] = useState(false);
  const duration = 6000;

  // Slide in when toast arrives
  useEffect(() => {
    if (!toast) { setVisible(false); return; }
    setProgress(100);
    setVisible(true);

    const start = Date.now();
    let rafId;
    const tick = () => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining > 0) { rafId = requestAnimationFrame(tick); }
      else { onDismiss?.(); }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [toast]);

  if (!toast) return null;

  const type   = toast.type || "warning";
  const cfg    = CONFIG[type] || CONFIG.warning;
  const Icon   = cfg.icon;

  return (
    <div
      className={`fixed bottom-5 right-5 z-[9999] w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transition-all duration-300 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"} ${cfg.border}`}
      style={{ backdropFilter: "blur(8px)" }}
    >
      {/* Progress bar — top */}
      <div
        className={`h-0.5 ${cfg.bar} transition-all ease-linear`}
        style={{ width: `${progress}%`, transitionDuration: "120ms" }}
      />

      {/* Body */}
      <div className="p-3.5 flex items-start gap-3">
        {/* Icon */}
        <div className={`w-8 h-8 rounded-lg ${cfg.iconBg} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`h-4 w-4 ${cfg.iconColor} ${cfg.pulse ? "animate-pulse" : ""}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <p className={`text-sm font-bold leading-tight ${cfg.titleColor}`}>{toast.title}</p>
            {toast.cascadeSteps > 0 && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${cfg.badge}`}>
                {toast.cascadeSteps}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 leading-snug line-clamp-2">{toast.text}</p>

          {type === "warning" && onViewFeed && (
            <button
              onClick={() => { onViewFeed(); onDismiss?.(); }}
              className="mt-2 flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              View Alerts <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Close */}
        <button
          onClick={onDismiss}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex-shrink-0 -mt-0.5"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
