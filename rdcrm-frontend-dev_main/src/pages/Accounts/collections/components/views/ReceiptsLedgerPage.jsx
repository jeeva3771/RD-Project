import React, { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "react-toastify";
import { axiosInstance, backendUrl } from "../../../../../utils/url/config";
import Pagination from "../../../../components/Pagination";
import { inr } from "../../utils/collectionsFormatters";
import CollectionIcon from "../common/CollectionIcon";

export default function ReceiptsLedgerPage({
  cases = [],
  ownerFilterFromMode,
  groupBy,
  entityFilter,
}) {
  const resolveProofLink = (rawUrl) => {
    if (!rawUrl) return "";
    if (rawUrl.startsWith("data:") || rawUrl.includes("X-Amz-Signature") || rawUrl.includes("AWSAccessKeyId")) {
      return rawUrl;
    }
    const base = backendUrl ? backendUrl.replace(/\/$/, "") : "";
    return `${base}/image/view?url=${encodeURIComponent(rawUrl)}`;
  };

  const [receiptsList, setReceiptsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [modeFilter, setModeFilter] = useState("all");
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 25,
    totalPages: 1,
    totalItems: 0,
    totalAll: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [totals, setTotals] = useState({
    totalAmount: 0,
    totalSettled: 0,
    totalTds: 0,
  });
  const [previewProof, setPreviewProof] = useState(null);
  const [loadingProof, setLoadingProof] = useState(false);

  const handleOpenProof = async (att, receipt) => {
    let rawUrl = att?.url || (typeof att === "string" ? att : receipt?.attachment || "");
    if (!rawUrl) return;
    const name = att?.name || receipt?.attachmentName || `Proof-${receipt?.receiptNo || "file"}`;

    let resolvedUrl = rawUrl;
    if (!resolvedUrl.startsWith("data:") && !resolvedUrl.includes("X-Amz-Signature") && !resolvedUrl.includes("AWSAccessKeyId")) {
      setLoadingProof(true);
      try {
        const res = await axiosInstance.get("/accounts/signed-url", { params: { url: rawUrl } });
        if (res.data?.success && res.data?.signedUrl) {
          resolvedUrl = res.data.signedUrl;
        }
      } catch (err) {
        console.warn("Could not sign URL on the fly:", err);
      }
      if (!resolvedUrl.includes("X-Amz-Signature") && !resolvedUrl.includes("AWSAccessKeyId") && !resolvedUrl.startsWith("data:")) {
        const base = backendUrl ? backendUrl.replace(/\/$/, "") : "";
        resolvedUrl = `${base}/image/view?url=${encodeURIComponent(rawUrl)}`;
      }
      setLoadingProof(false);
    }

    setPreviewProof({
      url: resolvedUrl,
      rawUrl: rawUrl,
      name,
      receiptNo: receipt?.receiptNo || "—",
      client: receipt?.client || "—",
      invoiceNo: receipt?.invoiceNo || "—",
      amount: receipt?.amount || 0,
      mode: receipt?.mode || "—",
      date: receipt?.date || "—",
      confirmedBy: receipt?.confirmedBy || "—",
    });
  };

  // Close proof preview modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && previewProof) {
        setPreviewProof(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewProof]);

  // Debounce search term by 350ms so typing does not spam server requests
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Reset page to 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, modeFilter, pageSize, ownerFilterFromMode, entityFilter, groupBy]);

  // Server-side fetch from /accounts/collections/receipts
  const fetchReceipts = useCallback(
    async (targetPage = currentPage, targetPageSize = pageSize, targetSearch = debouncedSearch, targetMode = modeFilter) => {
      setLoading(true);
      try {
        const params = {
          page: targetPage,
          limit: targetPageSize,
        };
        if (targetSearch && targetSearch.trim()) {
          params.search = targetSearch.trim();
        }
        if (targetMode && targetMode !== "all") {
          params.mode = targetMode;
        }
        if (ownerFilterFromMode) {
          params.owner = ownerFilterFromMode;
        }
        if (entityFilter) {
          if (groupBy === "client") params.client = entityFilter;
          if (groupBy === "officer") params.owner = entityFilter;
        }

        const res = await axiosInstance.get("/accounts/collections/receipts", { params });
        if (res.data?.success) {
          setReceiptsList(res.data.data || []);
          if (res.data.pagination) {
            setPagination(res.data.pagination);
          } else {
            const tot = res.data.totalCount || (res.data.data || []).length;
            const lim = targetPageSize === "all" ? tot : Number(targetPageSize);
            setPagination({
              currentPage: targetPage,
              pageSize: targetPageSize,
              totalPages: Math.max(1, Math.ceil(tot / (lim || 1))),
              totalItems: tot,
              totalAll: tot,
              hasNextPage: false,
              hasPrevPage: targetPage > 1,
            });
          }
          if (res.data.totals) {
            setTotals(res.data.totals);
          } else if (res.data.totalReceipts !== undefined) {
            setTotals({
              totalAmount: res.data.totalReceipts || 0,
              totalSettled: res.data.totalSettled || 0,
              totalTds: res.data.totalTds || 0,
            });
          }
        }
      } catch (err) {
        console.error("Failed to load server-side receipts ledger:", err);
        toast.error("Failed to load receipts ledger from server");
      } finally {
        setLoading(false);
      }
    },
    [currentPage, pageSize, debouncedSearch, modeFilter, ownerFilterFromMode, entityFilter, groupBy]
  );

  // Trigger fetch when parameters change
  useEffect(() => {
    fetchReceipts(currentPage, pageSize, debouncedSearch, modeFilter);
  }, [fetchReceipts, currentPage, pageSize, debouncedSearch, modeFilter, ownerFilterFromMode, entityFilter, groupBy]);

  const caseMap = useMemo(() => {
    return new Map((cases || []).map((c) => [(c.client || "").toLowerCase(), c]));
  }, [cases]);

  const rows = useMemo(() => {
    return (receiptsList || []).map((r) => {
      const client = r.client && r.client !== "Client" ? r.client : (r.client || "—");
      const c = caseMap.get((client || "").toLowerCase());
      const owner = r.confirmedBy || c?.owner || "—";
      return { ...r, client, owner };
    });
  }, [receiptsList, caseMap]);

  const totalItems = pagination.totalItems || 0;
  const totalPages = pagination.totalPages || 1;

  return (
    <div className="w-full px-4 sm:px-6 py-4 space-y-3.5">
      {/* Receipts Ledger Header Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
            <span>Receipts Ledger</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              {totalItems} receipts
            </span>
            {loading && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                <CollectionIcon name="refresh" size={11} className="animate-spin" /> Fetching...
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Server-side filtered payments confirmed in Accounts against collection cases.
          </p>
        </div>

        {/* Server-Side Filter & Metric Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Quick Search */}
          <div className="relative">
            <CollectionIcon
              name="search"
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search receipt, client, invoice, UTR..."
              className="pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 w-56 sm:w-64 transition"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Mode Dropdown */}
          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none cursor-pointer hover:bg-slate-50 transition"
          >
            <option value="all">All Modes</option>
            <option value="bank">Bank Transfer (NEFT/RTGS)</option>
            <option value="cash">Cash</option>
            <option value="cheque">Cheque</option>
            <option value="upi">UPI / GPay</option>
          </select>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => fetchReceipts(currentPage, pageSize, debouncedSearch, modeFilter)}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition disabled:opacity-50"
            title="Refresh live receipts ledger from server"
          >
            <CollectionIcon name="refresh" size={13} className={loading ? "animate-spin" : ""} />
            <span>{loading ? "Loading..." : "Refresh"}</span>
          </button>

          {/* Aggregated Total Metric Box */}
          <div className="bg-white rounded-xl border border-slate-200 px-3.5 py-1.5 shadow-2xs text-right">
            <div className="text-base font-black text-emerald-700 font-mono">
              {inr(totals.totalAmount)}
            </div>
            <div className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
              {totalItems} receipts {pagination.totalAll > totalItems ? `(of ${pagination.totalAll})` : "total"}
            </div>
          </div>
        </div>
      </div>

      {/* Main Full-Width Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="text-left px-3 py-3 font-bold">Date</th>
                <th className="text-left px-3 py-3 font-bold">Client</th>
                <th className="text-left px-3 py-3 font-bold">Invoice No</th>
                <th className="text-right px-4 py-3 font-bold">Amount</th>
                <th className="text-center px-3 py-3 font-bold">Mode</th>
                <th className="text-left px-3 py-3 font-bold">Reference / UTR</th>
                <th className="text-center px-3 py-3 font-bold">Proof</th>
                <th className="text-left px-4 py-3 font-bold">Confirmed By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/70 transition">
                  <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{r.date}</td>
                  <td className="px-3 py-3 font-semibold text-slate-800">{r.client}</td>
                  <td className="px-3 py-3 font-mono text-slate-700">{r.invoiceNo}</td>
                  <td className="px-4 py-3 text-right font-black text-emerald-700 font-mono">
                    {inr(r.amount)}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className="px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 font-bold text-[10px] text-slate-600">
                      {r.mode}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-mono text-slate-500 max-w-[200px] truncate" title={r.refNo || ""}>
                    {r.refNo || "—"}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {r.attachments && r.attachments.length > 0 ? (
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        {r.attachments.map((att, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleOpenProof(att, r)}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded-md transition cursor-pointer shadow-2xs"
                            title={`Click to preview ${att.name || `Proof ${idx + 1}`}`}
                          >
                            <CollectionIcon name="link" size={10} /> {r.attachments.length > 1 ? `Proof ${idx + 1}` : "Proof"}
                          </button>
                        ))}
                      </div>
                    ) : r.attachment ? (
                      <button
                        type="button"
                        onClick={() => handleOpenProof(r.attachment, r)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md transition cursor-pointer shadow-2xs"
                        title={r.attachmentName || "Click to preview payment proof"}
                      >
                        <CollectionIcon name="link" size={11} /> Proof
                      </button>
                    ) : (
                      <span className="text-slate-400 text-[10px]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.confirmedBy}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan="9" className="text-center py-12 text-slate-400 text-xs italic">
                    {loading ? "Loading receipts ledger from server..." : "No receipts found matching your criteria."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Standard CRM Pagination Component */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={(newPage) => setCurrentPage(newPage)}
          itemsPerPage={Number(pageSize) || 25}
          onItemsPerPageChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          totalCount={totalItems}
          startIndex={(currentPage - 1) * (Number(pageSize) || 25)}
          visibleItemCount={rows.length}
          customOptions={[10, 15, 20, 25, 50, 100]}
        />
      </div>

      {/* ---------------- Payment Proof Preview Modal View ---------------- */}
      {previewProof && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setPreviewProof(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-slate-50 border-slate-200 text-white flex items-center justify-between gap-3 shrink-0 border-b border-slate-700">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-md text-emerald-300 border border-emerald-30">
                    Payment Proof
                  </span>
                  <span className="text-xs text-slate-900">
                    {previewProof.receiptNo}
                  </span>
                  <span className="text-xs text-slate-800">
                    • {previewProof.client}
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    • {inr(previewProof.amount)}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5 max-w-md">
                  {previewProof.date ? `Date: ${previewProof.date}` : ""} {previewProof.mode ? `• Mode: ${previewProof.mode}` : ""}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={
                    previewProof.url.startsWith("data:") || previewProof.url.includes("X-Amz-Signature") || previewProof.url.includes("AWSAccessKeyId")
                      ? previewProof.url
                      : `${backendUrl ? backendUrl.replace(/\/$/, "") : ""}/image/view?url=${encodeURIComponent(previewProof.rawUrl || previewProof.url)}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition"
                  title="Open in new browser tab"
                >
                  <span>Open in New Tab</span>
                  <CollectionIcon name="link" size={12} />
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewProof(null)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-black text-lg font-bold transition"
                  title="Close (Esc)"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body / Viewer */}
            <div className="flex-1 bg-white-950/90 overflow-auto p-4 flex items-center justify-center min-h-[350px] max-h-[75vh]">
              {loadingProof ? (
                <div className="flex flex-col items-center justify-center gap-2 text-white/70 py-16">
                  <CollectionIcon name="refresh" size={24} className="animate-spin text-emerald-400" />
                  <span className="text-xs font-semibold">Generating secure preview link...</span>
                </div>
              ) : previewProof.url.toLowerCase().includes(".pdf") ||
                previewProof.name.toLowerCase().endsWith(".pdf") ? (
                <iframe
                  src={previewProof.url}
                  title={previewProof.name}
                  className="w-full h-[72vh] border-0 rounded-xl bg-white shadow-lg"
                />
              ) : (
                <img
                  src={previewProof.url}
                  alt={previewProof.name}
                  className="max-w-full max-h-[72vh] object-contain rounded-xl shadow-2xl border border-white/10 bg-slate-900"
                />
              )}
            </div>

            {/* Modal Footer Info */}
            <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <span>Invoice: <b className="font-mono text-slate-800">{previewProof.invoiceNo}</b></span>
                <span>•</span>
                <span>Confirmed by: <b className="text-slate-800">{previewProof.confirmedBy}</b></span>
              </div>
              <div className="text-[11px] text-slate-400">
                Press <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] text-slate-600 font-mono">Esc</kbd> or click outside to close
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
