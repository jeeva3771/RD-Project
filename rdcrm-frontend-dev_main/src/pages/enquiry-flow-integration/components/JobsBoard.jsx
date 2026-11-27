import React, { useState, useEffect, useCallback, useRef } from "react";
import { BUCKETS } from "../utils/constants";
import { axiosInstance } from "../../../utils/url/config";
import { mapJobToBoardCard } from "../utils/helpers";
import { useLoader } from "../../../context/LoaderContext";

const getPageNumbers = (current, total) => {
  const safeTotal = Math.max(1, total || 1);
  if (safeTotal <= 5) {
    return Array.from({ length: safeTotal }, (_, i) => i + 1);
  }
  const pages = [];
  if (current <= 3) {
    pages.push(1, 2, 3, 4, "...", safeTotal);
  } else if (current >= safeTotal - 2) {
    pages.push(1, "...", safeTotal - 3, safeTotal - 2, safeTotal - 1, safeTotal);
  } else {
    pages.push(1, "...", current - 1, current, current + 1, "...", safeTotal);
  }
  return pages;
};

export const STAGES = [
  { k: 'enquiry', t: 'Enquiry', c: '#4F46E5', bg: '#EEF2FF', ink: '#4338CA', icon: '📝' },
  { k: 'sample', t: 'Sample', c: '#EAB308', bg: '#FEF9C3', ink: '#854D0E', icon: '🧪' },
  { k: 'production', t: 'Production', c: '#0D9488', bg: '#CCFBF1', ink: '#0F766E', icon: '🏭' },
  { k: 'packing', t: 'Packing', c: '#10B981', bg: '#D1FAE5', ink: '#065F46', icon: '📦' },
  { k: 'dispatch', t: 'Dispatch', c: '#F43F5E', bg: '#FFE4E6', ink: '#9F1239', icon: '🚚' },
  { k: 'dtp', t: 'DTP', c: '#8B5CF6', bg: '#EDE9FE', ink: '#6D28D9', icon: '🖋️' },
  { k: 'aftersales', t: 'After-sales', c: '#0EA5E9', bg: '#E0F2FE', ink: '#0369A1', icon: '🛎️' },
  { k: 'collections', t: 'Collections', c: '#D97706', bg: '#FEF3C7', ink: '#92400E', icon: '💰' },
  { k: 'closed', t: 'Completed', c: '#10B981', bg: '#D1FAE5', ink: '#065F46', icon: '🏁' },
  { k: 'cancelled', t: 'Cancelled', c: '#6B7280', bg: '#F3F4F6', ink: '#374151', icon: '✕' }
];

const stageOf = (k) => STAGES.find((x) => x.k === k) || STAGES[0];

const dueTxt = (iso) => {
  if (!iso) return "—";
  const d = Math.round((new Date(iso + "T00:00") - new Date()) / 86400000);
  return d < 0 ? `${-d} day${d < -1 ? "s" : ""} overdue` : d === 0 ? "Today" : d === 1 ? "Tomorrow" : `in ${d} days`;
};

