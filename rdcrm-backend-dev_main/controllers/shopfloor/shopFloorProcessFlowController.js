import ShopFloorProcessFlow from "../../models/shopfloor/shopFloorProcessFlowModel.js";
import shopFloorJobModel from "../../models/shopfloor/shopFloorJobModel.js";
import ScrapDisposal from "../../models/shopfloor/scrapDisposalModel.js";
import ShopFloorRejectedMaterial from "../../models/shopfloor/shopFloorRejectedMaterialModel.js";
import { uploadToR2, generateSignedUrl } from "../../helpers/r2helper.js";
import { verifyJobCompletion, propagateSampleRequirement } from "../../helpers/shopFloorHelper.js";
import readyJobModel from "../../models/shopfloor/shopFloorReadyJobModel.js";
import mongoose from "mongoose";
import { updateGroupProgress, automateNextProcessInward } from "./shopFloorController.js";
import bomModel from "../../models/bom/bomModel.js";
import dtpStudioModel from "../../models/dtp_studio/dtpStudioModel.js";
import salesorderlistModel from "../../models/sales_orders/sales_order_list_Model.js";
import salesorderformModel from "../../models/sales_orders/sales_order_form_Model.js";
import { transporter, generateEmailTemplateForSampleApproval } from "../../helpers/mail.js";


// Self-healing helper to find a process flow document, resolving any stale group_id references
const findFlowDocument = async (shopfloor_job_id, group_id) => {
    if (!shopfloor_job_id || !group_id) return null;

    // 1. Try finding by exact match
    let flow = await ShopFloorProcessFlow.findOne({ shopfloor_job_id, group_id });
    if (flow) return flow;

    // 2. Try finding COMBINED flow
    flow = await ShopFloorProcessFlow.findOne({ shopfloor_job_id, group_id: 'COMBINED' });
    if (flow) return flow;

    // 3. If not found, look up the job to map index
    const job = await shopFloorJobModel.findById(shopfloor_job_id);
    if (!job) return null;

    const mgIndex = (job.material_groups || []).findIndex(g => String(g._id) === String(group_id) || String(g.group_id) === String(group_id));

    // Fetch all existing flows for this job
    const flows = await ShopFloorProcessFlow.find({ shopfloor_job_id });
    if (flows.length === 0) return null;

    // If there is only 1 group and 1 flow, match them
    if ((job.material_groups || []).length === 1 && flows.length === 1) {
        flow = flows[0];
    } else {
        // Match by index: sort flows by creation date and map to the group's index in the job
        const sortedFlows = [...flows].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        if (mgIndex >= 0 && mgIndex < sortedFlows.length) {
            flow = sortedFlows[mgIndex];
        }
    }

    if (flow) {
        return flow;
    }

    return null;
};

// Reusable helper to synchronize a job's progress and completion status
export const syncJobProgressAndCompletion = async (shopfloor_job_id, group_id, flow, retryCount = 0) => {
    try {
        const job = await shopFloorJobModel.findById(shopfloor_job_id);
        if (job && job.material_groups) {
            let groupsToUpdate = [];
            if (group_id === 'COMBINED') {
                groupsToUpdate = job.material_groups;
            } else {
                const mg = job.material_groups.find(mg => String(mg._id || mg.group_id) === String(group_id));
                if (mg) groupsToUpdate.push(mg);
            }

            if (groupsToUpdate.length > 0) {
                // Centralized progress calculation logic
                for (const group of groupsToUpdate) {
                    await updateGroupProgress(group, shopfloor_job_id, group_id === 'COMBINED' ? group.group_id : group_id, group_id === 'COMBINED' ? flow : undefined);
                }

                if (job.material_groups && job.material_groups.length > 0) {
                    const totalProgress = job.material_groups.reduce((acc, mg) => acc + (mg.progress || 0), 0);
                    job.progress = Math.round(totalProgress / job.material_groups.length);
                }

                const { is_completed, details } = await verifyJobCompletion(job);
                if (details && details.length > 0) {
                    details.forEach(detail => {
                        const mg = job.material_groups.find(g => 
                            String(g.group_id) === String(detail.group_id) || 
                            String(g._id) === String(detail.group_id)
                        );
                        if (mg) {
                            const mgStarted = (mg.assigned_shifts && mg.assigned_shifts.length > 0) || 
                                              (mg.process_history && mg.process_history.length > 0) || 
                                              (mg.progress > 0);
                            mg.status = detail.is_completed ? 'Completed' : (mgStarted ? 'In Progress' : 'Pending');
                        }
                    });
                }
                const hasStarted = (job.assigned_shifts && job.assigned_shifts.length > 0) || 
                                   (job.material_groups && job.material_groups.some(g => g.status === 'In Progress' || g.status === 'Completed' || (g.process_history && g.process_history.length > 0) || (g.progress > 0)));
                const targetStatus = is_completed ? 'Completed' : (hasStarted ? 'In Progress' : 'Pending');
                if (job.status !== targetStatus) {
                    job.status = targetStatus;
                    job.completed_at = is_completed ? new Date().toISOString() : undefined;
                }

                job.markModified('material_groups');
                await job.save();
                console.log(`[Job Progress Sync] Re-synced job ${shopfloor_job_id} group ${group_id} progress to ${job.progress}%`);
            }
        }
    } catch (err) {
        if (err.name === 'VersionError' && retryCount < 3) {
            console.log(`[Job Progress Sync] Version conflict for job ${shopfloor_job_id}. Retrying... (${retryCount + 1})`);
            return syncJobProgressAndCompletion(shopfloor_job_id, group_id, flow, retryCount + 1);
        }
        console.error("[Job Progress Sync] Error syncing job progress:", err);
    }
};

// Helper to format process flow and generate signed urls for sample images
const formatProcessFlow = (flow) => {
    if (!flow) return flow;
    const flowObj = flow.toObject ? flow.toObject() : flow;

    // Handle root level sample_cycles
    if (flowObj.sample_cycles && Array.isArray(flowObj.sample_cycles)) {
        flowObj.sample_cycles = flowObj.sample_cycles.map(cycle => {
            if (cycle.sample_image) {
                try {
                    cycle.sample_image = generateSignedUrl(cycle.sample_image);
                } catch (e) {
                    console.error("Failed to generate signed url for sample_image:", e);
                }
            }
            return cycle;
        });
    }

    // Handle session_state level sample_cycles
    if (flowObj.session_state?.sample_cycles && Array.isArray(flowObj.session_state.sample_cycles)) {
        flowObj.session_state.sample_cycles = flowObj.session_state.sample_cycles.map(cycle => {
            if (cycle.sample_image) {
                try {
                    cycle.sample_image = generateSignedUrl(cycle.sample_image);
                } catch (e) {
                    console.error("Failed to generate signed url for sample_image in session_state:", e);
                }
            }
            return cycle;
        });
    }

    return flowObj;
};

