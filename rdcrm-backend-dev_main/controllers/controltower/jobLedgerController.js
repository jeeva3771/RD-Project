// eslint-disable-next-line no-unused-vars
import mongoose from "mongoose";
import shopFloorJobModel from "../../models/shopfloor/shopFloorJobModel.js";
import salesorder from "../../models/sales_orders/sales_order_list_Model.js";
import salesorderformModel from "../../models/sales_orders/sales_order_form_Model.js";
import bomModel from "../../models/bom/bomModel.js";
import standalonebomModel from "../../models/standalone_bom/standalonebomModel.js";
import enquiryModel from "../../models/enquiry/enquiryModel.js";
// eslint-disable-next-line no-unused-vars
import readyJobModel from "../../models/shopfloor/shopFloorReadyJobModel.js";
import FgStore from "../../models/controltower/fgStoreModel.js";
import CtPack from "../../models/controltower/ctPackModel.js";
import { generateSignedUrl } from "../../helpers/r2helper.js";
import dtpStudioModel from "../../models/dtp_studio/dtpStudioModel.js";
// import userModel from "../../models/users/userModel.js";

/**
 * @desc Get aggregated list of all unique jobs for Job Ledger Sidebar & Audit Center
 * @route GET /job-ledger/jobs
 * @access Private
 */
