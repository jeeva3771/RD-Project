import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import TabCard from "../components/TabCard";
import FormControl from "@mui/material/FormControl";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import { useMediaQuery, useTheme } from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DescriptionIcon from "@mui/icons-material/Description";
import DeliveryPriorityColor from "../../components/deliveryPriorityColor/priorityColor";
import { capitalizeFirst } from "../../utils/helper/capitalize";
import { formatDayMonth, isOverdue } from "../../utils/dateUtils";
import QuotationViewModel from "../salesorder/components/QuoatationScreenViewModel";
import ImageLightbox from "../common/ImageLightbox";
import { axiosInstance } from "../../utils/url/config";

// Sub-Job Quotation Card matching exact existing SampleorderCard UI
const SubJobQuotationCard = ({
  order,
  onView,
  onPrepareBom,
  onPreviewImage,
}) => {
  const isReady = order.costing_status === "completed";
  const isDraft = order.costing_status === "in_progress";
  const statusLabel = isReady
    ? "Quotation Ready"
    : isDraft
      ? "BOM Draft"
      : "Quotation Requested";
  const imageSrc =
    order.approved_design_url || order.reference_image_url || order.image;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col h-full group">
      {/* Top colored priority border */}
      <DeliveryPriorityColor
        deliveryDate={order.delivery_date}
        className="h-2 w-full"
      />

      <div className="p-3 sm:p-4 flex flex-col h-full">
        {/* Header Section */}
        <div className="mb-2 sm:mb-3">
          <div className="flex flex-wrap items-start gap-2 mb-2">
            <div className="flex-1 min-w-[102px]">
              <h3 className="font-bold text-slate-800 text-base sm:text-lg mb-1">
                {order.sub_job_no}
              </h3>
            </div>

            {/* Badges Container */}
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              <span
                className={`text-[10px] sm:text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider whitespace-nowrap border ${
                  isReady
                    ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                    : isDraft
                      ? "bg-blue-100 text-blue-700 border-blue-300"
                      : "bg-amber-100 text-amber-700 border-amber-300"
                }`}
              >
                {statusLabel}
              </span>
            </div>
          </div>

          {/* Centered Product Name */}
          <div className="text-center mt-1">
            <p
              className="font-bold text-slate-800 text-base sm:text-lg truncate px-2"
              title={order.product_name}
            >
              {capitalizeFirst(order.product_name || "Custom Trophy")}
            </p>
          </div>
        </div>

        {/* Image Section */}
        <div className="mb-4 relative h-40 overflow-hidden bg-gray-50 flex items-center justify-center rounded">
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={order.product_name}
              loading="lazy"
              className="w-full h-full object-cover cursor-zoom-in"
              onClick={() => onPreviewImage(imageSrc, order.sub_job_no)}
              onError={(e) => {
                if (order.reference_image_url && e.currentTarget.src !== order.reference_image_url) {
                  e.currentTarget.src = order.reference_image_url;
                } else if (order.approved_design_url && e.currentTarget.src !== order.approved_design_url) {
                  e.currentTarget.src = order.approved_design_url;
                } else {
                  e.currentTarget.style.display = "none";
                  const fallback = e.currentTarget.parentElement?.querySelector(".image-fallback");
                  if (fallback) fallback.style.display = "flex";
                }
              }}
            />
          ) : null}
          <div
            className={`image-fallback items-center justify-center h-full text-gray-400 ${imageSrc ? "hidden" : "flex"}`}
          >
            <div className="text-center">
              <i className="fa-solid fa-image text-3xl mb-2"></i>
              <p className="text-xs">No Image</p>
            </div>
          </div>
        </div>

        {/* Info Row: QTY, COORDINATOR, TYPE, DELIVERY */}
        <div className="mb-3 border-b border-gray-100 pb-3">
          <div className="flex justify-between text-sm">
            {/* QTY */}
            <div>
              <span className="text-gray-400 text-xs uppercase block font-semibold">
                QTY
              </span>
              <span className="font-bold text-slate-700">
                {order.job_quantity ?? 1}
              </span>
            </div>

            {/* COORDINATOR */}
            <div className="flex flex-col">
              <span className="text-gray-400 text-xs uppercase block font-semibold">
                COORDINATOR
              </span>
              <div className="text-xs text-slate-700 font-bold flex items-center gap-1">
                <div className="w-4 h-4 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-[8px] flex-shrink-0">
                  <i className="fa-solid fa-user"></i>
                </div>
                <span className="truncate max-w-[80px]">
                  {order.coordinator_name || "—"}
                </span>
              </div>
            </div>

            {/* Type */}
            <div>
              <span className="px-3 py-1 rounded-full text-xs capitalize font-semibold inline-block bg-blue-100 text-blue-700">
                {order.type || "Enquiry"}
              </span>
            </div>

            {/* Delivery */}
            <div className="text-right">
              <span className="text-gray-400 text-xs uppercase block font-semibold">
                DELIVERY
              </span>
              <span
                className={`font-bold ${
                  isOverdue(order.delivery_date)
                    ? "text-red-600"
                    : "text-slate-700"
                }`}
              >
                {formatDayMonth(order.delivery_date) || "-"}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons: View & Prepare BOM */}
        <div className="grid grid-cols-2 gap-2 mt-auto flex-shrink-0">
          <button
            className="py-2 px-3 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 hover:text-gray-900 text-sm font-medium transition flex items-center justify-center gap-2 cursor-pointer"
            onClick={() => onView(order)}
          >
            <VisibilityIcon fontSize="small" />
            <span>View</span>
          </button>

          <button
            className="py-2 px-3 rounded-lg text-white text-sm font-medium transition flex items-center justify-center gap-2 shadow-sm hover:shadow cursor-pointer"
            style={{ backgroundColor: "#7C3AED" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "#6D28D9")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "#7C3AED")
            }
            onClick={() => onPrepareBom(order)}
          >
            <DescriptionIcon fontSize="small" />
            <span>{isReady ? "View BOM" : "Prepare BOM"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const inr = (amount) => {
  const num = Number(amount) || 0;
  return "₹" + num.toLocaleString("en-IN");
};

const QuotationList = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // Filters & State
  const [loading, setLoading] = useState(true);
  const [subJobs, setSubJobs] = useState([]);
  const [counts, setCounts] = useState({
    all: 0,
    requested: 0,
    draft: 0,
    rework: 0,
    completed: 0,
  });

  const typeFromQuery = searchParams.get("type") || "all";
  const [statusFilter, setStatusFilter] = useState("quotation_all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [viewOrder, setViewOrder] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [visibleTabs, setVisibleTabs] = useState([
    "quotation_all",
    "requestedquotaion",
    "newbom",
    "bomdraft",
    "bomrework",
    "approvedquotation",
    "completedandverified",
  ]);

  // Fetch pending sub-jobs from Enquiry Flow Integration
  const fetchCostingSubJobs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) {
        params.append("search", searchQuery.trim());
      }

      const res = await axiosInstance.get(
        `/enquiry-flow-integration/pending-costings?${params.toString()}`,
      );
      if (res.data?.success) {
        // Map backend sub-jobs to match SampleorderCard & QuotationViewModel shape
        const mapped = (res.data.sub_jobs || []).map((sj) => {
          return {
            id: sj.sub_job_no,
            job_no: sj.enquiry_no,
            sub_job_no: sj.sub_job_no,
            enquiry_no: sj.enquiry_no,
            enquiry_id: {
              reference_no: sj.enquiry_no,
              name: sj.customer_name,
              product_name: sj.trophy_name,
              created_by: { name: sj.coordinator_name },
            },
            product_name: sj.trophy_name,
            theme: sj.theme,
            client_name: sj.customer_name,
            email: sj.customer_email ? [sj.customer_email] : [],
            mobile_no: sj.customer_mobile,
            wp_number: sj.customer_mobile ? [sj.customer_mobile] : [],
            coordinator_name: sj.coordinator_name,
            designer_person: [{ name: sj.coordinator_name }],
            job_quantity: sj.quantity,
            product_quantity: sj.quantity,
            quantity: sj.quantity,
            size: sj.size,
            specs: sj.specs,
            material: sj.material,
            delivery_date: sj.job_completion_date || sj.delivery_date,
            job_completion_date: sj.job_completion_date || sj.delivery_date,
            actual_needed_date: sj.actual_needed_date || sj.delivery_date,
            event_date: sj.event_date,
            type: "enquiry",
            status:
              sj.costing_status === "completed"
                ? "Quotation Ready"
                : "Quotation Requested",
            costing_status: sj.costing_status,
            costing_requested_at: sj.costing_requested_at,
            unit_rate: sj.unit_rate,
            sample_rate: sj.sample_rate,
            artwork_charge: sj.artwork_charge,
            bom_id: sj.bom_id,
            bom_details: sj.bom_details,
            image: sj.approved_design_url || sj.reference_image_url,
            approved_design_url: sj.approved_design_url,
            reference_image_url: sj.reference_image_url,
            images: [sj.approved_design_url || sj.reference_image_url].filter(
              Boolean,
            ),
            designer_files: sj.designer_files || [],
            dtp_files: sj.dtp_files || [],
            raw_sub_job: sj,
          };
        });

        setSubJobs(mapped);
        if (res.data.counts) {
          setCounts({
            all: res.data.counts.all || 0,
            requested: res.data.counts.requested || 0,
            draft: res.data.counts.draft || 0,
            rework: 0,
            completed: res.data.counts.completed || 0,
          });
        }
      }
    } catch (err) {
      console.error("Error fetching quotation sub-jobs:", err);
      toast.error(
        err.response?.data?.message || "Failed to fetch quotation jobs",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCostingSubJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCostingSubJobs();
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const handleHubSwitch = (hub) => {
    if (hub === "production") {
      navigate("/productionorder");
    }
  };

  const handleTypeChange = (type) => {
    setSearchParams({ type });
  };

  const handleTabChange = (value) => {
    setStatusFilter(value);
  };

  // Filter sub-jobs based on active status filter & type
  const filteredSubJobs = useMemo(() => {
    return subJobs.filter((sj) => {
      // Type filter
      if (typeFromQuery !== "all") {
        if (typeFromQuery === "sample" && sj.type !== "sample") return false;
        if (
          typeFromQuery === "production" &&
          sj.type !== "production" &&
          sj.type !== "enquiry"
        )
          return false;
      }

      // Status filter
      if (statusFilter === "quotation_all" || !statusFilter) {
        return true;
      }
      if (statusFilter === "newbom" || statusFilter === "requestedquotaion") {
        return sj.costing_status === "pending" || !sj.costing_status;
      }
      if (statusFilter === "bomdraft") {
        return sj.costing_status === "in_progress";
      }
      if (statusFilter === "bomrework") {
        return sj.costing_status === "rework";
      }
      if (
        statusFilter === "approvedquotation" ||
        statusFilter === "completedandverified"
      ) {
        return sj.costing_status === "completed";
      }
      return true;
    });
  }, [subJobs, statusFilter, typeFromQuery]);

  // Tab definitions matching original Quotation Desk
  const tabs = [
    { label: `ALL (${counts.all})`, value: "quotation_all" },
    { label: `NEW (${counts.requested})`, value: "newbom" },
    { label: `DRAFT (${counts.draft})`, value: "bomdraft" },
    { label: `REWORK (${counts.rework})`, value: "bomrework" },
    {
      label: `COMPLETED AWAITING (${counts.completed})`,
      value: "approvedquotation",
    },
    {
      label: `COMPLETED & PROCESSED (${counts.completed})`,
      value: "completedandverified",
    },
  ];

  // Prepare BOM / View BOM navigation matching exact Quotation workflow
  const handlePrepareBom = (order) => {
    const isReady = order.costing_status === "completed";
    const bomId = order.bom_id || order.raw_sub_job?.bom_id || order.bom_nanoid || "";
    const orderId = order.sub_job_no || order.id;

    if (isReady && bomId) {
      navigate(`/quotation/View/${orderId}/${bomId}`);
    } else if (bomId) {
      navigate(`/quotation/add/${orderId}/${bomId}`);
    } else {
      navigate(`/quotation/add/${orderId}`);
    }
  };

  return (
    <>
      {/* Hub Switcher */}
      <div className="px-4 mb-6 mt-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-6 border-b border-gray-200">
          {/* Quotation Hub - Active */}
          <div
            className={`
              flex items-center justify-center gap-3 p-6 rounded-xl
              transition-all duration-200 border-2
              bg-teal-50 border-teal-500 shadow-lg
            `}
          >
            <div className="text-3xl">📑</div>
            <div>
              <div className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider">
                HUB 1
              </div>
              <h3 className="text-xl font-bold text-teal-600">
                QUOTATION DESK
              </h3>
            </div>
          </div>

          {/* Production Hub */}
          <div
            onClick={() => handleHubSwitch("production")}
            className={`
              flex items-center justify-center gap-3 p-6 rounded-xl cursor-pointer
              transition-all duration-200 border-2
              bg-white border-gray-200 shadow-sm hover:shadow-md hover:border-purple-400
            `}
          >
            <div className="text-3xl">🏭</div>
            <div>
              <div className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider">
                HUB 2
              </div>
              <h3 className="text-xl font-bold text-gray-600">
                PRODUCTION FLOOR
              </h3>
            </div>
          </div>
        </div>
      </div>

      {/* Search, Type Filter, and Manage Tabs in Same Row */}
      <div className="bg-white p-4 shadow-sm mb-6 mx-4 rounded-lg">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          {/* Search Bar */}
          <div className="relative w-full sm:max-w-md">
            <input
              type="text"
              placeholder="Search by job number or reference no..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg 
                focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <i className="fa-solid fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
          </div>

          <div className="w-full lg:w-auto flex justify-center">
            {/* Type Filter Switcher */}
            <div className="inline-flex bg-gray-100 rounded-full shadow-sm border border-gray-200">
              <button
                onClick={() => handleTypeChange("all")}
                className={`
                  px-5 py-2 text-xs font-bold uppercase tracking-wide
                  rounded-full transition-all duration-200
                  ${
                    typeFromQuery === "all"
                      ? "bg-gray-800 text-white"
                      : "text-gray-500 hover:text-gray-700"
                  }
                `}
              >
                All
              </button>
              <button
                onClick={() => handleTypeChange("production")}
                className={`
                  px-5 py-2 text-xs font-bold uppercase tracking-wide
                  rounded-full transition-all duration-200
                  ${
                    typeFromQuery === "production"
                      ? "bg-gray-800 text-white"
                      : "text-gray-500 hover:text-gray-700"
                  }
                `}
              >
                Production
              </button>
              <button
                onClick={() => handleTypeChange("sample")}
                className={`
                  px-5 py-2 text-xs font-bold uppercase tracking-wide
                  rounded-full transition-all duration-200
                  ${
                    typeFromQuery === "sample"
                      ? "bg-gray-800 text-white"
                      : "text-gray-500 hover:text-gray-700"
                  }
                `}
              >
                Sample
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {/* Manage Tabs Button */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition whitespace-nowrap"
              style={{ backgroundColor: "#574fdd" }}
            >
              Manage Tabs
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      {isMobile ? (
        <FormControl fullWidth sx={{ mb: 2, px: 2 }}>
          <Select
            value={statusFilter}
            onChange={(e) => handleTabChange(e.target.value)}
            displayEmpty
          >
            {tabs
              .filter((tab) => visibleTabs.includes(tab.value))
              .map((tab) => (
                <MenuItem key={tab.value} value={tab.value}>
                  {tab.label}
                </MenuItem>
              ))}
          </Select>
        </FormControl>
      ) : (
        <div className="px-4 mb-6">
          <TabCard
            tabs={tabs.filter((tab) => visibleTabs.includes(tab.value))}
            activeValue={statusFilter || "quotation_all"}
            onChange={(value) => handleTabChange(value)}
          />
        </div>
      )}

      {/* Orders Grid */}
      <div className="px-4 mb-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin text-4xl mb-4 text-teal-600">
              ⌛
            </div>
            <p className="text-gray-500 text-lg">
              Loading quotation sub-jobs...
            </p>
          </div>
        ) : filteredSubJobs.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📭</div>
            <p className="text-gray-500 text-lg">No quotations found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-6">
            {filteredSubJobs.map((sampleOrder) => (
              <SubJobQuotationCard
                key={sampleOrder.id}
                order={sampleOrder}
                onView={(order) => setViewOrder(order)}
                onPrepareBom={(order) => handlePrepareBom(order)}
                onPreviewImage={(src) => setPreviewImage(src)}
              />
            ))}
          </div>
        )}
      </div>

      {/* View Details Modal (QuotationViewModel) - Shows Size & Specs */}
      {viewOrder && (
        <QuotationViewModel
          order={viewOrder}
          onClose={() => setViewOrder(null)}
        />
      )}

      {/* Tab Management Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg p-6 w-80 shadow-xl">
            <h3 className="text-lg font-bold mb-4">Select Tabs to Display</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
              {tabs.map((tab) => (
                <label key={tab.value} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={visibleTabs.includes(tab.value)}
                    onChange={() => {
                      setVisibleTabs((prev) =>
                        prev.includes(tab.value)
                          ? prev.filter((v) => v !== tab.value)
                          : [...prev, tab.value],
                      );
                    }}
                    className="form-checkbox h-4 w-4 text-blue-600"
                  />
                  <span className="text-sm">{tab.label}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Lightbox */}
      {previewImage && (
        <ImageLightbox
          src={previewImage}
          onClose={() => setPreviewImage(null)}
        />
      )}
    </>
  );
};

export default QuotationList;