// Start a new sample cycle
export const startSampleCycle = async (req, res) => {
    try {
        const { job_no, sub_job_no, category, subcategory, shopfloor_job_id, store_material_issue_id, group_id, sample_qty, started_by, started_by_name } = req.body;

        let flow = await findFlowDocument(shopfloor_job_id, group_id);

        if (!flow) {
            flow = new ShopFloorProcessFlow({
                job_no,
                sub_job_no,
                category,
                subcategory,
                shopfloor_job_id,
                store_material_issue_id,
                group_id,
                sample_cycles: []
            });
        }

        if (!flow.sample_cycles) {
            flow.sample_cycles = [];
        }

        if (!flow.session_state) {
            flow.session_state = {};
        }

        if (!flow.session_state.sample_cycles) {
            flow.session_state.sample_cycles = [];
        }

        const cycle_number = Math.max(flow.sample_cycles.length, flow.session_state.sample_cycles.length) + 1;
        const newCycle = {
            cycle_number,
            start_time: new Date().toISOString(),
            started_by,
            started_by_name,
            sample_qty,
            status: 'Running'
        };

        flow.sample_cycles.push(newCycle);
        flow.session_state.sample_cycles.push(newCycle);

        if (!flow.session_state.runningCycles || typeof flow.session_state.runningCycles !== 'object') {
            flow.session_state.runningCycles = {};
        }
        flow.session_state.runningCycles[group_id] = {
            status: 'RUNNING',
            startTime: new Date().toISOString(),
            ups: sample_qty,
            cyclesDone: 0
        };

        if (flow.bom_sample_status === 'SAMPLE_REJECTED_INTERNAL' || flow.bom_sample_status === 'REJECTED_BY_SALES') {
            flow.bom_sample_status = 'IN_SAMPLE_PIPELINE';
            const targetSubJobNo = flow.sub_job_no;
            if (targetSubJobNo) {
                await ShopFloorProcessFlow.updateMany(
                    { sub_job_no: targetSubJobNo },
                    { $set: { bom_sample_status: 'IN_SAMPLE_PIPELINE' } }
                );
                await shopFloorJobModel.updateMany(
                    { sub_job_no: targetSubJobNo },
                    { $set: { bom_sample_status: 'IN_SAMPLE_PIPELINE' } }
                );
            } else {
                await shopFloorJobModel.findByIdAndUpdate(
                    shopfloor_job_id,
                    { $set: { bom_sample_status: 'IN_SAMPLE_PIPELINE' } }
                );
            }
        }

        flow.markModified('session_state');
        await flow.save();

        const job = await shopFloorJobModel.findById(shopfloor_job_id);
        if (job) {
            const mgForPropagate = job.material_groups?.find(g => String(g._id) === String(group_id) || String(g.group_id) === String(group_id));
            await propagateSampleRequirement(job, group_id, mgForPropagate?.process_index || null);
        }

        res.status(201).json({ success: true, message: "Sample cycle started", flow: formatProcessFlow(flow) });
    } catch (error) {
        console.error("Start Sample Cycle Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Complete a sample cycle
export const completeSampleCycle = async (req, res) => {
    try {
        const { shopfloor_job_id, group_id, good_qty, bad_qty, duration } = req.body;

        let flow = await findFlowDocument(shopfloor_job_id, group_id);
        if (!flow) return res.status(404).json({ success: false, message: "Flow not found" });

        if (!flow.sample_cycles) {
            flow.sample_cycles = [];
        }
        if (!flow.session_state) {
            flow.session_state = {};
        }
        if (!flow.session_state.sample_cycles) {
            flow.session_state.sample_cycles = [];
        }

        let currentCycle;
        let isSessionState = false;
        if (flow.session_state.sample_cycles.length > 0) {
            currentCycle = flow.session_state.sample_cycles[flow.session_state.sample_cycles.length - 1];
            isSessionState = true;
        } else if (flow.sample_cycles.length > 0) {
            currentCycle = flow.sample_cycles[flow.sample_cycles.length - 1];
        }

        if (!currentCycle || currentCycle.status !== 'Running') {
            return res.status(400).json({ success: false, message: "No running cycle found" });
        }

        const endTime = new Date().toISOString();
        currentCycle.end_time = endTime;
        currentCycle.good_qty = Number(good_qty) || 0;
        currentCycle.bad_qty = Number(bad_qty) || 0;
        currentCycle.duration = duration;
        currentCycle.status = 'Completed';

        // Keep both root and session_state cycle lists in sync
        if (isSessionState) {
            const rootCycle = flow.sample_cycles.find(c => c.cycle_number === currentCycle.cycle_number);
            if (rootCycle) {
                rootCycle.end_time = endTime;
                rootCycle.good_qty = Number(good_qty) || 0;
                rootCycle.bad_qty = Number(bad_qty) || 0;
                rootCycle.duration = duration;
                rootCycle.status = 'Completed';
            }
            flow.markModified('session_state');
        } else {
            const sessCycle = flow.session_state.sample_cycles.find(c => c.cycle_number === currentCycle.cycle_number);
            if (sessCycle) {
                sessCycle.end_time = endTime;
                sessCycle.good_qty = Number(good_qty) || 0;
                sessCycle.bad_qty = Number(bad_qty) || 0;
                sessCycle.duration = duration;
                sessCycle.status = 'Completed';
                flow.markModified('session_state');
            }
        }

        await flow.save();
        res.status(200).json({ success: true, message: "Sample cycle completed", flow: formatProcessFlow(flow) });
    } catch (error) {
        console.error("Complete Sample Cycle Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Submit for Approval with optional image
export const submitSampleForApproval = async (req, res) => {
    try {
        const { shopfloor_job_id, group_id, good_qty, bad_qty } = req.body;
        let flow = await findFlowDocument(shopfloor_job_id, group_id);
        if (!flow) {
            const job = await shopFloorJobModel.findById(shopfloor_job_id);
            if (!job) return res.status(404).json({ success: false, message: "Shopfloor job not found" });

            flow = new ShopFloorProcessFlow({
                shopfloor_job_id,
                group_id,
                job_no: job.job_no,
                sub_job_no: job.sub_job_no,
                category: job.category,
                subcategory: job.subcategory,
                sample_cycles: []
            });
        }

        if (!flow.sample_cycles) {
            flow.sample_cycles = [];
        }
        if (!flow.session_state) {
            flow.session_state = {};
        }
        if (!flow.session_state.sample_cycles) {
            flow.session_state.sample_cycles = [];
        }

        let currentCycle;
        let isSessionState = false;
        if (flow.session_state.sample_cycles.length > 0) {
            currentCycle = flow.session_state.sample_cycles[flow.session_state.sample_cycles.length - 1];
            isSessionState = true;
        } else if (flow.sample_cycles.length > 0) {
            currentCycle = flow.sample_cycles[flow.sample_cycles.length - 1];
        }

        if (!currentCycle) {
            const cycle_number = ((flow.session_state && flow.session_state.sample_cycles) ? flow.session_state.sample_cycles.length : flow.sample_cycles.length) + 1;
            currentCycle = {
                cycle_number,
                start_time: new Date().toISOString(),
                status: 'Running'
            };
            if (flow.session_state && flow.session_state.sample_cycles) {
                flow.session_state.sample_cycles.push(currentCycle);
                isSessionState = true;
            } else {
                flow.sample_cycles.push(currentCycle);
            }
        }

        // Update quantities in case they were adjusted after cycle completion
        if (good_qty !== undefined) currentCycle.good_qty = good_qty;
        if (bad_qty !== undefined) currentCycle.bad_qty = bad_qty;

        const job = await shopFloorJobModel.findById(shopfloor_job_id);
        if (!job) return res.status(404).json({ success: false, message: "Shopfloor job not found" });

        // Handle Image Upload if present
        let imageUrl = currentCycle.sample_image;
        if (req.file) {
            const { category, subcategory, job_no, sub_job_no } = flow;
            const processName = (job?.process_name || "laser").trim().toLowerCase().replace(/\s+/g, '_');
            const folderName = `${category}/${subcategory}/${job_no}/${sub_job_no}/process/laser/${processName}/sample`.replace(/\s+/g, '_');

            imageUrl = await uploadToR2(folderName, req.file.buffer, req.file.originalname, req.file.mimetype);
            currentCycle.sample_image = imageUrl;
        }

        const isSampleBad = (Number(currentCycle.bad_qty) > 0 && Number(currentCycle.good_qty || 0) === 0);

        if (isSampleBad) {
            currentCycle.status = 'Rejected';
            flow.bom_sample_status = 'SAMPLE_REJECTED_INTERNAL';

            if (!Array.isArray(flow.session_state.localLogs)) {
                flow.session_state.localLogs = [];
            }
            flow.session_state.localLogs.unshift({
                action: `X SAMPLE DAMAGED/REJECTED IN ${(job?.process_name || 'PROCESS').toUpperCase()} — CASCADED RERUN RESET TO LASER`,
                timestamp: new Date().toISOString(),
                activity_type: 'sampling',
                groupId: group_id
            });

            if (isSessionState) {
                flow.markModified('session_state');
            }
            await flow.save();

            const targetSubJobNo = flow.sub_job_no || job?.sub_job_no;
            if (targetSubJobNo) {
                const siblingJobs = await shopFloorJobModel.find({ sub_job_no: targetSubJobNo }).lean();
                const siblingJobIds = siblingJobs.map(j => j._id);

                await shopFloorJobModel.updateMany(
                    { sub_job_no: targetSubJobNo },
                    { $set: { bom_sample_status: 'SAMPLE_REJECTED_INTERNAL' } }
                );

                const siblingFlows = await ShopFloorProcessFlow.find({
                    $or: [
                        { sub_job_no: targetSubJobNo },
                        { shopfloor_job_id: { $in: siblingJobIds } }
                    ]
                });

                for (const sFlow of siblingFlows) {
                    const sJob = siblingJobs.find(j => String(j._id) === String(sFlow.shopfloor_job_id)) || await shopFloorJobModel.findById(sFlow.shopfloor_job_id).lean();
                    const procName = sJob?.process_name?.toLowerCase() || '';
                    const isFirstProcess = procName.includes('laser') || procName.includes('cutting') || procName.includes('cut');

                    if (!sFlow.session_state) sFlow.session_state = {};
                    if (!sFlow.session_state.runningCycles || typeof sFlow.session_state.runningCycles !== 'object') {
                        sFlow.session_state.runningCycles = {};
                    }

                    const gId = sFlow.group_id;

                    if (isFirstProcess) {
                        sFlow.session_state.runningCycles[gId] = {
                            status: 'IDLE',
                            is_rerun: true,
                            cyclesDone: 0
                        };

                        // Reset last sample cycle status so Laser is not stuck in 'Awaiting Approval'
                        if (Array.isArray(sFlow.sample_cycles) && sFlow.sample_cycles.length > 0) {
                            sFlow.sample_cycles[sFlow.sample_cycles.length - 1].status = 'Rejected';
                        }
                        if (Array.isArray(sFlow.session_state.sample_cycles) && sFlow.session_state.sample_cycles.length > 0) {
                            sFlow.session_state.sample_cycles[sFlow.session_state.sample_cycles.length - 1].status = 'Rejected';
                        }
                    } else {
                        sFlow.session_state.runningCycles[gId] = {
                            status: 'WAITING_UPSTREAM',
                            is_rerun: true,
                            cyclesDone: 0
                        };
                    }

                    sFlow.bom_sample_status = 'SAMPLE_REJECTED_INTERNAL';
                    sFlow.markModified('session_state');
                    sFlow.markModified('sample_cycles');
                    await sFlow.save();
                }

                // Clean up any readyJobModel sample entries for this sub_job_no
                try {
                    const rJobs = await readyJobModel.find({
                        $or: [
                            { shopfloor_job_id: flow.shopfloor_job_id },
                            { sub_job_no: targetSubJobNo }
                        ]
                    });
                    for (const rj of rJobs) {
                        let rjMod = false;
                        rj.line_items.forEach(li => {
                            const beforeCount = li.cycles.length;
                            li.cycles = li.cycles.filter(c => Number(c.cycle_number) < 1000 || c.handed_over === true);
                            if (li.cycles.length !== beforeCount) rjMod = true;
                        });
                        if (rjMod) await rj.save();
                    }
                } catch (rjErr) {
                    console.error("Error cleaning readyJobModel on sample rejection:", rjErr);
                }
            }

            return res.status(200).json({
                success: true,
                is_rejected: true,
                message: "Sample was damaged/rejected. Rerun reset to Laser (First Process).",
                flow: formatProcessFlow(flow)
            });
        }

        currentCycle.status = 'Awaiting Approval';

        if (!flow.session_state) flow.session_state = {};
        if (!flow.session_state.runningCycles || typeof flow.session_state.runningCycles !== 'object') {
            flow.session_state.runningCycles = {};
        }
        flow.session_state.runningCycles[group_id] = {
            status: 'WAITING_APPROVAL',
            issuedGood: Number(good_qty) || 0,
            issuedBad: Number(bad_qty) || 0
        };
        flow.markModified('session_state');

        // Check if ALL process flows for this sub_job_no and group have completed a valid GOOD sample cycle
        let allCompleted = true;
        if (flow.sub_job_no) {
            const currentMg = job.material_groups?.find(
                mg => String(mg._id) === String(flow.group_id) || String(mg.group_id) === String(flow.group_id)
            );
            const trueGroupId = currentMg?.group_id || flow.group_id;

            const siblingJobs = await shopFloorJobModel.find({
                sub_job_no: flow.sub_job_no,
                'material_groups.group_id': trueGroupId
            }).lean();
            const siblingJobIds = siblingJobs.map(j => j._id);
            const siblingFlows = await ShopFloorProcessFlow.find({
                shopfloor_job_id: { $in: siblingJobIds }
            }).lean();

            for (const sJob of siblingJobs) {
                if (String(sJob._id) === String(flow.shopfloor_job_id)) {
                    if (!(Number(good_qty) > 0)) {
                        allCompleted = false;
                        break;
                    }
                    continue;
                }

                const sJobMg = sJob.material_groups?.find(mg => String(mg.group_id) === String(trueGroupId));
                const sJobMgId = sJobMg?._id || trueGroupId;

                const sFlow = siblingFlows.find(
                    f => String(f.shopfloor_job_id) === String(sJob._id) &&
                         (String(f.group_id) === String(sJobMgId) || String(f.group_id) === 'COMBINED')
                );
                if (!sFlow) {
                    allCompleted = false;
                    break;
                }
                const cycles = sFlow.session_state?.sample_cycles || sFlow.sample_cycles || [];
                const hasGoodSample = cycles.some(c => (c.good_qty || 0) > 0 && c.status !== 'Rejected');
                if (!hasGoodSample) {
                    allCompleted = false;
                    break;
                }
            }
        }

        if (allCompleted) {
            flow.bom_sample_status = 'AWAITING_SALES_APPROVAL';
            if (!flow.sales_approval_details) flow.sales_approval_details = {};
            if (imageUrl) flow.sales_approval_details.final_sample_image = imageUrl;

            if (isSessionState) {
                flow.markModified('session_state');
            }
            await flow.save();

            if (flow.sub_job_no) {
                await ShopFloorProcessFlow.updateMany(
                    { sub_job_no: flow.sub_job_no },
                    { 
                        $set: { 
                            bom_sample_status: 'AWAITING_SALES_APPROVAL',
                            'sales_approval_details.final_sample_image': imageUrl || flow.sales_approval_details?.final_sample_image
                        }
                    }
                );
            }
            return res.status(200).json({ success: true, message: "All sample processes completed! Sent for Sales Approval.", flow: formatProcessFlow(flow) });
        } else {
            flow.bom_sample_status = 'IN_SAMPLE_PIPELINE';
            if (isSessionState) {
                flow.markModified('session_state');
            }
            await flow.save();

            const targetSubJobNo = flow.sub_job_no || job?.sub_job_no;
            if (targetSubJobNo) {
                const siblingJobs = await shopFloorJobModel.find({ sub_job_no: targetSubJobNo }).lean();
                const siblingJobIds = siblingJobs.map(j => j._id);

                await shopFloorJobModel.updateMany(
                    { sub_job_no: targetSubJobNo },
                    { $set: { bom_sample_status: 'IN_SAMPLE_PIPELINE' } }
                );

                const siblingFlows = await ShopFloorProcessFlow.find({
                    $or: [
                        { sub_job_no: targetSubJobNo },
                        { shopfloor_job_id: { $in: siblingJobIds } }
                    ]
                });

                for (const sFlow of siblingFlows) {
                    sFlow.bom_sample_status = 'IN_SAMPLE_PIPELINE';
                    if (!sFlow.session_state) sFlow.session_state = {};
                    if (!sFlow.session_state.runningCycles || typeof sFlow.session_state.runningCycles !== 'object') {
                        sFlow.session_state.runningCycles = {};
                    }

                    const gId = sFlow.group_id;
                    if (sFlow.session_state.runningCycles[gId]?.status === 'WAITING_UPSTREAM') {
                        sFlow.session_state.runningCycles[gId] = {
                            status: 'IDLE',
                            is_rerun: true,
                            cyclesDone: 0
                        };
                    }
                    sFlow.markModified('session_state');
                    await sFlow.save();
                }
            }

            return res.status(200).json({ success: true, message: "Sample stage completed! Passed to next process in pipeline.", flow: formatProcessFlow(flow) });
        }
    } catch (error) {
        console.error("Submit Sample Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Approve or Reject Sample (by Sales Person or QC)
export const processSampleAction = async (req, res) => {
    try {
        const { shopfloor_job_id, group_id, sub_job_no, action, action_by, action_by_name, reject_reason, approval_remark, remark } = req.body;

        const finalActionBy = mongoose.Types.ObjectId.isValid(action_by)
            ? action_by
            : (mongoose.Types.ObjectId.isValid(req.user?._id) ? req.user._id : null);

        let flow = await findFlowDocument(shopfloor_job_id, group_id);
        if (!flow) return res.status(404).json({ success: false, message: "Flow not found" });

        const targetSubJobNo = sub_job_no || flow.sub_job_no;

        let currentCycle;
        if (flow.session_state && flow.session_state.sample_cycles && flow.session_state.sample_cycles.length > 0) {
            currentCycle = flow.session_state.sample_cycles[flow.session_state.sample_cycles.length - 1];
        } else if (flow.sample_cycles && flow.sample_cycles.length > 0) {
            currentCycle = flow.sample_cycles[flow.sample_cycles.length - 1];
        }

        if (!currentCycle) {
            currentCycle = {
                cycle_number: 1,
                status: action === 'approve' ? 'Approved' : 'Rejected'
            };
        }

        currentCycle.status = action === 'approve' ? 'Approved' : 'Rejected';
        currentCycle.action_by = finalActionBy;
        currentCycle.action_by_name = action_by_name || 'Sales Representative';
        currentCycle.action_at = new Date().toISOString();
        if (action === 'reject') {
            currentCycle.reject_reason = reject_reason || remark || 'Rework requested';
        } else if (action === 'approve') {
            currentCycle.approval_remark = approval_remark || remark || 'No remarks';
        }

        // Direct Session State Sync inside Database
        if (!flow.session_state) {
            flow.session_state = {};
        }

        if (!flow.session_state.runningCycles) {
            flow.session_state.runningCycles = {};
        }

        if (!flow.session_state.quantities) {
            flow.session_state.quantities = {};
        }

        const newBomStatus = action === 'approve' ? 'APPROVED_BY_SALES' : 'REJECTED_BY_SALES';
        flow.bom_sample_status = newBomStatus;

        if (!flow.sales_approval_details) flow.sales_approval_details = {};
        flow.sales_approval_details.approved_by = finalActionBy;
        flow.sales_approval_details.approved_by_name = action_by_name || 'Sales Representative';
        flow.sales_approval_details.action_at = new Date().toISOString();
        if (action === 'reject') {
            flow.sales_approval_details.reject_reason = reject_reason || remark || 'Rework requested';
        } else if (action === 'approve') {
            flow.sales_approval_details.approval_remark = approval_remark || remark || 'No remarks';
        }

        if (action === 'approve') {
            flow.session_state.quantities.sample_good = Number(currentCycle.good_qty) || 1;
            flow.session_state.quantities.sample_reject = Number(currentCycle.bad_qty) || 0;
            flow.session_state.quantities.quantities_updated_at = new Date().toISOString();

            flow.session_state.primaryUnlocked = {
                cycleCount: flow.session_state.sample_cycles?.length || 1,
                goodQty: Number(currentCycle.good_qty) || 1,
                badQty: Number(currentCycle.bad_qty) || 0,
                totalPcs: (Number(currentCycle.good_qty) || 1) + (Number(currentCycle.bad_qty) || 0)
            };

            flow.session_state.runningCycles = {
                ...flow.session_state.runningCycles,
                status: 'APPROVED',
                cyclesDone: 0,
                issuedGood: Number(currentCycle.good_qty) || 1,
                issuedBad: Number(currentCycle.bad_qty) || 0
            };
        } else {
            const totalPcs = (Number(currentCycle.good_qty) || 0) + (Number(currentCycle.bad_qty) || 0);
            flow.session_state.quantities.sample_good = 0;
            flow.session_state.quantities.sample_reject = totalPcs > 0 ? totalPcs : Number(currentCycle.sample_qty || 1);
            flow.session_state.quantities.quantities_updated_at = new Date().toISOString();

            flow.session_state.primaryUnlocked = false;

            flow.session_state.runningCycles = {
                status: 'IDLE',
                startTime: null,
                endTime: null,
                is_recut: false,
                recut_qty: 0,
                recut_option_type: null,
                cyclesDone: 0
            };
        }

        if (!Array.isArray(flow.session_state.localLogs)) {
            flow.session_state.localLogs = [];
        }

        if (action === 'approve') {
            flow.session_state.localLogs.unshift({
                action: `✓ SAMPLE APPROVED BY SALES PERSON — PRIMARY CYCLES UNLOCKED`,
                timestamp: new Date().toISOString(),
                activity_type: 'sampling',
                groupId: group_id
            });
        } else {
            flow.session_state.localLogs.unshift({
                action: `X SAMPLE REJECTED BY SALES PERSON — REASON: ${(reject_reason || 'Quality Defect').toUpperCase()}`,
                timestamp: new Date().toISOString(),
                activity_type: 'sampling',
                groupId: group_id
            });
        }

        // Sync main level sample_cycles with session_state array
        if (flow.session_state.sample_cycles) {
            const idx = flow.session_state.sample_cycles.findIndex(c => c.cycle_number === currentCycle.cycle_number);
            if (idx !== -1) {
                flow.session_state.sample_cycles[idx] = currentCycle;
            } else {
                flow.session_state.sample_cycles.push(currentCycle);
            }
        }

        flow.markModified('session_state');
        await flow.save();

        // Propagate bom_sample_status and runningCycles status across ALL process flows for this sub_job_no
        if (targetSubJobNo) {
            const allSubJobFlows = await ShopFloorProcessFlow.find({ sub_job_no: targetSubJobNo });
            for (const subFlow of allSubJobFlows) {
                subFlow.bom_sample_status = newBomStatus;
                if (!subFlow.sales_approval_details) subFlow.sales_approval_details = {};
                subFlow.sales_approval_details.approved_by = finalActionBy;
                subFlow.sales_approval_details.approved_by_name = action_by_name || 'Sales Representative';
                subFlow.sales_approval_details.action_at = new Date().toISOString();
                if (action === 'reject') {
                    subFlow.sales_approval_details.reject_reason = reject_reason || remark || 'Rework requested';
                } else if (action === 'approve') {
                    subFlow.sales_approval_details.approval_remark = approval_remark || remark || 'No remarks';
                }

                if (!subFlow.session_state) subFlow.session_state = {};
                if (!subFlow.session_state.runningCycles) subFlow.session_state.runningCycles = {};

                if (action === 'approve') {
                    subFlow.session_state.primaryUnlocked = {
                        cycleCount: currentCycle.cycle_number || 1,
                        goodQty: Number(currentCycle.good_qty) || 1,
                        badQty: Number(currentCycle.bad_qty) || 0,
                        totalPcs: (Number(currentCycle.good_qty) || 1) + (Number(currentCycle.bad_qty) || 0)
                    };
                    subFlow.session_state.runningCycles.status = 'APPROVED';
                    subFlow.session_state.runningCycles.cyclesDone = 0;
                    if (subFlow.group_id) {
                        subFlow.session_state.runningCycles[subFlow.group_id] = {
                            ...(subFlow.session_state.runningCycles[subFlow.group_id] || {}),
                            status: 'APPROVED',
                            cyclesDone: 0,
                            issuedGood: Number(currentCycle.good_qty) || 1
                        };
                    }
                } else {
                    subFlow.session_state.primaryUnlocked = false;
                    subFlow.session_state.runningCycles.status = 'IDLE';
                    if (subFlow.group_id) {
                        subFlow.session_state.runningCycles[subFlow.group_id] = {
                            ...(subFlow.session_state.runningCycles[subFlow.group_id] || {}),
                            status: 'IDLE',
                            is_rerun: true
                        };
                    }
                }
                subFlow.markModified('session_state');
                await subFlow.save();
            }
        }

        if (action === 'approve') {
            flow.session_state.primaryUnlocked = {
                cycleCount: (flow.session_state.sample_cycles || []).length || 1,
                goodQty: Number(flow.session_state.quantities?.sample_good || currentCycle.good_qty || 0),
                badQty: Number(flow.session_state.quantities?.sample_reject || currentCycle.bad_qty || 0),
                totalPcs: (Number(flow.session_state.quantities?.sample_good || currentCycle.good_qty || 0)) + (Number(flow.session_state.quantities?.sample_reject || currentCycle.bad_qty || 0))
            };

            const job = await shopFloorJobModel.findById(shopfloor_job_id);
            if (job) {
                const mgForPropagate = job.material_groups?.find(g => String(g._id) === String(group_id) || String(g.group_id) === String(group_id));
                await propagateSampleRequirement(job, group_id, mgForPropagate?.process_index || null);
            }
        } else if (action === 'reject') {
            try {
                const rJobs = await readyJobModel.find({
                    $or: [
                        { shopfloor_job_id: flow.shopfloor_job_id },
                        { sub_job_no: targetSubJobNo }
                    ]
                });
                for (const rj of rJobs) {
                    let rjMod = false;
                    rj.line_items.forEach(li => {
                        const beforeCount = li.cycles.length;
                        li.cycles = li.cycles.filter(c => Number(c.cycle_number) < 1000);
                        if (li.cycles.length !== beforeCount) rjMod = true;
                    });
                    if (rjMod) await rj.save();
                }
            } catch (rjErr) {
                console.error("Error cleaning readyJobModel on sales sample rejection:", rjErr);
            }
        }

        await syncJobProgressAndCompletion(shopfloor_job_id, group_id, flow);
        res.status(200).json({ success: true, message: `Sample ${action}d by Sales Person successfully`, flow: formatProcessFlow(flow) });
    } catch (error) {
        console.error("Process Sample Action Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Start Primary Cycle
export const startPrimaryCycle = async (req, res) => {
    try {
        const { shopfloor_job_id, group_id, started_by, started_by_name } = req.body;

        let flow = await findFlowDocument(shopfloor_job_id, group_id);
        if (!flow) return res.status(404).json({ success: false, message: "Flow not found" });

        const job = await shopFloorJobModel.findById(shopfloor_job_id);
        if (!job) return res.status(404).json({ success: false, message: "Shopfloor job not found" });

        // Block primary cycle if a preceding DTP process is not completed in DTP Studio
        if (job.bom_id) {
            let bom = null;
            if (typeof job.bom_id === 'object' && job.bom_id.materialprocess) {
                bom = job.bom_id;
            } else {
                bom = await bomModel.findById(job.bom_id).lean();
            }

            if (bom && bom.materialprocess) {
                const currentMg = job.material_groups?.find(
                    mg => String(mg._id) === String(group_id) || String(mg.group_id) === String(group_id)
                );
                const trueGroupId = currentMg?.group_id || group_id;

                const processGroup = bom.materialprocess.find(
                    p => p.material_group_name?.toLowerCase().trim() === flow.category?.toLowerCase().trim() ||
                        String(p.material_group_id) === String(trueGroupId)
                );

                if (processGroup && processGroup.processes) {
                    const processes = processGroup.processes;
                    const currentProcIdx = processes.findIndex(
                        p => p.process_name?.toLowerCase().trim() === job.process_name?.toLowerCase().trim()
                    );

                    const dtpProcIdx = processes.findIndex(
                        p => p.process_name?.toLowerCase().trim().includes('dtp')
                    );

                    const isSampleJob = (job.job_type || '').toLowerCase() === 'sample' || (job.category || '').toLowerCase() === 'sample';
                    if (!isSampleJob && dtpProcIdx !== -1 && currentProcIdx !== -1 && dtpProcIdx < currentProcIdx) {
                        const dtpJob = await dtpStudioModel.findOne({
                            sample_order_id: job.sales_order_id,
                            sub_job_no: job.sub_job_no
                        }).lean();

                        if (!dtpJob) {
                            return res.status(400).json({
                                success: false,
                                message: "Cannot start production. DTP job not found in DTP Studio!"
                            });
                        }

                        const dtpStatus = dtpJob.status;
                        const isDtpCompleted = dtpStatus === 'Shop Floor' || dtpStatus === 'Completed';

                        if (!isDtpCompleted) {
                            return res.status(400).json({
                                success: false,
                                message: `Cannot start production. DTP is not completed yet in DTP Studio! Current DTP status is '${dtpStatus}'.`
                            });
                        }
                    }
                }
            }
        }

        flow.primary_cycle = {
            started_by,
            started_by_name,
            started_at: new Date().toISOString(),
            is_started: true
        };

        // Direct Session State Sync inside Database for primary cycle transition
        if (!flow.session_state) {
            flow.session_state = {};
        }

        const sample_good = Number(flow.session_state.quantities?.sample_good || 0);
        const sample_reject = Number(flow.session_state.quantities?.sample_reject || 0);
        const totalSamplePcs = sample_good + sample_reject;

        const nextUnlocked = {
            cycleCount: (flow.session_state.sample_cycles || []).length || 1,
            goodQty: sample_good,
            badQty: sample_reject,
            totalPcs: totalSamplePcs
        };

        flow.session_state.primaryUnlocked = nextUnlocked;

        // Reset runningCycles to IDLE for main production phase
        flow.session_state.runningCycles = {
            status: 'IDLE',
            startTime: null,
            endTime: null,
            is_recut: false,
            recut_qty: 0,
            recut_option_type: null,
            cyclesDone: 0
        };

        if (!Array.isArray(flow.session_state.localLogs)) {
            flow.session_state.localLogs = [];
        }
        flow.session_state.localLogs.unshift({
            action: `🚀 APPROVED FOR PRODUCTION — PRIMARY CYCLE NOW OPEN`,
            timestamp: new Date().toISOString(),
            activity_type: 'production',
            groupId: group_id
        });

        flow.markModified('session_state');
        await flow.save();
        await syncJobProgressAndCompletion(shopfloor_job_id, group_id, flow);
        res.status(200).json({ success: true, message: "Primary cycle started", flow: formatProcessFlow(flow) });
    } catch (error) {
        console.error("Start Primary Cycle Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get Process Flow
export const getProcessFlow = async (req, res) => {
    try {
        const { shopfloor_job_id, group_id } = req.params;
        const flow = await findFlowDocument(shopfloor_job_id, group_id);
        res.status(200).json({ success: true, flow: formatProcessFlow(flow) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Sync UI session state
export const updateSessionState = async (req, res) => {
    try {
        const { shopfloor_job_id, group_id, job_no, sub_job_no, category, subcategory, session_state } = req.body;

        let flow = await findFlowDocument(shopfloor_job_id, group_id);

        if (!flow) {
            flow = new ShopFloorProcessFlow({
                shopfloor_job_id,
                group_id,
                job_no,
                sub_job_no,
                category,
                subcategory,
                session_state: {}
            });
        }

        if (!flow.session_state) {
            flow.session_state = {};
        }

        if (session_state) {
            if (session_state.quantities !== undefined) {
                const dbQuantities = flow.session_state.quantities || {};
                const incomingQuantities = session_state.quantities;

                const dbTime = new Date(dbQuantities.quantities_updated_at || 0).getTime();
                const incomingTime = new Date(incomingQuantities.quantities_updated_at || 0).getTime();

                // Preserve Store-updated fields from the DB only if DB has a strictly newer timestamp (e.g. administrative EMR confirmation)
                if (dbTime > incomingTime) {
                    if (dbQuantities.material_issued !== undefined) incomingQuantities.material_issued = dbQuantities.material_issued;
                    if (dbQuantities.recut_received !== undefined) incomingQuantities.recut_received = dbQuantities.recut_received;
                    if (dbQuantities.recut_not_inwarded !== undefined) incomingQuantities.recut_not_inwarded = dbQuantities.recut_not_inwarded;
                    if (dbQuantities.selected_recut_option !== undefined) incomingQuantities.selected_recut_option = dbQuantities.selected_recut_option;
                    if (dbQuantities.quantities_updated_at !== undefined) incomingQuantities.quantities_updated_at = dbQuantities.quantities_updated_at;
                } else {
                    // Even if incoming is newer, merge EMR-related fields updated by receipt/Store flow
                    let hasMergedUpdates = false;

                    if (dbQuantities.material_issued === true && incomingQuantities.material_issued !== true) {
                        incomingQuantities.material_issued = true;
                        hasMergedUpdates = true;
                    }
                    if (typeof dbQuantities.recut_received === 'number' && dbQuantities.recut_received > (incomingQuantities.recut_received || 0)) {
                        incomingQuantities.recut_received = dbQuantities.recut_received;
                        hasMergedUpdates = true;
                    }
                    if (typeof dbQuantities.recut_not_inwarded === 'number' && dbQuantities.recut_not_inwarded < (incomingQuantities.recut_not_inwarded || 0)) {
                        incomingQuantities.recut_not_inwarded = dbQuantities.recut_not_inwarded;
                        hasMergedUpdates = true;
                    }
                    if (Array.isArray(dbQuantities.selected_recut_option) && Array.isArray(incomingQuantities.selected_recut_option)) {
                        incomingQuantities.selected_recut_option = incomingQuantities.selected_recut_option.map((incomingOpt, idx) => {
                            const dbOpt = dbQuantities.selected_recut_option[idx];
                            if (dbOpt &&
                                (dbOpt.type === 'New Sheet' || dbOpt.type === 'new sheet') &&
                                (incomingOpt.type === 'New Sheet' || incomingOpt.type === 'new sheet')) {
                                if (dbOpt.is_inwarded && !incomingOpt.is_inwarded) {
                                    hasMergedUpdates = true;
                                    return {
                                        ...incomingOpt,
                                        is_inwarded: true
                                    };
                                }
                            }
                            return incomingOpt;
                        });
                    }

                    if (hasMergedUpdates) {
                        incomingQuantities.quantities_updated_at = new Date().toISOString();
                    }
                }

                flow.session_state.quantities = incomingQuantities;
            }
            flow.session_state.sampleUps = session_state.sampleUps;
            flow.session_state.runningCycles = session_state.runningCycles;
            flow.session_state.localLogs = session_state.localLogs || [];
            flow.session_state.sampleInputs = session_state.sampleInputs;
            flow.session_state.primaryUnlocked = session_state.primaryUnlocked;
            flow.session_state.primaryUps = session_state.primaryUps;
            flow.session_state.isUpsConfirmed = session_state.isUpsConfirmed;
            flow.session_state.selectedOperator = session_state.selectedOperator;
            flow.session_state.selectedHeads = session_state.selectedHeads;
            flow.session_state.groupTimers = session_state.groupTimers;
            flow.session_state.sample_cycles = session_state.sample_cycles || [];
            flow.session_state.primary_cycles = session_state.primary_cycles || [];
            flow.session_state.recut_cycles = session_state.recut_cycles || [];
            flow.session_state.haveExcessSheet = session_state.haveExcessSheet || false;

            // Maintain primary_cycle_history automatically
            let history = flow.session_state.primary_cycle_history || [];
            if (session_state.isUpsConfirmed && session_state.primaryUps) {
                const incomingUps = Number(session_state.primaryUps);
                const currentCycle = (session_state.runningCycles?.cyclesDone || 0) + 1;
                const operator = session_state.selectedOperator || "Unknown Operator";

                if (history.length === 0) {
                    history.push({
                        cycle: 1,
                        ups: incomingUps,
                        added_by: operator,
                        added_at: new Date()
                    });
                } else {
                    const lastEntry = history[history.length - 1];
                    if (lastEntry.ups !== incomingUps) {
                        history.push({
                            cycle: currentCycle,
                            ups: incomingUps,
                            added_by: operator,
                            added_at: new Date()
                        });
                    }
                }
            }
            flow.session_state.primary_cycle_history = history;

            // Live Rejections & Scrap Syncing (Mid-run updates)
            try {
                const job = await shopFloorJobModel.findById(shopfloor_job_id);
                if (job && job.material_groups) {
                    const group = job.material_groups.find(mg => String(mg._id || mg.group_id) === String(group_id));
                    if (group) {
                        const totalRejectedQty = (session_state.quantities?.reject || 0) + (session_state.quantities?.recut_completed || 0) + (session_state.quantities?.sample_reject || 0);
                        const sameSheetRecutQty = session_state.quantities?.recut_completed || 0;
                        const finalRejQty = Math.max(0, totalRejectedQty - sameSheetRecutQty);

                        if (totalRejectedQty > 0) {
                            const size = group.materials?.[0]?.material_input?.size || '12x18';
                            const dims = size.toLowerCase().replace('in', '').split('x');
                            const w = parseFloat(dims[0]) || 12;
                            const h = parseFloat(dims[1]) || 18;
                            const sqinLost = totalRejectedQty * w * h;
                            const sqftLost = sqinLost / 144;
                            const estLoss = Math.round(sqinLost * 0.05);
                            const hShift = String((group.assigned_shifts && group.assigned_shifts.length > 0) ? group.assigned_shifts[0] : (job.assigned_shifts?.[0] || '1'));
                            const material_name = group.group_name || "Unknown Material";

                            // 1. Update flow.rejection array (overwrite with single live state)
                            flow.rejection = [{
                                material_name,
                                size,
                                rejected_qty: finalRejQty,
                                recut_qty: sameSheetRecutQty,
                                sqin_lost: sqinLost,
                                sqft_lost: sqftLost,
                                machine: `Shift ${hShift}`,
                                est_loss: estLoss,
                                recut_status: sameSheetRecutQty > 0 ? `Yes - ${sameSheetRecutQty} pcs` : `No - 0 pcs`,
                                write_off_status: 'Pending',
                                timestamp: new Date()
                            }];

                        } else {
                            // If rejections are cleared/0
                            flow.rejection = [];
                        }
                    }
                }
            } catch (liveSyncErr) {
                console.error("Live rejections sync failed in updateSessionState:", liveSyncErr);
            }
        }

        flow.markModified('session_state');
        await flow.save();

        // Trigger automated inward & status update to next department process if handover logs exist
        const hasHandoverLog = (session_state.localLogs || []).some(log => (log.action || '').includes('HANDED OVER'));
        if (hasHandoverLog) {
            const handoverLog = session_state.localLogs.find(log => (log.action || '').includes('HANDED OVER'));
            await automateNextProcessInward(
                shopfloor_job_id,
                group_id,
                1,
                handoverLog?.good_qty || 0,
                session_state.selectedOperator || 'Operator',
                null
            );
        }

        // Sync ShopFloor Job completion state & progress
        await syncJobProgressAndCompletion(shopfloor_job_id, group_id, flow);

        res.status(200).json({ success: true, message: "UI Session State synced successfully", flow: formatProcessFlow(flow) });
    } catch (error) {
        console.error("updateSessionState error:", error);
        res.status(500).json({ success: false, message: "Server error syncing session state", error: error.message });
    }
};

export const confirmCompletionPopup = async (req, res) => {
    const { shopfloor_job_id, group_id, return_excess, rejections_list, excess_qty, excess_sqft } = req.body;
    try {
        const job = await shopFloorJobModel.findById(shopfloor_job_id);
        if (!job) return res.status(404).json({ success: false, message: "Job not found" });

        let flow = await findFlowDocument(shopfloor_job_id, group_id);
        if (!flow) {
            flow = await ShopFloorProcessFlow.findOne({ shopfloor_job_id, group_id });
        }
        if (!flow) {
            flow = await ShopFloorProcessFlow.create({
                shopfloor_job_id,
                group_id,
                job_no: job.job_no,
                sub_job_no: job.sub_job_no,
                category: job.category,
                subcategory: job.subcategory,
                session_state: {}
            });
        }

        // Initialize excessConfirmed inside session_state
        if (!flow.session_state.excessConfirmed) {
            flow.session_state.excessConfirmed = {};
        }
        flow.session_state.excessConfirmed[group_id] = {
            confirmed: true,
            returnExcess: return_excess
        };
        flow.markModified('session_state');

        // 1. Calculate / Save Excess Stock quantity if return_excess is true
        if (return_excess) {
            const group = job.material_groups.find(mg => String(mg._id || mg.group_id) === String(group_id));
            if (group) {
                const totalSheets = group.materials?.[0]?.quantity || group.sheets_required || 0;
                const outsourcedSheets = group.assigned_outsource_sheets || 0;
                const inwardGood = (group.inward_history || []).reduce((acc, log) => acc + (log.good_qty || 0), 0);
                const isInHouseJob = inwardGood >= totalSheets;
                const totalSheetsRequired = isInHouseJob ? totalSheets : Math.max(0, totalSheets - outsourcedSheets);
                const upsVal = group.materials?.[0]?.material_input?.ups || group.ups || 1;
                const inHouseQty = totalSheetsRequired * upsVal;

                const targetQty = isInHouseJob
                    ? (job.total_qty || inHouseQty)
                    : Math.max(0, (job.total_qty || inHouseQty) - (outsourcedSheets * upsVal));

                let goodIssueQty = 0;
                if (group.process_history) {
                    group.process_history.forEach(historyItem => {
                        if (historyItem.details && typeof historyItem.details.good_qty === 'number' && historyItem.action?.startsWith('📦')) {
                            goodIssueQty += historyItem.details.good_qty;
                        } else if (typeof historyItem.good_qty === 'number' && historyItem.action?.startsWith('📦')) {
                            goodIssueQty += historyItem.good_qty;
                        }
                    });
                }

                const resolvedExcessQty = excess_qty !== undefined ? Number(excess_qty) : Math.max(0, goodIssueQty - targetQty);
                const resolvedExcessSqft = excess_sqft !== undefined ? Number(excess_sqft) : 0;

                if (resolvedExcessQty > 0) {
                    if (!flow.excess_stock) flow.excess_stock = [];
                    flow.excess_stock.push({
                        group_name: group.group_name || "Unknown Group",
                        process_name: job.process_name,
                        excess_qty: resolvedExcessQty,
                        excess_sqft: resolvedExcessSqft,
                        timestamp: new Date()
                    });
                }
            }
        }

        // 2. Populate rejection logs if rejections exist
        if (rejections_list && Array.isArray(rejections_list)) {
            if (!flow.rejection) flow.rejection = [];
            for (const rej of rejections_list) {
                const finalRejQty = Math.max(0, rej.rejected_qty - (rej.recut_qty || 0));
                const size = rej.size || "12x18";
                const dims = size.toLowerCase().replace('in', '').split('x');
                const w = parseFloat(dims[0]) || 12;
                const h = parseFloat(dims[1]) || 18;
                const sqinLost = finalRejQty * w * h;
                const sqftLost = sqinLost / 144;
                const estLoss = Math.round(sqinLost * 0.05);

                flow.rejection.push({
                    material_name: rej.material_name,
                    size: size,
                    rejected_qty: finalRejQty,
                    recut_qty: rej.recut_qty || 0,
                    sqin_lost: sqinLost,
                    sqft_lost: sqftLost,
                    machine: rej.machine || "Shift 1",
                    est_loss: estLoss,
                    recut_status: rej.recut_status || "No - 0 pcs",
                    write_off_status: 'Pending',
                    timestamp: new Date()
                });

                // (Entry in shop_floor_rejected_material collection will be created only when supervisor explicitly submits disposal ledger form)
            }
        }

        // Update the status of the completed group (line item) to Completed
        const completedGroup = job.material_groups.find(mg => String(mg._id || mg.group_id) === String(group_id));
        if (completedGroup) {
            completedGroup.status = 'Completed';
            job.markModified('material_groups');
            await job.save();
        }

        await flow.save();

        // 3. Sync ShopFloor Job completion state & progress
        await syncJobProgressAndCompletion(shopfloor_job_id, group_id, flow);

        res.status(200).json({ success: true, message: "Completion confirmed successfully", flow: formatProcessFlow(flow) });
    } catch (error) {
        console.error("confirmCompletionPopup error:", error);
        res.status(500).json({ success: false, message: "Server error confirming completion" });
    }
};

export const authorizeWriteOff = async (req, res) => {
    const { flow_id, rejection_item_id } = req.body;
    try {
        const flow = await ShopFloorProcessFlow.findById(flow_id);
        if (!flow) return res.status(404).json({ success: false, message: "Process flow session not found" });

        const rejectionItem = flow.rejection.id(rejection_item_id);
        if (!rejectionItem) return res.status(404).json({ success: false, message: "Rejection item not found in flow" });

        if (rejectionItem.write_off_status === 'Authorized') {
            return res.status(400).json({ success: false, message: "Rejection write-off already authorized" });
        }

        rejectionItem.write_off_status = 'Authorized';
        await flow.save();

        const job = await shopFloorJobModel.findById(flow.shopfloor_job_id);

        // Since rejectionItem.rejected_qty is already stored as the adjusted balance (original rejections minus same-sheet recuts),
        // we can use it directly as the final scrap/rejected quantity.
        const finalRejectedQty = rejectionItem.rejected_qty;

        // Create Scrap Disposal entry
        await ScrapDisposal.create({
            job_no: flow.job_no,
            sub_job_no: flow.sub_job_no,
            group_name: flow.session_state.group_name || "Unknown Group",
            process_name: job?.process_name || "Unknown Process",
            material_name: rejectionItem.material_name,
            scrap_qty: finalRejectedQty,
            disposal_method: 'Pending',
            timestamp: new Date()
        });

        // (Entry in shop_floor_rejected_material collection will be created only when supervisor explicitly submits disposal ledger form)

        res.status(200).json({ success: true, message: "Write-off authorized and scrap entry created successfully", flow: formatProcessFlow(flow) });
    } catch (error) {
        console.error("authorizeWriteOff error:", error);
        res.status(500).json({ success: false, message: "Server error authorizing write-off" });
    }
};

// Get all shop floor rejected materials
export const getRejectedMaterials = async (req, res) => {
    try {
        const { job_no, sub_job_no, is_dispose, resold } = req.query;
        const query = {};
        if (job_no) query.job_no = job_no;
        if (sub_job_no) query.sub_job_no = sub_job_no;
        if (is_dispose !== undefined) query.is_dispose = is_dispose === 'true';
        if (resold !== undefined) query.resold = resold === 'true';

        const list = await ShopFloorRejectedMaterial.find(query).sort({ createdAt: -1 });
        res.status(200).json({ success: true, list });
    } catch (error) {
        console.error("getRejectedMaterials error:", error);
        res.status(500).json({ success: false, message: "Server error fetching rejected materials" });
    }
};

// Update is_dispose status for a rejected material
export const updateDisposalStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { is_dispose } = req.body;

        const record = await ShopFloorRejectedMaterial.findByIdAndUpdate(
            id,
            { is_dispose },
            { new: true }
        );

        if (!record) {
            return res.status(404).json({ success: false, message: "Rejected material record not found" });
        }

        res.status(200).json({ success: true, message: "Disposal status updated successfully", record });
    } catch (error) {
        console.error("updateDisposalStatus error:", error);
        res.status(500).json({ success: false, message: "Server error updating disposal status" });
    }
};

// Update resold status for a rejected material
export const updateResoldStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { resold } = req.body;

        const record = await ShopFloorRejectedMaterial.findByIdAndUpdate(
            id,
            { resold },
            { new: true }
        );

        if (!record) {
            return res.status(404).json({ success: false, message: "Resold status updated successfully", record });
        }

        res.status(200).json({ success: true, message: "Resold status updated successfully", record });
    } catch (error) {
        console.error("updateResoldStatus error:", error);
        res.status(500).json({ success: false, message: "Server error updating resold status" });
    }
};

// Create a new rejected material disposal entry (called ONLY when supervisor submits scrap disposal form)
export const createRejectedMaterialDisposal = async (req, res) => {
    try {
        const {
            job_no,
            sub_job_no,
            category,
            subcategory,
            shopfloor_job_id,
            group_id,
            flow_rejection_item_id,
            material_name,
            size,
            rejected_qty,
            recut_qty,
            net_rejected_qty,
            sqin_lost,
            sqft_lost,
            machine,
            est_loss,
            recut_status,
            write_off_status,
            disposal_method,
            authorised_by,
            remarks,
            sale_amount
        } = req.body;

        const is_dispose = disposal_method === 'Disposed' || disposal_method === 'Recycled' || disposal_method === 'Donated';
        const resold = disposal_method === 'Sold';

        // Clean material name: strip job_no and sub_job_no prefixes if embedded (e.g. "RD21050 (RD21050a) — Raw Material")
        let cleanedMaterialName = material_name || "";
        if (job_no) {
            const escapedJobNo = job_no.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
            const escapedSubJobNo = sub_job_no ? sub_job_no.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') : "";

            if (escapedSubJobNo) {
                const prefixRegex = new RegExp(`^\\s*${escapedJobNo}\\s*\\(\\s*${escapedSubJobNo}\\s*\\)\\s*[-—]\\s*`, 'i');
                cleanedMaterialName = cleanedMaterialName.replace(prefixRegex, '');
            }
            const jobNoRegex = new RegExp(`^\\s*${escapedJobNo}\\s*[-—]\\s*`, 'i');
            cleanedMaterialName = cleanedMaterialName.replace(jobNoRegex, '');
        }
        cleanedMaterialName = cleanedMaterialName.trim();

        const record = new ShopFloorRejectedMaterial({
            job_no,
            sub_job_no,
            category,
            subcategory,
            shopfloor_job_id,
            group_id,
            flow_rejection_item_id: flow_rejection_item_id || null,
            material_name: cleanedMaterialName,
            size,
            rejected_qty,
            recut_qty,
            net_rejected_qty,
            sqin_lost,
            sqft_lost,
            machine,
            est_loss,
            recut_status,
            write_off_status: write_off_status || 'Pending',
            is_dispose,
            resold,
            disposal_method,
            authorised_by,
            remarks,
            sale_amount: typeof sale_amount === 'number' ? sale_amount : (Number(sale_amount) || 0),
            timestamp: new Date()
        });

        await record.save();

        res.status(201).json({ success: true, message: "Scrap disposal recorded successfully", record });
    } catch (error) {
        console.error("createRejectedMaterialDisposal error:", error);
        res.status(500).json({ success: false, message: "Server error recording scrap disposal" });
    }
};

// Get list of pending sample approvals for Sales Person dashboard
export const getSalesSampleQueue = async (req, res) => {
    try {
        const { job_no } = req.query;
        const filterQuery = {
            bom_sample_status: { $in: ['AWAITING_SALES_APPROVAL', 'APPROVED_BY_SALES', 'REJECTED_BY_SALES', 'SAMPLE_REJECTED_INTERNAL'] }
        };

        if (job_no) {
            filterQuery.job_no = String(job_no).trim();
        }

        const flows = await ShopFloorProcessFlow.find(filterQuery).lean();

        const pendingItems = [];
        const seenSubJobs = new Set();

        for (const flow of flows) {
            const subJobKey = `${flow.job_no}_${flow.sub_job_no}`;
            if (seenSubJobs.has(subJobKey)) continue;

            const allSubJobFlows = await ShopFloorProcessFlow.find({ sub_job_no: flow.sub_job_no }).lean();
            const allShopfloorJobIds = allSubJobFlows.map(f => f.shopfloor_job_id);
            const allJobs = await shopFloorJobModel.find({ _id: { $in: allShopfloorJobIds } }).lean();

            const processNames = allJobs.map(j => j.process_name).filter(Boolean);
            const uniqueProcessNames = Array.from(new Set(processNames));

            const job = await shopFloorJobModel.findById(flow.shopfloor_job_id).lean();

            let clientName = job?.client_name;
            let productName = job?.job_name || job?.subcategory;
            let enquiryId = job?.enquiry_id;
            let salesOrderId = job?.sales_order_id;

            const soId = job?.sales_order_id || flow.sales_order_id;
            const soQuery = soId ? { _id: soId } : { job_no: flow.job_no, sub_job_no: flow.sub_job_no };
            const so = await salesorderlistModel.findOne(soQuery).populate("enquiry_id").lean();

            // Fetch matching salesorderform for full order details including wp_number and email
            const formQueryConditions = [
                { job_no: flow.job_no, sub_job_no: flow.sub_job_no }
            ];
            if (so?._id) formQueryConditions.push({ sample__order_id: so._id });
            if (soId) formQueryConditions.push({ sample__order_id: soId });
            if (so?.sample_salesorder_id) formQueryConditions.push({ _id: so.sample_salesorder_id });
            if (so?.id) formQueryConditions.push({ id: so.id });

            const form = await salesorderformModel.findOne({ $or: formQueryConditions }).lean();

            if (form) {
                clientName = form.client_name || clientName;
                productName = form.product_name || form.category || productName;
            }

            if (so) {
                clientName = clientName || so.client_name || so.enquiry_id?.name;
                productName = productName || so.product_name || so.enquiry_id?.product_name;
                enquiryId = enquiryId || so.enquiry_id?._id || so.enquiry_id?.id || so.enquiry_id;
                salesOrderId = salesOrderId || so._id || so.id;
            }

            clientName = clientName || 'Customer';
            productName = productName || 'Product';

            // Extract wp_number and email directly from salesorderform, with fallbacks to so/enquiry/job
            let wpNumber = form?.wp_number || [];
            if ((!wpNumber || wpNumber.length === 0) && form?.mobile_no) {
                wpNumber = [form.mobile_no];
            }
            if (!wpNumber || wpNumber.length === 0) {
                wpNumber = so?.wp_number || so?.enquiry_id?.wp_number || job?.wp_number || [];
            }

            let email = form?.email || [];
            if (!email || email.length === 0) {
                email = so?.email || so?.enquiry_id?.email || job?.email || [];
            }

            let finalImage = flow.sales_approval_details?.final_sample_image;

            if (!finalImage && flow.session_state?.sample_cycles) {
                const cycleWithImg = flow.session_state.sample_cycles.slice().reverse().find(c => c.sample_image);
                if (cycleWithImg) finalImage = cycleWithImg.sample_image;
            }

            if (finalImage) {
                try {
                    finalImage = generateSignedUrl(finalImage);
                } catch (e) {
                    console.error("Failed generating signed URL:", e);
                }
            }

            pendingItems.push({
                _id: flow._id,
                shopfloor_job_id: flow.shopfloor_job_id,
                group_id: flow.group_id,
                job_no: flow.job_no,
                sub_job_no: flow.sub_job_no,
                category: flow.category,
                subcategory: flow.subcategory,
                client_name: clientName,
                product_name: productName,
                process_name: job?.process_name || 'Laser Cutting Co2',
                all_processes: uniqueProcessNames.length > 0 ? uniqueProcessNames : [job?.process_name || 'Laser Cutting Co2'],
                bom_sample_status: flow.bom_sample_status || 'AWAITING_SALES_APPROVAL',
                sales_approval_details: flow.sales_approval_details || null,
                final_sample_image: finalImage,
                submitted_at: flow.updatedAt || flow.createdAt,
                sample_cycles: flow.session_state?.sample_cycles || [],
                enquiry_id: enquiryId || null,
                sales_order_id: salesOrderId || null,
                wp_number: Array.isArray(wpNumber) ? wpNumber : (wpNumber ? [wpNumber] : []),
                email: Array.isArray(email) ? email : (email ? [email] : [])
            });

            seenSubJobs.add(subJobKey);
        }

        res.status(200).json({ success: true, count: pendingItems.length, data: pendingItems });
    } catch (error) {
        console.error("getSalesSampleQueue error:", error);
        res.status(500).json({ success: false, message: "Error fetching sales sample queue", error: error.message });
    }
};

// Send dedicated Sample Piece Approval email to customer with sample image & authorization link
export const sendSampleApprovalEmail = async (req, res) => {
    try {
        const {
            shopfloor_job_id,
            group_id,
            sub_job_no,
            job_no,
            enquiry_id,
            sales_order_id,
            recipient_email,
            final_sample_image,
            client_name,
            product_name,
            all_processes
        } = req.body;

        if (!recipient_email || (Array.isArray(recipient_email) && recipient_email.length === 0)) {
            return res.status(400).json({ success: false, message: "Recipient email address is required" });
        }

        const emailList = Array.isArray(recipient_email) ? recipient_email.filter(Boolean).join(",") : recipient_email;
        if (!emailList || emailList.trim() === "") {
            return res.status(400).json({ success: false, message: "Valid recipient email address is required" });
        }

        const emailHTML = await generateEmailTemplateForSampleApproval({
            shopfloor_job_id,
            group_id,
            sub_job_no,
            job_no,
            enquiry_id,
            sales_order_id,
            final_sample_image,
            client_name,
            product_name,
            all_processes
        }, 86400);

        await transporter.sendMail({
            from: `"RD Custom Awards" <${process.env.EMAIL_SENDER}>`,
            to: emailList,
            subject: `Sample Piece Ready for Approval – ${product_name || "Custom Award"} (${sub_job_no || job_no || "Sample"})`,
            html: emailHTML,
        });

        return res.status(200).json({
            success: true,
            message: `Sample approval email sent successfully to ${emailList}`
        });
    } catch (error) {
        console.error("sendSampleApprovalEmail error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to send sample approval email",
            error: error.message
        });
    }
};

