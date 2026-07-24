"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSharedBrain } from "../context/SharedBrainContext";
import { Truck, AlertTriangle, RefreshCw, CheckCircle, MapPin, Navigation2, Package } from "lucide-react";

const DC_COORDS = {
  "PRJ-MUM-01": [19.076, 73.000],
  "PRJ-NOI-02": [28.614, 77.364],
  "PRJ-PUN-03": [18.591, 73.739],
};
const SHIPMENT_COORDS = {
  "PO-MUM-2026-004": [25.128, 121.739],
  "PO-NOI-2026-012": [24.996, 55.066],
  "PO-PUN-2026-088": [13.083, 80.299],
};

export default function SupplyChainAgent({ activeTab }) {
  const {
    shipments, activeProject, refreshAllStates, selectedShipment,
    setSelectedShipment, reroutedPoId, setReroutedPoId, apiBase, recordPmAction,
  } = useSharedBrain();

  const [isRerouting, setIsRerouting] = useState(false);
  const iframeRef = useRef(null);
  const mapReadyRef = useRef(false);

  const sendMapUpdate = () => {
    if (!iframeRef.current || !mapReadyRef.current || !shipments.length || !activeProject) return;
    const dcCoords = DC_COORDS[activeProject.id] || DC_COORDS["PRJ-MUM-01"];
    iframeRef.current.contentWindow.postMessage({
      type: "UPDATE_MAP",
      payload: {
        dcCoords,
        projectName: activeProject.name,
        tierRating: activeProject.tier_rating,
        capacityMw: activeProject.target_capacity_mw,
        shipments: shipments.map(s => ({
          id: s.id,
          coords: SHIPMENT_COORDS[s.id] || null,
          atRisk: !(reroutedPoId === s.id || s.status === "ON_TIME") && s.status === "AT_RISK",
          isSelected: selectedShipment && selectedShipment.id === s.id,
          name: s.item_name, po: s.po_number, location: s.current_location,
        })),
      },
    }, "*");
  };

  useEffect(() => {
    const handler = (e) => {
      if (!e.data?.type) return;
      if (e.data.type === "MAP_READY") { mapReadyRef.current = true; sendMapUpdate(); }
      if (e.data.type === "SELECT_SHIPMENT") {
        const s = shipments.find(x => x.id === e.data.id);
        if (s) setSelectedShipment(s);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [shipments, selectedShipment, reroutedPoId]);

  useEffect(() => { sendMapUpdate(); }, [shipments, selectedShipment, activeProject, reroutedPoId]);

  const handleReroute = async (id) => {
    setIsRerouting(true);
    try {
      const res = await fetch(`${apiBase}/supply-chain/reroute`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipment_id: id, alternative_supplier_name: "Alt-Vendor B (Pune Depot)" }),
      });
      if (res.ok) { setReroutedPoId(id); recordPmAction(4); await refreshAllStates(); }
    } catch (e) { console.error(e); } finally { setIsRerouting(false); }
  };

  const StatusBadge = ({ s }) => {
    const ok = reroutedPoId === s.id || s.status !== "AT_RISK";
    return ok
      ? <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">On Time</span>
      : <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 animate-pulse">At Risk</span>;
  };

  if (!selectedShipment) return (
    <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-400 shadow-sm">
      <Truck className="h-10 w-10 mx-auto mb-3 opacity-40" />
      <p className="text-sm">Loading shipment data...</p>
    </div>
  );

  const isRerouted = reroutedPoId === selectedShipment.id || selectedShipment.status === "ON_TIME";
  const activeStatus = isRerouted ? "ON_TIME" : selectedShipment.status;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
        <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center">
          <Truck className="h-5 w-5 text-pink-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Supply Chain</h2>
          <p className="text-sm text-slate-600 font-medium">Real-time equipment tracking across supplier tiers with risk alerts</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Shipment List */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-100 flex items-center gap-2">
            <Package className="h-4 w-4 text-slate-600" />
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Active Shipments</h3>
          </div>
          <div className="p-3 space-y-2">
            {shipments.map(s => {
              const isSel = selectedShipment.id === s.id;
              const sIsRerouted = reroutedPoId === s.id || s.status === "ON_TIME";
              return (
                <div
                  key={s.id}
                  onClick={() => setSelectedShipment(s)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all duration-200 ${
                    isSel
                      ? "border-blue-400 bg-blue-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <span className="text-sm font-semibold text-slate-800 leading-tight">{s.item_name}</span>
                    <StatusBadge s={s} />
                  </div>
                  <div className="text-xs text-slate-500 font-mono mb-1.5 flex justify-between">
                    <span>PO: {s.po_number}</span>
                    <span className="font-semibold">₹{s.cost_lakh}L</span>
                  </div>
                  <div className="text-xs text-slate-400 flex justify-between">
                    <span>T1: {s.tier1_supplier}</span>
                    <span className="truncate ml-1">T2: {s.tier2_supplier}</span>
                  </div>
                  {isSel && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-200 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-slate-400 mb-0.5">Committed</div>
                        <div className="font-semibold text-slate-700">{s.promised_delivery_date}</div>
                      </div>
                      <div>
                        <div className="text-slate-400 mb-0.5">Projected</div>
                        <div className={`font-semibold ${s.status === "AT_RISK" && !sIsRerouted ? "text-red-600" : "text-emerald-600"}`}>
                          {sIsRerouted ? s.promised_delivery_date : s.projected_delivery_date}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-100">
            <p className="text-xs text-slate-600 font-medium">Tier 2 monitoring tracks upstream sub-supplier risk</p>
          </div>
        </div>

        {/* Map + Detail Panel */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col" style={{ height: "520px" }}>
          {/* Map header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-100 shrink-0">
            <div className="flex items-center gap-2">
              <Navigation2 className="h-4 w-4 text-blue-700" />
              <h3 className="text-sm font-bold text-slate-800">Live Shipment Routes</h3>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-600 font-semibold">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />DC Site</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />At Risk</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />On Time</span>
            </div>
          </div>

          {/* Iframe map */}
          <iframe
            ref={iframeRef}
            src="/leaflet-map.html"
            style={{ flex: 1, width: "100%", border: "none", display: "block" }}
            onLoad={() => {}}
          />

          {/* ETA bar */}
          <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-100 shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-blue-600" />
              <span className="font-bold text-slate-800">{selectedShipment.item_name}</span>
              <span className="text-slate-600 font-medium">from {selectedShipment.current_location}</span>
            </div>
            <div className="text-sm">
              <span className="text-slate-700 font-semibold">ETA: </span>
              <span className={`font-bold ${activeStatus === "AT_RISK" ? "text-red-600" : "text-emerald-600"}`}>
                {isRerouted ? selectedShipment.promised_delivery_date : selectedShipment.projected_delivery_date}
              </span>
            </div>
          </div>

          {/* Reroute panel */}
          {activeStatus === "AT_RISK" && (
            <div className="px-4 py-3 border-t border-amber-200 bg-amber-50 shrink-0 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-1.5 text-sm font-bold text-amber-800 mb-0.5">
                  <AlertTriangle className="h-4 w-4" />
                  Alternative Supplier Available
                </div>
                <p className="text-sm text-amber-700">
                  Local depot ({activeProject?.city}) — 3-day lead time. Bypasses Tier-2 delay.
                </p>
              </div>
              <button
                disabled={isRerouting || isRerouted}
                onClick={() => handleReroute(selectedShipment.id)}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold text-sm px-4 py-2 rounded-xl transition-all flex items-center gap-2 shrink-0 shadow-sm"
              >
                {isRerouting
                  ? <><RefreshCw className="h-4 w-4 animate-spin" />Re-routing...</>
                  : isRerouted
                    ? <><CheckCircle className="h-4 w-4" />Re-routed</>
                    : <><RefreshCw className="h-4 w-4" />Re-route PO</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
