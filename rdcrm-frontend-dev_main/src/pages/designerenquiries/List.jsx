import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { axiosInstance, backendUrl } from "../../utils/url/config";
import { useLoader } from "../../context/LoaderContext";
import { toast } from "react-toastify";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import { useMediaQuery, useTheme } from "@mui/material";
import ViewModal from "../components/ViewModal";
import MultiTrophyDesignModal from "./MultiTrophyDesignModal";
import DesignerEnquiryDetailModal from "./DesignerEnquiryDetailModal";
import EnquiryCard from "../components/EnquiryCard";
import Pagination from "../components/Pagination";
import { getUserPermissions } from "../../utils/permission/auth";
import SizeInputModal from "../components/SizeInputModal";
import ImageConfirmModal from "../components/ImageConfirmModal";
import { useDispatch, useSelector } from "react-redux";
import { fetchAllSampleOrders, updateSampleOrderById } from "../../reducer/sampleSalesorderReducer";
import SampleorderCard from "../salesorder/components/sampleordercard";
import DesignerFileUploadModal from "../salesorder/components/DesignerFileUploadModal";
import DesignerApprovedViewModal from "../salesorder/components/DesignerApprovedViewModal";
import { filterAndSortByPriority, countPriorityItems, getItemTimingStatus } from "./timingUtils";

const resolveApprovedDesignUrl = (j, sj) => {
  const ws = j.wizard_state || {};
  const sObj = ws.s || {};
  const eObj = ws.e || {};
  const watermarkedDesigns = ws.watermarkedDesigns || sObj.watermarkedDesigns || {};
  const uploadedDesigns = ws.uploadedDesigns || sObj.uploadedDesigns || {};
  const productFeedback = ws.productFeedback || sObj.productFeedback || j.productFeedback || {};

  const extractUrl = (val) => {
    if (!val) return null;
    if (typeof val === "string") return val.trim();
    if (Array.isArray(val)) return extractUrl(val[0]);
    if (typeof val === "object") {
      return val.file_url || val.signed_url || val.url || val.src || val.path || null;
    }
    return null;
  };

  // 1. Direct approved properties on sub-job
  if (sj.approved_design_url) return extractUrl(sj.approved_design_url);
  if (Array.isArray(sj.approved_designs) && sj.approved_designs.length > 0) {
    const u = extractUrl(sj.approved_designs[0]);
    if (u) return u;
  }

  // 2. Group index from sub_job_no: e.g. RD21095-A1 & RD21095-A2 -> 'A' -> 0 (share same design!); RD21095-B1 -> 'B' -> 1
  let groupIdx = 0;
  const subNoStr = String(sj.sub_job_no || "").trim();
  const match = subNoStr.match(/[-_]?([A-Za-z])(\d+)?$/);
  if (match && match[1]) {
    groupIdx = match[1].toUpperCase().charCodeAt(0) - 65;
  } else if (sj.design_group) {
    groupIdx = String(sj.design_group).trim().toUpperCase().charCodeAt(0) - 65;
  }
  if (isNaN(groupIdx) || groupIdx < 0) groupIdx = 0;

  const groupChar = String.fromCharCode(65 + groupIdx);

  // 3. Check productFeedback for this group to find which option was approved
  const fb = productFeedback[groupIdx] || productFeedback[String(groupIdx)] || sj.product_feedback;
  const fbList = Array.isArray(fb) ? fb : (fb ? [fb] : []);
  const approvedFb = fbList.find((f) => f && f.mode === "approve");

  let approvedOptIdx = 0;
  if (approvedFb) {
    if (Array.isArray(approvedFb.optIdxs) && approvedFb.optIdxs.length > 0) {
      approvedOptIdx = approvedFb.optIdxs[0];
    } else if (approvedFb.optIdx !== undefined) {
      approvedOptIdx = approvedFb.optIdx;
    }
  } else if (sj.approved_design_option !== undefined && sj.approved_design_option !== null) {
    approvedOptIdx = sj.approved_design_option;
  }

  // 4. Lookup in watermarkedDesigns / uploadedDesigns for this group & approved option
  let candidate =
    extractUrl(watermarkedDesigns[`${groupIdx}-${approvedOptIdx}`]) ||
    extractUrl(uploadedDesigns[`${groupIdx}-${approvedOptIdx}`]) ||
    extractUrl(watermarkedDesigns[`${groupChar}-${approvedOptIdx}`]) ||
    extractUrl(uploadedDesigns[`${groupChar}-${approvedOptIdx}`]) ||
    extractUrl(watermarkedDesigns[`${groupIdx}-0`]) ||
    extractUrl(uploadedDesigns[`${groupIdx}-0`]) ||
    extractUrl(watermarkedDesigns[`${groupChar}-0`]) ||
    extractUrl(uploadedDesigns[`${groupChar}-0`]);

  if (!candidate) {
    const wmKey = Object.keys(watermarkedDesigns).find(
      (k) => (k.startsWith(`${groupIdx}-`) || k.startsWith(`${groupChar}-`)) && watermarkedDesigns[k]
    );
    if (wmKey) candidate = extractUrl(watermarkedDesigns[wmKey]);
  }
  if (!candidate) {
    const upKey = Object.keys(uploadedDesigns).find(
      (k) => (k.startsWith(`${groupIdx}-`) || k.startsWith(`${groupChar}-`)) && uploadedDesigns[k]
    );
    if (upKey) candidate = extractUrl(uploadedDesigns[upKey]);
  }

  // 5. Check trophyGroups or designs array
  const group = eObj.trophyGroups?.[groupIdx] || {};
  if (!candidate && group.approvedDesign) candidate = extractUrl(group.approvedDesign);
  if (!candidate && group.image) candidate = extractUrl(group.image);

  if (!candidate && Array.isArray(sj.designs) && sj.designs.length > 0) {
    candidate = extractUrl(sj.designs[0]);
  }
  if (!candidate && Array.isArray(sj.design_files) && sj.design_files.length > 0) {
    candidate = extractUrl(sj.design_files[0]);
  }
  if (!candidate && Array.isArray(sj.proof_files) && sj.proof_files.length > 0) {
    candidate = extractUrl(sj.proof_files[0]);
  }

  // 6. Reference images fallback
  if (!candidate && sj.reference_image) candidate = extractUrl(sj.reference_image);
  if (!candidate && group.reference_images?.[0]) candidate = extractUrl(group.reference_images[0]);
  if (!candidate && Array.isArray(j.the_ask?.reference_images) && j.the_ask.reference_images.length > 0) {
    candidate = extractUrl(j.the_ask.reference_images[0]);
  }

  // 7. Any design upload across the job as fallback
  if (!candidate) {
    const anyWm = Object.values(watermarkedDesigns).find(Boolean);
    if (anyWm) candidate = extractUrl(anyWm);
  }
  if (!candidate) {
    const anyUp = Object.values(uploadedDesigns).find(Boolean);
    if (anyUp) candidate = extractUrl(anyUp);
  }

  return candidate || "";
};

