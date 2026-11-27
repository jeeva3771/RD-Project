import React, { useState } from "react";
import { BUCKETS } from "../utils/constants";

// newjob_flow change: Added Tailwind CSS styling to JobsBoard to match original UI
const JobsBoard = ({ jobs, onOpen, demo, setDemo, role, execs, setEx, ex, me, clientStep }) => {
  const [bk, setBk] = useState("all");
  const [day, setDay] = useState(null);

  const attn = (m) => m.buckets.some((k) => k !== "reviews" && k !== "cancelled");
  const count = (k) => jobs.filter((m) => m.buckets.includes(k)).length;
  
  const shown = day 
    ? jobs.filter((m) => m.due === day && m.stage !== "enquiry" && m.stage !== "closed")
    : bk === "all" 
      ? jobs.filter(attn) 
      : jobs.filter((m) => m.buckets.includes(bk));

  // Dummy data for KPIs and Week view for now (will aggregate from real jobs later)
  const money = jobs.reduce((a, m) => a + (m.amount || 0), 0);
  const overdue = jobs.filter((m) => m.due && new Date(m.due + "T00:00") < new Date() && m.stage !== "enquiry").length;
  const agedPacked = jobs.filter((m) => m.buckets.includes("packed") && (m.ageDays || 0) >= 2).length;
  const scores = jobs.filter((m) => m.score != null).map((m) => m.score);
  
  const TODAY = new Date();
  const dayIso = (n) => { const d = new Date(TODAY.getTime() + n * 86400000); return d.toISOString().slice(0, 10); };
  const week = Array.from({ length: 7 }, (_, i) => ({ 
    iso: dayIso(i), 
    d: new Date(TODAY.getTime() + i * 86400000), 
    jobs: jobs.filter((m) => m.due === dayIso(i) && m.stage !== "enquiry") 
  }));

  return (
    <div className="grid grid-cols-[260px_minmax(0,1fr)] gap-6 items-start">
      <aside className="sticky top-6 flex flex-col gap-1 p-3 rounded-2xl bg-white border border-gray-200 shadow-sm">
        <div className="flex justify-between items-baseline px-2 pt-1 pb-3">
          <b className="font-display text-lg">Jobs board</b>
          <span className="text-xs text-gray-500">{TODAY.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
        </div>
        <button 
          className={`flex items-center text-left border-l-4 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${bk === "all" ? "bg-indigo-600 text-white border-indigo-800" : "bg-gray-50 border-indigo-500 text-gray-800 hover:bg-gray-100"}`} 
          onClick={() => { setBk("all"); setDay(null); }}
        >
          <span className="text-[15px] mr-2">⚡</span>
          <span className="flex-1">Needs attention</span>
          <b className={`min-w-[28px] text-center rounded-lg px-1.5 py-0.5 ${bk === "all" ? "bg-white/20 text-white" : "bg-white"}`}>{jobs.filter(attn).length}</b>
        </button>
        
        {BUCKETS.map((x) => {
          const n = count(x.k);
          return (
            <button 
              key={x.k} 
              className={`flex items-center text-left border-l-4 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${bk === x.k ? "bg-indigo-600 text-white border-indigo-800" : "bg-gray-50 border-gray-300 text-gray-800 hover:bg-gray-100"} ${n === 0 ? "opacity-60" : ""}`} 
              onClick={() => { setBk(x.k); setDay(null); }}
            >
              <span className="text-[15px] mr-2">{x.icon}</span>
              <span className="flex-1">{x.t}</span>
              <b className={`min-w-[28px] text-center rounded-lg px-1.5 py-0.5 ${bk === x.k ? "bg-white/20 text-white" : "bg-white"}`}>{n}</b>
            </button>
          );
        })}
      </aside>

      <section className="flex flex-col gap-3 min-w-0">
        {clientStep}

        <div className="flex flex-wrap gap-2 items-center text-xs text-gray-500 mt-2">
          <span>{role && /executive/i.test(role) ? "Showing your enquiries and jobs." : "Showing all jobs, Admin & Manager see every executive."}</span>
        </div>

        {/* KPIs Section */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mt-1">
          <div className="p-3 rounded-xl bg-white border border-gray-200 cursor-pointer hover:border-indigo-400" onClick={() => setBk('today')}>
            <span className="block text-xs text-gray-500 font-semibold">🚚 Ready today</span>
            <b className="block font-display text-2xl mt-1">{count('today')}</b>
            <small className="text-[11px] text-gray-400">samples + orders</small>
          </div>
          <div className={`p-3 rounded-xl border cursor-pointer hover:border-red-400 ${overdue ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
            <span className="block text-xs text-gray-500 font-semibold">⏰ Overdue</span>
            <b className={`block font-display text-2xl mt-1 ${overdue ? 'text-red-700' : ''}`}>{overdue}</b>
            <small className="text-[11px] text-gray-400">past due date</small>
          </div>
          <div className={`p-3 rounded-xl border cursor-pointer hover:border-yellow-400 ${money ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-200'}`} onClick={() => setBk('collections')}>
            <span className="block text-xs text-gray-500 font-semibold">💰 Money awaited</span>
            <b className={`block font-display text-2xl mt-1 ${money ? 'text-yellow-800' : ''}`}>₹{money.toLocaleString('en-IN')}</b>
            <small className="text-[11px] text-gray-400">{count('pay')} advances · {count('collections')} collections</small>
          </div>
          <div className={`p-3 rounded-xl border cursor-pointer hover:border-red-400 ${agedPacked ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`} onClick={() => setBk('packed')}>
            <span className="block text-xs text-gray-500 font-semibold">📦 Packed, not picked</span>
            <b className={`block font-display text-2xl mt-1 ${agedPacked ? 'text-red-700' : ''}`}>{count('packed')}</b>
            <small className="text-[11px] text-gray-400">{agedPacked} waiting 2+ days</small>
          </div>
          <div className="p-3 rounded-xl bg-green-50 border border-green-200 cursor-pointer hover:border-green-400" onClick={() => { setBk('reviews'); setDay(null); }}>
            <span className="block text-xs text-green-700 font-semibold">⭐ Positive reviews</span>
            <b className="block font-display text-2xl mt-1 text-green-800">{count('reviews')}</b>
            <small className="text-[11px] text-green-600/80">4–5 stars · +50 bonus</small>
          </div>
          <div className="p-3 rounded-xl bg-white border border-gray-200">
            <span className="block text-xs text-gray-500 font-semibold">★ Avg job score</span>
            <b className="block font-display text-2xl mt-1">{scores.length ? Math.round(scores.reduce((a, x) => a + x, 0) / scores.length) : '—'}</b>
            <small className="text-[11px] text-gray-400">{scores.length} scored jobs</small>
          </div>
        </div>

        {/* Week View Section */}
        <div className="grid grid-cols-7 gap-2 mt-2">
          {week.map((w, i) => (
            <button 
              key={w.iso} 
              className={`p-2 rounded-xl border text-center flex flex-col items-center justify-between min-h-[74px] transition-colors ${i === 0 ? "border-indigo-600 bg-white" : "border-gray-200 bg-white hover:border-indigo-300"} ${day === w.iso ? "ring-2 ring-indigo-500 ring-offset-1" : ""}`}
              onClick={() => setDay(day === w.iso ? null : w.iso)}
            >
              <span className="block text-[11px] font-bold text-gray-500">{i === 0 ? 'Today · ' : ''}{w.d.toLocaleDateString('en-IN', { weekday: 'short' })}</span>
              <small className="text-[11px] text-gray-400">{w.d.getDate()} {w.d.toLocaleDateString('en-IN', { month: 'short' })}</small>
              <b className={`block font-display text-lg min-h-[22px] ${w.jobs.length ? "text-indigo-700" : ""}`}>{w.jobs.length || '–'}</b>
            </button>
          ))}
        </div>
        
        <div className="flex flex-col gap-2 mt-4">
          <div className="flex justify-between items-baseline">
            <b className="text-[15px]">{bk === "all" ? "⚡ Needs attention" : BUCKETS.find((b) => b.k === bk)?.t}</b>
            <span className="text-xs text-gray-500">{shown.length} jobs</span>
          </div>
          
          {shown.length === 0 && (
            <div className="p-8 text-center text-gray-400 border border-dashed border-gray-200 rounded-xl bg-white/50 mt-2">
              Nothing here. 🎉
            </div>
          )}
          
          <div className="grid gap-3 mt-1">
            {shown.map((m) => (
              <div 
                key={m.id} 
                className="p-4 border border-gray-200 rounded-xl shadow-sm cursor-pointer bg-white hover:border-indigo-500 transition-colors border-l-4 border-l-indigo-500" 
                onClick={() => onOpen(m)}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">{m.stage}</span>
                  <b className="text-sm">{m.id}</b>
                </div>
                <div className="text-[13px] mt-1"><b>{m.client}</b> · {m.product}</div>
                <div className="text-xs text-gray-500 mt-1">{m.note}</div>
                <div className="mt-3 flex gap-3 items-center text-xs text-gray-500">
                  <span className="ml-auto text-gray-400">{m.exec}</span>
                  <button className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-indigo-700">Open ➜</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default JobsBoard;