// newjob_flow change: Added Tailwind CSS styling to JobsBoard to match original UI
const JobsBoard = ({ jobs: initialJobs = [], onOpen, demo, setDemo, role, execs, setEx, ex, me, clientStep, refreshKey }) => {
  const [bk, setBk] = useState("all");
  const [day, setDay] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [serverJobs, setServerJobs] = useState([]);
  const [totalJobs, setTotalJobs] = useState(0);
  const [bucketCounts, setBucketCounts] = useState({});
  const [kpis, setKpis] = useState({ money: 0, overdue: 0, agedPacked: 0, avgScore: null, scoresCount: 0 });
  const [serverWeek, setServerWeek] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const reqIdRef = useRef(0);
  const lastFetchedParamsRef = useRef("");
  const { showLoader, hideLoader } = useLoader();

  // Debounce search query to avoid hammering server on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch paginated jobs from backend API
  const fetchPaginatedJobs = useCallback(async () => {
    const trimmedSearch = (debouncedSearch || "").trim();
    const queryKey = `${page}|${pageSize}|${bk}|${day || ""}|${trimmedSearch}`;
    if (lastFetchedParamsRef.current === queryKey) return;
    lastFetchedParamsRef.current = queryKey;

    const currentReqId = ++reqIdRef.current;
    setLoading(true);
    const isSearching = Boolean(trimmedSearch);
    if (!isSearching) setServerJobs([]); // Only clear cards on bucket/page switch, not while typing search
    if (!isSearching && showLoader) showLoader();
    try {
      const res = await axiosInstance.get("/enquiry-flow-integration", {
        params: {
          page,
          limit: pageSize,
          bucket: bk,
          day: day || undefined,
          search: trimmedSearch || undefined,
        },
      });
      if (currentReqId !== reqIdRef.current) return;
      if (res.data?.success) {
        const rawList = res.data.data || [];
        const mapped = rawList.map(mapJobToBoardCard);
        setServerJobs(mapped);
        setTotalJobs(res.data.total ?? mapped.length);
        if (res.data.bucketCounts) {
          setBucketCounts(res.data.bucketCounts);
        }
        if (res.data.kpis) {
          setKpis(res.data.kpis);
        }
        if (res.data.week) {
          setServerWeek(res.data.week);
        }
      }
    } catch (err) {
      if (currentReqId === reqIdRef.current) {
        console.error("Failed to fetch jobs board page:", err);
      }
    } finally {
      if (currentReqId === reqIdRef.current) {
        setLoading(false);
        if (!isSearching && hideLoader) hideLoader();
      }
    }
  }, [page, pageSize, bk, day, debouncedSearch, showLoader, hideLoader]);

  useEffect(() => {
    return () => {
      if (hideLoader) hideLoader();
    };
  }, [hideLoader]);

  useEffect(() => {
    lastFetchedParamsRef.current = "";
    fetchPaginatedJobs();
  }, [fetchPaginatedJobs, refreshKey]);

  const count = (k) => (bucketCounts[k] !== undefined ? bucketCounts[k] : 0);
  const attnCount = bucketCounts.all !== undefined ? bucketCounts.all : count("enquiry");

  const totalJobPages = Math.ceil(totalJobs / pageSize);
  const safeTotalJobPages = Math.max(1, totalJobPages || 1);
  const safeJobPage = Math.min(Math.max(page, 1), safeTotalJobPages);
  const startJobIndex = (safeJobPage - 1) * pageSize;

  const TODAY = new Date();
  const dayIso = (n) => { const d = new Date(TODAY.getTime() + n * 86400000); return d.toISOString().slice(0, 10); };
  const week = Array.from({ length: 7 }, (_, i) => {
    const iso = dayIso(i);
    const found = (serverWeek || []).find((w) => w.iso === iso);
    return {
      iso,
      d: new Date(TODAY.getTime() + i * 86400000),
      count: found ? found.count : 0,
    };
  });

  return (
    <div className="grid grid-cols-[260px_minmax(0,1fr)] gap-6 items-start">
      <aside className="sticky top-6 flex flex-col gap-1 p-3 rounded-2xl bg-white border border-gray-200 shadow-sm">
        <div className="flex justify-between items-baseline px-2 pt-1 pb-3">
          <b className="font-display text-lg">Jobs board</b>
          <span className="text-xs text-gray-500">{TODAY.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
        </div>
        <button
          className={`flex items-center text-left border-l-4 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${bk === "all" ? "bg-indigo-600 text-white border-indigo-800" : "bg-gray-50 border-indigo-500 text-gray-800 hover:bg-gray-100"}`}
          onClick={() => { setBk("all"); setDay(null); setPage(1); }}
        >
          <span className="text-[15px] mr-2">⚡</span>
          <span className="flex-1">Needs attention</span>
          <b className={`min-w-[28px] text-center rounded-lg px-1.5 py-0.5 ${bk === "all" ? "bg-white/20 text-white" : "bg-white"}`}>{attnCount}</b>
        </button>

        {BUCKETS.map((x) => {
          const n = count(x.k);
          return (
            <button
              key={x.k}
              className={`flex items-center text-left border-l-4 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${bk === x.k ? "bg-indigo-600 text-white border-indigo-800" : "bg-gray-50 border-gray-300 text-gray-800 hover:bg-gray-100"} ${n === 0 ? "opacity-60" : ""}`}
              onClick={() => { setBk(x.k); setDay(null); setPage(1); }}
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
          <div className="p-3 rounded-xl bg-white border border-gray-200 cursor-pointer hover:border-indigo-400" onClick={() => { setBk('today'); setDay(null); setPage(1); }}>
            <span className="block text-xs text-gray-500 font-semibold">🚚 Ready today</span>
            <b className="block font-display text-2xl mt-1">{count('today')}</b>
            <small className="text-[11px] text-gray-400">samples + orders</small>
          </div>
          <div className={`p-3 rounded-xl border cursor-pointer hover:border-red-400 ${kpis.overdue ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
            <span className="block text-xs text-gray-500 font-semibold">⏰ Overdue</span>
            <b className={`block font-display text-2xl mt-1 ${kpis.overdue ? 'text-red-700' : ''}`}>{kpis.overdue}</b>
            <small className="text-[11px] text-gray-400">past due date</small>
          </div>
          <div className={`p-3 rounded-xl border cursor-pointer hover:border-yellow-400 ${kpis.money ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-200'}`} onClick={() => { setBk('collections'); setDay(null); setPage(1); }}>
            <span className="block text-xs text-gray-500 font-semibold">💰 Money awaited</span>
            <b className={`block font-display text-2xl mt-1 ${kpis.money ? 'text-yellow-800' : ''}`}>₹{kpis.money.toLocaleString('en-IN')}</b>
            <small className="text-[11px] text-gray-400">{count('pay')} advances · {count('collections')} collections</small>
          </div>
          <div className={`p-3 rounded-xl border cursor-pointer hover:border-red-400 ${kpis.agedPacked ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`} onClick={() => { setBk('packed'); setDay(null); setPage(1); }}>
            <span className="block text-xs text-gray-500 font-semibold">📦 Packed, not picked</span>
            <b className={`block font-display text-2xl mt-1 ${kpis.agedPacked ? 'text-red-700' : ''}`}>{count('packed')}</b>
            <small className="text-[11px] text-gray-400">{kpis.agedPacked} waiting 2+ days</small>
          </div>
          <div className="p-3 rounded-xl bg-green-50 border border-green-200 cursor-pointer hover:border-green-400" onClick={() => { setBk('reviews'); setDay(null); setPage(1); }}>
            <span className="block text-xs text-green-700 font-semibold">⭐ Positive reviews</span>
            <b className="block font-display text-2xl mt-1 text-green-800">{count('reviews')}</b>
            <small className="text-[11px] text-green-600/80">4–5 stars · +50 bonus</small>
          </div>
          <div className="p-3 rounded-xl bg-white border border-gray-200">
            <span className="block text-xs text-gray-500 font-semibold">★ Avg job score</span>
            <b className="block font-display text-2xl mt-1">{kpis.avgScore != null ? kpis.avgScore : '—'}</b>
            <small className="text-[11px] text-gray-400">{kpis.scoresCount || 0} scored jobs</small>
          </div>
        </div>

        {/* Week View Section */}
        <div className="grid grid-cols-7 gap-2 mt-2">
          {week.map((w, i) => (
            <button
              key={w.iso}
              className={`p-2 rounded-xl border text-center flex flex-col items-center justify-between min-h-[74px] transition-colors ${i === 0 ? "border-indigo-600 bg-white" : "border-gray-200 bg-white hover:border-indigo-300"} ${day === w.iso ? "ring-2 ring-indigo-500 ring-offset-1" : ""}`}
              onClick={() => {
                setDay(day === w.iso ? null : w.iso);
                setPage(1);
              }}
            >
              <span className="block text-[11px] font-bold text-gray-500">{i === 0 ? 'Today · ' : ''}{w.d.toLocaleDateString('en-IN', { weekday: 'short' })}</span>
              <small className="text-[11px] text-gray-400">{w.d.getDate()} {w.d.toLocaleDateString('en-IN', { month: 'short' })}</small>
              <b className={`block font-display text-lg min-h-[22px] ${w.count ? "text-indigo-700" : ""}`}>{w.count || '–'}</b>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 mt-4 min-h-[460px]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <b className="text-[15px] whitespace-nowrap">{bk === "all" ? "⚡ Needs attention" : BUCKETS.find((b) => b.k === bk)?.t}</b>

            <div className="flex items-center gap-3">
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search enquiry, sub-job, client, product..."
                  className="w-64 sm:w-80 pl-8 pr-7 py-1.5 border border-gray-300 rounded-xl text-xs bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition shadow-2xs"
                />
                <svg
                  className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {(loading || search.trim() !== debouncedSearch.trim()) && search ? (
                  <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                ) : search ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setDebouncedSearch("");
                      setPage(1);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 w-4 h-4 flex items-center justify-center text-xs font-bold rounded-full hover:bg-gray-100"
                    title="Clear search"
                  >
                    ✕
                  </button>
                ) : null}
              </div>
              <span className="text-xs text-gray-500 font-medium whitespace-nowrap">{totalJobs} jobs</span>
            </div>
          </div>

          {/* Only show initial loading card when there are zero cards and user is not searching */}
          {loading && !search && !debouncedSearch && serverJobs.length === 0 && (
            <div className="p-8 text-center text-xs text-indigo-600 font-medium bg-indigo-50/50 rounded-xl border border-indigo-100 flex items-center justify-center gap-2 mt-2 min-h-[200px]">
              <span className="animate-spin inline-block w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full" />
              <span>Loading jobs...</span>
            </div>
          )}

          {!loading && serverJobs.length === 0 && (
            <div className="p-8 text-center text-gray-400 border border-dashed border-gray-200 rounded-xl bg-white/50 mt-2 min-h-[200px] flex items-center justify-center">
              {debouncedSearch.trim() ? `No jobs found matching “${debouncedSearch.trim()}”` : "Nothing here. 🎉"}
            </div>
          )}

          <div className={`grid gap-3.5 mt-2 min-h-[360px] content-start transition-opacity duration-150 ${loading && (search || debouncedSearch) ? "opacity-60 pointer-events-none" : "opacity-100"}`}>
            {serverJobs.map((m) => {
              const sg = stageOf(m.stage);
              const late = m.due && new Date(m.due + 'T00:00') < TODAY;
              return (
                <div
                  key={m.id}
                  className="p-4 rounded-2xl bg-white border border-gray-200 shadow-2xs hover:shadow-md hover:border-indigo-400 transition-all cursor-pointer relative flex flex-col gap-2.5"
                  style={{ borderLeftWidth: '5px', borderLeftColor: sg.c }}
                  onClick={() => onOpen(m)}
                >
                  {/* Layer 1: Stage pill, Job ID, and Badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shadow-2xs"
                      style={{ background: sg.bg, color: sg.ink }}
                    >
                      <span>{sg.icon}</span>
                      <span>{sg.t}</span>
                    </span>

                    <b className="text-sm font-black text-gray-900 tracking-tight">{m.id}</b>

                    {m.hold && (
                      <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200">
                        On hold
                      </span>
                    )}

                    {m.is_lost && (
                      <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                        ✕ Lost / Abandoned
                      </span>
                    )}

                    {m.isDemo && (
                      <span className="text-[10px] font-medium text-gray-400 bg-gray-50 border border-gray-200 px-1.5 py-0.2 rounded">
                        demo
                      </span>
                    )}

                    {m.designStatus === "uploaded" && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                        🟢 DESIGN UPLOADED
                      </span>
                    )}

                    {m.designStatus === "rework" && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                        🟠 REWORK REQUIRED
                      </span>
                    )}

                    {m.created_by_name && (
                      <span className="ml-auto text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                        <span className="text-[10px] text-slate-400">Created by:</span>
                        <b className="font-semibold text-slate-700">{m.created_by_name}</b>
                      </span>
                    )}
                  </div>

                  {/* Layer 2: Client Headline & Product */}
                  <div className="text-[13px] text-gray-800 leading-snug">
                    <b className="font-extrabold text-gray-950">{m.client}</b>
                    <span className="text-gray-400 mx-1.5">·</span>
                    <span className="font-medium text-gray-800">{m.product}</span>
                    {m.qty ? (
                      <>
                        <span className="text-gray-400 mx-1.5">·</span>
                        <span className="font-semibold text-gray-700">{m.qty} pcs</span>
                      </>
                    ) : null}
                  </div>

                  {/* Layer 3: Status Note */}
                  {m.note && (
                    <div className="text-xs text-gray-500 font-normal leading-relaxed">
                      {m.note}
                    </div>
                  )}

                  {/* Layer 4: Next Action Prompt */}
                  {m.next && (
                    <div className="text-xs font-semibold text-indigo-700 mt-0.5 flex items-center gap-1">
                      <span>➜ Next:</span>
                      <b className="font-extrabold text-indigo-900">{m.next}</b>
                    </div>
                  )}

                  {/* Layer 5: Category Tag Pills */}
                  {m.buckets && m.buckets.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      {m.buckets.map((k) => {
                        const x = BUCKETS.find((y) => y.k === k) || { t: k, icon: "🏷️", c: "#cbd5e1" };
                        return (
                          <span
                            key={k}
                            className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full border bg-white flex items-center gap-1 text-gray-700 shadow-2xs"
                            style={{ borderColor: x.c }}
                          >
                            <span className="text-xs">{x.icon}</span>
                            <span>{x.t}</span>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Layer 6: Footer Metrics & Actions */}
                  <div className="flex items-center gap-3.5 text-xs text-gray-500 mt-2 pt-2.5 border-t border-gray-100 flex-wrap">
                    {m.stage === 'closed' ? (
                      <span className="font-bold text-emerald-700 flex items-center gap-1">
                        <span>🏁</span> Completed
                      </span>
                    ) : (
                      <span className={`flex items-center gap-1 font-semibold ${late ? 'text-rose-600 font-extrabold' : 'text-gray-600'}`}>
                        <span>📅</span> {dueTxt(m.due)}
                      </span>
                    )}

                    {m.ageDays != null && (
                      <span className={`flex items-center gap-1 ${m.ageDays >= 3 ? 'text-amber-700 font-bold' : 'text-gray-500'}`}>
                        <span>⏳</span> {m.ageDays} day{m.ageDays !== 1 ? 's' : ''} ageing
                      </span>
                    )}

                    {m.amount ? (
                      <span className="flex items-center gap-1 font-semibold text-gray-800">
                        <span>💰</span> ₹{Number(m.amount).toLocaleString('en-IN')}
                      </span>
                    ) : null}

                    {m.score != null && (
                      <span className="flex items-center gap-1 font-bold text-gray-700">
                        <span>★</span> {m.score}
                      </span>
                    )}

                    <span className="ml-auto text-xs text-gray-500 font-medium">
                      {m.exec || "Meera Joshi"}
                    </span>

                    <button
                      type="button"
                      className="text-gray-500 hover:text-indigo-600 text-xs font-semibold px-1 py-0.5 cursor-pointer transition"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(m);
                      }}
                    >
                      Quick update
                    </button>

                    <button
                      type="button"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl transition shadow-xs cursor-pointer flex items-center gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(m);
                      }}
                    >
                      <span>Open</span>
                      <span>➜</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-white border border-gray-200 rounded-xl shadow-2xs mt-3 text-xs">
            <div className="flex items-center gap-2 text-gray-500">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="border border-gray-300 rounded-lg text-xs py-1 px-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                {[6, 8, 12, 20].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <span>jobs per page</span>
            </div>

            <div className="text-gray-500 font-medium text-center">
              Showing <b className="text-gray-900">{totalJobs === 0 ? 0 : startJobIndex + 1}</b> to <b className="text-gray-900">{Math.min(startJobIndex + pageSize, totalJobs)}</b> of <b className="text-gray-900">{totalJobs}</b> jobs
            </div>

            <div className="flex items-center gap-1.5 justify-end">
              <button
                type="button"
                disabled={safeJobPage <= 1 || loading}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className={`px-3 py-1.5 rounded-lg border font-semibold transition ${safeJobPage <= 1 || loading
                    ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 cursor-pointer shadow-2xs"
                  }`}
              >
                Previous
              </button>
              {getPageNumbers(safeJobPage, safeTotalJobPages).map((pg, idx) =>
                pg === "..." ? (
                  <span key={`el-jb-${idx}`} className="px-1 text-gray-400 font-bold">…</span>
                ) : (
                  <button
                    key={pg}
                    type="button"
                    disabled={loading}
                    onClick={() => setPage(pg)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition ${safeJobPage === pg
                        ? "bg-indigo-600 text-white shadow-2xs"
                        : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 cursor-pointer"
                      }`}
                  >
                    {pg}
                  </button>
                )
              )}
              <button
                type="button"
                disabled={safeJobPage >= safeTotalJobPages || loading}
                onClick={() => setPage((p) => Math.min(p + 1, safeTotalJobPages))}
                className={`px-3 py-1.5 rounded-lg border font-semibold transition ${safeJobPage >= safeTotalJobPages || loading
                    ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 cursor-pointer shadow-2xs"
                  }`}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default JobsBoard;
