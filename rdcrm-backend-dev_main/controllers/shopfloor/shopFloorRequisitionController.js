import shopFloorRequisitionModel from "../../models/shopfloor/shopFloorRequisitionModel.js";
import shopFloorJobModel from "../../models/shopfloor/shopFloorJobModel.js";
import "../../models/bom/bomModel.js";
import { getCurrentDate } from "../../helpers/dateTime.js";
import mongoose from "mongoose";
import itemModel from "../../models/inventory/item/itemModel.js";
import customItemModel from "../../models/inventory/customItem/customItemModel.js";
import shopFloorInventoryModel from "../../models/shopfloor/shopFloorInventoryModel.js";
import stockSizeModel from "../../models/inventory/common/stockSizeModel.js";

// Create a new requisition
export const createRequisition = async (req, res) => {
    try {
        const {
            type,
            category,
            job_no,
            shopfloor_job_id,
            group_id,
            item_description,
            qty,
            reprocess_job_qty,
            unit,
            urgent,
            remarks,
            department,
            item_id,
            custom_item_id,
            size_id,
            size_name
        } = req.body;

        if (!type || (type !== 'Reprocess' && !item_description) || !qty) {
            return res.status(400).json({ success: false, message: "Type, Item Description, and Quantity are required." });
        }

        let finalShopfloorJobId = shopfloor_job_id && mongoose.Types.ObjectId.isValid(shopfloor_job_id) ? shopfloor_job_id : undefined;
        let finalDepartment = department || req.user?.departmentName || "Laser";

        if (type === 'Reprocess') {
            let targetJob = null;
            if (shopfloor_job_id && mongoose.Types.ObjectId.isValid(shopfloor_job_id)) {
                targetJob = await shopFloorJobModel.findById(shopfloor_job_id).populate("bom_id");
            }
            const isStoreRequest = targetJob && (targetJob.is_reprocess || targetJob.sub_job_no?.includes('-R'));

            if (!isStoreRequest) {
                // Initial reprocess creation: directly trigger sequence, do not save requisition
                const requisitionMock = {
                    shopfloor_job_id: shopfloor_job_id && mongoose.Types.ObjectId.isValid(shopfloor_job_id) ? shopfloor_job_id : undefined,
                    group_id: group_id || undefined,
                    item_description: item_description || "",
                    qty: Number(qty),
                    reprocess_job_qty: reprocess_job_qty ? Number(reprocess_job_qty) : undefined,
                    unit: unit || "pcs",
                    department: department || req.user?.departmentName || "Laser"
                };
                await triggerJobReprocessSequence(requisitionMock);
                return res.status(201).json({
                    success: true,
                    message: "Reprocess job sequence created directly",
                    data: {}
                });
            } else {
                // It is a store request from an existing reprocess job!
                // Resolve the first job in the sequence so that the requisition goes to the first department/job.
                if (targetJob && targetJob.bom_id) {
                    const bom = targetJob.bom_id;
                    const targetGroupId = group_id || (targetJob.material_groups?.[0]?.group_id || targetJob.material_groups?.[0]?._id);

                    // Resolve actual BOM group_id
                    let bomGroupId = targetGroupId;
                    const matchedGroup = targetJob.material_groups?.find(mg =>
                        String(mg._id) === String(targetGroupId) || String(mg.group_id) === String(targetGroupId)
                    );
                    if (matchedGroup) {
                        bomGroupId = matchedGroup.group_id;
                    }

                    const rerunProcesses = getReprocessSequence(bom, targetJob.process_name, bomGroupId);
                    if (rerunProcesses.length > 0) {
                        const firstProcessName = rerunProcesses[0].process_name.toLowerCase().trim();
                        const firstJob = await shopFloorJobModel.findOne({
                            sub_job_no: targetJob.sub_job_no,
                            process_name: new RegExp(`^${firstProcessName}$`, "i")
                        });
                        if (firstJob) {
                            finalShopfloorJobId = firstJob._id;
                            finalDepartment = firstJob.department === 'UV Printing' ? 'Print' : firstJob.department;
                        }
                    }
                }
            }
        }

        const operator_id = req.user?._id || req.user?.id || null;
        const operator_name = req.user?.name || req.user?.username || "Operator";

        // Generate sequential requisition number by finding the highest current suffix to avoid duplicates on deletion
        const lastReq = await shopFloorRequisitionModel.findOne().sort({ requisition_no: -1 });
        let nextNo = 1;
        if (lastReq && lastReq.requisition_no) {
            const match = lastReq.requisition_no.match(/REQ-(\d+)/);
            if (match) {
                nextNo = parseInt(match[1], 10) + 1;
            }
        }
        const requisition_no = `REQ-${String(nextNo).padStart(4, '0')}`;

        // Resolve item_id if it is a nanoid
        let resolvedItemId = undefined;
        if (item_id) {
            if (mongoose.Types.ObjectId.isValid(item_id)) {
                resolvedItemId = item_id;
            } else {
                const itemDoc = await itemModel.findOne({ id: item_id }).lean();
                if (itemDoc) {
                    resolvedItemId = itemDoc._id;
                }
            }
        }

        // Fallback to name-based lookup if resolvedItemId is not found and item_description is present
        if (!resolvedItemId && item_description) {
            const descLower = item_description.toLowerCase().trim();
            const itemDoc = await itemModel.findOne({
                name: { $regex: new RegExp(`^${descLower}$`, "i") }
            }).lean();
            if (itemDoc) {
                resolvedItemId = itemDoc._id;
            }
        }

        // Resolve size_id if item_id and size_name are present but size_id is missing
        let resolvedSizeId = size_id;
        if (!resolvedSizeId && resolvedItemId && size_name) {
            try {
                const itemDoc = await itemModel.findById(resolvedItemId).populate("stock_sizes").lean();
                if (itemDoc && itemDoc.stock_sizes) {
                    const norm = s => (s || '').toLowerCase().replace(/\s+/g, '');
                    const targetSize = norm(size_name);
                    const matchedSz = itemDoc.stock_sizes.find(sz => {
                        if (!sz) return false;
                        if (typeof sz === 'object') {
                            return norm(sz.size) === targetSize || norm(`${sz.width}x${sz.height}`) === targetSize;
                        }
                        return false;
                    });
                    if (matchedSz) {
                        resolvedSizeId = matchedSz._id;
                    }
                }
            } catch (err) {
                console.error("Error resolving size_id for requisition:", err);
            }
        }

        const newRequisition = new shopFloorRequisitionModel({
            requisition_no,
            type,
            category: category || "General",
            job_no: job_no || "General / No specific job",
            shopfloor_job_id: finalShopfloorJobId,
            group_id: group_id || undefined,
            item_description,
            qty: Number(qty),
            reprocess_job_qty: reprocess_job_qty ? Number(reprocess_job_qty) : undefined,
            unit: unit || "pcs",
            urgent: !!urgent,
            remarks: remarks || "",
            requested_by: operator_name,
            requested_by_id: operator_id,
            department: finalDepartment,
            item_id: resolvedItemId && mongoose.Types.ObjectId.isValid(resolvedItemId) ? resolvedItemId : undefined,
            custom_item_id: custom_item_id && mongoose.Types.ObjectId.isValid(custom_item_id) ? custom_item_id : undefined,
            size_id: resolvedSizeId && mongoose.Types.ObjectId.isValid(resolvedSizeId) ? resolvedSizeId : undefined,
            size_name: size_name || undefined,
            status: "PENDING",
            created_at: getCurrentDate()
        });

        await newRequisition.save();

        return res.status(201).json({
            success: true,
            message: "Requisition raised successfully",
            data: newRequisition
        });
    } catch (error) {
        console.error("createRequisition error:", error);
        return res.status(500).json({ success: false, message: "Server error creating requisition", error: error.message });
    }
};

