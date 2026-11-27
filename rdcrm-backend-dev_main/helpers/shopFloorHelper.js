import ShopFloorProcessFlow from "../models/shopfloor/shopFloorProcessFlowModel.js";
import shopFloorJobModel from "../models/shopfloor/shopFloorJobModel.js";
import bomModel from "../models/bom/bomModel.js";

/**
 * Validates whether a shop floor job is completed based on strict rule-based verification.
 * A job is completed if and only if:
 * 1. All material groups/line items are completed.
 * 2. For each group: Good Issue Qty >= Target Qty.
 * 3. For each group: There are no active, pending, or incomplete recut cycles.

 * @param {Object} job - The shop floor job document.
 * @returns {Promise<Object>} - An object with { is_completed: boolean, details: Array }
 */
export const verifyJobCompletion = async (job) => {
    if (!job) {
        return { is_completed: false, reason: "No job provided", details: [] };
    }

    const details = [];
    let allGroupsSatisfied = true;

    for (const group of job.material_groups) {
        const groupId = String(group.group_id || group._id);

        // 1. Calculate Target Quantity
        const totalSheets = group.materials?.[0]?.quantity || group.sheets_required || 0;
        const outsourcedSheets = group.assigned_outsource_sheets || 0;

        // Actual qty delivered by vendor (sum of batch_receipts with type=actual)
        const outsourceReceivedQty = (group.outsource_assignments || []).reduce((sum, a) =>
            sum + (a.batch_receipts || []).reduce((bSum, b) =>
                bSum + (b.type === 'actual' ? (Number(b.qty) || 0) : 0), 0), 0);

        // Check inwarded history to see if it's treated as a full in-house run
        const inwardGood = (group.inward_history || []).reduce((acc, log) => acc + (log.good_qty || 0), 0);
        const isInHouseJob = inwardGood >= totalSheets;

        const inHouseSheets = isInHouseJob ? totalSheets : Math.max(0, totalSheets - outsourcedSheets);
        const upsVal = group.materials?.[0]?.material_input?.ups || group.ups || 1;
        const inHouseQty = inHouseSheets * upsVal;

        let bom = null;
        if (job.bom_id) {
            bom = await bomModel.findById(job.bom_id).lean();
        }

        let processIndex = -1;
        let processes = [];
        if (bom && bom.materialprocess) {
            const processGroup = bom.materialprocess.find(
                p => p.material_group_name?.toLowerCase().trim() === group.group_name?.toLowerCase().trim() ||
                    String(p.material_group_id) === String(groupId)
            );
            if (processGroup && processGroup.processes) {
                processes = processGroup.processes;
                processIndex = processes.findIndex(
                    p => p.process_name?.toLowerCase().trim() === job.process_name?.toLowerCase().trim()
                );
            }
        }

        const cuttingIndex = processes.findIndex(p => isLaserProcess(p.process_name, p.department));

        // If exact name match failed but this IS the laser process, ensure it aligns with cuttingIndex
        if (processIndex === -1 && cuttingIndex !== -1 && isLaserProcess(job.process_name, job.department)) {
            processIndex = cuttingIndex;
        }

        const isSheetMaterial = group.materials?.some(m => m.material_type?.toLowerCase() === 'sheet');

        // For mixed outsource+inhouse jobs: in-house target = total job qty minus
        // what the vendor ACTUALLY delivered (not just what was ordered).
        // Using assigned outsource qty here would set inhouse target to 0 when
        // the full job is outsourced but vendor delivered less than needed.
    // eslint-disable-next-line no-unused-vars
        const effectiveOutsourceQty = group.is_outsource
            ? outsourceReceivedQty
            : (outsourcedSheets * upsVal);

        let targetQty;
        if (isSheetMaterial) {
            if (cuttingIndex === -1 || (processIndex !== -1 && processIndex < cuttingIndex)) {
                // Before cutting process: target is sheets
                targetQty = inHouseSheets;
            } else {
                // At or after cutting: target is pieces
                targetQty = isInHouseJob
                    ? (job.total_qty || inHouseQty)
                    : Math.max(0, (job.total_qty || inHouseQty) - (outsourcedSheets * upsVal));
            }
        } else {
            // Non-sheet: target is pieces
            targetQty = isInHouseJob
                ? (job.total_qty || inHouseQty)
                : Math.max(0, (job.total_qty || inHouseQty) - (outsourcedSheets * upsVal));
        }

        let flow = await ShopFloorProcessFlow.findOne({ shopfloor_job_id: job._id, group_id: groupId });
        if (!flow) {
            flow = await ShopFloorProcessFlow.findOne({ shopfloor_job_id: job._id, group_id: 'COMBINED' });
        }

        // 2. Calculate Cumulative Good Issue Qty
        let goodIssueQty = 0;
        if (flow && flow.session_state) {
            const q = flow.session_state.quantities || {};
            const groupQ = q[groupId] || (group?.group_id ? q[group.group_id] : null) || q;

            const rawPCycles = flow.session_state.primary_cycles;
            const pCycles = Array.isArray(rawPCycles) ? rawPCycles : (rawPCycles?.[groupId] || (group?.group_id ? rawPCycles?.[group.group_id] : null) || []);

            const rawRCycles = flow.session_state.recut_cycles;
            const rCycles = Array.isArray(rawRCycles) ? rawRCycles : (rawRCycles?.[groupId] || (group?.group_id ? rawRCycles?.[group.group_id] : null) || []);

            const rawSCycles = flow.session_state.sample_cycles;
            const sCycles = Array.isArray(rawSCycles) ? rawSCycles : (rawSCycles?.[groupId] || (group?.group_id ? rawSCycles?.[group.group_id] : null) || []);

            const totalSampleGoodFromCycles = (Array.isArray(sCycles) ? sCycles : []).reduce((acc, c) => acc + ((c.status === 'Approved' || (Number(c.good_qty) || 0) > 0) ? (Number(c.good_qty) || 0) : 0), 0);
            const totalSampleGoodFromQuantities = Number(groupQ?.sample_good) || Number(q?.sample_good) || 0;
            const totalSampleGood = Math.max(totalSampleGoodFromCycles, totalSampleGoodFromQuantities);
            const totalPrimaryGood = (Array.isArray(pCycles) ? pCycles : []).reduce((acc, c) => acc + (Number(c.good_qty) || 0), 0);

            const recutOptions = Array.isArray(groupQ.selected_recut_option)
                ? groupQ.selected_recut_option
                : (Array.isArray(q.selected_recut_option) ? q.selected_recut_option : []);

            const totalRecutGoodFromOptions = recutOptions.reduce((acc, opt) => {
                const optGood = (opt.cycles || []).reduce((cAcc, c) => cAcc + (Number(c.good_qty) || 0), 0);
                return acc + optGood;
            }, 0);
            const totalRecutGoodFromCycles = (Array.isArray(rCycles) ? rCycles : []).reduce((acc, c) => acc + (Number(c.good_qty) || 0), 0);
            const totalRecutCompleted = Number(groupQ.recut_completed) || Number(q.recut_completed) || 0;
            const totalRecutGood = Math.max(totalRecutGoodFromOptions, totalRecutGoodFromCycles, totalRecutCompleted);

            goodIssueQty = totalSampleGood + totalPrimaryGood + totalRecutGood;
        } else {
            if (group.process_history) {
                group.process_history.forEach(historyItem => {
                    const actionStr = String(historyItem.action || '').toUpperCase();
                    if (actionStr.startsWith('📦') || actionStr.includes('SAMPLE APPROVED') || actionStr.includes('APPROVED') || actionStr.includes('RECUT') || actionStr.includes('REASSEMBLE') || actionStr.includes('HANDED OVER') || actionStr.includes('DONE')) {
                        if (historyItem.details && typeof historyItem.details.good_qty === 'number') {
                            goodIssueQty += historyItem.details.good_qty;
                        } else if (typeof historyItem.good_qty === 'number') {
                            goodIssueQty += historyItem.good_qty;
                        }
                    }
                });
            }
        }

        // For outsource groups: add the vendor-delivered qty so the combined
        // total (inhouse produced + outsource received) is checked against targetQty.
        if (group.is_outsource) {
            goodIssueQty += outsourceReceivedQty;
        }

        // 3. Check for Pending or Incomplete Recut Cycles & Excess Confirmation
        let hasPendingRecuts = false;
        // eslint-disable-next-line no-useless-assignment
        let excessConfirmed = false;
        let recutDetails = { reject: 0, recut_not_inwarded: 0, recut_received: 0, is_active_recut_cycle: false };

        if (flow && flow.session_state) {
            const q = flow.session_state.quantities || {};
            const groupQ = q[groupId] || (group?.group_id ? q[group.group_id] : null) || q;
            const rc = flow.session_state.runningCycles || {};
            const groupRc = rc[groupId] || (group?.group_id ? rc[group.group_id] : null) || rc;
            const ec = flow.session_state.excessConfirmed || {};
            const hes = flow.session_state.haveExcessSheet || {};

            recutDetails.reject = groupQ.reject ?? q.reject ?? 0;
            recutDetails.recut_not_inwarded = groupQ.recut_not_inwarded ?? q.recut_not_inwarded ?? 0;
            recutDetails.recut_received = groupQ.recut_received ?? q.recut_received ?? 0;
            recutDetails.is_active_recut_cycle = !!(groupRc.is_recut && (groupRc.status === 'PRODUCTION_RUNNING' || groupRc.status === 'PRODUCTION_PAUSED'));

            const targetMet = goodIssueQty >= targetQty;
            if (targetMet) {
                if (recutDetails.recut_not_inwarded > 0 || recutDetails.recut_received > 0 || recutDetails.is_active_recut_cycle) {
                    hasPendingRecuts = true;
                }
            } else {
                if (recutDetails.reject > 0 || recutDetails.recut_not_inwarded > 0 || recutDetails.recut_received > 0 || recutDetails.is_active_recut_cycle) {
                    hasPendingRecuts = true;
                }
            }

            const hasExcess = !!(hes[groupId] || hes[group?.group_id] || hes === true);
            const isExcessConfirmed = !!(ec[groupId]?.confirmed || ec[group?.group_id]?.confirmed || ec?.confirmed);
            excessConfirmed = hasExcess ? isExcessConfirmed : true;
        } else {
            excessConfirmed = true;
        }

        const isGroupCompleted = group.status === 'Completed' || ((goodIssueQty >= targetQty) && !hasPendingRecuts && excessConfirmed);
        if (!isGroupCompleted) {
            allGroupsSatisfied = false;
        }

        details.push({
            group_id: groupId,
            group_name: group.group_name,
            good_issue_qty: goodIssueQty,
            target_qty: targetQty,
            has_pending_recuts: hasPendingRecuts,
            recut_details: recutDetails,
            is_completed: isGroupCompleted
        });
    }

    return {
        is_completed: allGroupsSatisfied,
        details
    };
};

