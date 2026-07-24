"use client";

import React from "react";
import { useSharedBrain } from "../context/SharedBrainContext";
import { Calendar, TrendingUp, TrendingDown, Users, CloudRain, CheckCircle, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

function TrendArrow({ direction, upIsGood }) {
  if (!direction || direction === "same") return null;
  const isGood = direction === "up" ? upIsGood : !upIsGood;
  const Icon = direction === "up" ? TrendingUp : TrendingDown;
  return <span className={`inline-flex items-center ml-1 ${isGood ? "text-emerald-500" : "text-red-500"}`}><Icon className="h-3.5 w-3.5" strokeWidth={2.5} /></span>;
}

const STATUS_META = {
  BLOCKED: { text: "text-red-700",    bg: "bg-red-100 border-red-300",    bar: "bg-red-500"    },
  "AT RISK": { text: "text-amber-700", bg: "bg-amber-100 border-amber-300", bar: "bg-amber-500"  },
  DELAYED:  { text: "text-orange-700", bg: "bg-orange-100 border-orange-300", bar: "bg-orange-400" },
  AHEAD:    { text: "text-blue-700",   bg: "bg-blue-100 border-blue-300",  bar: "bg-blue-500"   },
  "ON TIME":{ text: "text-emerald-700",bg: "bg-emerald-100 border-emerald-300", bar: "bg-emerald-500" },
};

export default function ScheduleRiskEngine() {
  const {
    activeProject, wbsTasks,
    monsoonSeverity, setMonsoonSeverity,
    laborShortageIndex, setLaborShortageIndex,
    getCostRiskExposure, nonConformances, shipments, metricTrends,
  } = useSharedBrain();

  const formatCurrency = (val) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    return `₹${(val / 100000).toFixed(2)} L`;
  };

  const getTaskStatus = (task) => {
    const isBlocked = nonConformances.some(n => n.status === "OPEN" && n.affected_task_id === task.id);
    if (isBlocked) return "BLOCKED";
    const base = task.base_duration ?? task.duration_days ?? 0;
    if (task.duration_days > base * 1.15) return "AT RISK";
    if (task.duration_days > base) return "DELAYED";
    if (task.duration_days < base) return "AHEAD";
    return "ON TIME";
  };

  const reworkCost     = nonConformances.filter(n => n.status === "OPEN").reduce((a, c) => a + c.rectification_cost_inr, 0);
  const ldCost         = (activeProject?.current_delay_days ?? 0) * (activeProject?.daily_ld_penalty_inr ?? 0);
  const shippingCost   = shipments.filter(s => s.status === "AT_RISK" && s.project_id === activeProject?.id).length * 650000;
  const totalRisk      = getCostRiskExposure();

  const leafTasks = wbsTasks.filter(t => t.duration_days != null);

  const chartData = leafTasks.slice(0, 10).map(t => ({
    name: (t.name || "").slice(0, 14),
    "Baseline": t.base_duration || t.duration_days,
    "Projected": t.duration_days,
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-sm">
        <p className="font-bold text-slate-800 mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }} className="font-medium">
            {p.name}: {p.value} days
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
          <Calendar className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Schedule & Risk</h2>
          <p className="text-sm text-slate-600 font-medium">Monitor critical path risks and cost exposure across the project schedule</p>
        </div>
      </div>

      {/* Top Row: Sliders + Cost Breakdown + Mitigations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Risk Simulation Sliders */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Site Risk Factors</h3>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <CloudRain className="h-4 w-4 text-blue-500" /> Monsoon Severity
              </span>
              <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full ${monsoonSeverity > 0.4 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                {(monsoonSeverity * 100).toFixed(0)}%
              </span>
            </div>
            <input type="range" min="0" max="1" step="0.05" value={monsoonSeverity}
              onChange={(e) => setMonsoonSeverity(parseFloat(e.target.value))} className="w-full" />
            <p className="text-xs text-slate-500">
              {monsoonSeverity > 0.4 ? "⚠ Heavy rain alerts active — outdoor civil works delayed." : "Normal conditions — minimal impact on schedule."}
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-500" /> Labour Shortage
              </span>
              <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full ${laborShortageIndex > 0.1 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                {(laborShortageIndex * 100).toFixed(0)}%
              </span>
            </div>
            <input type="range" min="0" max="1" step="0.05" value={laborShortageIndex}
              onChange={(e) => setLaborShortageIndex(parseFloat(e.target.value))} className="w-full" />
            <p className="text-xs text-slate-500">
              {laborShortageIndex > 0.1 ? "⚠ Skilled trade shortage — MEP productivity reduced." : "Labour pools stable — standard productivity rates."}
            </p>
          </div>
        </div>

        {/* Cost Risk Breakdown */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-3 mb-4">Cost Risk Breakdown</h3>
          <div className="space-y-3 flex-1">
            {[
              { label: "Rework & NCR Costs", value: reworkCost, trend: <TrendArrow direction={metricTrends?.ncrCount} upIsGood={false} /> },
              { label: "Delay Penalties (LD)", value: ldCost, trend: <TrendArrow direction={metricTrends?.delayDays} upIsGood={false} /> },
              { label: "Premium Freight", value: shippingCost },
            ].map((item, i) => (
              <div key={i} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                <span className="text-sm text-slate-600">{item.label}</span>
                <span className={`text-sm font-bold flex items-center ${item.value > 0 ? "text-red-600" : "text-slate-400"}`}>
                  {formatCurrency(item.value)}{item.trend}
                </span>
              </div>
            ))}
          </div>
          <div className="pt-3 mt-2 border-t border-slate-200 flex justify-between items-center">
            <span className="text-sm font-bold text-slate-700">Total Exposure</span>
            <span className={`text-lg font-extrabold flex items-center ${totalRisk > 0 ? "text-red-600" : "text-emerald-600"}`}>
              {formatCurrency(totalRisk)}
              <TrendArrow direction={metricTrends?.financialRisk} upIsGood={false} />
            </span>
          </div>
        </div>

        {/* Mitigations */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-3 mb-4">Recommended Actions</h3>
          <div className="flex-1 space-y-3 overflow-y-auto max-h-[220px] md:max-h-none">
            {nonConformances.length === 0 && (activeProject?.current_delay_days ?? 0) === 0 ? (
              <div className="flex items-center gap-2 py-4 text-emerald-600">
                <CheckCircle className="h-5 w-5 flex-shrink-0" />
                <span className="text-sm font-medium">Project on schedule — no actions required.</span>
              </div>
            ) : (
              <>
                {totalRisk > 10000000 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex gap-2.5">
                    <TrendingUp className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-bold text-blue-900">Deploy Modular Power Source</div>
                      <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">Bypass substation queue — saves up to 180 critical path days.</p>
                    </div>
                  </div>
                )}
                {nonConformances.some(n => n.spec_clause === "Vertiv-Clearance") && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2.5">
                    <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-bold text-amber-900">Adjust Server Row Spacing</div>
                      <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">Shift Row B forward 100mm to resolve rear clearance NCR.</p>
                    </div>
                  </div>
                )}
                {nonConformances.some(n => n.spec_clause === "Vertiv-CRV+-PipingLimit") && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2.5">
                    <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-sm font-bold text-amber-900">Source Local Piping Extension</div>
                      <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">Local depot sourcing reduces delay from 15 days to 2 days.</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Duration Comparison Chart */}
      {chartData.length > 0 && (
        <div className="bg-white border border-slate-300 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 bg-slate-100">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Schedule Baseline vs Projected</h3>
          </div>
          <div className="p-5">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barGap={2} barSize={14}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} unit=" d" width={44} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: "#64748B", paddingTop: 8 }} />
                <Bar dataKey="Baseline" fill="#CBD5E1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Projected" fill="#2563EB" radius={[4, 4, 0, 0]} label={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}


      {/* WBS Gantt Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Work Breakdown Structure</h3>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            {[
              { color: "bg-emerald-500", label: "On Time" },
              { color: "bg-amber-500", label: "At Risk" },
              { color: "bg-red-500", label: "Blocked" },
              { color: "bg-blue-500", label: "Ahead" },
            ].map(l => (
              <span key={l.label} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${l.color}`}></span>{l.label}
              </span>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[860px]">
            {/* Table Header */}
            <div className="grid grid-cols-12 bg-slate-100 border-b border-slate-300 px-5 py-2.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <div className="col-span-3">Task</div>
              <div className="col-span-1 text-center">Code</div>
              <div className="col-span-1 text-center">Base Days</div>
              <div className="col-span-1 text-center">Projected</div>
              <div className="col-span-1 text-center">Status</div>
              <div className="col-span-5 pl-4">Timeline</div>
            </div>

            {/* Task Rows */}
            <div className="divide-y divide-slate-100 max-h-[380px] md:max-h-none overflow-y-auto">
              {wbsTasks.map((task) => {
                const baseDays = task.base_duration ?? task.duration_days ?? 0;
                const isHeader = task.duration_days == null || isNaN(task.duration_days);
                const barW = !isHeader ? Math.min(100, (task.duration_days / 180) * 100) : 0;
                const baseW = !isHeader ? Math.min(100, (baseDays / 180) * 100) : 0;
                const delta = baseDays > 0 ? Math.round(((task.duration_days - baseDays) / baseDays) * 100) : 0;
                const status = !isHeader ? getTaskStatus(task) : null;
                const meta = status ? STATUS_META[status] || STATUS_META["ON TIME"] : null;

                return (
                  <div key={task.id}
                    className={`grid grid-cols-12 px-5 py-3 items-center text-sm transition-colors hover:bg-slate-50 ${isHeader ? "bg-slate-50/80 font-semibold" : ""}`}
                  >
                    <div className={`col-span-3 truncate ${isHeader ? "text-slate-900 font-semibold text-sm" : "text-slate-700 pl-4"}`}>
                      {!isHeader && <span className="text-slate-400 mr-1.5">└</span>}
                      {task.name}
                    </div>
                    <div className="col-span-1 text-center font-mono text-xs text-slate-500">{task.code}</div>
                    <div className="col-span-1 text-center font-mono text-slate-600">{isHeader ? "—" : baseDays}</div>
                    <div className="col-span-1 text-center font-mono flex items-center justify-center gap-1">
                      {isHeader ? "—" : (
                        <>
                          <span className={meta?.text ?? "text-slate-700"}>{task.duration_days}</span>
                          {delta !== 0 && (
                            <span className={`text-[10px] font-bold ${delta > 0 ? "text-red-500" : "text-blue-500"}`}>
                              {delta > 0 ? `+${delta}%` : `${delta}%`}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    <div className="col-span-1 flex justify-center">
                      {status && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta?.bg} ${meta?.text}`}>
                          {status}
                        </span>
                      )}
                    </div>
                    {/* Gantt Bar */}
                    <div className="col-span-5 pl-4 flex items-center">
                      {!isHeader ? (
                        <div className="w-full relative h-3">
                          <div className="absolute inset-0 bg-slate-100 rounded-full" style={{ width: `${baseW}%` }} />
                          <div className={`absolute inset-0 rounded-full transition-all duration-500 ${meta?.bar ?? "bg-emerald-500"}`}
                            style={{ width: `${barW}%`, opacity: 0.85 }} />
                        </div>
                      ) : (
                        <div className="w-full h-px bg-slate-200" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
