import mongoose from "mongoose";
import shopFloorJobModel from "../../models/shopfloor/shopFloorJobModel.js";
import controlTowerDeptModel from "../../models/controltower/controlTowerModel.js";
import shopFloorRequisitionModel from "../../models/shopfloor/shopFloorRequisitionModel.js";
import dtpStudioModel from "../../models/dtp_studio/dtpStudioModel.js";
import salesorder from "../../models/sales_orders/sales_order_list_Model.js";
import salesorderform from "../../models/sales_orders/sales_order_form_Model.js";
import bomModel from "../../models/bom/bomModel.js";
import enquiryModel from "../../models/enquiry/enquiryModel.js";
import materialIssueModel from "../../models/store/materialIssueModel.js";
import { getCurrentDate } from "../../helpers/dateTime.js";
import { generateSignedUrl, uploadToR2 } from "../../helpers/r2helper.js";
import { nanoid } from "nanoid";
import shopFloorInwardModel from "../../models/shopfloor/shopFloorInwardModel.js";
import itemModel from "../../models/inventory/item/itemModel.js";
import customItemModel from "../../models/inventory/customItem/customItemModel.js";
import shopFloorMaterialReturnModel from "../../models/shopfloor/shopFloorMaterialReturnModel.js";
import readyJobModel from "../../models/shopfloor/shopFloorReadyJobModel.js";
import shopFloorInventoryModel from "../../models/shopfloor/shopFloorInventoryModel.js";
import stockSizeModel from "../../models/inventory/common/stockSizeModel.js";
import crypto from "crypto";
import outsourceVendorModel from "../../models/masters/outsourceVendorModel.js";
import { transporter, generateEmailTemplateForOutsource } from "../../helpers/mail.js";
import ShopFloorProcessFlow from "../../models/shopfloor/shopFloorProcessFlowModel.js";
import { verifyJobCompletion, isLaserProcess } from "../../helpers/shopFloorHelper.js";
import { generateWhatsAppOutsourceTextMessage } from "../../helpers/whatsappRfqTemplate.js";
import fetch from "node-fetch";
import { checkAndCreateFgStoreForSubJob } from "../controltower/fgStoreController.js";
import { recalculateBOMForNewQty } from "../bom/bomController.js";

const sendOutsourceAssignmentWhatsApp = async (job, group, assignment) => {
    try {
        const vendor = await outsourceVendorModel.findById(assignment.vendor_id).lean();
        if (!vendor || !vendor.whatsapp_no) {
            console.warn(`[Outsource WhatsApp] Vendor not found or missing WhatsApp number for ID: ${assignment.vendor_id}`);
            return;
        }

        const clientUrl = process.env.CLIENT_CONFIRMATION_SCREEN_URL || "http://localhost:5173";
        const viewLink = `${clientUrl}/outsource/confirmation/${assignment.token}`;

        let phone = String(vendor.whatsapp_no).trim().replace(/\D/g, "");
        if (phone.length === 10) {
            phone = "91" + phone;
        }

        const textMessage = generateWhatsAppOutsourceTextMessage(job, group, assignment, viewLink);

        const apiKey = process.env.TWOFACTOR_WHATSAPP_API_KEY;
        const url = process.env.TWOFACTOR_WHATSAPP_OUTSOURCE_ASSIGNMENT_REQUEST_URL;

        if (apiKey) {
            const payload = {
                receiver: phone,
                values: {
                    "1": vendor.name || "Vendor",
                    "2": viewLink
                }
            };
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (response.ok && data.status !== 'error') {
                console.log(`[Outsource WhatsApp] API sent successfully to ${phone}:`, data);
            } else {
                console.error(`[Outsource WhatsApp] API failed for ${phone}:`, data);
            }
        } else {
            console.log(`[Outsource WhatsApp Dev Fallback] WhatsApp config missing. Message preview:\n${textMessage}`);
        }
    } catch (err) {
        console.error(`[Outsource WhatsApp] Failed to send WhatsApp:`, err);
    }
};

const sendOutsourceAssignmentEmail = async (job, group, assignment) => {
    try {
        const vendor = await outsourceVendorModel.findById(assignment.vendor_id).lean();
        if (!vendor || !vendor.email) {
            console.warn(`[Outsource Email] Vendor not found or missing email for ID: ${assignment.vendor_id}`);
            return;
        }

        const clientUrl = process.env.CLIENT_CONFIRMATION_SCREEN_URL || "http://localhost:5173";
        const emailHtml = generateEmailTemplateForOutsource(job, group, assignment, clientUrl);

        await transporter.sendMail({
            from: `RD Custom Awards <${process.env.EMAIL_SENDER}>`,
            to: vendor.email,
            subject: `Outsource Assignment Request: Job ${job.job_no} — RD Custom Awards`,
            html: emailHtml,
        });
        console.log(`[Outsource Email] Sent successfully to ${vendor.email} for assignment token ${assignment.token}`);
    } catch (err) {
        console.error(`[Outsource Email] Failed to send email:`, err);
    }
};


export const updateGroupProgress = async (group, jobId, groupId, flowData = null) => {
    if (group.status === 'Completed') {
        group.progress = 100;
        return;
    }

    // Determine the max stage index across all assignments
    const maxStage = (group.outsource_assignments || []).reduce((max, a) => Math.max(max, a.current_stage_idx || 0), 0);

    const mainMat = group.materials?.find(m => {
        const cat = m.category_type?.toLowerCase() || '';
        return !cat.includes('consumable') && !cat.includes('hardware');
    });

    let totalRequiredSheets = group.process_qty || mainMat?.quantity || group.sheets_required || 0;
    const ups = mainMat?.material_input?.ups || group.ups || 1;
    let totalRequiredUps = totalRequiredSheets * ups;

    if (totalRequiredUps <= 0) {
        group.progress = 0;
        return;
    }


    const assignedOutsourceUps = group.assigned_outsource_ups || 0;
    let assignedInhouseUps = Math.max(0, totalRequiredUps - assignedOutsourceUps);

    // In-house processed qty (exclude System / Inward logs, read from DB ProcessFlow when available)
    let inhouseProduced;
    let isSheetTarget = false;
    if (jobId && groupId) {
        try {
            const job = await shopFloorJobModel.findById(jobId).lean();
            if (job) {
                let bom = null;
                if (job.bom_id) {
                    if (typeof job.bom_id === 'object' && job.bom_id.materialprocess) {
                        bom = job.bom_id;
                    } else {
                        bom = await bomModel.findById(job.bom_id).lean();
                    }
                }
                if (bom && bom.materialprocess) {
                    const processGroup = bom.materialprocess.find(
                        p => p.material_group_name?.toLowerCase().trim() === group.group_name?.toLowerCase().trim() ||
                            String(p.material_group_id) === String(group.group_id || group._id)
                    );
                    if (processGroup && processGroup.processes) {
                        const processes = processGroup.processes;
                        let processIndex = group.process_index
                            ? processes.findIndex(p => p.process_index === group.process_index)
                            : processes.findIndex(p => p.process_name?.toLowerCase().trim() === job.process_name?.toLowerCase().trim());

                        const cuttingIndex = processes.findIndex(p => isLaserProcess(p.process_name));
                        const isSheetMaterial = mainMat?.material_type === 'sheet';

                        if (isLaserProcess(job.process_name)) {
                            // Laser process takes sheet input and gives pieces output.
                            isSheetTarget = false;
                        } else if (cuttingIndex !== -1 && processIndex !== -1) {
                            const isBeforeCutting = processIndex < cuttingIndex;
                            isSheetTarget = isSheetMaterial && isBeforeCutting;
                        } else if (cuttingIndex === -1 && isSheetMaterial) {
                            isSheetTarget = true;
                        }
                    }
                }
                if (job.total_qty) {
                    totalRequiredUps = isSheetTarget ? totalRequiredUps : job.total_qty;
                    assignedInhouseUps = Math.max(0, totalRequiredUps - assignedOutsourceUps);
                }
            }

            let flow = flowData || await ShopFloorProcessFlow.findOne({ shopfloor_job_id: jobId, group_id: groupId });
            if (!flow) {
                flow = await ShopFloorProcessFlow.findOne({ shopfloor_job_id: jobId, group_id: 'COMBINED' });
            }

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

                inhouseProduced = totalSampleGood + totalPrimaryGood + totalRecutGood;
            } else {
                inhouseProduced = (group.process_history || []).reduce((sum, log) => {
                    if (log.action === 'CONSOLE READY' || log.activity_type === 'System' || log.activity_type === 'Sampling' || log.activity_type === 'sampling') return sum;
                    return sum + (log.details?.good_qty || log.good_qty || 0);
                }, 0);
            }
        } catch (flowErr) {
            console.error("Failed to query ShopFloorProcessFlow in updateGroupProgress:", flowErr);
            inhouseProduced = (group.process_history || []).reduce((sum, log) => {
                if (log.action === 'CONSOLE READY' || log.activity_type === 'System' || log.activity_type === 'Sampling' || log.activity_type === 'sampling') return sum;
                return sum + (log.details?.good_qty || log.good_qty || 0);
            }, 0);
        }
    } else {
        inhouseProduced = (group.process_history || []).reduce((sum, log) => {
            if (log.action === 'CONSOLE READY' || log.activity_type === 'System' || log.activity_type === 'Sampling' || log.activity_type === 'sampling') return sum;
            return sum + (log.details?.good_qty || log.good_qty || 0);
        }, 0);
    }

    // Outsource received qty
    const totalReceived = (group.outsource_assignments || []).reduce((sum, assign) => {
        return sum + (assign.batch_receipts || []).reduce((bSum, batch) => {
            return bSum + (batch.type === 'actual' ? (batch.qty || 0) : 0);
        }, 0);
    }, 0);

    const effectiveInhouseProduced = isSheetTarget ? (inhouseProduced * ups) : inhouseProduced;

    let inhouseProgress = 0;
    if (assignedInhouseUps > 0) {
        inhouseProgress = Math.min(100, (effectiveInhouseProduced / assignedInhouseUps) * 100);
    } else if (assignedOutsourceUps === 0) {
        inhouseProgress = Math.min(100, (effectiveInhouseProduced / totalRequiredUps) * 100);
    }

    let outsourceProgress = 0;
    if (assignedOutsourceUps > 0) {
        // Use actual received qty for progress, NOT just the outsource stage.
        // Stage 6 (Invoice Approved) is an admin closure — but if the vendor
        // delivered fewer pieces than ordered, the remaining shortfall must be
        // fulfilled in-house. Stage progress is capped at qty-based progress
        // when totalReceived < totalRequiredUps, so it can never artificially
        // push group.progress to 100 while there is still an unfulfilled balance.
        const qtyProgressVal = (totalReceived / assignedOutsourceUps) * 100;
        const stageProgressVal = (maxStage === 6) ? 100 : (((maxStage + 1) / 7) * 100);
        // If the vendor delivered less than the full job requirement, cap stage
        // progress at the actual qty-based progress so overall cannot reach 100.
        const effectiveStageProgress = (totalReceived < totalRequiredUps)
            ? Math.min(stageProgressVal, qtyProgressVal)
            : stageProgressVal;
        outsourceProgress = Math.min(100, Math.max(qtyProgressVal, effectiveStageProgress));
        if (maxStage !== 6 && outsourceProgress >= 100) outsourceProgress = 99;
    }

    const inhouseWeight = assignedInhouseUps / totalRequiredUps;
    const outsourceWeight = assignedOutsourceUps / totalRequiredUps;

    const totalProgress = (inhouseProgress * inhouseWeight) + (outsourceProgress * outsourceWeight);

    const totalActualProduced = totalReceived + effectiveInhouseProduced;
    const allWorkDone = totalActualProduced >= totalRequiredUps;

    // Mixed jobs progress shouldn't be stuck below 100% when total target is met or exceeded
    const qtyBasedProgress = Math.min(100, Math.round((totalActualProduced / totalRequiredUps) * 100));
    group.progress = Math.min(100, Math.max(Math.round(totalProgress), qtyBasedProgress));

    if (group.progress >= 100 && allWorkDone) {
        group.status = 'Completed';
    } else if (group.progress > 0) {
        group.status = 'In Progress';
    }
};

const updateJobOverallProgress = (job) => {
    if (!job.material_groups || job.material_groups.length === 0) return;
    const totalProgress = job.material_groups.reduce((acc, mg) => acc + (mg.progress || 0), 0);
    job.progress = Math.round(totalProgress / job.material_groups.length);

    const allGroupsCompleted = job.material_groups.every(mg => mg.status === 'Completed' || (mg.progress || 0) >= 100);

    if ((allGroupsCompleted || job.progress >= 100) && job.status !== 'Completed') {
        job.status = 'Completed';
    } else if (!allGroupsCompleted && job.progress < 100 && job.status === 'Completed') {
        job.status = 'In Progress';
    }
};

