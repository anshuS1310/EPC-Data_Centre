"use client";

import React from "react";
import { useSharedBrain } from "../context/SharedBrainContext";
import { AlertTriangle, CheckCircle, RefreshCw, Bell } from "lucide-react";

export default function SharedBrainAlerts({ setActiveTab }) {
  const { activeAlerts, triggerEventCascade, activeTriggerType } = useSharedBrain();

  const handleAgentClick = (agentName) => {
    if (!setActiveTab) return;
    const name = agentName.toLowerCase();
    if (name.includes("spec") || name.includes("compliance") || name.includes("1.")) setActiveTab("compliance");
    else if (name.includes("schedule") || name.includes("cost") || name.includes("2.")) setActiveTab("schedule");
    else if (name.includes("supply") || name.includes("chain") || name.includes("3.")) setActiveTab("supply-chain");
    else if (name.includes("commissioning") || name.includes("4.")) setActiveTab("commissioning");
    else if (name.includes("rfi") || name.includes("knowledge") || name.includes("5.")) setActiveTab("rfi-rag");
  };

  const TriggerBtn = ({ type, label, variant = "amber" }) => {
    const isActive = activeTriggerType === type;
    const styles = {
      amber: isActive
        ? "bg-amber-600 text-white border-amber-600"
        : "bg-white text-amber-700 border-amber-300 hover:bg-amber-50",
      red: isActive
        ? "bg-red-600 text-white border-red-600"
        : "bg-white text-red-700 border-red-300 hover:bg-red-50",
    };
    return (
      <button
        disabled={!!activeTriggerType}
        onClick={() => triggerEventCascade({ type })}
        className={`text-sm font-medium px-4 py-2 rounded-lg border transition-all flex items-center gap-2 ${styles[variant]}`}
      >
        {isActive && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
        {label}
      </button>
    );
  };

  return (
    <div className="bg-white border border-slate-300 rounded-xl shadow-sm flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-blue-600" />
          <h2 className="text-base font-bold text-slate-900">System Alerts</h2>
          {activeAlerts.length > 0 && (
            <span className="bg-red-100 text-red-800 border border-red-300 text-xs font-bold px-2 py-0.5 rounded-full">
              {activeAlerts.length}
            </span>
          )}
        </div>
        {activeAlerts.length > 0 && (
          <button
            disabled={activeTriggerType === "CLEAR_ALL_NCR"}
            onClick={() => triggerEventCascade({ type: "CLEAR_ALL_NCR" })}
            className="text-sm font-semibold text-slate-600 hover:text-red-700 hover:bg-red-50 border border-slate-300 hover:border-red-300 rounded-lg px-3 py-1.5 transition-all flex items-center gap-1.5"
          >
            {activeTriggerType === "CLEAR_ALL_NCR" && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
            Clear All
          </button>
        )}
      </div>

      {/* Trigger controls */}
      <div className="px-5 py-3 border-b border-slate-200 bg-slate-100 flex flex-wrap gap-2 items-center">
        <span className="text-xs text-slate-700 font-bold uppercase tracking-wider mr-1">Run Check:</span>
        <TriggerBtn type="CLEARANCE_VIOLATION" label="Clearance" variant="amber" />
        <TriggerBtn type="PIPING_VIOLATION" label="Piping" variant="amber" />
        <TriggerBtn type="GENERATOR_VIOLATION" label="Generator" variant="red" />
      </div>

      {/* Alert feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[340px] md:max-h-none">
        {activeAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
              <CheckCircle className="h-6 w-6 text-emerald-600" />
            </div>
            <p className="text-sm font-semibold text-slate-700">No active alerts</p>
            <p className="text-xs text-slate-600 mt-1">All systems operating normally</p>
          </div>
        ) : (
          activeAlerts.map((alert) => (
            <div
              key={alert.id}
              className="border border-amber-200 rounded-xl p-4 bg-amber-50/50 border-l-4 border-l-amber-500"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="text-sm font-bold text-amber-900 leading-tight">{alert.title}</h3>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 flex-shrink-0">
                      Active
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed mb-3">{alert.description}</p>

                  {/* Flow Trace */}
                  {alert.steps?.length > 0 && (
                    <div className="border-t border-amber-200 pt-3">
                      <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                        Impact Propagation
                      </div>
                      <div className="space-y-2">
                        {alert.steps.map((step, idx) => (
                          <div
                            key={idx}
                            className="flex gap-2.5 cursor-pointer group"
                            onClick={() => handleAgentClick(step.agent)}
                          >
                            <div className="flex flex-col items-center">
                              <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                              {idx < alert.steps.length - 1 && (
                                <div className="w-px flex-1 bg-slate-400 mt-1 min-h-[16px]" />
                              )}
                            </div>
                            <div className="flex-1 bg-white border border-slate-400 rounded-lg px-3 py-1.5 hover:border-blue-500 hover:bg-blue-50 transition-all mb-1">
                              <span className="text-xs font-bold text-blue-800 block group-hover:underline">
                                {step.agent}
                              </span>
                               <span className="text-xs text-slate-700 font-medium mt-0.5 block">{step.msg}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
