import mongoose from "mongoose";
import enquiryModel from "../../models/enquiry/enquiryModel.js";
import sampleorderSchema from "../../models/sales_orders/sales_order_list_Model.js";
import dtpStudioModel from "../../models/dtp_studio/dtpStudioModel.js";
import shopFloorJobModel from "../../models/shopfloor/shopFloorJobModel.js";
import FgStore from "../../models/controltower/fgStoreModel.js";
// import CtQc from "../../models/controltower/ctQcModel.js";
// import CtPack from "../../models/controltower/ctPackModel.js";
import CtInvoice from "../../models/controltower/ctInvoiceModel.js";
import salesorderformModel from "../../models/sales_orders/sales_order_form_Model.js";

const isDateToday = (dateVal) => {
    if (!dateVal) return false;
    try {
        const str = String(dateVal).trim();
        if (!str || str === "—" || str === "null" || str === "undefined") return false;

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        const todayYYYYMMDD = `${year}-${month}-${day}`;
        const todayDDMMYYYY = `${day}-${month}-${year}`;

        if (str.startsWith(todayYYYYMMDD) || str.startsWith(todayDDMMYYYY)) return true;

        const d = new Date(str);
        if (!isNaN(d.getTime())) {
            return (
                d.getFullYear() === now.getFullYear() &&
                d.getMonth() === now.getMonth() &&
                d.getDate() === now.getDate()
            );
        }

        const parts = str.split(/[-/ T]/);
        if (parts.length >= 3) {
            let pYear, pMonth, pDay;
            if (parts[0].length === 4) {
                pYear = parseInt(parts[0], 10);
                pMonth = parseInt(parts[1], 10);
                pDay = parseInt(parts[2], 10);
            } else if (parts[2].length === 4) {
                pDay = parseInt(parts[0], 10);
                pMonth = parseInt(parts[1], 10);
                pYear = parseInt(parts[2], 10);
            }
            if (pYear === now.getFullYear() && pMonth === (now.getMonth() + 1) && pDay === now.getDate()) {
                return true;
            }
        }
        return false;
    } catch (e) {
        console.log(e)
        return false;
    }
};

/**
 * @desc Get lightweight aggregated counts for all Client Servicing Hub lanes & stations
 * @route GET /api/client-servicing-hub/counts
 * @access Private
 */