// Add this function before signJobUrls
const injectSheetIssueStatus = async (jobInput, relatedJobsMap = null, readyJobsMap = null) => {
    const isArray = Array.isArray(jobInput);
    const jobs = isArray ? jobInput : [jobInput];

    const processedJobs = await Promise.all(jobs.map(async (job) => {
        if (!job || !job.material_groups?.length) return job;

        const isSampleJob = (job.job_type || '').toLowerCase() === 'sample' || (job.category || '').toLowerCase() === 'sample';

        const issuedMap = {};
        let storeIssue = null;
        if (job.store_material_issue_id) {
            if (job.store_material_issue_id.materials) {
                storeIssue = job.store_material_issue_id;
            } else {
                storeIssue = await materialIssueModel.findById(job.store_material_issue_id).lean();
            }
        }

        if (storeIssue && storeIssue.materials) {
            storeIssue.materials.forEach(m => {
                const itemIdStr = String(m.item_id || m._id);
                issuedMap[itemIdStr] = {
                    issued_qty: Number(m.issued_qty) || 0,
                    returned_qty: Number(m.returned_qty) || 0,
                };
            });
        }

        // To verify sequence and preceding job's status, let's fetch the BOM
        let bom = null;
        if (job.bom_id) {
            if (typeof job.bom_id === 'object' && (job.bom_id.materialprocess || job.bom_id.material_groups)) {
                bom = job.bom_id;
            } else {
                bom = await bomModel.findById(job.bom_id);
            }
        }

        job.material_groups = await Promise.all(job.material_groups.map(async (mg) => {
            // Look up this group's processes in the BOM
            let processIndex = -1;
            let processes = [];
            let precedingJobs = [];
            if (bom && bom.materialprocess) {
                const processGroup = bom.materialprocess.find(
                    p => p.material_group_name?.toLowerCase().trim() === mg.group_name?.toLowerCase().trim() ||
                        String(p.material_group_id) === String(mg.group_id || mg._id)
                );
                if (processGroup && processGroup.processes) {
                    processes = processGroup.processes;
                    // If this material group entry has a specific process_index (e.g., "3.2"),
                    // use it to find the exact BOM process position — critical when the same
                    // process name appears multiple times in the same group.
                    if (mg.process_index) {
                        processIndex = processes.findIndex(
                            p => p.process_index === mg.process_index
                        );
                    }
                    // Fallback: match by process name (first occurrence)
                    if (processIndex === -1) {
                        processIndex = processes.findIndex(
                            p => p.process_name?.toLowerCase().trim() === job.process_name?.toLowerCase().trim()
                        );
                    }
                }
            }

            const isCuttingProcess = (procName) => {
                return isLaserProcess(procName);
            };

            let isUnlocked = true;
            let lockedReason = "";

            const currentProc = processIndex !== -1 ? processes[processIndex] : null;

            if (currentProc && processes.length > 0) {
                const precedingProcsInGroup = processes.slice(0, processIndex);

                if (precedingProcsInGroup.length > 0) {
                    for (const prevProc of precedingProcsInGroup) {
                        const isDtpProc = (prevProc.process_name || "").toLowerCase().includes("dtp") || (prevProc.department || "").toLowerCase().includes("dtp");
                        if (isDtpProc) {
                            if (isSampleJob) {
                                // Sample jobs bypass DTP Studio
                                continue;
                            }
                            const dtpJob = await dtpStudioModel.findOne({ sub_job_no: job.sub_job_no }).lean();
                            const dtpCompleted = dtpJob && (dtpJob.status === 'Completed' || dtpJob.status === 'Shop Floor');
                            if (!dtpCompleted) {
                                isUnlocked = false;
                                lockedReason = "Waiting for DTP Studio completion";
                            }
                        } else {
                            let prevJob;
                            if (relatedJobsMap) {
                                const key = `${job.sub_job_no?.trim().toLowerCase()}|${prevProc.process_name?.trim().toLowerCase()}`;
                                prevJob = relatedJobsMap[key] || null;
                            } else {
                                prevJob = await shopFloorJobModel.findOne({
                                    sub_job_no: job.sub_job_no,
                                    process_name: { $regex: new RegExp(`^${prevProc.process_name.trim()}$`, "i") }
                                });
                            }

                            if (prevJob) {
                                precedingJobs.push(prevJob);

                                // Check if this preceding job has handed over any quantity for this material group
                                let hasHandover = false;
                                let prevReadyJob;
                                if (readyJobsMap) {
                                    prevReadyJob = readyJobsMap[String(prevJob._id)] || null;
                                } else {
                                    prevReadyJob = await readyJobModel.findOne({ shopfloor_job_id: prevJob._id });
                                }
                                if (prevReadyJob) {
                                    const prevLineItem = prevReadyJob.line_items?.find(
                                        item => String(item.group_id) === String(mg.group_id || mg._id) ||
                                            item.material_name?.toLowerCase().trim() === mg.group_name?.toLowerCase().trim()
                                    );
                                    if (prevLineItem) {
                                        hasHandover = (prevLineItem.cycles || []).some(c => c.handed_over || (c.good_qty || 0) > 0);
                                    }
                                }

                                if (!hasHandover && prevJob.material_groups) {
                                    const prevMg = prevJob.material_groups.find(
                                        g => String(g.group_id || g._id) === String(mg.group_id || mg._id) ||
                                            g.group_name?.toLowerCase().trim() === mg.group_name?.toLowerCase().trim()
                                    );
                                    if (prevMg && prevMg.process_history) {
                                        hasHandover = prevMg.process_history.some(log => (log.action || '').includes('HANDED OVER') || (log.details?.good_qty || 0) > 0);
                                    }
                                }

                                if (prevJob.status !== 'Completed' && !hasHandover) {
                                    isUnlocked = false;
                                    lockedReason = `Waiting for preceding process: ${prevProc.process_name}`;
                                }
                            }
                        }
                    }
                }
            }

            // Compute status for all processes in this material group
            const processStatuses = await Promise.all(processes.map(async (proc, pIdx) => {
                let procJob;
                if (proc.process_name?.toLowerCase().trim() === job.process_name?.toLowerCase().trim()) {
                    procJob = job;
                } else if (relatedJobsMap) {
                    const key = `${job.sub_job_no?.trim().toLowerCase()}|${proc.process_name?.trim().toLowerCase()}`;
                    procJob = relatedJobsMap[key] || null;
                } else {
                    procJob = await shopFloorJobModel.findOne({
                        sub_job_no: job.sub_job_no,
                        process_name: { $regex: new RegExp(`^${proc.process_name.trim()}$`, "i") }
                    }).lean();
                }

                let hasHandover = false;
                if (procJob) {
                    let readyJob;
                    if (readyJobsMap) {
                        readyJob = readyJobsMap[String(procJob._id)] || null;
                    } else {
                        readyJob = await readyJobModel.findOne({ shopfloor_job_id: procJob._id }).lean();
                    }
                    if (readyJob) {
                        const lineItem = readyJob.line_items?.find(
                            item => String(item.group_id) === String(mg.group_id || mg._id) ||
                                item.material_name?.toLowerCase().trim() === mg.group_name?.toLowerCase().trim()
                        );
                        if (lineItem) {
                            hasHandover = (lineItem.cycles || []).some(c => c.handed_over || (c.good_qty || 0) > 0);
                        }
                    }
                    if (!hasHandover && procJob.material_groups) {
                        const procMg = procJob.material_groups.find(
                            g => String(g.group_id || g._id) === String(mg.group_id || mg._id) ||
                                g.group_name?.toLowerCase().trim() === mg.group_name?.toLowerCase().trim()
                        );
                        if (procMg && procMg.process_history) {
                            hasHandover = procMg.process_history.some(log => (log.action || '').includes('HANDED OVER') || (log.details?.good_qty || 0) > 0);
                        }
                    }
                }

                const isCompleted = procJob ? (procJob.status === 'Completed') : false;
                return {
                    process_name: proc.process_name,
                    status: procJob ? procJob.status : 'Pending',
                    is_completed: isCompleted,
                    has_handover: hasHandover,
                    is_current: pIdx === processIndex,
                    is_preceding: pIdx < processIndex
                };
            }));

            mg.process_statuses = processStatuses;
            mg.is_unlocked = isUnlocked;
            mg.locked_reason = lockedReason;

            const sheetMaterials = (mg.materials || []).filter(m => {
                const cat = m.category_type?.toLowerCase() || '';
                const type = m.material_type?.toLowerCase() || '';
                // Exclude consumable/hardware categories
                if (cat.includes('consumable') || cat.includes('hardware')) return false;
                // Only track valid material types (sheet, direct, unit, etc.)
                return type === 'sheet' || type === 'direct' || type === 'unit' || type === 'pcs';
            });

            if (sheetMaterials.length === 0) {
                mg.sheet_issue_status = [];
                mg.all_sheets_issued = true;
                const baseQty = mg.process_qty || 0;
                mg.max_inspectable_qty = baseQty;
                return mg;
            }

            // Total inward GOOD qty already received
            // For sampling_on groups, exclude automated handover entries so the operator can still do manual QC
            const inwardHistory = mg.inward_history || [];
            const totalGoodInward = inwardHistory
                .filter(log => !mg.sampling_on || !(log.remarks || '').includes('Automated handover inward'))
                .reduce((acc, log) => acc + (Number(log.good_qty) || 0), 0);

            const totalInspectedInward = inwardHistory
                .filter(log => !mg.sampling_on || !(log.remarks || '').includes('Automated handover inward'))
                .reduce((acc, log) => acc + (Number(log.inspect_qty) || (Number(log.good_qty) + Number(log.bad_qty)) || 0), 0);

            const sheetIssueStatus = await Promise.all(sheetMaterials.map(async (m) => {
                let netIssued;
                let grossIssued;
                let requiredQty;
                let sourceLabel = "Store Issue";
                let inwardUnit;
                let targetQty;

                const ups = Number(m.material_input?.ups || mg.ups || 1);
                const outsourcedSheets = mg.assigned_outsource_sheets || 0;
                const totalSheets = m.quantity || mg.sheets_required || 1;
                const sheetsReqd = Math.max(0, totalSheets - outsourcedSheets);

                const cuttingIndex = processes.findIndex(p => isCuttingProcess(p.process_name));
                let resolvedProcessIndex = processIndex;
                if (resolvedProcessIndex === -1) {
                    const isCutting = isCuttingProcess(job.process_name);
                    resolvedProcessIndex = isCutting ? 0 : 1;
                }

                let resolvedCuttingIndex = cuttingIndex;
                if (resolvedCuttingIndex === -1) {
                    const hasAnyCutting = processes.some(p => isCuttingProcess(p.process_name)) || isCuttingProcess(job.process_name);
                    resolvedCuttingIndex = hasAnyCutting ? processes.findIndex(p => isCuttingProcess(p.process_name)) : -1;
                }


                if (m.material_type === 'sheet') {
                    if (resolvedCuttingIndex === -1) {
                        // No cutting process in the group. Everything is sheets.
                        inwardUnit = 'sh';
                        requiredQty = sheetsReqd;
                        targetQty = sheetsReqd;
                    } else if (resolvedProcessIndex < resolvedCuttingIndex) {
                        // Before cutting process. Input: sheets, Output: sheets.
                        inwardUnit = 'sh';
                        requiredQty = sheetsReqd;
                        targetQty = sheetsReqd;
                    } else if (resolvedProcessIndex === resolvedCuttingIndex) {
                        // Cutting process. Input: sheets, Output: pieces.
                        inwardUnit = 'sh';
                        requiredQty = sheetsReqd;
                        targetQty = (isSampleJob && job.total_qty > 0) ? job.total_qty : (sheetsReqd * ups);
                    } else {
                        // After cutting process. Input: pieces, Output: pieces.
                        inwardUnit = 'pcs';
                        const effectivePcs = (isSampleJob && job.total_qty > 0) ? job.total_qty : (sheetsReqd * ups);
                        requiredQty = effectivePcs;
                        targetQty = effectivePcs;
                    }
                } else {
                    // Non-sheet materials (like direct, unit, etc.) are already in pieces/units.
                    inwardUnit = 'pcs';
                    const effectivePcs = (isSampleJob && job.total_qty > 0) ? job.total_qty : sheetsReqd;
                    requiredQty = effectivePcs;
                    targetQty = effectivePcs;
                }

                if (resolvedProcessIndex <= 0) {
                    // First process in group: source is store issue
                    const isReprocess = job.is_reprocess || (job.sub_job_no && job.sub_job_no.includes('-R'));
                    const isSampleJob = (job.job_type || '').toLowerCase() === 'sample' || (job.category || '').toLowerCase() === 'sample';
                    if (isReprocess) {
                        let parentJobId = job.parent_job_id;
                        if (!parentJobId && job.sub_job_no && job.sub_job_no.includes('-R')) {
                            const baseSubJobNo = job.sub_job_no.split('-R')[0];
                            const parentJobObj = await shopFloorJobModel.findOne({
                                sub_job_no: baseSubJobNo,
                                process_name: job.process_name
                            }).lean();
                            if (parentJobObj) {
                                parentJobId = parentJobObj._id;
                            }
                        }

                        const groupIds = [String(mg._id)];
                        if (mg.group_id) groupIds.push(String(mg.group_id));

                        const reqQuery = {
                            type: 'Reprocess',
                            group_id: { $in: groupIds },
                            status: { $in: ['ISSUED', 'PARTIAL', 'RECEIVED'] }
                        };
                        if (parentJobId) {
                            reqQuery.$or = [
                                { shopfloor_job_id: parentJobId },
                                { shopfloor_job_id: job._id }
                            ];
                        } else {
                            const baseNo = job.sub_job_no ? job.sub_job_no.split('-R')[0] : job.job_no;
                            reqQuery.$or = [
                                { job_no: baseNo },
                                { job_no: job.sub_job_no }
                            ];
                        }

                        const matchingReq = await shopFloorRequisitionModel.findOne(reqQuery).sort({ createdAt: -1 }).lean();
                        grossIssued = matchingReq ? (Number(matchingReq.issued_qty) || 0) : 0;
                        netIssued = grossIssued;
                    } else if (isSampleJob) {
                        const issue = issuedMap[String(m.item_id)] || issuedMap[m.item_id] || {};
                        const storeIssued = Number(issue.good_qty || issue.issued_qty) || 0;
                        if (storeIssued > 0) {
                            grossIssued = storeIssued;
                            netIssued = grossIssued - (Number(issue.returned_qty) || 0);
                            sourceLabel = "Store Issue";
                        } else {
                            const groupIds = [String(mg._id)];
                            if (mg.group_id) groupIds.push(String(mg.group_id));

                            const itemIds = [String(m.item_id), String(m._id)].filter(id => id && mongoose.Types.ObjectId.isValid(id));
                            const escapeRegex = s => (s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            const matName = m.material_name?.trim();

                            const jobOrConditions = [
                                { shopfloor_job_id: job._id },
                                ...(job.sub_job_no ? [{ job_no: job.sub_job_no }] : []),
                                ...(job.job_no ? [{ job_no: job.job_no }] : [])
                            ];

                            const matOrConditions = [];
                            if (itemIds.length > 0) {
                                matOrConditions.push({ item_id: { $in: itemIds } });
                            }
                            if (matName) {
                                matOrConditions.push({ item_description: { $regex: new RegExp(`^${escapeRegex(matName)}$`, 'i') } });
                            }
                            if (sheetMaterials.length === 1) {
                                matOrConditions.push({ group_id: { $in: groupIds } });
                            }

                            const reqQuery = {
                                type: { $in: ['Sample Material', 'Extra Material', 'Reprocess'] },
                                status: { $in: ['ISSUED', 'PARTIAL', 'RECEIVED'] },
                                $or: jobOrConditions
                            };

                            if (matOrConditions.length > 0) {
                                reqQuery.$and = [{ $or: matOrConditions }];
                            }

                            const matchingReqs = await shopFloorRequisitionModel.find(reqQuery).lean();
                            const totalReqIssued = matchingReqs.reduce((sum, r) => sum + (Number(r.issued_qty) || 0), 0);
                            grossIssued = totalReqIssued;
                            netIssued = grossIssued;
                            sourceLabel = totalReqIssued > 0 ? "Store Requisition" : "Floor Stock / Requisition";
                        }
                    } else {
                        const issue = issuedMap[String(m.item_id)] || issuedMap[m.item_id] || {};
                        grossIssued = Number(issue.good_qty || issue.issued_qty) || 0;
                        netIssued = grossIssued - (Number(issue.returned_qty) || 0);
                    }
                } else {
                    // Subsequent process: source is the handover from preceding process(es)
                    sourceLabel = "Preceding Process Handover";
                    let totalHandedOver = 0;
                    // Iterate backwards to find the closest preceding process that actually processes this material group
                    for (let i = precedingJobs.length - 1; i >= 0; i--) {
                        const prevJob = precedingJobs[i];

                        // Check if this prevJob includes this material group
                        const includesMg = prevJob.material_groups?.some(g =>
                            String(g._id || g.group_id) === String(mg.group_id || mg._id) ||
                            g.group_name?.toLowerCase().trim() === mg.group_name?.toLowerCase().trim()
                        );

                        if (includesMg) {
                            let prevReadyJob;
                            if (readyJobsMap) {
                                prevReadyJob = readyJobsMap[String(prevJob._id)] || null;
                            } else {
                                prevReadyJob = await readyJobModel.findOne({ shopfloor_job_id: prevJob._id });
                            }

                            const prevLineItem = prevReadyJob?.line_items?.find(
                                item => String(item.group_id) === String(mg.group_id || mg._id) ||
                                    item.material_name?.toLowerCase().trim() === mg.group_name?.toLowerCase().trim()
                            );
                            if (prevLineItem) {
                                totalHandedOver = (prevLineItem.cycles || [])
                                    .filter(c => c.handed_over || (c.good_qty || 0) > 0)
                                    .reduce((acc, c) => acc + (c.good_qty || 0), 0);
                            }
                            if (totalHandedOver === 0 && prevJob.material_groups) {
                                const prevMg = prevJob.material_groups.find(
                                    g => String(g.group_id || g._id) === String(mg.group_id || mg._id) ||
                                        g.group_name?.toLowerCase().trim() === mg.group_name?.toLowerCase().trim()
                                );
                                if (prevMg && prevMg.process_history) {
                                    totalHandedOver = prevMg.process_history
                                        .filter(log => (log.action || '').includes('HANDED OVER') || log.activity_type === 'production')
                                        .reduce((acc, log) => acc + (log.good_qty || log.details?.good_qty || 0), 0);
                                }
                            }
                            break; // We found the immediate preceding source for this material group
                        }
                    }
                    grossIssued = totalHandedOver;
                    netIssued = totalHandedOver;
                }

                // How much of this material's issued qty is still unused
                const pendingQty = Math.max(0, grossIssued - totalInspectedInward);

                // How much still needed to complete the job
                const remainingRequired = Math.max(0, requiredQty - totalGoodInward);

                // Balance still to be issued/received
                const balanceQty = Math.max(0, requiredQty - netIssued);

                return {
                    item_id: m.item_id,
                    material_name: m.material_name,
                    unit: inwardUnit,
                    required_qty: requiredQty,
                    target_qty: targetQty,
                    inward_good_qty: totalGoodInward,
                    pending_qty: pendingQty,
                    remaining_required: remainingRequired,
                    issued_qty: netIssued,
                    balance_qty: balanceQty,
                    has_issued: remainingRequired === 0 ? true : netIssued > 0,
                    source_label: sourceLabel
                };
            }));

            const minPending = sheetIssueStatus.length > 0 ? Math.min(...sheetIssueStatus.map(s => Math.min(s.pending_qty, s.remaining_required))) : 0;
            mg.max_inspectable_qty = minPending;
            mg.sheet_issue_status = sheetIssueStatus;
            mg.all_sheets_issued = sheetIssueStatus.every(s => s.has_issued);

            return mg;
        }));

        return job;
    }));

    return isArray ? processedJobs : processedJobs[0];
};

export const signJobUrlsList = async (job, relatedJobsMap = null, readyJobsMap = null, reprocessJobIdsSet = null) => {
    if (!job) return null;
    const obj = typeof job.toObject === 'function' ? job.toObject() : job;

    await injectSheetIssueStatus(obj, relatedJobsMap, readyJobsMap);
    if (!obj.product_image) {
        if (obj.sales_order_id?.image) {
            obj.product_image = obj.sales_order_id.image;
        } else if (Array.isArray(obj.sales_order_id?.product_images) && obj.sales_order_id.product_images.length > 0) {
            obj.product_image = obj.sales_order_id.product_images[0];
        } else if (obj.dtp_id?.image) {
            obj.product_image = obj.dtp_id.image;
        } else if (obj.dtp_id?.product_image) {
            obj.product_image = obj.dtp_id.product_image;
        }
    }
    if (obj.product_image) {
        obj.product_image = generateSignedUrl(obj.product_image);
    }

    if (obj.material_groups) {
        obj.material_groups.forEach(mg => {
            if (mg.outsource_assignments) {
                mg.outsource_assignments.forEach(assign => {
                    if (assign.invoice_url) {
                        assign.invoice_url = generateSignedUrl(assign.invoice_url);
                    }
                    if (Array.isArray(assign.invoices)) {
                        assign.invoices.forEach(inv => {
                            if (inv.invoice_url) {
                                inv.invoice_url = generateSignedUrl(inv.invoice_url);
                            }
                        });
                    }
                });
            }
        });
    }

    if (!obj.is_reprocess) {
        if (reprocessJobIdsSet) {
            if (reprocessJobIdsSet.has(String(obj._id))) {
                obj.is_reprocess = true;
            }
        } else {
            const reprocessReq = await shopFloorRequisitionModel.findOne({
                type: "Reprocess",
                shopfloor_job_id: obj._id,
                status: { $ne: "REJECTED" }
            }).select("_id").lean();
            if (reprocessReq) {
                obj.is_reprocess = true;
            }
        }
    }

    return obj;
};

export const signJobUrls = async (job, relatedJobsMap = null, readyJobsMap = null) => {
    if (!job) return null;
    const obj = typeof job.toObject === 'function' ? job.toObject() : job;

    // Build maps in bulk for single job update if they are not provided
    if (!relatedJobsMap && obj.sub_job_no) {
        const allRelatedJobs = await shopFloorJobModel.find({ sub_job_no: obj.sub_job_no });
        relatedJobsMap = {};
        for (const j of allRelatedJobs) {
            if (j.sub_job_no && j.process_name) {
                const key = `${j.sub_job_no.trim().toLowerCase()}|${j.process_name.trim().toLowerCase()}`;
                relatedJobsMap[key] = j;
            }
        }

        const relatedJobIds = allRelatedJobs.map(j => j._id);
        const readyJobs = relatedJobIds.length > 0
            ? await readyJobModel.find({ shopfloor_job_id: { $in: relatedJobIds } })
            : [];

        readyJobsMap = {};
        for (const rj of readyJobs) {
            if (rj.shopfloor_job_id) {
                readyJobsMap[String(rj.shopfloor_job_id)] = rj;
            }
        }
    }

    await injectSheetIssueStatus(obj, relatedJobsMap, readyJobsMap);
    if (!obj.product_image) {
        if (obj.sales_order_id?.image) {
            obj.product_image = obj.sales_order_id.image;
        } else if (Array.isArray(obj.sales_order_id?.product_images) && obj.sales_order_id.product_images.length > 0) {
            obj.product_image = obj.sales_order_id.product_images[0];
        } else if (obj.dtp_id?.image) {
            obj.product_image = obj.dtp_id.image;
        } else if (obj.dtp_id?.product_image) {
            obj.product_image = obj.dtp_id.product_image;
        }
    }
    if (obj.product_image) {
        obj.product_image = generateSignedUrl(obj.product_image);
    }

    if (obj.dtp_id) {
        const dtp = obj.dtp_id;

        // Sign artwork files
        if (dtp.artwork_files) {
            dtp.artwork_files = dtp.artwork_files.map(f => generateSignedUrl(f));
            // Map to top level for OperatorView
            obj.artwork_pdf = dtp.artwork_files.find(f => f.toLowerCase().includes('.pdf'));
            obj.artwork_cdr = dtp.artwork_files.find(f => f.toLowerCase().includes('.cdr') || f.toLowerCase().includes('.ai'));
            obj.additional_files = dtp.artwork_files.filter(f => f !== obj.artwork_pdf && f !== obj.artwork_cdr);
        }

        if (dtp.final_prep_files) {
            dtp.final_prep_files.forEach(fp => {
                if (fp.production_files) {
                    fp.production_files.forEach(f => {
                        if (f.file_url) f.file_url = generateSignedUrl(f.file_url);
                    });
                }
                if (fp.reference_images) {
                    fp.reference_images.forEach(f => {
                        if (f.file_url) f.file_url = generateSignedUrl(f.file_url);
                    });
                }
            });
            // Map to top level
            obj.final_prep_files = dtp.final_prep_files;
        }
        if (dtp.accounting_details?.processing_files) {
            dtp.accounting_details.processing_files.forEach(f => {
                if (f.file_url) f.file_url = generateSignedUrl(f.file_url);
            });
        }
    }

    if (obj.material_groups) {
        obj.material_groups.forEach(mg => {
            if (mg.final_prep_file) {
                const fp = mg.final_prep_file;
                if (fp.production_files) {
                    fp.production_files.forEach(f => {
                        if (f.file_url) f.file_url = generateSignedUrl(f.file_url);
                    });
                }
                if (fp.reference_images) {
                    fp.reference_images.forEach(f => {
                        if (f.file_url) f.file_url = generateSignedUrl(f.file_url);
                    });
                }
            }
            // Sign Sales Order Process File
            if (mg.sales_order_process_file) {
                const pf = mg.sales_order_process_file;
                if (pf.production_file) pf.production_file = generateSignedUrl(pf.production_file);
                if (pf.dtp_file) pf.dtp_file = generateSignedUrl(pf.dtp_file);
            }
            // Sign Outsource Invoices
            if (mg.outsource_assignments) {
                mg.outsource_assignments.forEach(assign => {
                    if (assign.invoice_url) {
                        assign.invoice_url = generateSignedUrl(assign.invoice_url);
                    }
                    if (Array.isArray(assign.invoices)) {
                        assign.invoices.forEach(inv => {
                            if (inv.invoice_url) {
                                inv.invoice_url = generateSignedUrl(inv.invoice_url);
                            }
                        });
                    }
                });
            }
        });
    }

    if (obj.sales_order_id) {
        const so = obj.sales_order_id;
        if (so.image) so.image = generateSignedUrl(so.image);
        if (so.quatation_files) so.quatation_files = so.quatation_files.map(f => generateSignedUrl(f));
        if (so.job_sheet_files) so.job_sheet_files = so.job_sheet_files.map(f => generateSignedUrl(f));
        if (so.designer_files) so.designer_files = so.designer_files.map(f => generateSignedUrl(f));
        if (so.Pi_files) so.Pi_files = so.Pi_files.map(f => generateSignedUrl(f));
        if (so.challan_files) so.challan_files = generateSignedUrl(so.challan_files);

        if (so.process_files) {
            so.process_files.forEach(pf => {
                if (pf.production_file) pf.production_file = generateSignedUrl(pf.production_file);
                if (pf.dtp_file) pf.dtp_file = generateSignedUrl(pf.dtp_file);
            });
        }

        if (so.additional_files) {
            so.additional_files.forEach(af => {
                if (af.file_url) af.file_url = generateSignedUrl(af.file_url);
            });
        }

        // Self-heal sample job total_qty if it was populated from bulk BOM
        const isSampleSo = so.type === "sample" || so.category === "Sample" || obj.job_type === "sample";
        if (isSampleSo && so.job_quantity && obj.total_qty !== so.job_quantity) {
            obj.total_qty = so.job_quantity;
            shopFloorJobModel.updateOne({ _id: obj._id }, { total_qty: so.job_quantity }).catch(() => {});
        }
    }

    if (!obj.is_reprocess) {
        const reprocessReq = await shopFloorRequisitionModel.findOne({
            type: "Reprocess",
            shopfloor_job_id: obj._id,
            status: { $ne: "REJECTED" }
        }).select("_id").lean();
        if (reprocessReq) {
            obj.is_reprocess = true;
        }
    }

    return obj;
};


/**
 * Helper to create ShopFloorJob entries for a Sales Order
 */
export const createShopFloorJobsFromSO = async (soData, bomData) => {
    if (!bomData?.materialprocess) return [];

    const isSample = soData.type === "sample" ||
        soData.category === "Sample" ||
        soData.job_type === "sample";

    const sampleQty = Number(soData.job_quantity || 1);

    // Fetch additional data from salesorderform if client_name or categories are missing
    let clientName = soData.client_name;
    let category = isSample ? "Sample" : soData.category;
    let subcategory = soData.subcategory;
    let totalQty = isSample ? sampleQty : bomData.job_quantity;
    let deliveryDate = soData.delivery_date;
    let completionDate = soData.job_completion_datetime;
    let jobType = isSample ? "sample" : (soData.type || "standard");
    let sampleRequired = isSample;
    let sampling_on = false; // Dedicated sample jobs run primary cycle directly
    let referenceNo = "";

    // Fetch linked IDs based on Sample Order and specific Sub Job Number
    const dtpJob = await dtpStudioModel.findOne({
        sample_order_id: soData._id,
        sub_job_no: soData.sub_job_no
    }).lean();
    const storeIssue = await materialIssueModel.findOne({
        sample_order_id: soData._id,
        sub_job_no: soData.sub_job_no
    }).lean();

    // Fetch reference_no from Enquiry
    const enqId = soData.enquiry_id?._id || soData.enquiry_id;
    if (enqId) {
        const enq = await enquiryModel.findById(enqId).lean();
        if (enq) referenceNo = enq.reference_no;
    }

    // Robust form lookup: Try ID first, then fallback to Job Numbers
    let form = null;
    if (soData.sample_salesorder_id) {
        form = await salesorderform.findById(soData.sample_salesorder_id).lean();
    }

    if (!form) {
        form = await salesorderform.findOne({
            job_no: soData.job_no,
            sub_job_no: soData.sub_job_no,
            enquiry_id: soData.enquiry_id?._id || soData.enquiry_id
        }).lean();
    }

    if (form) {
        clientName = clientName || form.client_name;
        category = isSample ? "Sample" : (category || form.category);
        subcategory = subcategory || form.subcategory;
        if (isSample) {
            totalQty = sampleQty || Number(form.sample_qty || 1);
            sampleRequired = true;
            sampling_on = false; // Dedicated sample jobs run primary cycle directly
        } else {
            totalQty = form.job_quantity || bomData.job_quantity;
            sampleRequired = form.sample_required || false;
            sampling_on = form.sample_required || false;
        }
        deliveryDate = deliveryDate || form.delivery_date;
        completionDate = completionDate || form.job_completion_datetime;
    }

    // If sample job, recalculate BOM for sample quantity so processes and materials match sample piece count
    let effectiveBom = bomData;
    if (isSample && totalQty > 0) {
        try {
            effectiveBom = recalculateBOMForNewQty(bomData, totalQty);
        } catch (recalcErr) {
            console.error("Error recalculating BOM for sample qty in createShopFloorJobsFromSO:", recalcErr);
            effectiveBom = bomData;
        }
    }

    const processGroups = {}; // Key: process_name

    effectiveBom.materialprocess.forEach(group => {
        const material_group_id = String(group.material_group_id || group._id);
        const material_group_name = group.material_group_name;

        const bomGroup = effectiveBom.material_groups?.find(mg => String(mg.group_id || mg._id) === material_group_id);
        const groupMaterials = bomGroup?.materials?.map(m => ({
            item_id: m.item_id,
            material_name: m.material_name,
            material_type: m.material_type,
            material_input: m.input,
            quantity: m.final_total,
            category_type: m.category_type,
            unit: m.unit,
            size: m.size || m.sheet_size
        })) || [];

        group.processes?.forEach(proc => {
            const procKey = proc.process_name;
            if (!processGroups[procKey]) {
                processGroups[procKey] = {
                    group_process_id: proc._id,
                    actual_process_id: proc.process_id,
                    process_name: proc.process_name,
                    department: proc.department,
                    material_groups_map: {} // Use map for easy grouping
                };
            }

            const groupKey = proc.process_index ? `${material_group_id}_${proc.process_index}` : material_group_id;

            if (!processGroups[procKey].material_groups_map[groupKey]) {
                processGroups[procKey].material_groups_map[groupKey] = {
                    group_id: material_group_id,
                    group_name: material_group_name,
                    materials: groupMaterials,
                    input: proc.input,
                    process_index: proc.process_index,
                    process_rate: proc.rate || proc.process_rate,
                    assigned_shifts: [],
                    status: 'Pending',
                    outsource_qty: 0,
                    inhouse_qty: 0,
                    process_qty: 0,
                    sides: proc.sides || 1,
                    outsource_assignments: [],
                    sampling_on: sampling_on,
                    // Collect DTP Final Prep File
                    final_prep_file: dtpJob?.final_prep_files?.find(f =>
                        String(f.material_group_id) === material_group_id &&
                        f.material_group_name === material_group_name
                    ),
                    // Collect Sales Order Process File
                    sales_order_process_file: soData?.process_files?.find(f =>
                        f.process_name === proc.process_name &&
                        String(f.section_id || "") === material_group_id
                    )
                };
            }

            const target = processGroups[procKey].material_groups_map[groupKey];

            if (proc.row_type === 'Outsource') {
                target.is_outsource = true;
                target.row_type = 'Outsource';
                target.outsource_type = proc.outsource_type;
                target.vendor_id = proc.vendor_id;
                target.vendor_name = proc.vendor || proc.vendor_name;
                target.outsource_rate = proc.outsource_rate;
                target.outsource_delivery_date = proc.outsource_delivery_date;
                target.outsource_qty += (proc.current_total_material || 0);
            } else {
                target.inhouse_qty += (proc.current_total_material || 0);
                if (!target.row_type) target.row_type = 'Inhouse'; // Default if not outsource
            }

            target.process_qty += (proc.current_total_material || 0);
        });
    });


    const createdJobs = [];
    for (const key in processGroups) {
        const pg = processGroups[key];
        const material_groups = Object.values(pg.material_groups_map);

        // Pre-populate outsource_assignments for first-time outsource jobs from BOM
        material_groups.forEach(mg => {
            if (mg.is_outsource && mg.vendor_id) {
                if (!mg.outsource_assignments) mg.outsource_assignments = [];
                if (mg.outsource_assignments.length === 0) {
                    mg.outsource_assignments.push({
                        vendor_id: mg.vendor_id,
                        vendor_name: mg.vendor_name,
                        outsource_rate: parseFloat(mg.outsource_rate) || 0,
                        outsource_qty: parseFloat(mg.outsource_qty) || 0,
                        outsource_sheets: 0,
                        outsource_delivery_date: mg.outsource_delivery_date || "",
                        assigned_at: getCurrentDate(),
                        assigned_by: null,
                        current_stage_idx: 0,
                        status: 'Pending',
                        stage_history: [{
                            stage_idx: 0,
                            stage_label: 'Material Delivered',
                            updated_at: getCurrentDate(),
                            updated_by: null
                        }]
                    });
                }
            }
        });

        // Resolve aligned department name from Control Tower using process ID
        let alignedDepartment = pg.department;
        const processId = pg.actual_process_id || pg.process_id;
        if (processId) {
            const ctDept = await controlTowerDeptModel.findOne({
                processes: mongoose.Types.ObjectId.isValid(processId)
                    ? new mongoose.Types.ObjectId(processId)
                    : processId
            }).lean();
            if (ctDept) {
                alignedDepartment = ctDept.name;
            }
        }

        // Skip creating shop floor jobs for DTP processes
        const isDtp = pg.process_name?.toLowerCase().includes('dtp') ||
            alignedDepartment?.toLowerCase().includes('dtp');
        if (isDtp) {
            continue;
        }

        const newShopJob = new shopFloorJobModel({
            sales_order_id: soData._id,
            bom_id: soData.bom_id,
            dtp_id: dtpJob?._id,
            enquiry_id: enqId,
            store_material_issue_id: storeIssue?._id,
            job_no: soData.job_no,
            sub_job_no: soData.sub_job_no,
            process_id: processId,
            process_name: pg.process_name,
            department: alignedDepartment,
            material_groups: material_groups,
            job_type: jobType,
            sample_required: sampleRequired,
            reference_no: referenceNo,
            status: 'Pending',
            product_image: soData.image,
            client_name: clientName,
            product_name: effectiveBom.product_name || bomData.product_name,
            category: category,
            subcategory: subcategory,
            delivery_date: deliveryDate,
            job_completion_date: completionDate,
            total_qty: totalQty,
            created_at: getCurrentDate()
        });
        await newShopJob.save();
        createdJobs.push(newShopJob);
    }
    return createdJobs;
};

/**
 * Sync all pushed Sales Orders with ShopFloorJob collection
 */
export const syncShopFloorJobs = async (req, res) => {
    try {
        // 1. Find all Sales Orders already marked as pushed
        const pushedOrders = await salesorder.find({ is_pushed_shop_floor: true });

        let createdCount = 0;
        let alreadyExistsCount = 0;
        let errorCount = 0;

        for (const so of pushedOrders) {
            try {
                console.log(`Syncing order ${so.job_no}/${so.sub_job_no}...`);

                // Check if any ShopFloorJob already exists for this SO
                const existing = await shopFloorJobModel.findOne({ sub_job_no: so.sub_job_no });
                if (existing) {
                    console.log(`- Job ${so.sub_job_no} already exists in ShopFloorJob collection.`);
                    alreadyExistsCount++;
                    continue;
                }

                // If not found, fetch BOM and create
                console.log(`- Fetching BOM ${so.bom_id}...`);
                const bomData = await bomModel.findById(so.bom_id).lean();
                if (bomData) {
                    console.log(`- BOM found. Starting job creation...`);
                    await createShopFloorJobsFromSO(so, bomData);
                    createdCount++;
                    console.log(`- Successfully created shop floor jobs for ${so.sub_job_no}`);
                } else {
                    console.log(`- BOM ${so.bom_id} not found for order ${so.sub_job_no}`);
                    errorCount++;
                }
            } catch (err) {
                console.error(`- Sync error for SO ${so.job_no}:`, err);
                errorCount++;
            }
        }

        return res.status(200).json({
            success: true,
            message: "Shop floor sync completed",
            results: {
                totalOrders: pushedOrders.length,
                created: createdCount,
                alreadyExists: alreadyExistsCount,
                errors: errorCount
            }
        });
    } catch (error) {
        console.error("syncShopFloorJobs error:", error);
        return res.status(500).json({ success: false, message: "Sync failed", error: error.message });
    }
};

export const getShopFloorJobs = async (req, res) => {
    try {
        const { status, process_name, department, search, role } = req.query;
        const query = {};
        if (status) query.status = status;
        if (process_name) {
            if (process_name.includes(',')) {
                query.process_name = { $in: process_name.split(',').map(p => p.trim()) };
            } else {
                query.process_name = process_name;
            }
        }
        if (department) query.department = department;

        // Role-based filtering: Operators only see in-house assigned jobs (Shifts 1, 2, 3)
        // and they typically don't see completed jobs in their pipeline
        if (role === 'Laser Cutting Operator') {
            query.$and = query.$and || [];
            query.$and.push({
                $or: [
                    { status: 'Completed' },
                    { status: 'In Progress' },
                    { "material_groups.outsource_assignments.status": 'Completed' },
                    { "material_groups.outsource_assignments.current_stage_idx": 6 },
                    { assigned_shifts: { $in: [1, 2, 3] } },
                    { "material_groups.assigned_shifts": { $in: [1, 2, 3] } }
                ]
            });
        } else if (role === 'UV Printing Operator') {
            if (status !== 'Completed') {
                query.status = { $ne: 'Completed' };
            }
            query.$and = query.$and || [];
            query.$and.push({
                $or: [
                    { status: 'Completed' },
                    { status: 'In Progress' },
                    { "material_groups.process_history.action": 'CONSOLE READY' },
                    { assigned_shifts: { $in: [1, 2] } },
                    { "material_groups.assigned_shifts": { $in: [1, 2] } }
                ]
            });
        }

        // Exclude completed jobs older than 7 days when not searching/filtering by a specific status
        if (!query.status && !search && req.query.include_completed !== 'true' && req.query.all_completed !== 'true') {
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
                query.$and = query.$and || [];
                query.$and.push({ $or: existingOr });
                query.$and.push(completedFilter);
            } else if (query.$and) {
                query.$and.push(completedFilter);
            } else {
                query.$and = [completedFilter];
            }
        }

        if (search) {
            const searchFilter = {
                $or: [
                    { job_no: { $regex: search, $options: "i" } },
                    { sub_job_no: { $regex: search, $options: "i" } },
                    { client_name: { $regex: search, $options: "i" } },
                    { product_name: { $regex: search, $options: "i" } },
                    { process_name: { $regex: search, $options: "i" } },
                ]
            };

            if (query.$and) {
                query.$and.push(searchFilter);
            } else {
                query.$or = searchFilter.$or;
            }
        }

        const jobs = await shopFloorJobModel.find(query)
            .populate("bom_id")
            .populate("store_material_issue_id")
            .populate("sales_order_id")
            .populate({
                path: 'material_groups.outsource_assignments.assigned_by',
                select: 'name email'
            })
            .populate({
                path: 'material_groups.outsource_assignments.batch_receipts.updated_by',
                select: 'name'
            })
            .populate({
                path: 'material_groups.outsource_assignments.stage_history.updated_by',
                select: 'name'
            })
            .populate({
                path: 'escalation_hold_history.by',
                select: 'name'
            })
            .sort({ createdAt: -1 });

        // Optimize injectSheetIssueStatus by pre-fetching related jobs and ready jobs in bulk
        const subJobNos = [...new Set(jobs.map(j => j.sub_job_no).filter(Boolean))];
        const allRelatedJobs = subJobNos.length > 0
            ? await shopFloorJobModel.find({ sub_job_no: { $in: subJobNos } })
            : [];

        const relatedJobsMap = {};
        for (const j of allRelatedJobs) {
            if (j.sub_job_no && j.process_name) {
                const key = `${j.sub_job_no.trim().toLowerCase()}|${j.process_name.trim().toLowerCase()}`;
                relatedJobsMap[key] = j;
            }
        }

        const relatedJobIds = allRelatedJobs.map(j => j._id);
        const readyJobs = relatedJobIds.length > 0
            ? await readyJobModel.find({ shopfloor_job_id: { $in: relatedJobIds } })
            : [];

        const readyJobsMap = {};
        for (const rj of readyJobs) {
            if (rj.shopfloor_job_id) {
                readyJobsMap[String(rj.shopfloor_job_id)] = rj;
            }
        }

        const jobIds = jobs.map(j => j._id).filter(Boolean);
        const reprocessReqs = jobIds.length > 0
            ? await shopFloorRequisitionModel.find({
                type: "Reprocess",
                shopfloor_job_id: { $in: jobIds },
                status: { $ne: "REJECTED" }
            }).select("shopfloor_job_id").lean()
            : [];
        const reprocessJobIdsSet = new Set(reprocessReqs.map(r => String(r.shopfloor_job_id)));

        const data = await Promise.all(jobs.map(async (job) => await signJobUrlsList(job, relatedJobsMap, readyJobsMap, reprocessJobIdsSet)));

        let completedCount = 0;
        if (status === 'Completed') {
            completedCount = data.length;
        } else {
            const countQuery = { status: 'Completed' };
            if (department) countQuery.department = department;
            if (process_name) countQuery.process_name = process_name;

            if (role === 'Laser Cutting Operator') {
                countQuery.$or = [
                    { "material_groups.outsource_assignments.status": 'Completed' },
                    { "material_groups.outsource_assignments.current_stage_idx": 6 },
                    { assigned_shifts: { $in: [1, 2, 3] } },
                    { "material_groups.assigned_shifts": { $in: [1, 2, 3] } }
                ];
            } else if (role === 'UV Printing Operator') {
                countQuery.$or = [
                    { assigned_shifts: { $in: [1, 2] } },
                    { "material_groups.assigned_shifts": { $in: [1, 2] } }
                ];
            }
            completedCount = await shopFloorJobModel.countDocuments(countQuery);
        }

        return res.status(200).json({ success: true, count: data.length, data: data, completed_count: completedCount });
    } catch (error) {
        console.error("getShopFloorJobs error:", error);
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

export const getShopFloorJobById = async (req, res) => {
    try {
        const { id } = req.params;
        const job = await shopFloorJobModel.findById(id)
            .populate("sales_order_id")
            .populate("bom_id")
            .populate("dtp_id")
            .populate("enquiry_id")
            .populate("store_material_issue_id")
            .populate({
                path: 'material_groups.outsource_assignments.assigned_by',
                select: 'name email'
            })
            .populate({
                path: 'material_groups.outsource_assignments.batch_receipts.updated_by',
                select: 'name'
            })
            .populate({
                path: 'material_groups.outsource_assignments.stage_history.updated_by',
                select: 'name'
            })
            .populate({
                path: 'escalation_hold_history.by',
                select: 'name'
            });

        if (!job) {
            return res.status(404).json({ success: false, message: "Job not found" });
        }

        const data = await signJobUrls(job);
        return res.status(200).json({ success: true, data: data });
    } catch (error) {
        console.error("getShopFloorJobById error:", error);
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

export const updateProcessStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, completed_qty, assigned_shift, material_group_id, group_progress, group_shift, is_outsource, outsource_details, sampling_on } = req.body;
        const userId = req.user?._id;

        const job = await shopFloorJobModel.findById(id);
        if (!job) return res.status(404).json({ success: false, message: "Job not found" });

        if (job.is_hold && (is_outsource || req.body.is_outsource || outsource_details)) {
            return res.status(400).json({ success: false, message: "Cannot perform action: Job is currently on hold." });
        }

        // Safety check for older records
        if (!job.assign_history) job.assign_history = [];

        const oldStatus = job.status;

        // Handle Group-wise Progress Update
        if (material_group_id) {
            const groupIndex = job.material_groups.findIndex(mg =>
                String(mg._id) === String(material_group_id) ||
                String(mg.group_id) === String(material_group_id)
            );
            if (groupIndex !== -1) {
                const group = job.material_groups[groupIndex];

                // Initialize array if it doesn't exist
                if (!group.assigned_shifts) group.assigned_shifts = [];

                if (group_progress !== undefined) group.progress = group_progress;
                if (sampling_on !== undefined) group.sampling_on = sampling_on;

                // Single Shift Selection Logic
                const targetShift = group_shift !== undefined ? group_shift : req.body.assigned_shift;

                if (targetShift !== undefined && targetShift !== null) {
                    const outsourceShift = job.department === 'Print' ? 3 : 4;
                    const hasOutsource = group.outsource_assignments?.length > 0;

                    if (group.assigned_shifts.includes(targetShift)) {
                        // Toggle off if same shift is clicked
                        if (hasOutsource) {
                            group.assigned_shifts = [outsourceShift];
                        } else {
                            group.assigned_shifts = [];
                        }
                    } else {
                        // Set the selected shift, preserving outsource shift if assignments exist
                        if (hasOutsource && targetShift !== outsourceShift) {
                            group.assigned_shifts = [outsourceShift, targetShift];
                        } else {
                            group.assigned_shifts = [targetShift];
                        }

                        // CONFLICT HANDLING: If a specific line item shift is selected,
                        // clear the overall job-level shift selection.
                        if (job.assigned_shifts && job.assigned_shifts.length > 0) {
                            job.assigned_shifts = [];
                        }
                    }

                    group.status = group.assigned_shifts.length > 0 ? 'In Progress' : 'Pending';

                    // Log History
                    job.assign_history.push({
                        shifts: group.assigned_shifts,
                        assigned_by: userId,
                        assigned_at: getCurrentDate(),
                        remark: req.body.remark || "",
                        group_id: material_group_id,
                        group_name: group.group_name
                    });

                    if (group.assigned_shifts.length > 0 && job.status === 'Pending') {
                        job.status = 'In Progress';
                        job.assigned_at = getCurrentDate();
                    }
                }

                // Handle Outsource Details
                if (is_outsource) {
                    group.is_outsource = true;
                    group.status = 'In Progress';

                    // Ensure outsource shift is active and not toggled off
                    if (targetShift !== undefined && targetShift !== null) {
                        if (!group.assigned_shifts.includes(targetShift)) {
                            group.assigned_shifts.push(targetShift);
                        }
                    }

                    if (outsource_details) {
                        if (!group.outsource_assignments) group.outsource_assignments = [];

                        const assignment = {
                            vendor_id: outsource_details.vendor_id,
                            vendor_name: outsource_details.vendor_name,
                            outsource_rate: parseFloat(outsource_details.outsource_rate) || 0,
                            outsource_qty: parseFloat(outsource_details.outsource_ups) || 0,
                            outsource_sheets: parseFloat(outsource_details.outsource_sheets) || 0,
                            outsource_delivery_date: outsource_details.outsource_delivery_date,
                            assigned_at: getCurrentDate(),
                            assigned_by: userId
                        };

                        if (outsource_details.is_remove) {
                            const idx = parseInt(outsource_details.assignment_index);
                            const targetAssignment = group.outsource_assignments[idx];
                            if (targetAssignment) {
                                // Record in assign history
                                if (!job.assign_history) job.assign_history = [];
                                job.assign_history.push({
                                    shifts: [targetShift || 4], // Outsource shift
                                    assigned_by: userId, // User who deleted it
                                    assigned_at: getCurrentDate(),
                                    remark: "Outsource assignment removed",
                                    group_id: String(group._id || group.group_id),
                                    group_name: group.group_name,
                                    vendor_id: targetAssignment.vendor_id,
                                    price: targetAssignment.outsource_rate || 0,
                                    status: 'Removed',
                                    sheet_qty: targetAssignment.outsource_sheets || 0,
                                    output_qty: targetAssignment.outsource_qty || 0
                                });

                                group.outsource_assignments.splice(idx, 1);

                                // If no assignments left, remove shift 3 or 4 from assigned_shifts and update status if needed
                                if (group.outsource_assignments.length === 0) {
                                    group.is_outsource = false;
                                    const sIdx = group.assigned_shifts.indexOf(4);
                                    if (sIdx !== -1) group.assigned_shifts.splice(sIdx, 1);
                                    const sIdx3 = group.assigned_shifts.indexOf(3);
                                    if (sIdx3 !== -1) group.assigned_shifts.splice(sIdx3, 1);

                                    if (group.assigned_shifts.length === 0) {
                                        group.status = 'Pending';
                                    }
                                } else {
                                    // Make sure outsource shift remains active if assignments still exist
                                    if (targetShift !== undefined && targetShift !== null) {
                                        if (!group.assigned_shifts.includes(targetShift)) {
                                            group.assigned_shifts = [targetShift];
                                        }
                                    }
                                }
                            }
                        } else if (outsource_details.assignment_index !== undefined && outsource_details.assignment_index !== null) {
                            // Edit existing or perform sub-actions (Stage/Batch)
                            const idx = parseInt(outsource_details.assignment_index);
                            const target = group.outsource_assignments[idx];
                            if (target) {
                                if (outsource_details.stage_update) {
                                    const nextIdx = outsource_details.stage_update.stage_idx;

                                    // Validation for invoice details if moving to Invoice Approved (Stage 6)
                                    if (nextIdx === 6) {
                                        const rawInvoices = Array.isArray(target.invoices) ? target.invoices : (target.invoice_no ? [{ invoice_no: target.invoice_no }] : []);
                                        const hasExistingInvoices = rawInvoices.length > 0;

                                        // If an invoice is supplied in stage_update OR no invoice exists yet:
                                        if (outsource_details.stage_update.invoice_no || !hasExistingInvoices) {
                                            const { invoice_no, invoice_date, invoice_amt, invoice_qty, invoice_url } = outsource_details.stage_update;
                                            if (!invoice_no || !invoice_date || invoice_amt === undefined || invoice_amt === null || invoice_amt === "" || invoice_qty === undefined || invoice_qty === null || invoice_qty === "" || !invoice_url) {
                                                return res.status(400).json({
                                                    success: false,
                                                    message: "Invoice number, date, quantity, amount, and invoice document file are all mandatory for final invoice approval."
                                                });
                                            }

                                            const numInvQty = parseFloat(invoice_qty) || 0;
                                            const totalAlreadyInvoiced = rawInvoices.reduce((sum, inv) => {
                                                if (String(inv.invoice_no).trim().toLowerCase() === String(invoice_no).trim().toLowerCase()) return sum;
                                                return sum + (Number(inv.invoice_qty) || 0);
                                            }, 0);
                                            const totalInwarded = (target.batch_receipts || []).reduce((bSum, b) => bSum + (b.type === 'actual' ? (Number(b.qty) || 0) : 0), 0);
                                            if (totalInwarded <= 0) {
                                                return res.status(400).json({
                                                    success: false,
                                                    message: "Cannot invoice: No quantity has been inwarded yet. Please record an actual batch receipt first."
                                                });
                                            }
                                            const maxAllowed = Math.max(0, totalInwarded - totalAlreadyInvoiced);
                                            if (numInvQty > maxAllowed) {
                                                return res.status(400).json({
                                                    success: false,
                                                    message: `Invoice quantity (${numInvQty} pcs) cannot exceed inwarded balance of ${maxAllowed} pcs. (Total inwarded: ${totalInwarded} pcs, already invoiced: ${totalAlreadyInvoiced} pcs).`
                                                });
                                            }
                                        }
                                    }

                                    target.current_stage_idx = nextIdx;
                                    if (!target.stage_history) target.stage_history = [];
                                    target.stage_history.push({
                                        stage_idx: target.current_stage_idx,
                                        stage_label: outsource_details.stage_update.stage_label,
                                        updated_at: getCurrentDate(),
                                        updated_by: userId
                                    });

                                    // Update Outsource Status
                                    if (target.current_stage_idx === 6) {
                                        target.status = 'Completed';
                                    } else if (target.current_stage_idx > 0) {
                                        target.status = 'In Progress';
                                    }
                                    // Recalculate Group Progress
                                    await updateGroupProgress(group, job._id, group._id || group.group_id);

                                    // Save Invoice Details if provided
                                    if (outsource_details.stage_update.invoice_no) {
                                        const invNo = String(outsource_details.stage_update.invoice_no).trim();
                                        const invDate = outsource_details.stage_update.invoice_date;
                                        const invAmt = parseFloat(outsource_details.stage_update.invoice_amt) || 0;
                                        const invQty = parseFloat(outsource_details.stage_update.invoice_qty) || 0;
                                        const invRate = parseFloat(outsource_details.stage_update.invoice_rate) || (invQty > 0 ? (invAmt / invQty) : target.outsource_rate) || 0;
                                        const invUrl = outsource_details.stage_update.invoice_url || "";
                                        const invFileName = outsource_details.stage_update.invoice_file_name || "";

                                        target.invoice_no = invNo;
                                        target.invoice_date = invDate;
                                        target.invoice_amt = invAmt;
                                        target.invoice_qty = invQty;
                                        target.invoice_rate = invRate;
                                        target.invoice_url = invUrl;
                                        target.invoice_file_name = invFileName;

                                        if (!target.invoices) target.invoices = [];
                                        const existingIdx = target.invoices.findIndex(i => String(i.invoice_no).trim().toLowerCase() === invNo.toLowerCase());
                                        const newInvObj = {
                                            invoice_no: invNo,
                                            invoice_date: invDate,
                                            invoice_qty: invQty,
                                            invoice_rate: invRate,
                                            invoice_amt: invAmt,
                                            invoice_url: invUrl,
                                            invoice_file_name: invFileName,
                                            created_at: new Date(),
                                            created_by: userId,
                                            created_by_name: req.user?.name || req.user?.username || ""
                                        };
                                        if (existingIdx >= 0) {
                                            target.invoices[existingIdx] = newInvObj;
                                        } else {
                                            target.invoices.push(newInvObj);
                                        }
                                    }
                                } else if (outsource_details.invoice_add) {
                                    const { invoice_no, invoice_date, invoice_amt, invoice_qty, invoice_rate, invoice_url, invoice_file_name } = outsource_details.invoice_add;
                                    if (!invoice_no || !invoice_date || invoice_amt === undefined || invoice_amt === null || invoice_amt === "" || invoice_qty === undefined || invoice_qty === null || invoice_qty === "" || !invoice_url) {
                                        return res.status(400).json({
                                            success: false,
                                            message: "Invoice number, date, quantity, amount, and invoice document file are all mandatory."
                                        });
                                    }
                                    const invNo = String(invoice_no).trim();
                                    const invDate = invoice_date;
                                    const invAmt = parseFloat(invoice_amt) || 0;
                                    const invQty = parseFloat(invoice_qty) || 0;
                                    const invRate = parseFloat(invoice_rate) || (invQty > 0 ? (invAmt / invQty) : target.outsource_rate) || 0;
                                    const invUrl = invoice_url || "";
                                    const invFileName = invoice_file_name || "";

                                    const rawInvoices = Array.isArray(target.invoices) ? target.invoices : (target.invoice_no ? [{ invoice_no: target.invoice_no, invoice_qty: target.invoice_qty || target.outsource_qty }] : []);
                                    const totalAlreadyInvoiced = rawInvoices.reduce((sum, inv) => {
                                        if (String(inv.invoice_no).trim().toLowerCase() === invNo.toLowerCase()) return sum;
                                        return sum + (Number(inv.invoice_qty) || 0);
                                    }, 0);
                                    const totalInwarded = (target.batch_receipts || []).reduce((bSum, b) => bSum + (b.type === 'actual' ? (Number(b.qty) || 0) : 0), 0);
                                    if (totalInwarded <= 0) {
                                        return res.status(400).json({
                                            success: false,
                                            message: "Cannot invoice: No quantity has been inwarded yet. Please record an actual batch receipt first."
                                        });
                                    }
                                    const maxAllowed = Math.max(0, totalInwarded - totalAlreadyInvoiced);

                                    if (invQty > maxAllowed) {
                                        return res.status(400).json({
                                            success: false,
                                            message: `Invoice quantity (${invQty} pcs) cannot exceed inwarded balance of ${maxAllowed} pcs. (Total inwarded: ${totalInwarded} pcs, already invoiced: ${totalAlreadyInvoiced} pcs).`
                                        });
                                    }

                                    target.invoice_no = invNo;
                                    target.invoice_date = invDate;
                                    target.invoice_amt = invAmt;
                                    target.invoice_qty = invQty;
                                    target.invoice_rate = invRate;
                                    target.invoice_url = invUrl;
                                    target.invoice_file_name = invFileName;

                                    if (!target.invoices) target.invoices = [];
                                    const existingIdx = target.invoices.findIndex(i => String(i.invoice_no).trim().toLowerCase() === invNo.toLowerCase());
                                    const newInvObj = {
                                        invoice_no: invNo,
                                        invoice_date: invDate,
                                        invoice_qty: invQty,
                                        invoice_rate: invRate,
                                        invoice_amt: invAmt,
                                        invoice_url: invUrl,
                                        invoice_file_name: invFileName,
                                        created_at: new Date(),
                                        created_by: userId,
                                        created_by_name: req.user?.name || req.user?.username || ""
                                    };
                                    if (existingIdx >= 0) {
                                        target.invoices[existingIdx] = newInvObj;
                                    } else {
                                        target.invoices.push(newInvObj);
                                    }
                                    await updateGroupProgress(group, job._id, group._id || group.group_id);
                                } else if (outsource_details.invoice_delete) {
                                    const invNoToDelete = String(outsource_details.invoice_delete.invoice_no || "").trim().toLowerCase();
                                    if (invNoToDelete && Array.isArray(target.invoices)) {
                                        target.invoices = target.invoices.filter(i => String(i.invoice_no).trim().toLowerCase() !== invNoToDelete);
                                        if (target.invoices.length > 0) {
                                            const lastInv = target.invoices[target.invoices.length - 1];
                                            target.invoice_no = lastInv.invoice_no;
                                            target.invoice_date = lastInv.invoice_date;
                                            target.invoice_qty = lastInv.invoice_qty;
                                            target.invoice_rate = lastInv.invoice_rate || target.outsource_rate || 0;
                                            target.invoice_amt = lastInv.invoice_amt;
                                            target.invoice_url = lastInv.invoice_url;
                                            target.invoice_file_name = lastInv.invoice_file_name;
                                        } else {
                                            target.invoice_no = "";
                                            target.invoice_date = "";
                                            target.invoice_qty = 0;
                                            target.invoice_rate = 0;
                                            target.invoice_amt = 0;
                                            target.invoice_url = "";
                                            target.invoice_file_name = "";
                                        }
                                        await updateGroupProgress(group, job._id, group._id || group.group_id);
                                    }
                                } else if (outsource_details.batch_add) {
                                    if (!target.batch_receipts) target.batch_receipts = [];

                                    const qty = parseFloat(outsource_details.batch_add.qty) || 0;
                                    if (qty <= 0) {
                                        return res.status(400).json({ success: false, message: "Batch quantity must be greater than zero." });
                                    }

                                    const type = outsource_details.batch_add.type || 'actual';
                                    const currentRecd = (target.batch_receipts || []).filter(b => b.type === 'actual').reduce((sum, b) => sum + (b.qty || 0), 0);
                                    const totalOrdered = target.outsource_qty || 0;

                                    // Strict balance check validation
                                    if (type === 'actual' && (currentRecd + qty) > totalOrdered) {
                                        return res.status(400).json({
                                            success: false,
                                            message: `Cannot exceed ordered quantity. Remaining balance: ${(totalOrdered - currentRecd).toLocaleString()} pcs`
                                        });
                                    }

                                    const newBatch = {
                                        type,
                                        qty,
                                        date: outsource_details.batch_add.date,
                                        time: outsource_details.batch_add.time,
                                        updated_at: getCurrentDate(),
                                        updated_by: userId
                                    };
                                    target.batch_receipts.push(newBatch);

                                    if (type === 'actual') {
                                        const outsourceCycleNumber = 10000 + target.batch_receipts.length;
                                        try {
                                            let readyJob = await readyJobModel.findOne({ shopfloor_job_id: job._id });
                                            if (!readyJob) {
                                                readyJob = new readyJobModel({
                                                    shopfloor_job_id: job._id,
                                                    job_no: job.job_no,
                                                    sub_job_no: job.sub_job_no,
                                                    process_name: job.process_name,
                                                    department: job.department,
                                                    client_name: job.client_name,
                                                    line_items: []
                                                });
                                            }
                                            let lineItem = readyJob.line_items.find(item => String(item.group_id) === String(group._id || group.group_id));
                                            if (!lineItem) {
                                                readyJob.line_items.push({
                                                    group_id: group._id || group.group_id,
                                                    material_name: group.group_name || 'Outsource Material',
                                                    material_specs: '',
                                                    cycles: []
                                                });
                                                lineItem = readyJob.line_items.find(item => String(item.group_id) === String(group._id || group.group_id));
                                            }
                                            let existingCycle = lineItem.cycles.find(c => Number(c.cycle_number) === Number(outsourceCycleNumber));
                                            if (!existingCycle) {
                                                lineItem.cycles.push({
                                                    cycle_number: outsourceCycleNumber,
                                                    good_qty: qty,
                                                    bad_qty: 0,
                                                    completed_at: new Date().toISOString(),
                                                    completed_by_name: target.vendor_name || 'Outsource Vendor',
                                                    completed_by: userId,
                                                    is_outsource: true,
                                                    vendor_name: target.vendor_name,
                                                    handed_over: false
                                                });
                                                await readyJob.save();
                                            }

                                            // eslint-disable-next-line no-use-before-define
                                            await automateNextProcessInward(
                                                job._id,
                                                group._id || group.group_id,
                                                outsourceCycleNumber,
                                                qty,
                                                target.vendor_name || 'Outsource Vendor',
                                                userId
                                            );
                                        } catch (rjErr) {
                                            console.error("Error creating ready job outsource cycle:", rjErr);
                                        }
                                    }
                                } else {
                                    // General edit
                                    target.vendor_id = assignment.vendor_id;
                                    target.vendor_name = assignment.vendor_name;
                                    target.outsource_rate = assignment.outsource_rate;
                                    target.outsource_qty = assignment.outsource_qty;
                                    target.outsource_sheets = assignment.outsource_sheets;
                                    target.outsource_delivery_date = assignment.outsource_delivery_date;

                                    // For any general edit, regenerate confirmation token, reset status to Pending, and dispatch a new notification email.
                                    const token = crypto.randomBytes(32).toString('hex');
                                    target.token = token;
                                    target.token_expires_at = new Date(Date.now() + 48 * 60 * 60 * 1000);
                                    target.status = 'Pending';
                                    target.rejection_reason = undefined; // Clear previous rejection reason on edit

                                    // Trigger emails/whatsapp in background conditionally
                                    if (!target.communication_mode || target.communication_mode.includes('email')) {
                                        sendOutsourceAssignmentEmail(job, group, target);
                                    }
                                    if (!target.communication_mode || target.communication_mode.includes('whatsapp')) {
                                        sendOutsourceAssignmentWhatsApp(job, group, target);
                                    }
                                    // Recalculate progress in case batch was modified
                                    await updateGroupProgress(group, job._id, group._id || group.group_id);
                                }
                            }
                        } else {
                            // Add new
                            const token = crypto.randomBytes(32).toString('hex');
                            assignment.token = token;
                            assignment.token_expires_at = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h expiry
                            assignment.current_stage_idx = 0;
                            assignment.status = 'Pending';
                            assignment.stage_history = [{
                                stage_idx: 0,
                                stage_label: 'Material Delivered',
                                updated_at: getCurrentDate(),
                                updated_by: userId
                            }];
                            assignment.communication_mode = outsource_details.communication_mode || 'whatsapp_and_email';
                            group.outsource_assignments.push(assignment);
                            await updateGroupProgress(group, job._id, group._id || group.group_id);

                            // Trigger email/whatsapp in background conditionally
                            if (!assignment.communication_mode || assignment.communication_mode.includes('email')) {
                                sendOutsourceAssignmentEmail(job, group, assignment);
                            }
                            if (!assignment.communication_mode || assignment.communication_mode.includes('whatsapp')) {
                                sendOutsourceAssignmentWhatsApp(job, group, assignment);
                            }
                        }

                        // Maintain top-level fields for legacy/summary
                        if (group.outsource_assignments.length > 0) {
                            const first = group.outsource_assignments[0];
                            group.vendor_id = first.vendor_id;
                            group.vendor_name = first.vendor_name;
                            group.outsource_rate = first.outsource_rate;
                            group.outsource_delivery_date = first.outsource_delivery_date;

                            // Recalculate totals
                            group.assigned_outsource_sheets = group.outsource_assignments.reduce((sum, a) => sum + (parseFloat(a.outsource_sheets) || 0), 0);
                            group.assigned_outsource_ups = group.outsource_assignments.reduce((sum, a) => sum + (parseFloat(a.outsource_qty) || 0), 0);
                        } else {
                            // Reset ALL top-level outsource fields if no assignments exist
                            group.vendor_id = null;
                            group.vendor_name = null;
                            group.outsource_rate = 0;
                            group.outsource_qty = 0;
                            group.outsource_sheets = 0;
                            group.outsource_delivery_date = null;
                            group.assigned_outsource_sheets = 0;
                            group.assigned_outsource_ups = 0;
                            group.is_outsource = false;
                        }
                    }
                    if (job.status === 'Pending') {
                        job.status = 'In Progress';
                        job.assigned_at = getCurrentDate();
                    }
                }

                // Recalculate Overall Progress
                updateJobOverallProgress(job);

                job.markModified('material_groups');
            }
        } else {
            // Standard Full Job Update
            if (status === 'Completed') {
                const allGroupsCompleted = job.material_groups && job.material_groups.length > 0 && job.material_groups.every(mg => mg.status === 'Completed');
                if (!allGroupsCompleted) {
                    return res.status(400).json({
                        success: false,
                        message: "Cannot mark job as Completed. All line items (material groups) must be completed first."
                    });
                }
            }
            job.status = status || job.status;
            job.completed_qty = completed_qty !== undefined ? completed_qty : job.completed_qty;
            // job.progress is now calculated from material_groups average at the end

            if (!job.assigned_shifts) job.assigned_shifts = [];

            if (assigned_shift !== undefined && assigned_shift !== null) {
                if (job.assigned_shifts.includes(assigned_shift)) {
                    job.assigned_shifts = [];
                } else {
                    job.assigned_shifts = [assigned_shift];
                }

                // Propagate shift to all material groups for consistency
                const isAdding = job.assigned_shifts.includes(assigned_shift);

                job.material_groups = job.material_groups.map(mg => {
                    // EXCEPTION: If Outsource is enabled for this line item, 
                    // do not override its shift selection.
                    if (mg.is_outsource || (mg.outsource_assignments && mg.outsource_assignments.length > 0)) {
                        return mg;
                    }

                    if (!mg.assigned_shifts) mg.assigned_shifts = [];

                    if (isAdding) {
                        mg.assigned_shifts = [assigned_shift];
                    } else {
                        mg.assigned_shifts = [];
                    }

                    return {
                        ...mg,
                        status: mg.assigned_shifts.length > 0 ? 'In Progress' : mg.status
                    };
                });
                job.markModified('material_groups');

                // Log History
                job.assign_history.push({
                    shifts: job.assigned_shifts,
                    assigned_by: userId,
                    assigned_at: getCurrentDate(),
                    remark: req.body.remark || ""
                });
            }

            // Handle Global Outsource Propagation
            if (is_outsource) {
                const assignmentsToEmail = [];
                job.material_groups = job.material_groups.map(mg => {
                    // Check if it's a printable material (optional, but consistent with frontend)
                    const hasPrintableMaterial = mg.materials?.some(m => {
                        const cat = m.category_type?.toLowerCase() || "";
                        return !cat.includes('consumable') && !cat.includes('hardware');
                    });

                    if (hasPrintableMaterial) {
                        const existingShifts = Array.isArray(mg.assigned_shifts) ? mg.assigned_shifts : [];
                        const outsourceShifts = existingShifts.includes(4) ? existingShifts : [...existingShifts, 4];

                        const token = crypto.randomBytes(32).toString('hex');
                        const assignment = {
                            vendor_id: outsource_details?.vendor_id,
                            vendor_name: outsource_details?.vendor_name,
                            outsource_rate: parseFloat(outsource_details?.outsource_rate) || 0,
                            outsource_qty: parseFloat(outsource_details?.outsource_qty) || 0,
                            outsource_sheets: parseFloat(outsource_details?.outsource_sheets) || 0,
                            outsource_delivery_date: outsource_details?.outsource_delivery_date,
                            assigned_at: getCurrentDate(),
                            assigned_by: userId,
                            token: token,
                            token_expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48h
                            status: 'Pending',
                            current_stage_idx: 0,
                            stage_history: [{
                                stage_idx: 0,
                                stage_label: 'Material Delivered',
                                updated_at: getCurrentDate(),
                                updated_by: userId
                            }],
                            communication_mode: outsource_details?.communication_mode || 'whatsapp_and_email'
                        };

                        assignmentsToEmail.push({ group: mg, assignment });

                        return {
                            ...mg,
                            is_outsource: true,
                            status: 'In Progress',
                            assigned_shifts: outsourceShifts,
                            vendor_id: assignment.vendor_id,
                            vendor_name: assignment.vendor_name,
                            outsource_rate: assignment.outsource_rate,
                            outsource_qty: assignment.outsource_qty,
                            outsource_delivery_date: assignment.outsource_delivery_date,
                            assigned_outsource_sheets: assignment.outsource_sheets,
                            assigned_outsource_ups: assignment.outsource_qty,
                            outsource_assignments: [assignment] // Global replaces all with one
                        };
                    }
                    return mg;
                });

                // Trigger background emails for all global assignments
                assignmentsToEmail.forEach(item => {
                    if (!item.assignment.communication_mode || item.assignment.communication_mode.includes('email')) {
                        sendOutsourceAssignmentEmail(job, item.group, item.assignment);
                    }
                    if (!item.assignment.communication_mode || item.assignment.communication_mode.includes('whatsapp')) {
                        sendOutsourceAssignmentWhatsApp(job, item.group, item.assignment);
                    }
                });

                // Also add 4 to job.assigned_shifts
                if (!job.assigned_shifts) job.assigned_shifts = [];
                if (!job.assigned_shifts.includes(4)) job.assigned_shifts.push(4);
                job.markModified('material_groups');

            }
        }

        job.status_by = userId;
        job.updated_at = getCurrentDate();

        if (status === 'In Progress' && oldStatus === 'Pending') {
            job.assigned_at = getCurrentDate();
        }

        // Always ensure overall progress is the average of line items before saving
        updateJobOverallProgress(job);

        // Auto-complete status ONLY if all material groups (line items) are completed
        const allGroupsCompleted = job.material_groups && job.material_groups.length > 0 && job.material_groups.every(mg => mg.status === 'Completed');
        if (allGroupsCompleted && job.status !== 'Completed') {
            job.status = 'Completed';
        } else if (!allGroupsCompleted && job.status === 'Completed') {
            job.status = 'In Progress';
        }

        if (job.status === 'Completed') {
            job.completed_at = getCurrentDate();
            job.progress = 100;

            // Sync back to DTP Studio Job Sheet
            const dtpJob = await dtpStudioModel.findOne({
                sample_order_id: job.sales_order_id,
                sub_job_no: job.sub_job_no
            });
            if (dtpJob && dtpJob.job_sheet && dtpJob.job_sheet.materialprocess) {
                let modified = false;

                // Identify which material groups and processes in DTP Job match this ShopFloorJob
                // This is based on material_groups array stored in the ShopFloorJob
                for (const groupEntry of job.material_groups) {
                    const dtpGroup = dtpJob.job_sheet.materialprocess.find(g =>
                        String(g.material_group_id || g._id) === String(groupEntry.group_id)
                    );

                    if (dtpGroup && dtpGroup.processes) {
                        const dtpProc = dtpGroup.processes.find(p =>
                            String(p.process_index) === String(groupEntry.process_index)
                        );

                        if (dtpProc) {
                            dtpProc.status = 'Completed';
                            dtpProc.status_by = userId;
                            dtpProc.updated_at = getCurrentDate();
                            modified = true;
                        }
                    }
                }

                if (modified) {
                    dtpJob.markModified('job_sheet.materialprocess');

                    // Check if all processes in DTP are completed
                    const allCompleted = dtpJob.job_sheet.materialprocess.every(group =>
                        group.processes?.every(p => p.status === 'Completed')
                    );

                    if (allCompleted) {
                        dtpJob.status = 'Completed';
                        dtpJob.history.push({
                            action: "Status Updated",
                            description: "All job sheet processes completed on shop floor",
                            user: userId,
                            date: getCurrentDate()
                        });
                    }

                    await dtpJob.save();
                }
            }
        }

        await job.save();
        // Populate linked IDs for the response
        await job.populate("sales_order_id dtp_id enquiry_id store_material_issue_id escalation_hold_history.by");

        // Convert to object and add signed URLs
        const jobObj = await signJobUrls(job);

        return res.status(200).json({ success: true, message: "Status updated", data: jobObj });
    } catch (error) {
        console.error("updateProcessStatus error:", error);
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

/**
 * Clear notification flags for a job
 */
export const clearShopFloorFlags = async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.body; // 'qty', 'date', or undefined for both

        const update = {};
        if (type === 'qty') {
            update.is_qty_changed = false;
        } else if (type === 'date') {
            update.is_date_changed = false;
        } else {
            update.is_qty_changed = false;
            update.is_date_changed = false;
        }

        const job = await shopFloorJobModel.findByIdAndUpdate(id, { $set: update }, { new: true });
        if (!job) return res.status(404).json({ success: false, message: "Job not found" });

        await job.populate("sales_order_id dtp_id enquiry_id store_material_issue_id escalation_hold_history.by");
        const jobObj = await signJobUrls(job);

        return res.status(200).json({ success: true, message: "Flags cleared", data: jobObj });
    } catch (error) {
        console.error("clearShopFloorFlags error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};


// Escalate a job
export const escalateShopFloorJob = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?._id;

        const job = await shopFloorJobModel.findById(id);
        if (!job) return res.status(404).json({ success: false, message: "Job not found" });

        job.is_escalated = true;

        // Add to history
        if (!job.escalation_hold_history) job.escalation_hold_history = [];
        job.escalation_hold_history.push({
            type: 'Escalated',
            at: getCurrentDate(),
            by: userId
        });

        // Also log in process history
        // if (!job.process_history) job.process_history = [];
        // job.process_history.push({
        //     activity_type: 'System',
        //     action: 'ESCALATED',
        //     operator_name: req.user?.name || "User",
        //     operator_id: userId,
        //     timestamp: getCurrentDate()
        // });

        await job.save();

        // Populate for response
        await job.populate("sales_order_id dtp_id enquiry_id store_material_issue_id escalation_hold_history.by");
        const jobObj = await signJobUrls(job);

        return res.status(200).json({ success: true, message: "Job escalated successfully", data: jobObj });
    } catch (error) {
        console.error("escalateShopFloorJob error:", error);
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};


// De-escalate a job
export const deEscalateShopFloorJob = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?._id;

        const job = await shopFloorJobModel.findById(id);
        if (!job) return res.status(404).json({ success: false, message: "Job not found" });

        job.is_escalated = false;

        // Add to history
        if (!job.escalation_hold_history) job.escalation_hold_history = [];
        job.escalation_hold_history.push({
            type: 'De-Escalated',
            at: getCurrentDate(),
            by: userId
        });

        // Also log in process history
        // if (!job.process_history) job.process_history = [];
        // job.process_history.push({
        //     activity_type: 'System',
        //     action: 'DE-ESCALATED',
        //     operator_name: req.user?.name || "User",
        //     operator_id: userId,
        //     timestamp: getCurrentDate()
        // });

        await job.save();

        // Populate for response
        await job.populate("sales_order_id dtp_id enquiry_id store_material_issue_id escalation_hold_history.by");
        const jobObj = await signJobUrls(job);

        return res.status(200).json({ success: true, message: "Job de-escalated successfully", data: jobObj });
    } catch (error) {
        console.error("deEscalateShopFloorJob error:", error);
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

// Hold / Unhold a shop floor job (triggered from Production Hub)
// export const holdUnholdShopFloorJob = async (req, res) => {
//     try {
//         const { id } = req.params;
//         const { is_hold, remark } = req.body;
//         const userId = req.user?._id;

//         if (!remark || remark.trim().length < 3) {
//             return res.status(400).json({ success: false, message: "A remark of at least 3 characters is required." });
//         }

//         const job = await shopFloorJobModel.findById(id);
//         if (!job) return res.status(404).json({ success: false, message: "Job not found" });

//         job.is_hold = !!is_hold;
//         job.hold_remarks = remark;

//         job.escalation_hold_history.push({
//             type: is_hold ? 'Hold' : 'Resume',
//             remarks: remark,
//             at: getCurrentDate(),
//             by: userId
//         });

//         await job.save();

//         await job.populate("sales_order_id dtp_id enquiry_id store_material_issue_id escalation_hold_history.by");
//         const jobObj = job.toObject();
//         if (jobObj.product_image) jobObj.product_image = generateSignedUrl(jobObj.product_image);

//         return res.status(200).json({
//             success: true,
//             message: is_hold ? "Job put on hold" : "Job resumed successfully",
//             data: jobObj
//         });
//     } catch (error) {
//         console.error("holdUnholdShopFloorJob error:", error);
//         return res.status(500).json({ success: false, message: "Server error", error: error.message });
//     }
// };

export const recordMaterialInward = async (req, res) => {
    try {
        const { id } = req.params; // job id
        const {
            material_group_id,
            material_name,
            size,
            inspect_qty,
            good_qty,
            bad_qty,
            operator_id,
            operator_name,
            remarks,
            timestamp,
            consume_local
        } = req.body;
        const userId = req.user?._id;

        const job = await shopFloorJobModel.findById(id).populate("store_material_issue_id");
        if (!job) return res.status(404).json({ success: false, message: "Job not found" });

        const groupIndex = job.material_groups.findIndex(mg =>
            String(mg._id) === String(material_group_id) ||
            String(mg.group_id) === String(material_group_id)
        );

        if (groupIndex === -1) return res.status(404).json({ success: false, message: "Material group not found" });

        const group = job.material_groups[groupIndex];

        const plainJob = typeof job.toObject === 'function' ? job.toObject() : job;
        const [updatedJob] = await injectSheetIssueStatus([plainJob]);
        const updatedGroup = updatedJob.material_groups[groupIndex];

        const isSampleJob = (job.job_type || '').toLowerCase() === 'sample' || (job.category || '').toLowerCase() === 'sample';

        if (updatedGroup.is_unlocked === false && !updatedGroup.sampling_on && !isSampleJob) {
            return res.status(400).json({
                success: false,
                message: `Material inward is locked: ${updatedGroup.locked_reason || 'Waiting for preceding process to complete'}`
            });
        }

        const mainMat = updatedGroup.materials?.find(m => {
            const cat = m.category_type?.toLowerCase() || '';
            return !cat.includes('consumable') && !cat.includes('hardware');
        });
        const actualMatName = mainMat?.material_name || material_name;

        let localSfItem = null;
        let localSizeDoc = null;

        if (consume_local) {
            // 1. Validate against shop floor inventory stock
            const escapeRegex = s => (s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const deptClean = (job.department || 'Laser').replace(/cutting|printing/i, '').trim();
            const deptRegex = new RegExp(`^${escapeRegex(deptClean || 'Laser')}`, 'i');

            // Include any requisition descriptions for this job/group
            const jobReqs = await shopFloorRequisitionModel.find({
                $or: [{ shopfloor_job_id: job._id }, { job_no: job.sub_job_no || job.job_no }]
            }).lean();
            const reqNames = jobReqs.map(r => r.item_description).filter(Boolean);

            const candidateMatNames = [
                actualMatName,
                mainMat?.material_name,
                material_name,
                ...reqNames,
                ...(updatedGroup.materials || []).map(m => m.material_name)
            ].filter(Boolean);

            for (const cn of candidateMatNames) {
                localSfItem = await shopFloorInventoryModel.findOne({
                    shopfloor_name: { $regex: deptRegex },
                    name: { $regex: new RegExp(`^${escapeRegex(cn.trim())}$`, "i") }
                });
                if (localSfItem) break;
            }
            if (!localSfItem) {
                for (const cn of candidateMatNames) {
                    localSfItem = await shopFloorInventoryModel.findOne({
                        shopfloor_name: { $regex: deptRegex },
                        name: { $regex: new RegExp(escapeRegex(cn.trim()), "i") }
                    });
                    if (localSfItem) break;
                }
            }
            if (!localSfItem) {
                for (const cn of candidateMatNames) {
                    localSfItem = await shopFloorInventoryModel.findOne({
                        name: { $regex: new RegExp(`^${escapeRegex(cn.trim())}$`, "i") }
                    });
                    if (localSfItem) break;
                }
            }
            if (!localSfItem) {
                for (const cn of candidateMatNames) {
                    localSfItem = await shopFloorInventoryModel.findOne({
                        name: { $regex: new RegExp(escapeRegex(cn.trim()), "i") }
                    });
                    if (localSfItem) break;
                }
            }

            if (!localSfItem) {
                return res.status(400).json({
                    success: false,
                    message: `Material "${actualMatName}" not found in shop floor inventory.`
                });
            }
            let availableStock = localSfItem.stock || 0;
            if (localSfItem.item_type === 'sheet' && size) {
                const norm = s => (s || '').toLowerCase().replace(/\s+/g, '');
                const targetSize = norm(size);
                let populatedItem = null;
                if (mongoose.Types.ObjectId.isValid(localSfItem.id)) {
                    populatedItem = await itemModel.findById(localSfItem.id).populate('stock_sizes').lean();
                }
                if (!populatedItem) {
                    populatedItem = await itemModel.findOne({ id: localSfItem.id }).populate('stock_sizes').lean();
                }
                if (populatedItem && populatedItem.stock_sizes) {
                    const matchedSz = populatedItem.stock_sizes.find(sz => {
                        if (!sz) return false;
                        if (typeof sz === 'object') {
                            return norm(sz.size) === targetSize || norm(`${sz.width}x${sz.height}`) === targetSize;
                        }
                        return false;
                    });
                    if (matchedSz) {
                        localSizeDoc = matchedSz;
                    }
                }
                if (localSizeDoc) {
                    let sizeStock = localSfItem.size_wise_stock?.find(s => String(s.size_id) === String(localSizeDoc._id));
                    if (sizeStock && sizeStock.count !== undefined && sizeStock.count > 0) {
                        availableStock = sizeStock.count;
                    } else if (localSfItem.stock > 0) {
                        availableStock = localSfItem.stock;
                    }
                }
            }
            if (Number(inspect_qty) > availableStock) {
                return res.status(400).json({
                    success: false,
                    message: `Inspected quantity (${inspect_qty}) exceeds available shop floor stock (${availableStock})`
                });
            }

            // 2. Validate against remaining required quantity of the job
            const bom = await bomModel.findById(job.bom_id);
            let processesList = [];
            if (bom && bom.materialprocess) {
                const processGroup = bom.materialprocess.find(p =>
                    p.material_group_name?.toLowerCase().trim() === updatedGroup.group_name?.toLowerCase().trim() ||
                    String(p.material_group_id) === String(updatedGroup.group_id || updatedGroup._id)
                );
                if (processGroup) {
                    processesList = processGroup.processes || [];
                }
            }
            const cuttingIndex = processesList.findIndex(p =>
                p.process_name?.toLowerCase().includes("laser") ||
                p.process_name?.toLowerCase().includes("cutting") ||
                p.process_name?.toLowerCase().includes("cut")
            );
            const currentProcessIndex = processesList.findIndex(p =>
                p.process_name?.toLowerCase().trim() === job.process_name?.toLowerCase().trim()
            );
            const isSubsequent = cuttingIndex !== -1 && currentProcessIndex !== -1 && currentProcessIndex > cuttingIndex;
            const ups = mainMat?.material_input?.ups || updatedGroup.ups || 80;
            const totalSheets = mainMat?.quantity || updatedGroup.sheets_required || 1;
            const outsourcedSheets = updatedGroup.assigned_outsource_sheets || 0;
            const sheetsReqd = Math.max(0, totalSheets - outsourcedSheets);
            const isUv = job.department === 'Print' || job.department === 'UV Printing';
            const calculatedPcs = (isSampleJob && job.total_qty > 0) ? job.total_qty : (sheetsReqd * ups);
            const totalOutput = isUv ? (isSubsequent ? calculatedPcs : sheetsReqd) : calculatedPcs;
            const targetQty = mainMat?.material_type === 'sheet' ? (isSubsequent ? totalOutput : sheetsReqd) : totalOutput;

            const totalGoodInward = (updatedGroup.inward_history || [])
                .filter(log => !updatedGroup.sampling_on || !(log.remarks || '').includes('Automated handover inward'))
                .reduce((acc, log) => acc + (Number(log.good_qty) || 0), 0);

            const remainingRequired = Math.max(0, targetQty - totalGoodInward);
            if (Number(inspect_qty) > remainingRequired) {
                return res.status(400).json({
                    success: false,
                    message: `Inspected quantity (${inspect_qty}) exceeds the remaining required quantity (${remainingRequired})`
                });
            }
        } else {
            const pendingSheets = updatedGroup.max_inspectable_qty ?? 0;
            if (Number(inspect_qty) > pendingSheets) {
                return res.status(400).json({
                    success: false,
                    message: `Inspected quantity (${inspect_qty}) exceeds the available inspectable quantity (${pendingSheets})`
                });
            }
        }

        // Generate MRN Number
        const lastInward = await shopFloorInwardModel.findOne().sort({ createdAt: -1 });
        let nextNo = 1;
        if (lastInward && lastInward.inward_number) {
            const match = lastInward.inward_number.match(/\d+$/);
            if (match) nextNo = parseInt(match[0]) + 1;
        }
        const mrnNo = `MRN-${String(nextNo).padStart(4, '0')}`;

        // Fetch Detailed Material Data from BOM
        const bom = await bomModel.findById(job.bom_id);
        const bomGroup = bom?.material_groups?.find(bg =>
            String(bg.group_id) === String(material_group_id) ||
            String(bg._id) === String(material_group_id) ||
            (group.group_id && String(bg.group_id) === String(group.group_id)) ||
            (group.group_id && String(bg._id) === String(group.group_id))
        );

        const mainMatBom = bomGroup?.materials?.find(bm => {
            const cat = (bm.category_type || "").toLowerCase();
            return !cat.includes('consumable') && !cat.includes('hardware');
        });
        const upsVal = Number(mainMatBom?.input?.ups || group.ups || 1);

        // Determine if it is a subsequent process in the BOM
        let processIndex = -1;
        if (bom && bom.materialprocess) {
            const processGroup = bom.materialprocess.find(
                p => p.material_group_name?.toLowerCase().trim() === material_name?.toLowerCase().trim() ||
                    String(p.material_group_id) === String(material_group_id) ||
                    (group.group_id && String(p.material_group_id) === String(group.group_id))
            );
            if (processGroup && processGroup.processes) {
                processIndex = processGroup.processes.findIndex(
                    p => p.process_name?.toLowerCase().trim() === job.process_name?.toLowerCase().trim()
                );
            }
        }
        const isSubsequentProcess = processIndex > 0;

        const detailedMaterials = (bomGroup?.materials || [])
            .filter(bm => {
                const cat = (bm.category_type || "").toLowerCase();
                return !cat.includes('consumable') && !cat.includes('hardware');
            })
            .map(bm => {
                const sheetArea = (() => {
                    const s = bm.input?.size || size || "";
                    if (s.includes('X')) {
                        const d = s.split('X');
                        return parseFloat(d[0]) * parseFloat(d[1]);
                    } else if (s.includes('x')) {
                        const d = s.split('x');
                        return parseFloat(d[0]) * parseFloat(d[1]);
                    }
                    return 0;
                })();
                const sq_inch_per_unit = isSubsequentProcess ? (sheetArea / upsVal) : sheetArea;
                return {
                    material_name: bm.material_name,
                    rate: parseFloat(bm.rate || 0),
                    sq_inch_per_unit
                };
            });

        const totalSqInchAccepted = detailedMaterials.reduce((acc, m) => acc + (m.sq_inch_per_unit * good_qty), 0);
        const acceptedValue = detailedMaterials.reduce((acc, m) => acc + (m.rate * (m.sq_inch_per_unit * good_qty)), 0);


        // Create Inward Record
        const inward = new shopFloorInwardModel({
            id: nanoid(16),
            inward_number: mrnNo,
            job_id: id,
            job_no: job.job_no,
            sub_job_no: job.sub_job_no,
            material_group_id,
            material_name,
            size,
            inspect_qty,
            good_qty,
            bad_qty,
            operator_id,
            operator_name,
            recorded_by: userId,
            remarks,
            materials: detailedMaterials,
            total_sq_inch_accepted: totalSqInchAccepted,
            accepted_value: acceptedValue,
            timestamp,
            laser_return: Number(bad_qty) > 0 ? true : false,
            status: bad_qty === 0 ? 'PASS' : 'PARTIAL',
            created_at: getCurrentDate()
        });

        await inward.save();

        // Deduct from Shop Floor Inventory if local inventory was consumed
        if (consume_local && localSfItem) {
            try {
                const reqQty = Number(inspect_qty);
                if (localSfItem.item_type === 'sheet') {
                    if (localSizeDoc) {
                        let sizeStock = localSfItem.size_wise_stock?.find(s => String(s.size_id) === String(localSizeDoc._id));
                        if (sizeStock) {
                            sizeStock.count = Math.max(0, (sizeStock.count || 0) - reqQty);
                        }
                    }
                    localSfItem.stock = Math.max(0, (localSfItem.stock || 0) - reqQty);
                } else {
                    localSfItem.stock = Math.max(0, (localSfItem.stock || 0) - reqQty);
                }

                if (!localSfItem.usage_history) localSfItem.usage_history = [];
                localSfItem.usage_history.push({
                    job_id: job._id,
                    job_no: job.job_no,
                    sub_job_no: job.sub_job_no,
                    inward_id: inward._id,
                    inward_number: inward.inward_number,
                    operator_name: operator_name,
                    qty: reqQty,
                    good_qty: Number(good_qty),
                    bad_qty: Number(bad_qty),
                    size: size || undefined,
                    recorded_at: getCurrentDate()
                });

                await localSfItem.save();
            } catch (sfInvError) {
                console.error("Failed to update shop floor inventory on job inward:", sfInvError);
            }
        }



        // Update Job Group History
        if (!group.inward_history) group.inward_history = [];
        group.inward_history.push({
            inward_id: inward._id,
            inspect_qty,
            good_qty,
            bad_qty,
            operator_name,
            operator_id,
            remarks,
            materials: detailedMaterials,
            total_sq_inch_accepted: totalSqInchAccepted,
            accepted_value: acceptedValue,
            timestamp,
            laser_return: Number(bad_qty) > 0 ? true : false,
            created_at: getCurrentDate()
        });

        job.markModified('material_groups');

        // If good qty is stored, add "CONSOLE READY" to process history ONLY ONCE
        if (Number(good_qty) >= 1) {
            if (!group.process_history) group.process_history = [];
            const hasConsoleReady = group.process_history.some(log => log.action === 'CONSOLE READY');
            if (!hasConsoleReady) {
                group.process_history.push({
                    activity_type: 'System',
                    action: 'CONSOLE READY',
                    operator_name: operator_name,
                    operator_id: operator_id,
                    timestamp: timestamp,
                    affected_groups: [material_name],
                    details: {
                        remarks: remarks || '',
                        good_qty: Number(good_qty),
                        bad_qty: Number(bad_qty)
                    }
                });
            }
        }

        await job.save();

        // Populate and sign for consistent response
        await job.populate("sales_order_id dtp_id enquiry_id store_material_issue_id escalation_hold_history.by");
        const jobObj = await signJobUrls(job);

        return res.status(201).json({
            success: true,
            message: "Material inward recorded successfully",
            data: jobObj,
            inward: inward
        });
    } catch (error) {
        console.error("recordMaterialInward error:", error);
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

export const getShopFloorInwardLogs = async (req, res) => {
    try {
        const { job_id, material_group_id, laser_return, bad_qty, department, process_name } = req.query;
        const query = {};
        if (job_id) query.job_id = job_id;
        if (material_group_id) query.material_group_id = material_group_id;
        if (laser_return === 'true') query.laser_return = true;
        if (bad_qty) query.bad_qty = { $gt: 0 };

        if (process_name) {
            let procQuery = {};
            if (process_name.includes(',')) {
                procQuery.process_name = { $in: process_name.split(',').map(p => p.trim()) };
            } else {
                procQuery.process_name = process_name;
            }
            const jobsInProcess = await shopFloorJobModel.find(procQuery).select('_id').lean();
            const jobIds = jobsInProcess.map(j => j._id);
            if (query.job_id) {
                const isJobInProcess = jobIds.some(id => String(id) === String(query.job_id));
                if (!isJobInProcess) query.job_id = null;
            } else {
                query.job_id = { $in: jobIds };
            }
        } else if (department) {
            const jobsInDept = await shopFloorJobModel.find({ department }).select('_id').lean();
            const jobIds = jobsInDept.map(j => j._id);
            if (query.job_id) {
                // intersection
                const isJobInDept = jobIds.some(id => String(id) === String(query.job_id));
                if (!isJobInDept) query.job_id = null;
            } else {
                query.job_id = { $in: jobIds };
            }
        }

        const logs = await shopFloorInwardModel.find(query)
            .populate('job_id', 'client_name product_name')
            .sort({ createdAt: -1 });
        return res.status(200).json({ success: true, data: logs });
    } catch (error) {
        console.error("getShopFloorInwardLogs error:", error);
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

export const createMaterialReturn = async (req, res) => {
    try {
        const { return_type, job_no, shop_floor_job_id, material_group, quantity, return_by, reason, destination } = req.body;

        if (!return_type || !job_no || !material_group || !quantity || !return_by) {
            return res.status(400).json({ success: false, message: "All fields except reason are required" });
        }

        let targetJobId = shop_floor_job_id;
        if (!targetJobId && job_no) {
            const parts = job_no.split('/');
            const subJobNo = parts.length > 1 ? parts[1] : parts[0];
            const foundJob = await mongoose.model("shop_floor_job").findOne({ sub_job_no: subJobNo });
            if (foundJob) {
                targetJobId = foundJob._id;
            }
        }

        const returnId = nanoid(16);
        const selectedDestination = return_type === "excess" ? (destination || "main_store") : "main_store";

        const [jobNo, subJobNo] = job_no.split('/');

        let shopFloorJob = null;
        const shopFloorJobs = await shopFloorJobModel.find({ job_no: jobNo, sub_job_no: subJobNo });
        shopFloorJob = shopFloorJobs.find(job =>
            job.material_groups.some(g => g.group_name?.toLowerCase().trim() === material_group?.toLowerCase().trim())
        ) || shopFloorJobs[0];

        let sizeId = null;
        let sizeString = "";

        if (return_type === 'excess') {
            let matchedMat = null;
            if (shopFloorJob) {
                const mg = shopFloorJob.material_groups.find(g => g.group_name?.toLowerCase().trim() === material_group?.toLowerCase().trim());
                if (mg && mg.materials) {
                    matchedMat = mg.materials.find(m => {
                        const cat = (m.category_type || "").toLowerCase();
                        return !cat.includes('consumable') && !cat.includes('hardware');
                    }) || mg.materials[0];
                    if (matchedMat) {
                        sizeString = matchedMat.size || matchedMat.material_input?.size || "";
                    }
                }
            }

            if (sizeString) {
                const norm = s => (s || '').toLowerCase().replace(/\s+/g, '');
                const tSize = norm(sizeString);
                let sizeDoc = await stockSizeModel.findOne({
                    $or: [
                        { size: sizeString },
                        { size: tSize }
                    ]
                });
                if (!sizeDoc) {
                    const allSizes = await stockSizeModel.find().lean();
                    sizeDoc = allSizes.find(sz => norm(sz.size) === tSize || norm(`${sz.width}x${sz.height}`) === tSize);
                }
                if (sizeDoc) {
                    sizeId = sizeDoc._id;
                    sizeString = sizeDoc.size || `${sizeDoc.width}x${sizeDoc.height}`;
                }
            }
        }

        const newReturn = new shopFloorMaterialReturnModel({
            id: returnId,
            return_type,
            destination: selectedDestination,
            job_no,
            shop_floor_job_id: targetJobId || null,
            material_group,
            quantity: Number(quantity),
            return_by,
            reason,
            size: sizeString || undefined,
            size_id: sizeId || undefined,
            created_at: getCurrentDate(),
            updated_at: getCurrentDate()
        });

        await newReturn.save();

        // Calculate if we need to clear the laser_return flags
        const allInwards = await shopFloorInwardModel.find({ job_no: jobNo, sub_job_no: subJobNo, material_name: material_group });
        const totalBadQty = allInwards.reduce((acc, curr) => acc + (Number(curr.bad_qty) || 0), 0);

        // Note: newReturn is already saved above, so it will be included in the total returned qty
        const allReturns = await shopFloorMaterialReturnModel.find({ job_no: job_no, material_group: material_group });
        const totalReturnedQty = allReturns.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);

        // 1. Reset laser_return in inward models and inward_history ONLY IF fully returned
        if (totalReturnedQty >= totalBadQty) {
            await shopFloorInwardModel.updateMany(
                { job_no: jobNo, sub_job_no: subJobNo, material_name: material_group },
                { $set: { laser_return: false } }
            );

            if (shopFloorJob) {
                let jobModified = false;
                shopFloorJob.material_groups.forEach(mg => {
                    if (mg.group_name?.toLowerCase().trim() === material_group?.toLowerCase().trim()) {
                        mg.inward_history.forEach(log => {
                            if (log.laser_return) {
                                log.laser_return = false;
                                jobModified = true;
                            }
                        });
                    }
                });
                if (jobModified) {
                    shopFloorJob.markModified('material_groups');
                    await shopFloorJob.save();
                }
            }
        }

        // 2. Handle stock logic based on destination
        if (return_type === 'excess') {
            if (selectedDestination === 'main_store') {
                // Return to Main Store: increment Main Store Inventory only (no shop floor decrement)
                try {
                    // Find the main material details from the job
                    let matchedMat = null;
                    let targetSize = null;
                    if (shopFloorJob) {
                        const mg = shopFloorJob.material_groups.find(g => g.group_name?.toLowerCase().trim() === material_group?.toLowerCase().trim());
                        if (mg && mg.materials) {
                            matchedMat = mg.materials.find(m => {
                                const cat = (m.category_type || "").toLowerCase();
                                return !cat.includes('consumable') && !cat.includes('hardware');
                            }) || mg.materials[0];
                            if (matchedMat) {
                                targetSize = matchedMat.size || matchedMat.material_input?.size;
                            }
                        }
                    }

                    const matName = matchedMat ? matchedMat.material_name : material_group;

                    // Increment Main Store Inventory
                    let mainItem = null;
                    let isCustomItem = false;
                    if (matchedMat && matchedMat.item_id) {
                        if (mongoose.Types.ObjectId.isValid(matchedMat.item_id)) {
                            mainItem = await itemModel.findById(matchedMat.item_id).populate('stock_sizes');
                        }
                        if (!mainItem) {
                            mainItem = await itemModel.findOne({ id: matchedMat.item_id }).populate('stock_sizes');
                        }
                        if (!mainItem && mongoose.Types.ObjectId.isValid(matchedMat.item_id)) {
                            mainItem = await customItemModel.findById(matchedMat.item_id);
                            if (mainItem) isCustomItem = true;
                        }
                        if (!mainItem) {
                            mainItem = await customItemModel.findOne({ id: matchedMat.item_id });
                            if (mainItem) isCustomItem = true;
                        }
                    }

                    if (!mainItem) {
                        mainItem = await itemModel.findOne({
                            name: { $regex: new RegExp(`^${matName.toLowerCase().trim()}$`, "i") }
                        }).populate('stock_sizes');
                        if (!mainItem) {
                            mainItem = await customItemModel.findOne({
                                name: { $regex: new RegExp(`^${matName.toLowerCase().trim()}$`, "i") }
                            });
                            if (mainItem) isCustomItem = true;
                        }
                    }

                    if (mainItem) {
                        const reqQty = Number(quantity);
                        if (!isCustomItem && mainItem.item_type === 'sheet') {
                            let sizeDoc = null;
                            if (targetSize) {
                                const norm = s => (s || '').toLowerCase().replace(/\s+/g, '');
                                const tSize = norm(targetSize);
                                sizeDoc = mainItem.stock_sizes?.find(sz => norm(sz.size) === tSize || norm(`${sz.width}x${sz.height}`) === tSize);
                            }

                            if (sizeDoc) {
                                let sizeStock = mainItem.size_wise_stock?.find(s => String(s.size_id) === String(sizeDoc._id));
                                if (sizeStock) {
                                    sizeStock.count = (sizeStock.count || 0) + reqQty;
                                } else {
                                    mainItem.size_wise_stock.push({
                                        size_id: sizeDoc._id,
                                        count: reqQty,
                                        sqinch: 0
                                    });
                                }
                            }
                            mainItem.stock = (mainItem.stock || 0) + reqQty;
                        } else {
                            mainItem.stock = (mainItem.stock || 0) + reqQty;
                        }
                        await mainItem.save();
                    }
                } catch (stockErr) {
                    console.error("Error adjusting inventory on return to store:", stockErr);
                }
            } else {
                // destination === 'local_inventory'
                // Retain in Local Shop Floor Inventory: increment Shop Floor Inventory
                try {
                    const shopfloorName = shopFloorJob ? (shopFloorJob.department || "Laser") : "Laser";
                    let matchedMat = null;
                    let targetSize = null;
                    if (shopFloorJob) {
                        const mg = shopFloorJob.material_groups.find(g => g.group_name?.toLowerCase().trim() === material_group?.toLowerCase().trim());
                        if (mg && mg.materials) {
                            matchedMat = mg.materials.find(m => {
                                const cat = (m.category_type || "").toLowerCase();
                                return !cat.includes('consumable') && !cat.includes('hardware');
                            }) || mg.materials[0];
                            if (matchedMat) {
                                targetSize = matchedMat.size || matchedMat.material_input?.size;
                            }
                        }
                    }

                    const matName = matchedMat ? matchedMat.material_name : material_group;

                    // Get mainItem first to copy attributes if sfItem doesn't exist
                    let mainItem = null;
                    if (matchedMat && matchedMat.item_id) {
                        if (mongoose.Types.ObjectId.isValid(matchedMat.item_id)) {
                            mainItem = await itemModel.findById(matchedMat.item_id).populate('stock_sizes');
                        }
                        if (!mainItem) {
                            mainItem = await itemModel.findOne({ id: matchedMat.item_id }).populate('stock_sizes');
                        }
                        if (!mainItem && mongoose.Types.ObjectId.isValid(matchedMat.item_id)) {
                            mainItem = await customItemModel.findById(matchedMat.item_id);
                        }
                        if (!mainItem) {
                            mainItem = await customItemModel.findOne({ id: matchedMat.item_id });
                        }
                    }

                    if (!mainItem) {
                        mainItem = await itemModel.findOne({
                            name: { $regex: new RegExp(`^${matName.toLowerCase().trim()}$`, "i") }
                        }).populate('stock_sizes');
                        if (!mainItem) {
                            mainItem = await customItemModel.findOne({
                                name: { $regex: new RegExp(`^${matName.toLowerCase().trim()}$`, "i") }
                            });
                        }
                    }

                    let sfItem = await shopFloorInventoryModel.findOne({
                        shopfloor_name: shopfloorName,
                        name: { $regex: new RegExp(`^${matName.toLowerCase().trim()}$`, "i") }
                    });

                    if (!sfItem) {
                        const countSF = await shopFloorInventoryModel.countDocuments();
                        const codeSF = `SF-${String(countSF + 1).padStart(4, '0')}`;

                        sfItem = new shopFloorInventoryModel({
                            id: codeSF,
                            item_id: mainItem ? mainItem._id : new mongoose.Types.ObjectId(),
                            item_code: mainItem ? mainItem.item_code : "N/A",
                            name: matName,
                            item_type: mainItem ? mainItem.item_type : (targetSize ? 'sheet' : 'other'),
                            shopfloor_name: shopfloorName,
                            unit: mainItem ? mainItem.unit : new mongoose.Types.ObjectId(),
                            price: mainItem ? mainItem.price : "0",
                            cost: mainItem ? mainItem.cost : "0",
                            stock_sizes: mainItem ? mainItem.stock_sizes : [],
                            size_wise_stock: [],
                            stock: 0,
                            created_by: shopFloorJob?.requested_by_id || new mongoose.Types.ObjectId(),
                            created_at: getCurrentDate()
                        });
                    }

                    const reqQty = Number(quantity);
                    let sizeId = null;
                    let sizeString = targetSize || "";

                    if (sfItem.item_type === 'sheet') {
                        let sizeDoc = null;
                        if (targetSize) {
                            const norm = s => (s || '').toLowerCase().replace(/\s+/g, '');
                            const tSize = norm(targetSize);

                            // Check in mainItem.stock_sizes first
                            if (mainItem && mainItem.stock_sizes) {
                                sizeDoc = mainItem.stock_sizes.find(sz => norm(sz.size) === tSize || norm(`${sz.width}x${sz.height}`) === tSize);
                            }

                            // Check in stockSizeModel directly
                            if (!sizeDoc) {
                                const allSizes = await stockSizeModel.find().lean();
                                sizeDoc = allSizes.find(sz => norm(sz.size) === tSize || norm(`${sz.width}x${sz.height}`) === tSize);
                            }

                            // If still not found, create a new stock_sizes document dynamically
                            if (!sizeDoc) {
                                const cleanSize = targetSize.trim();
                                const parts = cleanSize.toLowerCase().split('x');
                                let width = 0, height = 0;
                                if (parts.length === 2) {
                                    width = parseFloat(parts[0]) || 0;
                                    height = parseFloat(parts[1]) || 0;
                                }

                                if (width > 0 && height > 0) {
                                    const newSizeId = nanoid(10);
                                    const createdBy = shopFloorJob?.requested_by_id || new mongoose.Types.ObjectId("691eee9d87e9ec1c312f1197");

                                    const newSz = new stockSizeModel({
                                        id: newSizeId,
                                        size: cleanSize,
                                        width,
                                        height,
                                        unit: 'inch',
                                        is_active: true,
                                        created_by: createdBy
                                    });
                                    sizeDoc = await newSz.save();
                                }
                            }
                        }

                        if (sizeDoc) {
                            sizeId = sizeDoc._id;
                            sizeString = sizeDoc.size || `${sizeDoc.width}x${sizeDoc.height}`;

                            // Update return document if size was not set or changed
                            if (newReturn && (String(newReturn.size_id) !== String(sizeId) || newReturn.size !== sizeString)) {
                                newReturn.size_id = sizeId;
                                newReturn.size = sizeString;
                                await newReturn.save();
                            }

                            // Ensure sizeId is registered in sfItem.stock_sizes
                            const hasSize = sfItem.stock_sizes?.some(s => String(s) === String(sizeId) || String(s._id) === String(sizeId));
                            if (!hasSize) {
                                sfItem.stock_sizes.push(sizeId);
                            }

                            // Update count in size_wise_stock
                            let sizeStock = sfItem.size_wise_stock?.find(s => String(s.size_id) === String(sizeId));
                            if (sizeStock) {
                                sizeStock.count = (sizeStock.count || 0) + reqQty;
                            } else {
                                sfItem.size_wise_stock.push({
                                    size_id: sizeId,
                                    count: reqQty,
                                    sqinch: 0
                                });
                            }
                        }
                    }

                    sfItem.stock = (sfItem.stock || 0) + reqQty;

                    // Log in inward history as +Quantity
                    sfItem.inward_history.push({
                        requisition_no: `Excess Return (${job_no})`,
                        requested_by: return_by,
                        requested_at: getCurrentDate(),
                        issued_by: return_by,
                        issued_at: getCurrentDate(),
                        qty: reqQty,
                        size: sizeString || 'PCS',
                        size_id: sizeId || undefined,
                        shopfloor_name: shopfloorName
                    });

                    await sfItem.save();
                } catch (sfErr) {
                    console.error("Error logging local retention in shop floor inventory:", sfErr);
                }
            }
        }

        // 3. Add quantity to laserreturn_qty in store_material_issue (ONLY for returns to main store)
        if (selectedDestination === 'main_store' && shopFloorJob && shopFloorJob.store_material_issue_id) {
            const storeIssue = await materialIssueModel.findById(shopFloorJob.store_material_issue_id);
            if (storeIssue) {
                let storeModified = false;
                const mg = shopFloorJob.material_groups.find(g => g.group_name?.toLowerCase().trim() === material_group?.toLowerCase().trim());
                if (mg && mg.materials) {
                    const matchingStoreMats = [];

                    storeIssue.materials.forEach(mat => {
                        const hasMatch = mg.materials.some(m => {
                            if (mat.material_name?.toLowerCase().trim() === m.material_name?.toLowerCase().trim() || mat.item_id === m.item_id) {
                                const s = m.material_input?.size || m.size;
                                if (s && mat.specs) {
                                    const normSpecs = mat.specs.toUpperCase().replace(/\s/g, '');
                                    const normSize = s.toUpperCase().replace(/\s/g, '');
                                    return normSpecs.includes(normSize);
                                }
                                return true;
                            }
                            return false;
                        });

                        if (hasMatch) {
                            matchingStoreMats.push(mat);
                        }
                    });

                    if (matchingStoreMats.length > 0) {
                        const returnVal = Number(quantity);

                        // Group matching store materials by their normalized material name
                        const groupedMats = {};
                        matchingStoreMats.forEach(mat => {
                            const name = (mat.material_name || '').toLowerCase().trim();
                            if (!groupedMats[name]) {
                                groupedMats[name] = [];
                            }
                            groupedMats[name].push(mat);
                        });

                        // Process each unique material name group independently
                        Object.keys(groupedMats).forEach(name => {
                            const mats = groupedMats[name];

                            // Map each entry to calculate its outstanding quantity
                            const matsWithOutstanding = mats.map(mat => {
                                const currentIssued = (mat.logs || []).reduce((acc, log) => {
                                    return log.type === 'ISSUE' ? acc + parseFloat(log.qty || 0) : acc - parseFloat(log.qty || 0);
                                }, 0);
                                const outstanding = Math.max(0, currentIssued);
                                return { mat, outstanding };
                            });

                            if (matsWithOutstanding.length === 1) {
                                // Single entry: Simple bounded assignment
                                const item = matsWithOutstanding[0];
                                if (item.outstanding > 0) {
                                    const alloc = Math.min(returnVal, item.outstanding);
                                    item.mat.laserreturn_qty = (item.mat.laserreturn_qty || 0) + alloc;
                                    storeModified = true;
                                }
                            } else {
                                // Multiple duplicate-named entries: distribute the return pool sequentially
                                let remainingPool = returnVal;

                                // Prioritize entries with higher outstanding sheets
                                matsWithOutstanding.sort((a, b) => b.outstanding - a.outstanding);

                                for (const item of matsWithOutstanding) {
                                    if (remainingPool <= 0) break;
                                    if (item.outstanding > 0) {
                                        const alloc = Math.min(remainingPool, item.outstanding);
                                        item.mat.laserreturn_qty = (item.mat.laserreturn_qty || 0) + alloc;
                                        remainingPool -= alloc;
                                        storeModified = true;
                                    }
                                }
                            }
                        });
                    }
                }

                if (storeModified) {
                    storeIssue.markModified('materials');
                    await storeIssue.save();
                }
            }
        }

        return res.status(201).json({
            success: true,
            message: "Material return recorded successfully",
            data: newReturn
        });
    } catch (error) {
        console.error("createMaterialReturn error:", error);
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

export const getMaterialReturns = async (req, res) => {
    try {
        const { return_type, department } = req.query;
        const query = {};
        if (return_type) query.return_type = return_type;

        if (department) {
            const jobsInDept = await shopFloorJobModel.find({ department }).select('_id').lean();
            const jobIds = jobsInDept.map(j => j._id);
            query.shop_floor_job_id = { $in: jobIds };
        }

        const returns = await shopFloorMaterialReturnModel.find(query).sort({ createdAt: -1 });
        return res.status(200).json({ success: true, data: returns });
    } catch (error) {
        console.error("getMaterialReturns error:", error);
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

export const logShopFloorActivity = async (req, res) => {
    try {
        const { id } = req.params;
        const { activity_type, action, operator_name, operator_id, timestamp, affected_groups, details } = req.body;

        const job = await shopFloorJobModel.findById(id);
        if (!job) return res.status(404).json({ success: false, message: "Job not found" });

        // If affected_groups contains a group ID, log it to that group's process_history
        if (affected_groups && affected_groups.length > 0) {
            const groupId = affected_groups[0];
            const group = job.material_groups.find(mg =>
                String(mg._id) === String(groupId) ||
                String(mg.group_id) === String(groupId)
            );

            if (group) {
                if (!group.process_history) group.process_history = [];
                group.process_history.push({
                    activity_type,
                    action,
                    operator_name,
                    operator_id,
                    timestamp: timestamp || getCurrentDate(),
                    affected_groups,
                    details
                });

                // Calculate progress for this material group by reading the process flow document

                let inHouseGoodProduced = 0;
                try {
                    const flow = await ShopFloorProcessFlow.findOne({
                        shopfloor_job_id: id,
                        group_id: groupId
                    });
                    if (flow && flow.session_state) {
                        const pCycles = flow.session_state.primary_cycles || [];
                        const rCycles = flow.session_state.recut_cycles || [];
                        const sCycles = flow.session_state.sample_cycles || [];

                        const totalSampleGoodFromCycles = (Array.isArray(sCycles) ? sCycles : []).reduce((acc, c) => acc + ((c.status === 'Approved' || (Number(c.good_qty) || 0) > 0) ? (Number(c.good_qty) || 0) : 0), 0);
                        const totalSampleGoodFromQuantities = Number(flow.session_state.quantities?.sample_good) || 0;
                        const totalSampleGood = Math.max(totalSampleGoodFromCycles, totalSampleGoodFromQuantities);
                        const totalPrimaryGood = pCycles.reduce((acc, c) => acc + (Number(c.good_qty) || 0), 0);

                        const recutOptions = flow.session_state.quantities?.selected_recut_option || [];
                        const totalRecutGoodFromOptions = recutOptions.reduce((acc, opt) => {
                            const optGood = (opt.cycles || []).reduce((cAcc, c) => cAcc + (Number(c.good_qty) || 0), 0);
                            return acc + optGood;
                        }, 0);
                        const totalRecutGoodFromCycles = rCycles.reduce((acc, c) => acc + (Number(c.good_qty) || 0), 0);
                        const totalRecutCompleted = Number(flow.session_state.quantities?.recut_completed) || 0;
                        const totalRecutGood = Math.max(totalRecutGoodFromOptions, totalRecutGoodFromCycles, totalRecutCompleted);

                        // eslint-disable-next-line no-unused-vars
                        inHouseGoodProduced = totalSampleGood + totalPrimaryGood + totalRecutGood;

                    } else {
                        // Fallback to process_history if process flow session doesn't exist
                        group.process_history.forEach(historyItem => {
                            if (historyItem.details && typeof historyItem.details.good_qty === 'number' && (historyItem.action?.startsWith('📦') || historyItem.action?.includes('SAMPLE APPROVED') || historyItem.action?.includes('Approved'))) {
                                inHouseGoodProduced += historyItem.details.good_qty;
                            } else if (typeof historyItem.good_qty === 'number' && (historyItem.action?.startsWith('📦') || historyItem.action?.includes('SAMPLE APPROVED') || historyItem.action?.includes('Approved'))) {
                                inHouseGoodProduced += historyItem.good_qty;
                            }
                        });
                    }
                } catch (flowErr) {
                    console.error("Failed to query ShopFloorProcessFlow in logShopFloorActivity:", flowErr);
                    // Fallback to process_history
                    group.process_history.forEach(historyItem => {
                        if (historyItem.details && typeof historyItem.details.good_qty === 'number' && (historyItem.action?.startsWith('📦') || historyItem.action?.includes('SAMPLE APPROVED') || historyItem.action?.includes('Approved'))) {
                            inHouseGoodProduced += historyItem.details.good_qty;
                        } else if (typeof historyItem.good_qty === 'number' && (historyItem.action?.startsWith('📦') || historyItem.action?.includes('SAMPLE APPROVED') || historyItem.action?.includes('Approved'))) {
                            inHouseGoodProduced += historyItem.good_qty;
                        }
                    });
                }

                let isSheetTarget = false;
                let bom = null;
                if (job.bom_id) {
                    if (typeof job.bom_id === 'object' && job.bom_id.materialprocess) {
                        bom = job.bom_id;
                    } else {
                        bom = await bomModel.findById(job.bom_id).lean();
                    }
                }
                if (bom && bom.materialprocess) {
                    const processGroup = bom.materialprocess.find(
                        p => p.material_group_name?.toLowerCase().trim() === group.group_name?.toLowerCase().trim() ||
                            String(p.material_group_id) === String(group.group_id || group._id)
                    );
                    if (processGroup && processGroup.processes) {
                        const processes = processGroup.processes;
                        let processIndex = group.process_index
                            ? processes.findIndex(p => p.process_index === group.process_index)
                            : processes.findIndex(p => p.process_name?.toLowerCase().trim() === job.process_name?.toLowerCase().trim());

                        const cuttingIndex = processes.findIndex(p => isLaserProcess(p.process_name));
                        const mainMat = group.materials?.find(m => {
                            const cat = m.category_type?.toLowerCase() || '';
                            return !cat.includes('consumable') && !cat.includes('hardware');
                        });
                        const isSheetMaterial = mainMat?.material_type === 'sheet';

                        if (isLaserProcess(job.process_name)) {
                            isSheetTarget = false;
                        } else if (cuttingIndex !== -1 && processIndex !== -1) {
                            const isBeforeCutting = processIndex < cuttingIndex;
                            isSheetTarget = isSheetMaterial && isBeforeCutting;
                        } else if (cuttingIndex === -1 && isSheetMaterial) {
                            // eslint-disable-next-line no-unused-vars
                            isSheetTarget = true;

                        }
                    }
                }

                await updateGroupProgress(group, job._id, group.group_id || group._id);
                updateJobOverallProgress(job);

                // Check job completion using our deterministic rule-based validator
                const { is_completed, details: completionDetails } = await verifyJobCompletion(job);
                if (completionDetails && completionDetails.length > 0) {
                    completionDetails.forEach(detail => {
                        const mg = job.material_groups.find(g => String(g.group_id) === String(detail.group_id));
                        if (mg) {
                            mg.status = detail.is_completed ? 'Completed' : (mg.assigned_shifts?.length > 0 ? 'In Progress' : 'Pending');
                        }
                    });
                }
                if (is_completed && job.status !== 'Completed') {
                    job.status = 'Completed';
                    job.completed_at = getCurrentDate();
                } else if (!is_completed && job.status === 'Completed') {
                    job.status = 'In Progress';
                    job.completed_at = undefined;
                }

                job.markModified('material_groups');
            }
        }

        await job.save();
        await job.populate("sales_order_id dtp_id enquiry_id store_material_issue_id escalation_hold_history.by");
        const jobObj = await signJobUrls(job);
        res.status(200).json({ success: true, message: "Activity logged", data: jobObj });
    } catch (error) {
        console.error("logShopFloorActivity error:", error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

export const automateNextProcessInward = async (shopfloorJobId, groupId, cycleNumber = 1, goodQty = 0, operatorName = 'System', userId = null) => {
    try {
        const currentJob = await shopFloorJobModel.findById(shopfloorJobId);
        if (!currentJob) return;

        const bom = await bomModel.findById(currentJob.bom_id);
        if (!bom || !bom.materialprocess) return;

        const processGroup = bom.materialprocess.find(
            p => String(p.material_group_id) === String(groupId)
        );
        if (!processGroup || !processGroup.processes) return;

        const currentMg = currentJob.material_groups?.find(mg =>
            String(mg.group_id || mg._id) === String(groupId)
        );
        let currentIdx = -1;
        if (currentMg?.process_index) {
            currentIdx = processGroup.processes.findIndex(
                p => p.process_index === currentMg.process_index
            );
        }
        if (currentIdx === -1) {
            currentIdx = processGroup.processes.findIndex(
                p => p.process_name?.toLowerCase().trim() === currentJob.process_name?.toLowerCase().trim()
            );
        }

        if (currentIdx !== -1 && currentIdx < processGroup.processes.length - 1) {
            const nextProc = processGroup.processes[currentIdx + 1];
            const cleanProcName = nextProc.process_name.trim();
            const nextJob = await shopFloorJobModel.findOne({
                sub_job_no: currentJob.sub_job_no,
                $or: [
                    { process_name: { $regex: new RegExp(`^${cleanProcName}$`, "i") } },
                    { process_name: { $regex: new RegExp(cleanProcName, "i") } }
                ]
            });
            if (nextJob) {
                if ((!nextJob.assigned_shifts || nextJob.assigned_shifts.length === 0) && currentJob.assigned_shifts?.length > 0) {
                    nextJob.assigned_shifts = currentJob.assigned_shifts;
                }

                const nextGroupIndex = nextJob.material_groups.findIndex(mg =>
                    String(mg.group_id || mg._id) === String(groupId) &&
                    (nextProc.process_index ? mg.process_index === nextProc.process_index : true)
                );
                if (nextGroupIndex !== -1) {
                    const nextGroup = nextJob.material_groups[nextGroupIndex];

                    if (currentMg?.assigned_shifts?.length > 0 && (!nextGroup.assigned_shifts || nextGroup.assigned_shifts.length === 0)) {
                        nextGroup.assigned_shifts = currentMg.assigned_shifts;
                    }

                    if (Number(cycleNumber) >= 10000) {
                        nextGroup.is_outsource_received = true;
                    } else if (Number(cycleNumber) >= 1000) {
                        nextGroup.sampling_on = true;
                    }

                    if (Number(goodQty) >= 1) {
                        if (!nextGroup.process_history) nextGroup.process_history = [];
                        const hasConsoleReady = nextGroup.process_history.some(log => log.action === 'CONSOLE READY');
                        if (!hasConsoleReady) {
                            nextGroup.process_history.push({
                                activity_type: 'System',
                                action: 'CONSOLE READY',
                                operator_name: operatorName || 'System',
                                operator_id: userId,
                                timestamp: new Date().toISOString(),
                                affected_groups: [nextGroup.group_name || 'Material'],
                                details: {
                                    remarks: `Automated handover inward from ${currentJob.process_name}`,
                                    good_qty: Number(goodQty),
                                    bad_qty: 0
                                }
                            });
                        }
                    }

                    if (nextJob.status === 'Pending') {
                        nextJob.status = 'In Progress';
                        nextJob.assigned_at = getCurrentDate();
                    }

                    nextJob.markModified('material_groups');
                    await nextJob.save();
                    console.log(`[Handover Automation] Automated inwarded ${goodQty} to job ${nextJob.sub_job_no} for process ${nextJob.process_name}`);
                }
            }
        }
    } catch (e) {
        console.error("[Handover Automation] Failed in automateNextProcessInward:", e);
    }
};

/**
 * Create a Ready Job record when a primary cycle is handed over
 */
export const createReadyJob = async (req, res) => {
    try {
        const {
            shopfloor_job_id,
            group_id,
            job_no,
            sub_job_no,
            process_name,
            department,
            client_name,
            material_name,
            material_specs,
            cycle_number,
            good_qty,
            bad_qty,
            completed_at,
            completed_by_name
        } = req.body;

        const userId = req.user?._id;

        // Find or create ready job document for this shopfloor_job_id
        let queryId = shopfloor_job_id;
        if (typeof shopfloor_job_id === 'string' && mongoose.Types.ObjectId.isValid(shopfloor_job_id)) {
            queryId = new mongoose.Types.ObjectId(shopfloor_job_id);
        }

        let readyJob = await readyJobModel.findOne({ shopfloor_job_id: queryId });
        if (!readyJob) {
            readyJob = new readyJobModel({
                shopfloor_job_id: queryId,
                job_no,
                sub_job_no,
                process_name,
                department,
                client_name,
                line_items: []
            });
        }

        // Find or create the line item with this group_id
        let lineItem = readyJob.line_items.find(item => String(item.group_id) === String(group_id));
        if (!lineItem) {
            readyJob.line_items.push({
                group_id,
                material_name,
                material_specs,
                cycles: []
            });
            lineItem = readyJob.line_items.find(item => String(item.group_id) === String(group_id));
        }

        if ((good_qty || 0) <= 0) {
            return res.status(200).json({
                success: true,
                message: "No good quantity to record in Ready Jobs",
                data: readyJob
            });
        }

        // Check if this cycle is already created in the line item's cycles
        let existingCycle = lineItem.cycles.find(c => Number(c.cycle_number) === Number(cycle_number));

        if (!existingCycle) {
            lineItem.cycles.push({
                cycle_number: Number(cycle_number),
                good_qty: good_qty || 0,
                bad_qty: bad_qty || 0,
                completed_at: completed_at || getCurrentDate(),
                completed_by_name,
                completed_by: userId,
                handed_over: false
            });
            await readyJob.save();
            // Refetch to get the saved subdocument _id
            const updatedJob = await readyJobModel.findOne({ shopfloor_job_id: queryId });
            const updatedLineItem = updatedJob.line_items.find(item => String(item.group_id) === String(group_id));
            existingCycle = updatedLineItem.cycles.find(c => Number(c.cycle_number) === Number(cycle_number));
            readyJob = updatedJob;
            lineItem = updatedLineItem;
        }

        // Auto trigger next process progression so next department is updated and unlocked

        await automateNextProcessInward(
            shopfloor_job_id,
            group_id,
            cycle_number,
            good_qty || 0,
            completed_by_name || 'Operator',
            userId
        );

        // Return flattened structure for the frontend
        const flatItem = {
            _id: existingCycle._id,
            shopfloor_job_id: readyJob.shopfloor_job_id,
            job_no: readyJob.job_no,
            sub_job_no: readyJob.sub_job_no,
            process_name: readyJob.process_name,
            department: readyJob.department,
            client_name: readyJob.client_name,
            group_id: lineItem.group_id,
            material_name: lineItem.material_name,
            material_specs: lineItem.material_specs,
            cycle_number: existingCycle.cycle_number,
            good_qty: existingCycle.good_qty,
            bad_qty: existingCycle.bad_qty,
            completed_at: existingCycle.completed_at,
            completed_by_name: existingCycle.completed_by_name,
            completed_by: existingCycle.completed_by,
            handed_over: existingCycle.handed_over
        };

        // Automatically create FG Store if final process quantity is met
        await checkAndCreateFgStoreForSubJob(readyJob.sub_job_no);

        return res.status(201).json({ success: true, message: "Ready job created", data: flatItem });
    } catch (error) {
        console.error("createReadyJob error:", error);
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

/**
 * Fetch all ready jobs (pending handover by default)
 */
export const getReadyJobs = async (req, res) => {
    try {
        // eslint-disable-next-line no-unused-vars
        const { handed_over, job_no, department, shopfloor_job_id } = req.query;


        const query = {};

        if (job_no) query.job_no = { $regex: job_no, $options: 'i' };
        if (department) {
            if (department.toLowerCase() === 'laser') {
                query.department = { $in: ['laser', 'Laser'] };
            } else if (
                department.toLowerCase() === 'print' ||
                department.toLowerCase() === 'uv printing' ||
                department.toLowerCase() === 'uv print' ||
                department.toLowerCase() === 'printing'
            ) {
                query.department = { $in: ['print', 'Print', 'uv', 'UV', 'uv printing', 'UV Printing', 'uv print', 'UV Print', 'printing', 'Printing'] };
            } else if (
                department.toLowerCase().includes('assembly') ||
                department.toLowerCase().includes('labour')
            ) {
                query.department = { $in: ['assembly', 'Assembly', 'Assembly Labour', 'assembly labour', 'Assembly Department', 'assembly department'] };
            } else {
                query.department = { $regex: new RegExp(`^${department}$`, 'i') };
            }
        }
        // Self-healing: sync any completed sample cycles into readyJobModel so they show in Stock Ledger
        try {
            const flows = await ShopFloorProcessFlow.find({
                $or: [
                    { 'sample_cycles.good_qty': { $gt: 0 } },
                    { 'session_state.sample_cycles.good_qty': { $gt: 0 } }
                ]
            }).lean();

            for (const flow of flows) {
                // Skip if flow or sub_job sample was rejected
                if (flow.bom_sample_status === 'SAMPLE_REJECTED_INTERNAL' || flow.bom_sample_status === 'REJECTED_BY_SALES') {
                    continue;
                }

                const cycles = (flow.session_state?.sample_cycles?.length > 0)
                    ? flow.session_state.sample_cycles
                    : (flow.sample_cycles || []);

                const goodCycles = cycles.filter(c => (c.good_qty || 0) > 0 && c.status !== 'Rejected' && c.status !== 'REJECTED');
                if (goodCycles.length === 0) continue;

                const sfJob = await shopFloorJobModel.findById(flow.shopfloor_job_id).lean();
                if (!sfJob) continue;

                let readyJob = await readyJobModel.findOne({ shopfloor_job_id: flow.shopfloor_job_id });
                if (!readyJob) {
                    readyJob = new readyJobModel({
                        shopfloor_job_id: flow.shopfloor_job_id,
                        job_no: sfJob.job_no,
                        sub_job_no: sfJob.sub_job_no,
                        process_name: sfJob.process_name,
                        department: sfJob.department || 'Laser',
                        client_name: sfJob.client_name,
                        line_items: []
                    });
                }

                let lineItem = readyJob.line_items.find(item => String(item.group_id) === String(flow.group_id));
                if (!lineItem) {
                    const mg = sfJob.material_groups?.find(g => String(g._id) === String(flow.group_id) || String(g.group_id) === String(flow.group_id));
                    const mainMat = mg?.materials?.find(m => {
                        const cat = m.category_type?.toLowerCase() || '';
                        return !cat.includes('consumable') && !cat.includes('hardware');
                    });
                    const matSpec = mainMat?.material_input?.size ||
                        (mainMat?.material_input?.one_up_width && mainMat?.material_input?.one_up_length
                            ? `${mainMat.material_input.one_up_width}"x${mainMat.material_input.one_up_length}"`
                            : mainMat?.size || 'Standard');

                    readyJob.line_items.push({
                        group_id: flow.group_id,
                        material_name: mg?.group_name || 'Unknown Material',
                        material_specs: matSpec,
                        cycles: []
                    });
                    lineItem = readyJob.line_items.find(item => String(item.group_id) === String(flow.group_id));
                }

                let modified = false;
                for (const c of goodCycles) {
                    const cycleNum = 1000 + (c.cycle_number || 1);
                    const existing = lineItem.cycles.find(item => Number(item.cycle_number) === Number(cycleNum));
                    if (!existing) {
                        const completedByName = (c.started_by_name && c.started_by_name !== 'N/A' && c.started_by_name.trim() !== '') ? c.started_by_name : 'Ready Stock';
                        lineItem.cycles.push({
                            cycle_number: cycleNum,
                            good_qty: c.good_qty || 0,
                            bad_qty: c.bad_qty || 0,
                            completed_at: c.end_time || c.start_time || new Date().toISOString(),
                            completed_by_name: completedByName,
                            handed_over: c.handed_over || false
                        });
                        modified = true;
                    }
                }
                if (modified) {
                    await readyJob.save();
                }
            }
        } catch (syncErr) {
            console.error("Error syncing sample cycles to ready jobs:", syncErr);
        }

        const readyJobs = await readyJobModel.find(query).sort({ createdAt: -1 });

        // Pre-fetch related shopfloor jobs and BOMs for fast next-department lookup
        const sfJobIds = [...new Set(readyJobs.map(r => String(r.shopfloor_job_id)).filter(Boolean))];
        const sfJobs = sfJobIds.length > 0 ? await shopFloorJobModel.find({ _id: { $in: sfJobIds } }).lean() : [];
        const sfJobsMap = {};
        sfJobs.forEach(j => { sfJobsMap[String(j._id)] = j; });

        const bomIds = [...new Set(sfJobs.map(j => String(j.bom_id)).filter(Boolean))];
        const boms = bomIds.length > 0 ? await bomModel.find({ _id: { $in: bomIds } }).lean() : [];
        const bomsMap = {};
        boms.forEach(b => { bomsMap[String(b._id)] = b; });

        // Pre-fetch process flows to verify sample cycle rejection statuses
        const allFlows = sfJobIds.length > 0 ? await ShopFloorProcessFlow.find({ shopfloor_job_id: { $in: sfJobIds } }).lean() : [];
        const flowsMap = {};
        allFlows.forEach(f => {
            flowsMap[`${String(f.shopfloor_job_id)}_${String(f.group_id)}`] = f;
        });

        // Helper to resolve department name according to process rules
        const resolveDepartmentMapping = (procName = '', rawDept = '') => {
            const p = procName.toLowerCase().trim();
            const d = rawDept.toLowerCase().trim();

            if (p.includes('fg') || d.includes('fg') || p.includes('finished') || d.includes('finished')) {
                return 'FG Store';
            }
            if (p.includes('laser') || d.includes('laser')) {
                return 'Laser';
            }
            if (p.includes('uv') || p.includes('print') || d.includes('uv') || d.includes('print')) {
                return 'UV Printing';
            }
            if (p.includes('assembly')) {
                return 'Assembly';
            }
            // For any other dynamic / custom shop floor process
            return 'Shopfloor';
        };

        // Flatten the matching cycles from all ready jobs
        const flatItems = [];
        for (const doc of readyJobs) {
            const currentJob = sfJobsMap[String(doc.shopfloor_job_id)];
            const bom = currentJob ? bomsMap[String(currentJob.bom_id)] : null;
            let docModified = false;

            for (const item of doc.line_items) {
                // Determine next process and department from BOM for this line item / group
                let nextProcessName = '';
                let nextDepartment = '';

                if (bom && bom.materialprocess && bom.materialprocess.length > 0) {
                    const currentMg = currentJob?.material_groups?.find(mg =>
                        String(mg.group_id || mg._id) === String(item.group_id)
                    );

                    let processGroup = bom.materialprocess.find(p => {
                        if (!p) return false;
                        const pGroupId = String(p.material_group_id || p.group_id || p._id || '');
                        const itemId = String(item.group_id || '');
                        if (pGroupId && itemId && pGroupId === itemId) return true;

                        const cleanName = (str) => (str || '').toLowerCase().replace(/^(section|group):\s*/i, '').trim();
                        const pName = cleanName(p.material_group_name || p.group_name || '');
                        const mName = cleanName(item.material_name || currentMg?.group_name || '');
                        if (pName && mName && (pName === mName || pName.includes(mName) || mName.includes(pName))) return true;

                        return false;
                    });

                    // Fallback to first processGroup if single group in BOM
                    if (!processGroup && bom.materialprocess.length === 1) {
                        processGroup = bom.materialprocess[0];
                    }

                    if (processGroup && processGroup.processes && processGroup.processes.length > 0) {
                        let currentIdx = -1;

                        // 1. Match by process_index (e.g. "1.1")
                        if (currentMg?.process_index) {
                            currentIdx = processGroup.processes.findIndex(
                                p => String(p.process_index || p.index || '') === String(currentMg.process_index)
                            );
                        }

                        // 2. Exact process name match
                        if (currentIdx === -1) {
                            const docProcName = doc.process_name?.toLowerCase().trim() || '';
                            currentIdx = processGroup.processes.findIndex(
                                p => p.process_name?.toLowerCase().trim() === docProcName
                            );
                        }

                        // 3. Substring / Inclusion / Process Family match (e.g., "Laser Cutting Co2" matches "laser cutting" or "laser")
                        if (currentIdx === -1) {
                            const docProcName = doc.process_name?.toLowerCase().trim() || '';
                            currentIdx = processGroup.processes.findIndex(p => {
                                const bomProcName = p.process_name?.toLowerCase().trim() || '';
                                if (!bomProcName || !docProcName) return false;
                                if (bomProcName.includes(docProcName) || docProcName.includes(bomProcName)) return true;

                                const isLaser = (str) => str.includes('laser');
                                const isUV = (str) => str.includes('uv') || str.includes('print');
                                const isAssembly = (str) => str.includes('assembly') || str.includes('pack');

                                if (isLaser(bomProcName) && isLaser(docProcName)) return true;
                                if (isUV(bomProcName) && isUV(docProcName)) return true;
                                if (isAssembly(bomProcName) && isAssembly(docProcName)) return true;

                                return false;
                            });
                        }

                        if (currentIdx !== -1) {
                            // Find the next physical non-DTP process in BOM for material handover
                            let nextProc = null;
                            for (let i = currentIdx + 1; i < processGroup.processes.length; i++) {
                                const candidate = processGroup.processes[i];
                                const cName = (candidate.process_name || '').toLowerCase();
                                const cDept = (candidate.department || '').toLowerCase();
                                if (!cName.includes('dtp') && !cDept.includes('dtp')) {
                                    nextProc = candidate;
                                    break;
                                }
                            }

                            if (nextProc) {
                                nextProcessName = nextProc.process_name || '';
                                nextDepartment = resolveDepartmentMapping(nextProc.process_name, nextProc.department);
                            } else {
                                // Final physical process in BOM completed -> next destination is FG Store!
                                nextProcessName = 'FG Store';
                                nextDepartment = 'FG Store';
                            }
                        }
                    }
                }

                // Default fallback if BOM lookup did not match
                if (!nextDepartment) {
                    const currentMappedDept = resolveDepartmentMapping(doc.process_name, doc.department);
                    if (currentMappedDept === 'Assembly' || doc.process_name?.toLowerCase().includes('assembly')) {
                        nextDepartment = 'FG Store';
                        nextProcessName = 'FG Store';
                    } else {
                        nextDepartment = 'FG Store';
                        nextProcessName = 'FG Store';
                    }
                }

                const matchingFlow = flowsMap[`${String(doc.shopfloor_job_id)}_${String(item.group_id)}`];
                const validCycles = [];

                item.cycles.forEach(cycle => {
                    // Check if cycle is a sample cycle (cycle_number >= 1000)
                    const isSampleCycle = Number(cycle.cycle_number) >= 1000;
                    let isSampleRejectedOrBad = false;

                    if (isSampleCycle) {
                        if (matchingFlow) {
                            if (matchingFlow.bom_sample_status === 'SAMPLE_REJECTED_INTERNAL' || matchingFlow.bom_sample_status === 'REJECTED_BY_SALES') {
                                isSampleRejectedOrBad = true;
                            } else {
                                const sampleList = (matchingFlow.session_state?.sample_cycles?.length > 0)
                                    ? matchingFlow.session_state.sample_cycles
                                    : (matchingFlow.sample_cycles || []);

                                const targetNum = Number(cycle.cycle_number) >= 1000 ? Number(cycle.cycle_number) - 1000 : Number(cycle.cycle_number);
                                const matchSample = sampleList.find(sc => Number(sc.cycle_number) === targetNum);

                                if (matchSample && (matchSample.status === 'Rejected' || matchSample.status === 'REJECTED' || (matchSample.good_qty || 0) <= 0)) {
                                    isSampleRejectedOrBad = true;
                                }
                            }
                        }
                    }

                    const isGoodMatch = (cycle.good_qty || 0) > 0 && !isSampleRejectedOrBad;

                    if (!isGoodMatch) {
                        docModified = true;
                        return; // Exclude bad / rejected cycle
                    }

                    validCycles.push(cycle);

                    // Filter by handed_over criteria for response payload
                    const isHandedOverMatch = handed_over === 'true'
                        ? cycle.handed_over === true
                        : (handed_over === 'false' || handed_over === undefined)
                            ? cycle.handed_over === false
                            : true;

                    if (isHandedOverMatch) {
                        flatItems.push({
                            _id: cycle._id,
                            shopfloor_job_id: doc.shopfloor_job_id,
                            job_no: doc.job_no,
                            sub_job_no: doc.sub_job_no,
                            process_name: doc.process_name,
                            department: doc.department,
                            client_name: doc.client_name,
                            group_id: item.group_id,
                            material_name: item.material_name,
                            material_specs: item.material_specs,
                            cycle_number: cycle.cycle_number,
                            is_outsource: cycle.is_outsource || Number(cycle.cycle_number) >= 10000,
                            vendor_name: cycle.vendor_name,
                            good_qty: cycle.good_qty,
                            bad_qty: cycle.bad_qty,
                            completed_at: cycle.completed_at,
                            completed_by_name: cycle.completed_by_name,
                            completed_by: cycle.completed_by,
                            handed_over: cycle.handed_over,
                            handover_to_department: cycle.handover_to_department,
                            handover_to_receiver: cycle.handover_to_receiver,
                            handover_at: cycle.handover_at,
                            handover_by: cycle.handover_by,
                            handover_by_name: cycle.handover_by_name,
                            next_process_name: nextProcessName,
                            next_department: nextDepartment
                        });
                    }
                });

                item.cycles = validCycles;
            }

            if (docModified) {
                await readyJobModel.updateOne({ _id: doc._id }, { $set: { line_items: doc.line_items } });
            }
        }

        return res.status(200).json({ success: true, count: flatItems.length, data: flatItems });
    } catch (error) {
        console.error("getReadyJobs error:", error);
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

/**
 * Confirm handover — mark ready job as transferred
 */
export const confirmHandover = async (req, res) => {
    try {
        const { id } = req.params;
        const { department, receiver, confirmed_by_name } = req.body;
        const userId = req.user?._id;

        const readyJob = await readyJobModel.findOne({ "line_items.cycles._id": id });
        if (!readyJob) {
            return res.status(404).json({ success: false, message: "Ready job cycle not found" });
        }

        // Find the line item and cycle
        let matchedLineItem = null;
        let matchedCycle = null;

        for (const item of readyJob.line_items) {
            const cycle = item.cycles.id(id);
            if (cycle) {
                matchedLineItem = item;
                matchedCycle = cycle;
                break;
            }
        }

        if (!matchedCycle) {
            return res.status(404).json({ success: false, message: "Ready job cycle not found in nested lists" });
        }

        if (matchedCycle.handed_over) {
            return res.status(400).json({ success: false, message: "This cycle has already been handed over" });
        }

        matchedCycle.handed_over = true;
        matchedCycle.handover_to_department = department;
        matchedCycle.handover_to_receiver = receiver;
        matchedCycle.handover_at = getCurrentDate();
        matchedCycle.handover_by = userId;
        matchedCycle.handover_by_name = confirmed_by_name || '';

        await readyJob.save();

        // Automatically record material inward for the next process in sequence
        try {
            const currentJob = await shopFloorJobModel.findById(readyJob.shopfloor_job_id);
            if (currentJob) {
                const bom = await bomModel.findById(currentJob.bom_id);
                if (bom && bom.materialprocess) {
                    const processGroup = bom.materialprocess.find(
                        p => String(p.material_group_id) === String(matchedLineItem.group_id)
                    );
                    if (processGroup && processGroup.processes) {
                        // Resolve the current material group from the job to get its process_index
                        const currentMg = currentJob.material_groups?.find(mg =>
                            String(mg.group_id || mg._id) === String(matchedLineItem.group_id)
                        );
                        let currentIdx = -1;
                        if (currentMg?.process_index) {
                            currentIdx = processGroup.processes.findIndex(
                                p => p.process_index === currentMg.process_index
                            );
                        }
                        if (currentIdx === -1) {
                            currentIdx = processGroup.processes.findIndex(
                                p => p.process_name?.toLowerCase().trim() === currentJob.process_name?.toLowerCase().trim()
                            );
                        }
                        if (currentIdx !== -1) {
                            // Find the next physical non-DTP process in BOM for material handover
                            let nextProc = null;
                            for (let i = currentIdx + 1; i < processGroup.processes.length; i++) {
                                const candidate = processGroup.processes[i];
                                const cName = (candidate.process_name || '').toLowerCase();
                                const cDept = (candidate.department || '').toLowerCase();
                                if (!cName.includes('dtp') && !cDept.includes('dtp')) {
                                    nextProc = candidate;
                                    break;
                                }
                            }

                            if (nextProc) {
                                const cleanProcName = nextProc.process_name.trim();
                                const nextJob = await shopFloorJobModel.findOne({
                                    sub_job_no: currentJob.sub_job_no,
                                    $or: [
                                        { process_name: { $regex: new RegExp(`^${cleanProcName}$`, "i") } },
                                        { process_name: { $regex: new RegExp(cleanProcName, "i") } },
                                        { process_name: { $regex: new RegExp(cleanProcName.split(" ")[0], "i") } }
                                    ]
                                });
                                if (nextJob) {
                                    // Match by group_id AND process_index (if present) to target the right entry
                                    const nextGroupIndex = nextJob.material_groups.findIndex(mg =>
                                        String(mg.group_id || mg._id) === String(matchedLineItem.group_id) &&
                                        (nextProc.process_index ? mg.process_index === nextProc.process_index : true)
                                    );
                                    if (nextGroupIndex !== -1) {
                                        const nextGroup = nextJob.material_groups[nextGroupIndex];

                                        if (Number(matchedCycle.cycle_number) >= 10000) {
                                            nextGroup.is_outsource_received = true;
                                        } else if (Number(matchedCycle.cycle_number) >= 1000) {
                                            nextGroup.sampling_on = true;
                                        }

                                        nextJob.markModified('material_groups');

                                        if (Number(matchedCycle.good_qty) >= 1) {
                                            if (!nextGroup.process_history) nextGroup.process_history = [];
                                            const hasConsoleReady = nextGroup.process_history.some(log => log.action === 'CONSOLE READY');
                                            if (!hasConsoleReady) {
                                                nextGroup.process_history.push({
                                                    activity_type: 'System',
                                                    action: 'CONSOLE READY',
                                                    operator_name: receiver || confirmed_by_name || 'System',
                                                    operator_id: userId,
                                                    timestamp: new Date().toISOString(),
                                                    affected_groups: [matchedLineItem.material_name],
                                                    details: {
                                                        remarks: `Automated handover inward from ${readyJob.process_name}`,
                                                        good_qty: Number(matchedCycle.good_qty),
                                                        bad_qty: 0
                                                    }
                                                });
                                            }

                                            // If this is a sample cycle handover (cycle_number >= 1000), record in inward_history to update inwardedGoodCount for downstream sample rerun
                                            if (Number(matchedCycle.cycle_number) >= 1000) {
                                                if (!nextGroup.inward_history) nextGroup.inward_history = [];
                                                nextGroup.inward_history.push({
                                                    inward_id: readyJob._id,
                                                    inspect_qty: Number(matchedCycle.good_qty),
                                                    good_qty: Number(matchedCycle.good_qty),
                                                    bad_qty: 0,
                                                    operator_name: receiver || confirmed_by_name || 'System',
                                                    operator_id: userId,
                                                    remarks: `Automated sample handover inward from ${readyJob.process_name}`,
                                                    materials: [],
                                                    timestamp: new Date().toISOString(),
                                                    created_at: getCurrentDate()
                                                });
                                            }
                                        }

                                        if (nextJob.status === 'Pending') {
                                            nextJob.status = 'In Progress';
                                            nextJob.assigned_at = getCurrentDate();
                                        }

                                        await nextJob.save();
                                        console.log(`[Handover Automation] Automated inwarded ${matchedCycle.good_qty} to job ${nextJob.sub_job_no} for process ${nextJob.process_name}`);

                                        // Reset downstream process flow state from WAITING_UPSTREAM to IDLE when sample cycle is handed over
                                        if (Number(matchedCycle.cycle_number) >= 1000) {
                                            try {
                                                const nextFlow = await ShopFloorProcessFlow.findOne({
                                                    shopfloor_job_id: nextJob._id,
                                                    group_id: matchedLineItem.group_id
                                                });
                                                if (nextFlow) {
                                                    if (!nextFlow.session_state) nextFlow.session_state = {};
                                                    if (!nextFlow.session_state.runningCycles || typeof nextFlow.session_state.runningCycles !== 'object') {
                                                        nextFlow.session_state.runningCycles = {};
                                                    }
                                                    const currentGroupStatus = nextFlow.session_state.runningCycles[matchedLineItem.group_id]?.status;
                                                    if (currentGroupStatus === 'WAITING_UPSTREAM' || nextFlow.bom_sample_status === 'SAMPLE_REJECTED_INTERNAL') {
                                                        nextFlow.session_state.runningCycles[matchedLineItem.group_id] = {
                                                            status: 'IDLE',
                                                            is_rerun: true,
                                                            cyclesDone: (nextFlow.session_state?.sample_cycles?.length || nextFlow.sample_cycles?.length || 0)
                                                        };
                                                        nextFlow.bom_sample_status = 'IN_SAMPLE_PIPELINE';
                                                        nextFlow.markModified('session_state');
                                                        await nextFlow.save();
                                                    }
                                                }

                                                if (nextJob.sub_job_no) {
                                                    await ShopFloorProcessFlow.updateMany(
                                                        { sub_job_no: nextJob.sub_job_no, bom_sample_status: 'SAMPLE_REJECTED_INTERNAL' },
                                                        { $set: { bom_sample_status: 'IN_SAMPLE_PIPELINE' } }
                                                    );
                                                    await shopFloorJobModel.updateMany(
                                                        { sub_job_no: nextJob.sub_job_no, bom_sample_status: 'SAMPLE_REJECTED_INTERNAL' },
                                                        { $set: { bom_sample_status: 'IN_SAMPLE_PIPELINE' } }
                                                    );
                                                }
                                            } catch (fErr) {
                                                console.error("[Handover Automation] Error updating downstream process flow state:", fErr);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.error("[Handover Automation] Failed to perform automated inward:", e);
        }

        // Update handed_over flag in ShopFloorProcessFlow
        try {
            const flow = await ShopFloorProcessFlow.findOne({
                shopfloor_job_id: readyJob.shopfloor_job_id,
                group_id: matchedLineItem.group_id
            });
            if (flow && flow.session_state) {
                let isModified = false;

                if (flow.session_state.primary_cycles) {
                    const pCycle = flow.session_state.primary_cycles.id(matchedCycle._id) ||
                        flow.session_state.primary_cycles.find(c => c.cycle_number === matchedCycle.cycle_number);
                    if (pCycle) {
                        pCycle.handed_over = true;
                        isModified = true;
                    }
                }
                if (flow.session_state.sample_cycles) {
                    const sCycle = flow.session_state.sample_cycles.id(matchedCycle._id) ||
                        flow.session_state.sample_cycles.find(c => c.cycle_number === matchedCycle.cycle_number);
                    if (sCycle) {
                        sCycle.handed_over = true;
                        isModified = true;
                    }
                }
                if (flow.session_state.recut_cycles) {
                    const rCycle = flow.session_state.recut_cycles.id(matchedCycle._id) ||
                        flow.session_state.recut_cycles.find(c => c.cycle_number === matchedCycle.cycle_number);
                    if (rCycle) {
                        rCycle.handed_over = true;
                        isModified = true;
                    }
                }

                if (isModified) {
                    flow.markModified('session_state');
                    await flow.save();
                    console.log(`[Handover] Updated handed_over flag in ShopFloorProcessFlow for cycle ${matchedCycle.cycle_number}`);
                }
            }
        } catch (flowErr) {
            console.error("[Handover] Failed to update ShopFloorProcessFlow handed_over flag:", flowErr);
        }

        const flatItem = {
            _id: matchedCycle._id,
            shopfloor_job_id: readyJob.shopfloor_job_id,
            job_no: readyJob.job_no,
            sub_job_no: readyJob.sub_job_no,
            process_name: readyJob.process_name,
            department: readyJob.department,
            client_name: readyJob.client_name,
            group_id: matchedLineItem.group_id,
            material_name: matchedLineItem.material_name,
            material_specs: matchedLineItem.material_specs,
            cycle_number: matchedCycle.cycle_number,
            good_qty: matchedCycle.good_qty,
            bad_qty: matchedCycle.bad_qty,
            completed_at: matchedCycle.completed_at,
            completed_by_name: matchedCycle.completed_by_name,
            completed_by: matchedCycle.completed_by,
            handed_over: matchedCycle.handed_over,
            handover_to_department: matchedCycle.handover_to_department,
            handover_to_receiver: matchedCycle.handover_to_receiver,
            handover_at: matchedCycle.handover_at,
            handover_by: matchedCycle.handover_by,
            handover_by_name: matchedCycle.handover_by_name
        };

        // Automatically create FG Store if this is the final process and quantity is met
        await checkAndCreateFgStoreForSubJob(readyJob.sub_job_no);

        return res.status(200).json({ success: true, message: "Handover confirmed", data: flatItem });
    } catch (error) {
        console.error("confirmHandover error:", error);
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

// Get outsource assignment details for vendor confirmation (unauthenticated)
export const getVendorOutsourceView = async (req, res) => {
    try {
        const { token } = req.params;
        if (!token) {
            return res.status(400).json({ success: false, message: "Token is required" });
        }

        // Find the job containing the matching outsource assignment token
        const job = await shopFloorJobModel.findOne({
            "material_groups.outsource_assignments.token": token
        }).lean();

        if (!job) {
            return res.status(404).json({ success: false, message: "Invalid confirmation link" });
        }

        // Find the specific group and assignment
        let matchedGroup = null;
        let matchedAssignment = null;

        for (const group of job.material_groups) {
            const assign = (group.outsource_assignments || []).find(a => a.token === token);
            if (assign) {
                matchedGroup = group;
                matchedAssignment = assign;
                break;
            }
        }

        if (!matchedGroup || !matchedAssignment) {
            return res.status(404).json({ success: false, message: "Assignment not found in job" });
        }

        // Check if token has expired
        if (matchedAssignment.token_expires_at && new Date(matchedAssignment.token_expires_at) < new Date()) {
            return res.status(403).json({ success: false, message: "This confirmation link has expired. Please contact RDCA." });
        }

        // Check if link has already been responded to
        if (matchedAssignment.status && matchedAssignment.status !== 'Pending') {
            return res.status(400).json({
                success: false,
                message: `This outsource assignment request has already been responded to (Current Status: ${matchedAssignment.status}).`
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                job_id: job._id,
                job_no: job.job_no,
                sub_job_no: job.sub_job_no,
                client_name: job.client_name,
                product_name: job.product_name,
                process_name: job.process_name,
                is_reprocess: job.is_reprocess,
                group_id: matchedGroup.group_id || matchedGroup._id,
                group_name: matchedGroup.group_name,
                materials: matchedGroup.materials,
                actual_input: matchedGroup.input?.actual_input,
                assignment: {
                    vendor_id: matchedAssignment.vendor_id,
                    vendor_name: matchedAssignment.vendor_name,
                    outsource_rate: matchedAssignment.outsource_rate,
                    outsource_qty: matchedAssignment.outsource_qty,
                    outsource_sheets: matchedAssignment.outsource_sheets,
                    outsource_delivery_date: matchedAssignment.outsource_delivery_date,
                    status: matchedAssignment.status,
                    rejection_reason: matchedAssignment.rejection_reason
                }
            }
        });
    } catch (error) {
        console.error("getVendorOutsourceView error:", error);
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

// Public: Submit vendor response (Confirm/Reject) for outsource assignment (unauthenticated)
export const submitVendorOutsourceResponse = async (req, res) => {
    try {
        const { token } = req.params;
        const { action, outsource_delivery_date, rejection_reason } = req.body;

        if (!token) {
            return res.status(400).json({ success: false, message: "Token is required" });
        }

        if (!action || !['confirm', 'reject'].includes(action)) {
            return res.status(400).json({ success: false, message: "Valid action ('confirm' or 'reject') is required" });
        }

        // Find the job with the token
        const job = await shopFloorJobModel.findOne({
            "material_groups.outsource_assignments.token": token
        });

        if (!job) {
            return res.status(404).json({ success: false, message: "Invalid or expired confirmation link" });
        }

        // Find group and assignment indices
        let groupIdx = -1;
        let assignIdx = -1;

        for (let gIdx = 0; gIdx < job.material_groups.length; gIdx++) {
            const aIdx = (job.material_groups[gIdx].outsource_assignments || []).findIndex(a => a.token === token);
            if (aIdx !== -1) {
                groupIdx = gIdx;
                assignIdx = aIdx;
                break;
            }
        }

        if (groupIdx === -1 || assignIdx === -1) {
            return res.status(404).json({ success: false, message: "Assignment not found" });
        }

        const group = job.material_groups[groupIdx];
        const assignment = group.outsource_assignments[assignIdx];

        // Expiry check
        if (assignment.token_expires_at && new Date(assignment.token_expires_at) < new Date()) {
            return res.status(403).json({ success: false, message: "This confirmation link has expired." });
        }

        // Check if link has already been responded to
        if (assignment.status && assignment.status !== 'Pending') {
            return res.status(400).json({ success: false, message: "This outsource request has already been responded to." });
        }

        if (action === 'confirm') {
            if (!outsource_delivery_date) {
                return res.status(400).json({ success: false, message: "Delivery date is required for confirmation" });
            }

            assignment.status = 'Confirmed';
            assignment.outsource_delivery_date = outsource_delivery_date;

            // Add stage history entry
            if (!assignment.stage_history) assignment.stage_history = [];
            assignment.stage_history.push({
                stage_idx: assignment.current_stage_idx || 0,
                stage_label: 'Vendor Confirmed',
                updated_at: getCurrentDate()
            });

            // Propagate delivery date to parent group summary if this is the first/primary assignment
            if (group.outsource_assignments[0]?.token === token) {
                group.outsource_delivery_date = outsource_delivery_date;
            }

            // Record in assign history instead of group process history
            if (!job.assign_history) job.assign_history = [];
            job.assign_history.push({
                shifts: [4], // Outsource shift
                assigned_by: null, // Public vendor confirmation
                assigned_at: getCurrentDate(),
                remark: "Vendor confirmed assignment",
                group_id: String(group._id || group.group_id),
                group_name: group.group_name,
                vendor_id: assignment.vendor_id,
                price: assignment.outsource_rate || 0,
                status: 'Confirmed',
                sheet_qty: assignment.outsource_sheets || 0,
                output_qty: assignment.outsource_qty || 0,
                outsource_delivery_date: outsource_delivery_date
            });

        } else if (action === 'reject') {
            if (!rejection_reason) {
                return res.status(400).json({ success: false, message: "Rejection reason is required" });
            }

            assignment.status = 'Rejected';
            assignment.rejection_reason = rejection_reason;

            // Record in assign history instead of group process history
            if (!job.assign_history) job.assign_history = [];
            job.assign_history.push({
                shifts: [4], // Outsource shift (even if rejected)
                assigned_by: null, // Public vendor rejection
                assigned_at: getCurrentDate(),
                remark: "Vendor rejected assignment",
                group_id: String(group._id || group.group_id),
                group_name: group.group_name,
                vendor_id: assignment.vendor_id,
                price: assignment.outsource_rate || 0,
                status: 'Rejected',
                rejection_reason: rejection_reason,
                sheet_qty: assignment.outsource_sheets || 0,
                output_qty: assignment.outsource_qty || 0
            });
        }

        // Recalculate progress and job status
        updateGroupProgress(group);
        updateJobOverallProgress(job);

        // Mark material_groups modified so Mongoose detects changes in deep nested arrays
        job.markModified('material_groups');

        // Save changes
        await job.save();

        return res.status(200).json({
            success: true,
            message: `Assignment successfully ${action === 'confirm' ? 'confirmed' : 'rejected'}`
        });

    } catch (error) {
        console.error("submitVendorOutsourceResponse error:", error);
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

/**
 * Upload outsource vendor invoice document to Cloudflare R2
 */
export const uploadOutsourceInvoice = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No invoice file provided" });
        }
        const fileUrl = await uploadToR2(
            "outsource_vendor_invoices",
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype
        );
        const signedUrl = generateSignedUrl(fileUrl, 86400, false);
        return res.status(200).json({
            success: true,
            url: fileUrl,
            signedUrl: signedUrl,
            name: req.file.originalname,
            message: "Outsource invoice uploaded successfully"
        });
    } catch (err) {
        console.error("uploadOutsourceInvoice error:", err);
        return res.status(500).json({ success: false, message: err.message || "Failed to upload invoice document" });
    }
};
