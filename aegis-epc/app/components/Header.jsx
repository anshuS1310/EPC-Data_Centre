"use client";

import React from "react";
import { useSharedBrain } from "../context/SharedBrainContext";
import { ShieldAlert, Clock, IndianRupee, Layers, CheckCircle, Calendar, TrendingUp, TrendingDown } from "lucide-react";

function TrendArrow({ direction, upIsGood }) {
  if (!direction || direction === "same") return null;
  const isGood = direction === "up" ? upIsGood : !upIsGood;
  const Icon = direction === "up" ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center ml-0.5 ${isGood ? "text-emerald-600" : "text-red-600"}`}>
      <Icon className="h-3 w-3" strokeWidth={2.5} />
    </span>
  );
}

/**
 * KpiChip — compact metric card.
 * Shows icon + short label + value. Full detail exposed via native browser title tooltip
 * (works reliably regardless of parent overflow:hidden constraints).
 */
function KpiChip({ icon: Icon, iconBg, iconColor, label, titleText, value, valueColor = "text-slate-900", trend, accent = "hover:border-slate-400" }) {
  return (
    <div
      title={titleText}
      className={`group bg-white border border-slate-200 rounded-xl px-3 py-2 flex items-center gap-2 shadow-sm ${accent} hover:shadow-md transition-all duration-200 flex-1 min-w-0 cursor-default select-none`}
    >
      {/* Icon badge */}
      <div className={`w-7 h-7 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wide leading-none mb-0.5 truncate">
          {label}
        </div>
        <div className={`text-xs font-bold ${valueColor} flex items-center gap-0.5 truncate leading-tight`}>
          {value}{trend}
        </div>
      </div>
    </div>
  );
}

export default function Header() {
  const {
    activeProject, activeProjectId, setActiveProjectId,
    getCostRiskExposure, getHoursSaved, metricTrends,
  } = useSharedBrain();

  const fmt = (val) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
    if (val >= 100000)   return `₹${(val / 100000).toFixed(1)}L`;
    return `₹${val}`;
  };

  const costRisk   = getCostRiskExposure();
  const hoursSaved = getHoursSaved();
  const delayDays  = activeProject?.current_delay_days ?? 0;
  const trends     = metricTrends || {};

  const cap     = activeProject?.current_capacity_mw ?? 0;
  const target  = activeProject?.target_capacity_mw ?? 0;
  const tier    = activeProject?.tier_rating ?? "—";
  const dpdp    = activeProject?.dpdp_phase ?? "Phased 2027";
  const sched   = delayDays > 0 ? `+${delayDays} Days` : "On Time";
  const risk    = fmt(costRisk);
  const saved   = `${hoursSaved} hrs`;

  const kpis = [
    {
      icon: Layers, iconBg: "bg-blue-100", iconColor: "text-blue-700",
      label: "Capacity",
      titleText: `Installed / Target Capacity\n${cap} MW installed of ${target} MW target`,
      value: `${cap}/${target} MW`,
      valueColor: "text-blue-900",
      accent: "hover:border-blue-400",
    },
    {
      icon: CheckCircle, iconBg: "bg-emerald-100", iconColor: "text-emerald-700",
      label: "Tier",
      titleText: `Uptime Institute Tier Rating\nTarget: ${tier}`,
      value: tier,
      valueColor: "text-emerald-800",
      accent: "hover:border-emerald-400",
    },
    {
      icon: ShieldAlert, iconBg: "bg-indigo-100", iconColor: "text-indigo-700",
      label: "DPDP",
      titleText: `DPDP Compliance Status\n${dpdp}`,
      value: dpdp,
      valueColor: "text-indigo-800",
      accent: "hover:border-indigo-400",
    },
    {
      icon: Calendar,
      iconBg: delayDays > 0 ? "bg-amber-100" : "bg-emerald-100",
      iconColor: delayDays > 0 ? "text-amber-700" : "text-emerald-700",
      label: "Schedule",
      titleText: `CPM Schedule Status\n${delayDays > 0 ? `${delayDays} days behind baseline critical path` : "On time — no float erosion detected"}`,
      value: sched,
      valueColor: delayDays > 0 ? "text-amber-800" : "text-emerald-800",
      trend: <TrendArrow direction={trends.delayDays} upIsGood={false} />,
      accent: delayDays > 0 ? "hover:border-amber-400" : "hover:border-emerald-400",
    },
    {
      icon: IndianRupee,
      iconBg: costRisk > 0 ? "bg-red-100" : "bg-slate-100",
      iconColor: costRisk > 0 ? "text-red-700" : "text-slate-500",
      label: "Risk",
      titleText: `Financial Risk Exposure\n${risk} total cost-at-risk from open NCRs & delays`,
      value: risk,
      valueColor: costRisk > 0 ? "text-red-800" : "text-slate-700",
      trend: <TrendArrow direction={trends.financialRisk} upIsGood={false} />,
      accent: costRisk > 0 ? "hover:border-red-400" : "hover:border-slate-400",
    },
    {
      icon: Clock, iconBg: "bg-purple-100", iconColor: "text-purple-700",
      label: "AI Saved",
      titleText: `AI-Assisted Hours Saved\n${saved} saved vs. manual project management workflows`,
      value: saved,
      valueColor: "text-purple-900",
      trend: <TrendArrow direction={trends.hoursSaved} upIsGood={true} />,
      accent: "hover:border-purple-400",
    },
  ];

  return (
    <header className="bg-white border-b border-slate-300 shadow-sm sticky top-0 z-40">
      <div className="flex items-center gap-3 px-4 py-2.5 min-w-0">

        {/* Government Emblem + Brand */}
        <div className="flex-shrink-0 flex items-center gap-2.5">
          <img src="/emblem-india.png" alt="Government of India" className="h-10 w-auto object-contain select-none" draggable={false} />
          <div className="h-9 w-px bg-slate-300" />
          <div>
            <div className="text-blue-800 font-extrabold text-base leading-tight tracking-tight">DCIMS</div>
            <div className="text-[10px] text-slate-500 font-semibold whitespace-nowrap leading-tight">Infrastructure Mgmt</div>
          </div>
        </div>

        <div className="h-8 w-px bg-slate-300 flex-shrink-0" />

        {/* Project selector */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[10px] text-slate-500 font-bold whitespace-nowrap uppercase tracking-wide">Site:</span>
          <select
            value={activeProjectId}
            onChange={(e) => setActiveProjectId(e.target.value)}
            className="bg-white text-xs text-slate-800 border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-semibold cursor-pointer transition-all shadow-sm"
          >
            <option value="PRJ-MUM-01">Navi Mumbai DC-1</option>
            <option value="PRJ-NOI-02">Noida Park-3</option>
            <option value="PRJ-PUN-03">Hinjawadi Edge-5</option>
          </select>
        </div>

        <div className="h-8 w-px bg-slate-300 flex-shrink-0" />

        {/* KPI chips — all 6 visible on one line. Hover over any chip to see full detail. */}
        <div className="flex items-stretch gap-1.5 flex-1 min-w-0">
          {kpis.map((kpi) => (
            <KpiChip key={kpi.label} {...kpi} />
          ))}
        </div>
      </div>
    </header>
  );
}