const mapFlowSubJobToSampleOrder = (j, sj) => {
  const theAsk = j.the_ask || j.wizard_state?.the_ask || {};
  const theBrief = j.the_brief || j.wizard_state?.the_brief || {};
  const wizardState = j.wizard_state || {};
  const subJobNo = sj.sub_job_no || `${j.enquiry_no || "RD"}-A1`;

  const approvedImage = resolveApprovedDesignUrl(j, sj);
  const cardImages = approvedImage ? [approvedImage] : [];

  const deliveryDate = (() => {
    const d =
      theAsk.delivery_date ||
      theAsk.needed_by_date ||
      theAsk.event_date ||
      j.delivery_date ||
      j.needed_by_date ||
      j.event_date ||
      j.delivery_details?.delivery_date ||
      wizardState.e?.neededByDate ||
      wizardState.e?.deliveryDate ||
      wizardState.leadDate ||
      wizardState.jobDeliveryDate;
    if (!d) return "";
    if (typeof d === "string") return d;
    if (d instanceof Date || typeof d.toISOString === "function") return d.toISOString().split("T")[0];
    return String(d);
  })();

  return {
    id: `${j._id}:::${subJobNo}`,
    _id: j._id,
    job_no: j.enquiry_no || `RD${j.seq}`,
    sub_job_no: subJobNo,
    client_name: j.customer_id?.name || theAsk.client_name || "Client",
    customer: j.customer_id?.name || theAsk.client_name || "Client",
    product_name: sj.product_name || sj.trophy_name || theAsk.product_name || theAsk.theme || "Custom Trophy",
    job_quantity: sj.quantity || theAsk.quantity || 1,
    product_quantity: sj.quantity || theAsk.quantity || 1,
    delivery_date: deliveryDate,
    status: "Approved",
    type: sj.trophy_type || sj.kind || "custom",
    images: cardImages,
    image: cardImages[0] || "",
    is_sales_order_filled: true,
    is_design_uploaded: false,
    Pi_files: [],
    quatation_files: [],
    designer_files: Array.isArray(sj.designer_files) ? sj.designer_files : [],
    designer_person: [
      { name: theBrief.designer_name || wizardState.e?.designer_name || "Designer" },
    ],
    is_flow: true,
    rawJob: j,
    subJob: sj,
  };
};

