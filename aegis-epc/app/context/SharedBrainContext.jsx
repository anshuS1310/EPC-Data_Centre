"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";

const SharedBrainContext = createContext();

// Route all API calls through Next.js proxy (/backend/* → http://127.0.0.1:8000/*)
// This ensures the fetch works regardless of whether the browser accesses the
// site via localhost, 127.0.0.1, or a network IP like 172.25.x.x (WSL).
const API_BASE = "/backend/api";

// Default RFI greeting per site
const DEFAULT_CHAT = (siteName) => [
  {
    role: "assistant",
    text: `Hello! I am Aegis RFI Knowledge Copilot for ${siteName}. Ask me technical, layout, or compliance questions about this site.`,
    citation: null,
    duplicates: []
  }
];

export const SharedBrainProvider = ({ children }) => {
  // Core Project State
  const [activeProjectId, setActiveProjectId] = useState("PRJ-MUM-01");
  const [monsoonSeverity, setMonsoonSeverity] = useState(0.2);
  const [laborShortageIndex, setLaborShortageIndex] = useState(0.1);

  const [projects, setProjects] = useState({
    "PRJ-MUM-01": { id: "PRJ-MUM-01", name: "Navi Mumbai Hyperscale DC-1", target_capacity_mw: 300, current_capacity_mw: 150, city: "Mumbai", tier_rating: "Tier IV", daily_ld_penalty_inr: 1250000, base_duration_months: 18, start_date: "2026-01-15", current_delay_days: 0, dpdp_phase: "Active (2025)" },
    "PRJ-NOI-02": { id: "PRJ-NOI-02", name: "Noida Green Data Park-3", target_capacity_mw: 150, current_capacity_mw: 0, city: "Delhi NCR", tier_rating: "Tier III", daily_ld_penalty_inr: 800000, base_duration_months: 24, start_date: "2026-03-01", current_delay_days: 5, dpdp_phase: "Phased (2027)" },
    "PRJ-PUN-03": { id: "PRJ-PUN-03", name: "Hinjawadi Edge Node-5", target_capacity_mw: 50, current_capacity_mw: 15, city: "Pune", tier_rating: "Tier III", daily_ld_penalty_inr: 400000, base_duration_months: 12, start_date: "2026-05-10", current_delay_days: 0, dpdp_phase: "Phased (2027)" }
  });

  // Per-project live data states
  const [wbsTasks, setWbsTasks] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [commissioning, setCommissioning] = useState([]);
  const [nonConformances, setNonConformances] = useState([]);
  const [activeAlerts, setActiveAlerts] = useState([]);

  // Per-site session state (RFI chat, shipment, commissioning level)
  const [chatHistory, setChatHistory] = useState(DEFAULT_CHAT("Navi Mumbai Hyperscale DC-1"));
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [reroutedPoId, setReroutedPoId] = useState(null);
  const [commissioningLevel, setCommissioningLevel] = useState("Level 1");
  const [showCertificate, setShowCertificate] = useState(false);
  const [certificateData, setCertificateData] = useState(null);

  // Notification state
  const [toastMessage, setToastMessage] = useState(null);
  const [activeTriggerType, setActiveTriggerType] = useState(null);

  // ─── Metric trend tracking ────────────────────────────────────────────────
  const [metricTrends, setMetricTrends] = useState({
    financialRisk: 'same', hoursSaved: 'same', delayDays: 'same', ncrCount: 'same'
  });
  const prevMetricsRef = useRef(null);

  // ─── PM Action tracking (real AI-assisted actions) ────────────────────────
  // Each time an agent does real work (cascade, reroute, RFI answer, commissioning
  // test pass), we record it. PM Hours Saved = actions * avg_time_saved_per_action.
  const [pmActionsCount, setPmActionsCount] = useState(3); // 3 baseline actions on startup
  const recordPmAction = (count = 1) => setPmActionsCount(prev => prev + count);

  // ─── Per-site snapshot system ─────────────────────────────────────────────
  // Stored in refs so saving/restoring doesn't cause extra re-renders
  const snapshotsRef = useRef({});            // { [projectId]: snapshot }
  const visitedSitesRef = useRef(new Set(["PRJ-MUM-01"])); // Mumbai is pre-visited (initial load)
  const prevProjectIdRef = useRef("PRJ-MUM-01");
  const isSwitchingRef = useRef(false);        // guard against double-fetch on site switch

  // Mirror live state into a ref so we can read it synchronously during site switch
  const stateRef = useRef({
    wbsTasks: [], shipments: [], commissioning: [],
    nonConformances: [], activeAlerts: [],
    chatHistory: DEFAULT_CHAT("Navi Mumbai Hyperscale DC-1"),
    selectedShipment: null, reroutedPoId: null,
    commissioningLevel: "Level 1",
    showCertificate: false, certificateData: null,
    monsoonSeverity: 0.2, laborShortageIndex: 0.1,
  });

  useEffect(() => {
    stateRef.current = {
      wbsTasks, shipments, commissioning, nonConformances, activeAlerts,
      chatHistory, selectedShipment, reroutedPoId,
      commissioningLevel, showCertificate, certificateData,
      monsoonSeverity, laborShortageIndex,
    };
  }, [
    wbsTasks, shipments, commissioning, nonConformances, activeAlerts,
    chatHistory, selectedShipment, reroutedPoId,
    commissioningLevel, showCertificate, certificateData,
    monsoonSeverity, laborShortageIndex,
  ]);

  // Restore a snapshot object into all live state setters
  const applySnapshot = (snap) => {
    if (!snap) return;
    setWbsTasks(snap.wbsTasks ?? []);
    setShipments(snap.shipments ?? []);
    setCommissioning(snap.commissioning ?? []);
    setNonConformances(snap.nonConformances ?? []);
    setActiveAlerts(snap.activeAlerts ?? []);
    setChatHistory(snap.chatHistory ?? DEFAULT_CHAT(""));
    setSelectedShipment(snap.selectedShipment ?? null);
    setReroutedPoId(snap.reroutedPoId ?? null);
    setCommissioningLevel(snap.commissioningLevel ?? "Level 1");
    setShowCertificate(snap.showCertificate ?? false);
    setCertificateData(snap.certificateData ?? null);
    setMonsoonSeverity(snap.monsoonSeverity ?? 0.2);
    setLaborShortageIndex(snap.laborShortageIndex ?? 0.1);
  };

  // ─── Utility: fetch with retry ─────────────────────────────────────────────
  const fetchWithRetry = async (url, options = {}, retries = 4, delayMs = 3000) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, options);
        if (res.ok) return res;
        throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        const is5xx = err?.message?.startsWith('HTTP 5') || err?.message?.startsWith('HTTP 502') || err?.message?.startsWith('HTTP 504');
        const isNetworkErr = [
          'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND',
          'Failed to fetch', 'socket hang up', 'NetworkError',
        ].some(code => err?.message?.includes(code) || err?.code === code);
        
        const isRetryable = is5xx || isNetworkErr;
        if (attempt === retries || !isRetryable) throw err;
        console.warn(`[retry ${attempt}/${retries}] ${url} — ${err.message}. Waiting ${delayMs}ms...`);
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  };

  // ─── Health check: wait for backend to be ready ──────────────────────────
  // Polls the lightweight /api/health endpoint (no DB access, instant response)
  // instead of the heavy /api/orchestrator/alerts. Timeout is 180s to handle
  // Render free-tier cold starts which can take 60-90s to spin up.
  const waitForBackend = async (maxWaitMs = 180000, intervalMs = 3000) => {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      try {
        // 20s per-poll timeout — Render free tier is slow on first wake
        const res = await fetch(`${API_BASE}/health`, {
          signal: AbortSignal.timeout(20000),
        });
        if (res.ok) {
          console.info(`Backend ready after ${((Date.now() - start) / 1000).toFixed(1)}s`);
          return true;
        }
      } catch (err) {
        console.info(`Backend not ready yet (${err.message}) — retrying in ${intervalMs}ms...`);
      }
      await new Promise(r => setTimeout(r, intervalMs));
    }
    return false; // timed out
  };

  // ─── Parallel state fetch from backend ────────────────────────────────────
  const refreshAllStates = async () => {
    const [wbsRes, shipmentsRes, commRes, ncrRes, alertsRes] = await Promise.allSettled([
      fetchWithRetry(`${API_BASE}/schedule/wbs`),
      fetchWithRetry(`${API_BASE}/supply-chain/shipments`),
      fetchWithRetry(`${API_BASE}/commissioning/checklist`),
      fetchWithRetry(`${API_BASE}/compliance/export-ncr`),
      fetchWithRetry(`${API_BASE}/orchestrator/alerts`),
    ]);

    if (wbsRes.status === "fulfilled" && wbsRes.value?.ok)
      setWbsTasks(await wbsRes.value.json());
    else console.warn("Failed to fetch WBS after retries");

    if (shipmentsRes.status === "fulfilled" && shipmentsRes.value?.ok)
      setShipments(await shipmentsRes.value.json());
    else console.warn("Failed to fetch shipments after retries");

    if (commRes.status === "fulfilled" && commRes.value?.ok)
      setCommissioning(await commRes.value.json());
    else console.warn("Failed to fetch commissioning after retries");

    if (ncrRes.status === "fulfilled" && ncrRes.value?.ok)
      setNonConformances(await ncrRes.value.json());
    else console.warn("Failed to fetch NCRs after retries");

    if (alertsRes.status === "fulfilled" && alertsRes.value?.ok)
      setActiveAlerts(await alertsRes.value.json());
    else console.warn("Failed to fetch alerts after retries");
  };

  // ─── Startup: wait for backend then load initial data ───────────────────
  const [backendReady, setBackendReady] = useState(false);

  useEffect(() => {
    const initStartup = async () => {
      console.info("Waiting for backend (Render free tier may take 60-90s to wake up)...");
      const ready = await waitForBackend(180000, 3000);
      setBackendReady(true); // show UI regardless — if backend timed out, data fetches will use fallback
      if (ready) {
        console.info("Backend ready — loading project data.");
        try {
          await fetch(`${API_BASE}/orchestrator/clear`, { method: "POST" });
        } catch (err) {
          console.warn("Startup clear skipped:", err);
        }
        await refreshAllStates();
      } else {
        console.warn("Backend did not respond in time — running in offline mode with default data.");
      }
    };
    initStartup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Site switch handler ───────────────────────────────────────────────────
  useEffect(() => {
    const prevId = prevProjectIdRef.current;
    if (prevId === activeProjectId) return; // no actual switch

    isSwitchingRef.current = true;

    // 1. Save outgoing site's current state as a snapshot
    snapshotsRef.current[prevId] = { ...stateRef.current };

    // 2. Update tracking
    prevProjectIdRef.current = activeProjectId;

    const newSiteName = projects[activeProjectId]?.name ?? activeProjectId;

    if (visitedSitesRef.current.has(activeProjectId)) {
      // ── Returning to a previously visited site ───────────────────────────
      const snap = snapshotsRef.current[activeProjectId];
      if (snap) {
        applySnapshot(snap);
        // Notify the user their prior session is restored
        setToastMessage({
          title: `🔄 Session Restored — ${newSiteName}`,
          text: "Your previous work on this site has been restored. NCRs, alerts and settings are intact.",
          type: "success",
        });
        setTimeout(() => setToastMessage(null), 5000);
      }
      isSwitchingRef.current = false;
    } else {
      // ── First visit to this site — load fresh default state ──────────────
      visitedSitesRef.current.add(activeProjectId);

      // Reset RFI chat for new site
      setChatHistory(DEFAULT_CHAT(newSiteName));
      setReroutedPoId(null);
      setSelectedShipment(null);
      setCommissioningLevel("Level 1");
      setShowCertificate(false);
      setCertificateData(null);
      setMonsoonSeverity(0.2);
      setLaborShortageIndex(0.1);

      const initNewSite = async () => {
        try {
          await fetch(`${API_BASE}/orchestrator/clear`, { method: "POST" });
        } catch (err) {
          console.warn("Site switch clear failed:", err);
        }
        await refreshAllStates();
        isSwitchingRef.current = false;

        setToastMessage({
          title: `🌐 Switched to ${newSiteName}`,
          text: "Fresh site data loaded. All agents re-synced to this project context.",
          type: "success",
        });
        setTimeout(() => setToastMessage(null), 5000);
      };
      initNewSite();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  // ─── Expose visitedSites for UI badges ────────────────────────────────────
  // We expose a simple derived value that re-renders only when activeProjectId changes
  const siteStatus = (projectId) => {
    if (!visitedSitesRef.current.has(projectId)) return "UNVISITED";
    const snap = snapshotsRef.current[projectId];
    if (!snap) return "LIVE";
    const hasChanges = (snap.nonConformances?.length ?? 0) > 0 || (snap.activeAlerts?.length ?? 0) > 0;
    return hasChanges ? "MODIFIED" : "LIVE";
  };

  // ─── Slider → backend CPM update (debounced) ─────────────────────────────
  useEffect(() => {
    if (isSwitchingRef.current) return; // skip while restoring a snapshot
    const updateSliderImpact = async () => {
      try {
        const res = await fetch(`${API_BASE}/schedule/update-impact`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            monsoon_severity: monsoonSeverity,
            labor_shortage: laborShortageIndex,
            project_id: activeProjectId
          })
        });
        if (res.ok) {
          const data = await res.json();
          setWbsTasks(data);
        }
      } catch (err) {
        console.warn("Failed to post schedule update-impact:", err);
      }
    };
    const timer = setTimeout(updateSliderImpact, 450);
    return () => clearTimeout(timer);
  }, [monsoonSeverity, laborShortageIndex, activeProjectId]);

  // ─── WBS delay auto-compute ───────────────────────────────────────────────
  useEffect(() => {
    if (wbsTasks.length === 0) return;
    const handoverTask = wbsTasks.find(t => t.id === 49806);
    if (handoverTask && handoverTask.early_finish) {
      const delay = Math.max(0, handoverTask.early_finish - 225);
      setProjects(prev => ({
        ...prev,
        [activeProjectId]: { ...prev[activeProjectId], current_delay_days: delay }
      }));
    }
  }, [wbsTasks]);

  // ─── Metric trend computation ─────────────────────────────────────────────
  // Runs whenever any source metric changes; compares to previous snapshot
  // NOTE: uses projects[activeProjectId] directly — activeProject const is declared
  // later in the file and cannot be referenced here (temporal dead zone).
  useEffect(() => {
    const proj = projects[activeProjectId];
    if (!proj) return;
    const rework = nonConformances
      .filter(n => n.status === "OPEN" && n.project_id === activeProjectId)
      .reduce((s, n) => s + (n.rectification_cost_inr || 0), 0);
    const penalty = (proj.current_delay_days || 0) * (proj.daily_ld_penalty_inr || 0);
    const shipping = shipments.filter(s => s.project_id === activeProjectId && s.status === "AT_RISK").length * 650000;
    const current = {
      financialRisk: rework + penalty + shipping,
      ncrCount:      nonConformances.length,
      delayDays:     proj.current_delay_days || 0,
      hoursSaved:    parseFloat(((nonConformances.length + activeAlerts.length + 3) * 3.97).toFixed(1)),
    };
    const prev = prevMetricsRef.current;
    if (prev !== null) {
      const dir = (key) => {
        if (current[key] > prev[key]) return 'up';
        if (current[key] < prev[key]) return 'down';
        return 'same';
      };
      setMetricTrends({
        financialRisk: dir('financialRisk'),
        ncrCount:      dir('ncrCount'),
        delayDays:     dir('delayDays'),
        hoursSaved:    dir('hoursSaved'),
      });
    }
    prevMetricsRef.current = current;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonConformances, shipments, activeAlerts, projects, activeProjectId]);

  // Auto-select first shipment when loaded
  useEffect(() => {
    if (!selectedShipment && shipments.length > 0) {
      setSelectedShipment(shipments[0]);
    }
  }, [shipments, selectedShipment]);

  // ─── Cascade trigger ──────────────────────────────────────────────────────
  const triggerEventCascade = async (event) => {
    setActiveTriggerType(event.type);

    if (event.type === "CLEAR_ALL_NCR") {
      try {
        const res = await fetch(`${API_BASE}/orchestrator/clear`, { method: "POST" });
        if (res.ok) {
          await refreshAllStates();
          // Also wipe the current site's snapshot of alerts/NCRs
          if (snapshotsRef.current[activeProjectId]) {
            snapshotsRef.current[activeProjectId].nonConformances = [];
            snapshotsRef.current[activeProjectId].activeAlerts = [];
          }
          setToastMessage({
            title: "✅ System Reset Complete",
            text: "All active non-conformances cleared. Graph database restored to baseline.",
            type: "success"
          });
        }
      } catch (err) {
        setNonConformances([]);
        setActiveAlerts([]);
      } finally {
        setActiveTriggerType(null);
        setTimeout(() => setToastMessage(null), 5000);
      }
      return;
    }

    const payload = {
      model_name: "CR035",
      clearance_front_mm: 600,
      clearance_rear_mm: 600,
      piping_length_m: 25,
      generator_rating: "Continuous",
      project_id: activeProjectId
    };

    let titleText = "";
    if (event.type === "CLEARANCE_VIOLATION") {
      payload.clearance_rear_mm = 500;
      titleText = "Vertiv CRV+ Rear Clearance Mismatch (500mm < 600mm)";
    } else if (event.type === "PIPING_VIOLATION") {
      payload.piping_length_m = 35;
      titleText = "Vertiv CR035 Piping Limit Exceeded (35m > 30m)";
    } else if (event.type === "GENERATOR_VIOLATION") {
      payload.generator_rating = "Prime";
      titleText = "Generator Prime Rating Standard Violation";
    }

    try {
      const res = await fetch(`${API_BASE}/compliance/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        const stepCount = data?.cascade_trace?.steps?.length ?? 0;
        recordPmAction(Math.max(3, stepCount)); // each cascade step = 1 PM action saved
        setToastMessage({
          title: "⚡ Cross-Agent Cascade Triggered",
          text: `${titleText}. Risk signal propagated across Quality, Schedule, Supply Chain & RFI agents!`,
          type: "warning",
          cascadeSteps: stepCount
        });
        refreshAllStates();
      }
    } catch (err) {
      console.error("Failed to post validate cascade:", err);
      setToastMessage({
        title: "❌ Cascade Failed",
        text: "Could not reach backend. Please ensure the API server is running.",
        type: "error"
      });
    } finally {
      setActiveTriggerType(null);
      setTimeout(() => setToastMessage(null), 6000);
    }
  };

  // ─── Computed helpers ────────────────────────────────────────────────
  // Dynamic capacity: reflects real commissioning progress (MW online)
  const COMMISSIONING_CAPACITY_RATIO = {
    "Level 1": 0.0, "Level 2": 0.15, "Level 3": 0.35, "Level 4": 0.65, "Level 5": 1.0,
  };
  const capacityRatio  = COMMISSIONING_CAPACITY_RATIO[commissioningLevel] ?? 0;
  // Rerouted POs unlock +5% additional capacity (supply chain resolved)
  const rerouteBonus   = reroutedPoId ? 0.05 : 0;
  const finalRatio     = Math.min(1.0, capacityRatio + rerouteBonus);

  const rawProject     = projects[activeProjectId];
  const activeProject  = rawProject ? {
    ...rawProject,
    current_capacity_mw: Math.round(rawProject.target_capacity_mw * finalRatio),
  } : rawProject;

  const getCostRiskExposure = () => {
    let reworkCost = 0;
    nonConformances.forEach(ncr => {
      if (ncr.status === "OPEN" && ncr.project_id === activeProjectId) {
        reworkCost += ncr.rectification_cost_inr || 0;
      }
    });
    const penaltyCost = activeProject.current_delay_days * activeProject.daily_ld_penalty_inr;
    let shippingPremium = 0;
    shipments.forEach(s => {
      if (s.project_id === activeProjectId && s.status === "AT_RISK") {
        shippingPremium += 650000;
      }
    });
    return reworkCost + penaltyCost + shippingPremium;
  };

  const getHoursSaved = () => {
    // Each tracked AI action saves ~4 hours of manual coordination effort.
    // NCR auto-detections (+3h each), cascade propagations (+5h each),
    // RFI answers (+2h each), commissioning verifications (+1.5h each).
    const ncrHours      = nonConformances.length * 3.2;   // auto-detected NCRs
    const alertHours    = activeAlerts.length * 2.5;       // cross-agent alerts
    const actionHours   = pmActionsCount * 2.8;            // direct PM actions
    return (ncrHours + alertHours + actionHours).toFixed(1);
  };



  // ─── Auto-refresh: keep all data current every 90 seconds ─────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isSwitchingRef.current) refreshAllStates();
    }, 90000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SharedBrainContext.Provider value={{
      activeProjectId,
      setActiveProjectId,
      monsoonSeverity,
      setMonsoonSeverity,
      laborShortageIndex,
      setLaborShortageIndex,
      activeProject,
      projects,
      wbsTasks,
      shipments,
      commissioning,
      nonConformances,
      activeAlerts,
      triggerEventCascade,
      toastMessage,
      setToastMessage,
      activeTriggerType,
      getCostRiskExposure,
      getHoursSaved,
      refreshAllStates,
      metricTrends,
      pmActionsCount,
      recordPmAction,
      chatHistory,
      setChatHistory,
      selectedShipment,
      setSelectedShipment,
      reroutedPoId,
      setReroutedPoId,
      commissioningLevel,
      setCommissioningLevel,
      showCertificate,
      setShowCertificate,
      certificateData,
      setCertificateData,
      siteStatus,
      apiBase: API_BASE,
      backendReady,
    }}>
      {children}
    </SharedBrainContext.Provider>
  );
};

export const useSharedBrain = () => useContext(SharedBrainContext);
