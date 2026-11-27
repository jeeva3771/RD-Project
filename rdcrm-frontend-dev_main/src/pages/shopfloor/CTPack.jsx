import React, { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useSearchParams } from "react-router-dom";
import { GlobalStyles, PackLogisticsView, DeliveryChargeRequestsTab } from "./components/CTPack";
import { fetchCtPackJobs } from "../../reducer/ctPackReducer";
import { fetchAllUsers } from "../../reducer/userReducer";
import { useLoader } from "../../context/LoaderContext";
import { axiosInstance } from "../../utils/url/config";

export default function PackingConsoleApp() {
  const dispatch = useDispatch();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { jobs = [], pagination = {}, counts = {} } = useSelector((state) => state.ctPack || {});
  const { showLoader, hideLoader } = useLoader();

  // Tab: 'packing' | 'delivery-requests'
  const isDeliveryPath = location.pathname.includes("delivery-charges");
  const tabFromQuery = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(
    isDeliveryPath || tabFromQuery === "delivery-requests" ? "delivery-requests" : "packing"
  );
  const [pendingDeliveryCount, setPendingDeliveryCount] = useState(0);

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Keep activeTab in sync with query param or path
  useEffect(() => {
    if (isDeliveryPath || searchParams.get("tab") === "delivery-requests") {
      setActiveTab("delivery-requests");
    }
  }, [isDeliveryPath, searchParams]);

  // Fetch pending delivery requests count for badge
  const fetchDeliveryBadgeCount = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/enquiry-flow-integration/delivery-charge-requests", {
        params: { status: "requested", limit: 1 },
      });
      if (res.data?.counts?.pending !== undefined) {
        setPendingDeliveryCount(res.data.counts.pending);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchDeliveryBadgeCount();
    const interval = setInterval(fetchDeliveryBadgeCount, 30000);
    return () => clearInterval(interval);
  }, [fetchDeliveryBadgeCount]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchJobs = useCallback(async () => {
    showLoader();
    try {
      await dispatch(fetchCtPackJobs({ page, limit, status: statusFilter, search: debouncedSearch })).unwrap();
    } catch (err) {
      console.error("Failed to fetch packing jobs:", err);
    } finally {
      hideLoader();
    }
  }, [dispatch, page, limit, statusFilter, debouncedSearch, showLoader, hideLoader]);

  useEffect(() => {
    if (activeTab === "packing") {
      fetchJobs();
    }
  }, [fetchJobs, activeTab]);

  useEffect(() => {
    dispatch(fetchAllUsers());
  }, [dispatch]);

  const handleStatusFilterChange = (newStatus) => {
    setStatusFilter(newStatus);
    setPage(1);
  };

  const handleTabSwitch = (newTab) => {
    setActiveTab(newTab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newTab === "delivery-requests") {
        next.set("tab", "delivery-requests");
      } else {
        next.delete("tab");
      }
      return next;
    });
  };

  return (
    <>
      <GlobalStyles />
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
        {/* Top Console Navigation Tabs */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 flex-wrap gap-3">
          <div className="inline-flex rounded-xl p-1 bg-slate-200/70 border border-slate-300/60 shadow-2xs">
            <button
              type="button"
              onClick={() => handleTabSwitch("packing")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                activeTab === "packing"
                  ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>📦</span>
              <span>Packing Console</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabSwitch("delivery-requests")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                activeTab === "delivery-requests"
                  ? "bg-white text-indigo-700 shadow-sm border border-indigo-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>🚚</span>
              <span>Delivery Charge Requests</span>
              {pendingDeliveryCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-amber-950 animate-pulse">
                  {pendingDeliveryCount}
                </span>
              )}
            </button>
          </div>

          <div className="text-[11px] text-slate-500 font-medium">
            Shopfloor &bull; Packaging &amp; Logistics Desk
          </div>
        </div>

        {/* Tab Content View */}
        {activeTab === "delivery-requests" ? (
          <DeliveryChargeRequestsTab />
        ) : (
          <PackLogisticsView
            packJobs={jobs}
            onRefresh={fetchJobs}
            page={page}
            setPage={setPage}
            limit={limit}
            setLimit={setLimit}
            pagination={pagination}
            statusFilter={statusFilter}
            setStatusFilter={handleStatusFilterChange}
            counts={counts}
            search={search}
            setSearch={setSearch}
          />
        )}
      </div>
    </>
  );
}