export const getClientServicingCounts = async (req, res) => {
    try {
        const { client, owner, dueToday } = req.query;
        const isDueTodayOnly = String(dueToday) === "true";

        // Build base filters (Excluding hold, on_hold, abandon, and cancelled items)
        let enqFilter = {
            is_active: { $ne: false },
            is_cancelled: { $nin: [true, "true"] },
            is_on_hold: { $nin: [true, "true"] },
            status: { $nin: ["abandon", "on_hold", "hold", "cancelled"] }
        };
        let soFilter = {
            is_active: { $ne: false },
            is_cancelled: { $nin: [true, "true"] },
            is_on_hold: { $nin: [true, "true"] },
            status: { $nin: ["abandon", "on_hold", "hold", "cancelled"] }
        };

        if (client && client.trim()) {
            enqFilter.name = client.trim();
        }

        // 0. Build map of job completion date from sales order forms
        const sofRecords = await salesorderformModel.find()
            .select("job_no sub_job_no job_completion_datetime job_completion_date delivery_date")
            .lean();
        const sofCompDateMap = new Map();
        sofRecords.forEach(s => {
            const compDt = s.job_completion_datetime || s.job_completion_date || s.delivery_date;
            if (s.sub_job_no && compDt) sofCompDateMap.set(s.sub_job_no, compDt);
            if (s.job_no && compDt && !sofCompDateMap.has(s.job_no)) sofCompDateMap.set(s.job_no, compDt);
        });

        // 1. Fetch raw enquiries and raw orders
        const rawEnquiries = await enquiryModel.find(enqFilter)
            .populate("cordinator", "name")
            .populate("created_by", "name")
            .select("_id job_no name product_name product_quantity delivery_date job_completion_date job_completion_datetime cordinator created_by status is_on_hold is_cancelled is_designer_allocated is_designer_completed is_accept")
            .lean();

        const rawOrders = await sampleorderSchema.find(soFilter)
            .populate({
                path: "enquiry_id",
                select: "_id name product_name product_quantity delivery_date job_completion_date job_completion_datetime cordinator created_by status is_on_hold is_cancelled",
                populate: [
                    { path: "cordinator", select: "name" },
                    { path: "created_by", select: "name" }
                ]
            })
            .populate("created_by", "name")
            .select("_id sub_job_no status type is_on_hold is_cancelled is_pushed_shop_floor is_verified_to_proceed is_bom_verified is_price_approved is_pi_uploaded is_pi_verified is_sales_order_filled is_bom_filled is_challan_uploaded enquiry_id created_by delivery_date job_completion_datetime")
            .lean();

        // Build set of enquiry IDs that ALREADY have sub-jobs (orders)
        const enquiryIdsWithSubJobs = new Set();
        rawOrders.forEach(so => {
            const enqId = so.enquiry_id?._id || so.enquiry_id;
            if (enqId) enquiryIdsWithSubJobs.add(enqId.toString());
        });

        // Filter out parent enquiries that already have sub-jobs
        const activeParentEnquiries = rawEnquiries.filter(e => !enquiryIdsWithSubJobs.has(e._id.toString()));

        let enquiryCreate = 0;
        let enquiryAssign = 0;
        let enquiryStatus = 0;
        let designUploads = 0;
        let designReview = 0;
        let designOrderType = 0;

        const matchesOwner = (ownerNames, filterOwner) => {
            if (!filterOwner || !filterOwner.trim()) return true;
            const target = filterOwner.trim().toLowerCase();
            return ownerNames.some(name => name && String(name).trim().toLowerCase() === target);
        };

        const ownerCountsMap = {};

        let activeParentEnquiriesCount = 0;
        activeParentEnquiries.forEach(enq => {
            if (enq.is_on_hold || enq.is_cancelled || ["abandon", "on_hold", "hold", "cancelled"].includes(enq.status)) return;
            const clientName = enq.name;
            const ownerNames = [enq.cordinator?.name, enq.created_by?.name];

            if (client && client.trim() && String(clientName || "").trim() !== client.trim()) return;
            if (!matchesOwner(ownerNames, owner)) return;

            const jobCompDate = sofCompDateMap.get(enq.job_no) || enq.job_completion_date || enq.job_completion_datetime || enq.delivery_date;
            if (isDueTodayOnly && !isDateToday(jobCompDate)) return;

            activeParentEnquiriesCount++;

            const pOwner = enq.cordinator?.name || enq.created_by?.name;
            if (pOwner) {
                ownerCountsMap[pOwner] = (ownerCountsMap[pOwner] || 0) + 1;
            }

            if (enq.status === "enquiry" || !enq.status) {
                enquiryCreate++;
                if (!enq.is_designer_allocated) enquiryAssign++;
                else enquiryStatus++;
            } else if (enq.status === "design") {
                if (!enq.is_designer_allocated || !enq.is_designer_completed) designUploads++;
                else if (!enq.is_accept) designReview++;
                else designOrderType++;
            }
        });

        // 2. Active / Incompleted Station collections for Shop Floor
        const activeDtpJobs = await dtpStudioModel.find({ is_active: { $ne: false }, is_on_hold: { $ne: true }, status: { $nin: ["Completed", "Shop Floor", "on_hold", "hold", "abandon"] } }).select("sub_job_no status").lean();
        const activeDtpSubJobNos = new Set(activeDtpJobs.map(d => d.sub_job_no));

        const activeFgJobs = await FgStore.find({ is_active: { $ne: false }, is_on_hold: { $ne: true }, status: { $nin: ["Completed", "QC Completed", "on_hold", "hold", "abandon"] }, stage: { $ne: "COMPLETED" } }).select("job_no sub_job_no stage status").lean();
        const fgJobMap = new Map();
        activeFgJobs.forEach(fg => fgJobMap.set(fg.sub_job_no || fg.job_no, fg));

        // Get incompleted shop floor jobs (status != Completed)
        const activeSfJobs = await shopFloorJobModel.find({ is_active: { $ne: false }, is_hold: { $ne: true }, status: { $nin: ["Completed", "on_hold", "hold", "abandon"] } }).select("sub_job_no process_name department status").lean();
        const sfJobMap = new Map();
        activeSfJobs.forEach(sf => {
            if (!sfJobMap.has(sf.sub_job_no)) sfJobMap.set(sf.sub_job_no, []);
            sfJobMap.get(sf.sub_job_no).push(sf);
        });

        let designSampleForm = 0;
        let designProdForm = 0;
        let costingBom = 0;
        let costingCostReview = 0;
        let quotationSent = 0;
        let quotationApproved = 0;
        let quotationPi = 0;
        let quotationReleaseGate = 0;
        let quotationProduction = 0;

        let shopfloorDtp = 0;
        let shopfloorLaser = 0;
        let shopfloorPainting = 0;
        let shopfloorUv = 0;
        let shopfloorAssembly = 0;
        let shopfloorFgStore = 0;
        let shopfloorQc = 0;
        let shopfloorPacking = 0;
        // let shopfloorUniqueOrders = 0;

        let dispatchReady = 0;
        let dispatchDelivery = 0;
        let dispatchBilling = 0;
        let dispatchCompleted = 0;

        const getBaseJobNo = (str) => {
            if (!str) return "";
            return String(str).replace(/-R\d*$/i, "").replace(/[a-z]$/i, "").trim();
        };

        // ----------------------------------------------------
        // A) SUB-JOB LEVEL STATION COUNTS (Activity Command Center)
        // ----------------------------------------------------
        let validSubJobsCount = 0;
        const ordersByEnquiryMap = new Map();
        const dueTodayFloor = {
            dtp: 0,
            uv: 0,
            laser: 0,
            packing: 0,
            dispatch: 0,
            total: 0
        };

        rawOrders.forEach(so => {
            if (so.is_on_hold || so.is_cancelled || ["abandon", "on_hold", "hold", "cancelled"].includes(so.status)) return;
            if (so.enquiry_id?.is_on_hold || so.enquiry_id?.is_cancelled || ["abandon", "on_hold", "hold", "cancelled"].includes(so.enquiry_id?.status)) return;

            const clientName = so.enquiry_id?.name;
            const ownerNames = [so.enquiry_id?.cordinator?.name, so.enquiry_id?.created_by?.name, so.created_by?.name];

            if (client && client.trim() && String(clientName || "").trim() !== client.trim()) return;
            if (!matchesOwner(ownerNames, owner)) return;

            const jobCompDate = sofCompDateMap.get(so.sub_job_no) || sofCompDateMap.get(so.job_no) || so.job_completion_datetime || so.enquiry_id?.job_completion_datetime || so.enquiry_id?.job_completion_date || so.enquiry_id?.delivery_date || so.delivery_date;

            if (isDateToday(jobCompDate)) {
                const subNo = so.sub_job_no;
                if (so.status === "complete" || so.status === "dispatch") {
                    if (!so.is_challan_uploaded || so.status === "dispatch") {
                        dueTodayFloor.dispatch++;
                    }
                } else if (so.status === "process" || so.is_pushed_shop_floor) {
                    if (activeDtpSubJobNos.has(subNo)) {
                        dueTodayFloor.dtp++;
                    } else if (fgJobMap.has(subNo)) {
                        const fg = fgJobMap.get(subNo);
                        const stg = String(fg.stage || "").toUpperCase();
                        if (stg === "PACKING") dueTodayFloor.packing++;
                        else if (stg === "UV" || stg === "PRINTING") dueTodayFloor.uv++;
                        else dueTodayFloor.laser++;
                    } else if (sfJobMap.has(subNo)) {
                        const sfList = sfJobMap.get(subNo) || [];
                        let matchedProc = false;
                        sfList.forEach(sf => {
                            if (matchedProc) return;
                            const proc = String(sf.process_name || sf.department || "").toLowerCase();
                            if (proc.includes("uv") || proc.includes("print")) { dueTodayFloor.uv++; matchedProc = true; }
                            else if (proc.includes("pack")) { dueTodayFloor.packing++; matchedProc = true; }
                            else if (proc.includes("laser") || proc.includes("cut")) { dueTodayFloor.laser++; matchedProc = true; }
                            else if (proc.includes("dispatch") || proc.includes("delivery")) { dueTodayFloor.dispatch++; matchedProc = true; }
                        });
                        if (!matchedProc) dueTodayFloor.laser++;
                    } else {
                        dueTodayFloor.laser++;
                    }
                }
            }

            if (isDueTodayOnly && !isDateToday(jobCompDate)) return;

            validSubJobsCount++;

            const pOwner = so.enquiry_id?.cordinator?.name || so.enquiry_id?.created_by?.name || so.created_by?.name;
            if (pOwner) {
                ownerCountsMap[pOwner] = (ownerCountsMap[pOwner] || 0) + 1;
            }

            const enqIdStr = so.enquiry_id?._id?.toString() || so.enquiry_id?.toString();
            const baseNo = getBaseJobNo(so.sub_job_no || so.job_no);
            const key = enqIdStr || baseNo || so._id.toString();

            if (!ordersByEnquiryMap.has(key)) {
                ordersByEnquiryMap.set(key, []);
            }
            ordersByEnquiryMap.get(key).push(so);

            if (so.status === "closed") {
                dispatchCompleted++;
            } else if (so.status === "complete" || so.status === "dispatch") {
                if (!so.is_challan_uploaded) dispatchReady++;
                else if (so.status === "dispatch") dispatchDelivery++;
                else dispatchBilling++;
            } else if (so.status === "process" || so.is_pushed_shop_floor) {
                // shopfloorUniqueOrders++;
                const subNo = so.sub_job_no;
                if (activeDtpSubJobNos.has(subNo)) {
                    shopfloorDtp++;
                } else if (fgJobMap.has(subNo)) {
                    const fg = fgJobMap.get(subNo);
                    const stg = String(fg.stage || "").toUpperCase();
                    const fgStat = String(fg.status || "");
                    if (stg === "INWARD" || stg === "INVOICE") shopfloorFgStore++;
                    else if (stg === "QC" && fgStat !== "QC Completed") shopfloorQc++;
                    else if (stg === "PACKING" && fgStat !== "Packing Completed") shopfloorPacking++;
                    else shopfloorLaser++;
                } else if (sfJobMap.has(subNo)) {
                    const sfList = sfJobMap.get(subNo) || [];
                    let matchedProc = false;
                    sfList.forEach(sf => {
                        if (matchedProc) return;
                        const proc = String(sf.process_name || sf.department || "").toLowerCase();
                        if (proc.includes("laser") || proc.includes("cut")) { shopfloorLaser++; matchedProc = true; }
                        else if (proc.includes("paint")) { shopfloorPainting++; matchedProc = true; }
                        else if (proc.includes("uv") || proc.includes("print")) { shopfloorUv++; matchedProc = true; }
                        else if (proc.includes("assembly")) { shopfloorAssembly++; matchedProc = true; }
                        else if (proc.includes("fg") || proc.includes("store")) { shopfloorFgStore++; matchedProc = true; }
                        else if (proc.includes("qc") || proc.includes("inspection")) { shopfloorQc++; matchedProc = true; }
                        else if (proc.includes("pack")) { shopfloorPacking++; matchedProc = true; }
                    });
                    if (!matchedProc) shopfloorLaser++;
                } else {
                    shopfloorLaser++;
                }
            } else if (so.is_verified_to_proceed) {
                quotationProduction++;
            } else if (so.is_bom_verified) {
                if (!so.is_price_approved) quotationSent++;
                else if (!so.is_pi_uploaded) quotationApproved++;
                else if (!so.is_pi_verified) quotationPi++;
                else quotationReleaseGate++;
            } else if (so.is_sales_order_filled) {
                if (!so.is_bom_filled) costingBom++;
                else costingCostReview++;
            } else {
                if (so.type === "sample") designSampleForm++;
                else designProdForm++;
            }
        });

        dueTodayFloor.total = dueTodayFloor.dtp + dueTodayFloor.uv + dueTodayFloor.laser + dueTodayFloor.packing + dueTodayFloor.dispatch;

        // ----------------------------------------------------
        // B) PARENT ENQUIRY LEVEL STATS (KPI Strip)
        // ----------------------------------------------------
        let parentDesignCostingCount = 0;
        let parentAwaitingClientCount = 0;
        let parentInProductionCount = 0;
        let parentReadyDispatchedCount = 0;
        let uniqueMainOrdersCount = 0;

        ordersByEnquiryMap.forEach((rawSoList) => {
            const soList = rawSoList.filter(so =>
                !so.is_on_hold &&
                !so.is_cancelled &&
                !["abandon", "on_hold", "hold", "cancelled"].includes(so.status) &&
                !so.enquiry_id?.is_on_hold &&
                !so.enquiry_id?.is_cancelled &&
                !["abandon", "on_hold", "hold", "cancelled"].includes(so.enquiry_id?.status)
            );

            if (!soList || soList.length === 0) return;

            const firstSo = soList[0];
            const clientName = firstSo.enquiry_id?.name;
            const ownerNames = soList.flatMap(so => [so.enquiry_id?.cordinator?.name, so.enquiry_id?.created_by?.name, so.created_by?.name]);

            if (client && client.trim() && String(clientName || "").trim() !== client.trim()) return;
            if (!matchesOwner(ownerNames, owner)) return;

            const hasClosed = soList.every(so => so.status === "closed");
            if (!hasClosed) {
                uniqueMainOrdersCount++;

                const hasDispatched = soList.every(so => so.status === "complete" || so.status === "dispatch");
                const hasShopfloor = !hasDispatched && soList.some(so => so.status === "process" || so.is_pushed_shop_floor);
                const hasVerifiedProceed = !hasDispatched && !hasShopfloor && soList.some(so => so.is_verified_to_proceed);
                const hasBomVerified = !hasDispatched && !hasShopfloor && !hasVerifiedProceed && soList.some(so => so.is_bom_verified);

                if (hasDispatched) {
                    parentReadyDispatchedCount++;
                } else if (hasShopfloor) {
                    parentInProductionCount++;
                } else if (hasVerifiedProceed || hasBomVerified) {
                    parentAwaitingClientCount++;
                } else {
                    parentDesignCostingCount++;
                }
            }
        });

        // ----------------------------------------------------
        // C) COLLECTION INVOICES (CtInvoice model)
        // ----------------------------------------------------
        const rawInvoices = await CtInvoice.find().lean();
        const invoiceSubJobNos = rawInvoices.map(i => i.sub_job_no).filter(Boolean);
        const matchingInvoiceOrders = await sampleorderSchema.find({ sub_job_no: { $in: invoiceSubJobNos } })
            .populate({
                path: "enquiry_id",
                select: "name cordinator created_by",
                populate: [
                    { path: "cordinator", select: "name" },
                    { path: "created_by", select: "name" }
                ]
            })
            .populate("created_by", "name")
            .lean();
        const invoiceOrderMap = new Map();
        matchingInvoiceOrders.forEach(o => invoiceOrderMap.set(o.sub_job_no, o));

        let collectionOutstanding = 0;
        let collectionDuesoon = 0;
        let collectionOverdue = 0;
        let collectionFollowup = 0;
        let collectionPartial = 0;
        let totalOutstandingAmt = 0;
        const uniqueClientsWithDues = new Set();
        const now = new Date();

        rawInvoices.forEach(inv => {
            const order = invoiceOrderMap.get(inv.sub_job_no);
            const clientName = order?.enquiry_id?.name || inv.clientName || inv.client;
            const ownerNames = [order?.enquiry_id?.cordinator?.name, order?.enquiry_id?.created_by?.name, order?.created_by?.name, inv.by];

            if (client && client.trim() && String(clientName || "").trim() !== client.trim()) return;
            if (!matchesOwner(ownerNames, owner)) return;

            const invCompDate = inv.dueDate || (order?.sub_job_no ? sofCompDateMap.get(order.sub_job_no) : null) || order?.job_completion_datetime || order?.delivery_date;
            if (isDueTodayOnly && !isDateToday(invCompDate)) return;

            const amt = Number(inv.totalAmt || inv.subtotal || 0);
            totalOutstandingAmt += amt;

            let stationId = "outstanding";
            if (inv.dueDate) {
                const due = new Date(inv.dueDate);
                const diffTime = now - due;
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays > 0) {
                    if (diffDays >= 30) stationId = "overdue";
                    else stationId = "followup";
                } else {
                    const dueIn = Math.abs(diffDays);
                    if (dueIn <= 7) stationId = "duesoon";
                }
            }

            collectionOutstanding++;
            if (stationId === "duesoon") collectionDuesoon++;
            else if (stationId === "overdue") collectionOverdue++;
            else if (stationId === "followup") collectionFollowup++;
            else if (stationId === "partial") collectionPartial++;

            if (clientName && String(clientName).trim()) {
                uniqueClientsWithDues.add(String(clientName).trim());
            }
        });

        const counts = {
            enquiry: {
                create: enquiryCreate,
                clone: 0,
                edit: enquiryStatus,
                clientwise: enquiryCreate,
                status: enquiryStatus,
                assign: enquiryAssign
            },
            design: {
                uploads: designUploads,
                review: designReview,
                ordertype: designOrderType,
                sampleform: designSampleForm,
                prodform: designProdForm,
                revisions: 0
            },
            costing: {
                bom: costingBom,
                costreview: costingCostReview,
                margincheck: 0,
                adminapproval: 0
            },
            quotation: {
                quotesent: quotationSent,
                quoteapproved: quotationApproved,
                pi: quotationPi,
                releasegate: quotationReleaseGate,
                production: quotationProduction
            },
            shopfloor: {
                dtp: shopfloorDtp,
                laser: shopfloorLaser,
                painting: shopfloorPainting,
                uv: shopfloorUv,
                assembly: shopfloorAssembly,
                fgstore: shopfloorFgStore,
                qc: shopfloorQc,
                packing: shopfloorPacking
            },
            dispatch: {
                readydispatch: dispatchReady,
                delivery: dispatchDelivery,
                billing: dispatchBilling,
                completed: dispatchCompleted
            },
            collection: {
                outstanding: collectionOutstanding,
                duesoon: collectionDuesoon,
                overdue: collectionOverdue,
                followup: collectionFollowup,
                partial: collectionPartial,
                clientwise: uniqueClientsWithDues.size
            }
        };

        const enquiryStageTotal = enquiryCreate + enquiryAssign + enquiryStatus;
        const designCostingTotal = (designUploads + designReview + designOrderType) + parentDesignCostingCount;
        const awaitingClientTotal = parentAwaitingClientCount;
        const inProductionTotal = parentInProductionCount;
        const readyDispatchedTotal = parentReadyDispatchedCount;

        // Total active unique main enquiries across parent enquiries & main enquiry orders
        const totalActive = activeParentEnquiriesCount + uniqueMainOrdersCount;

        const stats = {
            totalActive,
            parentEnquiries: activeParentEnquiriesCount,
            subJobs: validSubJobsCount,
            enquiryStage: enquiryStageTotal,
            designCosting: designCostingTotal,
            awaitingClient: awaitingClientTotal,
            inProduction: inProductionTotal,
            readyDispatched: readyDispatchedTotal,
            totalOutstanding: totalOutstandingAmt
        };

        return res.status(200).json({
            success: true,
            stats,
            counts,
            ownerCounts: ownerCountsMap,
            dueTodayFloor
        });

    } catch (error) {
        console.error("Error in getClientServicingCounts:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch Client Servicing Hub counts",
            error: error.message
        });
    }
};