const DesignEnquiryList = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [enquiries, setEnquiries] = useState([]);
  const [allFlowItems, setAllFlowItems] = useState([]);
  const [rawTabItems, setRawTabItems] = useState([]);
  const [priorityFilter, setPriorityFilter] = useState("all"); // "all", "rush_first", "overdue", "rush"
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(8);
  const [totalPages, setTotalPages] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [tabCounts, setTabCounts] = useState({
    all: 0,
    false: 0,
    true: 0,
    rework: 0,
    complete: 0,
    requestedfiles: 0
  });
  const [flowRequestedOrders, setFlowRequestedOrders] = useState([]);

  // State for Units Modal
  const [sizeModalOpen, setSizeModalOpen] = useState(false);
  const [unit, setUnit] = useState("");
  const [productSize, setProductSize] = useState("");
  const [unitsList, setUnitsList] = useState([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [savingSize, setSavingSize] = useState(false);
  const [selectedEnquiry, setSelectedEnquiry] = useState(null);
  const [selectedImageId, setSelectedImageId] = useState(null);

  const { showLoader, hideLoader } = useLoader();

  //designapprovalconfirmation
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmNewFile, setConfirmNewFile] = useState(null);
  const [confirmEnquiry, setConfirmEnquiry] = useState(null);
  const [confirmSlotId, setConfirmSlotId] = useState(null);

  const dispatch = useDispatch();
  const [sampleSalesCount, setSampleSalesCount] = useState(0);

  const triggerSampleSalesCountRefresh = () => {
    setSampleSalesCount((prev) => prev + 1);
  };

  const {
    sampleSalesOrders,
    pagination: samplePagination,
    total: sampleTotal,
    totalPages: sampleTotalPages,
  } = useSelector((state) => state.sampleSalesOrders);

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  // Separate state for the right-side AccountsViewModel drawer
  const [viewDrawerOpen, setViewDrawerOpen] = useState(false);
  const [viewDrawerOrder, setViewDrawerOrder] = useState(null);

  // Dynamic Tab Counts taking priorityFilter into account
  const dynamicTabCounts = useMemo(() => {
    const isFiltered = priorityFilter !== "all";

    let allCount = 0;
    let pendingCount = 0;
    let processingCount = 0;
    let reworkCount = 0;
    let completeCount = 0;

    allFlowItems.forEach((item) => {
      const timing = getItemTimingStatus(item);

      let matches = true;
      if (priorityFilter === "overdue") {
        matches = timing.isOverdue;
      } else if (priorityFilter === "rush") {
        matches = timing.isRush;
      } else if (priorityFilter === "rush_first") {
        matches = timing.isRush || timing.isOverdue;
      }

      if (!matches) return;

      allCount++;
      if (item.is_completed) {
        completeCount++;
      } else if (item.is_rework) {
        reworkCount++;
      } else if (item.is_processing) {
        processingCount++;
      } else {
        pendingCount++;
      }
    });

    if (isFiltered) {
      return {
        all: allCount,
        false: pendingCount,
        true: processingCount,
        rework: reworkCount,
        complete: completeCount,
        requestedfiles: 0,
      };
    }

    return {
      all: allFlowItems.length || tabCounts.all,
      false: allFlowItems.length ? pendingCount : tabCounts.false,
      true: allFlowItems.length ? processingCount : tabCounts.true,
      rework: allFlowItems.length ? reworkCount : tabCounts.rework,
      complete: allFlowItems.length ? completeCount : tabCounts.complete,
      requestedfiles: tabCounts.requestedfiles,
    };
  }, [allFlowItems, priorityFilter, tabCounts]);

  const tabs = [
    { label: "All", value: "", count: dynamicTabCounts.all },
    { label: "Pending", value: "false", count: dynamicTabCounts.false },
    { label: "Processing", value: "true", count: dynamicTabCounts.true },
    { label: "Rework", value: "rework", count: dynamicTabCounts.rework },
    { label: "Completed", value: "complete", count: dynamicTabCounts.complete },
    { label: "Approved Design File Upload", value: "requestedfiles", count: dynamicTabCounts.requestedfiles }
  ];

  // Fetch counts for tabs
  const fetchTabCounts = useCallback(async () => {
    try {
      // Only enquiry_flows_integration — legacy enquiry collection excluded
      const [sampleRes, flowAllRes] = await Promise.all([
        dispatch(fetchAllSampleOrders({ page: 1, limit: 1, status: "designserfilesupload" })).unwrap().catch(() => ({ total: 0 })),
        axiosInstance.get("/enquiry-flow-integration/designer-enquiries").catch(() => ({ data: { data: [] } }))
      ]);

      const flowJobs = flowAllRes?.data?.data || [];
      let flowPending = 0;
      let flowProcessing = 0;
      let flowRework = 0;
      let flowComplete = 0;
      const extractedRequested = [];

      flowJobs.forEach((j) => {
        const dp = j.design_progress;
        if (dp) {
          if (dp.is_completed) flowComplete++;
          else if (dp.is_rework) flowRework++;
          else if (dp.is_processing) flowProcessing++;
          else flowPending++;
        } else {
          const activeSjs = (j.sub_jobs || []).filter(
            (s) => !s.is_dropped && !s.is_on_hold && s.trophy_type !== "ready" && s.kind !== "ready"
          );
          const totalActive = activeSjs.length;
          const approvedCount = activeSjs.filter(
            (s) => s.design_approved === true || s.design_status === "approved"
          ).length;
          const reworkCount = (j.sub_jobs || []).filter(
            (s) => s.design_status === "rework"
          ).length;
          const uploadedCount = Object.keys(j.wizard_state?.uploadedDesigns || {}).length;
          const isComplete = totalActive > 0 && approvedCount >= totalActive;
          const isRework = !isComplete && (reworkCount > 0 || j.the_brief?.design_status === "rework" || j.wizard_state?.designStatus === "rework");

          if (isComplete) {
            flowComplete++;
          } else if (isRework) {
            flowRework++;
          } else if (uploadedCount > 0 || approvedCount > 0) {
            flowProcessing++;
          } else {
            flowPending++;
          }
        }

        // Collect approved sub-jobs that need production artwork uploaded (.cdr/.pdf)
        (j.sub_jobs || []).forEach((s, sIdx) => {
          if (!s.is_dropped && !s.is_on_hold && s.trophy_type !== "ready" && s.kind !== "ready") {
            const groupChar = s.design_group || String.fromCharCode(65 + sIdx);
            const pFbs = j.wizard_state?.productFeedback?.[sIdx] || j.wizard_state?.productFeedback?.[groupChar] || [];
            const pFbsList = Array.isArray(pFbs) ? pFbs : (pFbs ? [pFbs] : []);
            const isProductApproved = pFbsList.some((fb) => fb?.mode === "approve");

            const isApproved =
              s.design_approved === true ||
              s.design_status === "approved" ||
              j.the_brief?.design_status === "approved" ||
              j.wizard_state?.designApproved === true ||
              j.wizard_state?.designStatus === "approved" ||
              isProductApproved;

            const artworkUploaded = Boolean(
              s.is_design_uploaded === true ||
              (Array.isArray(s.designer_files) && s.designer_files.length > 0) ||
              (Array.isArray(s.dtp_files) && s.dtp_files.length > 0)
            );
            if (isApproved && !artworkUploaded) {
              extractedRequested.push(mapFlowSubJobToSampleOrder(j, s));
            }
          }
        });
      });

      setFlowRequestedOrders(extractedRequested);

      setTabCounts({
        all: flowJobs.length,
        false: flowPending,
        true: flowProcessing,
        rework: flowRework,
        complete: flowComplete,
        requestedfiles: (sampleRes?.total || 0) + extractedRequested.length
      });
    } catch (error) {
      console.error("Error fetching tab counts:", error);
    }
  }, [dispatch]);

  useEffect(() => {
    fetchTabCounts();
  }, [fetchTabCounts, sampleSalesCount]);

  const fetchEnquiries = useCallback(async () => {
    if (statusFilter === "requestedfiles") return;
    showLoader();
    try {
      const params = {
        page: currentPage,
        limit: itemsPerPage,
        search: searchTerm,
        status: "design",
      };

      if (statusFilter === "true" || statusFilter === "false") {
        params.is_design_processing = statusFilter;
      }

      if (statusFilter === "submit_button") {
        params.submit_button = true;
      }

      if (statusFilter === "complete") {
        params.design_complete = true;
      }

      if (statusFilter === "rework") {
        params.rework = true;
      }

      // Only enquiry_flows_integration data — legacy enquiry collection excluded for designer view
      const flowRes = await axiosInstance.get("/enquiry-flow-integration/designer-enquiries", { params: { search: searchTerm } }).catch(() => ({ data: { data: [] } }));
      const response = { data: { success: true, data: [] } }; // legacy excluded

      if (response.data.success || flowRes.data?.data) {
        const legacyItems = response.data.data || [];
        const rawFlow = flowRes.data?.data || [];

        const flowItems = rawFlow.map((j) => {
          const theAsk = j.the_ask || j.wizard_state?.the_ask || {};
          const theBrief = j.the_brief || j.wizard_state?.the_brief || {};
          const wizardState = j.wizard_state || {};
          const uploadedCount = Object.keys(wizardState.uploadedDesigns || {}).length;
          const activeSjs = (j.sub_jobs || []).filter(
            (s) => !s.is_dropped && !s.is_on_hold && s.trophy_type !== "ready" && s.kind !== "ready"
          );
          const totalActive = activeSjs.length;
          const approvedCount = activeSjs.filter(
            (s) => s.design_approved === true || s.design_status === "approved"
          ).length;
          const reworkCount = (j.sub_jobs || []).filter(
            (s) => s.design_status === "rework"
          ).length;

          // STRICT COMPLETION LOGIC:
          // Completed only when 100% of all active sub-jobs are approved
          const isCompleted = j.design_progress?.is_completed !== undefined
            ? j.design_progress.is_completed
            : (totalActive > 0 && approvedCount >= totalActive);

          const isRework = !isCompleted && (
            j.design_progress?.is_rework !== undefined
              ? j.design_progress.is_rework
              : (reworkCount > 0 || theBrief.design_status === "rework" || wizardState.designStatus === "rework")
          );

          // If some subjobs are approved (e.g. 2 of 3) or designs uploaded, it stays in PROCESSING!
          const isProcessing = !isCompleted && !isRework && (
            j.design_progress?.is_processing !== undefined
              ? j.design_progress.is_processing
              : (uploadedCount > 0 || approvedCount > 0)
          );

          // Card images: Only designer uploaded designs, NOT reference images
          const uploadedDesignsMap = wizardState.uploadedDesigns || {};
          const uploadedUrls = [];
          Object.values(uploadedDesignsMap).forEach((val) => {
            if (Array.isArray(val)) {
              val.forEach((url) => { if (url) uploadedUrls.push(url); });
            } else if (typeof val === "string" && val) {
              uploadedUrls.push(val);
            }
          });
          const images = uploadedUrls.map((url, idx) => ({
            id: idx,
            url,
            is_accepted: true,
          }));

          const optionsDueIn = Number(
            theBrief.options_due_in ||
            wizardState.e?.optionsDueIn ||
            wizardState.optionsDueIn ||
            24
          );
          const designerAssignedAt =
            theBrief.designer_assigned_at ||
            j.createdAt ||
            j.updatedAt;
          const reworkRequestedAt =
            theBrief.rework_requested_at ||
            wizardState.reworkRequestedAt ||
            (isRework ? j.updatedAt : null);

          return {
            id: j.enquiry_no || `RD${j.seq}`,
            _id: j._id,
            job_no: j.enquiry_no || `RD${j.seq}`,
            name: j.customer_id?.name || "Client",
            customer: j.customer_id?.name || "Client",
            customer_id: j.customer_id?._id || j.customer_id,
            product_name: theAsk.product_name || theAsk.theme || "Custom Trophy",
            product_quantity: theAsk.quantity || 100,
            delivery_date: (() => { const d = theAsk.delivery_date || theAsk.needed_by_date || theAsk.event_date || j.delivery_date || j.needed_by_date || j.event_date || j.delivery_details?.delivery_date || j.delivery_details?.needed_by_date || wizardState.e?.neededByDate || wizardState.e?.deliveryDate || wizardState.e?.eventExactDate || wizardState.leadDate || wizardState.jobDeliveryDate || wizardState.e?.jobCompletionDate; if (!d) return ""; if (typeof d === "string") return d; if (d instanceof Date || typeof d.toISOString === "function") return d.toISOString().split("T")[0]; return String(d); })(),
            status: "design",
            is_flow: true,
            is_rework: isRework,
            is_completed: isCompleted,
            is_processing: uploadedCount > 0 && !isCompleted,
            design_status: theBrief.design_status || "pending",
            options_due_in: optionsDueIn,
            designer_assigned_at: designerAssignedAt,
            rework_requested_at: reworkRequestedAt,
            designer_person: [
              { user: { name: theBrief.designer_name || wizardState.e?.designer_name || "Designer" } }
            ],
            images: images,
            rawJob: j,
          };
        });

        const q = (searchTerm || "").trim().toLowerCase();
        const qClean = q.replace(/[-_ ]/g, "");

        const searchedAll = flowItems.filter((item) => {
          if (!q) return true;
          const jNo = String(item.job_no || item.id || "").toLowerCase();
          const jNoClean = jNo.replace(/[-_ ]/g, "");
          const cust = String(item.customer || item.name || "").toLowerCase();
          const prod = String(item.product_name || "").toLowerCase();
          const subJobs = item.rawJob?.sub_jobs || [];
          const subJobMatch = subJobs.some((s) => {
            const sjNo = String(s.sub_job_no || "").toLowerCase();
            return sjNo.includes(q) || sjNo.replace(/[-_ ]/g, "").includes(qClean);
          });
          return (
            jNo.includes(q) ||
            jNoClean.includes(qClean) ||
            cust.includes(q) ||
            prod.includes(q) ||
            subJobMatch
          );
        });

        setAllFlowItems(searchedAll);

        // Filter flow items based on active statusFilter
        const filteredFlow = searchedAll.filter((item) => {
          if (!statusFilter) return true;
          if (statusFilter === "false") return !item.is_processing && !item.is_completed && !item.is_rework;
          if (statusFilter === "true") return item.is_processing;
          if (statusFilter === "rework") return item.is_rework;
          if (statusFilter === "complete") return item.is_completed;
          return true;
        });

        setRawTabItems(filteredFlow);
        setEnquiries(filteredFlow);
        setTotalPages(Math.ceil(filteredFlow.length / itemsPerPage) || 1);
        setTotalCount(filteredFlow.length);
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Error fetching enquiries");
    } finally {
      hideLoader();
    }
  }, [currentPage, itemsPerPage, searchTerm, statusFilter, showLoader, hideLoader]);

  useEffect(() => {
    if (statusFilter !== "requestedfiles") {
      fetchEnquiries();
    } else {
      fetchTabCounts();
    }
  }, [fetchEnquiries, fetchTabCounts, statusFilter]);

  useEffect(() => {
    if (statusFilter !== "requestedfiles") return;

    dispatch(
      fetchAllSampleOrders({
        page: samplePagination.page,
        limit: samplePagination.limit,
        search: "",
        status: "designserfilesupload",
      })
    );
  }, [statusFilter, samplePagination.page, samplePagination.limit, dispatch]);

  useEffect(() => {
    const fetchUnits = async () => {
      setLoadingUnits(true);
      try {
        const res = await axiosInstance.get(`${backendUrl}/units?is-active=true`);
        if (res.data.success) {
          setUnitsList(res.data.data || []);
        } else {
          toast.error(res.data.message || "Failed to load units");
        }
      } catch (err) {
        toast.error(err.response?.data?.message || "Error fetching units");
      } finally {
        setLoadingUnits(false);
      }
    };

    fetchUnits();
  }, []);

  const handleimagessizeinput = (e, enquiry) => {
    e.stopPropagation();
    const imageWithId = enquiry.images.find((img) => img._id && !img.imageunit);
    if (!imageWithId) {
      toast.error("No image found to add size");
      return;
    }

    setSelectedEnquiry(enquiry);
    setSelectedImageId(imageWithId._id);
    setSizeModalOpen(true);
  };

  const handleSaveSize = async () => {
    if (!selectedEnquiry) return;

    if (!unit || !productSize) {
      toast.error("Please fill all fields");
      return;
    }

    setSavingSize(true);
    try {
      const jobId = selectedEnquiry._id || selectedEnquiry.rawJob?._id || selectedEnquiry.id;
      const res = await axiosInstance.put(`/enquiry-flow-integration/${jobId}`, {
        "the_ask.size": `${productSize} ${unit}`,
        remarks: `Updated product size to ${productSize} ${unit}`,
      });

      if (res.data?.success) {
        toast.success("Product size updated successfully");
        setSizeModalOpen(false);
        setProductSize("");
        setUnit("");
        fetchEnquiries();
        fetchTabCounts();
      } else {
        toast.error(res.data?.message || "Failed to update size");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Error updating size");
    } finally {
      setSavingSize(false);
    }
  };

  const [Designerview, setDesignerview] = useState(() => {
    const userPermissions = getUserPermissions();
    return Array.isArray(userPermissions) ? userPermissions.includes(11) : null;
  });

  useEffect(() => {
    const userPermissions = getUserPermissions();
    const hasDesignerview = Array.isArray(userPermissions) && userPermissions.includes(11);
    setDesignerview(hasDesignerview);
  }, []);

  const openUploadDesignModal = (enquiry) => {
    setModalContent(
      <MultiTrophyDesignModal
        enquiry={enquiry}
        onClose={() => setModalOpen(false)}
        onRefresh={fetchEnquiries}
      />
    );
    setModalOpen(true);
  };

  const openViewModal = (enquiry) => {
    setModalContent(
      <DesignerEnquiryDetailModal
        enquiry={enquiry}
        jobId={enquiry._id || enquiry.rawJob?._id}
        onClose={() => setModalOpen(false)}
        onOpenUploadDesign={(job) => openUploadDesignModal(job || enquiry)}
      />
    );
    setModalOpen(true);
  };

  const handleViewOrder = (order) => {
    if (order?.is_flow || order?.rawJob) {
      openViewModal(order.rawJob || order);
      return;
    }
    setViewDrawerOrder(order);
    setViewDrawerOpen(true);
  };

  const handleAccept = async (enquiry) => {
    showLoader();
    try {
      const jobId = enquiry._id || enquiry.rawJob?._id || enquiry.id;
      const response = await axiosInstance.put(`/enquiry-flow-integration/${jobId}`, {
        "the_brief.design_status": "processing",
        action: "DESIGN_ACCEPTED",
        remarks: "Designer accepted enquiry",
      });

      if (response.data.success) {
        setEnquiries((prev) =>
          prev.map((item) =>
            (item.id === enquiry.id || item._id === enquiry._id) ? { ...item, accept_image: true, is_processing: true } : item
          )
        );
        toast.success("Enquiry accepted for design");
      } else {
        toast.error(response.data.message || "Failed to accept enquiry");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Error accepting enquiry");
    } finally {
      hideLoader();
      fetchEnquiries();
      fetchTabCounts();
    }
  };

  const handleFileUpload = (event, enquiry) => {
    const file = event.target.files[0];
    if (!file) return;

    const targetImage = enquiry.images?.find((img) => !img.url && !img.endtime);

    if (!targetImage?._id) {
      toast.error("No empty slot available to upload an image.");
      return;
    }

    setConfirmNewFile(file);
    setConfirmEnquiry(enquiry);
    setConfirmSlotId(targetImage._id);
    setConfirmModalOpen(true);
  };

  const confirmUploadNow = async () => {
    if (!confirmNewFile || !confirmEnquiry) return;
    setUploading(true);

    try {
      const rawJob = confirmEnquiry.rawJob || confirmEnquiry;
      const uploadForm = new FormData();
      uploadForm.append("file", confirmNewFile);
      uploadForm.append("clientId", rawJob.customer_id?._id || rawJob.customer_id || "");
      uploadForm.append("clientName", rawJob.customer_id?.name || confirmEnquiry.name || "");
      uploadForm.append("enquiryNo", rawJob.enquiry_no || confirmEnquiry.job_no || "RD");
      uploadForm.append("folderType", "design");

      const upRes = await axiosInstance.post("/enquiry-flow-integration/upload", uploadForm, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (upRes.data?.success) {
        const fileUrl = upRes.data.data?.file_url;
        const subJobNo = rawJob.sub_jobs?.[0]?.sub_job_no || `${rawJob.enquiry_no || "RD"}-A1`;
        const jobId = rawJob._id || confirmEnquiry._id || confirmEnquiry.id || rawJob.enquiry_no;

        await axiosInstance.post(`/enquiry-flow-integration/${jobId}/designer-upload`, {
          designs: {
            [subJobNo]: [fileUrl],
          },
          trophyIndex: 0,
          optionIndex: 0,
          fileUrl: fileUrl,
          designStatus: "uploaded",
        });
        toast.success("Design uploaded successfully to Cloudflare R2 and saved to DB");
      } else {
        toast.error(upRes.data?.message || "Upload failed");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Error uploading image");
    } finally {
      setUploading(false);
      setConfirmModalOpen(false);
      setConfirmNewFile(null);
      setConfirmEnquiry(null);
      setConfirmSlotId(null);
      fetchEnquiries();
      fetchTabCounts();
    }
  };

  const handleComplete = async (enquiryId, enquiry) => {
    showLoader();
    try {
      const target = enquiry || enquiries.find((e) => e.id === enquiryId || e._id === enquiryId);
      const jobId = target?._id || target?.rawJob?._id || enquiryId;

      const response = await axiosInstance.put(`/enquiry-flow-integration/${jobId}`, {
        "the_brief.design_status": "uploaded",
        action: "DESIGN_COMPLETED",
        remarks: "Designer completed enquiry design",
      });

      if (response.data.success) {
        toast.success("Enquiry marked as completed");
      } else {
        toast.error(response.data.message || "Failed to mark as completed");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Error completing enquiry");
    } finally {
      fetchEnquiries();
      fetchTabCounts();
      hideLoader();
    }
  };

  const handleUpdateapproveddesign = (id) => {
    setSelectedOrderId(id);
    setUploadModalOpen(true);
  };

  const handleUploadFileChange = (e) => {
    setUploadFiles([...uploadFiles, ...Array.from(e.target.files)]);
  };

  const removeUploadedFile = (i) => {
    setUploadFiles(uploadFiles.filter((_, idx) => idx !== i));
  };

  const uploadFilesSubmit = async () => {
    if (uploadFiles.length === 0) {
      toast.error("Please select at least one file to upload.");
      return;
    }

    try {
      setUploadLoading(true);

      const isFlow = selectedOrderId && String(selectedOrderId).includes(":::");
      if (isFlow) {
        const [jobId, subJobNo] = String(selectedOrderId).split(":::");
        const formData = new FormData();
        uploadFiles.forEach((file) => formData.append("designer_files", file));
        if (subJobNo) {
          formData.append("sub_job_no", subJobNo);
        }

        const res = await axiosInstance.post(
          `/enquiry-flow-integration/${jobId}/artwork-upload`,
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
          }
        );

        if (res.data?.success) {
          toast.success("Artwork files uploaded successfully! Sub-job moved to Quotation Desk.");
          setUploadModalOpen(false);
          setUploadFiles([]);
          setSelectedOrderId(null);
          await fetchTabCounts();
          fetchEnquiries();
        } else {
          toast.error(res.data?.message || "File upload failed");
        }
        return;
      }

      const formData = new FormData();
      uploadFiles.forEach((file) => formData.append("designer_files", file));
      formData.append("is_design_uploaded", true);

      await dispatch(updateSampleOrderById({ id: selectedOrderId, formData })).unwrap();

      toast.success("Files uploaded successfully!");

      setUploadModalOpen(false);
      setUploadFiles([]);

      dispatch(
        fetchAllSampleOrders({
          page: samplePagination.page,
          limit: samplePagination.limit,
          search: "",
          status: "designserfilesupload",
        })
      );
      triggerSampleSalesCountRefresh();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "File upload failed");
    } finally {
      setUploadLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setStatusFilter(newValue);
    setCurrentPage(1);
  };

  // Define colors for each tab
  const getTabColors = (value) => {
    const colorMap = {
      "": { color: "#1e293b", border: "#1e293b", bg: "#1e293b" },
      false: { color: "#f59e0b", border: "#f59e0b", bg: "#f59e0b" },
      true: { color: "#06b6d4", border: "#06b6d4", bg: "#06b6d4" },
      rework: { color: "#f97316", border: "#f97316", bg: "#f97316" },
      complete: { color: "#64748b", border: "#64748b", bg: "#64748b" },
      requestedfiles: { color: "#10b981", border: "#10b981", bg: "#10b981" },
    };
    return colorMap[value] || { color: "#64748b", border: "#64748b", bg: "#64748b" };
  };

  const allRequestedOrders = [
    ...flowRequestedOrders,
    ...(sampleSalesOrders || [])
  ];

  const filteredRequestedOrders = allRequestedOrders.filter((item) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      item.sub_job_no?.toLowerCase().includes(q) ||
      item.job_no?.toLowerCase().includes(q) ||
      item.product_name?.toLowerCase().includes(q) ||
      item.customer?.toLowerCase().includes(q) ||
      item.client_name?.toLowerCase().includes(q)
    );
  });

  const displayedRequestedOrders = filteredRequestedOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Derived filtered & sorted items by priority (Rush First / Overdue / Rush Only)
  const displayedEnquiries = useMemo(() => {
    return filterAndSortByPriority(rawTabItems, priorityFilter);
  }, [rawTabItems, priorityFilter]);

  // Counts for Overdue & Rush badges across all active jobs
  const priorityCounts = useMemo(() => {
    return countPriorityItems(allFlowItems);
  }, [allFlowItems]);

  // Client-side pagination for displayed enquiries
  const paginatedEnquiries = useMemo(() => {
    return displayedEnquiries.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
  }, [displayedEnquiries, currentPage, itemsPerPage]);

  const activeTotalPages = statusFilter === "requestedfiles"
    ? (Math.ceil(filteredRequestedOrders.length / itemsPerPage) || 1)
    : (Math.ceil(displayedEnquiries.length / itemsPerPage) || 1);

  const activeTotalCount = statusFilter === "requestedfiles"
    ? filteredRequestedOrders.length
    : displayedEnquiries.length;

  if (Designerview === null) {
    return <div className="text-center mt-10 text-gray-500">Loading permissions...</div>;
  }

  return (
    <>
      {/* Search & Priority Filter Row */}
      <div className="bg-white p-3.5 sm:p-4 shadow-sm mb-6 mt-12 rounded-xl border border-gray-100">
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
          {/* Left: Search input */}
          <div className="relative flex-1 min-w-[220px]">
            <input
              type="text"
              placeholder="Search by job no (e.g. RD21072), product, client..."
              className="w-full pl-10 pr-9 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-all"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
            <i className="fa-solid fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setCurrentPage(1);
                }}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full cursor-pointer"
                title="Clear search"
              >
                <i className="fa-solid fa-xmark text-xs"></i>
              </button>
            )}
          </div>

          {/* Right Corner: Priority Filters */}
          {statusFilter !== "requestedfiles" && (
            <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap shrink-0 overflow-x-auto pb-1 md:pb-0">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mr-1 hidden xl:inline">
                Filter:
              </span>

              {/* All */}
              <button
                type="button"
                onClick={() => {
                  setPriorityFilter("all");
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer whitespace-nowrap ${priorityFilter === "all"
                    ? "bg-slate-800 text-white border-slate-800 shadow-sm"
                    : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50 hover:text-gray-900"
                  }`}
              >
                All
              </button>

              {/* Rush First */}
              <button
                type="button"
                onClick={() => {
                  setPriorityFilter((prev) => (prev === "rush_first" ? "all" : "rush_first"));
                  setCurrentPage(1);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer whitespace-nowrap ${priorityFilter === "rush_first"
                    ? "bg-amber-600 text-white border-amber-600 shadow-sm ring-2 ring-amber-300"
                    : (priorityCounts.rush > 0 || priorityCounts.overdue > 0)
                      ? "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
                      : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                  }`}
                title="Filter Rush & Overdue jobs first"
              >
                <span>⚡ Rush First</span>
              </button>

              {/* Overdue */}
              <button
                type="button"
                onClick={() => {
                  setPriorityFilter((prev) => (prev === "overdue" ? "all" : "overdue"));
                  setCurrentPage(1);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer whitespace-nowrap ${priorityFilter === "overdue"
                    ? "bg-rose-600 text-white border-rose-600 shadow-sm ring-2 ring-rose-300"
                    : priorityCounts.overdue > 0
                      ? "bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100"
                      : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                  }`}
                title="Filter overdue jobs where target time has expired"
              >
                <span>🚨 Overdue</span>
                {priorityCounts.overdue > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${priorityFilter === "overdue"
                        ? "bg-white text-rose-700"
                        : "bg-rose-600 text-white"
                      }`}
                  >
                    {priorityCounts.overdue}
                  </span>
                )}
              </button>

              {/* Rush Only */}
              <button
                type="button"
                onClick={() => {
                  setPriorityFilter((prev) => (prev === "rush" ? "all" : "rush"));
                  setCurrentPage(1);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer whitespace-nowrap ${priorityFilter === "rush"
                    ? "bg-orange-600 text-white border-orange-600 shadow-sm ring-2 ring-orange-300"
                    : priorityCounts.rush > 0
                      ? "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
                      : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                  }`}
                title="Filter jobs due within 4 hours"
              >
                <span>🔥 Rush</span>
                {priorityCounts.rush > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${priorityFilter === "rush"
                        ? "bg-white text-orange-700"
                        : "bg-amber-600 text-white"
                      }`}
                  >
                    {priorityCounts.rush}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Card-Style Tabs */}
      {isMobile ? (
        <FormControl fullWidth sx={{ mb: 2, px: 2 }}>
          <Select
            value={statusFilter}
            onChange={(e) => handleTabChange(null, e.target.value)}
            displayEmpty
            sx={{
              "& .MuiSelect-select": {
                display: "flex",
                alignItems: "center",
                gap: 1,
              },
            }}
          >
            {tabs.map((tab) => (
              <MenuItem key={tab.value} value={tab.value}>
                {tab.label} {tab.count !== undefined ? `(${tab.count})` : ""}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      ) : (
        <Box
          sx={{
            mb: 3,
            px: 2,
            position: "relative",
          }}
        >
          <Box
            sx={{
              display: "flex",
              gap: 2,
              overflowX: "auto",
              overflowY: "hidden",
              pb: 2,
              scrollBehavior: "smooth",
              "&::-webkit-scrollbar": {
                height: "8px",
              },
              "&::-webkit-scrollbar-track": {
                backgroundColor: "#f1f5f9",
                borderRadius: "10px",
              },
              "&::-webkit-scrollbar-thumb": {
                backgroundColor: "#cbd5e1",
                borderRadius: "10px",
                "&:hover": {
                  backgroundColor: "#94a3b8",
                },
              },
              scrollbarWidth: "thin",
              scrollbarColor: "#cbd5e1 #f1f5f9",
            }}
          >
            {tabs.map((tab) => {
              const isActive = statusFilter === tab.value;
              const colors = getTabColors(tab.value);

              return (
                <Box
                  key={tab.value}
                  onClick={() => handleTabChange(null, tab.value)}
                  sx={{
                    minWidth: "140px",
                    flexShrink: 0,
                    padding: "15px",
                    borderRadius: "10px",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    textAlign: "center",
                    background: isActive ? colors.bg : "white",
                    border: isActive ? "none" : `2px solid ${colors.border}`,
                    color: isActive ? "white" : colors.color,
                    boxShadow: isActive
                      ? "0 8px 15px rgba(0,0,0,0.15)"
                      : "0 4px 6px rgba(0,0,0,0.05)",
                    transform: isActive ? "scale(1.05)" : "scale(1)",
                    "&:hover": {
                      transform: "translateY(-3px)",
                      boxShadow: "0 8px 15px rgba(0,0,0,0.1)",
                    },
                  }}
                >
                  <Box
                    sx={{
                      fontSize: "2.5rem",
                      fontWeight: 800,
                      lineHeight: 1,
                      mb: 0.5,
                    }}
                  >
                    {tab.count}
                  </Box>
                  <Box
                    sx={{
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {tab.label.replace(/_/g, " ")}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

      <div className="px-4 mb-8">
        {statusFilter === "requestedfiles" ? (
          displayedRequestedOrders.length === 0 ? (
            <p className="text-center text-gray-500">No approved design files pending upload.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {displayedRequestedOrders.map((sampleOrder) => (
                <SampleorderCard
                  key={sampleOrder.id}
                  sampleOrder={sampleOrder}
                  navigate={navigate}
                  Enquirysmoduleonly={true}
                  requestedfiles={true}
                  handleUpdateapproveddesign={handleUpdateapproveddesign}
                  onView={handleViewOrder}
                />
              ))}
            </div>
          )
        ) : displayedEnquiries.length === 0 ? (
          <p className="text-center text-gray-500">No data found.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {paginatedEnquiries.map((enquiry) => {
              return (
                <EnquiryCard
                  key={enquiry.id}
                  enquiry={enquiry}
                  openViewModal={() => openViewModal(enquiry)}
                  openUploadModal={() => openUploadDesignModal(enquiry)}
                  handleAccept={() => handleAccept(enquiry)}
                  showAcceptButton={false}
                  handleFileUpload={handleFileUpload}
                  uploading={uploading}
                  handleComplete={() => handleComplete(enquiry.id, enquiry)}
                  designerview={true}
                  handleimagessizeinput={handleimagessizeinput}
                  AssociateRole={false}
                />
              );
            })}
          </div>
        )}
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={activeTotalPages}
        onPageChange={setCurrentPage}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={(newItemsPerPage) => {
          setItemsPerPage(newItemsPerPage);
          setCurrentPage(1);
        }}
        totalCount={activeTotalCount}
        startIndex={(currentPage - 1) * itemsPerPage}
        visibleItemCount={statusFilter === "requestedfiles" ? displayedRequestedOrders.length : paginatedEnquiries.length}
      />

      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setModalOpen(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>{modalContent}</div>
        </div>
      )}

      {/* Right-side DesignerApprovedViewModal drawer */}
      {viewDrawerOpen && viewDrawerOrder && (
        <DesignerApprovedViewModal
          order={viewDrawerOrder}
          onClose={() => setViewDrawerOpen(false)}
        />
      )}

      <SizeInputModal
        open={sizeModalOpen}
        onClose={() => setSizeModalOpen(false)}
        unitsList={unitsList}
        loadingUnits={loadingUnits}
        unit={unit}
        setUnit={setUnit}
        productSize={productSize}
        setProductSize={setProductSize}
        onSave={handleSaveSize}
        savingSize={savingSize}
      />

      <ImageConfirmModal
        open={confirmModalOpen}
        newImage={confirmNewFile}
        previousImages={
          confirmEnquiry?.images?.filter((i) => i.url)?.map((i) => i.url) || []
        }
        previousImageNames={
          confirmEnquiry?.images?.filter((i) => i.url)?.map((i) => i.name || "image") || []
        }
        confirmLoading={uploading}
        onClose={() => {
          setConfirmModalOpen(false);
          setConfirmNewFile(null);
          setConfirmEnquiry(null);
          setConfirmSlotId(null);
          const fileInputs = document.querySelectorAll('input[type="file"]');
          fileInputs.forEach(input => (input.value = ""));
        }}
        onConfirm={confirmUploadNow}
      />

      <DesignerFileUploadModal
        open={uploadModalOpen}
        files={uploadFiles}
        onClose={() => setUploadModalOpen(false)}
        onFileChange={handleUploadFileChange}
        onRemoveFile={removeUploadedFile}
        onSubmit={uploadFilesSubmit}
        loading={uploadLoading}
      />
    </>
  );
};

export default DesignEnquiryList;