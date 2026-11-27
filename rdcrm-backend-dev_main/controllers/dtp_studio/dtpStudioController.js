import dtpStudioModel from "../../models/dtp_studio/dtpStudioModel.js";
import StoreMaterialIssue from "../../models/store/materialIssueModel.js";
import dtpGroupModel from "../../models/dtp_studio/dtpGroupModel.js";
import salesorder from "../../models/sales_orders/sales_order_list_Model.js";
import salesorderformModel from "../../models/sales_orders/sales_order_form_Model.js";
import enquiryModel from "../../models/enquiry/enquiryModel.js";
import bomModel from "../../models/bom/bomModel.js";
import { getCurrentDate } from "../../helpers/dateTime.js";
import moment from "moment";
import { uploadToR2, deleteFromR2, generateSignedUrl } from "../../helpers/r2helper.js";
import rfqModel from "../../models/rfq/rfqModel.js";
import shopFloorJobModel from "../../models/shopfloor/shopFloorJobModel.js";
import userModel from "../../models/users/userModel.js";
import { triggerBOMRecalculationForPendingQty } from "../bom/bomController.js";


const formatDTPJob = (job) => {
    if (!job) return null;
    const jobObj = job.toObject ? job.toObject() : job;

    // Handle sales order image
    if (jobObj.image) {
        jobObj.image = generateSignedUrl(jobObj.image);
    }

    // Fallback for job_quantity
    if (!jobObj.job_quantity && jobObj.bom_id && jobObj.bom_id.job_quantity) {
        jobObj.job_quantity = jobObj.bom_id.job_quantity;
    }

    // Handle Date Fallbacks
    if (!jobObj.delivery_date) {
        if (jobObj.sample_order_id && jobObj.sample_order_id.delivery_date) {
            jobObj.delivery_date = jobObj.sample_order_id.delivery_date;
        }
    }

    if (!jobObj.job_completion_date) {
        if (jobObj.sample_order_id && jobObj.sample_order_id.job_completion_datetime) {
            jobObj.job_completion_date = jobObj.sample_order_id.job_completion_datetime;
        }
    }

    // Handle BOM artwork files
    if (jobObj.bom_id) {
        if (jobObj.bom_id.artwork_pdf) {
            jobObj.bom_id.artwork_pdf = generateSignedUrl(jobObj.bom_id.artwork_pdf);
            jobObj.artwork_pdf = jobObj.bom_id.artwork_pdf;
        }
        if (jobObj.bom_id.artwork_cdr) {
            jobObj.bom_id.artwork_cdr = generateSignedUrl(jobObj.bom_id.artwork_cdr);
            jobObj.artwork_cdr = jobObj.bom_id.artwork_cdr;
        }
    }

    // Handle additional files from sample order
    if (jobObj.sample_order_id) {
        if (jobObj.sample_order_id.additional_files && Array.isArray(jobObj.sample_order_id.additional_files)) {
            jobObj.additional_files = jobObj.sample_order_id.additional_files.map(item => {
                if (typeof item === 'string') {
                    const signed = generateSignedUrl(item);
                    return {
                        file_url: signed,
                        url: signed,
                        name: 'Attachment',
                    };
                } else if (item && item.file_url) {
                    const signed = generateSignedUrl(item.file_url);
                    return {
                        ...item,
                        file_url: signed,
                        url: signed,
                        name: item.name || "",
                        designation: item.designation || "",
                    };
                }
                return item;
            });
        }

        if ((!jobObj.additional_files || jobObj.additional_files.length === 0) && jobObj.enquiry_id) {
            const enq = jobObj.enquiry_id;
            const fallbackAssets = [];
            const enqLogos = enq.client_logo || enq.wizard_state?.clientLogo || enq.wizard_state?.e?.globalLogos || [];
            (Array.isArray(enqLogos) ? enqLogos : [enqLogos]).filter(Boolean).forEach(l => {
                const url = typeof l === 'string' ? l : (l.file_url || l.url);
                if (url) fallbackAssets.push({ tag_name: 'Logo', file_url: generateSignedUrl(url), name: l.name || 'Client Logo' });
            });
            const enqSigs = enq.signatures || enq.wizard_state?.signatures || enq.wizard_state?.e?.globalSignatures || [];
            (Array.isArray(enqSigs) ? enqSigs : [enqSigs]).filter(Boolean).forEach(s => {
                const url = typeof s === 'string' ? s : (s.file_url || s.url);
                if (url) fallbackAssets.push({
                    tag_name: s.name ? `Signed Image - ${s.name}${s.designation ? ` (${s.designation})` : ''}` : 'Signed Image',
                    file_url: generateSignedUrl(url),
                    name: s.name || '',
                    designation: s.designation || ''
                });
            });
            const enqAddl = enq.additional_files || enq.wizard_state?.additionalFiles || enq.wizard_state?.e?.globalAdditionalFiles || [];
            (Array.isArray(enqAddl) ? enqAddl : [enqAddl]).filter(Boolean).forEach(a => {
                const url = typeof a === 'string' ? a : (a.file_url || a.url);
                if (url) fallbackAssets.push({ tag_name: 'additional_files', file_url: generateSignedUrl(url), name: a.name || 'Additional File' });
            });
            if (fallbackAssets.length > 0) {
                jobObj.additional_files = fallbackAssets;
            }
        }

        if (jobObj.sample_order_id.process_files && Array.isArray(jobObj.sample_order_id.process_files)) {
            jobObj.sample_order_id.process_files = jobObj.sample_order_id.process_files.map(procFile => {
                if (procFile.production_file) {
                    procFile.production_file = generateSignedUrl(procFile.production_file);
                }
                if (procFile.dtp_file) {
                    procFile.dtp_file = generateSignedUrl(procFile.dtp_file);
                }
                return procFile;
            });
        }
    }

    // Handle stage updates files
    if (jobObj.stage_updates && jobObj.stage_updates.length > 0) {
        jobObj.stage_updates = jobObj.stage_updates.map(update => {
            if (update.job_sheet_files && update.job_sheet_files.length > 0) {
                update.job_sheet_files = update.job_sheet_files.map(file => generateSignedUrl(file));
            }
            return update;
        });
    }

    // Handle proof files
    ['master_template_files', 'content_proofing_files'].forEach(field => {
        if (jobObj[field] && jobObj[field].length > 0) {
            jobObj[field] = jobObj[field].map(file => {
                if (file.file_url) file.file_url = generateSignedUrl(file.file_url);
                if (file.rejection_reference_file) file.rejection_reference_file = generateSignedUrl(file.rejection_reference_file);
                return file;
            });
        }
    });

    // Handle final prep files
    if (jobObj.final_prep_files && jobObj.final_prep_files.length > 0) {
        jobObj.final_prep_files = jobObj.final_prep_files.map(prep => {
            if (prep.production_files) {
                prep.production_files = prep.production_files.map(f => ({ ...f, file_url: generateSignedUrl(f.file_url) }));
            }
            if (prep.reference_images) {
                prep.reference_images = prep.reference_images.map(f => ({ ...f, file_url: generateSignedUrl(f.file_url) }));
            }
            // For backward compatibility
            if (prep.production_file && prep.production_file.file_url) {
                prep.production_file.file_url = generateSignedUrl(prep.production_file.file_url);
            }
            if (prep.reference_image && prep.reference_image.file_url) {
                prep.reference_image.file_url = generateSignedUrl(prep.reference_image.file_url);
            }
            return prep;
        });
    }

    // Handle accounting files
    if (jobObj.accounting_details && jobObj.accounting_details.processing_files) {
        jobObj.accounting_details.processing_files = jobObj.accounting_details.processing_files.map(file => {
            if (file.file_url) file.file_url = generateSignedUrl(file.file_url);
            return file;
        });
    }

    return jobObj;
};

