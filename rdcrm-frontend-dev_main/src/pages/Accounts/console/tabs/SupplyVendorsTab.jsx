import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { axiosInstance } from "../../../../utils/url/config";
import { fmt } from "../utils/accountsFormatters";
import ManualVendorPaymentModal from "../modals/ManualVendorPaymentModal";
import SupplyVendorOverviewModal from "../modals/SupplyVendorOverviewModal";
import DocumentPreviewModal from "../modals/DocumentPreviewModal";
import Pagination from "../../../components/Pagination";
import { getUser } from "../../../../utils/permission/auth";

/* ---------- Scoped styles (responsive) ---------- */
const STYLES = `
.svt { padding: 1px; font-family: inherit; color: #0F172A; }
.svt * { box-sizing: border-box; }
.svt-mono { font-family: "JetBrains Mono", "Roboto Mono", Consolas, monospace; }

/* KPI cards */
.svt-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
.svt-kpi { border-radius: 10px; padding: 16px 16px 14px; border: 1px solid #E2E8F0; background: #fff; }
.svt-kpi-val { font-size: 20px; font-weight: 900; margin-bottom: 6px; }
.svt-kpi-lbl { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .2px; }
.svt-kpi.neutral .svt-kpi-lbl { color: #0F172A; }
.svt-kpi.green { background: #F0FDF4; border-color: #86EFAC; color: #15803D; }
.svt-kpi.red { background: #FEF2F2; border-color: #FCA5A5; color: #DC2626; }
.svt-kpi.teal { background: #F0FDFA; border-color: #99F6E4; color: #0F766E; }

/* Ledger banner */
.svt-banner { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;
  background: #F0FDFA; border: 1px solid #99F6E4; border-radius: 10px; padding: 12px 16px; margin-bottom: 16px; }
.svt-banner-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 0; font-size: 14px; font-weight: 900; color: #0F766E; }
.svt-badge-live { font-size: 10px; font-weight: 900; color: #0F766E; background: #CCFBF1; border: 1px solid #5EEAD4; border-radius: 6px; padding: 3px 8px; text-transform: uppercase; }
.svt-banner-sub { margin: 4px 0 0; font-size: 12px; color: #64748B; }
.svt-select { padding: 9px 14px; border-radius: 8px; border: 1px solid #CBD5E1; background: #fff; font-size: 13px; font-weight: 600; color: #0F172A; cursor: pointer; min-width: 140px; }
.svt-select:focus-visible, .svt button:focus-visible, .svt a:focus-visible { outline: 2px solid #0D9488; outline-offset: 2px; }

/* Vendor card */
.svt-list { display: flex; flex-direction: column; gap: 14px; }
.svt-card { background: #fff; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; }
.svt-card-head { display: flex; align-items: center; gap: 14px; padding: 14px 16px; cursor: pointer; flex-wrap: wrap; }
.svt-avatar { width: 42px; height: 42px; border-radius: 10px; background: #0F766E; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 14px; flex-shrink: 0; }
.svt-vinfo { flex: 1 1 200px; min-width: 0; }
.svt-vname { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 15px; font-weight: 900; margin: 0; }
.svt-chip { font-size: 10px; font-weight: 800; color: #334155; background: #F1F5F9; border: 1px solid #E2E8F0; border-radius: 4px; padding: 2px 6px; }
.svt-vsub { font-size: 12px; color: #64748B; margin-top: 3px; }
.svt-totals { display: grid; grid-template-columns: repeat(3, minmax(130px, 180px)); gap: 10px; }
.svt-tot { border-radius: 8px; padding: 8px 10px; text-align: center; border: 1px solid #E2E8F0; background: #fff; }
.svt-tot-lbl { font-size: 10px; font-weight: 900; text-transform: uppercase; color: #64748B; margin-bottom: 4px; }
.svt-tot-val { font-size: 13px; font-weight: 800; }
.svt-tot.green { background: #F0FDF4; border-color: #BBF7D0; }
.svt-tot.green .svt-tot-lbl, .svt-tot.green .svt-tot-val { color: #15803D; }
.svt-tot.red { background: #FEF2F2; border-color: #FECACA; }
.svt-tot.red .svt-tot-lbl, .svt-tot.red .svt-tot-val { color: #DC2626; }
.svt-toggle { width: 30px; height: 30px; border-radius: 50%; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 11px; flex-shrink: 0; transition: transform .2s; }
.svt-toggle.open { background: #0F766E; color: #fff; }
.svt-toggle.closed { background: #F1F5F9; color: #475569; }

.svt-body { border-top: 1px solid #E2E8F0; padding: 14px 16px 16px; }
.svt-section-title { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.svt-section-title h4 { margin: 0; font-size: 13px; font-weight: 900; text-transform: uppercase; }
.svt-section-title span { font-size: 11px; font-weight: 700; color: #64748B; }

/* PO block */
.svt-po { border: 1px solid #E2E8F0; border-radius: 10px; overflow: hidden; }
.svt-po + .svt-po { margin-top: 14px; }
.svt-po-head { background: #F8FAFC; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; border-bottom: 1px solid #E2E8F0; }
.svt-po-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.svt-po-no { font-size: 13px; font-weight: 900; color: #0F172A; }
.svt-pill { font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 6px; }
.svt-btn-ghost { background: #F0FDFA; border: 1px solid #99F6E4; color: #0F766E; border-radius: 6px; padding: 4px 10px; font-size: 11px; font-weight: 800; cursor: pointer; }
.svt-btn-ghost:hover { background: #CCFBF1; }
.svt-btn-pay { background: rgb(13, 148, 136); color: #fff; border: none; border-radius: 6px; padding: 6px 14px; font-size: 12px; font-weight: 800; cursor: pointer; white-space: nowrap; }
.svt-btn-pay:hover { background: rgb(13, 148, 136); }

/* Table */
.svt-table-wrap { overflow-x: auto; }
.svt-table { width: 100%; border-collapse: collapse; font-size: 12px; min-width: 640px; }
.svt-table th { padding: 10px 14px; font-size: 11px; font-weight: 900; color: #0F172A; text-transform: uppercase; text-align: left; border-bottom: 1px solid #E2E8F0; white-space: nowrap; }
.svt-table td { padding: 12px 14px; border-bottom: 1px solid #F1F5F9; vertical-align: middle; }
.svt-table tbody tr:hover { background: #FAFAFA; }
.svt-table tfoot td { font-weight: 900; background: #F8FAFC; border-top: 1px solid #E2E8F0; border-bottom: none; }
.svt-r { text-align: right !important; }
.svt-c { text-align: center !important; }
.svt-status { display: inline-block; padding: 3px 10px; border-radius: 6px; font-size: 10px; font-weight: 900; text-transform: uppercase; border: 1px solid; }
.svt-status.paid { background: #DCFCE7; color: #166534; border-color: #86EFAC; }
.svt-status.partial { background: #F5F3FF; color: #7C3AED; border-color: #DDD6FE; }
.svt-status.pending { background: #FEF3C7; color: #92400E; border-color: #FCD34D; }
.svt-link { font-size: 12px; font-weight: 800; color: #7C3AED; text-decoration: underline; margin-left: 6px; }
.svt-reject { display: inline-block; margin-top: 4px; font-size: 9px; font-weight: 900; color: #DC2626; background: #FEE2E2; padding: 2px 6px; border-radius: 4px; }

.svt-empty { text-align: center; padding: 48px 16px; background: #fff; border: 1px dashed #CBD5E1; border-radius: 12px; color: #64748B; font-weight: 700; font-size: 13px; }
.svt-skel { height: 74px; border-radius: 12px; background: linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 37%, #F1F5F9 63%); background-size: 400% 100%; animation: svtShimmer 1.4s ease infinite; }
@keyframes svtShimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }
@media (prefers-reduced-motion: reduce) { .svt-skel { animation: none; } .svt-toggle { transition: none; } }

/* Challan modal */
.svt-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.55); z-index: 1000; display: flex; justify-content: center; align-items: center; padding: 16px; }
.svt-modal { background: #fff; border-radius: 12px; width: 440px; max-width: 100%; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 20px 40px rgba(15,23,42,.25); }
.svt-modal-head { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #E2E8F0; }
.svt-modal-head h3 { margin: 0; font-size: 15px; font-weight: 900; }
.svt-close { background: #F1F5F9; border: none; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-weight: 900; color: #475569; }
.svt-modal-body { padding: 16px 20px 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
.svt-chl { border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px; background: #F8FAFC; }

/* Responsive */
@media (max-width: 1100px) {
  .svt-totals { grid-template-columns: repeat(3, minmax(0, 1fr)); flex: 1 1 100%; order: 3; }
}
@media (max-width: 900px) {
  .svt-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 560px) {
  .svt { padding: 10px; }
  .svt-kpi-val { font-size: 17px; }
  .svt-totals { grid-template-columns: 1fr; }
  .svt-tot { display: flex; justify-content: space-between; align-items: center; text-align: left; }
  .svt-tot-lbl { margin-bottom: 0; }
  .svt-select { width: 100%; }
  .svt-banner > div:last-child { width: 100%; }
}
`;