export function isLaserProcess(procName, deptName) {
    const name = (procName || "").toLowerCase();
    const dept = (deptName || "").toLowerCase();
    return name.includes("laser") || name.includes("cutting") || name.includes("cut") || name.includes("router") || name.includes("routing") || name.includes("cnc") || dept.includes("laser");
}

export const isUvProcess = (procName, deptName) => {
    const name = (procName || "").toLowerCase();
    const dept = (deptName || "").toLowerCase();
    return name.includes("uv") || name.includes("print") || dept.includes("print") || dept.includes("uv");
};

export const propagateSampleRequirement = async (job, groupId, mgProcessIndex = null) => {
    try {
        const bom = await bomModel.findById(job.bom_id);
        if (!bom || !bom.materialprocess) return;

        const processGroup = bom.materialprocess.find(
            p => String(p.material_group_id) === String(groupId)
        );
        if (!processGroup || !processGroup.processes) return;

        // Check if both laser and uv exist in this processGroup
        const hasLaser = processGroup.processes.some(p => isLaserProcess(p.process_name, p.department));
        const hasUv = processGroup.processes.some(p => isUvProcess(p.process_name, p.department));

        if (hasLaser && hasUv) {
            // Find current process index — prefer process_index exact match
            let currentIdx = -1;
            if (mgProcessIndex) {
                currentIdx = processGroup.processes.findIndex(
                    p => p.process_index === mgProcessIndex
                );
            }
            if (currentIdx === -1) {
                currentIdx = processGroup.processes.findIndex(
                    p => p.process_name?.toLowerCase().trim() === job.process_name?.toLowerCase().trim()
                );
            }
            if (currentIdx !== -1 && currentIdx < processGroup.processes.length - 1) {
                // Find all subsequent processes in the group
                const nextProcs = processGroup.processes.slice(currentIdx + 1);
                for (const nextProc of nextProcs) {
                    const nextJob = await shopFloorJobModel.findOne({
                        sub_job_no: job.sub_job_no,
                        process_name: { $regex: new RegExp(`^${nextProc.process_name.trim()}$`, "i") }
                    });
                    if (nextJob) {
                        // Match target group by both group_id and process_index when available
                        const targetGroup = nextJob.material_groups.find(mg =>
                            String(mg.group_id) === String(groupId) &&
                            (nextProc.process_index ? mg.process_index === nextProc.process_index : true)
                        );
                        if (targetGroup && !targetGroup.sampling_on) {
                            targetGroup.sampling_on = true;
                            nextJob.markModified('material_groups');
                            await nextJob.save();
                        }
                    }
                }
            }
        }
    } catch (err) {
        console.error("propagateSampleRequirement error:", err);
    }
};