/**
 * @desc Get lazy-loaded paginated job list for a specific station card click
 * @route GET /api/client-servicing-hub/station-jobs
 * @access Private
 */
export const getStationJobsList = async (req, res) => {
    try {
        const { laneId, stationId, page = 1, limit = 10, search = "", client = "", owner = "", dueToday = "" } = req.query;
        const isDueTodayOnly = String(dueToday) === "true";
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 10);
        const skip = (pageNum - 1) * limitNum;

        let jobsList = [];
        let total = 0;

        const safeFormatDate = (dateVal) => {
            if (!dateVal) return "—";
            try {
                const d = new Date(dateVal);
                if (isNaN(d.getTime())) return String(dateVal);
                return d.toISOString().split('T')[0];
            } catch (e) {
                console.log(e)
                return String(dateVal);
            }
        };

        const effectivePhase = (laneId === "total_ledger" || laneId === "ledger") ? stationId : laneId;

        const matchesOwner = (ownerNames, filterOwner) => {
            if (!filterOwner || !filterOwner.trim()) return true;
            const target = filterOwner.trim().toLowerCase();
            return ownerNames.some(name => name && String(name).trim().toLowerCase() === target);
        };

        if (effectivePhase === "collection" || laneId === "collection") {
            const rawInvoices = await CtInvoice.find().lean().sort({ createdAt: -1 });
            const invoiceSubJobNos = rawInvoices.map(i => i.sub_job_no).filter(Boolean);
            const matchingInvoiceOrders = await sampleorderSchema.find({ sub_job_no: { $in: invoiceSubJobNos } })
                .populate({
                    path: "enquiry_id",
                    select: "name cordinator created_by",
                    populate: [
                        { path: "cordinator", select: "name" },
                        { path: "created_by", select: "name" }
                    ]
                })
                .populate("created_by", "name")
                .lean();
            const invoiceOrderMap = new Map();
            matchingInvoiceOrders.forEach(o => invoiceOrderMap.set(o.sub_job_no, o));

            const now = new Date();
            let invoiceList = [];

            rawInvoices.forEach(inv => {
                const order = invoiceOrderMap.get(inv.sub_job_no);
                const clientName = order?.enquiry_id?.name || "Unknown Client";
                const ownerName = order?.enquiry_id?.cordinator?.name || order?.enquiry_id?.created_by?.name || order?.created_by?.name || inv.by || "Unassigned";
                const ownerNames = [order?.enquiry_id?.cordinator?.name, order?.enquiry_id?.created_by?.name, order?.created_by?.name, inv.by];

                if (client && client.trim() && String(clientName || "").trim() !== client.trim()) return;
                if (!matchesOwner(ownerNames, owner)) return;
                if (isDueTodayOnly && !isDateToday(inv.dueDate || order?.job_completion_datetime || order?.delivery_date)) return;

                let daysOverdue = 0;
                let dueIn = null;
                let bucket = "outstanding";

                if (inv.dueDate) {
                    const due = new Date(inv.dueDate);
                    const diffTime = now - due;
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    if (diffDays > 0) {
                        daysOverdue = diffDays;
                        if (daysOverdue >= 30) bucket = "overdue";
                        else bucket = "followup";
                    } else {
                        dueIn = Math.abs(diffDays);
                        if (dueIn <= 7) bucket = "duesoon";
                    }
                }

                if (stationId === "duesoon" && bucket !== "duesoon") return;
                if (stationId === "overdue" && bucket !== "overdue") return;
                if (stationId === "followup" && bucket !== "followup") return;
                if (stationId === "partial" && bucket !== "partial") return;

                invoiceList.push({
                    id: inv._id,
                    invoiceNo: inv.invoiceNo,
                    jobNo: inv.sub_job_no || inv.job_no,
                    client: clientName,
                    amount: Number(inv.totalAmt || inv.subtotal || 0),
                    stationId: bucket,
                    daysOverdue,
                    dueIn,
                    owner: ownerName,
                    lastFollowUp: inv.dueDate ? safeFormatDate(inv.dueDate) : "—"
                });
            });

            if (search && search.trim()) {
                const q = search.trim().toLowerCase();
                invoiceList = invoiceList.filter(inv =>
                    String(inv.invoiceNo || "").toLowerCase().includes(q) ||
                    String(inv.client || "").toLowerCase().includes(q) ||
                    String(inv.jobNo || "").toLowerCase().includes(q)
                );
            }

            total = invoiceList.length;
            const pagedInvoices = stationId === "clientwise" ? invoiceList : invoiceList.slice(skip, skip + limitNum);

            return res.status(200).json({
                success: true,
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.max(1, Math.ceil(total / limitNum)),
                data: pagedInvoices
            });
        }

        const sofRecords = await salesorderformModel.find()
            .select("job_no sub_job_no job_completion_datetime job_completion_date delivery_date")
            .lean();
        const sofCompDateMap = new Map();
        sofRecords.forEach(s => {
            const compDt = s.job_completion_datetime || s.job_completion_date || s.delivery_date;
            if (s.sub_job_no && compDt) sofCompDateMap.set(s.sub_job_no, compDt);
            if (s.job_no && compDt && !sofCompDateMap.has(s.job_no)) sofCompDateMap.set(s.job_no, compDt);
        });

        // Query based on effectivePhase
        if (effectivePhase === "enquiry" || (effectivePhase === "design" && stationId !== "sampleform" && stationId !== "prodform")) {
            // Build set of enquiry IDs that ALREADY have active sub-jobs (orders)
            const existingOrders = await sampleorderSchema.find({
                is_cancelled: { $nin: [true, "true"] },
                is_active: { $ne: false }
            }).select("enquiry_id").lean();

            const enquiryIdsWithSubJobs = existingOrders
                .map(so => {
                    const id = so.enquiry_id?._id || so.enquiry_id;
                    if (!id) return null;
                    try {
                        return typeof id === "string" ? new mongoose.Types.ObjectId(id) : id;
                    } catch (e) {
                        console.log(e)
                        return id;
                    }
                })
                .filter(Boolean);

            let filter = {
                _id: { $nin: enquiryIdsWithSubJobs },
                is_active: { $ne: false },
                is_cancelled: { $nin: [true, "true"] },
                is_on_hold: { $nin: [true, "true"] },
                status: { $nin: ["abandon", "on_hold", "hold", "cancelled"] }
            };
            if (client) filter.name = client.trim();

            const conditions = [];

            if (effectivePhase === "enquiry") {
                conditions.push({
                    $or: [{ status: "enquiry" }, { status: { $exists: false } }, { status: "" }, { status: null }]
                });
                if (stationId === "assign") filter.is_designer_allocated = { $ne: true };
                else if (stationId === "status") filter.is_designer_allocated = true;
            } else if (effectivePhase === "design") {
                filter.status = "design";
                if (stationId === "uploads") {
                    conditions.push({
                        $or: [{ is_designer_allocated: { $ne: true } }, { is_designer_completed: { $ne: true } }]
                    });
                } else if (stationId === "review") {
                    filter.is_designer_completed = true;
                    filter.is_accept = { $ne: true };
                } else if (stationId === "ordertype") {
                    filter.is_designer_completed = true;
                    filter.is_accept = true;
                }
            }

            if (search && search.trim()) {
                const q = search.trim();
                conditions.push({
                    $or: [
                        { job_no: { $regex: q, $options: "i" } },
                        { name: { $regex: q, $options: "i" } },
                        { product_name: { $regex: q, $options: "i" } }
                    ]
                });
            }

            if (conditions.length > 0) {
                filter.$and = conditions;
            }

            let docs = await enquiryModel.find(filter)
                .populate("cordinator", "name")
                .populate("created_by", "name")
                .select("job_no name product_name product_quantity delivery_date job_completion_date job_completion_datetime cordinator created_by is_designer_allocated status")
                .sort({ createdAt: -1 })
                .lean();

            if (isDueTodayOnly) {
                docs = docs.filter(e => {
                    const compDt = sofCompDateMap.get(e.job_no) || e.job_completion_date || e.job_completion_datetime || e.delivery_date;
                    return isDateToday(compDt);
                });
            }

            total = docs.length;
            const pagedDocs = docs.slice(skip, skip + limitNum);

            jobsList = pagedDocs.map(e => {
                const compDt = sofCompDateMap.get(e.job_no) || e.job_completion_date || e.job_completion_datetime || e.delivery_date;
                return {
                    id: e._id,
                    jobNo: e.job_no,
                    client: e.name || "Unknown Client",
                    product: e.product_name || "Unknown Product",
                    qty: e.product_quantity || 1,
                    laneId: laneId || "enquiry",
                    stationId: stationId || "status",
                    priority: "Normal",
                    owner: e.cordinator?.name || e.created_by?.name || "Unassigned",
                    delivery: safeFormatDate(compDt),
                    completionDate: safeFormatDate(compDt),
                    job_completion_date: safeFormatDate(compDt),
                    score: 100,
                    isParentEnquiry: true
                };
            });
        } else {
            // Sub-job queries (Design, Costing, Quotation, Shopfloor, Dispatch)
            let filter = {
                is_active: { $ne: false },
                is_cancelled: { $nin: [true, "true"] },
                is_on_hold: { $nin: [true, "true"] },
                status: { $nin: ["abandon", "on_hold", "hold", "cancelled"] }
            };

            const validEnquiries = await enquiryModel.find({
                is_active: { $ne: false },
                is_cancelled: { $nin: [true, "true"] },
                is_on_hold: { $nin: [true, "true"] },
                status: { $nin: ["abandon", "on_hold", "hold", "cancelled"] }
            }).select("_id name cordinator created_by").lean();

            let validEnquiryIds = validEnquiries.map(e => e._id);
            if (client && client.trim()) {
                const targetClient = client.trim().toLowerCase();
                const clientEnquiryIds = validEnquiries
                    .filter(e => String(e.name || "").trim().toLowerCase() === targetClient)
                    .map(e => e._id);
                filter.enquiry_id = { $in: clientEnquiryIds };
            } else {
                filter.enquiry_id = { $in: validEnquiryIds };
            }

            const subJobConditions = [];

            if (effectivePhase === "design") {
                filter.is_sales_order_filled = { $ne: true };
                filter.is_bom_verified = { $ne: true };
                filter.is_verified_to_proceed = { $ne: true };
                filter.is_pushed_shop_floor = { $ne: true };
                filter.status = { $nin: ["process", "closed", "complete", "dispatch"] };
                if (stationId === "sampleform") filter.type = "sample";
                else if (stationId === "prodform") filter.type = { $ne: "sample" };
            } else if (effectivePhase === "costing") {
                filter.is_sales_order_filled = true;
                filter.is_bom_verified = { $ne: true };
                filter.is_verified_to_proceed = { $ne: true };
                filter.is_pushed_shop_floor = { $ne: true };
                filter.status = { $nin: ["process", "closed", "complete", "dispatch"] };
                if (stationId === "bom") filter.is_bom_filled = { $ne: true };
                else if (stationId === "costreview") filter.is_bom_filled = true;
            } else if (effectivePhase === "quotation") {
                filter.is_pushed_shop_floor = { $ne: true };
                filter.status = { $nin: ["process", "closed", "complete", "dispatch"] };
                if (stationId === "quotesent") {
                    filter.is_bom_verified = true;
                    filter.is_verified_to_proceed = { $ne: true };
                    filter.is_price_approved = { $ne: true };
                } else if (stationId === "quoteapproved") {
                    filter.is_bom_verified = true;
                    filter.is_verified_to_proceed = { $ne: true };
                    filter.is_price_approved = true;
                    filter.is_pi_uploaded = { $ne: true };
                } else if (stationId === "pi") {
                    filter.is_bom_verified = true;
                    filter.is_verified_to_proceed = { $ne: true };
                    filter.is_pi_uploaded = true;
                    filter.is_pi_verified = { $ne: true };
                } else if (stationId === "releasegate") {
                    filter.is_bom_verified = true;
                    filter.is_verified_to_proceed = { $ne: true };
                    filter.is_pi_verified = true;
                } else if (stationId === "production") {
                    filter.is_verified_to_proceed = true;
                } else {
                    subJobConditions.push({
                        $or: [{ is_bom_verified: true }, { is_verified_to_proceed: true }]
                    });
                }
            } else if (effectivePhase === "shopfloor") {
                subJobConditions.push({
                    $or: [{ status: "process" }, { is_pushed_shop_floor: true }]
                });
                filter.status = { $nin: ["closed", "complete", "dispatch"] };
            } else if (effectivePhase === "dispatch") {
                if (stationId === "completed") filter.status = "closed";
                else if (stationId === "readydispatch") {
                    filter.status = { $in: ["complete", "dispatch"] };
                    filter.is_challan_uploaded = { $ne: true };
                } else if (stationId === "delivery") {
                    filter.status = "dispatch";
                    filter.is_challan_uploaded = true;
                } else if (stationId === "billing") {
                    filter.status = "complete";
                    filter.is_challan_uploaded = true;
                } else {
                    filter.status = { $in: ["complete", "dispatch"] };
                }
            } else if (effectivePhase === "completed") {
                filter.status = "closed";
            }

            if (search && search.trim()) {
                const q = search.trim();
                subJobConditions.push({
                    $or: [
                        { sub_job_no: { $regex: q, $options: "i" } }
                    ]
                });
            }

            if (subJobConditions.length > 0) {
                filter.$and = subJobConditions;
            }

            let docs = await sampleorderSchema.find(filter)
                .populate({
                    path: "enquiry_id",
                    select: "name product_name product_quantity delivery_date job_completion_date job_completion_datetime cordinator created_by",
                    populate: [
                        { path: "cordinator", select: "name" },
                        { path: "created_by", select: "name" }
                    ]
                })
                .populate("created_by", "name")
                .sort({ createdAt: -1 })
                .lean();

            if (effectivePhase === "shopfloor" && stationId && stationId !== "all" && stationId !== "shopfloor") {
                const activeDtpJobs = await dtpStudioModel.find({ is_active: { $ne: false }, is_on_hold: { $ne: true }, status: { $nin: ["Completed", "Shop Floor", "on_hold", "hold", "abandon"] } }).select("sub_job_no status").lean();
                const activeDtpSubJobNos = new Set(activeDtpJobs.map(d => d.sub_job_no));

                const activeFgJobs = await FgStore.find({ is_active: { $ne: false }, is_on_hold: { $ne: true }, status: { $nin: ["Completed", "QC Completed", "on_hold", "hold", "abandon"] }, stage: { $ne: "COMPLETED" } }).select("job_no sub_job_no stage status").lean();
                const fgJobMap = new Map();
                activeFgJobs.forEach(fg => fgJobMap.set(fg.sub_job_no || fg.job_no, fg));

                const activeSfJobs = await shopFloorJobModel.find({ is_active: { $ne: false }, is_hold: { $ne: true }, status: { $nin: ["Completed", "on_hold", "hold", "abandon"] } }).select("sub_job_no process_name department status").lean();
                const sfJobMap = new Map();
                activeSfJobs.forEach(sf => {
                    if (!sfJobMap.has(sf.sub_job_no)) sfJobMap.set(sf.sub_job_no, []);
                    sfJobMap.get(sf.sub_job_no).push(sf);
                });

                docs = docs.filter(so => {
                    const subNo = so.sub_job_no;
                    let targetSt = "laser";
                    if (activeDtpSubJobNos.has(subNo)) {
                        targetSt = "dtp";
                    } else if (fgJobMap.has(subNo)) {
                        const fg = fgJobMap.get(subNo);
                        const stg = String(fg.stage || "").toUpperCase();
                        const fgStat = String(fg.status || "");
                        if (stg === "INWARD" || stg === "INVOICE") targetSt = "fgstore";
                        else if (stg === "QC" && fgStat !== "QC Completed") targetSt = "qc";
                        else if (stg === "PACKING" && fgStat !== "Packing Completed") targetSt = "packing";
                        else targetSt = "laser";
                    } else if (sfJobMap.has(subNo)) {
                        const sfList = sfJobMap.get(subNo) || [];
                        let matched = false;
                        sfList.forEach(sf => {
                            if (matched) return;
                            const proc = String(sf.process_name || sf.department || "").toLowerCase();
                            if (proc.includes("laser") || proc.includes("cut")) { targetSt = "laser"; matched = true; }
                            else if (proc.includes("paint")) { targetSt = "painting"; matched = true; }
                            else if (proc.includes("uv") || proc.includes("print")) { targetSt = "uv"; matched = true; }
                            else if (proc.includes("assembly")) { targetSt = "assembly"; matched = true; }
                            else if (proc.includes("fg") || proc.includes("store")) { targetSt = "fgstore"; matched = true; }
                            else if (proc.includes("qc") || proc.includes("inspection")) { targetSt = "qc"; matched = true; }
                            else if (proc.includes("pack")) { targetSt = "packing"; matched = true; }
                        });
                    }
                    return targetSt === stationId;
                });
            }

            if (owner && owner.trim()) {
                const targetOwner = owner.trim().toLowerCase();
                docs = docs.filter(so => {
                    const ownerNames = [so.enquiry_id?.cordinator?.name, so.enquiry_id?.created_by?.name, so.created_by?.name];
                    return ownerNames.some(name => name && String(name).trim().toLowerCase() === targetOwner);
                });
            }

            if (isDueTodayOnly) {
                docs = docs.filter(so => {
                    const compDt = sofCompDateMap.get(so.sub_job_no) || sofCompDateMap.get(so.job_no) || so.job_completion_datetime || so.enquiry_id?.job_completion_datetime || so.enquiry_id?.job_completion_date || so.enquiry_id?.delivery_date || so.delivery_date;
                    return isDateToday(compDt);
                });
            }

            total = docs.length;
            const pagedDocs = docs.slice(skip, skip + limitNum);

            jobsList = pagedDocs.map(so => {
                const compDt = sofCompDateMap.get(so.sub_job_no) || sofCompDateMap.get(so.job_no) || so.job_completion_datetime || so.enquiry_id?.job_completion_datetime || so.enquiry_id?.job_completion_date || so.enquiry_id?.delivery_date || so.delivery_date;
                return {
                    id: so._id,
                    jobNo: so.sub_job_no,
                    client: so.enquiry_id?.name || "Unknown Client",
                    product: so.enquiry_id?.product_name || "Unknown Product",
                    qty: so.enquiry_id?.product_quantity || 1,
                    laneId: laneId || "shopfloor",
                    stationId: stationId || "laser",
                    priority: "Normal",
                    owner: so.enquiry_id?.cordinator?.name || so.enquiry_id?.created_by?.name || so.created_by?.name || "Unassigned",
                    delivery: safeFormatDate(compDt),
                    completionDate: safeFormatDate(compDt),
                    job_completion_date: safeFormatDate(compDt),
                    score: 95,
                    isParentEnquiry: false
                };
            });
        }

        const totalPages = Math.max(1, Math.ceil(total / limitNum));

        return res.status(200).json({
            success: true,
            page: pageNum,
            limit: limitNum,
            total,
            totalPages,
            data: jobsList
        });

    } catch (error) {
        console.error("Error in getStationJobsList:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch station jobs list",
            error: error.message
        });
    }
};