export const getJobLedgerList = async (req, res) => {
    try {
        const { search, status, filter, page, limit, dueToday } = req.query;

        const userId = req.user?._id || req.user?.id;
        const userRoleLower = String(req.user?.role?.name || req.user?.role || "").toLowerCase();
        const isExecutive = userRoleLower.includes("client servicing executive");
        const isManagerOrAdmin = userRoleLower.includes("client servicing manager") || userRoleLower.includes("admin") || userRoleLower.includes("superadmin");

        let salesOrderQuery = { is_active: true };
        let enquiryQuery = {};

        if (isExecutive && !isManagerOrAdmin && userId) {
            const executiveEnquiries = await enquiryModel.find({
                $or: [
                    { created_by: userId },
                    { cordinator: userId }
                ]
            }).select("_id").lean();
            const enquiryIds = executiveEnquiries.map(e => e._id);

            salesOrderQuery = {
                is_active: true,
                $or: [
                    { created_by: userId },
                    { enquiry_id: { $in: enquiryIds } }
                ]
            };
            enquiryQuery = {
                $or: [
                    { created_by: userId },
                    { cordinator: userId }
                ]
            };
        }

        // Parallel high-speed fetch across all data sources (pure lean without slow populates)
        const [
            salesOrders,
            salesOrderForms,
            boms,
            standaloneBoms,
            enquiries,
            shopFloorJobs,
            fgRecords,
            packRecords,
            dtpJobs
        ] = await Promise.all([
            salesorder
                .find(salesOrderQuery)
                .populate("designer_person", "name")
                .populate("updated_by.user", "name")
                .populate("price_approved_by", "name")
                .populate("pi_history.action_by_user", "name role")
                .populate("bom_history.action_by_user", "name role")
                .populate("created_by", "name role")
                .sort({ createdAt: -1 })
                .lean(),

            salesorderformModel
                .find()
                .sort({ createdAt: -1 })
                .lean(),

            bomModel
                .find()
                .select("job_no sub_job_no enquiry_id quotation jobSheet costdetails totalUnitCost totalJobCost material_specification job_quantity material_groups materialprocess items packingdatas sales_order_nanoid id is_active qty_update")
                .sort({ createdAt: -1 })
                .lean(),

            standalonebomModel
                .find()
                .select("job_no sub_job_no quotation jobSheet costdetails totalUnitCost totalJobCost material_specification job_quantity material_groups materialprocess items packingdatas sales_order_nanoid id is_active qty_update")
                .sort({ createdAt: -1 })
                .lean(),

            enquiryModel
                .find(enquiryQuery)
                .select("name client_name product_name quantity rate gst_percentage final_total email wp_number mobile_no reference_no job_no sub_job_no contact_person created_at createdAt is_active created_by cordinator")
                .populate("created_by", "name role")
                .populate("cordinator", "name role")
                .sort({ createdAt: -1 })
                .lean(),

            shopFloorJobModel
                .find()
                .sort({ createdAt: -1 })
                .lean(),

            FgStore
                .find()
                .select("job_no sub_job_no inward_qty invoiced_qty stage status logs updatedAt")
                .sort({ createdAt: -1 })
                .lean(),

            CtPack
                .find()
                .sort({ createdAt: -1 })
                .lean(),

            dtpStudioModel
                .find({ is_active: true })
                .select("job_no sub_job_no status assigned_to_name assigned_at job_completion_date actual_completion_date is_on_hold urgency_sent stage_updates")
                .sort({ createdAt: -1 })
                .lean()
        ]);

        // Build lookup maps for fast matching
        const soMap = new Map();
        salesOrders.forEach((so) => {
            if (so._id) soMap.set(String(so._id), so);
            if (so.job_no) soMap.set(String(so.job_no), so);
            if (so.sub_job_no) soMap.set(String(so.sub_job_no), so);
        });

        const allBoms = [...boms, ...(standaloneBoms || [])];
        const bomMap = new Map();
        allBoms.forEach((b) => {
            if (b._id) bomMap.set(String(b._id), b);
            if (b.id) {
                bomMap.set(String(b.id), b);
                bomMap.set(String(b.id).toLowerCase().trim(), b);
            }
            if (b.enquiry_id) {
                const enqIdStr = String(b.enquiry_id._id || b.enquiry_id);
                bomMap.set(enqIdStr, b);
                bomMap.set(enqIdStr.toLowerCase().trim(), b);
            }
            if (b.job_no) {
                bomMap.set(String(b.job_no), b);
                bomMap.set(String(b.job_no).toLowerCase().trim(), b);
            }
            if (b.sub_job_no) {
                bomMap.set(String(b.sub_job_no), b);
                bomMap.set(String(b.sub_job_no).toLowerCase().trim(), b);
            }
            if (b.sales_order_nanoid) {
                bomMap.set(String(b.sales_order_nanoid), b);
                bomMap.set(String(b.sales_order_nanoid).toLowerCase().trim(), b);
            }
        });

        const enquiryMap = new Map();
        enquiries.forEach((e) => {
            if (e._id) enquiryMap.set(String(e._id), e);
            if (e.job_no) enquiryMap.set(String(e.job_no), e);
            if (e.reference_no) enquiryMap.set(String(e.reference_no), e);
        });

        const sofMap = new Map();
        salesOrderForms.forEach((sof) => {
            if (sof._id) sofMap.set(String(sof._id), sof);
            if (sof.id) {
                sofMap.set(String(sof.id), sof);
                sofMap.set(String(sof.id).toLowerCase().trim(), sof);
            }
            if (sof.enquiry_id) {
                sofMap.set(String(sof.enquiry_id._id || sof.enquiry_id), sof);
            }
            if (sof.sample__order_id) {
                sofMap.set(String(sof.sample__order_id._id || sof.sample__order_id), sof);
            }
            if (sof.job_no) {
                sofMap.set(String(sof.job_no), sof);
                sofMap.set(String(sof.job_no).toLowerCase().trim(), sof);
            }
            if (sof.sub_job_no) {
                sofMap.set(String(sof.sub_job_no), sof);
                sofMap.set(String(sof.sub_job_no).toLowerCase().trim(), sof);
            }
        });

        const dtpMultiMap = new Map();
        const addToDtpMultiMap = (key, dtp) => {
            if (!key) return;
            const k = String(key).toLowerCase().trim();
            if (!dtpMultiMap.has(k)) dtpMultiMap.set(k, []);
            dtpMultiMap.get(k).push(dtp);
        };
        dtpJobs.forEach((dtp) => {
            if (dtp.sub_job_no) addToDtpMultiMap(dtp.sub_job_no, dtp);
            else if (dtp.job_no) addToDtpMultiMap(dtp.job_no, dtp);
        });

        const shopFloorMap = new Map();
        const shopFloorMultiMap = new Map();
        const addToMultiMap = (key, sf) => {
            if (!key) return;
            const k = String(key).toLowerCase().trim();
            if (!shopFloorMultiMap.has(k)) shopFloorMultiMap.set(k, []);
            shopFloorMultiMap.get(k).push(sf);
        };

        shopFloorJobs.forEach((sf) => {
            if (sf.sales_order_id) {
                const soId = String(sf.sales_order_id._id || sf.sales_order_id);
                shopFloorMap.set(soId, sf);
                addToMultiMap(soId, sf);
            }
            if (sf.so_number) {
                shopFloorMap.set(String(sf.so_number), sf);
                addToMultiMap(sf.so_number, sf);
            }
            if (sf.enquiry_id) {
                const enqId = String(sf.enquiry_id._id || sf.enquiry_id);
                shopFloorMap.set(enqId, sf);
                addToMultiMap(enqId, sf);
            }
            if (sf.job_no) {
                shopFloorMap.set(String(sf.job_no), sf);
                addToMultiMap(sf.job_no, sf);
            }
            if (sf.sub_job_no) {
                shopFloorMap.set(String(sf.sub_job_no), sf);
                addToMultiMap(sf.sub_job_no, sf);
            }
        });

        const extractShopfloorDetails = (uniqueSfJobs, defaultQty = 0) => {
            const inhouseList = [];
            const outsourceList = [];

            if (!Array.isArray(uniqueSfJobs) || uniqueSfJobs.length === 0) {
                return { inhouseList, outsourceList };
            }

            uniqueSfJobs.forEach((sf) => {
                const sfJobNo = sf.job_no || '';
                const sfSubJobNo = sf.sub_job_no || '';
                const sfDept = sf.department || sf.process_name || 'Manufacturing';
                const sfProcName = sf.process_name || sfDept;
                const sfStatus = sf.status || 'Pending';
                const sfProgress = typeof sf.progress === 'number' ? sf.progress : 0;
                const sfCompletedQty = Number(sf.completed_qty) || 0;
                const sfTotalQty = Number(sf.total_qty) || Number(defaultQty) || 0;
                const sfAssignHistory = Array.isArray(sf.assign_history) ? sf.assign_history : [];

                if (Array.isArray(sf.material_groups) && sf.material_groups.length > 0) {
                    sf.material_groups.forEach((mg) => {
                        const grpId = mg.group_id || mg._id || 'GRP';
                        const grpName = mg.group_name || sfProcName;
                        const procIndex = mg.process_index || mg.input?.process_index || '-';
                        const mgStatus = mg.status || sfStatus;
                        const mgProgress = typeof mg.progress === 'number' ? mg.progress : sfProgress;
                        const firstMat = mg.materials?.[0] || {};
                        const matInput = firstMat.material_input || mg.input || {};
                        const upsVal = Number(matInput.ups) || 1;
                        const sizeStr = matInput.size || firstMat.size || (matInput.one_up_length && matInput.one_up_width ? `${matInput.one_up_length}x${matInput.one_up_width}` : '');
                        const totalSheets = Number(firstMat.quantity) || Number(mg.process_qty) || 1;
                        const outsourcedSheets = Number(mg.assigned_outsource_sheets) || 0;
                        const inhouseSheets = Number(mg.inhouse_qty) || Math.max(0, totalSheets - outsourcedSheets);

                        // 1. OUTSOURCE DETAILS (Inside outsource_assignments or group.is_outsource)
                        if (Array.isArray(mg.outsource_assignments) && mg.outsource_assignments.length > 0) {
                            mg.outsource_assignments.forEach((assignment) => {
                                const actualDelivered = (assignment.batch_receipts || []).reduce(
                                    (sum, br) => sum + (br.type === 'actual' ? (Number(br.qty) || 0) : 0), 0
                                );
                                const expectedDelivered = (assignment.batch_receipts || []).reduce(
                                    (sum, br) => sum + (br.type === 'expected' ? (Number(br.qty) || 0) : 0), 0
                                );

                                outsourceList.push({
                                    assignment_id: String(assignment._id || assignment.token || Math.random()),
                                    job_id: sf._id,
                                    job_no: sfJobNo,
                                    sub_job_no: sfSubJobNo,
                                    process_name: sfProcName,
                                    department: sfDept,
                                    group_id: grpId,
                                    group_name: grpName,
                                    process_index: procIndex,
                                    vendor_id: assignment.vendor_id,
                                    vendor_name: assignment.vendor_name || mg.vendor_name || 'Outsource Vendor',
                                    outsource_rate: Number(assignment.outsource_rate) || Number(mg.outsource_rate) || 0,
                                    outsource_qty: Number(assignment.outsource_qty) || Number(mg.outsource_qty) || (outsourcedSheets * upsVal),
                                    outsource_sheets: Number(assignment.outsource_sheets) || outsourcedSheets,
                                    ups: upsVal,
                                    size: sizeStr,
                                    delivery_date: assignment.outsource_delivery_date || mg.outsource_delivery_date || '',
                                    assigned_at: assignment.assigned_at || '',
                                    current_stage_idx: typeof assignment.current_stage_idx === 'number'
                                        ? assignment.current_stage_idx
                                        : (assignment.status === 'Completed' ? 4 : 0),
                                    status: assignment.status || mgStatus || 'Pending',
                                    stage_history: Array.isArray(assignment.stage_history) ? assignment.stage_history : [],
                                    batch_receipts: Array.isArray(assignment.batch_receipts) ? assignment.batch_receipts : [],
                                    assign_history: sfAssignHistory.filter(a => String(a.group_id) === String(mg._id) || a.group_name === mg.group_name),
                                    actual_delivered_qty: actualDelivered,
                                    expected_delivered_qty: expectedDelivered,
                                    invoice_no: assignment.invoice_no || '',
                                    invoice_date: assignment.invoice_date || '',
                                    invoice_amt: Number(assignment.invoice_amt) || 0,
                                    rejection_reason: assignment.rejection_reason || ''
                                });
                            });
                        } else if (mg.is_outsource) {
                            outsourceList.push({
                                assignment_id: String(mg._id || Math.random()),
                                job_id: sf._id,
                                job_no: sfJobNo,
                                sub_job_no: sfSubJobNo,
                                process_name: sfProcName,
                                department: sfDept,
                                group_id: grpId,
                                group_name: grpName,
                                process_index: procIndex,
                                vendor_id: mg.vendor_id || null,
                                vendor_name: mg.vendor_name || 'Outsource Vendor',
                                outsource_rate: Number(mg.outsource_rate) || 0,
                                outsource_qty: Number(mg.outsource_qty) || (outsourcedSheets * upsVal),
                                outsource_sheets: outsourcedSheets,
                                ups: upsVal,
                                size: sizeStr,
                                delivery_date: mg.outsource_delivery_date || '',
                                assigned_at: '',
                                current_stage_idx: mgStatus === 'Completed' ? 4 : (mgStatus === 'In Progress' ? 2 : 0),
                                status: mgStatus || 'Pending',
                                stage_history: [],
                                batch_receipts: [],
                                assign_history: sfAssignHistory.filter(a => String(a.group_id) === String(mg._id) || a.group_name === mg.group_name),
                                actual_delivered_qty: 0,
                                expected_delivered_qty: 0,
                                invoice_no: '',
                                invoice_date: '',
                                invoice_amt: 0,
                                rejection_reason: ''
                            });
                        }

                        // 2. IN-HOUSE DETAILS (From material_group)
                        const isFullyOutsourced = Boolean(
                            mg.is_outsource &&
                            (!mg.inhouse_qty || Number(mg.inhouse_qty) === 0) &&
                            (!mg.bom_inhouse_qty || Number(mg.bom_inhouse_qty) === 0) &&
                            (outsourcedSheets >= totalSheets)
                        );

                        if (!isFullyOutsourced || (mg.inward_history && mg.inward_history.length > 0) || (mg.process_history && mg.process_history.length > 0)) {
                            inhouseList.push({
                                job_id: sf._id,
                                job_no: sfJobNo,
                                sub_job_no: sfSubJobNo,
                                process_name: sfProcName,
                                department: sfDept,
                                group_id: grpId,
                                group_name: grpName,
                                process_index: procIndex,
                                inhouse_sheets: inhouseSheets,
                                inhouse_qty: inhouseSheets * upsVal,
                                process_qty: Number(mg.process_qty) || totalSheets,
                                process_rate: Number(mg.process_rate) || 0,
                                ups: upsVal,
                                completed_qty: sfCompletedQty,
                                progress: mgProgress,
                                status: mgStatus,
                                materials: (mg.materials || []).map(m => {
                                    const mInp = m.material_input || {};
                                    const mSize = mInp.size || m.size || (mInp.one_up_length && mInp.one_up_width ? `${mInp.one_up_length}x${mInp.one_up_width}` : '');
                                    return {
                                        material_name: m.material_name || m.item_id || 'Material',
                                        material_type: m.material_type || 'sheet',
                                        category_type: m.category_type || 'Raw Material',
                                        size: mSize,
                                        ups: mInp.ups || upsVal,
                                        one_up_length: mInp.one_up_length,
                                        one_up_width: mInp.one_up_width,
                                        quantity: Number(m.quantity) || 0,
                                        unit: m.unit || (m.material_type === 'sheet' ? 'sheets' : 'pcs')
                                    };
                                }),
                                assigned_shifts: mg.assigned_shifts || sf.assigned_shifts || [],
                                team_allocations: sf.team_allocations || [],
                                assign_history: sfAssignHistory.filter(a => String(a.group_id) === String(mg._id) || a.group_name === mg.group_name),
                                inward_history: (mg.inward_history || []).map(inw => ({
                                    inspect_qty: Number(inw.inspect_qty) || 0,
                                    good_qty: Number(inw.good_qty) || 0,
                                    bad_qty: Number(inw.bad_qty) || 0,
                                    operator_name: inw.operator_name || '',
                                    total_sq_inch_accepted: Number(inw.total_sq_inch_accepted) || 0,
                                    accepted_value: Number(inw.accepted_value) || 0,
                                    timestamp: inw.timestamp || inw.created_at || ''
                                })),
                                process_history: (mg.process_history || []).map(ph => ({
                                    activity_type: ph.activity_type || 'Production',
                                    action: ph.action || '',
                                    operator_name: ph.operator_name || '',
                                    timestamp: ph.timestamp || '',
                                    remarks: ph.details?.remarks || '',
                                    good_qty: ph.details?.good_qty,
                                    bad_qty: ph.details?.bad_qty
                                }))
                            });
                        }
                    });
                } else {
                    inhouseList.push({
                        job_id: sf._id,
                        job_no: sfJobNo,
                        sub_job_no: sfSubJobNo,
                        process_name: sfProcName,
                        department: sfDept,
                        group_id: 'sec_1',
                        group_name: sf.category || sfProcName,
                        process_index: '1.1',
                        inhouse_sheets: 1,
                        inhouse_qty: sfTotalQty,
                        process_qty: sfTotalQty,
                        process_rate: 0,
                        ups: 1,
                        completed_qty: sfCompletedQty,
                        progress: sfProgress,
                        status: sfStatus,
                        materials: [],
                        assigned_shifts: sf.assigned_shifts || [],
                        team_allocations: sf.team_allocations || [],
                        assign_history: sfAssignHistory,
                        inward_history: [],
                        process_history: []
                    });
                }
            });

            return { inhouseList, outsourceList };
        };

        const fgMap = new Map();
        fgRecords.forEach((fg) => {
            if (fg._id) fgMap.set(String(fg._id), fg);
            if (fg.sub_job_no) fgMap.set(String(fg.sub_job_no).trim(), fg);
        });

        const packMap = new Map();
        packRecords.forEach((pk) => {
            if (pk._id) packMap.set(String(pk._id), pk);
            if (pk.sub_job_no) packMap.set(String(pk.sub_job_no).trim(), pk);
        });

        const isRevisionJob = (jobId) => {
            if (!jobId || typeof jobId !== 'string') return false;
            return /-R\d*$/i.test(jobId.trim());
        };

        const formatDateOnly = (dt) => {
            if (!dt || typeof dt !== 'string') return '';
            return dt.split('T')[0].split(' ')[0].trim();
        };

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

        const isPopulated = (doc) => Boolean(doc && typeof doc === 'object' && !doc._bsontype && (doc.job_no || doc.quotation || doc.name || doc.client_name || doc.job_quantity));

        const cleanText = (val) => {
            if (!val) return '';
            const s = String(val).trim();
            return (s.toLowerCase() === 'undefined' || s.toLowerCase() === 'null' || s.toLowerCase() === 'n/a') ? '' : s;
        };

        const getSafeSignedUrl = (url) => {
            if (!url || typeof url !== 'string') return '';
            try {
                if (url.startsWith('http://') || url.startsWith('https://')) {
                    return generateSignedUrl(url) || url;
                }
                return url;
                // eslint-disable-next-line no-unused-vars
            } catch (e) {
                return url;
            }
        };

        // Safe number parser for strings, numbers, or schema objects
        const parseNum = (val) => {
            if (val === null || val === undefined) return 0;
            if (typeof val === 'number') return isNaN(val) ? 0 : val;
            if (typeof val === 'string') {
                const cleaned = val.replace(/[^0-9.-]/g, '');
                const n = parseFloat(cleaned);
                return isNaN(n) ? 0 : n;
            }
            if (typeof val === 'object') {
                return parseNum(val.value || val.Number || val.total || val.totalUnitCost || val.totalJobCost || val.finalUnitPrice || val.finalJobPrice);
            }
            return 0;
        };

        const jobsMap = new Map();

        // STEP 1: Process Sales Orders (salesorderlistModel with is_active: true) as Primary Source
        salesOrders.forEach((so) => {
            const rawId = so.sub_job_no || so.job_no || so.id || (so._id ? `SO-${so._id}` : null);
            if (!rawId) return;

            // STRICT FILTER: Do not take revision jobs like RD21021a-R1, RD21021a-R2, RD21021a-R
            if (isRevisionJob(rawId) || isRevisionJob(so.sub_job_no) || isRevisionJob(so.job_no)) {
                return;
            }

            const id = rawId;
            if (jobsMap.has(id)) return;

            const baseId = id.replace(/-R\d*$/i, '');

            const enqIdStr = so.enquiry_id ? String(so.enquiry_id?._id || so.enquiry_id).trim() : '';
            const enq = (enqIdStr && enquiryMap.get(enqIdStr))
                || enquiryMap.get(so.job_no)
                || enquiryMap.get(baseId)
                || (isPopulated(so.enquiry_id) ? so.enquiry_id : {});

            const sofIdStr = so.sample_salesorder_id ? String(so.sample_salesorder_id?._id || so.sample_salesorder_id).trim() : '';
            const sof = (sofIdStr && sofMap.get(sofIdStr))
                || sofMap.get(String(so._id))
                || sofMap.get(so.sub_job_no)
                || sofMap.get(String(so.sub_job_no || '').toLowerCase().trim())
                || sofMap.get(so.job_no)
                || sofMap.get(String(so.job_no || '').toLowerCase().trim())
                || sofMap.get(baseId)
                || sofMap.get(String(baseId).toLowerCase().trim())
                || (enqIdStr && sofMap.get(enqIdStr))
                || (isPopulated(so.sample_salesorder_id) ? so.sample_salesorder_id : {});

            const bomIdStr = so.bom_id ? String(so.bom_id?._id || so.bom_id).trim() : '';
            const matchedBom = (bomIdStr && bomMap.get(bomIdStr))
                || (bomIdStr && bomMap.get(bomIdStr.toLowerCase()))
                || (so.bom_nanoid ? bomMap.get(String(so.bom_nanoid).trim()) : null)
                || (so.bom_nanoid ? bomMap.get(String(so.bom_nanoid).toLowerCase().trim()) : null)
                || (so.id ? bomMap.get(String(so.id).trim()) : null)
                || (so.id ? bomMap.get(String(so.id).toLowerCase().trim()) : null)
                || bomMap.get(String(so._id))
                || bomMap.get(String(so._id).toLowerCase().trim())
                || bomMap.get(so.sub_job_no)
                || bomMap.get(String(so.sub_job_no || '').toLowerCase().trim())
                || bomMap.get(so.job_no)
                || bomMap.get(String(so.job_no || '').toLowerCase().trim())
                || bomMap.get(baseId)
                || bomMap.get(String(baseId).toLowerCase().trim())
                || bomMap.get(id)
                || bomMap.get(String(id).toLowerCase().trim())
                || (isPopulated(so.bom_id) ? so.bom_id : null);

            const matchedSf = shopFloorMap.get(id)
                || shopFloorMap.get(baseId)
                || shopFloorMap.get(String(so._id))
                || shopFloorMap.get(so.sub_job_no)
                || shopFloorMap.get(so.job_no)
                || shopFloorMap.get(String(so.enquiry_id?._id || so.enquiry_id));

            // Extract all unique shop floor jobs strictly matching this specific sub-job
            const targetSubJob = String(so.sub_job_no || id).toLowerCase().trim();
            const rawSfMatches = [
                ...(shopFloorMultiMap.get(targetSubJob) || []),
                ...(shopFloorMultiMap.get(id.toLowerCase().trim()) || []),
                ...(shopFloorMultiMap.get(String(so._id).toLowerCase().trim()) || [])
            ];
            if (matchedSf) rawSfMatches.push(matchedSf);

            const filteredSfList = rawSfMatches.filter(sf => {
                const sfSub = String(sf.sub_job_no || sf.job_no || '').toLowerCase().trim();
                return sfSub === targetSubJob || sfSub === id.toLowerCase().trim();
            });

            const uniqueSfJobs = Array.from(
                new Map((filteredSfList.length > 0 ? filteredSfList : rawSfMatches).map(sf => [String(sf._id), sf])).values()
            );

            const matchedFg = fgMap.get(id) || fgMap.get(so.sub_job_no) || fgMap.get(baseId) || {};
            const rawPack = packMap.get(id) || packMap.get(so.sub_job_no) || packMap.get(baseId) || {};
            const pmatFallback = (rawPack.pmatItems && rawPack.pmatItems.length > 0)
                ? rawPack.pmatItems
                : (matchedBom?.packingdatas || []);

            const matchedPack = {
                ...rawPack,
                pmatItems: pmatFallback,
                labelFile: getSafeSignedUrl(rawPack.labelFile),
                misLabelFile: getSafeSignedUrl(rawPack.misLabelFile),
                instructionFile: getSafeSignedUrl(rawPack.instructionFile),
                dispatchFiles: (rawPack.dispatchFiles || []).map(getSafeSignedUrl)
            };

            const clientName = sof.client_name || enq.name || enq.client_name || matchedSf?.client_name || 'Client';
            const productName = sof.product_name || enq.product_name || matchedSf?.product_name || so.category || 'Product';

            // Safely parse BOM quotation (handles object, JSON string, or qty_update recalculated quotation)
            let bomQuotation = matchedBom?.quotation;
            if (typeof bomQuotation === 'string') {
                try {
                    bomQuotation = JSON.parse(bomQuotation);
                } catch (e) {
                    console.log(e)
                    bomQuotation = null;
                }
            }
            if (!bomQuotation?.finalUnitPrice && matchedBom?.qty_update?.recalculated_data?.quotation) {
                let recalcQuo = matchedBom.qty_update.recalculated_data.quotation;
                if (typeof recalcQuo === 'string') {
                    try {
                        recalcQuo = JSON.parse(recalcQuo);
                    } catch (e) {
                        console.log(e);
                        recalcQuo = null;
                    }
                }
                if (recalcQuo?.finalUnitPrice) {
                    bomQuotation = recalcQuo;
                }
            }

            // Fix Unit Rate from Sales Order's BOM quotation:
            // "sales order oda bom laquotation ulaa fix unit rate irukkum athu than so rate"
            const bomFixUnitRate = parseNum(bomQuotation?.finalUnitPrice);
            const bomFixJobPrice = parseNum(bomQuotation?.finalJobPrice);
            const bomQty = parseNum(matchedBom?.job_quantity);

            const qtyVal = Number(
                sof.job_quantity ||
                (bomQty > 0 ? bomQty : 0) ||
                enq.quantity ||
                matchedSf?.quantity ||
                so.total_qty ||
                1
            );

            // Unit Rate: Primary is BOM Quotation finalUnitPrice ("fix unit rate")
            // Fallbacks: explicit so_rate / rate -> SO Form price_per_piece -> Enquiry rate -> ShopFloor unit_rate -> BOM totalUnitCost
            const rawUnitRate = bomFixUnitRate > 0
                ? bomFixUnitRate
                : Number(
                    so.so_rate ||
                    so.rate ||
                    (sof.price_per_piece ? parseFloat(sof.price_per_piece) : 0) ||
                    enq.rate ||
                    matchedSf?.unit_rate ||
                    parseNum(matchedBom?.totalUnitCost) ||
                    parseNum(matchedBom?.jobSheet?.totalUnitCost) ||
                    parseNum(matchedBom?.costdetails?.totalUnitCost) ||
                    0
                );

            // Subtotal Revenue (Ex-GST): Primary is BOM Quotation finalJobPrice or (rawUnitRate * qtyVal)
            // Fallbacks: SO subtotal -> calculated rawUnitRate * qty -> SO final_total -> Enquiry final_total -> ShopFloor subtotal
            const subtotalAmt = bomFixJobPrice > 0
                ? bomFixJobPrice
                : (rawUnitRate > 0 ? Number((rawUnitRate * qtyVal).toFixed(2)) : 0)
                || so.subtotal
                || (so.so_rate ? Number((so.so_rate * qtyVal).toFixed(2)) : 0)
                || (so.final_total && so.final_total !== 10000 ? so.final_total : 0)
                || enq.final_total
                || matchedSf?.subtotal
                || 0;

            const unitRate = rawUnitRate > 0
                ? rawUnitRate
                : (qtyVal > 0 && subtotalAmt > 0 ? Number((subtotalAmt / qtyVal).toFixed(2)) : 0);

            const gstRate = Number(bomQuotation?.gstRate || matchedSf?.gst_rate || enq.gst_percentage || 18);
            const totalAmt = Number(matchedSf?.total_amount || (subtotalAmt * (1 + gstRate / 100)));

            // Extract in-house and outsource details from all matched shopfloor jobs
            const { inhouseList, outsourceList } = extractShopfloorDetails(uniqueSfJobs, qtyVal);

            const hasCtPack = Boolean(matchedPack._id || matchedPack.sub_job_no || matchedPack.job_no);
            const isOnHold = Boolean(so.is_on_hold || matchedSf?.is_hold || so.status === 'on_hold' || so.status === 'hold');
            const plannedQtyVal = Number(qtyVal || 0);
            const deliveredQtyVal = Number(matchedPack.deliveredQty || matchedPack.packed_qty || matchedPack.dispatch_qty || matchedFg.invoiced_qty || 0);
            const isFullQtyComplete = plannedQtyVal > 0 && deliveredQtyVal >= plannedQtyVal;
            const isDispatched = Boolean(
                matchedPack.status === 'Completed' ||
                matchedPack.status === 'Dispatched' ||
                matchedPack.status === 'Shipped' ||
                matchedPack.stage === 'dispatched' ||
                matchedPack.stage === 'complete' ||
                matchedPack.stage === 'completed' ||
                matchedSf?.status === 'dispatched' ||
                matchedSf?.status === 'shipped' ||
                so.status === 'shipped' ||
                so.status === 'dispatched' ||
                Boolean(matchedPack.dispatchDt) ||
                Boolean(matchedPack.is_dispatched) ||
                Boolean(matchedSf?.is_dispatched) ||
                isFullQtyComplete
            );
            const isPacked = Boolean(!isDispatched && (matchedPack.status === 'Packed' || matchedPack.stage === 'packed' || (matchedPack.boxCount > 0 && matchedPack.packDt && matchedPack.status !== 'Packing in Progress')));
            const isInQC = Boolean(hasCtPack && !isDispatched && !isPacked);
            const isQcCompleted = Boolean(matchedFg.inward_qty > 0 || matchedPack.received_from_qc > 0 || matchedPack.qcAcceptedQty > 0 || matchedSf?.status === 'Completed' || matchedFg.stage === 'COMPLETED');
            const isPartialDispatch = Boolean(matchedPack.stage === 'partial' || matchedPack.qcPartial || (matchedPack.packed_qty > 0 && matchedPack.packed_qty < qtyVal));

            const rawStatus = isOnHold
                ? 'hold'
                : isDispatched
                    ? 'dispatched'
                    : isPacked
                        ? 'packed'
                        : isInQC
                            ? 'in_qc'
                            : (isQcCompleted || isPartialDispatch)
                                ? 'complete'
                                : (matchedSf?.status || so.status || 'in_production');
            const normalizedStatus = rawStatus.toLowerCase().replace(/\s+/g, '_');

            // Unique Emails
            const rawEmails = [];
            if (Array.isArray(sof.email)) rawEmails.push(...sof.email);
            else if (sof.email) rawEmails.push(sof.email);
            if (Array.isArray(enq?.email)) rawEmails.push(...enq.email);
            else if (enq?.email) rawEmails.push(enq.email);
            if (matchedSf?.email) rawEmails.push(matchedSf.email);
            const emailsList = Array.from(new Set(rawEmails.filter(e => e && typeof e === 'string' && e.trim() !== '')));

            // Unique Mobile Numbers
            const rawMobile = [];
            if (sof.mobile_no) rawMobile.push(String(sof.mobile_no));
            if (enq?.mobile_no) rawMobile.push(String(enq.mobile_no));
            if (matchedSf?.phone_number) rawMobile.push(String(matchedSf.phone_number));
            const mobileList = Array.from(new Set(rawMobile.filter(p => p && String(p).trim() !== '')));

            // Unique WhatsApp Numbers
            const rawWp = [];
            if (Array.isArray(sof.wp_number)) rawWp.push(...sof.wp_number.map(String));
            else if (sof.wp_number) rawWp.push(String(sof.wp_number));
            if (Array.isArray(enq?.wp_number)) rawWp.push(...enq.wp_number.map(String));
            else if (enq?.wp_number) rawWp.push(String(enq.wp_number));
            const wpList = Array.from(new Set(rawWp.filter(w => w && String(w).trim() !== '')));

            const rawType = (so.type || sof.type || matchedSf?.job_type || matchedSf?.type || 'production').toLowerCase();
            const orderType = rawType.includes('sample') ? 'Sample' : 'Production';

            // 1. Live FG Object
            const fgData = {
                fgDate: matchedFg.updatedAt ? new Date(matchedFg.updatedAt).toISOString().split('T')[0] : (matchedSf?.fg?.fgDate || ''),
                fgQty: matchedFg.inward_qty || matchedSf?.fg?.fgQty || 0,
                fgBy: matchedFg.logs?.[0]?.by || matchedSf?.fg?.fgBy || 'FG Store Head',
                invoiceRaised: (matchedFg.invoiced_qty > 0) || Boolean(matchedSf?.invoice_number) || Boolean(matchedSf?.fg?.invoiceRaised),
                invoiceDate: matchedFg.updatedAt ? new Date(matchedFg.updatedAt).toISOString().split('T')[0] : ''
            };

            // 2. Live Packing Object
            const rawDests = Array.isArray(matchedPack.destinations) && matchedPack.destinations.length > 0
                ? matchedPack.destinations
                : (matchedPack.awbNumbers && matchedPack.awbNumbers.length > 0
                    ? matchedPack.awbNumbers.map(awb => ({ name: clientName, qty: matchedPack.packed_qty || qtyVal, awb, status: matchedPack.status === 'Completed' ? 'delivered' : 'in_transit' }))
                    : (matchedSf?.packing?.destinations || []));

            const destinationsList = rawDests.map(d => ({
                name: d.branchName || d.destination || d.name || 'Branch',
                qty: d.qty || d.quantity || qtyVal,
                awb: d.awbNo || d.awb || matchedPack.awbNumbers?.[0] || '—',
                status: d.status || matchedPack.stage || 'pending'
            }));

            const packingData = {
                packedBy: matchedPack.packedBy || matchedSf?.packing?.packedBy || '',
                boxes: matchedPack.boxCount || matchedSf?.packing?.boxes || 0,
                packDt: matchedPack.packingDt || matchedSf?.packing?.packDt || '',
                dispatchType: matchedPack.dispatchType || '',
                courier: matchedPack.courierName || matchedSf?.packing?.courier || '',
                dispatchDt: matchedPack.dispatchDt || matchedSf?.packing?.dispatchDt || '',
                destinations: destinationsList,
                packingType: sof.packing_type || '',
                innerPackingType: sof.inner_packing_type || '',
                packingMode: sof.packing_mode || '',
                packingInstruction: sof.packing_instruction || matchedPack.packingNote || ''
            };
            // 3. Live Material BOM Items — Unified cross-reference approach
            // Step 1: Build a rate lookup map from ALL BOM pricing sources (by item_id + material_name)
            // This handles the case where material_specification has rates but material_groups does not
            let liveBomMaterial = [];

            const matRateMap = new Map();
            const allRateSources = [
                ...(matchedBom?.jobSheet?.materialSpecification || []),
                ...(matchedBom?.costdetails?.materialSpecification || []),
                ...(matchedBom?.material_specification || [])
            ];
            allRateSources.forEach(ms => {
                const unitRate = Number(ms.unitRate) || Number(ms.rate) || 0;
                const jobTotal = Number(ms.jobTotal) || Number(ms.final_total) || 0;
                if (unitRate > 0 || jobTotal > 0) {
                    const idKey = String(ms.item_id || ms.material_id || '').toLowerCase().trim();
                    const nameKey = String(ms.material_name || '').toLowerCase().trim();
                    const entry = { unitRate, jobTotal, qty: Number(ms.input?.quantity) || 0 };
                    if (idKey) matRateMap.set(idKey, entry);
                    if (nameKey && !matRateMap.has(nameKey)) matRateMap.set(nameKey, entry);
                }
            });

            // Helper: resolve rate+cost for a material entry using cross-ref map
            const resolveMaterialCost = (itemId, materialName, rawRate, rawFinalTotal, qty) => {
                const rate = Number(rawRate) || 0;
                const finalTotal = Number(rawFinalTotal) || 0;
                if (rate > 0 || finalTotal > 0) {
                    const cost = finalTotal || (rate * qty);
                    return { rate, bomCost: cost };
                }
                // Cross-reference: try item_id first, then material_name
                const lookup = matRateMap.get(String(itemId || '').toLowerCase().trim())
                    || matRateMap.get(String(materialName || '').toLowerCase().trim());
                if (lookup) {
                    const cost = lookup.jobTotal || (lookup.unitRate * qty);
                    return { rate: lookup.unitRate, bomCost: cost };
                }
                return { rate: 0, bomCost: 0 };
            };

            // Step 2: Primary — jobSheet -> costdetails -> material_specification
            const matSpecPrimary = matchedBom?.jobSheet?.materialSpecification?.length > 0
                ? matchedBom.jobSheet.materialSpecification
                : (matchedBom?.costdetails?.materialSpecification?.length > 0
                    ? matchedBom.costdetails.materialSpecification
                    : (matchedBom?.material_specification || []));

            if (matSpecPrimary.length > 0) {
                matSpecPrimary.forEach(m => {
                    const bQtyRaw = Number(m.input?.quantity) || 1;
                    const { rate: bRate, bomCost: bCost } = resolveMaterialCost(
                        m.item_id || m.material_id, m.material_name,
                        Number(m.unitRate) || Number(m.rate), m.final_total, bQtyRaw
                    );
                    const bJobTotal = Number(m.jobTotal) || bCost;
                    const finalCost = bJobTotal || bCost;
                    const bQty = bRate > 0 && finalCost > 0 ? Math.round(finalCost / bRate) : bQtyRaw;
                    liveBomMaterial.push({
                        item: m.material_name || 'Material Item',
                        spec: (m.input?.size || m.alias || m.category_type || 'Standard Spec'),
                        bomQty: bQty,
                        bomQtyUnit: m.input?.unit || 'pcs',
                        rate: bRate,
                        bomCost: finalCost,
                        actualQty: bQty,
                        actualCost: finalCost,
                        variance: 0,
                        varPct: 0,
                        store: 'Main Store',
                        has_real_cost: finalCost > 0
                    });
                });
            } else if (matchedBom && Array.isArray(matchedBom.material_groups) && matchedBom.material_groups.length > 0) {
                // Secondary — material_groups[].materials[] with cross-reference rate lookup
                matchedBom.material_groups.forEach(g => {
                    if (Array.isArray(g.materials)) {
                        g.materials.forEach(m => {
                            const bQty = Number(m.input?.quantity) || Number(m.quantity) || 1;
                            const { rate: bRate, bomCost: bCost } = resolveMaterialCost(
                                m.item_id || m.material_id, m.material_name,
                                m.rate, m.final_total, bQty
                            );
                            liveBomMaterial.push({
                                item: m.material_name || m.item_name || 'Material Item',
                                spec: m.input?.size || m.size || m.category_type || g.group_name || 'Standard Spec',
                                bomQty: bQty,
                                bomQtyUnit: m.input?.unit || m.unit || 'pcs',
                                rate: bRate,
                                bomCost: bCost,
                                actualQty: bQty,
                                actualCost: bCost,
                                variance: 0,
                                varPct: 0,
                                store: 'Main Store',
                                has_real_cost: bCost > 0
                            });
                        });
                    }
                });
            } else if (matchedBom && Array.isArray(matchedBom.items) && matchedBom.items.length > 0) {
                matchedBom.items.forEach(it => {
                    const { rate: bRate, bomCost: bCost } = resolveMaterialCost(
                        it.item_id, it.itemName, it.rate, null, qtyVal
                    );
                    liveBomMaterial.push({
                        item: it.itemName || it.itemType || 'Item',
                        spec: `${it.length || ''}x${it.width || ''} ${it.unit || ''}`.trim() || 'Custom Spec',
                        bomQty: qtyVal,
                        bomQtyUnit: it.unit || 'pcs',
                        rate: bRate,
                        bomCost: bCost,
                        actualQty: qtyVal,
                        actualCost: bCost,
                        variance: 0,
                        varPct: 0,
                        store: 'Stores',
                        has_real_cost: bCost > 0
                    });
                });
            } else if (uniqueSfJobs.length > 0) {
                uniqueSfJobs.forEach(sf => {
                    (sf.material_groups || []).forEach(g => {
                        (g.materials || []).forEach(m => {
                            const bQty = Number(m.quantity) || 1;
                            const { rate: bRate, bomCost: bCost } = resolveMaterialCost(
                                m.item_id, m.material_name, null, null, bQty
                            );
                            liveBomMaterial.push({
                                item: m.material_name || 'Material',
                                spec: m.size || g.group_name || 'Standard',
                                bomQty: bQty,
                                bomQtyUnit: m.unit || 'pcs',
                                rate: bRate,
                                bomCost: bCost,
                                actualQty: bQty,
                                actualCost: bCost,
                                variance: 0,
                                varPct: 0,
                                store: 'Shop Floor Store',
                                has_real_cost: bCost > 0
                            });
                        });
                    });
                });
            }

            // 4. Live Process BOM Items
            // Primary source: jobSheet -> costdetails -> materialprocess
            let liveBomProcess = [];
            const matProc = matchedBom?.jobSheet?.materialprocess?.length > 0
                ? matchedBom.jobSheet.materialprocess
                : (matchedBom?.costdetails?.materialprocess?.length > 0
                    ? matchedBom.costdetails.materialprocess
                    : (matchedBom?.materialprocess || []));

            if (matProc.length > 0) {
                matProc.forEach(pg => {
                    (pg.processes || []).forEach(p => {
                        const pJobTotal = Number(p.jobTotal) || Number(p.job_cost) || 0;
                        const pUnitRate = Number(p.unitRate) || Number(p.rate) || 0;
                        const pActualInput = Number(p.input?.actual_input) || Number(pg.material_total) || qtyVal;
                        liveBomProcess.push({
                            dept: p.department || pg.material_group_name || 'Production',
                            process: p.process_name || 'Standard Process',
                            uom: pg.material_unit || 'pcs',
                            rate: pUnitRate,
                            bomQty: pActualInput,
                            bomCost: pJobTotal,
                            actualQty: pActualInput,
                            actualCost: pJobTotal,
                            time: '',
                            operator: p.vendor || (p.outsource_type === 'outsource' ? 'Outsource' : 'Inhouse'),
                            is_outsource: p.outsource_type === 'outsource',
                            has_real_cost: pJobTotal > 0
                        });
                    });
                });
            } else if (uniqueSfJobs.length > 0 && uniqueSfJobs[0]?.process_name) {
                const sf0 = uniqueSfJobs[0];
                liveBomProcess.push({
                    dept: sf0.department || 'Production',
                    process: sf0.process_name,
                    uom: 'pcs',
                    rate: 0,
                    bomQty: qtyVal,
                    bomCost: 0,
                    actualQty: sf0.completed_qty || 0,
                    actualCost: 0,
                    time: '',
                    operator: 'Inhouse',
                    is_outsource: false,
                    has_real_cost: false
                });
            }

            // 5. Live Manufacturing Journey Stages
            let liveJourney = [];
            if (Array.isArray(matchedSf?.journey) && matchedSf.journey.length > 0) {
                liveJourney = matchedSf.journey;
            } else {
                liveJourney = [
                    { dept: 'DTP Pre-Press', icon: '🎨', status: (so.is_design_uploaded || so.is_verified_to_proceed) ? 'complete' : 'active', in: qtyVal, out: qtyVal, time: '2.0 hrs', cost: Math.round(subtotalAmt * 0.05), qc: 'pass', dt: so.created_at || 'Confirmed' },
                    { dept: 'BOM Costing', icon: '📋', status: (matchedBom || so.is_bom_filled) ? 'complete' : 'pending', in: qtyVal, out: qtyVal, time: '1.0 hrs', cost: Math.round(subtotalAmt * 0.03), qc: 'pass', dt: 'Approved' }
                ];

                if (inhouseList.length > 0) {
                    inhouseList.forEach(inh => {
                        liveJourney.push({
                            dept: inh.process_name || inh.department || 'In-House Shopfloor',
                            icon: String(inh.department || '').toLowerCase().includes('laser') ? '✂️' : (String(inh.department || '').toLowerCase().includes('uv') ? '🖨️' : '⚙️'),
                            status: inh.status === 'Completed' ? 'complete' : (inh.status === 'In Progress' ? 'active' : 'pending'),
                            in: inh.inhouse_qty || qtyVal,
                            out: inh.completed_qty || (inh.status === 'Completed' ? inh.inhouse_qty : 0),
                            time: 'In-House',
                            cost: Math.round(subtotalAmt * 0.15),
                            qc: inh.status === 'Completed' ? 'pass' : 'pending',
                            dt: inh.status || ''
                        });
                    });
                } else {
                    liveJourney.push({
                        dept: matchedSf?.department || 'In-House Production',
                        icon: '⚙️',
                        status: matchedSf?.status === 'Completed' ? 'complete' : matchedSf ? 'active' : 'pending',
                        in: qtyVal,
                        out: matchedSf?.completed_qty || 0,
                        time: '4.5 hrs',
                        cost: Math.round(subtotalAmt * 0.15),
                        qc: matchedSf?.status === 'Completed' ? 'pass' : 'pending',
                        dt: matchedSf?.delivery_date || ''
                    });
                }

                if (outsourceList.length > 0) {
                    outsourceList.forEach(out => {
                        liveJourney.push({
                            dept: `Outsource: ${out.vendor_name || 'Subcontract'}`,
                            icon: '🤝',
                            status: out.status === 'Completed' ? 'complete' : (out.status === 'In Progress' || out.current_stage_idx > 0 ? 'active' : 'pending'),
                            in: out.outsource_qty || 0,
                            out: out.actual_delivered_qty || (out.status === 'Completed' ? out.outsource_qty : 0),
                            time: out.delivery_date ? `Due: ${out.delivery_date}` : 'Outsource',
                            cost: (out.outsource_rate * out.outsource_qty) || 0,
                            qc: out.status === 'Completed' ? 'pass' : 'pending',
                            dt: out.status || 'Assigned'
                        });
                    });
                }

                liveJourney.push(
                    { dept: 'Quality Control', icon: '🔍', status: matchedFg.inward_qty > 0 ? 'complete' : 'pending', in: qtyVal, out: matchedFg.inward_qty || 0, time: '1.0 hrs', cost: 0, qc: matchedFg.inward_qty > 0 ? 'pass' : 'pending', dt: '' },
                    { dept: 'FG & Packing', icon: '📦', status: matchedPack.boxCount > 0 ? 'complete' : 'pending', in: matchedFg.inward_qty || 0, out: matchedPack.packed_qty || 0, time: '2.0 hrs', cost: Math.round(subtotalAmt * 0.03), qc: 'pass', dt: matchedPack.packingDt || '' },
                    { dept: 'Dispatch & Logistics', icon: '🚚', status: matchedPack.dispatchDt || matchedSf?.status === 'dispatched' ? 'complete' : 'pending', in: matchedPack.packed_qty || 0, out: matchedPack.packed_qty || 0, time: '1.0 hrs', cost: 0, qc: 'pass', dt: matchedPack.dispatchDt || '' }
                );
            }

            // 6. Live CS & Approval History
            let liveCsHistory = [];
            if (enq.created_at || enq.createdAt) {
                liveCsHistory.push({ dt: enq.created_at || new Date(enq.createdAt).toISOString().split('T')[0], by: enq.name || 'Sales Team', event: 'Enquiry received', detail: `Enquiry for ${productName} - ${qtyVal} pcs.` });
            }
            if (so.created_at || so.createdAt) {
                liveCsHistory.push({ dt: so.created_at || new Date(so.createdAt).toISOString().split('T')[0], by: 'Sales Order Team', event: 'Production order raised', detail: `Sales order ${id} created for ${clientName}.` });
            }
            if (Array.isArray(so.bom_history)) {
                so.bom_history.forEach(bh => {
                    liveCsHistory.push({ dt: bh.date_time || '', by: bh.action_by_name || (typeof bh.action_by_user === 'object' ? bh.action_by_user?.name : null) || bh.by || 'BOM Team', event: bh.action || 'BOM Verified', detail: bh.remarks || 'BOM details updated' });
                });
            }
            if (Array.isArray(so.pi_history)) {
                so.pi_history.forEach(ph => {
                    liveCsHistory.push({ dt: ph.date_time || '', by: ph.action_by_name || (typeof ph.action_by_user === 'object' ? ph.action_by_user?.name : null) || ph.by || 'Accounts', event: ph.action || 'PI Verified', detail: ph.remarks || 'Proforma invoice approved' });
                });
            }
            if (matchedPack.dispatchDt) {
                liveCsHistory.push({ dt: matchedPack.dispatchDt, by: 'Dispatch Team', event: 'Dispatched', detail: `Dispatched ${matchedPack.boxCount || 1} boxes via ${matchedPack.courierName || 'Courier'}.` });
            }
            if (liveCsHistory.length === 0 && matchedSf?.csHistory?.length > 0) {
                liveCsHistory = matchedSf.csHistory;
            }

            // 7. Live Financials
            // ─── BOM Planned Costs (from bomModel real fields) ───────────────────
            const matBomTotal = liveBomMaterial.reduce((s, r) => s + (r.bomCost || 0), 0);
            const procBomTotal = liveBomProcess.reduce((s, r) => s + (r.bomCost || 0), 0);

            // BOM Packing Cost — from jobSheet / costdetails / packingdatas
            const packingDataSrc = matchedBom?.jobSheet?.packingdatas?.length > 0
                ? matchedBom.jobSheet.packingdatas
                : (matchedBom?.costdetails?.packingdatas?.length > 0
                    ? matchedBom.costdetails.packingdatas
                    : (matchedBom?.packingdatas || []));
            const bomPackingTotal = packingDataSrc.reduce((s, p) => s + (Number(p.jobTotal) || Number(p.finaltotal) || Number(p.total) || 0), 0);

            // ─── Actual Costs (from ShopFloor real events) ───────────────────────
            // Actual Material Cost = sum of inward_history[].accepted_value across all SF jobs
            let actualMaterialAccepted = 0;
            let actualInhouseProcessCost = 0;
            let actualOutsourceProcessCost = 0;

            uniqueSfJobs.forEach(sf => {
                (sf.material_groups || []).forEach(mg => {
                    // Material actually accepted inward (inspector-valued)
                    (mg.inward_history || []).forEach(inw => {
                        actualMaterialAccepted += Number(inw.accepted_value) || 0;
                    });

                    // Inhouse process cost = process_rate × inhouse_qty
                    const mgInhouseQty = Number(mg.inhouse_qty) || Number(mg.process_qty) || 0;
                    const mgProcessRate = Number(mg.process_rate) || 0;
                    if (!mg.is_outsource && mgProcessRate > 0) {
                        actualInhouseProcessCost += mgProcessRate * mgInhouseQty;
                    }

                    // Outsource process cost = outsource_rate × outsource_qty per assignment
                    (mg.outsource_assignments || []).forEach(asgn => {
                        actualOutsourceProcessCost += (Number(asgn.outsource_rate) || Number(mg.outsource_rate) || 0) *
                            (Number(asgn.outsource_qty) || Number(asgn.outsource_sheets) || 0);
                    });
                    // Legacy single-vendor outsource (no assignments array)
                    if (mg.is_outsource && !(mg.outsource_assignments?.length > 0)) {
                        actualOutsourceProcessCost += (Number(mg.outsource_rate) || 0) * (Number(mg.outsource_qty) || 0);
                    }
                });
            });

            // Actual Packing Cost — from ctPack pmatItems (Mixed type: [{rate, qty, total}]) or BOM packingdatas
            let actualPackingCost = 0;
            if (Array.isArray(rawPack.pmatItems) && rawPack.pmatItems.length > 0) {
                rawPack.pmatItems.forEach(pi => {
                    actualPackingCost += Number(pi.total) || Number(pi.jobTotal) || (Number(pi.rate || 0) * Number(pi.qty || 0)) || 0;
                });
            } else {
                // Fall back to BOM packing estimate
                actualPackingCost = bomPackingTotal;
            }

            // Use actual costs if > 0, otherwise use BOM planned as estimate
            const matActTotal = actualMaterialAccepted > 0 ? actualMaterialAccepted : matBomTotal;
            const procActTotal = (actualInhouseProcessCost + actualOutsourceProcessCost) > 0
                ? (actualInhouseProcessCost + actualOutsourceProcessCost)
                : procBomTotal;
            const packCostTotal = actualPackingCost > 0 ? actualPackingCost : bomPackingTotal;

            // Calculate effective revenue when explicit subtotalAmt is 0
            const bomPlannedTotalCost = matBomTotal + procBomTotal + bomPackingTotal;
            const actualTotalCost = matActTotal + procActTotal + packCostTotal;
            const effectiveSubtotal = subtotalAmt > 0 ? subtotalAmt : (bomPlannedTotalCost > 0 ? bomPlannedTotalCost : actualTotalCost);
            const effectiveUnitRate = unitRate > 0 ? unitRate : (qtyVal > 0 && effectiveSubtotal > 0 ? Number((effectiveSubtotal / qtyVal).toFixed(2)) : 0);
            const effectiveTotalAmt = totalAmt > 0 && subtotalAmt > 0 ? totalAmt : Number((effectiveSubtotal * (1 + gstRate / 100)).toFixed(2));

            const overheadTotal = Math.round(effectiveSubtotal * 0.10);
            const totalActualExpenses = matActTotal + procActTotal + packCostTotal + overheadTotal;
            const grossProfitAmt = effectiveSubtotal - totalActualExpenses;
            const grossMarginPercentage = effectiveSubtotal > 0 ? Number(((grossProfitAmt / effectiveSubtotal) * 100).toFixed(1)) : 0;

            const financialData = {
                revenue: { subtotal: effectiveSubtotal, gstAmt: (effectiveSubtotal * gstRate) / 100, total: effectiveTotalAmt },
                materialCost: {
                    bom: matBomTotal,
                    actual: matActTotal,
                    variance: (matActTotal - matBomTotal),
                    is_actual: actualMaterialAccepted > 0
                },
                processCost: {
                    bom: procBomTotal,
                    actual: procActTotal,
                    variance: (procActTotal - procBomTotal),
                    inhouse: actualInhouseProcessCost,
                    outsource: actualOutsourceProcessCost,
                    is_actual: (actualInhouseProcessCost + actualOutsourceProcessCost) > 0
                },
                packingCost: {
                    total: packCostTotal,
                    bom_estimate: bomPackingTotal,
                    is_actual: actualPackingCost > 0 && rawPack.pmatItems?.length > 0
                },
                overhead: { pct: 10, amt: overheadTotal },
                grossMargin: grossMarginPercentage
            };

            // 8. Live Flow Ledger — built from real DB events (inward_history, process_history, FG, Pack)
            const liveFlowLedger = [];

            // Stage 1: BOM Reservation (always show if BOM exists)
            if (liveBomMaterial.length > 0) {
                liveFlowLedger.push({
                    type: 'reserve',
                    dept: 'Stores — BOM Material Allocation',
                    date: so.created_at || (so.createdAt ? new Date(so.createdAt).toISOString().split('T')[0] : 'Day 1'),
                    ref: `BOM-${id}`,
                    output: `${liveBomMaterial.length} material line(s) planned`,
                    note: `BOM planned total: ₹${matBomTotal.toLocaleString('en-IN')}`,
                    op: 'BOM Team',
                    qc: 'pass',
                    rows: liveBomMaterial.map(m => ({
                        kind: 'mat',
                        item: m.item,
                        qty: m.bomQty,
                        unit: m.bomQtyUnit,
                        rate: m.rate,
                        value: m.bomCost,
                        note: m.bomCost > 0 ? 'BOM planned cost' : 'Planned — cost pending'
                    }))
                });
            }

            // Stage 2+: Per material_group — Inward Issues + Process Events
            uniqueSfJobs.forEach(sf => {
                (sf.material_groups || []).forEach(mg => {
                    const grpLabel = mg.group_name || sf.process_name || 'Process Group';

                    // Inward events for this group
                    (mg.inward_history || []).forEach(inw => {
                        const inwGood = Number(inw.good_qty) || 0;
                        const inwBad = Number(inw.bad_qty) || 0;
                        const inwValue = Number(inw.accepted_value) || 0;
                        const inwTs = inw.timestamp || inw.created_at || '';

                        // Issue row (good material accepted)
                        if (inwGood > 0) {
                            liveFlowLedger.push({
                                type: 'issue',
                                dept: `${grpLabel} — Material Inward`,
                                date: inwTs ? inwTs.split('T')[0] : 'In Progress',
                                ref: `INW-${mg.group_id || mg._id || 'GRP'}`,
                                output: `${inwGood} pcs accepted`,
                                note: inw.remarks || `Inspected: ${Number(inw.inspect_qty) || 0}, Good: ${inwGood}`,
                                op: inw.operator_name || 'Quality Inspector',
                                qc: 'pass',
                                rows: [{
                                    kind: 'mat',
                                    item: grpLabel,
                                    qty: inwGood,
                                    unit: 'pcs',
                                    rate: inwGood > 0 && inwValue > 0 ? Math.round(inwValue / inwGood) : 0,
                                    value: inwValue,
                                    note: `Sq-inch accepted: ${Number(inw.total_sq_inch_accepted) || 0}`
                                }]
                            });
                        }

                        // Reject row (bad material)
                        if (inwBad > 0) {
                            liveFlowLedger.push({
                                type: 'reject',
                                dept: `${grpLabel} — Material Rejection`,
                                date: inwTs ? inwTs.split('T')[0] : 'In Progress',
                                ref: `REJ-${mg.group_id || mg._id || 'GRP'}`,
                                output: `${inwBad} pcs rejected`,
                                note: inw.remarks || 'Rejected at inspection',
                                op: inw.operator_name || 'Quality Inspector',
                                qc: 'fail',
                                rows: [{
                                    kind: 'reject',
                                    item: grpLabel,
                                    qty: inwBad,
                                    unit: 'pcs',
                                    rate: 0,
                                    value: 0,
                                    note: 'Material rejected'
                                }]
                            });
                        }
                    });

                    // Process events — group by action type to avoid flooding
                    const procRows = [];
                    let lastStartTs = '';
                    let goodPcs = 0;
                    let badPcs = 0;
                    (mg.process_history || []).forEach(ph => {
                        if (ph.action === 'START' || ph.action === 'CONSOLE READY') {
                            lastStartTs = ph.timestamp || '';
                        }
                        if (ph.details?.good_qty > 0) goodPcs += Number(ph.details.good_qty);
                        if (ph.details?.bad_qty > 0) badPcs += Number(ph.details.bad_qty);
                        procRows.push({
                            kind: 'proc',
                            process: `${grpLabel} — ${ph.action || ph.activity_type || 'Action'}`,
                            qty: Number(ph.details?.good_qty) || 0,
                            unit: 'pcs',
                            rate: Number(mg.process_rate) || 0,
                            value: (Number(ph.details?.good_qty) || 0) * (Number(mg.process_rate) || 0),
                            note: ph.details?.remarks || ph.operator_name || ''
                        });
                    });

                    if (procRows.length > 0) {
                        // const mgInhouseCost = (Number(mg.process_rate) || 0) * (Number(mg.inhouse_qty) || Number(mg.process_qty) || 0);
                        liveFlowLedger.push({
                            type: 'process',
                            dept: `${grpLabel} — ${sf.department || sf.process_name || 'Production'}`,
                            date: lastStartTs ? lastStartTs.split('T')[0] : (sf.assigned_at ? sf.assigned_at.split('T')[0] : 'In Progress'),
                            ref: `JOB-${sf.job_no || id}`,
                            output: goodPcs > 0 ? `${goodPcs} pcs produced` : `In progress`,
                            note: badPcs > 0 ? `${badPcs} pcs failed QC` : '',
                            op: sf.assigned_shifts?.join(', ') || 'Production Team',
                            qc: goodPcs > 0 ? 'pass' : (mg.status === 'Completed' ? 'pass' : '—'),
                            rows: procRows
                        });
                    } else if (mg.status !== 'Pending' || mg.inhouse_qty > 0) {
                        const mgInhouseCost = (Number(mg.process_rate) || 0) * (Number(mg.inhouse_qty) || Number(mg.process_qty) || 0);
                        liveFlowLedger.push({
                            type: 'process',
                            dept: `${grpLabel} — ${sf.department || 'Production'}`,
                            date: sf.assigned_at ? sf.assigned_at.split('T')[0] : 'Scheduled',
                            ref: `JOB-${sf.job_no || id}`,
                            output: `${mg.status || 'Pending'}`,
                            note: `Planned inhouse: ${mg.inhouse_qty || mg.process_qty || 0} pcs`,
                            op: sf.assigned_shifts?.join(', ') || 'Ops Team',
                            qc: mg.status === 'Completed' ? 'pass' : '—',
                            rows: [{
                                kind: 'proc',
                                process: grpLabel,
                                qty: Number(mg.inhouse_qty) || Number(mg.process_qty) || 0,
                                unit: 'pcs',
                                rate: Number(mg.process_rate) || 0,
                                value: mgInhouseCost,
                                note: mg.status || 'Planned'
                            }]
                        });
                    }

                    // Outsource assignments as separate stages
                    (mg.outsource_assignments || []).forEach(asgn => {
                        const asgnQty = Number(asgn.outsource_qty) || Number(asgn.outsource_sheets) || 0;
                        const asgnRate = Number(asgn.outsource_rate) || Number(mg.outsource_rate) || 0;
                        const asgnValue = asgnRate * asgnQty;
                        const asgnDelivered = (asgn.batch_receipts || []).reduce((s, br) =>
                            s + (br.type === 'actual' ? (Number(br.qty) || 0) : 0), 0);
                        liveFlowLedger.push({
                            type: 'process',
                            dept: `Outsource — ${asgn.vendor_name || mg.vendor_name || 'Vendor'}`,
                            date: asgn.assigned_at ? asgn.assigned_at.split('T')[0] : '',
                            ref: `OUT-${asgn.token || asgn._id || mg.group_id}`,
                            output: asgnDelivered > 0 ? `${asgnDelivered} pcs received` : `Awaiting delivery`,
                            note: asgn.outsource_delivery_date ? `Due: ${asgn.outsource_delivery_date}` : '',
                            op: asgn.vendor_name || mg.vendor_name || 'Outsource Vendor',
                            qc: asgn.status === 'Completed' ? 'pass' : '—',
                            rows: [{
                                kind: 'proc',
                                process: `${grpLabel} — Outsource`,
                                qty: asgnQty,
                                unit: 'pcs',
                                rate: asgnRate,
                                value: asgnValue,
                                note: `Invoice: ${asgn.invoice_no || '—'} | Delivered: ${asgnDelivered}`
                            }]
                        });
                    });
                });
            });

            // Stage: FG Store entry
            if (matchedFg.inward_qty > 0) {
                const fgDate = matchedFg.updatedAt ? new Date(matchedFg.updatedAt).toISOString().split('T')[0] : '';
                liveFlowLedger.push({
                    type: 'fg',
                    dept: 'Finished Goods Store',
                    date: fgDate || 'Completed',
                    ref: `FG-${id}`,
                    output: `${matchedFg.inward_qty} pcs moved to FG`,
                    note: matchedFg.logs?.[0]?.remarks || 'FG inward completed',
                    op: matchedFg.logs?.[0]?.by || 'FG Store Head',
                    qc: 'pass',
                    rows: [{
                        kind: 'fg',
                        item: 'Finished Product',
                        qty: matchedFg.inward_qty,
                        unit: 'pcs',
                        rate: 0,
                        value: 0,
                        note: `Total FG: ${matchedFg.inward_qty} | Invoiced: ${matchedFg.invoiced_qty || 0}`
                    }]
                });
            }

            // Stage: Packing
            if (rawPack.packingDt || rawPack.boxCount > 0) {
                const packRows = [];
                if (Array.isArray(rawPack.pmatItems) && rawPack.pmatItems.length > 0) {
                    rawPack.pmatItems.forEach(pi => {
                        packRows.push({
                            kind: 'mat',
                            item: pi.name || pi.itemType || 'Packing Material',
                            qty: Number(pi.qty) || Number(pi.total_qty) || 0,
                            unit: 'pcs',
                            rate: Number(pi.unitCost) || Number(pi.rate) || 0,
                            value: Number(pi.total) || Number(pi.jobTotal) || 0,
                            note: 'Packing material'
                        });
                    });
                } else if (packingDataSrc.length > 0) {
                    packingDataSrc.forEach(p => {
                        packRows.push({
                            kind: 'mat',
                            item: p.name || 'Packing Item',
                            qty: Number(p.total_qty) || 0,
                            unit: 'pcs',
                            rate: Number(p.unitCost) || 0,
                            value: Number(p.jobTotal) || Number(p.finaltotal) || 0,
                            note: 'BOM packing estimate'
                        });
                    });
                }
                liveFlowLedger.push({
                    type: 'pack',
                    dept: 'FG Packing',
                    date: rawPack.packingDt || rawPack.qcAcceptedDt || 'Packing Done',
                    ref: `PACK-${id}`,
                    output: `${rawPack.boxCount || 0} boxes packed — ${rawPack.packed_qty || 0} pcs`,
                    note: rawPack.packingNote || '',
                    op: rawPack.packedBy || 'Packing Team',
                    qc: rawPack.qcAcceptedQty > 0 ? 'pass' : '—',
                    rows: packRows
                });
            }

            // Stage: Dispatch
            if (rawPack.dispatchDt) {
                liveFlowLedger.push({
                    type: 'dispatch',
                    dept: 'Dispatch & Logistics',
                    date: rawPack.dispatchDt,
                    ref: `DIS-${id}`,
                    output: `Dispatched via ${rawPack.dispatchType || rawPack.courierName || 'Courier'}`,
                    note: (rawPack.awbNumbers || []).length > 0 ? `AWB: ${rawPack.awbNumbers.join(', ')}` : '',
                    op: 'Dispatch Team',
                    qc: 'pass',
                    rows: [{
                        kind: 'mat',
                        item: 'Shipment',
                        qty: rawPack.deliveredQty || rawPack.packed_qty || 0,
                        unit: 'pcs',
                        rate: 0,
                        value: 0,
                        note: rawPack.courierName || rawPack.dispatchType || ''
                    }]
                });
            }

            // If nothing was recorded yet, fall back to BOM reservation stage only
            if (liveFlowLedger.length === 0 && liveBomProcess.length > 0) {
                liveFlowLedger.push({
                    type: 'process',
                    dept: uniqueSfJobs[0]?.department || 'Manufacturing Floor',
                    date: uniqueSfJobs[0]?.delivery_date || 'In Progress',
                    ref: `JOB-${id}`,
                    output: `${qtyVal} pcs planned`,
                    note: 'Production planned — awaiting execution data',
                    op: 'Production Head',
                    qc: '—',
                    rows: liveBomProcess.map(p => ({
                        kind: 'proc',
                        process: p.process,
                        qty: p.bomQty,
                        unit: p.uom,
                        rate: p.rate,
                        value: p.bomCost,
                        note: 'BOM planned'
                    }))
                });
            }

            jobsMap.set(id, {
                id,
                _id: String(so._id),
                job_no: so.job_no || so.sub_job_no || id,
                sub_job_no: so.sub_job_no || so.job_no || id,
                reference_no: so.reference_no || sof.reference_no || enq.reference_no || '',
                type: orderType,
                order_type: orderType,
                client: clientName,
                client_name: clientName,
                name: clientName,
                clientGST: cleanText(sof.billing_gst_no) || cleanText(enq.gst_no) || cleanText(matchedSf?.gst_number) || '-',
                contact: sof.contact_person || enq.contact_person || enq.name || '-',
                phone: mobileList[0] || '',
                mobile_no: mobileList[0] || '',
                mobile: mobileList[0] || '',
                mobiles: mobileList,
                whatsapp: wpList[0] || '',
                wp_number: wpList[0] || '',
                wpNumbers: wpList,
                email: emailsList[0] || '',
                emails: emailsList,
                soNo: so.job_no || so.sub_job_no || id,
                soDate: so.created_at || (so.createdAt ? new Date(so.createdAt).toISOString().split('T')[0] : (sof.created_at || '')),
                invoiceNo: matchedSf?.invoice_number || (matchedFg.invoiced_qty > 0 ? `INV-${id}` : ''),
                image: getSafeSignedUrl(sof.image || so.image || so.sample_trophy_image || enq.image || enq.product_image || (Array.isArray(enq.images) && enq.images[0]?.url ? enq.images[0].url : '') || (Array.isArray(sof.product_files) && sof.product_files[0] ? sof.product_files[0] : '') || matchedSf?.image || ''),
                product: productName,
                product_name: productName,
                qty: qtyVal,
                job_quantity: qtyVal,
                product_quantity: qtyVal,
                soRate: effectiveUnitRate,
                soAmt: effectiveSubtotal,
                gst: gstRate,
                soTotal: effectiveTotalAmt,
                delivery_date: sof.delivery_date || so.delivery_date || enq.delivery_date || '',
                delivDate: formatDateOnly(sof.delivery_date || so.delivery_date || enq.delivery_date),
                completionDate: formatDateOnly(sof.job_completion_datetime || so.job_completion_datetime || matchedSf?.job_completion_date || matchedFg?.job_completion_date),
                job_completion_datetime: sof.job_completion_datetime || so.job_completion_datetime || matchedSf?.job_completion_date || matchedFg?.job_completion_date || '',
                designer_person: so.designer_person || sof.designer_person || null,
                designer_files: (so.designer_files || sof.designer_files || []).map(getSafeSignedUrl),
                quatation_files: (so.quatation_files || sof.quatation_files || []).map(getSafeSignedUrl),
                bom_history: (so.bom_history || sof.bom_history || enq.bom_history || []).map(b => (b && typeof b === 'object' ? { ...b, action_by_name: b.action_by_name || (typeof b.action_by_user === 'object' ? b.action_by_user?.name : null) || b.by || null, file_url: getSafeSignedUrl(b.file_url) } : b)),
                Pi_files: (so.Pi_files || sof.Pi_files || []).map(getSafeSignedUrl),
                pi_history: (so.pi_history || sof.pi_history || enq.pi_history || []).map(p => (p && typeof p === 'object' ? { ...p, action_by_name: p.action_by_name || (typeof p.action_by_user === 'object' ? p.action_by_user?.name : null) || p.by || null, file_url: getSafeSignedUrl(p.file_url) } : p)),
                is_verified_to_proceed: so.is_verified_to_proceed || sof.is_verified_to_proceed || false,
                proceed_to_production_datetime: so.proceed_to_production_datetime || sof.proceed_to_production_datetime || null,
                is_pushed_shop_floor: so.is_pushed_shop_floor || (matchedSf ? true : false),
                pushed_to_shop_floor_datetime: so.pushed_to_shop_floor_datetime || null,
                is_bom_verified: so.is_bom_verified || Boolean(matchedBom),
                is_pi_verified: so.is_pi_verified || false,
                hold_history: so.hold_history || [],
                updated_at: so.updated_at || so.updatedAt || sof.updated_at || null,
                updated_by: so.updated_by || [],
                price_approved_by: so.price_approved_by || null,
                price_approved_datetime: so.price_approved_datetime || null,
                pi_approved_by: so.pi_approved_by || null,
                pi_approved_datetime: so.pi_approved_datetime || null,
                enquiry_id: enq,
                status: normalizedStatus,
                is_on_hold: isOnHold,
                has_ct_pack: hasCtPack,
                is_in_qc: isInQC,
                is_qc_completed: isQcCompleted,
                is_partial_dispatch: isPartialDispatch,
                is_packed: isPacked,
                is_dispatched: isDispatched,
                category: so.category || sof.category || matchedSf?.department || 'Sales Order',
                technique: so.subcategory || sof.subcategory || matchedSf?.process_name || 'Manufacturing',
                csHistory: liveCsHistory,
                approvals: [
                    { stage: 'Enquiry', by: enq.name || 'Sales Team', dt: enq.created_at || 'Received', status: 'done', icon: '📞' },
                    { stage: 'Approved Design', by: 'DTP Team', dt: (so.is_design_uploaded || so.is_verified_to_proceed) ? 'Approved' : 'Pending', status: (so.is_design_uploaded || so.is_verified_to_proceed) ? 'done' : 'active', icon: '🎨' },
                    { stage: 'BOM Creation', by: 'Tech Team', dt: (matchedBom || so.is_bom_filled || so.is_bom_verified) ? 'Released' : 'Pending', status: (matchedBom || so.is_bom_filled || so.is_bom_verified) ? 'done' : 'active', icon: '📋' },
                    { stage: 'Sales Order', by: sof.contact_person || 'Confirmed', dt: so.created_at || 'Confirmed', status: 'done', icon: '✅' },
                    { stage: 'Production', by: matchedSf?.department || 'Ops Head', dt: (so.is_pushed_shop_floor || matchedSf) ? 'Active' : 'Pending', status: (so.is_pushed_shop_floor || matchedSf) ? 'active' : 'pending', icon: '🏭' },
                    { stage: 'Dispatch', by: 'Logistics', dt: matchedPack.dispatchDt ? 'Shipped' : 'Pending', status: matchedPack.dispatchDt ? 'done' : 'pending', icon: '🚚' },
                ],
                bomMaterial: liveBomMaterial,
                bomProcess: liveBomProcess,
                materialLedger: matchedSf?.materialLedger || [],
                processLedger: matchedSf?.processLedger || [],
                journey: liveJourney,
                shopfloor_inhouse: inhouseList,
                shopfloor_outsource: outsourceList,
                shop_floor_jobs: uniqueSfJobs,
                ...matchedPack,
                ct_pack: matchedPack,
                product_image: getSafeSignedUrl(sof.image || so.image || so.sample_trophy_image || enq.image || enq.product_image || (Array.isArray(enq.images) && enq.images[0]?.url ? enq.images[0].url : '') || (Array.isArray(sof.product_files) && sof.product_files[0] ? sof.product_files[0] : '') || matchedSf?.image || ''),
                fg: fgData,
                packing: packingData,
                financial: financialData,
                flowLedger: liveFlowLedger
            });
        });

        // STEP 2: Fallback for ShopFloor Jobs not yet linked to Sales Orders
        shopFloorJobs.forEach((bj) => {
            const rawId = bj.sub_job_no || bj.job_no;
            if (!rawId) return;

            // STRICT FILTER: Do not take revision jobs like RD21021a-R1, RD21021a-R2
            if (isRevisionJob(rawId) || isRevisionJob(bj.sub_job_no) || isRevisionJob(bj.job_no)) {
                return;
            }

            const id = rawId;
            if (jobsMap.has(id)) return;

            const baseId = id.replace(/-R\d*$/i, '');

            const bjSoIdStr = bj.sales_order_id ? String(bj.sales_order_id?._id || bj.sales_order_id).trim() : '';
            const so = (bjSoIdStr && soMap.get(bjSoIdStr))
                || soMap.get(bj.so_number)
                || soMap.get(bj.job_no)
                || soMap.get(bj.sub_job_no)
                || (isPopulated(bj.sales_order_id) ? bj.sales_order_id : {});

            const bjEnqIdStr = bj.enquiry_id ? String(bj.enquiry_id?._id || bj.enquiry_id).trim() : '';
            const enq = (bjEnqIdStr && enquiryMap.get(bjEnqIdStr))
                || enquiryMap.get(bj.job_no)
                || enquiryMap.get(bj.sub_job_no)
                || (isPopulated(bj.enquiry_id) ? bj.enquiry_id : {});

            const cust = so.customer_id || {};

            const clientName = cust.company_name || cust.name || enq.name || bj.client_name || bj.customer_name || 'Client';
            const productName = bj.product_name || bj.process_name || bj.item_name || 'Product';

            const bjBomIdStr = bj.bom_id ? String(bj.bom_id?._id || bj.bom_id).trim() : '';
            const matchedBom = (bjBomIdStr && bomMap.get(bjBomIdStr))
                || (bjBomIdStr && bomMap.get(bjBomIdStr.toLowerCase()))
                || bomMap.get(bj.sub_job_no)
                || bomMap.get(String(bj.sub_job_no || '').toLowerCase().trim())
                || bomMap.get(bj.job_no)
                || bomMap.get(String(bj.job_no || '').toLowerCase().trim())
                || bomMap.get(baseId)
                || bomMap.get(String(baseId).toLowerCase().trim())
                || bomMap.get(id)
                || bomMap.get(String(id).toLowerCase().trim())
                || (isPopulated(bj.bom_id) ? bj.bom_id : null);

            // BOM Costing Rate & Job Total Extraction for ShopFloor Jobs fallback
            let bomQuotation = matchedBom?.quotation;
            if (typeof bomQuotation === 'string') {
                try { 
                   bomQuotation = JSON.parse(bomQuotation); 
                } catch (e) {
                    console.log("error parsing bomQuotation", e)
                   bomQuotation = null;
                }
            }
            if (!bomQuotation?.finalUnitPrice && matchedBom?.qty_update?.recalculated_data?.quotation) {
                let recalcQuo = matchedBom.qty_update.recalculated_data.quotation;
                if (typeof recalcQuo === 'string') {
                    try {
                        recalcQuo = JSON.parse(recalcQuo);
                    } catch (e) {
                        console.log(e)
                        recalcQuo = null;
                    }
                }
                if (recalcQuo?.finalUnitPrice) bomQuotation = recalcQuo;
            }

            const bomFixUnitRate = parseNum(bomQuotation?.finalUnitPrice);
            const bomFixJobPrice = parseNum(bomQuotation?.finalJobPrice);
            const bomQty = parseNum(matchedBom?.job_quantity);

            const qtyVal = Number(bj.quantity || bj.total_qty || (bomQty > 0 ? bomQty : 0) || bj.process_qty || so.total_qty || 1);
            const rawUnitRate = bomFixUnitRate > 0
                ? bomFixUnitRate
                : Number(
                    bj.unit_rate ||
                    so.so_rate ||
                    so.rate ||
                    parseNum(matchedBom?.totalUnitCost) ||
                    parseNum(matchedBom?.jobSheet?.totalUnitCost) ||
                    parseNum(matchedBom?.costdetails?.totalUnitCost) ||
                    0
                );
            const subtotalAmt = bomFixJobPrice > 0
                ? bomFixJobPrice
                : (rawUnitRate > 0 ? Number((rawUnitRate * qtyVal).toFixed(2)) : 0)
                || bj.subtotal
                || so.subtotal
                || 0;
            const unitRate = rawUnitRate > 0 ? rawUnitRate : (qtyVal > 0 && subtotalAmt > 0 ? Number((subtotalAmt / qtyVal).toFixed(2)) : 0);
            const gstRate = Number(bomQuotation?.gstRate || bj.gst_rate || so.gst_rate || 18);
            // const totalAmt = bj.total_amount || so.total_amount || (subtotalAmt * (1 + gstRate / 100));

            const rawStatus = bj.status || 'in_production';
            const normalizedStatus = rawStatus.toLowerCase().replace(/\s+/g, '_');

            const rawEmails = [];
            if (cust?.email) rawEmails.push(cust.email);
            if (Array.isArray(enq?.email)) rawEmails.push(...enq.email);
            else if (enq?.email) rawEmails.push(enq.email);
            if (bj?.email) rawEmails.push(bj.email);
            const emailsList = Array.from(new Set(rawEmails.filter(e => e && typeof e === 'string' && e.trim() !== '')));

            const matchedSof = (bj.sample_salesorder_id && typeof bj.sample_salesorder_id === 'object')
                ? bj.sample_salesorder_id
                : (sofMap.get(String(bj.sales_order_id?._id || bj.sales_order_id))
                    || sofMap.get(String(bj.enquiry_id?._id || bj.enquiry_id))
                    || sofMap.get(bj.sub_job_no)
                    || sofMap.get(String(bj.sub_job_no || '').toLowerCase().trim())
                    || sofMap.get(bj.job_no)
                    || sofMap.get(String(bj.job_no || '').toLowerCase().trim())
                    || sofMap.get(id)
                    || {});

            // Unique Mobile Numbers
            const rawMobile = [];
            if (cust?.mobile_no) rawMobile.push(String(cust.mobile_no));
            if (matchedSof?.mobile_no) rawMobile.push(String(matchedSof.mobile_no));
            if (enq?.mobile_no) rawMobile.push(String(enq.mobile_no));
            if (bj?.phone_number) rawMobile.push(String(bj.phone_number));
            const mobileList = Array.from(new Set(rawMobile.filter(p => p && String(p).trim() !== '')));

            // Unique WhatsApp Numbers
            const rawWp = [];
            if (Array.isArray(matchedSof?.wp_number)) rawWp.push(...matchedSof.wp_number.map(String));
            else if (matchedSof?.wp_number) rawWp.push(String(matchedSof.wp_number));
            if (Array.isArray(enq?.wp_number)) rawWp.push(...enq.wp_number.map(String));
            else if (enq?.wp_number) rawWp.push(String(enq.wp_number));
            const wpList = Array.from(new Set(rawWp.filter(w => w && String(w).trim() !== '')));

            const sfRawType = (bj.job_type || bj.type || so.type || 'production').toLowerCase();
            const sfOrderType = sfRawType.includes('sample') ? 'Sample' : 'Production';

            const { inhouseList: bjInhouse, outsourceList: bjOutsource } = extractShopfloorDetails([bj], qtyVal);

            // Calculate actual and BOM costs for STEP 2
            let actualMaterialAccepted = 0;
            let actualInhouseProcessCost = 0;
            let actualOutsourceProcessCost = 0;

            (bj.material_groups || []).forEach(mg => {
                (mg.inward_history || []).forEach(inw => {
                    actualMaterialAccepted += Number(inw.accepted_value) || 0;
                });
                const mgInhouseQty = Number(mg.inhouse_qty) || Number(mg.process_qty) || 0;
                const mgProcessRate = Number(mg.process_rate) || 0;
                if (!mg.is_outsource && mgProcessRate > 0) {
                    actualInhouseProcessCost += mgProcessRate * mgInhouseQty;
                }
                (mg.outsource_assignments || []).forEach(asgn => {
                    actualOutsourceProcessCost += (Number(asgn.outsource_rate) || Number(mg.outsource_rate) || 0) *
                        (Number(asgn.outsource_qty) || Number(asgn.outsource_sheets) || 0);
                });
                if (mg.is_outsource && !(mg.outsource_assignments?.length > 0)) {
                    actualOutsourceProcessCost += (Number(mg.outsource_rate) || 0) * (Number(mg.outsource_qty) || 0);
                }
            });

            const matActTotal = actualMaterialAccepted;
            const procActTotal = actualInhouseProcessCost + actualOutsourceProcessCost;
            const packCostTotal = Number(bj.packing?.total_cost || 0);

            const effectiveSubtotal = subtotalAmt > 0 ? subtotalAmt : (matActTotal + procActTotal);
            const effectiveUnitRate = unitRate > 0 ? unitRate : (qtyVal > 0 && effectiveSubtotal > 0 ? Number((effectiveSubtotal / qtyVal).toFixed(2)) : 0);
            const effectiveTotalAmt = Number((effectiveSubtotal * (1 + gstRate / 100)).toFixed(2));
            const overheadTotal = Math.round(effectiveSubtotal * 0.10);
            const totalActualExpenses = matActTotal + procActTotal + packCostTotal + overheadTotal;
            const grossProfitAmt = effectiveSubtotal - totalActualExpenses;
            const grossMarginPercentage = effectiveSubtotal > 0 ? Number(((grossProfitAmt / effectiveSubtotal) * 100).toFixed(1)) : 0;

            jobsMap.set(id, {
                id,
                _id: String(bj._id),
                type: sfOrderType,
                client: clientName,
                clientGST: cleanText(cust.gst_no) || cleanText(bj.gst_number) || cleanText(matchedSof.billing_gst_no) || '-',
                contact: cust.name || bj.contact_person || '-p',
                phone: mobileList[0] || '',
                phones: mobileList,
                mobile: mobileList[0] || '',
                mobiles: mobileList,
                whatsapp: wpList[0] || '',
                wpNumbers: wpList,
                email: emailsList[0] || '',
                emails: emailsList,
                soNo: so.so_number || bj.so_number || `SO-${id}`,
                soDate: so.so_date || bj.so_date || '',
                invoiceNo: bj.invoice_number || '',
                image: getSafeSignedUrl(matchedSof.image || so.image || so.sample_trophy_image || bj.image || enq.image || enq.product_image || (Array.isArray(enq.images) && enq.images[0]?.url ? enq.images[0].url : '') || ''),
                product: productName,
                qty: qtyVal,
                soRate: effectiveUnitRate,
                soAmt: effectiveSubtotal,
                gst: gstRate,
                soTotal: effectiveTotalAmt,
                delivDate: formatDateOnly(matchedSof.delivery_date),
                completionDate: formatDateOnly(matchedSof.job_completion_datetime),
                job_completion_datetime: formatDateOnly(matchedSof.job_completion_datetime),
                status: normalizedStatus,
                category: bj.department || bj.category || 'General',
                technique: bj.process_name || 'Manufacturing',
                csHistory: bj.csHistory || [],
                approvals: [
                    { stage: 'Enquiry', by: enq.name || 'Sales Team', dt: 'Received', status: 'done', icon: '📞' },
                    { stage: 'Approved Design', by: 'DTP Team', dt: 'Approved', status: 'done', icon: '🎨' },
                    { stage: 'BOM Creation', by: 'Tech Team', dt: 'Released', status: 'done', icon: '📋' },
                    { stage: 'Sales Order', by: cust.name || 'Accounts', dt: 'Confirmed', status: 'done', icon: '✅' },
                    { stage: 'Production', by: bj.department || 'Ops Head', dt: bj.status || 'In Progress', status: 'active', icon: '🏭' },
                    { stage: 'Dispatch', by: 'Logistics', dt: 'Pending', status: 'pending', icon: '🚚' },
                ],
                bomMaterial: bj.material_groups || bj.bomMaterial || [],
                bomProcess: bj.bomProcess || [],
                materialLedger: bj.materialLedger || [],
                processLedger: bj.processLedger || [],
                journey: bj.journey || [],
                shopfloor_inhouse: bjInhouse,
                shopfloor_outsource: bjOutsource,
                shop_floor_jobs: [bj],
                fg: bj.fg || { fgDate: '', fgQty: 0, fgBy: '', invoiceRaised: false },
                packing: bj.packing || { packedBy: '', boxes: 0, packDt: '', destinations: [] },
                financial: {
                    revenue: { subtotal: effectiveSubtotal, gstAmt: (effectiveSubtotal * gstRate) / 100, total: effectiveTotalAmt },
                    materialCost: { bom: 0, actual: matActTotal, variance: matActTotal, is_actual: actualMaterialAccepted > 0 },
                    processCost: { bom: 0, actual: procActTotal, variance: procActTotal, inhouse: actualInhouseProcessCost, outsource: actualOutsourceProcessCost, is_actual: procActTotal > 0 },
                    packingCost: { total: packCostTotal },
                    overhead: { pct: 10, amt: overheadTotal },
                    grossMargin: grossMarginPercentage
                },
                flowLedger: bj.flowLedger || []
            });
        });

        // STEP 3: Fallback for Sales Order Forms not linked directly
        salesOrderForms.forEach((sof) => {
            const rawId = sof.sub_job_no || sof.job_no || sof.id || (sof._id ? `SOF-${sof._id}` : null);
            if (!rawId) return;

            // STRICT FILTER: Do not take revision jobs like RD21021a-R1, RD21021a-R2
            if (isRevisionJob(rawId) || isRevisionJob(sof.sub_job_no) || isRevisionJob(sof.job_no)) {
                return;
            }

            const id = rawId;
            if (jobsMap.has(id)) return;

            const baseId = id.replace(/-R\d*$/i, '');

            const enq = (sof.enquiry_id && typeof sof.enquiry_id === 'object')
                ? sof.enquiry_id
                : (enquiryMap.get(String(sof.enquiry_id)) || {});

            const clientName = sof.client_name || enq.name || 'Client';
            const productName = sof.product_name || enq.product_name || 'Product';
            const matchedBom = (sof.bom_id && typeof sof.bom_id === 'object')
                ? sof.bom_id
                : (bomMap.get(String(sof.bom_id))
                    || bomMap.get(String(sof.bom_id || '').toLowerCase().trim())
                    || bomMap.get(sof.sub_job_no)
                    || bomMap.get(String(sof.sub_job_no || '').toLowerCase().trim())
                    || bomMap.get(sof.job_no)
                    || bomMap.get(String(sof.job_no || '').toLowerCase().trim())
                    || bomMap.get(baseId)
                    || bomMap.get(String(baseId).toLowerCase().trim())
                    || bomMap.get(id)
                    || bomMap.get(String(id).toLowerCase().trim()));

            const bomUnitRate = parseNum(matchedBom?.quotation?.finalUnitPrice) || parseNum(matchedBom?.totalUnitCost) || parseNum(matchedBom?.jobSheet?.totalUnitCost) || parseNum(matchedBom?.costdetails?.totalUnitCost) || 0;
            const bomJobTotal = parseNum(matchedBom?.quotation?.finalJobPrice) || parseNum(matchedBom?.totalJobCost) || parseNum(matchedBom?.jobSheet?.totalJobCost) || parseNum(matchedBom?.costdetails?.totalJobCost) || 0;
            const bomQty = parseNum(matchedBom?.job_quantity);

            const qtyVal = Number(sof.job_quantity || (bomQty > 0 ? bomQty : 0) || enq.quantity || 1);
            const rawUnitRate = Number(bomUnitRate || (sof.price_per_piece ? parseFloat(sof.price_per_piece) : 0) || enq.rate || 0);
            const subtotalAmt = Number(bomJobTotal || (rawUnitRate > 0 ? Number((rawUnitRate * qtyVal).toFixed(2)) : 0) || enq.final_total || 0);
            const unitRate = rawUnitRate > 0 ? rawUnitRate : (qtyVal > 0 && subtotalAmt > 0 ? Number((subtotalAmt / qtyVal).toFixed(2)) : 0);
            const gstRate = enq.gst_percentage || Number(matchedBom?.quotation?.gstRate) || 18;
            const totalAmt = Number((subtotalAmt * (1 + gstRate / 100)).toFixed(2));

            const rawEmails = [];
            if (Array.isArray(sof.email)) rawEmails.push(...sof.email);
            else if (sof.email) rawEmails.push(sof.email);
            if (Array.isArray(enq?.email)) rawEmails.push(...enq.email);
            else if (enq?.email) rawEmails.push(enq.email);
            const emailsList = Array.from(new Set(rawEmails.filter(e => e && typeof e === 'string' && e.trim() !== '')));

            // Unique Mobile Numbers
            const rawMobile = [];
            if (sof.mobile_no) rawMobile.push(String(sof.mobile_no));
            if (enq?.mobile_no) rawMobile.push(String(enq.mobile_no));
            const mobileList = Array.from(new Set(rawMobile.filter(p => p && String(p).trim() !== '')));

            // Unique WhatsApp Numbers
            const rawWp = [];
            if (Array.isArray(sof.wp_number)) rawWp.push(...sof.wp_number.map(String));
            else if (sof.wp_number) rawWp.push(String(sof.wp_number));
            if (Array.isArray(enq?.wp_number)) rawWp.push(...enq.wp_number.map(String));
            else if (enq?.wp_number) rawWp.push(String(enq.wp_number));
            const wpList = Array.from(new Set(rawWp.filter(w => w && String(w).trim() !== '')));

            const rawType = (sof.type || (sof.sample_required ? 'sample' : 'production')).toLowerCase();
            const orderType = rawType.includes('sample') ? 'Sample' : 'Production';

            const matchedSfListSof = [
                ...(shopFloorMultiMap.get(id.toLowerCase().trim()) || []),
                ...(shopFloorMultiMap.get(String(sof._id).toLowerCase().trim()) || [])
            ];
            const { inhouseList: sofInhouse, outsourceList: sofOutsource } = extractShopfloorDetails(matchedSfListSof, qtyVal);

            const overheadTotal = Math.round(subtotalAmt * 0.10);

            jobsMap.set(id, {
                id,
                _id: String(sof._id),
                type: orderType,
                client: clientName,
                clientGST: cleanText(sof.billing_gst_no) || '-',
                contact: sof.contact_person || '-',
                phone: mobileList[0] || '',
                phones: mobileList,
                mobile: mobileList[0] || '',
                mobiles: mobileList,
                whatsapp: wpList[0] || '',
                wpNumbers: wpList,
                email: emailsList[0] || '',
                emails: emailsList,
                soNo: sof.job_no || id,
                soDate: sof.created_at || '',
                invoiceNo: '',
                image: getSafeSignedUrl(sof.image || enq.image || enq.product_image || (Array.isArray(enq.images) && enq.images[0]?.url ? enq.images[0].url : '') || (Array.isArray(sof.product_files) && sof.product_files[0] ? sof.product_files[0] : '') || ''),
                product: productName,
                qty: qtyVal,
                soRate: unitRate,
                soAmt: subtotalAmt,
                gst: gstRate,
                soTotal: totalAmt,
                delivDate: formatDateOnly(sof.delivery_date),
                completionDate: formatDateOnly(sof.job_completion_datetime),
                job_completion_datetime: formatDateOnly(sof.job_completion_datetime),
                status: 'in_production',
                category: sof.category || 'Sales Order',
                technique: sof.subcategory || 'Manufacturing',
                csHistory: [],
                approvals: [
                    { stage: 'Enquiry', by: enq.name || 'Sales Team', dt: 'Received', status: 'done', icon: '📞' },
                    { stage: 'Approved Design', by: 'DTP Team', dt: 'Approved', status: 'done', icon: '🎨' },
                    { stage: 'BOM Creation', by: 'Tech Team', dt: (matchedBom ? 'Released' : 'Pending'), status: (matchedBom ? 'done' : 'active'), icon: '📋' },
                    { stage: 'Sales Order Form', by: sof.contact_person || 'Accounts', dt: 'Confirmed', status: 'done', icon: '✅' },
                    { stage: 'Production', by: 'Ops Head', dt: 'Scheduled', status: 'pending', icon: '🏭' },
                    { stage: 'Dispatch', by: 'Logistics', dt: 'Pending', status: 'pending', icon: '🚚' },
                ],
                bomMaterial: [],
                bomProcess: [],
                materialLedger: [],
                processLedger: [],
                journey: [],
                shopfloor_inhouse: sofInhouse,
                shopfloor_outsource: sofOutsource,
                shop_floor_jobs: matchedSfListSof,
                fg: { fgDate: '', fgQty: 0, fgBy: '', invoiceRaised: false },
                packing: { packedBy: '', boxes: 0, packDt: '', destinations: [] },
                financial: {
                    revenue: { subtotal: subtotalAmt, gstAmt: (subtotalAmt * gstRate) / 100, total: totalAmt },
                    materialCost: { bom: 0, actual: 0, variance: 0 },
                    processCost: { bom: 0, actual: 0, variance: 0 },
                    packingCost: { total: 0 },
                    overhead: { pct: 10, amt: overheadTotal },
                    grossMargin: 0
                },
                flowLedger: []
            });
        });

        let jobsList = Array.from(jobsMap.values());

        // Attach DTP Overview to all jobs
        jobsList.forEach(job => {
            const rawId = job.id || '';
            const matchedDtpList = [
                ...(dtpMultiMap.get(rawId.toLowerCase().trim()) || [])
            ];
            // Remove duplicates by _id
            const uniqueDtpJobs = Array.from(new Set(matchedDtpList.map(j => String(j._id))))
                .map(id => matchedDtpList.find(j => String(j._id) === id));
            job.dtp_overview = uniqueDtpJobs;
        });

        // STRICT FILTER: Only display Production or Sample jobs in Job Ledger
        jobsList = jobsList.filter(j => j.type === 'Production' || j.type === 'Sample');

        // Filtering by search term
        if (search) {
            const q = search.toLowerCase().trim();
            jobsList = jobsList.filter(j =>
                (j.id && String(j.id).toLowerCase().includes(q)) ||
                (j.job_no && String(j.job_no).toLowerCase().includes(q)) ||
                (j.sub_job_no && String(j.sub_job_no).toLowerCase().includes(q)) ||
                (j.reference_no && String(j.reference_no).toLowerCase().includes(q)) ||
                (j.client && String(j.client).toLowerCase().includes(q)) ||
                (j.product && String(j.product).toLowerCase().includes(q)) ||
                (j.soNo && String(j.soNo).toLowerCase().includes(q))
            );
        }

        // Filtering by status / filter tab
        const activeFilter = String(filter || status || 'all').toLowerCase().trim();
        if (activeFilter && activeFilter !== 'all') {
            jobsList = jobsList.filter(j => {
                const jStatus = String(j.status || '').toLowerCase().trim();
                const packStage = String(j.stage || j.ct_pack?.stage || j.packing?.stage || '').toLowerCase().trim();
                const packStatus = String(j.status || j.ct_pack?.status || j.packing?.status || '').toLowerCase().trim();
                const isOnHold = Boolean(j.is_on_hold || jStatus === 'hold' || jStatus === 'on_hold');

                if (activeFilter === 'due_today' || activeFilter === 'due-today' || activeFilter === 'duetoday') {
                    return isDateToday(j.completionDate || j.job_completion_datetime || j.delivery_date || j.delivDate);
                }
                if (activeFilter === 'hold') {
                    return isOnHold;
                }
                if (activeFilter === 'done') {
                    return !isOnHold && (
                        packStage === 'logistics' ||
                        j.stage === 'logistics' ||
                        j.ct_pack?.stage === 'logistics'
                    );
                }
                if (activeFilter === 'shipped' || activeFilter === 'dispatched') {
                    const isDoneTab = Boolean(
                        !isOnHold && (
                            packStage === 'logistics' ||
                            j.stage === 'logistics' ||
                            j.ct_pack?.stage === 'logistics'
                        )
                    );
                    const plannedQty = Number(j.qty || j.job_quantity || j.total_qty || 0);
                    const deliveredQty = Number(j.deliveredQty ?? j.ct_pack?.deliveredQty ?? j.packing?.deliveredQty ?? j.packed_qty ?? 0);
                    const isQtyComplete = plannedQty > 0 && deliveredQty >= plannedQty;

                    return Boolean(
                        !isOnHold &&
                        !isDoneTab &&
                        packStatus !== 'packing in progress' &&
                        jStatus !== 'packing_in_progress' &&
                        packStage !== 'logistics' &&
                        !j.is_partial_dispatch &&
                        (
                            jStatus === 'shipped' ||
                            jStatus === 'dispatched' ||
                            j.is_dispatched ||
                            packStatus === 'completed' ||
                            packStatus === 'dispatched' ||
                            packStage === 'complete' ||
                            packStage === 'completed' ||
                            packStage === 'dispatched' ||
                            isQtyComplete ||
                            (j.packing && j.packing.dispatchDt && (packStatus === 'completed' || isQtyComplete))
                        )
                    );
                }
                return jStatus === activeFilter;
            });
        }

        if (String(dueToday) === 'true') {
            jobsList = jobsList.filter(j => isDateToday(j.completionDate || j.job_completion_datetime || j.delivery_date || j.delivDate));
        }

        const total = jobsList.length;
        let paginatedList = jobsList;
        let pageNum = 1;
        let limitNum = total;
        let totalPages = 1;

        if (page !== undefined || limit !== undefined) {
            pageNum = Math.max(1, parseInt(page, 10) || 1);
            if (limit === 'all') {
                limitNum = total;
                totalPages = 1;
                paginatedList = jobsList;
            } else {
                limitNum = Math.max(1, parseInt(limit, 10) || 20);
                totalPages = Math.max(1, Math.ceil(total / limitNum));
                const startIndex = (pageNum - 1) * limitNum;
                paginatedList = jobsList.slice(startIndex, startIndex + limitNum);
            }
        }

        return res.status(200).json({
            success: true,
            count: paginatedList.length,
            total,
            page: pageNum,
            limit: limitNum,
            totalPages,
            data: paginatedList
        });

    } catch (error) {
        console.error("Error in getJobLedgerList:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch Job Ledger records",
            error: error.message
        });
    }
};


/**
 * @desc Get complete single job ledger by job number
 * @route GET /job-ledger/:jobNo
 * @access Private
 */
export const getJobLedgerByJobNo = async (req, res) => {
    try {
        const { jobNo } = req.params;

        const shopFloorJob = await shopFloorJobModel
            .findOne({ $or: [{ job_no: jobNo }, { sub_job_no: jobNo }] })
            .populate({ path: "sales_order_id", options: { strictPopulate: false } })
            .populate({ path: "enquiry_id", options: { strictPopulate: false } })
            .populate({ path: "bom_id", options: { strictPopulate: false } })
            .lean();

        if (!shopFloorJob) {
            return res.status(404).json({
                success: false,
                message: `Job ${jobNo} not found in database`
            });
        }

        return res.status(200).json({
            success: true,
            data: shopFloorJob
        });

    } catch (error) {
        console.error("Error in getJobLedgerByJobNo:", error);
        return res.status(500).json({
            success: false,
            message: `Failed to fetch details for job ${req.params.jobNo}`,
            error: error.message
        });
    }
};