export const getAllDTPJobs = async (req, res) => {
    try {
        const { status, search, artist, from_date, to_date } = req.query;
        const page = Math.max(1, parseInt(req.query.page) || 1);
        // const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        // const skip = (page - 1) * limit;

        const userId = req.user?._id;
        const role = req.user?.role.toLowerCase();
        const permission = req.user?.permission || [];
        const is_head = req.user?.is_head;

        let query = { is_active: true };

        // Sales Person (Permission 9) restricted view: See jobs they created OR jobs for enquiries they created
        if (role !== "admin executive" && (permission.includes(9) || permission.includes("9"))) {
            if (!is_head) {
                const userEnquiryIds = await enquiryModel.find({ created_by: userId }).distinct("_id");
                query.$or = [
                    { created_by: userId },
                    { enquiry_id: { $in: userEnquiryIds } }
                ];
            }
        }

        // DTP Operator restricted view: See jobs assigned to them OR created by them
        if (role === "dtp operator" && !is_head) {
            query.$or = [
                { assigned_to: userId },
                { created_by: userId }
            ];
        }

        if (!search) {
            if (status && status !== "All") query.status = status;
            if (artist) query.assigned_to = artist;
        }

        // Exclude completed jobs older than 7 days when not searching/filtering by a specific status
        if (!status && !search) {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const completedFilter = {
                $or: [
                    { status: { $ne: 'Completed' } },
                    {
                        status: 'Completed',
                        $or: [
                            { updatedAt: { $gte: sevenDaysAgo } },
                            { createdAt: { $gte: sevenDaysAgo } },
                            { is_qty_changed: true },
                            { is_date_changed: true }
                        ]
                    }
                ]
            };
            if (query.$or) {
                const existingOr = query.$or;
                delete query.$or;
                query.$and = [
                    { $or: existingOr },
                    completedFilter
                ];
            } else {
                query.$and = [completedFilter];
            }
        }

        if (search) {
            // Find matching enquiries first (for reference_no cross-collection search)
            const matchingEnquiryIds = await enquiryModel.find({
                $or: [
                    { reference_no: { $regex: search, $options: "i" } },
                    { referenceNo: { $regex: search, $options: "i" } },
                    { reference_number: { $regex: search, $options: "i" } },
                    { id: { $regex: search, $options: "i" } },
                    { name: { $regex: search, $options: "i" } },
                    { product_name: { $regex: search, $options: "i" } },
                ]
            }).distinct("_id");

            const searchCriteria = [
                { job_no: { $regex: search, $options: "i" } },
                { sub_job_no: { $regex: search, $options: "i" } },
                { job_name: { $regex: search, $options: "i" } },
                { enquiry_id: { $in: matchingEnquiryIds } },
            ];

            if (query.$or) {
                // Combine existing visibility OR with search OR using AND
                const visibilityOr = query.$or;
                delete query.$or;
                query.$and = [
                    { $or: visibilityOr },
                    { $or: searchCriteria }
                ];
            } else {
                query.$or = searchCriteria;
            }
        }

        if (from_date && to_date) {
            query.created_at = { $gte: from_date, $lte: to_date };
        }

        const total = await dtpStudioModel.countDocuments(query);
        const jobs = await dtpStudioModel.find(query)
            .populate("created_by", "name")
            .populate("bom_id")
            .populate({
                path: "enquiry_id",
                select: "job_no name product_name reference_no wp_number client_logo signatures additional_files wizard_state customer_name",
                populate: { path: "created_by", select: "name" }
            })
            .populate("group_id")
            .populate("sample_order_id")
            .populate("history.user", "name")
            .sort({ priority: -1, created_at: -1 });
        // .skip(skip)
        // .limit(limit);



        // Pre-fetch sales order forms in bulk to avoid N+1 queries
        const sampleOrderIds = jobs.map(j => j.sample_order_id?._id || j.sample_order_id).filter(Boolean);
        const salesOrders = sampleOrderIds.length > 0
            ? await salesorderformModel.find({ sample__order_id: { $in: sampleOrderIds } }).populate("updated_by.user", "name").lean()
            : [];
        const salesOrderMap = {};
        for (const so of salesOrders) {
            if (so.sample__order_id) {
                salesOrderMap[String(so.sample__order_id)] = so;
            }
        }

        const jobsWithSignedUrls = jobs.map((job) => {
            const jobObj = formatDTPJob(job);
            const sampleOrderId = jobObj.sample_order_id?._id || jobObj.sample_order_id;
            if (sampleOrderId && salesOrderMap[String(sampleOrderId)]) {
                jobObj.sales_order_form = salesOrderMap[String(sampleOrderId)];
            }
            return jobObj;
        });

        return res.status(200).json({
            success: true,
            data: jobsWithSignedUrls,
            pagination: {
                total,
                page,
                // totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.log("error", error)
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getDTPJobById = async (req, res) => {
    try {
        const { id } = req.params;
        const job = await dtpStudioModel.findById(id)
            .populate("created_by", "name")
            .populate({ path: "bom_id" })
            .populate({ path: "sample_order_id" })
            .populate({
                path: "enquiry_id",
                select: "job_no name product_name reference_no wp_number client_logo signatures additional_files wizard_state customer_name",
                populate: { path: "created_by", select: "name" }
            })
            .populate("group_id")
            .populate("history.user", "name");

        if (!job) return res.status(404).json({ success: false, message: "Job not found" });

        const jobObj = formatDTPJob(job);

        // Populate sales order form dynamically for this job on-demand
        const sampleOrderId = jobObj.sample_order_id?._id || jobObj.sample_order_id;
        if (sampleOrderId) {
            const salesOrder = await salesorderformModel.findOne({ sample__order_id: sampleOrderId })
                .populate("updated_by.user", "name")
                .lean();
            if (salesOrder) {
                jobObj.sales_order_form = salesOrder;
            }
        }

        return res.status(200).json({ success: true, data: jobObj });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const updateStage = async (req, res) => {
    try {
        const { id } = req.params;
        const { stage_name, remarks, status } = req.body;
        const userId = req.user?._id;

        const job = await dtpStudioModel.findById(id);
        if (!job) return res.status(404).json({ success: false, message: "Job not found" });

        if (job.is_on_hold) return res.status(400).json({ success: false, message: "Job is on hold. Unhold to perform actions." });

        let job_sheet_files = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const path = `dtp_studio/${job.job_no}/${job.sub_job_no}/${stage_name}`;
                const url = await uploadToR2(path, file.buffer, file.originalname, file.mimetype);
                job_sheet_files.push(url);
            }
        }

        const stageUpdate = {
            stage_name,
            remarks,
            job_sheet_files,
            updated_by: userId,
            updated_at: getCurrentDate()
        };

        job.stage_updates.push(stageUpdate);
        if (status) job.status = status;

        job.history.push({
            action: "Stage Updated",
            description: `Stage: ${stage_name}, Status: ${status || job.status}`,
            user: userId,
            date: getCurrentDate()
        });

        job.updated_at = getCurrentDate();
        await job.save();

        await job.populate("created_by", "name");
        await job.populate("bom_id");
        await job.populate("enquiry_id");
        await job.populate("group_id");
        await job.populate("sample_order_id");
        await job.populate("history.user", "name");

        return res.status(200).json({ success: true, message: "Stage updated successfully", data: formatDTPJob(job) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const reworkJob = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const userId = req.user?._id;

        const job = await dtpStudioModel.findById(id);
        if (!job) return res.status(404).json({ success: false, message: "Job not found" });

        if (job.is_on_hold) return res.status(400).json({ success: false, message: "Job is on hold. Unhold to perform actions." });

        const previousStatus = job.status;
        job.status = "Reprocess";

        job.rework_history.push({
            from_stage: previousStatus,
            to_stage: "Reprocess",
            reason,
            marked_by: userId,
            date: getCurrentDate()
        });

        job.history.push({
            action: "Rework Marked",
            description: `Sent for rework. Reason: ${reason}`,
            user: userId,
            date: getCurrentDate()
        });

        job.updated_at = getCurrentDate();
        await job.save();

        await job.populate("created_by", "name");
        await job.populate("bom_id");
        await job.populate("enquiry_id");
        await job.populate("group_id");
        await job.populate("sample_order_id");
        await job.populate("history.user", "name");

        return res.status(200).json({ success: true, message: "Job marked for rework", data: formatDTPJob(job) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const assignJob = async (req, res) => {
    try {
        const { id } = req.params;
        const { assignedTo, assignedToName, assignmentNote } = req.body;
        const userId = req.user?._id;

        if (!assignedTo) {
            return res.status(400).json({ success: false, message: "Artist ID is required" });
        }

        const job = await dtpStudioModel.findById(id);
        if (!job) return res.status(404).json({ success: false, message: "Job not found" });

        if (job.is_on_hold) return res.status(400).json({ success: false, message: "Job is on hold. Unhold to perform actions." });

        const isReassignment = !!job.assigned_to;
        const actionPrefix = isReassignment ? "Reassigned to" : "Assigned to";

        job.assigned_to = assignedTo;
        job.assigned_to_name = assignedToName;
        job.status = "Assigned";

        const historyDescription = assignmentNote
            ? `${actionPrefix} ${assignedToName || 'Artist'}. Note: ${assignmentNote}`
            : `${actionPrefix} ${assignedToName || 'Artist'}`;

        job.history.push({
            action: "Job Assigned",
            description: historyDescription,
            user: userId,
            date: getCurrentDate()
        });

        job.updated_at = getCurrentDate();
        await job.save();

        await job.populate("created_by", "name");
        await job.populate("bom_id");
        await job.populate("enquiry_id");
        await job.populate("group_id");
        await job.populate("sample_order_id");
        await job.populate("history.user", "name");
        await job.populate('assigned_to', 'name');

        return res.status(200).json({
            success: true,
            message: "Job assigned successfully",
            data: formatDTPJob(job)
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const uploadProof = async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.body;
        const userId = req.user?._id;

        const job = await dtpStudioModel.findById(id).populate("enquiry_id");
        if (!job) return res.status(404).json({ success: false, message: "Job not found" });

        if (job.is_on_hold) return res.status(400).json({ success: false, message: "Job is on hold. Unhold to perform actions." });

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: "No files uploaded" });
        }

        const fieldName = type === 'master' ? 'master_template_files' : 'content_proofing_files';
        const subPath = type === 'master' ? 'master' : 'content';
        const category = job.enquiry_id?.category || "uncategorized";
        const subcategory = job.enquiry_id?.subcategory || "unsubcategorized";
        const basePath = `${category}/${subcategory}/${job.job_no}/${job.sub_job_no}/dtp/${subPath}`;

        for (const file of req.files) {
            const url = await uploadToR2(basePath, file.buffer, file.originalname, file.mimetype);
            job[fieldName].push({
                file_url: url,
                status: 'Pending',
                uploaded_by: userId,
                uploaded_at: getCurrentDate()
            });
        }

        job.history.push({
            action: `${type === 'master' ? 'Master' : 'Content'} Proof`,
            description: `Uploaded ${type === 'master' ? 'master' : 'content'} proof`,
            user: userId,
            date: getCurrentDate()
        });

        job.updated_at = getCurrentDate();
        await job.save();

        await job.populate("created_by", "name");
        await job.populate("bom_id");
        await job.populate("enquiry_id");
        await job.populate("group_id");
        await job.populate("sample_order_id");
        await job.populate("history.user", "name");

        return res.status(200).json({ success: true, message: `${type === 'master' ? 'Master' : 'Content'} proof uploaded successfully`, data: formatDTPJob(job) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const approveRejectProof = async (req, res) => {
    try {
        const { id, fileId } = req.params;
        const { type, action, rejection_reason } = req.body;
        const userId = req.user?._id;

        const job = await dtpStudioModel.findById(id).populate("enquiry_id");
        if (!job) return res.status(404).json({ success: false, message: "Job not found" });

        if (job.is_on_hold) return res.status(400).json({ success: false, message: "Job is on hold. Unhold to perform actions." });

        const fieldName = type === 'master' ? 'master_template_files' : 'content_proofing_files';
        const fileIndex = job[fieldName].findIndex(f => f._id.toString() === fileId);
        if (fileIndex === -1) return res.status(404).json({ success: false, message: "File not found" });

        const user = await userModel.findById(userId).populate("role", "name").lean();
        const userName = user?.name || user?.username || "Internal User";
        const userRole = user?.role?.name || "Internal User";
        const nowDt = getCurrentDate();

        const fileObj = job[fieldName][fileIndex];
        fileObj.status = action;
        fileObj.action_by_type = "Internal User";
        fileObj.action_by_user = userId;
        fileObj.action_by_name = userName;
        fileObj.action_by_role = userRole;

        let historyDescription = "";
        if (action === 'Rejected') {
            fileObj.rejected_by = userId;
            fileObj.rejected_by_name = userName;
            fileObj.rejected_date_time = nowDt;
            fileObj.rejected_at = nowDt;
            fileObj.rejection_reason = rejection_reason || req.body.reason || "Proof rejected";
            fileObj.alteration_notes = "";

            // Reset approval fields
            fileObj.approved_by = undefined;
            fileObj.approved_by_name = undefined;
            fileObj.approved_date_time = undefined;
            fileObj.approved_at = undefined;

            historyDescription = `${userName} (${userRole}) Rejected ${type === 'master' ? 'master' : 'content'} proof. Reason: ${fileObj.rejection_reason}`;

            if (req.file) {
                const category = job.enquiry_id?.category || "uncategorized";
                const subcategory = job.enquiry_id?.subcategory || "unsubcategorized";
                const path = `${category}/${subcategory}/${job.job_no}/${job.sub_job_no}/dtp/rejections`;
                const url = await uploadToR2(path, req.file.buffer, req.file.originalname, req.file.mimetype);
                fileObj.rejection_reference_file = url;
            }
        } else if (action === 'Alteration') {
            const altNotes = req.body.alteration_notes || rejection_reason || req.body.reason || "Alteration requested";
            fileObj.alteration_notes = altNotes;
            fileObj.rejection_reason = altNotes; // Fallback compatibility
            fileObj.rejected_by = userId;
            fileObj.rejected_by_name = userName;
            fileObj.rejected_date_time = nowDt;
            fileObj.rejected_at = nowDt;

            // Reset approval fields
            fileObj.approved_by = undefined;
            fileObj.approved_by_name = undefined;
            fileObj.approved_date_time = undefined;
            fileObj.approved_at = undefined;

            historyDescription = `${userName} (${userRole}) Requested Alteration on ${type === 'master' ? 'master' : 'content'} proof. Notes: ${altNotes}`;

            if (req.file) {
                const category = job.enquiry_id?.category || "uncategorized";
                const subcategory = job.enquiry_id?.subcategory || "unsubcategorized";
                const path = `${category}/${subcategory}/${job.job_no}/${job.sub_job_no}/dtp/alterations`;
                const url = await uploadToR2(path, req.file.buffer, req.file.originalname, req.file.mimetype);
                fileObj.rejection_reference_file = url;
            }
        } else {
            fileObj.status = 'Approved';
            fileObj.approved_by = userId;
            fileObj.approved_by_name = userName;
            fileObj.approved_date_time = nowDt;
            fileObj.approved_at = nowDt;
            fileObj.rejection_reason = "";
            fileObj.alteration_notes = "";
            fileObj.rejection_reference_file = "";

            // Reset rejection fields
            fileObj.rejected_by = undefined;
            fileObj.rejected_by_name = undefined;
            fileObj.rejected_date_time = undefined;
            fileObj.rejected_at = undefined;

            historyDescription = `${userName} (${userRole}) Approved ${type === 'master' ? 'master' : 'content'} proof`;
        }

        job.history.push({
            action: `${type === 'master' ? 'Master' : 'Content'} Proof`,
            description: historyDescription,
            user: userId,
            date: nowDt
        });

        job.updated_at = nowDt;
        await job.save();

        await job.populate("created_by", "name");
        await job.populate("bom_id");
        await job.populate("enquiry_id");
        await job.populate("group_id");
        await job.populate("sample_order_id");
        await job.populate("history.user", "name");

        return res.status(200).json({ success: true, message: `${type === 'master' ? 'Master' : 'Content'} proof ${action.toLowerCase()} successfully`, data: formatDTPJob(job) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteProof = async (req, res) => {
    try {
        const { id, type, fileId } = req.params;
        const userId = req.user?._id;

        const job = await dtpStudioModel.findById(id).populate("enquiry_id");
        if (!job) return res.status(404).json({ success: false, message: "Job not found" });

        const fieldName = type === 'master' ? 'master_template_files' : 'content_proofing_files';
        const fileIndex = job[fieldName].findIndex(f => f._id.toString() === fileId);
        if (fileIndex === -1) return res.status(404).json({ success: false, message: "File not found" });

        const fileObj = job[fieldName][fileIndex];

        if (fileObj.file_url) {
            try {
                await deleteFromR2(fileObj.file_url);
            } catch (err) {
                console.error("Failed to delete from R2:", err);
            }
        }

        if (fileObj.rejection_reference_file) {
            try {
                await deleteFromR2(fileObj.rejection_reference_file);
            } catch (err) {
                console.error("Failed to delete ref from R2:", err);
            }
        }

        job[fieldName].pull({ _id: fileId });

        job.history.push({
            action: `${type === 'master' ? 'Master' : 'Content'} Proof Deleted`,
            description: `Deleted ${type === 'master' ? 'master' : 'content'} proof`,
            user: userId,
            date: getCurrentDate()
        });

        job.updated_at = getCurrentDate();
        await job.save();

        await job.populate("created_by", "name");
        await job.populate("bom_id");
        await job.populate("enquiry_id");
        await job.populate("group_id");
        await job.populate("sample_order_id");
        await job.populate("history.user", "name");

        return res.status(200).json({ success: true, message: "Proof deleted successfully", data: formatDTPJob(job) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const updateJobStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, history_action, history_description, update_sales_order } = req.body;
        const userId = req.user?._id;

        const job = await dtpStudioModel.findById(id);
        if (!job) return res.status(404).json({ success: false, message: "Job not found" });

        if (status) {
            if (status === 'Push to Floor') {
                const sections = job.job_sheet?.materialprocess || [];
                const finalPrepFiles = job.final_prep_files || [];

                const isComplete = sections.every(section => {
                    const prepData = finalPrepFiles.find(f => f.material_group_id === section.material_group_id);
                    const hasProduction = (prepData && ((prepData.production_files && prepData.production_files.length > 0) || prepData.production_file?.file_url));
                    const hasReference = (prepData && ((prepData.reference_images && prepData.reference_images.length > 0) || prepData.reference_image?.file_url));
                    return hasProduction && hasReference;
                });

                if (!isComplete) {
                    return res.status(400).json({
                        success: false,
                        message: "Incomplete Final Prep: Each section must have both a production file and a reference image."
                    });
                }
            }
            job.status = status;
        }

        if (job.is_on_hold) return res.status(400).json({ success: false, message: "Job is on hold. Unhold to perform actions." });

        if (history_action || history_description) {
            job.history.push({
                action: history_action || "Stage Updated",
                description: history_description || `Updated status to ${status}`,
                user: userId,
                date: getCurrentDate()
            });
        }

        // if (status === 'Push to Floor' || status === 'Shop Floor') {
        //     // Create Store Material Issue record
        //     await createStoreIssueFromDTPJob(job, userId);
        // }

        if (update_sales_order && job.sample_order_id) {
            const updatePayload = { status: "process" };
            if (status === 'Push to Floor' || status === 'Shop Floor') {
                updatePayload.is_pushed_shop_floor = true;
                updatePayload.pushed_to_shop_floor_datetime = getCurrentDate();
            }
            await salesorder.findByIdAndUpdate(job.sample_order_id, updatePayload);
        }

        job.updated_at = getCurrentDate();
        await job.save();

        await job.populate("created_by", "name");
        await job.populate("bom_id");
        await job.populate("enquiry_id");
        await job.populate("group_id");
        await job.populate("sample_order_id");
        await job.populate("history.user", "name");

        return res.status(200).json({
            success: true,
            message: "Job status updated successfully",
            data: formatDTPJob(job)
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const createJobGroup = async (req, res) => {
    try {
        const { folder_name, job_ids, assigned_to, assigned_to_name } = req.body;
        const userId = req.user?._id;

        if (!job_ids || job_ids.length === 0) {
            return res.status(400).json({ success: false, message: "No jobs selected" });
        }

        const jobs = await dtpStudioModel.find({ _id: { $in: job_ids } });
        if (jobs.length !== job_ids.length) return res.status(404).json({ success: false, message: "One or more jobs not found" });

        const firstJob = jobs[0];
        const allSame = jobs.every(j =>
            j.job_no === firstJob.job_no &&
            j.enquiry_id?.toString() === firstJob.enquiry_id?.toString()
        );

        if (!allSame) return res.status(400).json({ success: false, message: "Only sub-jobs of the same parent job can be grouped" });

        const allPending = jobs.every(j => j.status === 'Pending');
        if (!allPending) return res.status(400).json({ success: false, message: "Only jobs in 'NEW JOBS' section can be grouped" });

        const group = new dtpGroupModel({
            folder_name,
            job_no: firstJob.job_no,
            enquiry_id: firstJob.enquiry_id,
            assigned_to,
            assigned_to_name,
            jobs: job_ids,
            status: 'Assigned',
            created_by: userId
        });

        await group.save();

        await dtpStudioModel.updateMany(
            { _id: { $in: job_ids } },
            {
                $set: {
                    group_id: group._id,
                    status: 'Assigned',
                    assigned_to,
                    assigned_to_name
                },
                $push: {
                    history: {
                        action: "Grouped",
                        description: `Added to group/folder: ${folder_name}`,
                        user: userId,
                        date: getCurrentDate()
                    }
                }
            }
        );

        return res.status(200).json({ success: true, message: "Job group created successfully", data: group });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getJobGroupById = async (req, res) => {
    try {
        const { id } = req.params;
        const group = await dtpGroupModel.findById(id).populate({
            path: 'jobs',
            populate: [
                { path: 'bom_id' },
                { path: 'sample_order_id' }
            ]
        });

        if (!group) return res.status(404).json({ success: false, message: "Group not found" });

        // Format sub-jobs in group
        const groupObj = group.toObject();
        if (groupObj.jobs) {
            groupObj.jobs = groupObj.jobs.map(job => formatDTPJob(job));
        }

        return res.status(200).json({ success: true, data: groupObj });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const uploadFinalPrepFile = async (req, res) => {
    try {
        const { id } = req.params;
        const { materialGroupId, materialGroupName, fileType, preFlight } = req.body;
        const userId = req.user?._id;

        const job = await dtpStudioModel.findById(id).populate("enquiry_id");
        if (!job) return res.status(404).json({ success: false, message: "Job not found" });

        if (job.is_on_hold) return res.status(400).json({ success: false, message: "Job is on hold. Unhold to perform actions." });

        if (!req.files || req.files.length === 0) return res.status(400).json({ success: false, message: "No file uploaded" });

        // Helper to get original filename from R2 URL (format: uuid---filename.ext)
        const getFileNameFromUrl = (url) => {
            if (!url) return "";
            const parts = url.split("/");
            const lastPart = parts[parts.length - 1];
            return lastPart.includes("---") ? lastPart.split("---")[1] : lastPart;
        };

        // Collect all existing filenames across all sections
        const existingNames = new Set();
        (job.final_prep_files || []).forEach(section => {
            (section.production_files || []).forEach(f => {
                if (f.file_url) existingNames.add(getFileNameFromUrl(f.file_url).toLowerCase());
            });
            (section.reference_images || []).forEach(f => {
                if (f.file_url) existingNames.add(getFileNameFromUrl(f.file_url).toLowerCase());
            });
        });

        // Check if any of the new files already exist
        for (const file of req.files) {
            const newName = file.originalname.toLowerCase();
            if (existingNames.has(newName)) {
                return res.status(400).json({
                    success: false,
                    message: `File "${file.originalname}" already exists in one of the sections. Please rename it before uploading.`
                });
            }
        }

        let prepIndex = job.final_prep_files.findIndex(f => f.material_group_id === materialGroupId);
        if (prepIndex === -1) {
            job.final_prep_files.push({
                material_group_id: materialGroupId,
                material_group_name: materialGroupName,
                status: 'Pending',
                production_files: [],
                reference_images: []
            });
            prepIndex = job.final_prep_files.length - 1;
        }

        const prepEntry = job.final_prep_files[prepIndex];
        const fieldName = fileType === 'production' ? 'production_files' : 'reference_images';

        let preFlightData = {};
        if (preFlight) {
            try {
                preFlightData = JSON.parse(preFlight);
            } catch (e) {
                console.error("Error parsing preFlight JSON", e);
            }
        }

        const category = job.enquiry_id?.category || "uncategorized";
        const subcategory = job.enquiry_id?.subcategory || "unsubcategorized";

        for (const file of req.files) {
            const fullPath = `${category}/${subcategory}/${job.job_no}/${job.sub_job_no}/dtp/final_prep/${materialGroupId}/${fileType}`;
            const fileUrl = await uploadToR2(fullPath, file.buffer, file.originalname, file.mimetype);

            const fileObj = {
                file_url: fileUrl,
                uploaded_at: getCurrentDate(),
                uploaded_by: userId
            };

            if (fileType === 'production') fileObj.pre_flight_checked = preFlightData;
            prepEntry[fieldName].push(fileObj);
        }

        prepEntry.status = 'Pending';

        job.history.push({
            action: "Final Prep Upload",
            description: `Uploaded ${req.files.length} ${fileType} file(s) for ${materialGroupName}`,
            user: userId,
            date: getCurrentDate()
        });

        job.updated_at = getCurrentDate();
        await job.save();

        await job.populate("created_by", "name");
        await job.populate("bom_id");
        await job.populate("enquiry_id");
        await job.populate("group_id");
        await job.populate("sample_order_id");
        await job.populate("history.user", "name");

        return res.status(200).json({ success: true, message: "Files uploaded successfully", data: formatDTPJob(job) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteFinalPrepFile = async (req, res) => {
    try {
        const { id, materialGroupId, fileType, fileId } = req.params;
        const userId = req.user?._id;

        const job = await dtpStudioModel.findById(id);
        if (!job) return res.status(404).json({ success: false, message: "Job not found" });

        if (job.is_on_hold) return res.status(400).json({ success: false, message: "Job is on hold. Unhold to perform actions." });

        const prepIndex = job.final_prep_files.findIndex(f => f.material_group_id === materialGroupId);
        if (prepIndex === -1) return res.status(404).json({ success: false, message: "Entry not found" });

        const prepEntry = job.final_prep_files[prepIndex];
        const fieldName = fileType === 'production' ? 'production_files' : 'reference_images';

        if (!prepEntry[fieldName] || prepEntry[fieldName].length === 0) return res.status(404).json({ success: false, message: "No files found" });

        const fileIndex = prepEntry[fieldName].findIndex(f => f._id.toString() === fileId);
        if (fileIndex === -1) return res.status(404).json({ success: false, message: "File not found" });

        const fileToDelete = prepEntry[fieldName][fileIndex];

        if (fileToDelete.file_url) {
            try {
                await deleteFromR2(fileToDelete.file_url);
            } catch (err) {
                console.error("Failed to delete from R2:", err);
            }
        }

        prepEntry[fieldName].splice(fileIndex, 1);
        prepEntry.status = 'Pending';

        job.history.push({
            action: "Final Prep Delete",
            description: `Deleted ${fileType} file for ${prepEntry.material_group_name}`,
            user: userId,
            date: getCurrentDate()
        });

        job.updated_at = getCurrentDate();
        await job.save();

        await job.populate("created_by", "name");
        await job.populate("bom_id");
        await job.populate("enquiry_id");
        await job.populate("group_id");
        await job.populate("sample_order_id");
        await job.populate("history.user", "name");

        return res.status(200).json({ success: true, message: "File deleted successfully", data: formatDTPJob(job) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const holdUnholdDTPJob = async (req, res) => {
    try {
        const { id } = req.params;
        const { is_on_hold, hold_reason, delivery_date, job_completion_datetime } = req.body;
        const userId = req.user?._id;

        const job = await dtpStudioModel.findById(id);
        if (!job) return res.status(404).json({ success: false, message: "Job not found" });

        if (is_on_hold === true) {
            job.is_on_hold = true;
            const holdEntry = {
                reason: hold_reason,
                start_time: getCurrentDate(),
                hold_by: userId,
            };
            job.hold_history.push(holdEntry);

            job.history.push({
                action: "Job Put On Hold",
                description: `Reason: ${hold_reason}`,
                user: userId,
                date: getCurrentDate()
            });

            if (job.sample_order_id) {
                await salesorder.findByIdAndUpdate(job.sample_order_id, {
                    $set: { is_on_hold: true },
                    $push: { hold_history: holdEntry }
                });
            }

            // Sync with Shop Floor (Laser Studio)
            await shopFloorJobModel.updateMany(
                { sub_job_no: job.sub_job_no },
                {
                    $set: { is_hold: true, hold_remarks: hold_reason },
                    $push: {
                        escalation_hold_history: {
                            type: 'Hold',
                            remarks: hold_reason,
                            at: getCurrentDate(),
                            by: userId
                        }
                    }
                }
            );
        } else {
            job.is_on_hold = false;
            const history = job.hold_history || [];
            if (history.length > 0) {
                const lastHold = history[history.length - 1];
                if (!lastHold.end_time) {
                    const endTime = getCurrentDate();
                    lastHold.end_time = endTime;
                    lastHold.unhold_by = userId;

                    if (job.sample_order_id) {
                        const so = await salesorder.findById(job.sample_order_id);
                        if (so && so.hold_history && so.hold_history.length > 0) {
                            const soLastHold = so.hold_history[so.hold_history.length - 1];
                            if (!soLastHold.end_time) {
                                soLastHold.end_time = endTime;
                                soLastHold.unhold_by = userId;
                            }
                            so.is_on_hold = false;
                            await so.save();
                        }
                    }
                }
            }

            // Sync with Shop Floor (Laser Studio)
            await shopFloorJobModel.updateMany(
                { sub_job_no: job.sub_job_no },
                {
                    $set: { is_hold: false },
                    $push: {
                        escalation_hold_history: {
                            type: 'Resume',
                            remarks: "Job resumed from DTP Studio",
                            at: getCurrentDate(),
                            by: userId
                        }
                    }
                }
            );

            if (delivery_date) job.delivery_date = delivery_date;
            if (job_completion_datetime) job.job_completion_date = job_completion_datetime;

            if (delivery_date || job_completion_datetime) {
                const datesUpdates = {};
                if (delivery_date) datesUpdates.delivery_date = delivery_date;
                if (job_completion_datetime) datesUpdates.job_completion_datetime = job_completion_datetime;

                if (job.sample_order_id) {
                    await salesorder.findByIdAndUpdate(job.sample_order_id, { $set: datesUpdates });
                    const so = await salesorder.findById(job.sample_order_id);
                    if (so && so.sample_salesorder_id) {
                        await salesorderformModel.findByIdAndUpdate(so.sample_salesorder_id, { $set: datesUpdates });
                    }
                }
            }

            job.history.push({
                action: "Job Unhold",
                description: "Job resumed",
                user: userId,
                date: getCurrentDate()
            });
        }

        job.updated_at = getCurrentDate();
        await job.save();

        await job.populate("created_by", "name");
        await job.populate("bom_id");
        await job.populate("enquiry_id");
        await job.populate("group_id");
        await job.populate("sample_order_id");
        await job.populate("history.user", "name");

        return res.status(200).json({ success: true, message: is_on_hold ? "Job put on hold" : "Job unhold successfully", data: formatDTPJob(job) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const holdUnholdDTPGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const { is_on_hold, hold_reason } = req.body;
        const userId = req.user?._id;

        const group = await dtpGroupModel.findById(id);
        if (!group) return res.status(404).json({ success: false, message: "Group not found" });

        if (is_on_hold === true) {
            group.is_on_hold = true;
            const holdEntry = {
                reason: hold_reason,
                start_time: getCurrentDate(),
                hold_by: userId,
            };
            group.hold_history.push(holdEntry);

            const jobsToHold = await dtpStudioModel.find({ _id: { $in: group.jobs }, is_on_hold: false });
            for (const job of jobsToHold) {
                job.is_on_hold = true;
                job.hold_history.push({
                    reason: hold_reason || "Group put on hold",
                    start_time: getCurrentDate(),
                    hold_by: userId
                });
                job.history.push({
                    action: "Job Put On Hold",
                    description: `Group hold: ${hold_reason}`,
                    user: userId,
                    date: getCurrentDate()
                });
                await job.save();

                if (job.sample_order_id) {
                    await salesorder.findByIdAndUpdate(job.sample_order_id, {
                        $set: { is_on_hold: true },
                        $push: { hold_history: holdEntry }
                    });
                }
            }

            // Sync with Shop Floor (Laser Studio)
            const subJobNos = jobsToHold.map(j => j.sub_job_no).filter(Boolean);
            if (subJobNos.length > 0) {
                await shopFloorJobModel.updateMany(
                    { sub_job_no: { $in: subJobNos } },
                    {
                        $set: { is_hold: true, hold_remarks: hold_reason },
                        $push: {
                            escalation_hold_history: {
                                type: 'Hold',
                                remarks: `Group hold: ${hold_reason}`,
                                at: getCurrentDate(),
                                by: userId
                            }
                        }
                    }
                );
            }
        } else {
            group.is_on_hold = false;
            const history = group.hold_history || [];
            if (history.length > 0) {
                const lastHold = history[history.length - 1];
                if (!lastHold.end_time) {
                    lastHold.end_time = getCurrentDate();
                    lastHold.unhold_by = userId;
                }
            }

            const jobs = await dtpStudioModel.find({ _id: { $in: group.jobs }, is_on_hold: true });
            for (const job of jobs) {
                job.is_on_hold = false;
                const jHistory = job.hold_history || [];
                const endTime = getCurrentDate();
                if (jHistory.length > 0) {
                    const lastHold = jHistory[jHistory.length - 1];
                    if (!lastHold.end_time) {
                        lastHold.end_time = endTime;
                        lastHold.unhold_by = userId;
                    }
                }
                job.history.push({
                    action: "Job Unhold",
                    description: "Group unhold",
                    user: userId,
                    date: getCurrentDate()
                });
                await job.save();

                if (job.sample_order_id) {
                    const so = await salesorder.findById(job.sample_order_id);
                    if (so && so.hold_history && so.hold_history.length > 0) {
                        const soLastHold = so.hold_history[so.hold_history.length - 1];
                        if (!soLastHold.end_time) {
                            soLastHold.end_time = endTime;
                            soLastHold.unhold_by = userId;
                        }
                        so.is_on_hold = false;
                        await so.save();
                    }
                }
            }

            // Sync with Shop Floor (Laser Studio)
            const unholdSubJobNos = jobs.map(j => j.sub_job_no).filter(Boolean);
            if (unholdSubJobNos.length > 0) {
                await shopFloorJobModel.updateMany(
                    { sub_job_no: { $in: unholdSubJobNos } },
                    {
                        $set: { is_hold: false },
                        $push: {
                            escalation_hold_history: {
                                type: 'Resume',
                                remarks: "Group resumed from DTP Studio",
                                at: getCurrentDate(),
                                by: userId
                            }
                        }
                    }
                );
            }
        }

        await group.save();
        return res.status(200).json({ success: true, message: `Group ${is_on_hold ? 'put on hold' : 'unhold'} successfully`, data: group });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const updateFinalPrepSectionStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { materialGroupId, status, accountingQuantity, originalQuantity, type } = req.body;
        const userId = req.user?._id;

        const job = await dtpStudioModel.findById(id);
        if (!job) return res.status(404).json({ success: false, message: "Job not found" });

        let prepIndex = job.final_prep_files.findIndex(f => f.material_group_id === materialGroupId);

        if (type === 'accounting_update') {
            let entryName = '';
            if (prepIndex === -1) {
                const materialProcess = job.job_sheet?.materialprocess?.find(mp => mp.material_group_id === materialGroupId);
                if (!materialProcess) return res.status(404).json({ success: false, message: "Material Group not found in job sheet" });

                job.final_prep_files.push({
                    material_group_id: materialGroupId,
                    material_group_name: materialProcess.material_group_name,
                    status: 'Pending',
                    accounting_quantity: accountingQuantity,
                    original_quantity: originalQuantity,
                    production_files: [],
                    reference_images: []
                });
                entryName = materialProcess.material_group_name;
            } else {
                job.final_prep_files[prepIndex].accounting_quantity = accountingQuantity;
                job.final_prep_files[prepIndex].original_quantity = originalQuantity;
                entryName = job.final_prep_files[prepIndex].material_group_name;
            }

            job.history.push({
                action: "Accounting Quantity Updated",
                description: `Updated accounting quantity for ${entryName} to ${accountingQuantity}`,
                user: userId,
                date: getCurrentDate()
            });
        } else {
            const { processIndex, completedQty } = req.body;
            if (prepIndex === -1) return res.status(404).json({ success: false, message: "Entry not found" });
            const prepEntry = job.final_prep_files[prepIndex];

            if (processIndex) {
                const [mpIdx, procIdx] = processIndex.split('.').map(n => parseInt(n) - 1);
                const section = job.job_sheet?.materialprocess?.[mpIdx];
                const process = section?.processes?.[procIdx];

                if (process) {
                    process.status = status;
                    if (completedQty !== undefined) {
                        process.completed_qty = completedQty;
                    } else if (status === 'Completed') {
                        process.completed_qty = job.job_quantity || 0;
                    }

                    job.history.push({
                        action: "Process Status Updated",
                        description: `Process ${process.process_name} in ${prepEntry.material_group_name} marked as ${status}${status === 'Partially Completed' ? ` (Qty: ${completedQty})` : ''}`,
                        user: userId,
                        date: getCurrentDate()
                    });

                    const allProcessesCompleted = section.processes.every(p => p.status === 'Completed');
                    const anyProcessStarted = section.processes.some(p => p.status !== 'Pending');

                    if (allProcessesCompleted) {
                        prepEntry.status = 'Completed';
                        job.history.push({
                            action: "Section Status Updated",
                            description: `All processes in ${prepEntry.material_group_name} completed. Section marked as Completed.`,
                            user: userId,
                            date: getCurrentDate()
                        });
                    } else if (anyProcessStarted) {
                        prepEntry.status = 'In Progress';
                    } else {
                        prepEntry.status = 'Shop Floor';
                    }
                }
            } else {
                prepEntry.status = status;
                job.history.push({
                    action: "Section Status Updated",
                    description: `Section ${prepEntry.material_group_name} marked as ${status}`,
                    user: userId,
                    date: getCurrentDate()
                });
            }
        }

        job.updated_at = getCurrentDate();
        await job.save();

        await job.populate("created_by", "name");
        await job.populate("bom_id");
        await job.populate("enquiry_id");
        await job.populate("group_id");
        await job.populate("sample_order_id");
        await job.populate("history.user", "name");

        return res.status(200).json({ success: true, message: `Section status updated to ${status}`, data: formatDTPJob(job) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const updateAccountingDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const { trophies_count, blanks_count } = req.body;
        const userId = req.user?._id;

        const job = await dtpStudioModel.findById(id);
        if (!job) return res.status(404).json({ success: false, message: "Job not found" });

        if (!job.accounting_details) job.accounting_details = {};

        if (trophies_count !== undefined) job.accounting_details.trophies_count = trophies_count;
        if (blanks_count !== undefined) job.accounting_details.blanks_count = blanks_count;

        job.history.push({
            action: "Accounting Details Updated",
            description: `Updated Trophies: ${trophies_count}, Blanks: ${blanks_count}`,
            user: userId,
            date: getCurrentDate()
        });

        job.updated_at = getCurrentDate();
        await job.save();

        await job.populate("created_by", "name");
        await job.populate("bom_id");
        await job.populate("enquiry_id");
        await job.populate("group_id");
        await job.populate("sample_order_id");
        await job.populate("history.user", "name");

        return res.status(200).json({ success: true, message: "Accounting details updated", data: formatDTPJob(job) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const uploadAccountingFile = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?._id;
        const { file_type } = req.body;

        if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

        const job = await dtpStudioModel.findById(id).populate("enquiry_id");
        if (!job) return res.status(404).json({ success: false, message: "Job not found" });

        const category = job.enquiry_id?.category || "uncategorized";
        const subcategory = job.enquiry_id?.subcategory || "unsubcategorized";
        const path = `${category}/${subcategory}/${job.job_no}/${job.sub_job_no}/dtp/accounting_files`;

        const url = await uploadToR2(path, req.file.buffer, req.file.originalname, req.file.mimetype);

        if (!job.accounting_details) job.accounting_details = { processing_files: [] };
        if (!job.accounting_details.processing_files) job.accounting_details.processing_files = [];

        job.accounting_details.processing_files.push({
            file_url: url,
            original_name: req.file.originalname,
            file_type: file_type || 'unknown',
            uploaded_at: getCurrentDate(),
            uploaded_by: userId
        });

        job.history.push({
            action: "Accounting File Uploaded",
            description: `Uploaded ${file_type} file: ${req.file.originalname}`,
            user: userId,
            date: getCurrentDate()
        });

        job.updated_at = getCurrentDate();
        await job.save();

        await job.populate("created_by", "name");
        await job.populate("bom_id");
        await job.populate("enquiry_id");
        await job.populate("group_id");
        await job.populate("sample_order_id");
        await job.populate("history.user", "name");

        return res.status(200).json({ success: true, message: "File uploaded successfully", data: formatDTPJob(job) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteAccountingFile = async (req, res) => {
    try {
        const { id, fileId } = req.params;
        const userId = req.user?._id;

        const job = await dtpStudioModel.findById(id);
        if (!job) return res.status(404).json({ success: false, message: "Job not found" });

        if (!job.accounting_details || !job.accounting_details.processing_files) return res.status(404).json({ success: false, message: "No files found" });

        const fileIndex = job.accounting_details.processing_files.findIndex(f => f._id.toString() === fileId);
        if (fileIndex === -1) return res.status(404).json({ success: false, message: "File not found" });

        const fileToDelete = job.accounting_details.processing_files[fileIndex];

        if (fileToDelete.file_url) {
            try {
                await deleteFromR2(fileToDelete.file_url);
            } catch (err) {
                console.error("Failed to delete from R2:", err);
            }
        }

        job.accounting_details.processing_files.pull({ _id: fileId });

        job.history.push({
            action: "Accounting File Deleted",
            description: `Deleted accounting file: ${fileToDelete.original_name}`,
            user: userId,
            date: getCurrentDate()
        });

        await job.save();

        await job.populate("created_by", "name");
        await job.populate("bom_id");
        await job.populate("enquiry_id");
        await job.populate("group_id");
        await job.populate("sample_order_id");
        await job.populate("history.user", "name");

        return res.status(200).json({ success: true, message: "File deleted", data: formatDTPJob(job) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const rollbackToContentProofing = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?._id;

        const job = await dtpStudioModel.findById(id);
        if (!job) return res.status(404).json({ success: false, message: "Job not found" });

        if (job.is_on_hold) return res.status(400).json({ success: false, message: "Job is on hold. Unhold to perform actions." });

        // ── 1. Delete content_proofing_files from R2 ──────────────────────────────
        for (const file of (job.content_proofing_files || [])) {
            if (file.file_url) {
                try { await deleteFromR2(file.file_url); } catch (e) { console.error("R2 delete error (content proof):", e); }
            }
            if (file.rejection_reference_file) {
                try { await deleteFromR2(file.rejection_reference_file); } catch (e) { console.error("R2 delete error (rejection ref):", e); }
            }
        }
        job.content_proofing_files = [];

        // ── 2. Delete final_prep_files (production + reference) from R2 ──────────
        for (const prep of (job.final_prep_files || [])) {
            for (const f of (prep.production_files || [])) {
                if (f.file_url) {
                    try { await deleteFromR2(f.file_url); } catch (e) { console.error("R2 delete error (final prep production):", e); }
                }
            }
            for (const f of (prep.reference_images || [])) {
                if (f.file_url) {
                    try { await deleteFromR2(f.file_url); } catch (e) { console.error("R2 delete error (final prep reference):", e); }
                }
            }
            // Legacy single-file fields
            if (prep.production_file?.file_url) {
                try { await deleteFromR2(prep.production_file.file_url); } catch (e) { console.error("R2 delete error (legacy production):", e); }
            }
            if (prep.reference_image?.file_url) {
                try { await deleteFromR2(prep.reference_image.file_url); } catch (e) { console.error("R2 delete error (legacy reference):", e); }
            }
        }
        job.final_prep_files = [];

        // ── 3. Delete accounting processing files from R2 & reset details ──────
        for (const file of (job.accounting_details?.processing_files || [])) {
            if (file.file_url) {
                try { await deleteFromR2(file.file_url); } catch (e) { console.error("R2 delete error (accounting file):", e); }
            }
        }
        job.accounting_details = {
            trophies_count: undefined,
            blanks_count: undefined,
            processing_files: []
        };

        // ── 4. Update status & history ─────────────────────────────────────────
        const previousStatus = job.status;
        job.status = "Content Proofing";

        job.rework_history.push({
            from_stage: previousStatus,
            to_stage: "Content Proofing",
            reason: "Rolled back from Accounting Quantity to Content Proofing",
            marked_by: userId,
            date: getCurrentDate()
        });

        job.history.push({
            action: "Stage Rollback",
            description: "Rolled back to Content Proofing — content proofing files, final prep files and accounting data cleared",
            user: userId,
            date: getCurrentDate()
        });

        job.updated_at = getCurrentDate();
        await job.save();

        await job.populate("created_by", "name");
        await job.populate("bom_id");
        await job.populate("enquiry_id");
        await job.populate("group_id");
        await job.populate("sample_order_id");
        await job.populate("history.user", "name");

        return res.status(200).json({ success: true, message: "Job rolled back to Content Proofing", data: formatDTPJob(job) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const sendUrgencyPrompt = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?._id;

        const job = await dtpStudioModel.findById(id);
        if (!job) return res.status(404).json({ success: false, message: "Job not found" });

        job.urgency_sent = true;

        job.history.push({
            action: "Urgency Prompt Sent",
            description: "Urgency prompt sent to artist",
            user: userId,
            date: getCurrentDate()
        });

        await job.save();

        await job.populate("created_by", "name");
        await job.populate("bom_id");
        await job.populate("enquiry_id");
        await job.populate("group_id");
        await job.populate("sample_order_id");
        await job.populate("history.user", "name");

        return res.status(200).json({ success: true, message: "Urgency prompt sent", data: formatDTPJob(job) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
export const clearChangeFlags = async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.body; // 'qty', 'date', or 'both'

        const job = await dtpStudioModel.findById(id);
        if (!job) return res.status(404).json({ success: false, message: "Job not found" });

        if (type === 'qty') {
            job.is_qty_changed = false;
        } else if (type === 'date') {
            job.is_date_changed = false;
        } else {
            job.is_qty_changed = false;
            job.is_date_changed = false;
        }

        await job.save();

        return res.status(200).json({ success: true, message: "Flags cleared successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const updateDTPJobDetails = async (req, res) => {
    try {
        const { id } = req.params;
        let { job_quantity, delivery_date, job_completion_date, remark } = req.body;
        const userId = req.user?._id;

        if (!remark) {
            return res.status(400).json({ success: false, message: "Remark is required" });
        }

        const job = await dtpStudioModel.findById(id).populate("sample_order_id");
        if (!job) return res.status(404).json({ success: false, message: "Job not found" });

        // Capture OLD values before updating for RFQ baseline comparison later
        const oldQty = job.job_quantity;
        const oldDeliveryDate = job.delivery_date;
        const oldJobCompletionDate = job.job_completion_date;

        const historyDescription = [];
        let datePreponed = false;

        const parseDate = (d) => {
            if (!d) return null;
            const parsed = moment(d, ['DD-MM-YYYY', 'YYYY-MM-DD', 'YYYY-MM-DDTHH:mm:ss.SSSZ', 'YYYY-MM-DDTHH:mm', 'DD-MM-YYYY HH:mm:ss', 'DD-MM-YYYY HH:mm']);
            return parsed.isValid() ? parsed : null;
        };

        if (job_quantity !== undefined && Number(job_quantity) !== job.job_quantity) {
            const requestedQty = Number(job_quantity);
            const currentQty = job.job_quantity;

            historyDescription.push(`Quantity change to ${requestedQty} requested (Pending Approval)`);

            // Sandbox the quantity update inside the BOM's qty_update field
            if (job.bom_id) {
                const bomObj = await bomModel.findById(job.bom_id);
                if (bomObj) {
                    bomObj.qty_update = {
                        old_qty: currentQty,
                        new_qty: requestedQty,
                        status: "pending",
                        is_admin_approved: false,
                        is_client_approved: false,
                        requested_by: userId,
                        requested_at: getCurrentDate()
                    };
                    await bomObj.save();
                    console.log(`[DTPQtyInterception] Sandboxed quantity update to BOM qty_update: ${currentQty} -> ${requestedQty}`);

                    // Instantly trigger detailed recalculation and PDF draft generation synchronously
                    await triggerBOMRecalculationForPendingQty({ _id: bomObj._id }, requestedQty);
                }
            }

            // Mark quantity change pending approval on the sales order list model
            if (job.sample_order_id) {
                await salesorder.findByIdAndUpdate(job.sample_order_id._id || job.sample_order_id, {
                    $set: { is_qty_pending_approval: true }
                });
            }

            // Set job_quantity back to currentQty (old qty) to keep old value active on shop floor until approved
            job_quantity = Number(currentQty);
        }

        if (delivery_date !== undefined && delivery_date !== job.delivery_date) {
            const oldDate = parseDate(job.delivery_date);
            const newDate = parseDate(delivery_date);

            if (oldDate && newDate && newDate.isBefore(oldDate, 'day')) {
                datePreponed = true;
            }

            historyDescription.push(`Delivery date changed from ${job.delivery_date} to ${delivery_date}`);
            job.delivery_date = delivery_date;
        }

        if (job_completion_date !== undefined && job_completion_date !== job.job_completion_date) {
            const oldDate = parseDate(job.job_completion_date);
            const newDate = parseDate(job_completion_date);

            if (oldDate && newDate && newDate.isBefore(oldDate, 'day')) {
                datePreponed = true;
            }

            historyDescription.push(`Job completion date changed from ${job.job_completion_date} to ${job_completion_date}`);
            job.job_completion_date = job_completion_date;
        }

        if (datePreponed) {
            job.is_date_changed = true;
        }

        if (historyDescription.length === 0) {
            return res.status(400).json({ success: false, message: "No changes detected" });
        }

        job.history.push({
            action: "Details Updated",
            description: `${historyDescription.join(", ")}. Remark: ${remark}`,
            user: userId,
            date: getCurrentDate()
        });

        job.updated_at = getCurrentDate();
        await job.save();

        // Update Sample Order as well (Sync logic similar to salesOrderlistController)
        if (job.sample_order_id) {
            const sampleOrder = await salesorder.findById(job.sample_order_id._id || job.sample_order_id);
            if (sampleOrder) {
                const sampleOrderUpdates = {};
                const fieldChanges = [];

                if (job_quantity !== undefined) {
                    sampleOrderUpdates.job_quantity = Number(job_quantity);
                    fieldChanges.push({
                        field: "Quantity",
                        before: String(sampleOrder.job_quantity || "—"),
                        after: String(job_quantity)
                    });
                }
                if (delivery_date !== undefined) {
                    sampleOrderUpdates.delivery_date = delivery_date;
                    fieldChanges.push({
                        field: "Delivery Date",
                        before: sampleOrder.delivery_date || "—",
                        after: delivery_date
                    });
                }
                if (job_completion_date !== undefined) {
                    sampleOrderUpdates.job_completion_datetime = job_completion_date;
                    fieldChanges.push({
                        field: "Job Completion Date",
                        before: sampleOrder.job_completion_datetime || "—",
                        after: job_completion_date
                    });
                }

                sampleOrder.edit_remarks.push({
                    remark: `DTP Edit: ${remark}`,
                    edited_by: userId,
                    edited_at: getCurrentDate(),
                    field_changes: fieldChanges
                });

                Object.assign(sampleOrder, sampleOrderUpdates);
                sampleOrder.updated_at = getCurrentDate();
                await sampleOrder.save();

                // Sync to sales order form
                await salesorderformModel.findOneAndUpdate(
                    {
                        job_no: job.job_no,
                        sub_job_no: job.sub_job_no,
                        enquiry_id: job.enquiry_id
                    },
                    { $set: sampleOrderUpdates }
                );

                // Sync to BOM
                if (job.bom_id) {
                    await bomModel.findByIdAndUpdate(job.bom_id, {
                        $set: {
                            job_quantity: Number(job_quantity),
                            updated_at: getCurrentDate()
                        },
                        $push: {
                            updated_by: { user: userId, date: getCurrentDate() }
                        }
                    });
                }
            }
        }

        // Sync to Store Material Issue if it exists
        const storeIssue = await StoreMaterialIssue.findOne({ dtp_id: job._id });
        if (storeIssue) {
            if (job_quantity !== undefined && Number(job_quantity) !== storeIssue.job_quantity) {
                storeIssue.job_quantity = Number(job_quantity);
                storeIssue.is_qty_changed = true;
            }
            if (delivery_date !== undefined) {
                const oldDate = moment(storeIssue.delivery_date, "DD-MM-YYYY");
                const newDate = moment(delivery_date, "DD-MM-YYYY");
                if (newDate.isValid() && oldDate.isValid() && newDate.isBefore(oldDate, 'day')) {
                    storeIssue.is_date_changed = true;
                }
                storeIssue.delivery_date = delivery_date;
            }
            if (job_completion_date !== undefined) {
                const oldDate = moment(storeIssue.job_completion_date, "DD-MM-YYYY");
                const newDate = moment(job_completion_date, "DD-MM-YYYY");
                if (newDate.isValid() && oldDate.isValid() && newDate.isBefore(oldDate, 'day')) {
                    storeIssue.is_date_changed = true;
                }
                storeIssue.job_completion_date = job_completion_date;
            }
            storeIssue.updated_at = getCurrentDate();
            await storeIssue.save();
            console.log(`Synced Store Issue for DTP Job ${job.job_no}`);
        }

        // Sync to Shop Floor Jobs if they exist
        const shopFloorJobs = await shopFloorJobModel.find({ sub_job_no: job.sub_job_no });
        if (shopFloorJobs.length > 0) {
            for (const sfJob of shopFloorJobs) {
                let sfUpdated = false;

                if (job_quantity !== undefined) {
                    const newQty = Number(job_quantity);
                    if (sfJob.total_qty !== newQty) {
                        sfJob.total_qty = newQty;
                        sfJob.is_qty_changed = true;
                        sfUpdated = true;
                    }
                }

                if (delivery_date !== undefined || job_completion_date !== undefined) {
                    let dateChanged = false;
                    let datePreponed = false;

                    const parseStringToDate = (d) => {
                        if (!d) return null;
                        const parsed = moment(d, ['DD-MM-YYYY', 'YYYY-MM-DD', 'YYYY-MM-DDTHH:mm:ss.SSSZ', 'YYYY-MM-DDTHH:mm', 'DD-MM-YYYY HH:mm:ss', 'DD-MM-YYYY HH:mm']);
                        return parsed.isValid() ? parsed : null;
                    };

                    if (delivery_date && sfJob.delivery_date !== delivery_date) {
                        const oldDate = parseStringToDate(sfJob.delivery_date);
                        const newDate = parseStringToDate(delivery_date);
                        if (oldDate && newDate && newDate.isBefore(oldDate, 'day')) {
                            datePreponed = true;
                        }
                        sfJob.delivery_date = delivery_date;
                        dateChanged = true;
                    }

                    if (job_completion_date && sfJob.job_completion_date !== job_completion_date) {
                        const oldDate = parseStringToDate(sfJob.job_completion_date);
                        const newDate = parseStringToDate(job_completion_date);
                        if (oldDate && newDate && newDate.isBefore(oldDate, 'day')) {
                            datePreponed = true;
                        }
                        sfJob.job_completion_date = job_completion_date;
                        dateChanged = true;
                    }

                    if (dateChanged) {
                        if (datePreponed) {
                            sfJob.is_date_changed = true;
                        }
                        sfUpdated = true;
                    }
                }

                if (sfUpdated) {
                    sfJob.updated_at = getCurrentDate();
                    await sfJob.save();
                    console.log(`Synced Shop Floor Job ${sfJob._id} for ${job.sub_job_no}`);
                }
            }
        }

        // ── Sync to RFQ (Procurement Coordination) awards ─────────────────
        const rfqJobs = await rfqModel.find({
            jobNo: job.job_no,
            subJobNo: job.sub_job_no
        });

        if (rfqJobs.length > 0) {
            for (const rfq of rfqJobs) {
                let rfqUpdated = false;
                if (rfq.awards && Array.isArray(rfq.awards)) {
                    for (const award of rfq.awards) {
                        // 1. QTY ALERT: sync ONLY if actually changed in this update
                        if (job_quantity !== undefined && Number(job_quantity) !== oldQty) {
                            const newQty = Number(job_quantity);
                            // Strict separation: only compare with job baseline
                            if (award.currentJobQty === undefined) {
                                award.currentJobQty = Number(oldQty || 0);
                                rfqUpdated = true;
                            }

                            award.newQtyRequest = newQty;
                            if (newQty !== award.currentJobQty) {
                                award.pendingQtyChange = true;
                            } else {
                                award.pendingQtyChange = false;
                            }
                            rfqUpdated = true;
                        }

                        // 2. DATE ALERT: Alert ONLY if preponed relative to previous state
                        if (delivery_date !== undefined && delivery_date !== oldDeliveryDate) {
                            const newDate = moment(delivery_date, "DD-MM-YYYY");
                            const oldDate = moment(oldDeliveryDate, "DD-MM-YYYY");

                            if (newDate.isValid()) {
                                award.newDateRequest = newDate.toDate();
                                if (oldDate.isValid() && newDate.isBefore(oldDate, 'day')) {
                                    award.pendingDateChange = true;
                                } else {
                                    award.pendingDateChange = false;
                                }
                                rfqUpdated = true;
                            }
                        }

                        // 3. JOB COMPLETION ALERT: Alert ONLY if preponed relative to previous state
                        if (job_completion_date !== undefined && job_completion_date !== oldJobCompletionDate) {
                            const newCompDate = moment(job_completion_date, "DD-MM-YYYY");
                            const oldCompDate = moment(oldJobCompletionDate, "DD-MM-YYYY");

                            if (newCompDate.isValid()) {
                                award.newJobCompletionRequest = newCompDate.toDate();
                                if (oldCompDate.isValid() && newCompDate.isBefore(oldCompDate, 'day')) {
                                    award.pendingJobCompletionChange = true;
                                } else {
                                    award.pendingJobCompletionChange = false;
                                }
                                rfqUpdated = true;
                            }
                        }
                    }
                }
                if (rfqUpdated) {
                    rfq.markModified('awards');
                    await rfq.save();
                    console.log(`Synced RFQ Alerts from DTP Edit for Job ${job.job_no}`);
                }
            }
        }

        await job.populate("created_by", "name");
        await job.populate("bom_id");
        await job.populate("enquiry_id");
        await job.populate("group_id");
        await job.populate("sample_order_id");
        await job.populate("history.user", "name");

        return res.status(200).json({
            success: true,
            message: "Job details updated and synced successfully",
            data: formatDTPJob(job)
        });
    } catch (error) {
        console.error("updateDTPJobDetails error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
