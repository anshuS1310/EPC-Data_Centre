"use client";

import React, { useState } from "react";
import { useSharedBrain } from "../context/SharedBrainContext";
import { ClipboardCheck, FileText, CheckCircle, Circle, RefreshCw, Printer, Award } from "lucide-react";

export default function CommissioningCopilot() {
  const {
    activeProjectId, commissioning, refreshAllStates,
    commissioningLevel, setCommissioningLevel,
    showCertificate, setShowCertificate,
    certificateData, setCertificateData,
    apiBase, recordPmAction,
  } = useSharedBrain();

  const [isCompiling, setIsCompiling] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const activeLevelData = commissioning.find(c => c.level === commissioningLevel) || null;

  const passedCount = activeLevelData?.checklist?.filter(i => i.status === "PASS").length ?? 0;
  const totalCount  = activeLevelData?.checklist?.length ?? 0;
  const progress    = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;

  const toggleCheckItem = async (levelKey, itemId) => {
    setErrorMessage("");
    try {
      const res = await fetch(`${apiBase}/commissioning/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: levelKey, item_id: itemId }),
      });
      if (res.ok) { await refreshAllStates(); }
      else { const err = await res.json(); setErrorMessage(err.detail || "Verification blocked."); }
    } catch { setErrorMessage("Could not connect to backend."); }
  };

  const compileCertificate = async () => {
    setIsCompiling(true); setErrorMessage("");
    try {
      const res = await fetch(`${apiBase}/commissioning/certificate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: activeProjectId }),
      });
      if (res.ok) { const data = await res.json(); setCertificateData(data); setShowCertificate(true); }
    } catch { setErrorMessage("Failed to compile certificate."); } finally { setIsCompiling(false); }
  };

  const LEVELS = ["Level 1", "Level 2", "Level 3", "Level 4", "Level 5"];

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
          <ClipboardCheck className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Commissioning</h2>
          <p className="text-sm text-slate-600 font-medium">Level-by-level verification against Tier certification standards</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Checklist Panel */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">

          {/* Level Tabs */}
          <div className="px-5 py-3 border-b border-slate-200 bg-slate-100">
            <div className="flex flex-wrap gap-2">
              {commissioning.map((lvl) => {
                const isActive = commissioningLevel === lvl.level;
                const lvlPassed = lvl.checklist?.filter(i => i.status === "PASS").length ?? 0;
                const lvlTotal  = lvl.checklist?.length ?? 0;
                const lvlDone   = lvlTotal > 0 && lvlPassed === lvlTotal;
                return (
                  <button
                    key={lvl.level}
                    onClick={() => {
                      const prevIdx = LEVELS.indexOf(commissioningLevel);
                      const newIdx  = LEVELS.indexOf(lvl.level);
                      if (newIdx > prevIdx) recordPmAction(2);
                      setCommissioningLevel(lvl.level);
                      setErrorMessage("");
                    }}
                    className={`relative text-sm font-semibold px-4 py-2 rounded-xl border transition-all duration-150 flex items-center gap-1.5 ${
                      isActive
                        ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                        : "bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50"
                    }`}
                  >
                    {lvlDone && <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />}
                    {lvl.level}
                    <span className={`text-xs ${isActive ? "text-blue-200" : "text-slate-400"}`}>
                      {lvlPassed}/{lvlTotal}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Progress Bar */}
          {activeLevelData && (
            <div className="px-5 pt-4 pb-2">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-sm font-semibold text-slate-700">{activeLevelData.name}</span>
                <span className={`text-sm font-bold ${progress === 100 ? "text-emerald-600" : "text-blue-600"}`}>
                  {progress}% Complete
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${progress === 100 ? "bg-emerald-500" : "bg-blue-500"}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-slate-600 font-medium mt-2 leading-relaxed">{activeLevelData.description}</p>
            </div>
          )}

          {/* Error */}
          {errorMessage && (
            <div className="mx-5 mt-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 font-medium">
              {errorMessage}
            </div>
          )}

          {/* Checklist Items */}
          {activeLevelData && (
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 max-h-[300px] md:max-h-none mx-5 mb-4 mt-3 border border-slate-100 rounded-xl">
              {activeLevelData.checklist.map((item) => {
                const isPassed  = item.status === "PASS";
                const isBlocked = item.status?.includes("BLOCK");
                return (
                  <div key={item.id} className={`flex items-start gap-3 px-4 py-3 transition-colors ${isPassed ? "bg-emerald-50/40" : "bg-white hover:bg-slate-50"}`}>
                    <button
                      onClick={() => toggleCheckItem(commissioningLevel, item.id)}
                      className={`mt-0.5 flex-shrink-0 transition-colors ${isPassed ? "text-emerald-500" : "text-slate-300 hover:text-blue-400"}`}
                    >
                      {isPassed
                        ? <CheckCircle style={{ width: 18, height: 18 }} />
                        : <Circle style={{ width: 18, height: 18 }} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${isPassed ? "text-slate-500 line-through" : "text-slate-700"}`}>{item.description}</p>
                      {item.verified_value && (
                        <span className="text-xs text-blue-600 font-mono font-semibold mt-0.5 block">
                          Verified: {item.verified_value}
                        </span>
                      )}
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border flex-shrink-0 ${
                      isPassed   ? "bg-emerald-100 border-emerald-200 text-emerald-700"
                      : isBlocked ? "bg-red-100 border-red-200 text-red-700"
                      : "bg-slate-100 border-slate-200 text-slate-500"
                    }`}>
                      {item.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Actions */}
          <div className="px-5 py-4 border-t border-slate-200 bg-slate-100 flex justify-end">
            <button
              disabled={isCompiling}
              onClick={compileCertificate}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 shadow-sm hover:shadow-md"
            >
              {isCompiling
                ? <><RefreshCw className="h-4 w-4 animate-spin" />Compiling...</>
                : <><FileText className="h-4 w-4" />Generate Certificate</>}
            </button>
          </div>
        </div>

        {/* Certificate Panel */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-100 flex items-center gap-2">
            <Award className="h-4 w-4 text-indigo-500" />
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Certificate</h3>
          </div>

          {showCertificate && certificateData ? (
            <div className="flex-1 p-5 space-y-4 overflow-y-auto">
              {/* Certificate card */}
              <div className="border-2 border-indigo-200 rounded-2xl p-5 space-y-4 bg-gradient-to-b from-indigo-50 to-white relative overflow-hidden print:bg-white">
                {/* Decorative corner */}
                <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-100 rounded-bl-full opacity-60" />

                <div className="text-center space-y-1 relative">
                  <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-2">
                    <Award className="h-6 w-6 text-indigo-600" />
                  </div>
                  <h4 className="text-xs font-extrabold tracking-widest uppercase text-indigo-600">Acceptance Certificate</h4>
                  <h3 className="text-sm font-bold text-slate-900">Data Centre Commissioning</h3>
                  <div className="h-px bg-indigo-200 w-1/2 mx-auto mt-2" />
                </div>

                <div className="space-y-2.5 text-sm">
                  {[
                    ["Project", certificateData.project_name],
                    ["Location", `${certificateData.city}, India`],
                    ["Classification", `${certificateData.tier_rating} Topology`],
                    ["Standard", certificateData.commissioning_standard],
                    ["Status", certificateData.status],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-2">
                      <span className="text-slate-500 font-medium">{label}</span>
                      <span className={`font-bold text-right ${label === "Status" && certificateData.status?.includes("LOCKED") ? "text-red-600" : label === "Status" ? "text-emerald-600" : "text-slate-800"}`}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-slate-500 leading-relaxed border-t border-indigo-100 pt-3 italic">
                  This certifies that all integrated systems testing sequences have been completed and verified against specification requirements.
                </p>

                <div className="flex justify-between pt-3 border-t border-indigo-100">
                  <div className="text-center">
                    <div className="w-14 h-px bg-slate-300 mb-1" />
                    <span className="text-xs text-slate-400">Lead Engineer</span>
                  </div>
                  <div className="text-center">
                    <div className="w-14 h-px bg-slate-300 mb-1" />
                    <span className="text-xs text-slate-400">Auditor</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => window.print()}
                className="w-full flex items-center justify-center gap-2 text-sm text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 py-2.5 rounded-xl transition-all font-medium"
              >
                <Printer className="h-4 w-4" /> Print Certificate
              </button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-10 text-slate-400 px-5 text-center">
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <FileText className="h-7 w-7" />
              </div>
              <p className="text-sm font-medium text-slate-500">No certificate yet</p>
              <p className="text-xs text-slate-400 mt-1">Complete the checklist then click Generate Certificate</p>
            </div>
          )}

          <div className="px-4 py-3 border-t border-slate-200 bg-slate-100">
            <p className="text-xs text-slate-600 font-medium">Post-handover SLA baseline: Uptime Institute compliant</p>
          </div>
        </div>
      </div>
    </div>
  );
}
