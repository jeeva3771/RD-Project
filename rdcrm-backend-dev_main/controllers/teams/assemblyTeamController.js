import assemblyTeamModel from "../../models/teams/assemblyTeamModel.js";
import teamModel from "../../models/teams/teamModel.js";
import salesorderlistModel from "../../models/sales_orders/sales_order_list_Model.js";
import salesorderformModel from "../../models/sales_orders/sales_order_form_Model.js";
import enquiryModel from "../../models/enquiry/enquiryModel.js";
import { generateSignedUrl } from "../../helpers/r2helper.js";
import moment from "moment";
import shopFloorJobModel from "../../models/shopfloor/shopFloorJobModel.js";

// Helper Function to sync split quantities to the single Shop Floor Job Card
const syncShopFloorJobAllocations = async (sales_order_id, job_no, sub_job_no) => {
    try {
        // 1. Find all active assignments for this SO in Operation Planning
        const activeAssignments = await assemblyTeamModel.find({
            sales_order_id: sales_order_id,
            team_id: { $ne: null },
            is_active: true
        }).populate("team_id", "team_name");

        // 2. Prepare team_allocations array and assigned_shifts array
        const teamAllocations = [];
        const assignedShifts = [];

        activeAssignments.forEach(assignment => {
            if (assignment.team_id) {
                const tName = assignment.team_id.team_name;
                assignedShifts.push(tName);

                teamAllocations.push({
                    team_id: assignment.team_id._id,
                    team_name: tName,
                    allocated_qty: assignment.qty || 0,
                    completed_qty: 0 // Initialize at 0, operator logs it later
                });
            }
        });

        // 3. Update the exact "Assembly Labour" Job Card
        await shopFloorJobModel.findOneAndUpdate(
            {
                job_no: job_no,
                sub_job_no: sub_job_no,
                process_name: { $regex: /assembly/i } // Matches "Assembly", "Assemble", "Assembly Labour"
            },
            {
                $set: {
                    assigned_shifts: [...new Set(assignedShifts)], // Removes duplicates
                    team_allocations: teamAllocations
                }
            },
            { new: true }
        );
    } catch (error) {
        console.error("Error syncing shop floor job allocations:", error);
    }
};



/**
 * Assign an assembly team to an existing shop-floor job.
 * (The job record is now created during the initial "Push to Shopfloor")
 */
