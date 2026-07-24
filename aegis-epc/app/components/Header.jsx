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

function KpiChip({ icon: Icon, iconBg, iconColor, label, value, valueColor = "text-slate-900", trend }) {
  return (
    <div className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 flex items-center gap-2 shadow-sm hover:shadow-md transition-all duration-200 flex-1 min-w-0">
      <div className={`w-7 h-7 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider leading-none mb-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
          {label}
        </div>
        <div className={`text-xs sm:text-sm font-bold ${valueColor} flex items-center whitespace-nowrap`}>
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

  const kpis = [
    {
      icon: Layers, iconBg: "bg-blue-100", iconColor: "text-blue-700",
      label: "Capacity",
      value: `${activeProject?.current_capacity_mw ?? 0}/${activeProject?.target_capacity_mw ?? 0} MW`,
      valueColor: "text-blue-900",
    },
    {
      icon: CheckCircle, iconBg: "bg-emerald-100", iconColor: "text-emerald-700",
      label: "Tier Target",
      value: activeProject?.tier_rating ?? "—",
      valueColor: "text-emerald-800",
    },
    {
      icon: ShieldAlert, iconBg: "bg-indigo-100", iconColor: "text-indigo-700",
      label: "Compliance",
      value: activeProject?.dpdp_phase ?? "Phased 2027",
      valueColor: "text-indigo-800",
    },
    {
      icon: Calendar,
      iconBg: delayDays > 0 ? "bg-amber-100" : "bg-emerald-100",
      iconColor: delayDays > 0 ? "text-amber-700" : "text-emerald-700",
      label: "Schedule",
      value: delayDays > 0 ? `+${delayDays} Days` : "On Time",
      valueColor: delayDays > 0 ? "text-amber-800" : "text-emerald-800",
      trend: <TrendArrow direction={trends.delayDays} upIsGood={false} />,
    },
    {
      icon: IndianRupee,
      iconBg: costRisk > 0 ? "bg-red-100" : "bg-slate-100",
      iconColor: costRisk > 0 ? "text-red-700" : "text-slate-500",
      label: "Financial Risk",
      value: fmt(costRisk),
      valueColor: costRisk > 0 ? "text-red-800" : "text-slate-700",
      trend: <TrendArrow direction={trends.financialRisk} upIsGood={false} />,
    },
    {
      icon: Clock, iconBg: "bg-purple-100", iconColor: "text-purple-700",
      label: "Hours Saved",
      value: `${hoursSaved} hrs`,
      valueColor: "text-purple-900",
      trend: <TrendArrow direction={trends.hoursSaved} upIsGood={true} />,
    },
  ];

  return (
    <header className="bg-white border-b border-slate-300 shadow-sm sticky top-0 z-40">
      <div className="flex items-center gap-4 px-5 py-3 min-w-0">

        {/* Government Emblem + Brand */}
        <div className="flex-shrink-0 flex items-center gap-3">
          <img src="/emblem-india.png" alt="Government of India" className="h-11 w-auto object-contain select-none" draggable={false} />
          <div className="h-10 w-px bg-slate-300" />
          <div>
            <div className="text-blue-800 font-extrabold text-lg leading-tight tracking-tight">DCIMS</div>
            <div className="text-xs text-slate-600 font-semibold whitespace-nowrap">Infrastructure Management</div>
          </div>
        </div>

        <div className="h-8 w-px bg-slate-300 flex-shrink-0" />

        {/* Project selector */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-slate-700 font-bold whitespace-nowrap">Site:</span>
          <select
            value={activeProjectId}
            onChange={(e) => setActiveProjectId(e.target.value)}
            className="bg-white text-sm text-slate-800 border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-semibold cursor-pointer transition-all shadow-sm"
          >
            <option value="PRJ-MUM-01">Navi Mumbai DC-1 (300 MW)</option>
            <option value="PRJ-NOI-02">Noida Data Park-3 (150 MW)</option>
            <option value="PRJ-PUN-03">Hinjawadi Edge-5 (50 MW)</option>
          </select>
        </div>

        <div className="h-8 w-px bg-slate-300 flex-shrink-0" />

        {/* KPI chips */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {kpis.map((kpi) => (
            <KpiChip key={kpi.label} {...kpi} />
          ))}
        </div>
      </div>
    </header>
  );
}
