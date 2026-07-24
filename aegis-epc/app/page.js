"use client";

import React, { useState, useCallback } from "react";
import { useSharedBrain } from "./context/SharedBrainContext";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import SharedBrainAlerts from "./components/SharedBrainAlerts";
import SpecComplianceAgent from "./components/SpecComplianceAgent";
import ScheduleRiskEngine from "./components/ScheduleRiskEngine";
import SupplyChainAgent from "./components/SupplyChainAgent";
import CommissioningCopilot from "./components/CommissioningCopilot";
import RfiKnowledgeAgent from "./components/RfiKnowledgeAgent";
import CascadeToast from "./components/CascadeToast";
import { CheckCircle2, RefreshCw, TrendingUp, TrendingDown, Zap, BarChart2, Server, Thermometer, ShieldCheck } from "lucide-react";

function TrendArrow({ direction, upIsGood }) {
  if (!direction || direction === "same") return null;
  const isGood = direction === "up" ? upIsGood : !upIsGood;
  const Icon = direction === "up" ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center ml-1 ${isGood ? "text-emerald-600" : "text-red-600"}`}>
      <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
    </span>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const toggleSidebar = useCallback(() => setSidebarOpen(v => !v), []);
  const {
    activeProject, nonConformances, triggerEventCascade,
    getCostRiskExposure, activeTriggerType, toastMessage, setToastMessage, metricTrends,
    backendReady,
  } = useSharedBrain();

  const formatCurrency = (val) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    return `₹${(val / 100000).toFixed(2)} L`;
  };

  const TriggerBtn = ({ type, label, variant = "amber" }) => {
    const isActive = activeTriggerType === type;
    const base = "text-sm font-semibold px-4 py-2 rounded-xl border transition-all flex items-center gap-2 shadow-sm";
    const styles = {
      amber: isActive
        ? `${base} bg-amber-600 text-white border-amber-600 shadow-amber-200`
        : `${base} bg-white text-amber-800 border-amber-400 hover:bg-amber-50 hover:border-amber-500`,
      red: isActive
        ? `${base} bg-red-600 text-white border-red-600 shadow-red-200`
        : `${base} bg-white text-red-800 border-red-400 hover:bg-red-50 hover:border-red-500`,
    };
    return (
      <button disabled={!!activeTriggerType} onClick={() => triggerEventCascade({ type })} className={styles[variant]}>
        {isActive && <RefreshCw className="h-4 w-4 animate-spin" />}
        {label}
      </button>
    );
  };

  const contextCards = [
    {
      icon: Server, iconBg: "bg-blue-100", iconColor: "text-blue-700",
      label: "Capacity", tab: "schedule",
      value: `${activeProject?.current_capacity_mw ?? 0} / ${activeProject?.target_capacity_mw ?? 0} MW`,
      valueColor: "text-blue-900",
      sub: `${activeProject?.city ?? "—"} hyperscale site`,
    },
    {
      icon: BarChart2, iconBg: "bg-emerald-100", iconColor: "text-emerald-700",
      label: "Infrastructure Cost Est.", tab: null,
      value: `₹${((activeProject?.target_capacity_mw ?? 0) * 0.45).toFixed(1)} Cr`,
      valueColor: "text-emerald-900",
      sub: "Based on ₹4.5 Cr/MW",
      trend: <TrendArrow direction={metricTrends?.financialRisk} upIsGood={false} />,
    },
    {
      icon: Thermometer, iconBg: "bg-pink-100", iconColor: "text-pink-700",
      label: "Cooling Specification", tab: "compliance",
      value: (activeProject?.target_capacity_mw ?? 0) > 100 ? "RDHx / Row Cooling" : "Standard DX Row",
      valueColor: "text-slate-900",
      sub: `Required for ${activeProject?.tier_rating ?? "—"} topology`,
    },
    {
      icon: ShieldCheck, iconBg: "bg-indigo-100", iconColor: "text-indigo-700",
      label: "Data Localisation", tab: "rfi-rag",
      value: ["Mumbai", "Pune", "Delhi NCR"].includes(activeProject?.city) ? "Compliant" : "Review Required",
      valueColor: ["Mumbai", "Pune", "Delhi NCR"].includes(activeProject?.city) ? "text-emerald-800" : "text-amber-800",
      sub: "Sovereign cloud compliance check",
    },
  ];

  return (
    <div className="flex h-screen text-slate-900 overflow-hidden transition-all duration-300 relative z-10">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} isOpen={sidebarOpen} onToggle={toggleSidebar} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />

        {/* Backend connecting banner */}
        {!backendReady && (
          <div className="mx-6 mt-3 flex items-center gap-3 bg-amber-50 border border-amber-300 rounded-xl px-4 py-2.5 shadow-sm">
            <RefreshCw className="h-4 w-4 text-amber-600 animate-spin flex-shrink-0" />
            <p className="text-sm font-semibold text-amber-800">
              Connecting to DCIMS Intelligence Platform server… Loading project data.
            </p>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-6 space-y-5 bg-transparent">

          {/* ─── OVERVIEW TAB ─── */}
          <div style={{ display: activeTab === "dashboard" ? "block" : "none" }}>
            <div className="space-y-5">

              {/* Hero Card */}
              <div className="bg-white border border-slate-300 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-blue-50 to-transparent rounded-full translate-x-8 -translate-y-8 pointer-events-none" />
                <div className="space-y-1 z-10">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                    <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">All Systems Operational</span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">Project Intelligence Dashboard</h2>
                  <p className="text-sm text-slate-600 max-w-2xl leading-relaxed font-medium">
                    Integrated view of quality compliance, schedule risk, supply chain status, and commissioning progress for{" "}
                    <span className="font-semibold text-slate-800">{activeProject?.name ?? "active project"}</span>.
                  </p>
                </div>
                <div className="flex gap-2 shrink-0 z-10 flex-wrap">
                  <TriggerBtn type="CLEARANCE_VIOLATION" label="Clearance Check" variant="amber" />
                  <TriggerBtn type="PIPING_VIOLATION"   label="Piping Check"    variant="amber" />
                  <TriggerBtn type="GENERATOR_VIOLATION" label="Generator Check" variant="red" />
                </div>
              </div>

              {/* Main Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <SharedBrainAlerts setActiveTab={setActiveTab} />

                {/* NCR Panel */}
                <div className="bg-white border border-slate-300 rounded-2xl shadow-sm flex flex-col overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-red-600" />
                      <h3 className="text-base font-bold text-slate-900">Open Non-Conformances</h3>
                      {nonConformances.length > 0 && (
                        <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300">
                          {nonConformances.length} open
                          <TrendArrow direction={metricTrends?.ncrCount} upIsGood={false} />
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-600 font-bold">QMS Audit Trail</span>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[360px] md:max-h-none">
                    {nonConformances.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-slate-500 h-full">
                        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                        </div>
                        <p className="text-sm font-semibold text-slate-700">All equipment compliant</p>
                        <p className="text-xs text-slate-600 mt-1">No open non-conformances</p>
                      </div>
                    ) : (
                      nonConformances.map((ncr) => (
                        <div
                          key={ncr.id}
                          onClick={() => setActiveTab("compliance")}
                          className="border border-slate-200 border-l-4 border-l-red-500 rounded-xl p-3.5 space-y-1.5 cursor-pointer hover:border-red-300 hover:bg-red-50/50 transition-all"
                        >
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-sm font-bold text-slate-900 leading-tight hover:text-red-700 transition-colors">
                              {ncr.title}
                            </span>
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300 flex-shrink-0">
                              {ncr.status}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 font-medium leading-snug">{ncr.description}</p>
                          <div className="flex justify-between text-xs text-slate-500 pt-0.5">
                            <span>Clause: <span className="font-bold text-slate-700">{ncr.spec_clause}</span></span>
                            <span>Cost: <span className="font-bold text-red-700">{formatCurrency(ncr.rectification_cost_inr)}</span></span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Context Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {contextCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div
                      key={card.label}
                      onClick={card.tab ? () => setActiveTab(card.tab) : undefined}
                      className={`bg-white border border-slate-300 rounded-2xl p-5 shadow-sm transition-all duration-200 space-y-3 ${card.tab ? "cursor-pointer hover:border-blue-400 hover:shadow-md hover:-translate-y-0.5" : ""}`}
                    >
                      <div className={`w-10 h-10 rounded-xl ${card.iconBg} flex items-center justify-center`}>
                        <Icon className={`h-5 w-5 ${card.iconColor}`} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">{card.label}</div>
                        <div className={`text-lg font-bold flex items-center ${card.valueColor ?? "text-slate-900"}`}>
                          {card.value}{card.trend}
                        </div>
                        <p className="text-xs text-slate-600 font-medium mt-1 leading-snug">{card.sub}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          </div>

          <div style={{ display: activeTab === "compliance"    ? "block" : "none" }}><SpecComplianceAgent /></div>
          <div style={{ display: activeTab === "schedule"      ? "block" : "none" }}><ScheduleRiskEngine /></div>
          <div style={{ display: activeTab === "supply-chain"  ? "block" : "none" }}><SupplyChainAgent activeTab={activeTab} /></div>
          <div style={{ display: activeTab === "commissioning" ? "block" : "none" }}><CommissioningCopilot /></div>
          <div style={{ display: activeTab === "rfi-rag"       ? "block" : "none" }}><RfiKnowledgeAgent /></div>

        </main>
      </div>

      {/* Floating toast */}
      <CascadeToast
        toast={toastMessage}
        onDismiss={() => setToastMessage(null)}
        onViewFeed={() => setActiveTab("dashboard")}
      />
    </div>
  );
}