export const assignAssemblyTeamJob = async (req, res) => {
    try {
        const { production_assignments, sales_order_id } = req.body;
        const userId = req.user?._id;

        if (!production_assignments || !Array.isArray(production_assignments)) {
            return res.status(400).json({ success: false, message: "Invalid assignments data" });
        }

        const originalJob = await salesorderlistModel.findById(sales_order_id).lean();
        if (!originalJob) {
            return res.status(404).json({ success: false, message: "Original job not found" });
        }

        const sampleOrderForm = await salesorderformModel.findOne({ sample__order_id: originalJob._id }).lean();
        const enquiry = await enquiryModel.findById(originalJob.enquiry_id).lean();
        const referenceNo = enquiry?.reference_no || enquiry?.id || "";

        const productName = sampleOrderForm?.product_name || originalJob.product_name || "";
        const clientName = sampleOrderForm?.client_name || "";
        const currentMasterQty = sampleOrderForm?.job_quantity;
        const currentMasterCompDate = sampleOrderForm?.job_completion_datetime;

        const updatedJobs = [];

        // Find the placeholder record created on push
        let placeholders = await assemblyTeamModel.find({
            sales_order_id: originalJob._id,
            team_id: null
        }).sort({ createdAt: 1 });

        for (let i = 0; i < production_assignments.length; i++) {
            const item = production_assignments[i];

            if (i === 0 && placeholders.length > 0) {
                // Update the first placeholder
                const assemblyJob = placeholders[0];
                assemblyJob.team_id = item.team_id;
                assemblyJob.start_date_time = item.start_date_time;
                assemblyJob.end_date_time = item.end_date_time;
                assemblyJob.qty = item.allocated_qty;
                assemblyJob.assigned_by = userId;
                assemblyJob.status = 'pending';

                // Ensure metadata is present if missing from legacy placeholders
                if (!assemblyJob.client_name) assemblyJob.client_name = clientName;
                if (!assemblyJob.product_name) assemblyJob.product_name = productName;
                if (!assemblyJob.type) assemblyJob.type = originalJob.type;
                if (!assemblyJob.image) assemblyJob.image = originalJob.image;
                if (!assemblyJob.enquiry_id) assemblyJob.enquiry_id = originalJob.enquiry_id;
                if (!assemblyJob.reference_no) assemblyJob.reference_no = referenceNo;

                // Sync benchmarks to clear alerts upon assignment
                if (currentMasterQty !== undefined) assemblyJob.opQty = currentMasterQty;
                if (currentMasterCompDate) assemblyJob.opJobCompDate = currentMasterCompDate;

                await assemblyJob.save();
                updatedJobs.push(assemblyJob);
            } else {
                // Create new record for split assignments or if no placeholder found
                const newAssemblyJob = new assemblyTeamModel({
                    job_no: originalJob.job_no,
                    sub_job_no: originalJob.sub_job_no,
                    client_name: clientName,
                    product_name: productName,
                    type: originalJob.type,
                    image: originalJob.image,
                    qty: item.allocated_qty,
                    start_date_time: item.start_date_time,
                    end_date_time: item.end_date_time,
                    sales_order_id: originalJob._id,
                    enquiry_id: originalJob.enquiry_id,
                    reference_no: referenceNo,
                    team_id: item.team_id,
                    assigned_by: userId,
                    status: 'pending',
                    opQty: currentMasterQty,
                    opJobCompDate: currentMasterCompDate
                });
                await newAssemblyJob.save();
                updatedJobs.push(newAssemblyJob);
            }
        }

        // Remove any remaining unused placeholders for this SO (cleanup)
        if (placeholders.length > 1) {
            await assemblyTeamModel.deleteMany({ _id: { $in: placeholders.slice(1).map(p => p._id) } });
        }

        // --- SYNC TO SHOP FLOOR ---
        await syncShopFloorJobAllocations(sales_order_id, originalJob.job_no, originalJob.sub_job_no);

        return res.status(200).json({
            success: true,
            message: "Assembly team assigned successfully",
            data: updatedJobs
        });

    } catch (error) {
        console.error("Error in assignAssemblyTeamJob:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get all planned assembly team jobs (both assigned and unassigned)
 */
export const getAllAssemblyJobs = async (req, res) => {
    try {
        const { team_id, unassigned, filter, search } = req.query;
        let query = { is_active: true }; // Always exclude archived (is_active: false) records

        if (unassigned === 'true') {
            query.team_id = null;
        } else if (team_id) {
            query.team_id = team_id;
        }

        // Search logic (Inspired by Production Hub)
        if (search && search.trim()) {
            const searchTerm = search.trim();
            // 1. Search Enquiries (Reference No, Client Name, Product Name)
            const enquiryConditions = [
                { reference_no: { $regex: searchTerm, $options: "i" } },
                { referenceNo: { $regex: searchTerm, $options: "i" } },
                { reference_number: { $regex: searchTerm, $options: "i" } },
                { id: { $regex: searchTerm, $options: "i" } },
                { name: { $regex: searchTerm, $options: "i" } },
                { product_name: { $regex: searchTerm, $options: "i" } }
            ];

            // Handle numeric search for reference numbers if applicable
            if (!isNaN(searchTerm)) {
                const searchNum = Number(searchTerm);
                enquiryConditions.push({ reference_no: searchNum });
                enquiryConditions.push({ referenceNo: searchNum });
                enquiryConditions.push({ reference_number: searchNum });
            }

            const matchingEnquiries = await enquiryModel.find({ $or: enquiryConditions }).select('_id').lean();
            const enquiryIds = matchingEnquiries.map(e => e._id);

            // 2. Search Sales Orders (Job No, Sub Job No, or linked to matching Enquiry)
            const soConditions = [
                { job_no: { $regex: searchTerm, $options: "i" } },
                { sub_job_no: { $regex: searchTerm, $options: "i" } },
                { id: { $regex: searchTerm, $options: "i" } },
                { reference_no: { $regex: searchTerm, $options: "i" } },
                { enquiry_id: { $in: enquiryIds } }
            ];
            const matchingSOs = await salesorderlistModel.find({ $or: soConditions }).select('_id').lean();
            const soIds = matchingSOs.map(s => s._id);

            // 3. Add to main query
            query.$or = [
                { job_no: { $regex: searchTerm, $options: "i" } },
                { sub_job_no: { $regex: searchTerm, $options: "i" } },
                { client_name: { $regex: searchTerm, $options: "i" } },
                { product_name: { $regex: searchTerm, $options: "i" } },
                { reference_no: { $regex: searchTerm, $options: "i" } },
                { sales_order_id: { $in: soIds } },
                { enquiry_id: { $in: enquiryIds } }
            ];
        }

        // Pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const isUnassignedView = unassigned === 'true';

        let jobs;

        if (isUnassignedView) {
            // For unassigned jobs, fetch all active ones first to calculate global counts and filters
            const allUnassigned = await assemblyTeamModel.find(query)
                .populate("team_id", "team_name color")
                .populate("enquiry_id", "reference_no")
                .populate({
                    path: "sales_order_id",
                    select: "job_no sub_job_no client_name enquiry_id is_qty_changed is_date_changed old_quantity old_job_completion_date opQty opJobCompDate job_quantity job_completion_datetime",
                    populate: {
                        path: "enquiry_id",
                        select: "reference_no"
                    }
                })
                .populate("assigned_by", "username")
                .populate("reassign_history.reassigned_by", "username")
                .populate("reassign_history.from_team", "team_name")
                .populate("reassign_history.to_team", "team_name")
                .populate("reassign_history.split_details.team_id", "team_name")
                .populate("reassign_history.from_split_details.team_id", "team_name")
                .sort({ createdAt: -1 });

            // Calculate alerts for all unassigned jobs
            const allWithAlerts = await Promise.all(allUnassigned.map(async (job) => {
                const jobObj = job.toObject();

                // Fetch active assignments for this sales order (needed for modal Load All)
                const activeAssignments = await assemblyTeamModel.find({
                    sales_order_id: job.sales_order_id,
                    team_id: { $ne: null },
                    is_active: true
                }).populate("team_id", "team_name color").lean();
                jobObj.active_assignments = activeAssignments;

                if (jobObj.image) {
                    jobObj.image = await generateSignedUrl(jobObj.image);
                }

                const parent = await salesorderformModel.findOne({ sample__order_id: job.sales_order_id }).lean();
                if (parent) {
                    const currentJobQty = parent.job_quantity;
                    const currentJobCompDate = parent.job_completion_datetime;
                    const deadline = currentJobCompDate ? moment(currentJobCompDate, ['YYYY-MM-DDTHH:mm', 'DD-MM-YYYY', 'YYYY-MM-DD']).endOf('day') : null;

                    const allAssigned = activeAssignments;
                    const totalAssignedForSO = allAssigned.reduce((sum, a) => sum + (parseFloat(a.qty) || 0), 0);

                    const masterQty = Math.round(parseFloat(currentJobQty || 0));
                    const assignedSum = Math.round(totalAssignedForSO);
                    const benchmarkQty = Math.round(job.opQty ? parseFloat(job.opQty) : masterQty);

                    jobObj.is_qty_changed = masterQty !== benchmarkQty;
                    jobObj.master_qty = masterQty;
                    jobObj.total_assigned = assignedSum;
                    jobObj.current_job_completion_date = currentJobCompDate ? moment(currentJobCompDate, ['YYYY-MM-DDTHH:mm', 'DD-MM-YYYY', 'YYYY-MM-DD']).format('DD-MM-YYYY') : null;

                    if (deadline) {
                        const plannedEnd = job.opJobCompDate ? moment(job.opJobCompDate, ['YYYY-MM-DDTHH:mm', 'DD-MM-YYYY', 'YYYY-MM-DD']).endOf('day') : null;
                        if (plannedEnd && deadline.isAfter(plannedEnd)) {
                            job.opJobCompDate = currentJobCompDate;
                            await job.save();
                            jobObj.opJobCompDate = currentJobCompDate;
                        }
                        const benchmarkEnd = job.opJobCompDate ? moment(job.opJobCompDate, ['YYYY-MM-DDTHH:mm', 'DD-MM-YYYY', 'YYYY-MM-DD']).endOf('day') : null;
                        jobObj.is_date_changed = benchmarkEnd && deadline.isBefore(benchmarkEnd);
                        jobObj.is_overdue = deadline.isBefore(moment());
                    } else {
                        jobObj.is_date_changed = false;
                        jobObj.is_overdue = false;
                    }
                }
                return jobObj;
            }));

            // Apply filter
            let filteredJobs = allWithAlerts;
            if (filter === 'qty') {
                filteredJobs = allWithAlerts.filter(j => j.is_qty_changed);
            } else if (filter === 'date') {
                filteredJobs = allWithAlerts.filter(j => j.is_date_changed);
            } else if (filter === 'overdue') {
                filteredJobs = allWithAlerts.filter(j => j.is_overdue);
            }

            const totalCount = filteredJobs.length;
            const totalPages = Math.ceil(totalCount / limit) || 1;
            const paginatedJobs = filteredJobs.slice((page - 1) * limit, page * limit);

            // Global counts for UI chips
            const counts = {
                all: allWithAlerts.length,
                qty: allWithAlerts.filter(j => j.is_qty_changed).length,
                date: allWithAlerts.filter(j => j.is_date_changed).length,
                overdue: allWithAlerts.filter(j => j.is_overdue).length
            };

            return res.status(200).json({
                success: true,
                data: paginatedJobs,
                totalCount,
                totalPages,
                currentPage: page,
                counts
            });

        } else {
            // Lanes view (non-paginated for now)
            jobs = await assemblyTeamModel.find(query)
                .populate("team_id", "team_name color")
                .populate("enquiry_id", "reference_no")
                .populate({
                    path: "sales_order_id",
                    select: "job_no sub_job_no client_name enquiry_id is_qty_changed is_date_changed old_quantity old_job_completion_date opQty opJobCompDate job_quantity job_completion_datetime",
                    populate: {
                        path: "enquiry_id",
                        select: "reference_no"
                    }
                })
                .populate("assigned_by", "username")
                .populate("reassign_history.reassigned_by", "username")
                .populate("reassign_history.from_team", "team_name")
                .populate("reassign_history.to_team", "team_name")
                .populate("reassign_history.split_details.team_id", "team_name")
                .populate("reassign_history.from_split_details.team_id", "team_name")
                .sort({ createdAt: -1 });

            const jobObjs = await Promise.all(jobs.map(async (job) => {
                const jobObj = job.toObject();
                if (jobObj.image) {
                    jobObj.image = await generateSignedUrl(jobObj.image);
                }

                const parent = await salesorderformModel.findOne({ sample__order_id: job.sales_order_id }).lean();
                if (parent) {
                    const currentJobQty = parent.job_quantity;
                    const currentJobCompDate = parent.job_completion_datetime;
                    const deadline = currentJobCompDate ? moment(currentJobCompDate, ['YYYY-MM-DDTHH:mm', 'DD-MM-YYYY', 'YYYY-MM-DD']).endOf('day') : null;

                    const allAssigned = await assemblyTeamModel.find({
                        sales_order_id: job.sales_order_id,
                        team_id: { $ne: null },
                        is_active: true
                    }).populate("team_id", "team_name color").lean();
                    jobObj.active_assignments = allAssigned;
                    const totalAssignedForSO = allAssigned.reduce((sum, a) => sum + (parseFloat(a.qty) || 0), 0);

                    const masterQty = Math.round(parseFloat(currentJobQty || 0));
                    const assignedSum = Math.round(totalAssignedForSO);
                    const benchmarkQty = Math.round(job.opQty ? parseFloat(job.opQty) : masterQty);

                    jobObj.is_allocation_mismatch = assignedSum !== masterQty;
                    jobObj.is_order_qty_changed = masterQty !== benchmarkQty;
                    jobObj.is_qty_changed = jobObj.is_allocation_mismatch || jobObj.is_order_qty_changed;

                    jobObj.master_qty = masterQty;
                    jobObj.total_assigned = assignedSum;
                    jobObj.benchmark_qty = benchmarkQty;
                    jobObj.current_job_completion_date = currentJobCompDate ? moment(currentJobCompDate, ['YYYY-MM-DDTHH:mm', 'DD-MM-YYYY', 'YYYY-MM-DD']).format('DD-MM-YYYY') : null;

                    if (deadline) {
                        const plannedEnd = job.opJobCompDate ? moment(job.opJobCompDate, ['YYYY-MM-DDTHH:mm', 'DD-MM-YYYY', 'YYYY-MM-DD']).endOf('day') : null;
                        if (plannedEnd && deadline.isAfter(plannedEnd)) {
                            job.opJobCompDate = currentJobCompDate;
                            await job.save();
                            jobObj.opJobCompDate = currentJobCompDate;
                        }
                        const start = jobObj.start_date_time ? moment(jobObj.start_date_time) : null;
                        const end = jobObj.end_date_time ? moment(jobObj.end_date_time) : null;
                        const benchmarkEnd = job.opJobCompDate ? moment(job.opJobCompDate, ['YYYY-MM-DDTHH:mm', 'DD-MM-YYYY', 'YYYY-MM-DD']).endOf('day') : null;

                        const isBreaching = (start && start.isAfter(deadline)) || (end && end.isAfter(deadline));
                        const isOrderDatePreponed = benchmarkEnd && deadline.isBefore(benchmarkEnd);

                        jobObj.is_date_changed = isBreaching || isOrderDatePreponed;
                        jobObj.is_deadline_breached = isBreaching;
                        jobObj.is_overdue = deadline.isBefore(moment());
                    }
                }
                return jobObj;
            }));

            return res.status(200).json({
                success: true,
                data: jobObjs,
                totalCount: jobObjs.length,
                totalPages: 1,
                currentPage: 1
            });
        }
    } catch (error) {
        console.error("Error in getAllAssemblyJobs:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const reassignAssemblyJob = async (req, res) => {
    try {
        const { production_job_id, new_team_id, qty, start_date_time, end_date_time, note } = req.body;
        const userId = req.user?._id;

        const assemblyJob = await assemblyTeamModel.findById(production_job_id);
        if (!assemblyJob) {
            return res.status(404).json({ success: false, message: "Assembly job record not found" });
        }

        const oldTeamId = assemblyJob.team_id;
        const oldStartDateTime = assemblyJob.start_date_time;
        const oldEndDateTime = assemblyJob.end_date_time;
        const oldQty = assemblyJob.qty;

        const isSameTeam = oldTeamId && oldTeamId.toString() === new_team_id.toString();
        const isQtyChanged = qty !== undefined && Number(qty) !== Number(oldQty);

        // Simple date comparison
        const oldStartStr = oldStartDateTime ? moment(oldStartDateTime).format('YYYY-MM-DDTHH:mm') : null;
        const oldEndStr = oldEndDateTime ? moment(oldEndDateTime).format('YYYY-MM-DDTHH:mm') : null;
        const isDateChanged = (start_date_time && start_date_time !== oldStartStr) || (end_date_time && end_date_time !== oldEndStr);

        // System-generated action description
        const changeParts = [];
        if (!isSameTeam) changeParts.push("Team changed");
        if (isQtyChanged) changeParts.push(`Qty modified (${oldQty} → ${qty})`);
        if (isDateChanged) changeParts.push("Schedule updated");
        const actionText = changeParts.join(" & ") || "Details updated";

        // ── SERVER-SIDE QTY GUARD ──
        // Ensure new qty doesn't push total active assignments over the master order qty
        const masterForm = await salesorderformModel.findOne({ sample__order_id: assemblyJob.sales_order_id }).lean();
        const currentMasterQty = masterForm?.job_quantity;
        const currentMasterCompDate = masterForm?.job_completion_datetime;

        if (qty !== undefined && currentMasterQty !== null) {
            const masterQtyNum = Number(currentMasterQty);
            // Sum all OTHER active cards for this SO (exclude this card itself)
            const otherActive = await assemblyTeamModel.find({
                sales_order_id: assemblyJob.sales_order_id,
                team_id: { $ne: null },
                is_active: true,
                _id: { $ne: assemblyJob._id }
            });
            const otherSum = otherActive.reduce((s, a) => s + (Number(a.qty) || 0), 0);
            const newTotal = otherSum + Number(qty);

            // Enforce strict cap (skip when master qty is in drift — allow redistribution)
            if (!masterForm?.is_qty_changed && newTotal > masterQtyNum) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot assign ${qty} — other team(s) already hold ${otherSum}. Max allowed for this card: ${masterQtyNum - otherSum}.`
                });
            }
        }

        assemblyJob.reassign_history.push({
            from_team: oldTeamId,
            to_team: new_team_id,
            from_start_date_time: oldStartDateTime,
            from_end_date_time: oldEndDateTime,
            to_start_date_time: start_date_time || oldStartDateTime,
            to_end_date_time: end_date_time || oldEndDateTime,
            from_qty: oldQty,
            to_qty: qty || oldQty,
            reassigned_by: userId,
            date: new Date(),
            action: actionText,
            note: note || ""
        });

        // --- Not Head Alerts for Local Assignment Changes ---
        const isLocalQtyChanged = qty && Number(qty) !== oldQty;
        const isLocalStartChanged = start_date_time && new Date(start_date_time).getTime() !== new Date(oldStartDateTime).getTime();
        const isLocalEndChanged = end_date_time && new Date(end_date_time).getTime() !== new Date(oldEndDateTime).getTime();

        if (isSameTeam) {
            if (isLocalQtyChanged) {
                assemblyJob.isNotHeadQty = true;
                assemblyJob.prevNotHeadQty = oldQty;
            }
            if (isLocalStartChanged || isLocalEndChanged) {
                assemblyJob.isNotHeadDate = true;
                assemblyJob.prevNotHeadStart = oldStartDateTime;
                assemblyJob.prevNotHeadEnd = oldEndDateTime;
            }
        }

        assemblyJob.team_id = new_team_id;
        if (qty) assemblyJob.qty = qty;
        if (start_date_time) assemblyJob.start_date_time = start_date_time;
        if (end_date_time) assemblyJob.end_date_time = end_date_time;

        // Sync benchmarks for THIS specific team job only to clear its alert (Acknowledgement)
        if (currentMasterQty !== undefined) assemblyJob.opQty = currentMasterQty;
        if (currentMasterCompDate) assemblyJob.opJobCompDate = currentMasterCompDate;

        // Sync with parent Sales Order list's production_assignments
        const so = await salesorderlistModel.findById(assemblyJob.sales_order_id);
        if (so && so.production_assignments) {
            const index = so.production_assignments.findIndex(a =>
                (a.team_id?._id || a.team_id).toString() === oldTeamId.toString()
            );
            if (index !== -1) {
                so.production_assignments[index].team_id = new_team_id;
                if (qty) so.production_assignments[index].allocated_qty = qty;
                if (start_date_time) so.production_assignments[index].start_date_time = start_date_time;
                if (end_date_time) so.production_assignments[index].end_date_time = end_date_time;

                so.markModified('production_assignments');
                await so.save();
            }
        }

        await assemblyJob.save();

        // --- SYNC TO SHOP FLOOR ---
        // Fetch the SO details to get the job numbers for sync
        const soToSync = await salesorderlistModel.findById(assemblyJob.sales_order_id).lean();
        if (soToSync) {
            await syncShopFloorJobAllocations(assemblyJob.sales_order_id, soToSync.job_no, soToSync.sub_job_no);
        }

        return res.status(200).json({
            success: true,
            message: isSameTeam ? "Job schedule updated successfully" : "Job reassigned successfully",
            data: assemblyJob
        });

    } catch (error) {
        console.error("Error in reassignAssemblyJob:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Reallocate an assembly job — archives old record(s) and creates new ones.
 * - With source_job_id: archives ONLY that card (Edit mode split → preserves other splits)
 * - Without source_job_id: archives ALL active cards for the SO (full plan redesign)
 */
export const reallocateAssemblyJob = async (req, res) => {
    try {
        const { sales_order_id, production_assignments, source_job_id } = req.body;
        const userId = req.user?._id;

        if (!sales_order_id || !production_assignments || !Array.isArray(production_assignments)) {
            return res.status(400).json({ success: false, message: "Invalid payload" });
        }

        const originalJob = await salesorderlistModel.findById(sales_order_id).lean();
        if (!originalJob) return res.status(404).json({ success: false, message: "Sales order not found" });

        const masterForm = await salesorderformModel.findOne({ sample__order_id: sales_order_id }).lean();
        const currentMasterQty = masterForm?.job_quantity;
        const currentMasterCompDate = masterForm?.job_completion_datetime;

        // Determine which records to archive
        let jobsToArchive = [];
        if (source_job_id) {
            // Edit mode: archive only the specific card being split/replaced
            const sourceJob = await assemblyTeamModel.findById(source_job_id);
            if (!sourceJob) return res.status(404).json({ success: false, message: "Source job not found" });
            jobsToArchive = [sourceJob];
        } else {
            // Full redesign: archive ALL currently active cards for this SO
            jobsToArchive = await assemblyTeamModel.find({
                sales_order_id,
                team_id: { $ne: null },
                is_active: true
            });
        }

        // Consolidate and deduplicate the history from all cards being archived
        // Use date+action as dedup key (Mongoose generates unique _id per subdoc copy, so _id won't match)
        const historyMap = new Map();
        jobsToArchive.forEach(j => {
            (j.reassign_history || []).forEach(h => {
                const hObj = h.toObject ? h.toObject() : h;
                console.log(hObj)
                const key = `${new Date(hObj.date).getTime()}_${hObj.action || ''}`;
                if (!historyMap.has(key)) {
                    historyMap.set(key, hObj);
                }
            });
        });
        const consolidatedHistory = Array.from(historyMap.values()).sort((a, b) => new Date(a.date) - new Date(b.date));

        // Fetch team names for the action message
        const teamIds = production_assignments.map(a => a.team_id).filter(Boolean);
        const teamDocs = await teamModel.find({ _id: { $in: teamIds } }, 'team_name').lean();
        const teamNameMap = Object.fromEntries(teamDocs.map(t => [t._id.toString(), t.team_name]));
        const teamNamesStr = teamIds.map(id => teamNameMap[id.toString()] || id).join(', ');
        let actionLabel = `Reallocated to ${production_assignments.length} team(s): ${teamNamesStr}`;
        if (jobsToArchive.length === 1 && production_assignments.length === 1 && jobsToArchive[0].team_id?.toString() === production_assignments[0].team_id?.toString()) {
            actionLabel = "Updated";
        }

        // Build ONE consolidated history entry capturing ALL source teams
        const historyEntry = {
            from_team: jobsToArchive.length === 1 ? jobsToArchive[0].team_id : null,
            from_start_date_time: jobsToArchive.length === 1 ? jobsToArchive[0].start_date_time : null,
            from_end_date_time: jobsToArchive.length === 1 ? jobsToArchive[0].end_date_time : null,
            to_team: production_assignments.length === 1 ? production_assignments[0]?.team_id : null,
            to_start_date_time: production_assignments[0]?.start_date_time || null,
            to_end_date_time: production_assignments[0]?.end_date_time || null,
            from_qty: jobsToArchive.reduce((s, a) => s + (Number(a.qty) || 0), 0),
            to_qty: production_assignments.reduce((s, a) => s + (Number(a.allocated_qty) || 0), 0),
            from_split_details: jobsToArchive.map(a => ({
                team_id: a.team_id,
                qty: a.qty,
                start_date_time: a.start_date_time,
                end_date_time: a.end_date_time
            })),
            split_details: production_assignments.map(a => ({
                team_id: a.team_id,
                qty: a.allocated_qty,
                start_date_time: a.start_date_time,
                end_date_time: a.end_date_time
            })),
            reassigned_by: userId,
            date: new Date(),
            action: actionLabel,
            note: ""
        };

        // Archive old records (soft delete)
        for (const old of jobsToArchive) {
            old.is_active = false;
            await old.save();
        }

        // Create new active records — each carries full consolidated history + this reallocation entries
        const newJobs = [];
        for (const item of production_assignments) {
            // Find if this team was already assigned to this job before reallocation
            const previousAssignment = jobsToArchive.find(j =>
                (j.team_id?._id || j.team_id).toString() === (item.team_id?._id || item.team_id).toString()
            );

            let isNotHeadQty = false;
            let isNotHeadDate = false;
            let prevNotHeadQty = undefined;
            let prevNotHeadStart = undefined;
            let prevNotHeadEnd = undefined;

            if (previousAssignment) {
                const oldQtyVal = Number(previousAssignment.qty || 0);
                const newQtyVal = Number(item.allocated_qty || 0);
                const oldStartVal = previousAssignment.start_date_time ? new Date(previousAssignment.start_date_time).getTime() : 0;
                const newStartVal = item.start_date_time ? new Date(item.start_date_time).getTime() : 0;
                const oldEndVal = previousAssignment.end_date_time ? new Date(previousAssignment.end_date_time).getTime() : 0;
                const newEndVal = item.end_date_time ? new Date(item.end_date_time).getTime() : 0;

                if (oldQtyVal !== newQtyVal) {
                    isNotHeadQty = true;
                    prevNotHeadQty = oldQtyVal;
                }
                if (oldStartVal !== newStartVal || oldEndVal !== newEndVal) {
                    isNotHeadDate = true;
                    prevNotHeadStart = previousAssignment.start_date_time;
                    prevNotHeadEnd = previousAssignment.end_date_time;
                }
            }

            const newJob = new assemblyTeamModel({
                job_no: originalJob.job_no,
                sub_job_no: originalJob.sub_job_no,
                client_name: masterForm?.client_name || originalJob.client_name || "",
                product_name: masterForm?.product_name || originalJob.product_name || "",
                type: originalJob.type,
                image: originalJob.image,
                qty: item.allocated_qty,
                start_date_time: item.start_date_time,
                end_date_time: item.end_date_time,
                sales_order_id,
                enquiry_id: originalJob.enquiry_id,
                team_id: item.team_id,
                assigned_by: userId,
                status: "pending",
                is_active: true,
                opQty: currentMasterQty,
                opJobCompDate: currentMasterCompDate,
                isNotHeadQty,
                isNotHeadDate,
                prevNotHeadQty,
                prevNotHeadStart,
                prevNotHeadEnd,
                reassign_history: [...consolidatedHistory, historyEntry]
            });
            await newJob.save();
            newJobs.push(newJob);
        }

        // --- SYNC TO SHOP FLOOR ---
        await syncShopFloorJobAllocations(sales_order_id, originalJob.job_no, originalJob.sub_job_no);

        return res.status(200).json({
            success: true,
            message: "Job reallocated successfully",
            data: newJobs
        });

    } catch (error) {
        console.error("Error in reallocateAssemblyJob:", error);
        return res.status(500).json({ success: false, message: error.message || "Reallocation failed" });
    }
};

/**
 * Acknowledge a date change alert (Manual Sync)
 * Sets the benchmark date to the current master date to clear the alert.
 */
export const acknowledgeDateChange = async (req, res) => {
    try {
        const { assembly_job_id } = req.body;
        const job = await assemblyTeamModel.findById(assembly_job_id);
        if (!job) return res.status(404).json({ success: false, message: "Job not found" });

        const masterForm = await salesorderformModel.findOne({ sample__order_id: job.sales_order_id }).lean();
        if (masterForm && masterForm.job_completion_datetime) {
            const currentMasterDate = masterForm.job_completion_datetime;
            const prevDate = job.opJobCompDate;

            // 1. Generate localized 'Not Head' alerts ONLY for assigned teams that were actually outdated
            // (If a team was newly assigned after the change, their opJobCompDate matches currentMasterDate and this skips them)
            if (job.team_id) {
                await assemblyTeamModel.updateMany(
                    {
                        sales_order_id: job.sales_order_id,
                        team_id: { $ne: null },
                        opJobCompDate: { $ne: currentMasterDate }
                    },
                    { $set: { isNotHeadDate: true, prevNotHeadDate: prevDate, opJobCompDate: currentMasterDate } }
                );
            }

            // 2. Sync benchmark for ALL records to clear master alerts (including unassigned and already-synced ones)
            await assemblyTeamModel.updateMany(
                { sales_order_id: job.sales_order_id },
                { $set: { opJobCompDate: currentMasterDate } }
            );
        }

        return res.status(200).json({
            success: true,
            message: "Date change acknowledged successfully"
        });
    } catch (error) {
        console.error("Error in acknowledgeDateChange:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Acknowledge a quantity change alert (Manual Sync)
 * Sets the benchmark quantity to the current master quantity to clear the alert.
 */
export const acknowledgeQtyChange = async (req, res) => {
    try {
        const { assembly_job_id } = req.body;
        const job = await assemblyTeamModel.findById(assembly_job_id);
        if (!job) return res.status(404).json({ success: false, message: "Job not found" });

        const masterForm = await salesorderformModel.findOne({ sample__order_id: job.sales_order_id }).lean();
        if (masterForm && masterForm.job_quantity !== undefined) {
            const currentMasterQty = parseFloat(masterForm.job_quantity);

            // Check if this job is assigned to multiple teams (Split Job) — active records only
            const allAssigned = await assemblyTeamModel.find({
                sales_order_id: job.sales_order_id,
                team_id: { $ne: null },
                is_active: true
            });
            const isSplit = allAssigned.length > 1;

            if (!isSplit) {
                const prevQty = job.opQty;
                // 1. Generate localized 'Not Head' alerts ONLY for assigned teams that were actually outdated
                if (job.team_id) {
                    await assemblyTeamModel.updateMany(
                        {
                            sales_order_id: job.sales_order_id,
                            team_id: { $ne: null },
                            opQty: { $ne: currentMasterQty }
                        },
                        { $set: { isNotHeadQty: true, prevNotHeadQty: prevQty, opQty: currentMasterQty, qty: currentMasterQty } }
                    );
                }

                // 2. Sync benchmark for everyone else
                await assemblyTeamModel.updateMany(
                    { sales_order_id: job.sales_order_id },
                    { $set: { opQty: currentMasterQty, qty: currentMasterQty } }
                );
            } else {
                const prevQty = job.opQty;
                // 1. Generate localized 'Not Head' alerts ONLY for assigned teams that were actually outdated
                if (job.team_id) {
                    await assemblyTeamModel.updateMany(
                        {
                            sales_order_id: job.sales_order_id,
                            team_id: { $ne: null },
                            opQty: { $ne: currentMasterQty }
                        },
                        { $set: { isNotHeadQty: true, prevNotHeadQty: prevQty, opQty: currentMasterQty } }
                    );
                }

                // 2. Sync benchmark for everyone else
                await assemblyTeamModel.updateMany(
                    { sales_order_id: job.sales_order_id },
                    { $set: { opQty: currentMasterQty } }
                );
            }
        }

        return res.status(200).json({
            success: true,
            message: "Quantity change acknowledged successfully"
        });
    } catch (error) {
        console.error("Error in acknowledgeQtyChange:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Acknowledge an alert as a regular team member (Not Head)
 * Clears the isNotHeadQty or isNotHeadDate flags.
 */
export const acknowledgeNotHeadAlert = async (req, res) => {
    try {
        const { assembly_job_id, type } = req.body; // type: 'qty' or 'date'
        const job = await assemblyTeamModel.findById(assembly_job_id);
        if (!job) return res.status(404).json({ success: false, message: "Job not found" });

        if (type === 'qty') {
            job.isNotHeadQty = false;
        } else if (type === 'date') {
            job.isNotHeadDate = false;
        } else {
            job.isNotHeadQty = false;
            job.isNotHeadDate = false;
        }

        await job.save();

        return res.status(200).json({
            success: true,
            message: "Alert acknowledged"
        });
    } catch (error) {
        console.error("Error in acknowledgeNotHeadAlert:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};