export const getRequisitionsList = async (req, res) => {
    try {
        const { department, status, type, shopfloor_job_id, job_no, group_id } = req.query;
        const query = {};

        if (department) {
            let depts = [department];
            if (department.toLowerCase() === 'print') depts.push('UV Printing');
            if (department.toLowerCase() === 'uv printing') depts.push('Print');

            const localReprocessJobs = await shopFloorJobModel.find({
                department: { $in: depts },
                is_reprocess: true
            }).select('sub_job_no').lean();
            const localSubJobNos = localReprocessJobs.map(j => j.sub_job_no).filter(Boolean);

            query.$or = [
                { department: department },
                {
                    type: 'Reprocess',
                    job_no: { $in: localSubJobNos }
                }
            ];
        }

        if (status) query.status = status;
        if (type) query.type = type;

        if (shopfloor_job_id) {
            const jobDoc = await shopFloorJobModel.findById(shopfloor_job_id);
            if (jobDoc && (jobDoc.is_reprocess || jobDoc.sub_job_no?.includes('-R'))) {
                // For reprocess runs, get all sibling jobs
                const siblings = await shopFloorJobModel.find({ sub_job_no: jobDoc.sub_job_no }).select('_id');
                const siblingIds = siblings.map(s => s._id);
                query.shopfloor_job_id = { $in: siblingIds };
            } else {
                query.shopfloor_job_id = shopfloor_job_id;
            }
        }

        if (job_no) query.job_no = job_no;
        if (group_id) query.group_id = group_id;

        const list = await shopFloorRequisitionModel.find(query).sort({ createdAt: -1 }).lean();

        return res.status(200).json({ success: true, data: list });
    } catch (error) {
        console.error("getRequisitionsList error:", error);
        return res.status(500).json({ success: false, message: "Server error fetching requisitions list", error: error.message });
    }
};

