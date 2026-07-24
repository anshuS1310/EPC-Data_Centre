"use client";

import React, { useState, useRef, useEffect } from "react";
import { useSharedBrain } from "../context/SharedBrainContext";
import { MessageSquare, Send, BookOpen, Clock } from "lucide-react";

const SUGGESTED_QUERIES = [
  "Rear clearance spec for Vertiv CR035?",
  "Can Prime generators be used for Tier III?",
  "Piping extension kit for 35m run?",
  "DPDP Act 2023 data localisation rules?",
];

export default function RfiKnowledgeAgent() {
  const { activeProjectId, chatHistory, setChatHistory, apiBase, recordPmAction } = useSharedBrain();
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isSearching]);

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    const userMsg = { role: "user", text: query };
    setChatHistory(prev => [...prev, userMsg]);
    setIsSearching(true);
    const activeQuery = query;
    setQuery("");
    try {
      const res = await fetch(`${apiBase}/rfi/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: activeQuery, project_id: activeProjectId }),
      });
      if (res.ok) {
        const data = await res.json();
        recordPmAction(1);
        setChatHistory(prev => [...prev, { role: "assistant", text: data.response, citation: data.citation, duplicates: data.duplicates }]);
      } else {
        setChatHistory(prev => [...prev, { role: "assistant", text: "Sorry, I encountered an error processing that query.", citation: null, duplicates: [] }]);
      }
    } catch {
      setChatHistory(prev => [...prev, { role: "assistant", text: "Could not connect. Please ensure the backend server is running.", citation: null, duplicates: [] }]);
    } finally {
      setIsSearching(false);
    }
  };

  const lastMsg = chatHistory[chatHistory.length - 1];
  const hasDuplicates = lastMsg?.duplicates?.length > 0;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
        <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
          <MessageSquare className="h-5 w-5 text-violet-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Project Knowledge</h2>
          <p className="text-sm text-slate-600 font-medium">Ask questions about specifications, standards, RFIs and project documents</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Chat Panel */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden" style={{ height: "520px" }}>

          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-100 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span className="text-sm font-bold text-slate-800">Knowledge Assistant</span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {chatHistory.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 py-8">
                <div className="w-14 h-14 rounded-full bg-violet-50 flex items-center justify-center mb-3">
                  <MessageSquare className="h-7 w-7 text-violet-400" />
                </div>
                <p className="text-sm font-semibold text-slate-600">Ask a question</p>
                <p className="text-xs text-slate-500 mt-1">Query specs, standards, RFIs, or regulations below</p>
              </div>
            )}
            {chatHistory.map((msg, index) => (
              <div key={index} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-br-sm"
                    : "bg-white border border-slate-200 text-slate-700 rounded-bl-sm"
                }`}>
                  <p>{msg.text}</p>
                  {msg.citation && (
                    <div className={`mt-2 pt-2 flex items-center gap-1.5 text-xs ${msg.role === "user" ? "border-t border-blue-500 text-blue-200" : "border-t border-slate-100 text-violet-600"}`}>
                      <BookOpen className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="font-medium">Source: </span>
                      <span className="underline cursor-pointer">{msg.citation}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isSearching && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2 shadow-sm">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  <span className="text-xs text-slate-400">Searching documents...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested queries */}
          <div className="px-4 py-2.5 bg-slate-100 border-t border-slate-200 shrink-0">
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-xs text-slate-700 font-bold mr-1">Try:</span>
              {SUGGESTED_QUERIES.map((q, i) => (
                <button key={i} type="button" onClick={() => setQuery(q)}
                  className="text-xs bg-white hover:bg-violet-50 text-violet-700 border border-violet-200 hover:border-violet-300 rounded-full px-3 py-1 transition-all font-medium">
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <form onSubmit={handleSearchSubmit} className="p-3 border-t border-slate-200 bg-white shrink-0 flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask about specifications, clearances, standards..."
              className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400 focus:bg-white transition-all"
            />
            <button type="submit" disabled={isSearching}
              className="bg-violet-600 hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400 text-white p-2.5 rounded-xl transition-all shadow-sm hover:shadow-md flex items-center justify-center">
              <Send style={{ width: 18, height: 18 }} />
            </button>
          </form>
        </div>

        {/* Duplicate RFI Panel */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-100 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Prior RFI Matches</h3>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {hasDuplicates ? (
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                  {lastMsg.duplicates.length} similar resolution{lastMsg.duplicates.length > 1 ? "s" : ""} found
                </div>
                {lastMsg.duplicates.map((rfi, idx) => (
                  <div key={idx} className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2 hover:border-violet-200 transition-all">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-sm font-bold text-slate-800 leading-tight">{rfi.id}: {rfi.title}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 flex-shrink-0">
                        {rfi.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 leading-relaxed">Query: {rfi.description}</p>
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-2.5">
                      <span className="text-xs font-bold text-blue-700 uppercase tracking-wide block mb-1">Resolution</span>
                      <p className="text-sm text-blue-800 leading-relaxed">{rfi.resolution}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-10 text-center text-slate-400">
                <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                  <BookOpen className="h-7 w-7" />
                </div>
                <p className="text-sm font-semibold text-slate-600">No matches yet</p>
                <p className="text-xs text-slate-500 mt-1">Prior RFI resolutions will appear here when relevant matches are found</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