const initials = (name = "") =>
  name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";

export default function SupplyVendorsTab() {
  const [bills, setBills] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("All"); // "Pending", "Paid", "All"
  const [filterType, setFilterType] = useState("fy"); // "today", "week", "month", "fy"
  const [filterValue, setFilterValue] = useState(() => {
    const d = new Date();
    return (d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1).toString();
  });
  const [expandedVendor, setExpandedVendor] = useState(undefined);
  const toggleVendor = (vName, isImplicit) => {
    setExpandedVendor(prev => {
      if (prev === undefined && isImplicit) return null;
      return prev === vName ? null : vName;
    });
  };
  const [selectedChallans, setSelectedChallans] = useState(null);

  // Payment Modal State
  const [selectedBill, setSelectedBill] = useState(null);
  const [isSavingBill, setIsSavingBill] = useState(false);
  const [payMode, setPayMode] = useState("Bank Transfer");
  const [refNo, setRefNo] = useState("");
  const [previewTarget, setPreviewTarget] = useState(null);
  const [docPreview, setDocPreview] = useState(null);

  const getTodayStr = () => {
    const d = new Date();
    const mm = (d.getMonth() + 1).toString().padStart(2, "0");
    const dd = d.getDate().toString().padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
  };

  const handleFilterSelect = (type) => {
    setFilterType(type);
    setPage(1);
    const d = new Date();
    if (type === "due_today" || type === "sched_today" || type === "today") {
      setFilterValue(getTodayStr());
    } else if (type === "overdue") {
      setFilterValue("overdue");
    } else if (type === "week") {
      const year = d.getFullYear();
      const firstDay = new Date(year, 0, 1);
      const pastDays = (d - firstDay) / 86400000;
      const weekNum = Math.ceil((pastDays + firstDay.getDay() + 1) / 7);
      setFilterValue(`${year}-W${weekNum.toString().padStart(2, "0")}`);
    } else if (type === "month") {
      const m = (d.getMonth() + 1).toString().padStart(2, "0");
      setFilterValue(`${d.getFullYear()}-${m}`);
    } else if (type === "fy") {
      const fyYear = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
      setFilterValue(fyYear.toString());
    } else {
      setFilterValue("");
    }
  };

  const toggleQuickFilter = (type) => {
    if (filterType === type) {
      handleFilterSelect("fy");
    } else {
      handleFilterSelect(type);
    }
  };

  const fetchBills = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        page,
        limit,
      });
      if (filterType && filterType !== "all" && filterValue) {
        params.append("filterType", filterType);
        params.append("filterValue", filterValue);
      }
      const res = await axiosInstance.get(`/accounts/vendor-bills?${params.toString()}`);
      if (res.data?.success) {
        setBills(res.data.data || []);
        if (res.data.pagination) {
          setTotalPages(res.data.pagination.totalPages || 1);
          setTotalRecords(res.data.pagination.total || 0);
        }
      }
    } catch (err) {
      toast.error("Failed to load supply vendor bills.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, filterType, filterValue, page, limit]);

  const handlePay = async (payload) => {
    setIsSavingBill(true);
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
        `/accounts/vendor-bills/${selectedBill._id}/pay`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      if (res.data?.success) {
        toast.success(res.data.message || "Payment recorded successfully!");
        setSelectedBill(null);
        fetchBills(); // Refresh list
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to process payment.");
    } finally {
      setIsSavingBill(false);
    }
  };

  // Grouping bills by vendor, then by PO number
  const groupedBills = {};
  bills.forEach(b => {
    const vName = b.vendor_name || b.vendor_id?.name || "Unknown Vendor";
    if (!groupedBills[vName]) groupedBills[vName] = {};
    const po = b.po_number || "Unknown PO";
    if (!groupedBills[vName][po]) groupedBills[vName][po] = [];
    groupedBills[vName][po].push(b);
  });

  // Display-only totals (derived from loaded bills)
  const sumAmt = list => list.reduce((acc, b) => acc + (Number(b.payable_amount) || 0), 0);
  const sumPaid = list => list.reduce((acc, b) => acc + (Number(b.paid_amount !== undefined ? b.paid_amount : (b.status === "Paid" ? b.payable_amount : 0)) || 0), 0);
  const sumDue = list => list.reduce((acc, b) => acc + (Number(b.balance_due !== undefined ? b.balance_due : (b.status === "Paid" ? 0 : b.payable_amount)) || 0), 0);

  const vendorTotals = vendor => {
    const all = Object.values(groupedBills[vendor]).flat();
    const total = sumAmt(all);
    const paid = sumPaid(all);
    const due = Math.max(0, Math.round((total - paid) * 100) / 100);
    return { all, total, paid, due };
  };
  const vendorNames = Object.keys(groupedBills).sort();
  const grandTotal = sumAmt(bills);
  const grandPaid = sumPaid(bills);
  const grandDue = Math.max(0, Math.round((grandTotal - grandPaid) * 100) / 100);
  const clearedVendors = vendorNames.filter(v => vendorTotals(v).due <= 0).length;

  return (
    <div className="svt">
      <style>{STYLES}</style>

      {/* KPI Summary */}
      <div className="svt-kpis">
        <div className="svt-kpi neutral">
          <div className="svt-kpi-val svt-mono">₹ {fmt(grandTotal)}</div>
          <div className="svt-kpi-lbl">Total supply bills</div>
        </div>
        <div className="svt-kpi green">
          <div className="svt-kpi-val svt-mono">₹ {fmt(grandPaid)}</div>
          <div className="svt-kpi-lbl">Total paid so far</div>
        </div>
        <div className="svt-kpi red">
          <div className="svt-kpi-val svt-mono">₹ {fmt(grandDue)}</div>
          <div className="svt-kpi-lbl">Total outstanding payable</div>
        </div>
        <div className="svt-kpi teal">
          <div className="svt-kpi-val svt-mono">{clearedVendors} / {vendorNames.length}</div>
          <div className="svt-kpi-lbl">Fully cleared vendors</div>
        </div>
      </div>

      {/* Ledger Banner + Filter */}
      <div className="svt-banner">
        <div>
          <h2 className="svt-banner-title">
            🚚 Supply Vendor Payables
            <span className="svt-badge-live">
              {statusFilter} · {
                filterType === "overdue" ? "Overdue Bills" :
                  filterType === "due_today" ? `Due on ${filterValue}` :
                    filterType === "sched_today" ? `Scheduled on ${filterValue}` :
                      filterType === "today" ? `Today (${filterValue})` :
                        filterType === "week" ? "By Week" :
                          filterType === "month" ? "By Month" :
                            filterType === "all" ? "All Dates" :
                              `FY ${filterValue}`
              }
            </span>
          </h2>
          <p className="svt-banner-sub">
            Track supply bills grouped by vendor and PO. Supports full and partial payments. Click <b>Pay</b> to record payment.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* Quick Buttons */}
          <button
            type="button"
            onClick={() => toggleQuickFilter("due_today")}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              transition: "all 0.15s ease",
              border: filterType === "due_today" ? "1.5px solid #EA580C" : "1px solid #CBD5E1",
              background: filterType === "due_today" ? "#FFF7ED" : "#FFFFFF",
              color: filterType === "due_today" ? "#C2410C" : "#475569",
              boxShadow: filterType === "due_today" ? "0 1px 3px rgba(234, 88, 12, 0.2)" : "none"
            }}
            title="Filter bills where Due Date is today"
          >
            <span>⏰</span> Due Today
            {filterType === "due_today" && <span style={{ fontSize: 10, marginLeft: 2, fontWeight: 900 }}>✕</span>}
          </button>

          <button
            type="button"
            onClick={() => toggleQuickFilter("sched_today")}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              transition: "all 0.15s ease",
              border: filterType === "sched_today" ? "1.5px solid #0284C7" : "1px solid #CBD5E1",
              background: filterType === "sched_today" ? "#F0F9FF" : "#FFFFFF",
              color: filterType === "sched_today" ? "#0369A1" : "#475569",
              boxShadow: filterType === "sched_today" ? "0 1px 3px rgba(2, 132, 199, 0.2)" : "none"
            }}
            title="Filter bills where Scheduled Payment date is today"
          >
            <span>🗓️</span> Sched Today
            {filterType === "sched_today" && <span style={{ fontSize: 10, marginLeft: 2, fontWeight: 900 }}>✕</span>}
          </button>

          <button
            type="button"
            onClick={() => toggleQuickFilter("overdue")}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              transition: "all 0.15s ease",
              border: filterType === "overdue" ? "1.5px solid #DC2626" : "1px solid #CBD5E1",
              background: filterType === "overdue" ? "#FEF2F2" : "#FFFFFF",
              color: filterType === "overdue" ? "#DC2626" : "#475569",
              boxShadow: filterType === "overdue" ? "0 1px 3px rgba(220, 38, 38, 0.2)" : "none"
            }}
            title="Filter bills that are overdue"
          >
            <span>⚠️</span> Overdue
            {filterType === "overdue" && <span style={{ fontSize: 10, marginLeft: 2, fontWeight: 900 }}>✕</span>}
          </button>

          {/* Status Filter */}
          <select
            className="svt-select"
            value={statusFilter}
            onChange={e => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filter bills by status"
            style={{ minWidth: 140 }}
          >
            <option value="Pending">Pending & Partial Due</option>
            <option value="Partial Paid">Partial Paid</option>
            <option value="Paid">Fully Paid</option>
            <option value="All">All Statuses</option>
          </select>

          {/* Date Filter Type */}
          <select
            className="svt-select"
            value={["week", "month", "fy", "all"].includes(filterType) ? filterType : ""}
            onChange={e => handleFilterSelect(e.target.value)}
            aria-label="Filter bills by date range"
            style={{ minWidth: 140 }}
          >
            {!["week", "month", "fy", "all"].includes(filterType) && (
              <option value="" disabled hidden>
                Date Range
              </option>
            )}
            <option value="week">By Week</option>
            <option value="month">By Month</option>
            <option value="fy">By Financial Year</option>
            <option value="all">All Dates</option>
          </select>

          {filterType === "week" && (
            <input
              type="week"
              className="svt-select"
              style={{ minWidth: 140 }}
              value={filterValue}
              onChange={e => {
                setFilterValue(e.target.value);
                setPage(1);
              }}
            />
          )}

          {filterType === "month" && (
            <input
              type="month"
              className="svt-select"
              style={{ minWidth: 130 }}
              value={filterValue}
              onChange={e => {
                setFilterValue(e.target.value);
                setPage(1);
              }}
            />
          )}

          {filterType === "fy" && (
            <select
              className="svt-select"
              style={{ minWidth: 140 }}
              value={filterValue}
              onChange={e => {
                setFilterValue(e.target.value);
                setPage(1);
              }}
            >
              {Array.from({ length: 6 }, (_, i) => {
                const yr = new Date().getFullYear() - 5 + i;
                return (
                  <option key={yr} value={yr}>
                    {yr} - {yr + 1}
                  </option>
                );
              })}
            </select>
          )}
        </div>
      </div>

      {/* Vendor List */}
      {loading ? (
        <div className="svt-list">
          {[0, 1, 2].map(i => <div key={i} className="svt-skel" />)}
        </div>
      ) : bills.length === 0 ? (
        <div className="svt-empty">No {statusFilter.toLowerCase()} bills found.</div>
      ) : (
        <div className="svt-list">
          {vendorNames.map((vendor, index) => {
            const isImplicit = expandedVendor === undefined && index === 0;
            const isOpen = expandedVendor === vendor || isImplicit;
            const t = vendorTotals(vendor);
            const first = t.all[0] || {};
            const phone = first.vendor_id?.phone || first.vendor_id?.mobile || "";
            const gst = first.vendor_id?.gst || first.vendor_id?.gstNo || "";

            return (
              <div key={vendor} className="svt-card">
                {/* Vendor Header */}
                <div
                  className="svt-card-head"
                  onClick={() => toggleVendor(vendor, isImplicit)}
                  role="button"
                  tabIndex={0}
                  aria-expanded={isOpen}
                  onKeyDown={e => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggleVendor(vendor, isImplicit))}
                >
                  <div className="svt-avatar">{initials(vendor)}</div>

                  <div className="svt-vinfo">
                    <h3 className="svt-vname">
                      {vendor}
                      {gst && <span className="svt-chip">GST: {gst}</span>}
                      <span className="svt-chip">{t.all.length} Bill{t.all.length > 1 ? "s" : ""}</span>
                    </h3>
                    <div className="svt-vsub">
                      {Object.keys(groupedBills[vendor]).length} PO{Object.keys(groupedBills[vendor]).length > 1 ? "s" : ""}
                      {phone && <> &nbsp;📞 {phone}</>}
                    </div>
                  </div>

                  <div className="svt-totals">
                    <div className="svt-tot">
                      <div className="svt-tot-lbl">Total bill</div>
                      <div className="svt-tot-val svt-mono">₹ {fmt(t.total)}</div>
                    </div>
                    <div className="svt-tot green">
                      <div className="svt-tot-lbl">Paid</div>
                      <div className="svt-tot-val svt-mono">₹ {fmt(t.paid)}</div>
                    </div>
                    <div className="svt-tot red">
                      <div className="svt-tot-lbl">Payable due</div>
                      <div className="svt-tot-val svt-mono">₹ {fmt(t.due)}</div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={`svt-toggle ${isOpen ? "open" : "closed"}`}
                    onClick={e => { e.stopPropagation(); toggleVendor(vendor, isImplicit); }}
                    aria-label={isOpen ? "Collapse vendor" : "Expand vendor"}
                  >
                    {isOpen ? "▲" : "▼"}
                  </button>
                </div>

                {isOpen && (
                  <div className="svt-body">
                    <div className="svt-section-title">
                      <h4>🧾 Purchase orders & bills ({t.all.length})</h4>
                      <span>Payments reflect immediately after saving</span>
                    </div>

                    {Object.keys(groupedBills[vendor]).sort().map(po => {
                      const poBills = groupedBills[vendor][po];
                      const rfq = poBills[0]?.rfq_id || {};
                      const productName = poBills[0]?.product_name || rfq.name || "";
                      const productSpecs = poBills[0]?.product_specs || rfq.specs || "";
                      const displayJobNo = rfq.subJobNo || rfq.jobNo || "";
                      const jobLabel = rfq.subJobNo ? "SubJob" : "Job";
                      const award = rfq.awards?.find(a => a.poNumber === po);
                      const orderedQty = award?.qty || 0;
                      const billedQty = poBills.reduce((acc, b) => acc + (Number(b.received_qty) || 0), 0);
                      const fullyBilled = billedQty >= orderedQty;

                      return (
                        <div key={po} className="svt-po">
                          {/* PO Header */}
                          <div className="svt-po-head">
                            <div className="svt-po-meta">
                              <span className="svt-po-no">PO: {po}</span>
                              {productName && (
                                <span
                                  className="svt-chip"
                                  style={{
                                    background: "#F8FAFC",
                                    color: "#0F172A",
                                    border: "1px solid #CBD5E1",
                                    fontWeight: 800,
                                    fontSize: 11,
                                    padding: "2px 8px",
                                    borderRadius: 4,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4
                                  }}
                                  title={productSpecs ? `Specs: ${productSpecs}` : productName}
                                >
                                  📦 {productName}
                                  {productSpecs && (
                                    <span style={{ color: "#64748B", fontWeight: 600 }}>({productSpecs})</span>
                                  )}
                                </span>
                              )}
                              {displayJobNo && <span className="svt-chip">{jobLabel}: {displayJobNo}</span>}
                              <span className="svt-pill" style={{ color: "#0369A1", background: "#E0F2FE" }}>
                                Ordered: {orderedQty}
                              </span>
                              <span
                                className="svt-pill"
                                style={{
                                  color: fullyBilled ? "#15803D" : "#A16207",
                                  background: fullyBilled ? "#DCFCE7" : "#FEF9C3",
                                }}
                              >
                                Billed: {billedQty}
                              </span>
                            </div>
                            <div className="svt-po-meta">
                              {award?.inwardChallans && award.inwardChallans.length > 0 && (
                                <button
                                  type="button"
                                  className="svt-btn-ghost"
                                  onClick={() => setSelectedChallans({ po, challans: award.inwardChallans })}
                                >
                                  👁 View challans
                                </button>
                              )}
                              <span className="svt-chip">
                                {poBills.length} Bill{poBills.length > 1 ? "s" : ""}
                              </span>
                            </div>
                          </div>

                          {/* Bills Table */}
                          <div className="svt-table-wrap">
                            <table className="svt-table">
                              <thead>
                                <tr>
                                  {/* <th>Date</th> */}
                                  <th>Due Date</th>
                                  <th>Docs (Inv)</th>
                                  <th className="svt-r">Recv qty</th>
                                  <th className="svt-r">Bill Amt (₹)</th>
                                  <th className="svt-r">Paid (₹)</th>
                                  <th className="svt-r">Due (₹)</th>
                                  <th className="svt-c">Status</th>
                                  <th className="svt-c">Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {poBills.map(b => {
                                  const rowAward = b.rfq_id?.awards?.find(a => a.poNumber === b.po_number);
                                  const bTotal = Number(b.payable_amount || 0);
                                  const bPaid = Number(b.paid_amount !== undefined ? b.paid_amount : (b.status === "Paid" ? bTotal : 0));
                                  const bDue = Number(b.balance_due !== undefined ? b.balance_due : (b.status === "Paid" ? 0 : Math.max(0, bTotal - bPaid)));
                                  const bRecvQty = Number(b.received_qty || 0);
                                  const bPaidQty = Number(b.paid_qty !== undefined ? b.paid_qty : (b.status === "Paid" ? bRecvQty : 0));
                                  const isQtyCleared = bRecvQty > 0 && bPaidQty >= bRecvQty;
                                  const isCleared = b.status === "Paid" || bDue <= 0 || isQtyCleared;
                                  const isDue = !isCleared;
                                  const statusClass = isCleared ? "paid" : (bPaid > 0 ? "partial" : "pending");

                                  return (
                                    <tr key={b._id}>
                                      {/* <td style={{ fontWeight: 600 }}>
                                        {new Date(b.receipt_date || b.createdAt).toLocaleDateString("en-GB")}
                                      </td> */}
                                      <td style={{ fontWeight: 600 }}>
                                        <div style={{ color: (isDue && b.due_date && new Date(new Date(b.due_date).setHours(0, 0, 0, 0)).getTime() < new Date(new Date().setHours(0, 0, 0, 0)).getTime()) ? "#DC2626" : "inherit", display: "flex", alignItems: "center", gap: 5 }}>
                                          <span>{b.due_date ? new Date(b.due_date).toLocaleDateString("en-GB") : "—"}</span>
                                          {isDue && b.due_date && new Date(new Date(b.due_date).setHours(0, 0, 0, 0)).getTime() < new Date(new Date().setHours(0, 0, 0, 0)).getTime() && (
                                            <span style={{ fontSize: 9, fontWeight: 900, color: "#DC2626", background: "#FEE2E2", border: "1px solid #FECACA", padding: "1px 5px", borderRadius: 4 }}>
                                              Overdue
                                            </span>
                                          )}
                                        </div>
                                        {(b.scheduled_date || b.scheduledDate) && (
                                          <div
                                            style={{
                                              fontSize: 10,
                                              fontWeight: 800,
                                              color: "#0369A1",
                                              background: "#E0F2FE",
                                              border: "1px solid #BAE6FD",
                                              padding: "1px 6px",
                                              borderRadius: 4,
                                              marginTop: 3,
                                              display: "inline-flex",
                                              alignItems: "center",
                                              gap: 3,
                                              whiteSpace: "nowrap",
                                            }}
                                            title={`Scheduled payment date: ${new Date(b.scheduled_date || b.scheduledDate).toLocaleDateString("en-GB")}`}
                                          >
                                            <span>🗓️</span> Sched: {new Date(b.scheduled_date || b.scheduledDate).toLocaleDateString("en-GB")}
                                          </div>
                                        )}
                                      </td>
                                      <td style={{ fontWeight: 800 }}>
                                        {b.invoice_no ? (
                                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                            <span className="svt-mono">{b.invoice_no}</span>
                                            {b.invoice_url && (
                                              <button
                                                type="button"
                                                className="svt-link"
                                                style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
                                                onClick={() =>
                                                  setDocPreview({
                                                    url: `${import.meta.env.VITE_BACKEND_URL}/image/view?url=${encodeURIComponent(b.invoice_url)}`,
                                                    name: `${b.invoice_no}_invoice.pdf`,
                                                  })
                                                }
                                                title="Preview Invoice PDF"
                                              >
                                                View ↗
                                              </button>
                                            )}
                                          </div>
                                        ) : (
                                          <span style={{ color: "#94A3B8" }}>—</span>
                                        )}
                                      </td>
                                      <td className="svt-r svt-mono" style={{ fontWeight: 800 }}>
                                        {b.received_qty}
                                        {bPaidQty > 0 && bPaidQty < bRecvQty && (
                                          <div style={{ fontSize: 10, color: "#166534", fontWeight: 700 }}>
                                            Paid: {bPaidQty} (Bal: {bRecvQty - bPaidQty})
                                          </div>
                                        )}
                                      </td>
                                      <td className="svt-r svt-mono" style={{ fontWeight: 800 }}>
                                        ₹ {fmt(bTotal)}
                                      </td>
                                      <td className="svt-r svt-mono" style={{ fontWeight: 800, color: bPaid > 0 ? "#15803D" : "#64748B" }}>
                                        ₹ {fmt(bPaid)}
                                      </td>
                                      <td className="svt-r svt-mono" style={{ fontWeight: 800, color: bDue > 0 ? "#DC2626" : "#15803D" }}>
                                        ₹ {fmt(bDue)}
                                      </td>
                                      <td className="svt-c">
                                        <span className={`svt-status ${statusClass}`}>
                                          {isCleared ? "Paid" : (b.status || (isDue ? "Pending" : "Paid"))}
                                        </span>
                                      </td>
                                      <td className="svt-c">
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, flexWrap: "wrap" }}>
                                          {bPaid > 0 && (
                                            <button
                                              type="button"
                                              className="svt-btn-ghost"
                                              style={{ fontSize: 11, padding: "5px 8px", whiteSpace: "nowrap" }}
                                              onClick={() => setPreviewTarget({
                                                vendorId: b.vendor_id?._id || b.vendor_id,
                                                vendorName: b.vendor_name || b.vendor_id?.name || "Vendor",
                                                bill_no: b.invoice_no || b.challan_no,
                                                amount: bTotal,
                                                paid: bPaid,
                                                outstanding: bDue,
                                                due: bDue,
                                                jobNo: b.rfq_id?.jobNo || "",
                                                subJobNo: b.rfq_id?.subJobNo || "",
                                                productName: b.product_name || b.rfq_id?.name || "",
                                                product_name: b.product_name || b.rfq_id?.name || "",
                                                productSpecs: b.product_specs || b.rfq_id?.specs || "",
                                                isSupplyVendor: true
                                              })}
                                              title="View payment receipt vouchers"
                                            >
                                              👁️ Overview
                                            </button>
                                          )}
                                          {isDue ? (
                                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                                              {b.stage && !["approved", "scheduled", "partial", "paid"].includes(b.stage) && (
                                                <span style={{ fontSize: 9, fontWeight: 900, color: "#D97706", background: "#FEF3C7", padding: "2px 6px", borderRadius: 4 }}>
                                                  ⏳ Pending Approval
                                                </span>
                                              )}
                                              <button
                                                type="button"
                                                className="svt-btn-pay"
                                                onClick={() => {
                                                  if (b.stage && !["approved", "scheduled", "partial", "paid"].includes(b.stage)) {
                                                    toast.error("Payment Blocked: Bill must be marked 'Approved for Payment' in Purchase Accounts first.");
                                                    return;
                                                  }
                                                  setSelectedBill({
                                                    ...b,
                                                    productName: b.product_name || b.rfq_id?.name || "",
                                                    product_name: b.product_name || b.rfq_id?.name || "",
                                                    productSpecs: b.product_specs || b.rfq_id?.specs || ""
                                                  });
                                                }}
                                              >
                                                💳 Pay {bPaid > 0 ? "Bal" : "Now"}
                                              </button>
                                            </div>
                                          ) : (
                                            <div>
                                              <span className="svt-mono" style={{ fontSize: 10, color: "#166534", fontWeight: 900 }}>
                                                ✓ CLEARED
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot>
                                <tr>
                                  <td colSpan={2}>Total for PO {po}</td>
                                  <td className="svt-r svt-mono">{billedQty}</td>
                                  <td className="svt-r svt-mono">₹ {fmt(sumAmt(poBills))}</td>
                                  <td className="svt-r svt-mono" style={{ color: "#15803D" }}>₹ {fmt(sumPaid(poBills))}</td>
                                  <td className="svt-r svt-mono" style={{ color: "#DC2626" }}>₹ {fmt(sumDue(poBills))}</td>
                                  <td colSpan={2} />
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      );
                    })}

                    {/* Vendor-level Overview Button */}
                    {t.paid > 0 && (
                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
                        <button
                          type="button"
                          className="svt-btn-ghost"
                          style={{ padding: "6px 14px", fontSize: 12, display: "flex", alignItems: "center", gap: 6, fontWeight: 800 }}
                          onClick={() => {
                            const firstBill = t.all[0] || {};
                            setPreviewTarget({
                              vendorId: firstBill.vendor_id?._id || firstBill.vendor_id,
                              vendorName: vendor,
                              bill_no: `${t.all.length} Bills`,
                              amount: t.total,
                              paid: t.paid,
                              outstanding: t.due,
                              due: t.due,
                              isSupplyVendor: true
                            });
                          }}
                        >
                          👁️ Vendor Payments Overview ({vendor})
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalRecords > 0 && (
        <div style={{ marginTop: 24 }}>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={(newPage) => setPage(newPage)}
            itemsPerPage={limit}
            onItemsPerPageChange={(newLimit) => {
              setLimit(Number(newLimit));
              setPage(1);
            }}
            totalCount={totalRecords}
            startIndex={(page - 1) * limit}
            visibleItemCount={vendorNames.length}
            customOptions={[5, 10, 20, 50]}
          />
        </div>
      )}

      {/* Payment Modal using rich manual payment modal */}
      {selectedBill && (
        <ManualVendorPaymentModal
          target={{
            id: selectedBill.vendor_id?._id || selectedBill.vendor_id,
            vendorId: selectedBill.vendor_id?._id || selectedBill.vendor_id,
            vendorName: selectedBill.vendor_name || selectedBill.vendor_id?.name || "Vendor",
            bill_no: selectedBill.invoice_no || selectedBill.challan_no,
            amount: Number(selectedBill.payable_amount || 0),
            paid: Number(selectedBill.paid_amount || 0),
            due: Number(selectedBill.balance_due !== undefined ? selectedBill.balance_due : (Number(selectedBill.payable_amount || 0) - Number(selectedBill.paid_amount || 0))),
            outstanding: Number(selectedBill.balance_due !== undefined ? selectedBill.balance_due : (Number(selectedBill.payable_amount || 0) - Number(selectedBill.paid_amount || 0))),
            jobNo: selectedBill.rfq_id?.jobNo || "",
            subJobNo: selectedBill.rfq_id?.subJobNo || "",
            isSupplyVendor: true,
            received_qty: Number(selectedBill.received_qty || 0),
            paid_qty: Number(selectedBill.paid_qty || 0),
            unit_rate: Number(selectedBill.po_unit_rate || (selectedBill.received_qty > 0 ? selectedBill.payable_amount / selectedBill.received_qty : 0)),
            gst_rate: selectedBill.vendor_id?.gst_rate !== undefined
              ? selectedBill.vendor_id.gst_rate
              : (selectedBill.vendor_id?.gst_tax?.tax_rate !== undefined ? selectedBill.vendor_id.gst_tax.tax_rate : selectedBill.gst_rate),
            tds_rate: selectedBill.vendor_id?.tds_rate !== undefined
              ? selectedBill.vendor_id.tds_rate
              : (selectedBill.vendor_id?.tds_tax?.tax_rate !== undefined ? selectedBill.vendor_id.tds_tax.tax_rate : 0),
          }}
          onClose={() => setSelectedBill(null)}
          onSave={handlePay}
          isSaving={isSavingBill}
        />
      )}

      {/* Vendor Payment Receipt & Overview Modal */}
      {previewTarget && (
        <SupplyVendorOverviewModal
          target={previewTarget}
          onClose={() => setPreviewTarget(null)}
          onPayAgain={(t) => {
            setPreviewTarget(null);
            const matchingBill = bills.find(b => (b.invoice_no && b.invoice_no === t.bill_no) || (b.vendor_id?._id === t.vendorId || b.vendor_id === t.vendorId));
            if (matchingBill) {
              setSelectedBill(matchingBill);
            }
          }}
        />
      )}

      {/* Challan Modal */}
      {selectedChallans && (
        <div className="svt-overlay" onClick={() => setSelectedChallans(null)}>
          <div className="svt-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <div className="svt-modal-head">
              <h3>PO: {selectedChallans.po} · Challans</h3>
              <button type="button" className="svt-close" onClick={() => setSelectedChallans(null)} aria-label="Close">✕</button>
            </div>

            <div className="svt-modal-body scrollbar-thin scrollbar-track-gray-300 scrollbar-thumb-gray-300">
              {selectedChallans.challans.map((chl, idx) => (
                <div key={idx} className="svt-chl">
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, gap: 8 }}>
                    <span className="svt-mono" style={{ fontSize: 13, fontWeight: 800 }}>CHL: {chl.challanNo}</span>
                    <span style={{ fontSize: 11, fontWeight: 900, color: "#15803D", background: "#DCFCE7", padding: "2px 8px", borderRadius: 6 }}>
                      {chl.qty} qty
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>
                      {chl.date ? new Date(chl.date).toLocaleDateString("en-GB") : ""}
                    </span>
                    {(chl.docUrl || chl.fileUrl) && (
                      <button
                        type="button"
                        className="svt-link"
                        style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
                        onClick={() =>
                          setDocPreview({
                            url: `${import.meta.env.VITE_BACKEND_URL}/image/view?url=${encodeURIComponent(chl.docUrl || chl.fileUrl)}`,
                            name: `${chl.challanNo || "Challan"}_doc`,
                          })
                        }
                        title="Preview Challan Document"
                      >
                        View doc ↗
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {selectedChallans.challans.length === 0 && (
                <p style={{ textAlign: "center", color: "#64748B", fontSize: 13, margin: 0 }}>No challans found.</p>
              )}
            </div>
          </div>
        </div>
      )}

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