// Update requisition status (e.g. Fulfill/Issue, Receive, Reject)
export const updateRequisitionStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, issued_qty } = req.body; // "ISSUED", "PARTIAL", "RECEIVED", "REJECTED"

        if (!status) {
            return res.status(400).json({ success: false, message: "Status is required." });
        }

        const requisition = await shopFloorRequisitionModel.findById(id);
        if (!requisition) {
            return res.status(404).json({ success: false, message: "Requisition not found." });
        }

        const userName = req.user?.name || req.user?.username || "System User";
        const previousStatus = requisition.status;

        const prevIssuedQty = requisition.issued_qty || 0;
        const newIssuedQty = Number(issued_qty !== undefined ? issued_qty : requisition.qty);
        const deltaQty = Math.max(0, newIssuedQty - prevIssuedQty);

        let mainStoreItem = null;
        let isCustom = false;

        // Perform stock validation before modifying any data
        if ((status === "ISSUED" || status === "PARTIAL") && deltaQty > 0) {
            // 1. Try to find the item in main store
            if (requisition.item_id) {
                mainStoreItem = await itemModel.findById(requisition.item_id).populate('stock_sizes');
            } else if (requisition.custom_item_id) {
                mainStoreItem = await customItemModel.findById(requisition.custom_item_id);
                isCustom = true;
            }

            // 2. Fallback: Search by item_description match
            if (!mainStoreItem && requisition.item_description) {
                const descLower = requisition.item_description.toLowerCase().trim();
                mainStoreItem = await itemModel.findOne({
                    $or: [
                        { name: { $regex: new RegExp(`^${descLower}$`, "i") } },
                        { item_code: { $regex: new RegExp(`^${descLower}$`, "i") } }
                    ]
                }).populate('stock_sizes');

                if (!mainStoreItem) {
                    mainStoreItem = await customItemModel.findOne({
                        $or: [
                            { name: { $regex: new RegExp(`^${descLower}$`, "i") } },
                            { item_code: { $regex: new RegExp(`^${descLower}$`, "i") } }
                        ]
                    });
                    if (mainStoreItem) isCustom = true;
                }
            }

            // Validate available stock
            if (mainStoreItem) {
                if (!isCustom && mainStoreItem.item_type === 'sheet') {
                    let sizeDoc = null;
                    if (requisition.size_id) {
                        sizeDoc = mainStoreItem.stock_sizes?.find(sz => String(sz._id) === String(requisition.size_id));
                    }
                    if (!sizeDoc && requisition.size_name) {
                        const norm = s => (s || '').toLowerCase().replace(/\s+/g, '');
                        const targetSize = norm(requisition.size_name);
                        sizeDoc = mainStoreItem.stock_sizes?.find(sz => {
                            return norm(sz.size) === targetSize || norm(`${sz.width}x${sz.height}`) === targetSize;
                        });
                    }
                    if (!sizeDoc && requisition.item_description) {
                        const matSizeMatch = requisition.item_description.match(/Size:\s*([^\s()]+)/i);
                        if (matSizeMatch) {
                            const norm = s => (s || '').toLowerCase().replace(/\s+/g, '');
                            const targetSize = norm(matSizeMatch[1]);
                            sizeDoc = mainStoreItem.stock_sizes?.find(sz => {
                                return norm(sz.size) === targetSize || norm(`${sz.width}x${sz.height}`) === targetSize;
                            });
                        }
                    }

                    if (sizeDoc) {
                        let sizeStock = mainStoreItem.size_wise_stock?.find(s => String(s.size_id) === String(sizeDoc._id));
                        const available = sizeStock ? (sizeStock.count || 0) : 0;
                        if (available < deltaQty) {
                            return res.status(400).json({
                                success: false,
                                message: `Insufficient stock! Only ${available} sheets available for size ${sizeDoc.size || `${sizeDoc.width}x${sizeDoc.height}`}`
                            });
                        }
                    } else {
                        if ((mainStoreItem.stock || 0) < deltaQty) {
                            return res.status(400).json({
                                success: false,
                                message: `Insufficient stock! Only ${mainStoreItem.stock || 0} sheets available in master inventory`
                            });
                        }
                    }
                } else {
                    if ((mainStoreItem.stock || 0) < deltaQty) {
                        return res.status(400).json({
                            success: false,
                            message: `Insufficient stock! Only ${mainStoreItem.stock || 0} ${requisition.unit || 'units'} available in master inventory`
                        });
                    }
                }
            }
        }

        // Apply changes
        requisition.status = status;
        requisition.updated_at = getCurrentDate();

        if (issued_qty !== undefined) {
            requisition.issued_qty = Number(issued_qty);
        }

        if (status === "ISSUED" || status === "PARTIAL") {
            requisition.issued_by = userName;
            requisition.issued_at = getCurrentDate();

            // ONLY trigger the shopfloor job recreation sequence if type is "Reprocess"
            // and it transitions from PENDING status, and the job is not already a reprocess job.
            if (requisition.type === "Reprocess" && previousStatus === "PENDING") {
                const sfJob = await shopFloorJobModel.findById(requisition.shopfloor_job_id);
                if (sfJob && !sfJob.is_reprocess && !(sfJob.sub_job_no && sfJob.sub_job_no.includes('-R'))) {
                    await triggerJobReprocessSequence(requisition);
                }
            }

            // Sync Main Store and Shop Floor Stock
            if (deltaQty > 0) {
                try {
                    // 3. Deduct from Main Store Stock
                    if (mainStoreItem) {
                        if (!isCustom && mainStoreItem.item_type === 'sheet') {
                            let sizeDoc = null;
                            if (requisition.size_id) {
                                sizeDoc = mainStoreItem.stock_sizes?.find(sz => String(sz._id) === String(requisition.size_id));
                            }
                            if (!sizeDoc && requisition.size_name) {
                                const norm = s => (s || '').toLowerCase().replace(/\s+/g, '');
                                const targetSize = norm(requisition.size_name);
                                sizeDoc = mainStoreItem.stock_sizes?.find(sz => {
                                    return norm(sz.size) === targetSize || norm(`${sz.width}x${sz.height}`) === targetSize;
                                });
                            }
                            if (!sizeDoc && requisition.item_description) {
                                const matSizeMatch = requisition.item_description.match(/Size:\s*([^\s()]+)/i);
                                if (matSizeMatch) {
                                    const norm = s => (s || '').toLowerCase().replace(/\s+/g, '');
                                    const targetSize = norm(matSizeMatch[1]);
                                    sizeDoc = mainStoreItem.stock_sizes?.find(sz => {
                                        return norm(sz.size) === targetSize || norm(`${sz.width}x${sz.height}`) === targetSize;
                                    });
                                }
                            }

                            if (sizeDoc) {
                                let sizeStock = mainStoreItem.size_wise_stock?.find(s => String(s.size_id) === String(sizeDoc._id));
                                if (sizeStock) {
                                    sizeStock.count = Math.max(0, (sizeStock.count || 0) - deltaQty);
                                }
                            }
                            mainStoreItem.stock = Math.max(0, (mainStoreItem.stock || 0) - deltaQty);
                        } else {
                            mainStoreItem.stock = Math.max(0, (mainStoreItem.stock || 0) - deltaQty);
                        }
                        await mainStoreItem.save();
                    }

                    // 4. Inward to Shop Floor Inventory
                    const shopfloorName = requisition.department || "Laser";
                    let queryObj = { shopfloor_name: shopfloorName };
                    if (mainStoreItem) {
                        queryObj.$or = [
                            { name: mainStoreItem.name },
                            { item_code: mainStoreItem.item_code }
                        ];
                    } else {
                        queryObj.name = requisition.item_description;
                    }

                    let shopFloorItem = await shopFloorInventoryModel.findOne(queryObj);

                    if (!shopFloorItem) {
                        const countSF = await shopFloorInventoryModel.countDocuments();
                        const codeSF = `SF-${String(countSF + 1).padStart(4, '0')}`;

                        shopFloorItem = new shopFloorInventoryModel({
                            shopfloor_name: shopfloorName,
                            id: mainStoreItem ? (mainStoreItem.id || mainStoreItem._id.toString()) : codeSF,
                            item_code: mainStoreItem ? mainStoreItem.item_code : codeSF,
                            name: mainStoreItem ? mainStoreItem.name : requisition.item_description,
                            type_id: mainStoreItem ? mainStoreItem.type_id : new mongoose.Types.ObjectId(),
                            category_id: mainStoreItem ? mainStoreItem.category_id : undefined,
                            item_type: mainStoreItem ? mainStoreItem.item_type : 'direct',
                            unit: mainStoreItem ? mainStoreItem.unit : new mongoose.Types.ObjectId(),
                            price: mainStoreItem ? mainStoreItem.price : "0",
                            cost: mainStoreItem ? mainStoreItem.cost : "0",
                            stock_sizes: mainStoreItem ? mainStoreItem.stock_sizes : [],
                            size_wise_stock: [],
                            stock: 0,
                            created_by: requisition.requested_by_id || new mongoose.Types.ObjectId(),
                            created_at: getCurrentDate()
                        });
                    }

                    let sizeId = null;
                    let sizeString = requisition.size_name || "";

                    if (shopFloorItem.item_type === 'sheet') {
                        let sizeDoc = null;
                        if (requisition.size_id) {
                            sizeDoc = await stockSizeModel.findById(requisition.size_id).lean();
                        }
                        if (!sizeDoc && requisition.size_name) {
                            const norm = s => (s || '').toLowerCase().replace(/\s+/g, '');
                            const targetSize = norm(requisition.size_name);
                            let populatedItem = null;
                            if (mongoose.Types.ObjectId.isValid(shopFloorItem.id)) {
                                populatedItem = await itemModel.findById(shopFloorItem.id).populate('stock_sizes').lean();
                            }
                            if (!populatedItem) {
                                populatedItem = await itemModel.findOne({ id: shopFloorItem.id }).populate('stock_sizes').lean();
                            }
                            if (!populatedItem && requisition.item_id) {
                                populatedItem = await itemModel.findById(requisition.item_id).populate('stock_sizes').lean();
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
                                    sizeDoc = matchedSz;
                                }
                            }
                        }

                        if (sizeDoc) {
                            sizeId = sizeDoc._id || (mongoose.Types.ObjectId.isValid(sizeDoc) ? sizeDoc : null);
                            if (sizeDoc.size) {
                                sizeString = sizeDoc.size;
                            } else if (sizeDoc.width !== undefined && sizeDoc.height !== undefined) {
                                sizeString = `${sizeDoc.width}x${sizeDoc.height}`;
                            } else {
                                sizeString = requisition.size_name || "";
                            }

                            let sizeStock = shopFloorItem.size_wise_stock?.find(s => String(s.size_id) === String(sizeId));
                            if (sizeStock) {
                                sizeStock.count = (sizeStock.count || 0) + deltaQty;
                            } else {
                                shopFloorItem.size_wise_stock.push({
                                    size_id: sizeId,
                                    count: deltaQty,
                                    sqinch: 0
                                });
                            }
                        }
                        shopFloorItem.stock = (shopFloorItem.stock || 0) + deltaQty;
                    } else {
                        shopFloorItem.stock = (shopFloorItem.stock || 0) + deltaQty;
                    }

                    // Push into inward history
                    shopFloorItem.inward_history.push({
                        requisition_id: requisition._id,
                        requisition_no: requisition.requisition_no,
                        requested_by: requisition.requested_by,
                        requested_by_id: requisition.requested_by_id,
                        requested_at: requisition.created_at,
                        issued_by: userName,
                        issued_at: getCurrentDate(),
                        qty: deltaQty,
                        size: sizeString || undefined,
                        size_id: sizeId || undefined,
                        shopfloor_name: shopfloorName
                    });

                    await shopFloorItem.save();
                } catch (stockErr) {
                    console.error("Error updating stock during requisition fulfillment:", stockErr);
                }
            }
        } else if (status === "RECEIVED" || (status === "PENDING" && requisition.issued_qty > 0)) {
            requisition.received_by = userName;
            requisition.received_at = getCurrentDate();
        }

        await requisition.save();

        return res.status(200).json({
            success: true,
            message: `Requisition marked as ${status.toLowerCase()}`,
            data: requisition
        });
    } catch (error) {
        console.error("updateRequisitionStatus error:", error);
        return res.status(500).json({ success: false, message: "Server error updating requisition status", error: error.message });
    }
};

