"use client";

import React from "react";
import { LayoutDashboard, ShieldCheck, Calendar, Truck, ClipboardCheck, MessageSquare, ChevronLeft, ChevronRight } from "lucide-react";

const tabs = [
  { id: "dashboard",     name: "Overview",          icon: LayoutDashboard },
  { id: "compliance",    name: "Quality Compliance", icon: ShieldCheck     },
  { id: "schedule",      name: "Schedule & Risk",    icon: Calendar        },
  { id: "supply-chain",  name: "Supply Chain",       icon: Truck           },
  { id: "commissioning", name: "Commissioning",      icon: ClipboardCheck  },
  { id: "rfi-rag",       name: "Project Knowledge",  icon: MessageSquare   },
];

export default function Sidebar({ activeTab, setActiveTab, isOpen, onToggle }) {
  return (
    <aside className={`relative z-20 bg-white/95 backdrop-blur-sm border-r border-slate-300 flex flex-col justify-between shrink-0 shadow-md transition-all duration-300 ease-in-out ${isOpen ? "w-60" : "w-16"}`}>
      
      {/* Logo */}
      <div>
        <div className={`flex items-center border-b border-slate-300 transition-all duration-300 ${isOpen ? "px-4 py-3 gap-3" : "px-2 py-3 justify-center flex-col gap-2"}`}>
          {/* Emblem */}
          {isOpen ? (
            <>
              <img src="/emblem-india.png" alt="Government of India" className="h-10 w-auto object-contain select-none flex-shrink-0" draggable={false} />
              <div className="overflow-hidden flex-1 min-w-0">
                <span className="font-bold text-slate-900 text-base block leading-tight whitespace-nowrap">DCIMS</span>
                <span className="text-xs text-slate-600 font-semibold leading-tight block whitespace-nowrap">Infrastructure Management</span>
              </div>
              {/* Toggle — inside header when expanded */}
              <button
                onClick={onToggle}
                className="flex-shrink-0 w-7 h-7 rounded-lg border border-slate-300 bg-slate-100 hover:bg-blue-50 hover:border-blue-300 flex items-center justify-center text-slate-600 hover:text-blue-700 transition-all"
                title="Collapse sidebar"
              >
                <ChevronLeft style={{ width: 14, height: 14 }} />
              </button>
            </>
          ) : (
            <>
              <img src="/emblem-india.png" alt="Government of India" className="h-8 w-auto object-contain select-none" draggable={false} title="Government of India — DCIMS" />
              {/* Toggle — below emblem when collapsed */}
              <button
                onClick={onToggle}
                className="w-7 h-7 rounded-lg border border-slate-300 bg-slate-100 hover:bg-blue-50 hover:border-blue-300 flex items-center justify-center text-slate-600 hover:text-blue-700 transition-all"
                title="Expand sidebar"
              >
                <ChevronRight style={{ width: 14, height: 14 }} />
              </button>
            </>
          )}
        </div>

        {/* Nav */}
        <nav className={`py-3 space-y-0.5 ${isOpen ? "px-3" : "px-2"}`}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                title={!isOpen ? tab.name : undefined}
                className={`w-full flex items-center rounded-lg transition-all duration-150 text-left group relative
                  ${isOpen ? "gap-3 px-3 py-2.5 border-l-4" : "justify-center px-0 py-2.5 border-l-4"}
                  ${isActive
                    ? "bg-blue-50 text-blue-800 border-blue-600 font-semibold"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 border-transparent font-medium"
                  }`}
              >
                <Icon
                  style={{ width: 18, height: 18 }}
                  className={`flex-shrink-0 transition-colors ${isActive ? "text-blue-700" : "text-slate-500 group-hover:text-slate-700"}`}
                />
                {isOpen && (
                  <span className="text-sm truncate">{tab.name}</span>
                )}
                {/* Tooltip when collapsed */}
                {!isOpen && (
                  <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-50">
                    {tab.name}
                    <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-slate-900 rotate-45" />
                  </div>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      {isOpen ? (
        <div className="px-4 py-4 border-t border-slate-300 bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
            <span className="text-xs text-slate-700 font-bold">System Online</span>
          </div>
        </div>
      ) : (
        <div className="py-4 flex justify-center border-t border-slate-300">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="System Online" />
        </div>
      )}
    </aside>
  );
}
