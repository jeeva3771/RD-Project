import React, { useState, useEffect, useCallback } from "react";
import { axiosInstance } from "../../../../utils/url/config";
import DeliveryRateModal from "./DeliveryRateModal";
import { toast } from "react-toastify";

export default function DeliveryChargeRequestsTab() {
  const [requests, setRequests] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, quoted: 0, all: 0 });
  const [statusFilter, setStatusFilter] = useState("requested"); // 'requested' | 'quoted' | 'all'
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/enquiry-flow-integration/delivery-charge-requests", {
        params: {
          status: statusFilter,
          search: debouncedSearch,
          page,
          limit,
        },
      });

      if (res.data?.success) {
        setRequests(res.data.data || []);
        if (res.data.counts) {
          setCounts(res.data.counts);
        }
        if (res.data.pagination) {
          setTotalPages(res.data.pagination.pages || 1);
        }
      }
    } catch (err) {
      console.error("Error fetching delivery charge requests:", err);
      toast.error("Failed to load delivery requests");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, debouncedSearch, page, limit]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleTabChange = (newStatus) => {
    setStatusFilter(newStatus);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Top Bar: Search & Status Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Status Pills */}
        <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200 flex-wrap gap-1">
          <button
            type="button"
            onClick={() => handleTabChange("requested")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              statusFilter === "requested"
                ? "bg-amber-400 text-amber-950 shadow-2xs font-extrabold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>⏳ Pending Estimation</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                statusFilter === "requested" ? "bg-amber-900 text-white" : "bg-slate-200 text-slate-700 font-bold"
              }`}
            >
              {counts.pending}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("quoted")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              statusFilter === "quoted"
                ? "bg-emerald-600 text-white shadow-2xs font-extrabold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>✓ Rates Quoted</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                statusFilter === "quoted" ? "bg-white text-emerald-800 font-black" : "bg-slate-200 text-slate-700 font-bold"
              }`}
            >
              {counts.quoted}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("all")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              statusFilter === "all"
                ? "bg-white text-slate-900 shadow-2xs border border-slate-200 font-extrabold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>All Requests</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700 font-bold">
              {counts.all}
            </span>
          </button>
        </div>

        {/* Search & Refresh */}
        <div className="flex items-center gap-2">
          <div className="relative w-full md:w-64">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
            <input
              type="text"
              placeholder="Search Enquiry, Client, City..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white outline-none focus:border-indigo-500 shadow-2xs"
            />
          </div>
          <button
            type="button"
            onClick={fetchRequests}
            title="Refresh"
            className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Main Request Cards List */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 font-medium text-xs bg-white rounded-2xl border border-slate-200">
          Loading delivery requests...
        </div>
      ) : requests.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-300 space-y-2">
          <div className="text-3xl">🚚</div>
          <div className="font-bold text-slate-700 text-sm">No delivery requests found</div>
          <p className="text-xs text-slate-400">
            {statusFilter === "requested"
              ? "All caught up! There are no pending delivery rate requests from coordinators right now."
              : "No delivery charges matching your filter."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {requests.map((r) => {
            const dc = r.delivery_charges || {};
            const addr = dc.address_snapshot || {};
            const isPending = dc.status === "requested";
            const isQuoted = dc.status === "quoted" || dc.status === "client_approved";

            return (
              <div
                key={r._id}
                className={`p-5 rounded-2xl border bg-white shadow-2xs transition hover:shadow-md ${
                  isPending ? "border-amber-300/80 bg-amber-50/10" : "border-slate-200"
                }`}
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-base font-extrabold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono">
                      {r.enquiry_no || `RD${r.seq}`}
                    </span>
                    <span className="font-extrabold text-sm text-slate-900">{r.client_name}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 uppercase">
                      {r.stage}
                    </span>
                    {Boolean(dc.re_request_reason || (dc.approval_history && dc.approval_history.length > 0)) && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                        <span>🔄</span>
                        <span>
                          {dc.re_request_reason === "address_change"
                            ? "Address Changed"
                            : dc.re_request_reason === "client_revision"
                            ? "Client Revision"
                            : "Re-request"}
                        </span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-500">
                    <span>
                      Coordinator: <strong>{r.coordinator_name}</strong>
                    </span>
                    {r.needed_by_date && (
                      <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        Deadline: {r.needed_by_date}
                      </span>
                    )}
                  </div>
                </div>

                {/* Details Body */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3.5 text-xs">
                  {/* Col 1: Delivery Mode & Payer */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Carrier &amp; Transport
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-800 text-sm">
                        {dc.carrier === "Tempo" && "🚚 "}
                        {dc.carrier === "Porter" && "🛵 "}
                        {dc.carrier === "Courier" && "📮 "}
                        {dc.carrier === "Air cargo" && "✈️ "}
                        {dc.carrier || "Tempo"}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          dc.payer === "client" ? "bg-amber-100 text-amber-800" : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {dc.payer === "client" ? "Client pays freight" : "RD pays freight"}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500">
                      Destination Area: <strong>{dc.destination_area || "Local"}</strong>
                    </div>

                    {dc.requested_at && (
                      <div className="text-[10px] text-slate-400">
                        Requested: {new Date(dc.requested_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                      </div>
                    )}
                  </div>

                  {/* Col 2: Destination Address & Site Contact */}
                  <div className="space-y-1 md:border-x md:border-slate-100 md:px-4">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      📍 Delivery Address
                    </span>
                    <div className="font-semibold text-slate-800 line-clamp-2">
                      {addr.full_address || addr.label || "Customer site address"}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {addr.city && `${addr.city}, `}
                      {addr.pin && `PIN: ${addr.pin}`}
                    </div>
                    {(addr.site_contact || addr.site_phone || r.contact_person || r.contact_mobile) && (
                      <div className="text-[11px] font-bold text-slate-700 mt-1 flex items-center gap-1.5">
                        <span>👤</span>
                        <span>{addr.site_contact || r.contact_person}</span>
                        {(addr.site_phone || r.contact_mobile) && (
                          <span className="text-emerald-700 font-mono">({addr.site_phone || r.contact_mobile})</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Col 3: Items & Action Button */}
                  <div className="space-y-2 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        📦 Products ({r.total_quantity} pcs)
                      </span>
                      <div className="text-[11px] text-slate-700 font-medium space-y-0.5">
                        {(r.items || []).slice(0, 2).map((it, idx) => (
                          <div key={idx} className="truncate">
                            &bull; {it.product_name} &middot; Qty: {it.quantity}
                          </div>
                        ))}
                        {(r.items || []).length > 2 && (
                          <div className="text-[10px] text-slate-400 italic">
                            + {(r.items || []).length - 2} more item(s)
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action / Rate Area */}
                    <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100">
                      {isPending ? (
                        <div className="flex items-center gap-2 w-full justify-between">
                          <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1">
                            <span>⏳</span> Awaiting Rate
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedRequest(r)}
                            className="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-amber-950 font-extrabold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
                          >
                            <span>➕</span>
                            <span>Enter Delivery Rate</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 w-full justify-between">
                          <div>
                            <div className="font-extrabold text-sm text-emerald-700 flex items-baseline gap-1">
                              <span>₹{Number(dc.amount || 0).toLocaleString("en-IN")}</span>
                              <span className="text-[10px] font-normal text-slate-500">+ GST</span>
                            </div>
                            <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                              {dc.courier_partner || dc.carrier}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedRequest(r)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                          >
                            ✏️ Update Rate
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg disabled:opacity-40 cursor-pointer shadow-2xs"
          >
            Previous
          </button>
          <span className="text-xs text-slate-600 font-medium">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg disabled:opacity-40 cursor-pointer shadow-2xs"
          >
            Next
          </button>
        </div>
      )}

      {/* Detail / Rate Modal */}
      {selectedRequest && (
        <DeliveryRateModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onSuccess={fetchRequests}
        />
      )}
    </div>
  );
}