// Helper to determine the list of processes to rerun from start to target process
function getReprocessSequence(bom, targetProcessName, materialGroupId) {
    if (!bom || !bom.materialprocess) return [];

    const group = bom.materialprocess.find(g => String(g.material_group_id) === String(materialGroupId));
    if (!group || !group.processes) return [];

    // Sort processes by index (fallback to index of array if missing)
    const sorted = [...group.processes].sort((a, b) => {
        const idxA = a.process_index ? Number(a.process_index) : 0;
        const idxB = b.process_index ? Number(b.process_index) : 0;
        return idxA - idxB;
    });

    const targetIdx = sorted.findIndex(p => p.process_name?.toLowerCase().trim() === targetProcessName?.toLowerCase().trim());
    return targetIdx !== -1 ? sorted.slice(0, targetIdx + 1) : sorted;
}

// Helper to clone and trigger reprocess sequence jobs in shop floor
async function triggerJobReprocessSequence(requisition) {
    try {
        if (!requisition.shopfloor_job_id) return;
        const parentJob = await shopFloorJobModel.findById(requisition.shopfloor_job_id).populate("bom_id");
        if (!parentJob || !parentJob.bom_id) {
            console.log("Parent job or BOM not found for requisition:", requisition._id);
            return;
        }

        const bom = parentJob.bom_id;
        const targetGroupId = requisition.group_id || (parentJob.material_groups?.[0]?.group_id);
        const targetProcessName = parentJob.process_name;

        // Resolve processes to rerun
        const rerunProcesses = getReprocessSequence(bom, targetProcessName, targetGroupId);
        if (rerunProcesses.length === 0) {
            console.log("No rerun processes resolved for job", parentJob._id);
            return;
        }

        const nextReprocessCount = (parentJob.reprocess_count || 0) + 1;
        const reprocessSuffix = `-R${nextReprocessCount}`;
        const targetProcessNames = rerunProcesses.map(p => p.process_name.toLowerCase().trim());

        // Find all matching parent jobs for this sub_job_no that correspond to the resolved processes
        const parentJobs = await shopFloorJobModel.find({
            sub_job_no: parentJob.sub_job_no,
            process_name: { $in: targetProcessNames.map(name => new RegExp(`^${name}$`, "i")) }
        });

        // Determine job target qty:
        // Use reprocess_job_qty if specified (for sheets), otherwise use requisition qty (for direct)
        const jobTargetQty = requisition.reprocess_job_qty || requisition.qty;

        for (const pj of parentJobs) {
            const pjObj = pj.toObject();
            delete pjObj._id;
            delete pjObj.createdAt;
            delete pjObj.updatedAt;

            pjObj.sub_job_no = `${pj.sub_job_no}${reprocessSuffix}`;
            pjObj.status = 'Pending';
            pjObj.completed_qty = 0;
            pjObj.progress = 0;
            pjObj.assigned_shifts = [];
            pjObj.is_reprocess = true;
            pjObj.reprocess_count = nextReprocessCount;
            pjObj.parent_job_id = pj._id;
            pjObj.total_qty = jobTargetQty;
            pjObj.reprocess_created_from = requisition.department || parentJob.department || "Laser";

            // Reset and update material groups (keep only the reprocessed group)
            if (pjObj.material_groups) {
                pjObj.material_groups = pjObj.material_groups
                    .filter(mg => String(mg.group_id) === String(targetGroupId))
                    .map(mg => {
                        const updatedMg = { ...mg };
                        updatedMg.status = 'Pending';
                        updatedMg.progress = 0;
                        updatedMg.assigned_shifts = [];
                        updatedMg.outsource_assignments = [];
                        updatedMg.inward_history = [];
                        updatedMg.process_history = [];
                        updatedMg.process_qty = jobTargetQty;

                        if (updatedMg.is_outsource) {
                            updatedMg.outsource_qty = jobTargetQty;
                            updatedMg.inhouse_qty = 0;
                        } else {
                            updatedMg.inhouse_qty = jobTargetQty;
                            updatedMg.outsource_qty = 0;
                        }

                        // Update material quantities inside this group
                        if (updatedMg.materials) {
                            updatedMg.materials = updatedMg.materials.map(m => {
                                // Update quantity if it matches the material name, or the group name, or the description contains it
                                const descNormalized = (requisition.item_description || '').toLowerCase().trim();
                                const matNameNormalized = (m.material_name || '').toLowerCase().trim();
                                const grpNameNormalized = (updatedMg.group_name || '').toLowerCase().trim();

                                const isMatch = descNormalized && (
                                    matNameNormalized === descNormalized ||
                                    grpNameNormalized === descNormalized ||
                                    descNormalized.includes(matNameNormalized) ||
                                    matNameNormalized.includes(descNormalized) ||
                                    descNormalized.includes(grpNameNormalized) ||
                                    grpNameNormalized.includes(descNormalized)
                                );

                                if (isMatch) {
                                    return { ...m, quantity: requisition.qty };
                                }
                                return m;
                            });
                        }
                        return updatedMg;
                    });
            }

            const newJob = new shopFloorJobModel(pjObj);
            await newJob.save();
            console.log(`Successfully created reprocess job ${newJob.sub_job_no} for process ${newJob.process_name}`);
        }
    } catch (err) {
        console.error("Error inside triggerJobReprocessSequence:", err);
    }
};
