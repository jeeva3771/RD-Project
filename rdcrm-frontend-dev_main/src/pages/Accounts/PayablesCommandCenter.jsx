import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { axiosInstance } from "../../utils/url/config";
import { fmtR, fmt } from "./console/utils/accountsFormatters";
import { getUser } from "../../utils/permission/auth";
import ManualVendorPaymentModal from "./console/modals/ManualVendorPaymentModal";
import DocumentPreviewModal from "./console/modals/DocumentPreviewModal";
import Pagination from "../components/Pagination";
import "./accountsConsole.css";

/* ---------------- Icons Component ---------------- */
function Icon({ name, size = 16, className = "" }) {
  const p = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
  };
  switch (name) {
    case "search": return <svg {...p}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
    case "x": return <svg {...p}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
    case "info": return <svg {...p}><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>;
    case "users": return <svg {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
    case "check": return <svg {...p}><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></svg>;
    case "alert": return <svg {...p}><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
    case "calendar": return <svg {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
    case "refresh": return <svg {...p}><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" /></svg>;
    case "box": return <svg {...p}><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="M3.3 7 12 12l8.7-5" /><path d="M12 22V12" /></svg>;
    case "send": return <svg {...p}><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>;
    case "bank": return <svg {...p}><path d="M3 21h18M3 10h18M5 10v11M9 10v11M15 10v11M19 10v11M12 2 2 7h20L12 2Z" /></svg>;
    case "ledger": return <svg {...p}><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>;
    case "file": return <svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>;
    case "clipboard": return <svg {...p}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></svg>;
    default: return null;
  }
}

/* ---------------- 5-Stage Kanban Definition ---------------- */
const BILL_STAGES = [
  { id: "received", label: "Bill Received", color: "#64748B", bg: "#F8FAFC", border: "#CBD5E1" },
  { id: "approved", label: "Approved for Payment", color: "#4F46E5", bg: "#EEF2FF", border: "#C7D2FE" },
  { id: "scheduled", label: "Payment Scheduled", color: "#0891B2", bg: "#ECFEFF", border: "#A5F3FC" },
  { id: "partial", label: "Partial Payment", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
  { id: "paid", label: "Paid", color: "#10B981", bg: "#ECFDF5", border: "#A7F3D0" },
];

/* ---------------- Helper Formatters ---------------- */
const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export default function PayablesCommandCenter() {
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [kpis, setKpis] = useState({
    totalOutstanding: 0,
    overdueAmount: 0,
    pendingApproval: 0,
    scheduledCount: 0,
    partialCount: 0,
    paidTotal: 0,
    totalVendors: 0,
  });
  const [vendorLeaderboard, setVendorLeaderboard] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("board"); // "board" or "ledger"
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState(null);
  const [openBillId, setOpenBillId] = useState(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [boardDocPreview, setBoardDocPreview] = useState(null);
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [debouncedLedgerSearch, setDebouncedLedgerSearch] = useState("");
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerLimit, setLedgerLimit] = useState(15);
  const [ledgerPagination, setLedgerPagination] = useState({
    page: 1,
    limit: 15,
    totalPages: 1,
    totalCount: 0,
  });
  const [ledgerSummaryTotals, setLedgerSummaryTotals] = useState({
    totalQty: 0,
    totalBase: 0,
    totalGst: 0,
    totalTds: 0,
    totalPaid: 0,
  });

  // Debounce Board Search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Debounce Ledger Search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedLedgerSearch(ledgerSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [ledgerSearch]);

  // Reset ledger page to 1 when search text changes
  useEffect(() => {
    setLedgerPage(1);
  }, [debouncedLedgerSearch]);

  // Fetch Board Data from backend with search and vendor filter
  const fetchBoardData = useCallback(async (searchQuery = "", vendorFilter = null) => {
    try {
      setLoading(true);
      const params = {};
      if (searchQuery && searchQuery.trim()) params.search = searchQuery.trim();
      if (vendorFilter && String(vendorFilter).trim()) params.vendor = String(vendorFilter).trim();

      const res = await axiosInstance.get("/accounts/payables-board", { params });
      if (res.data?.success) {
        setBills(res.data.data.bills || []);
        setKpis(res.data.data.kpis || {});
        setVendorLeaderboard(res.data.data.vendorLeaderboard || []);
      }
    } catch (err) {
      console.error("Error loading payables board:", err);
      toast.error("Failed to load payables board data");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Bank Accounts for Payment Modal
  const fetchBankAccounts = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/accounts/bank-master");
      if (res.data?.success) {
        setBankAccounts(res.data.data || []);
      }
    } catch (err) {
      console.error("Error loading bank accounts:", err);
    }
  }, []);

  // Fetch Vendor Payments History for Ledger View from backend with server-side pagination
  const fetchPayments = useCallback(async (searchQuery = "", page = 1, limit = 15) => {
    try {
      setLedgerLoading(true);
      const params = {
        page,
        limit,
      };
      if (searchQuery && searchQuery.trim()) params.search = searchQuery.trim();

      const res = await axiosInstance.get("/accounts/vendor-payments", { params });
      if (res.data?.success) {
        setPayments(res.data.data || []);
        if (res.data.pagination) {
          setLedgerPagination(res.data.pagination);
        } else {
          setLedgerPagination({
            page: res.data.page || page,
            limit: res.data.limit || limit,
            totalPages: res.data.totalPages || 1,
            totalCount: res.data.totalCount !== undefined ? res.data.totalCount : (res.data.data || []).length,
          });
        }
        if (res.data.summaryTotals) {
          setLedgerSummaryTotals(res.data.summaryTotals);
        }
      }
    } catch (err) {
      console.error("Error loading vendor payments:", err);
    } finally {
      setLedgerLoading(false);
    }
  }, []);

  // Trigger Board fetch whenever debouncedSearch or entityFilter changes
  useEffect(() => {
    fetchBoardData(debouncedSearch, entityFilter);
  }, [fetchBoardData, debouncedSearch, entityFilter]);

  // Trigger Ledger fetch whenever debouncedLedgerSearch, ledgerPage, or ledgerLimit changes in ledger view
  useEffect(() => {
    if (viewMode === "ledger") {
      fetchPayments(debouncedLedgerSearch, ledgerPage, ledgerLimit);
    }
  }, [fetchPayments, debouncedLedgerSearch, ledgerPage, ledgerLimit, viewMode]);

  // Initial load for bank accounts
  useEffect(() => {
    fetchBankAccounts();
  }, [fetchBankAccounts]);

  // Stage Move Handler
  const handleMoveStage = async (billId, newStage) => {
    try {
      const res = await axiosInstance.patch(`/accounts/vendor-bills/${billId}/stage`, { stage: newStage });
      if (res.data?.success) {
        toast.success(`Stage moved to ${BILL_STAGES.find(s => s.id === newStage)?.label || newStage}`);
        setBills(prev => prev.map(b => b._id === billId ? { ...b, stage: newStage } : b));
        fetchBoardData(debouncedSearch, entityFilter);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update stage");
    }
  };

  // Schedule Payment
  const handleScheduleBill = async (billId, dateStr) => {
    try {
      const res = await axiosInstance.patch(`/accounts/vendor-bills/${billId}/schedule`, {
        scheduled_date: dateStr
      });
      if (res.data?.success) {
        toast.success(res.data.message || "Payment scheduled");
        setBills(prev => prev.map(b => b._id === billId ? { ...b, scheduledDate: dateStr, stage: "scheduled" } : b));
        fetchBoardData(debouncedSearch, entityFilter);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to schedule payment");
    }
  };

  // Backend already filters bills by search and vendor; expose directly
  const filteredBills = bills;

  const openBill = useMemo(() => bills.find(b => b._id === openBillId) || null, [bills, openBillId]);

  return (
    <div className={`h-full w-full bg-slate-50 text-slate-800 flex flex-col font-sans ${viewMode === "board" ? "overflow-hidden" : "overflow-y-auto scrollbar-thin scrollbar-thumb-slate-400 scrollbar-track-transparent"}`}>
      {/* ---------------- Top Command Bar (Single Compact Row) ---------------- */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2 shrink-0 z-20 shadow-2xs sticky top-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* User-friendly Search Box on Left (Shown only in Board View) */}
          {viewMode === "board" ? (
            <div className="relative w-72 sm:w-80 md:w-96">
              <Icon
                name="search"
                size={15}
                className={`absolute left-3 top-1/2 -translate-y-1/2 ${loading ? "text-teal-600 animate-spin" : "text-slate-400"}`}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search vendor, bill, PO, challan, material..."
                className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 outline-none focus:border-teal-500 focus:bg-white focus:ring-1 focus:ring-teal-100 transition placeholder:text-slate-400"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <Icon name="x" size={13} />
                </button>
              )}
            </div>
          ) : <div />}

          {/* Action Controls on Right */}
          <div className="flex items-center gap-2 sm:gap-2.5 flex-1 sm:flex-initial justify-end">
            {/* <button
              type="button"
              onClick={() => navigate("/collection-board")}
              className="px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 flex items-center gap-1.5 text-xs font-bold transition shadow-2xs"
            >
              <Icon name="wallet" size={13} className="text-amber-600" /> Collection Board
            </button> */}

            {/* View Switcher: Board / Ledger */}
            <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-bold">
              <button
                onClick={() => setViewMode("board")}
                className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition text-xs sm:text-sm font-semibold ${viewMode === "board" ? "bg-white text-teal-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
              >
                <Icon name="box" size={14} /> Board
              </button>
              <button
                onClick={() => setViewMode("ledger")}
                className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition text-xs sm:text-sm font-semibold ${viewMode === "ledger" ? "bg-white text-teal-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
              >
                <Icon name="ledger" size={14} /> Payment Ledger
              </button>
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => {
                fetchBoardData(debouncedSearch, entityFilter);
                if (viewMode === "ledger") {
                  fetchPayments(debouncedLedgerSearch, ledgerPage, ledgerLimit);
                }
              }}
              disabled={loading || ledgerLoading}
              title="Refresh Data"
              className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition"
            >
              <Icon name="refresh" size={14} className={loading || ledgerLoading ? "animate-spin text-teal-600" : ""} />
            </button>

            {/* Legend Button */}
            <div className="relative">
              <button
                onClick={() => setLegendOpen(!legendOpen)}
                className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50"
              >
                <Icon name="info" size={14} /> <span className="hidden sm:inline">Legend</span>
              </button>
              {legendOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl p-3 z-40">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Bill Stage Legend
                  </div>
                  {BILL_STAGES.map((s) => (
                    <div key={s.id} className="flex items-center justify-between py-1 text-xs">
                      <span className="font-semibold text-slate-700">{s.label}</span>
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- KPI Strip (Spacious Box View) ---------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 px-4 sm:px-6 pt-3 pb-2 shrink-0">
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs border-t-4 border-t-teal-700 hover:shadow-sm transition">
          <div className="text-base sm:text-xl font-black text-slate-900 leading-tight">{fmtR(kpis.totalOutstanding)}</div>
          <div className="text-xs font-bold tracking-wider text-slate-500 uppercase mt-1 truncate">Total Payables</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs border-t-4 border-t-red-500 hover:shadow-sm transition">
          <div className="text-base sm:text-xl font-black text-red-600 leading-tight">{fmtR(kpis.overdueAmount)}</div>
          <div className="text-xs font-bold tracking-wider text-slate-500 uppercase mt-1 truncate">Overdue Payables</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs border-t-4 border-t-indigo-600 hover:shadow-sm transition">
          <div className="text-lg sm:text-2xl font-black text-indigo-600 leading-tight">{kpis.pendingApproval || 0}</div>
          <div className="text-xs font-bold tracking-wider text-slate-500 uppercase mt-1 truncate">Pending Approval</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs border-t-4 border-t-cyan-600 hover:shadow-sm transition">
          <div className="text-lg sm:text-2xl font-black text-cyan-600 leading-tight">{kpis.scheduledCount || 0}</div>
          <div className="text-xs font-bold tracking-wider text-slate-500 uppercase mt-1 truncate">Scheduled Payouts</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs border-t-4 border-t-amber-500 hover:shadow-sm transition">
          <div className="text-lg sm:text-2xl font-black text-amber-600 leading-tight">{kpis.partialCount || 0}</div>
          <div className="text-xs font-bold tracking-wider text-slate-500 uppercase mt-1 truncate">Partial Payments</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs border-t-4 border-t-emerald-500 hover:shadow-sm transition">
          <div className="text-base sm:text-xl font-black text-emerald-600 leading-tight">{fmtR(kpis.paidTotal)}</div>
          <div className="text-xs font-bold tracking-wider text-slate-500 uppercase mt-1 truncate">Total Paid</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs border-t-4 border-t-slate-700 hover:shadow-sm transition">
          <div className="text-lg sm:text-2xl font-black text-slate-700 leading-tight">{kpis.totalVendors}</div>
          <div className="text-xs font-bold tracking-wider text-slate-500 uppercase mt-1 truncate">Total Vendors</div>
        </div>
      </div>

      {/* ---------------- Main Content: Board or Ledger ---------------- */}
      {viewMode === "ledger" ? (
        <PaymentLedgerView
          payments={payments}
          ledgerSearch={ledgerSearch}
          setLedgerSearch={setLedgerSearch}
          loading={ledgerLoading}
          pagination={ledgerPagination}
          onPageChange={(p) => setLedgerPage(p)}
          onLimitChange={(l) => {
            setLedgerLimit(l);
            setLedgerPage(1);
          }}
          summaryTotals={ledgerSummaryTotals}
        />
      ) : (
        <div className="px-4 sm:px-6 pt-1 pb-2 flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Vendor Leaderboard Carousel (Enlarged Box View) */}
          <div className="mb-2.5 shrink-0">
            <div className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Outstanding by Vendor — Tap to filter board</span>
              {entityFilter && (
                <button
                  onClick={() => setEntityFilter(null)}
                  className="text-teal-700 hover:text-teal-900 font-bold flex items-center gap-1 normal-case text-xs bg-teal-50 px-2 py-0.5 rounded border border-teal-200"
                >
                  <Icon name="x" size={12} /> Clear Filter ({entityFilter})
                </button>
              )}
            </div>
            <div className="flex gap-2.5 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
              {vendorLeaderboard.map((v) => {
                const isActive = entityFilter === v.vendor;
                return (
                  <button
                    key={v.vendor}
                    onClick={() => setEntityFilter(isActive ? null : v.vendor)}
                    className={`shrink-0 w-44 sm:w-52 text-left rounded-xl border p-3 bg-white transition ${isActive
                      ? "border-teal-500 ring-2 ring-teal-300 shadow-sm bg-teal-50/50"
                      : "border-slate-200 hover:border-slate-300 hover:shadow-2xs"
                      }`}
                  >
                    <div className="text-sm font-bold text-slate-900 truncate">{v.vendor}</div>
                    <div className="text-sm sm:text-base font-extrabold text-teal-700 mt-1 leading-tight">{fmtR(v.outstanding)}</div>
                    <div className="text-xs text-slate-500 mt-1.5 flex items-center justify-between leading-tight">
                      <span>{v.activeBills} bill{v.activeBills === 1 ? "" : "s"}</span>
                      {v.overdueCount > 0 && (
                        <span className="font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded text-[11px]">
                          {v.overdueCount} ovd
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
              {vendorLeaderboard.length === 0 && !loading && (
                <div className="text-xs text-slate-400 italic py-1">No vendor outstanding balances found.</div>
              )}
            </div>
          </div>

          {/* 5-Lane Kanban Board (Stretches full remaining height) */}
          <div className="flex gap-3 overflow-x-auto pb-1.5 items-stretch flex-1 min-h-0 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
            {BILL_STAGES.map((stage) => {
              const stageBills = filteredBills.filter((b) => b.stage === stage.id);
              const stageTotal = stageBills.reduce((s, b) => s + b.balanceDue, 0);

              return (
                <div
                  key={stage.id}
                  className="w-72 sm:w-80 shrink-0 bg-slate-100/90 rounded-xl border border-slate-200 shadow-2xs flex flex-col h-full min-h-0"
                >
                  {/* Column Header */}
                  <div
                    className="px-3.5 py-2 border-b rounded-t-xl flex items-center justify-between shrink-0"
                    style={{ backgroundColor: stage.bg, borderColor: stage.border }}
                  >
                    <div>
                      <span className="text-sm font-black uppercase tracking-wider text-slate-800">
                        {stage.label}
                      </span>
                      <div className="text-xs font-bold mt-0.5" style={{ color: stage.color }}>
                        {fmtR(stageTotal)} payable
                      </div>
                    </div>
                    <span
                      className="text-xs font-black px-2.5 py-0.5 rounded-full text-white shadow-xs"
                      style={{ backgroundColor: stage.color }}
                    >
                      {stageBills.length}
                    </span>
                  </div>

                  {/* Cards Lane (Internal scroll only) */}
                  <div className="overflow-y-auto p-2.5 space-y-2.5 flex-1 min-h-0 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
                    {stageBills.map((b) => (
                      <div
                        key={b._id}
                        onClick={() => setOpenBillId(b._id)}
                        className="bg-white hover:shadow-md border border-slate-200 rounded-xl p-3 cursor-pointer transition hover:border-slate-300"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-bold text-slate-900 leading-snug truncate">
                            {b.vendor}
                          </span>
                          {(() => {
                            const isOverdue = b.daysOverdue > 0 || (
                              b.stage !== "paid" && b.dueDate && new Date(new Date(b.dueDate).setHours(0, 0, 0, 0)).getTime() < new Date(new Date().setHours(0, 0, 0, 0)).getTime()
                            );
                            const days = b.daysOverdue > 0 ? b.daysOverdue : (
                              isOverdue ? Math.max(1, Math.round((new Date(new Date().setHours(0, 0, 0, 0)).getTime() - new Date(new Date(b.dueDate).setHours(0, 0, 0, 0)).getTime()) / 86400000)) : 0
                            );
                            return isOverdue ? (
                              <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-600 border border-red-200 shrink-0">
                                {days}d overdue
                              </span>
                            ) : null;
                          })()}
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1.5 font-mono flex-wrap">
                          <span>{b.billNo}</span>
                          <span>•</span>
                          <span className="truncate">PO: {b.poRef}</span>
                          {b.receivedQty > 0 && (
                            <>
                              <span>•</span>
                              <span className="font-bold text-teal-700">Qty: {b.receivedQty}</span>
                            </>
                          )}
                        </div>

                        <div className="text-xs font-medium text-slate-700 truncate mt-1">
                          {b.material}
                        </div>

                        <div className="flex items-baseline justify-between mt-2.5">
                          <div className="text-lg font-black" style={{ color: stage.color }}>
                            {fmtR(b.balanceDue)}
                          </div>
                          {b.paidAmount > 0 && b.balanceDue > 0 && (
                            <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                              Paid: {fmtR(b.paidAmount)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100 text-xs text-slate-500">
                          {(() => {
                            const isOverdue = b.daysOverdue > 0 || (
                              b.stage !== "paid" && b.dueDate && new Date(new Date(b.dueDate).setHours(0, 0, 0, 0)).getTime() < new Date(new Date().setHours(0, 0, 0, 0)).getTime()
                            );
                            return (
                              <span className={isOverdue ? "font-bold text-red-600" : ""}>
                                {b.dueDate ? `Due: ${formatDate(b.dueDate)}` : "No due date"}
                              </span>
                            );
                          })()}
                          {b.scheduledDate && (
                            <span className="font-bold text-cyan-700">
                              Sched: {formatDate(b.scheduledDate)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}

                    {stageBills.length === 0 && (
                      <div className="text-center text-xs text-slate-400 py-8 italic">
                        No bills in this stage
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------------- Bill Workspace / Detail Drawer ---------------- */}
      {openBill && (
        <BillDetailModal
          bill={openBill}
          bankAccounts={bankAccounts}
          onClose={() => setOpenBillId(null)}
          onMoveStage={handleMoveStage}
          onSchedule={handleScheduleBill}
          onPaymentSuccess={() => {
            fetchBoardData();
            if (viewMode === "ledger") {
              fetchPayments(debouncedLedgerSearch, ledgerPage, ledgerLimit);
            }
          }}
        />
      )}
      {/* Board Doc Preview Modal */}
      {boardDocPreview && (
        <DocumentPreviewModal
          attachment={boardDocPreview}
          onClose={() => setBoardDocPreview(null)}
        />
      )}
    </div>
  );
}

/* ---------------- Bill Detail Modal / Drawer ---------------- */
function BillDetailModal({
  bill,
  bankAccounts,
  onClose,
  onMoveStage,
  onSchedule,
  onPaymentSuccess,
}) {
  const [scheduleDate, setScheduleDate] = useState(
    bill.scheduledDate ? new Date(bill.scheduledDate).toISOString().split("T")[0] : ""
  );
  const [payOpen, setPayOpen] = useState(false);
  const [docPreview, setDocPreview] = useState(null);
  const stageObj = BILL_STAGES.find((s) => s.id === bill.stage) || BILL_STAGES[0];

  const handleSaveSchedule = () => {
    if (!scheduleDate) {
      toast.warning("Please choose a date to schedule");
      return;
    }
    onSchedule(bill._id, scheduleDate);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4 animate-fadeIn">
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-3xl sm:max-w-4xl rounded-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-slideUp"
      >
        {/* Header */}
        <div
          className="px-5 sm:px-6 py-4 border-b flex items-center justify-between"
          style={{ backgroundColor: stageObj.bg, borderColor: stageObj.border }}
        >
          <div>
            <span
              className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded text-white"
              style={{ backgroundColor: stageObj.color }}
            >
              {stageObj.label}
            </span>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <h2 className="text-base sm:text-xl font-black text-slate-900">{bill.vendor}</h2>
              {bill.material && (
                <span className="text-xs font-bold text-teal-800 bg-teal-100/90 px-2.5 py-0.5 rounded-md border border-teal-200">
                  📦 {bill.material}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/80 hover:bg-white text-slate-500 hover:text-slate-800 flex items-center justify-center shadow-sm"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto flex-1 px-5 sm:px-6 py-5 space-y-4 text-xs sm:text-sm">
          {/* Unified Order & Financial Summary Grid */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-3.5 space-y-3">
            {/* Row 1: Document & Order References (Same Card UI) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
              {/* Invoice Card */}
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs flex flex-col justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Invoice No</span>
                <span className="text-base sm:text-lg font-black font-mono text-slate-900 block mt-1 truncate" title={bill.billNo}>
                  {bill.billNo || "—"}
                </span>
                <div className="mt-1 pt-1 border-t border-slate-100 flex items-center">
                  {bill.invoiceUrl ? (
                    <button
                      type="button"
                      onClick={() => setDocPreview({
                        url: bill.invoiceUrl.startsWith("http")
                          ? bill.invoiceUrl
                          : `${import.meta.env.VITE_BACKEND_URL}/image/view?url=${encodeURIComponent(bill.invoiceUrl)}`,
                        name: `${bill.billNo || "invoice"}.pdf`,
                      })}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:text-teal-900 transition cursor-pointer"
                    >
                      <Icon name="file" size={13} className="text-teal-600" />
                      <span>View Invoice</span>
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400 font-medium">No invoice file</span>
                  )}
                </div>
              </div>

              {/* PO Card */}
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs flex flex-col justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Purchase Order</span>
                <span className="text-base sm:text-lg font-black font-mono text-slate-900 block mt-1 truncate" title={bill.poRef}>
                  {bill.poRef || "—"}
                </span>
                <div className="mt-1 pt-1 border-t border-slate-100">
                  <span className="text-xs text-slate-500 font-medium">PO Reference</span>
                </div>
              </div>

              {/* Challan Card */}
              {/* <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs flex flex-col justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Delivery Challan</span>
                <span className="text-base sm:text-lg font-black font-mono text-slate-900 block mt-1 truncate" title={bill.challanRef}>
                  {bill.challanRef || "—"}
                </span>
                <div className="mt-1 pt-1 border-t border-slate-100 flex items-center">
                  {bill.challanUrl ? (
                    <button
                      type="button"
                      onClick={() => setDocPreview({
                        url: bill.challanUrl.startsWith("http")
                          ? bill.challanUrl
                          : `${import.meta.env.VITE_BACKEND_URL}/image/view?url=${encodeURIComponent(bill.challanUrl)}`,
                        name: `${bill.challanRef || "challan"}.pdf`,
                      })}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 transition cursor-pointer"
                    >
                      <Icon name="clipboard" size={13} className="text-slate-600" />
                      <span>View Challan</span>
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400 font-medium">No challan copy</span>
                  )}
                </div>
              </div> */}

              {/* Bill Date / Inward Date */}
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs flex flex-col justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Bill Date</span>
                <span className="text-base sm:text-lg font-black text-slate-900 block mt-1">
                  {bill.billDate ? formatDate(bill.billDate) : "—"}
                </span>
                <div className="mt-1 pt-1 border-t border-slate-100">
                  <span className="text-xs text-emerald-700 font-bold">
                    {bill.receivedQty > 0 ? `📦 ${bill.receivedQty} Units Recd.` : "Inward Verified"}
                  </span>
                </div>
              </div>
            </div>

            {/* Row 2: Financial Terms & Status (The 4 KPI Cards) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
              {/* Total Payable & Base / GST */}
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Payable</span>
                <span className="text-base sm:text-lg font-black text-slate-900 block mt-1">{fmtR(bill.total)}</span>
                <span className="text-xs text-slate-500 font-medium block mt-1">
                  Base {fmtR(bill.amount)}
                </span>
              </div>

              {/* Balance Due & Paid So Far */}
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Balance Due</span>
                <span className={`text-base sm:text-lg font-black block mt-1 ${bill.balanceDue <= 0 ? "text-emerald-600" : "text-teal-700"}`}>
                  {bill.balanceDue <= 0 ? "₹0 (Cleared)" : fmtR(bill.balanceDue)}
                </span>
                <span className="text-xs text-slate-500 font-medium block mt-1">
                  {bill.paidAmount > 0 ? `Paid: ${fmtR(bill.paidAmount)}` : "No payouts yet"}
                </span>
              </div>

              {/* Billed Quantity & Rate */}
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Qty & Unit Rate</span>
                <span className="text-sm sm:text-base font-black text-slate-800 block mt-1">
                  {bill.receivedQty || 0} Units × ₹{bill.poUnitRate > 0 ? bill.poUnitRate : (bill.receivedQty ? Math.round((bill.total / bill.receivedQty) * 100) / 100 : 0)}
                </span>
                <span className="text-xs text-slate-500 font-medium block mt-1">
                  {bill.paidQty > 0
                    ? `${bill.paidQty} paid • ${Math.max(0, (bill.receivedQty || 0) - bill.paidQty)} rem.`
                    : `${bill.receivedQty || 0} units rem.`}
                </span>
              </div>

              {/* Due Date & Overdue */}
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Due Date</span>
                {(() => {
                  const isOverdue = bill.daysOverdue > 0 || (
                    bill.stage !== "paid" && bill.dueDate && new Date(new Date(bill.dueDate).setHours(0, 0, 0, 0)).getTime() < new Date(new Date().setHours(0, 0, 0, 0)).getTime()
                  );
                  const days = bill.daysOverdue > 0 ? bill.daysOverdue : (
                    isOverdue ? Math.max(1, Math.round((new Date(new Date().setHours(0, 0, 0, 0)).getTime() - new Date(new Date(bill.dueDate).setHours(0, 0, 0, 0)).getTime()) / 86400000)) : 0
                  );
                  return (
                    <>
                      <span className={`text-sm sm:text-base font-black block mt-1 ${isOverdue ? "text-red-600" : "text-slate-800"}`}>
                        {bill.dueDate ? formatDate(bill.dueDate) : "—"}
                      </span>
                      <span className="text-xs font-medium block mt-1">
                        {isOverdue ? (
                          <span className="text-red-600 font-bold">⚠️ {days}d overdue</span>
                        ) : bill.dueDate ? (
                          <span className="text-slate-500">Within credit term</span>
                        ) : (
                          <span className="text-slate-400">No due date set</span>
                        )}
                      </span>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Kanban Stage Selector */}
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Move Stage
            </div>
            <div className="flex flex-wrap gap-1.5">
              {BILL_STAGES.map((s) => {
                const isCurrent = s.id === bill.stage;
                return (
                  <button
                    key={s.id}
                    onClick={() => onMoveStage(bill._id, s.id)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-full border transition ${isCurrent
                      ? "text-white shadow-sm"
                      : "text-slate-600 bg-white border-slate-200 hover:bg-slate-50"
                      }`}
                    style={isCurrent ? { backgroundColor: s.color, borderColor: s.color } : {}}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payment & Schedule Actions */}
          {bill.balanceDue > 0 ? (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                Payout Actions
              </div>

              {!["approved", "scheduled", "partial", "paid"].includes(bill.stage) && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs font-bold text-amber-800 flex items-center gap-2">
                  <Icon name="alert" size={14} />
                  <span>Please click 'Approved for Payment' above to authorize payout.</span>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-cyan-500 bg-white"
                  />
                  <button
                    onClick={handleSaveSchedule}
                    className="flex items-center gap-1.5 text-xs font-bold text-cyan-800 bg-cyan-100/80 border border-cyan-200 px-3 py-2 rounded-lg hover:bg-cyan-200 transition"
                  >
                    <Icon name="calendar" size={13} /> Schedule Payment
                  </button>
                </div>

                <button
                  disabled={!["approved", "scheduled", "partial", "paid"].includes(bill.stage)}
                  onClick={() => {
                    if (!["approved", "scheduled", "partial", "paid"].includes(bill.stage)) {
                      toast.error("Bill must be marked 'Approved for Payment' first.");
                      return;
                    }
                    setPayOpen(true);
                  }}
                  className={`flex items-center gap-1.5 text-xs font-black px-4 py-2 rounded-lg shadow-sm transition ml-auto ${!["approved", "scheduled", "partial", "paid"].includes(bill.stage)
                    ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                    : "text-white bg-teal-700 hover:bg-teal-800"
                    }`}
                >
                  <Icon name="bank" size={14} /> Record Payment
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2">
              <Icon name="check" size={16} /> This bill is fully cleared and reconciled!
            </div>
          )}
        </div>
      </div>

      {/* Rich Record Vendor Payment Modal (Exact same view as Accounts Console) */}
      {payOpen && (
        <ManualVendorPaymentModal
          target={{
            id: bill.vendorId || bill.vendor_id?._id || bill.vendor_id,
            vendorId: bill.vendorId || bill.vendor_id?._id || bill.vendor_id,
            vendorName: bill.vendor || bill.vendor_name || bill.vendor_id?.name || "Vendor",
            bill_no: bill.billNo || bill.invoice_no || bill.challan_no,
            amount: Number(bill.total || bill.payable_amount || 0),
            paid: Number(bill.paidAmount || bill.paid_amount || 0),
            due: Number(bill.balanceDue !== undefined ? bill.balanceDue : (Number(bill.total || 0) - Number(bill.paidAmount || 0))),
            outstanding: Number(bill.balanceDue !== undefined ? bill.balanceDue : (Number(bill.total || 0) - Number(bill.paidAmount || 0))),
            jobNo: bill.poRef || bill.jobNo || "",
            subJobNo: bill.subJobNo || "",
            productName: bill.material || bill.product_name || "",
            product_name: bill.material || bill.product_name || "",
            isSupplyVendor: true,
            received_qty: Number(bill.receivedQty || bill.received_qty || 0),
            paid_qty: Number(bill.paidQty || bill.paid_qty || 0),
            unit_rate: Number(bill.poUnitRate || (bill.receivedQty > 0 ? (bill.total / bill.receivedQty) : 0)),
            gst_rate: Number(bill.gstRate !== undefined ? bill.gstRate : 0),
            tds_rate: Number(bill.tdsRate !== undefined ? bill.tdsRate : 0),
          }}
          onClose={() => setPayOpen(false)}
          onSave={async (payload) => {
            try {
              const formData = new FormData();
              Object.keys(payload).forEach((key) => {
                if (key === "attachments") {
                  const files = Array.isArray(payload.attachments) ? payload.attachments : [];
                  files.forEach((f) => {
                    if (f instanceof File) formData.append("attachments", f);
                  });
                } else if (key === "attachment") {
                  if (payload.attachment instanceof File) {
                    formData.append("attachments", payload.attachment);
                  }
                } else if (payload[key] !== undefined && payload[key] !== null) {
                  formData.append(key, payload[key]);
                }
              });

              const currentUser = getUser();
              if (currentUser?.id || currentUser?._id) {
                formData.append("created_by", currentUser.id || currentUser._id);
              }
              if (currentUser?.name || currentUser?.username) {
                formData.append("created_by_name", currentUser.name || currentUser.username);
              }

              const res = await axiosInstance.post(
                `/accounts/vendor-bills/${bill._id}/pay`,
                formData,
                { headers: { "Content-Type": "multipart/form-data" } }
              );
              if (res.data?.success) {
                toast.success(res.data.message || "Payment recorded successfully!");
                setPayOpen(false);
                onPaymentSuccess();
              }
            } catch (err) {
              console.error("Payment error:", err);
              toast.error(err.response?.data?.message || "Failed to record payment");
            }
          }}
        />
      )}

      {/* Document Preview Modal for Bill Invoice & Challan */}
      {docPreview && (
        <DocumentPreviewModal
          attachment={docPreview}
          onClose={() => setDocPreview(null)}
        />
      )}
    </div>
  );
}

/* ---------------- Payment Ledger Table View ---------------- */
function PaymentLedgerView({
  payments = [],
  ledgerSearch = "",
  setLedgerSearch = () => { },
  loading = false,
  pagination = { page: 1, limit: 15, totalPages: 1, totalCount: 0 },
  onPageChange = () => { },
  onLimitChange = () => { },
  summaryTotals = null,
}) {
  const [docPreview, setDocPreview] = useState(null);

  const totals = useMemo(() => {
    let totalQty = 0;
    let totalBase = 0;
    let totalGst = 0;
    let totalTds = 0;
    let totalPaid = 0;

    payments.forEach((p) => {
      const bAmt = Number(p.amount || 0);
      const pQty = Number(p.paid_qty || 0);
      totalQty += pQty;
      totalBase += bAmt;

      let gRate = Number(p.gst_rate || 0);
      let gAmt = p.gst_amount !== undefined && Number(p.gst_amount) > 0
        ? Number(p.gst_amount)
        : (gRate > 0 ? Math.round((bAmt * gRate / 100) * 100) / 100 : 0);

      let tRate = Number(p.tds_rate || 0);
      let tAmt = p.tds_amount !== undefined && Number(p.tds_amount) > 0
        ? Number(p.tds_amount)
        : (tRate > 0 ? Math.round((bAmt * tRate / 100) * 100) / 100 : 0);

      const tNet = p.total_amount !== undefined && Number(p.total_amount) > 0
        ? Number(p.total_amount)
        : Math.max(0, Math.round((bAmt + gAmt - tAmt) * 100) / 100);

      if (tAmt === 0 && gAmt === 0 && bAmt > tNet && tNet > 0) {
        tAmt = Math.round((bAmt - tNet) * 100) / 100;
      } else if (tAmt === 0 && gAmt === 0 && tNet > bAmt) {
        gAmt = Math.round((tNet - bAmt) * 100) / 100;
      }

      totalGst += gAmt;
      totalTds += tAmt;
      totalPaid += tNet;
    });

    return { totalQty, totalBase, totalGst, totalTds, totalPaid };
  }, [payments]);

  const displayedTotalPaid = summaryTotals && summaryTotals.totalPaid > 0
    ? summaryTotals.totalPaid
    : totals.totalPaid;

  return (
    <div className="px-4 sm:px-6 pt-4 pb-8 flex flex-col">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide">
            PAYMENT TRANSACTIONS ({pagination?.totalCount !== undefined ? pagination.totalCount : payments.length})
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit history of every voucher disbursed against supply vendor bills.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative w-64 sm:w-80">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs">
              🔍
            </span>
            <input
              value={ledgerSearch}
              onChange={(e) => setLedgerSearch(e.target.value)}
              placeholder="Search UTR, mode, bank, vendor..."
              className="w-full pl-7 pr-8 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-teal-500 shadow-2xs"
            />
            {ledgerSearch && (
              <button
                type="button"
                onClick={() => setLedgerSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
            {loading && (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <svg className="animate-spin h-3.5 w-3.5 text-teal-600" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              </span>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-2xs text-right">
            <div className="text-[10px] font-bold text-slate-400 uppercase">Total Disbursed</div>
            <div className="text-sm font-black text-emerald-700">
              ₹ {displayedTotalPaid.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-[11.5px]" style={{ minWidth: 1250 }}>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold text-[11px] whitespace-nowrap sticky top-0 z-10">
                <th className="px-3 py-2.5 text-left">Payment Date</th>
                <th className="px-3 py-2.5 text-left">Vendor</th>
                <th className="px-3 py-2.5 text-left">Invoice / Bill No</th>
                <th className="px-3 py-2.5 text-center">Paid Qty</th>
                <th className="px-3 py-2.5 text-right font-black text-slate-900">Base Amt (₹)</th>
                <th className="px-3 py-2.5 text-right font-extrabold text-sky-600">GST (+)</th>
                <th className="px-3 py-2.5 text-right font-extrabold text-purple-600">TDS (-)</th>
                <th className="px-3 py-2.5 text-right font-black text-emerald-700">Total Paid (₹)</th>
                <th className="px-3 py-2.5 text-left">Mode & Bank</th>
                <th className="px-3 py-2.5 text-left">Reference / UTR</th>
                <th className="px-3 py-2.5 text-center">Receipt Proofs</th>
                <th className="px-3 py-2.5 text-left">Recorded By</th>
                <th className="px-3 py-2.5 text-left">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((p, idx) => {
                const pDate = p.payment_date || p.createdAt
                  ? new Date(p.payment_date || p.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                  : "—";

                const baseAmt = Number(p.amount || 0);
                const totalNet = p.total_amount !== undefined && Number(p.total_amount) > 0
                  ? Number(p.total_amount)
                  : Math.max(0, Math.round((baseAmt + (p.gst_amount || 0) - (p.tds_amount || 0)) * 100) / 100);

                let gRate = Number(p.gst_rate || 0);
                let gstAmt = p.gst_amount !== undefined && Number(p.gst_amount) > 0
                  ? Number(p.gst_amount)
                  : (gRate > 0 ? Math.round((baseAmt * gRate / 100) * 100) / 100 : 0);

                let tRate = Number(p.tds_rate || 0);
                let tdsAmt = p.tds_amount !== undefined && Number(p.tds_amount) > 0
                  ? Number(p.tds_amount)
                  : (tRate > 0 ? Math.round((baseAmt * tRate / 100) * 100) / 100 : 0);

                if (tdsAmt === 0 && gstAmt === 0 && baseAmt > totalNet && totalNet > 0) {
                  tdsAmt = Math.round((baseAmt - totalNet) * 100) / 100;
                  tRate = Math.round((tdsAmt / baseAmt * 100) * 10) / 10;
                } else if (tdsAmt === 0 && gstAmt === 0 && totalNet > baseAmt) {
                  gstAmt = Math.round((totalNet - baseAmt) * 100) / 100;
                  gRate = Math.round((gstAmt / baseAmt * 100) * 10) / 10;
                }

                const paidQty = Number(p.paid_qty || 0);
                const isCash = (p.payment_mode || "").toLowerCase().includes("cash");

                const rawAtts = Array.isArray(p.attachments) && p.attachments.length > 0
                  ? p.attachments
                  : (p.attachment ? [{ url: p.attachment, name: p.attachment_name || "Receipt Proof" }] : []);

                const seenProofs = new Set();
                const attachments = [];
                rawAtts.forEach((att, aIdx) => {
                  const rawUrl = typeof att === "string" ? att : (att?.url || att?.attachment || "");
                  const cleanKey = rawUrl ? rawUrl.split("?")[0].split("/").pop() : (att?.name || `proof_${aIdx}`);
                  if (cleanKey && !seenProofs.has(cleanKey)) {
                    seenProofs.add(cleanKey);
                    attachments.push({
                      url: rawUrl,
                      name: typeof att === "string" ? `Proof ${attachments.length + 1}` : (att?.name || `Proof ${attachments.length + 1}`),
                    });
                  }
                });

                return (
                  <tr key={p._id || idx} className="hover:bg-slate-50/70 transition">
                    {/* Date */}
                    <td className="px-3 py-2.5 text-slate-600 font-semibold whitespace-nowrap">
                      {pDate}
                    </td>

                    {/* Vendor */}
                    <td className="px-3 py-2.5 font-bold text-slate-900 whitespace-nowrap">
                      {p.vendor_name || "—"}
                    </td>

                    {/* Invoice / Bill No */}
                    <td className="px-3 py-2.5 font-mono font-bold whitespace-nowrap">
                      {p.bill_no ? (
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold text-teal-800 bg-teal-50 border border-teal-200">
                            {p.bill_no}
                          </span>
                          {p.invoice_url ? (
                            <button
                              type="button"
                              onClick={() => setDocPreview({
                                url: p.invoice_url.startsWith("http")
                                  ? p.invoice_url
                                  : `${import.meta.env.VITE_BACKEND_URL}/image/view?url=${encodeURIComponent(p.invoice_url)}`,
                                name: `${p.bill_no}_invoice.pdf`,
                              })}
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-extrabold text-teal-800 bg-teal-100/90 border border-teal-300 hover:bg-teal-200 transition cursor-pointer shadow-2xs"
                              title="Preview Attached Invoice"
                            >
                              <span>📄</span>
                              <span>Inv</span>
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Paid Qty */}
                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                      {paidQty > 0 ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 font-mono">
                          {paidQty} Qty
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Base Amt */}
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                      ₹ {baseAmt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* GST (+) */}
                    <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap">
                      {gstAmt > 0 ? (
                        <div>
                          <div className="font-bold text-sky-600">
                            + ₹ {gstAmt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-[10px] text-sky-700 font-bold">
                            ({gRate}%)
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[10px]">{gRate > 0 ? `${gRate}% (₹0)` : "0%"}</span>
                      )}
                    </td>

                    {/* TDS (-) */}
                    <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap">
                      {tdsAmt > 0 ? (
                        <div>
                          <div className="font-bold text-purple-600">
                            - ₹ {tdsAmt.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-[10px] text-purple-700 font-bold">
                            ({tRate}%)
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[10px]">{tRate > 0 ? `${tRate}% (₹0)` : "0%"}</span>
                      )}
                    </td>

                    {/* Total Paid (₹) */}
                    <td className="px-3 py-2.5 text-right font-mono font-black text-emerald-700 bg-emerald-50/50 whitespace-nowrap">
                      ₹ {totalNet.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* Mode & Bank */}
                    <td className="px-3 py-2.5 text-slate-800">
                      <div className="font-bold whitespace-nowrap">{p.payment_mode || "Bank Transfer"}</div>
                      {p.bank_account_label && (
                        <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1 mt-0.5 whitespace-nowrap">
                          <span>🏦</span> {p.bank_account_label}
                        </div>
                      )}
                    </td>

                    {/* Reference / UTR */}
                    <td className="px-3 py-2.5 text-slate-700">
                      {isCash ? (
                        <div>
                          {(p.cash_voucher_no || p.reference_no) && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 font-mono">
                              🎫 Voucher: {p.cash_voucher_no || p.reference_no}
                            </span>
                          )}
                          {p.cash_paid_to && (
                            <div className="text-[10px] text-slate-500 font-medium mt-1">
                              🤝 Handed to: <b className="text-slate-700">{p.cash_paid_to}</b>
                            </div>
                          )}
                          {!p.cash_voucher_no && !p.reference_no && !p.cash_paid_to && (
                            <span className="text-slate-400">—</span>
                          )}
                        </div>
                      ) : (
                        <div>
                          <div className="font-mono font-semibold text-slate-800">{p.reference_no || "—"}</div>
                          {p.cash_paid_to && (
                            <div className="text-[10px] text-slate-500">Handed to: {p.cash_paid_to}</div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Receipt Proofs */}
                    <td className="px-3 py-2.5 text-center">
                      {attachments.length > 0 ? (
                        <div className="flex flex-wrap gap-1 justify-center">
                          {attachments.map((att, attIdx) => (
                            <button
                              key={attIdx}
                              type="button"
                              onClick={() => setDocPreview({
                                url: att.url.startsWith("http")
                                  ? att.url
                                  : `${import.meta.env.VITE_BACKEND_URL}/image/view?url=${encodeURIComponent(att.url)}`,
                                name: att.name || "receipt_proof.pdf"
                              })}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-bold text-teal-700 bg-teal-50 border border-teal-200 hover:bg-teal-100 transition cursor-pointer"
                              title={att.name || `View Receipt ${attIdx + 1}`}
                            >
                              <span>📎</span>
                              <span>{attachments.length === 1 ? "Proof" : `#${attIdx + 1}`}</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Recorded By */}
                    <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">
                      {p.created_by_name || p.created_by?.name || p.created_by?.username ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-bold text-slate-800 bg-slate-100 border border-slate-200">
                          👤 {p.created_by_name || p.created_by?.name || p.created_by?.username}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Notes */}
                    <td className="px-3 py-2.5 text-slate-500 text-[11px] max-w-xs" title={p.notes || ""}>
                      {p.notes || "—"}
                    </td>
                  </tr>
                );
              })}

              {payments.length === 0 && (
                <tr>
                  <td colSpan="13" className="text-center py-12 text-slate-400 text-xs italic">
                    {loading ? "Searching records..." : "No payment records found in the ledger."}
                  </td>
                </tr>
              )}
            </tbody>

            {payments.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-300 font-extrabold text-[11px] whitespace-nowrap">
                  <td colSpan={3} className="px-3 py-2.5 text-left text-slate-700 font-bold">
                    {pagination?.totalCount && pagination.totalCount > payments.length
                      ? `Page Total (${payments.length} of ${pagination.totalCount} txns)`
                      : `Total (${payments.length} txns)`}
                  </td>
                  <td className="px-3 py-2.5 text-center text-emerald-800 font-mono font-bold">
                    {totals.totalQty > 0 ? `${totals.totalQty} Qty` : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">
                    ₹ {totals.totalBase.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold text-sky-600">
                    + ₹ {totals.totalGst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold text-purple-600">
                    - ₹ {totals.totalTds.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-black text-emerald-800 bg-emerald-100/60">
                    ₹ {totals.totalPaid.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td colSpan={5}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Server-Side Pagination Controls */}
        <div className="shrink-0 border-t border-slate-200 bg-white">
          <Pagination
            currentPage={pagination?.page || 1}
            totalPages={pagination?.totalPages || 1}
            itemsPerPage={pagination?.limit || 15}
            totalCount={pagination?.totalCount || 0}
            startIndex={((pagination?.page || 1) - 1) * (pagination?.limit || 15)}
            visibleItemCount={payments.length}
            onPageChange={onPageChange}
            onItemsPerPageChange={onLimitChange}
            customOptions={[10, 15, 25, 50, 100]}
          />
        </div>
      </div>

      {/* Document Preview Modal */}
      {docPreview && (
        <DocumentPreviewModal
          attachment={docPreview}
          onClose={() => setDocPreview(null)}
        />
      )}
    </div>
  );
}
