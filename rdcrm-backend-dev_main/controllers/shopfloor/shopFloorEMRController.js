import shopFloorJobModel from "../../models/shopfloor/shopFloorJobModel.js";
import shopFloorEMRModel from "../../models/shopfloor/shopFloorEMRModel.js";
import { getCurrentDate } from "../../helpers/dateTime.js";
import shopFloorProcessFlowModel from "../../models/shopfloor/shopFloorProcessFlowModel.js";
import itemModel from "../../models/inventory/item/itemModel.js";
import customItemModel from "../../models/inventory/customItem/customItemModel.js";
import mongoose from "mongoose";

export const submitExtraMaterialEMR = async (req, res) => {
    try {
        const {
            shopfloor_job_id,
            group_id,
            sheet_size,
            qty,
            unit,
            urgent,
            reason,
            materials,
            recut_qty
        } = req.body;

        const operator_id = req.user?._id || req.user?.id || null;
        const operator_name = req.user?.name || req.user?.username || "Operator";

        // Find the job to get basic info
        const job = await shopFloorJobModel.findById(shopfloor_job_id);
        if (!job) {
            return res.status(404).json({ success: false, message: "Job not found" });
        }

        const newEMR = new shopFloorEMRModel({
            job_no: job.job_no,
            sub_job_no: job.sub_job_no || "N/A",
            shopfloor_job_id,
            group_id,
            category: job.category || "",
            subcategory: job.subcategory || "",
            operator_id,
            operator_name,
            sheet_size,
            qty,
            unit: unit || "pcs",
            urgent: !!urgent,
            reason: reason || "",
            materials: Array.isArray(materials) ? materials : [],
            recut_qty: recut_qty ? Number(recut_qty) : undefined,
            department: job.department || "Laser",
            status: "PENDING",
            created_at: getCurrentDate()
        });

        await newEMR.save();

        // Also add an activity log to the job's process history if a group is defined
        const group = job.material_groups?.find(mg => String(mg._id) === String(group_id) || String(mg.group_id) === String(group_id));
        if (group) {
            if (!group.process_history) group.process_history = [];
            group.process_history.push({
                activity_type: "production",
                action: `🚨 EXTRA MATERIAL REQUEST SUBMITTED: ${qty} ${unit.toUpperCase()} (${sheet_size})`,
                operator_name,
                operator_id,
                timestamp: getCurrentDate(),
                affected_groups: [group_id],
                details: { emr_id: newEMR._id, qty, sheet_size }
            });
            await job.save();
        }

        return res.status(201).json({ success: true, message: "Extra material EMR raised successfully", data: newEMR });
    } catch (error) {
        console.error("submitExtraMaterialEMR error:", error);
        return res.status(500).json({ success: false, message: "Server error raising EMR", error: error.message });
    }
};

export const getExtraMaterialEMRList = async (req, res) => {
    try {
        const { department, shopfloor_job_id, group_id } = req.query;
        const query = {};

        if (shopfloor_job_id) {
            query.shopfloor_job_id = shopfloor_job_id;
        }
        if (group_id) {
            query.group_id = group_id;
        }

        if (department && !shopfloor_job_id) {
            const jobsInDept = await shopFloorJobModel.find({ department }).select('_id').lean();
            const jobIds = jobsInDept.map(j => j._id);
            query.$or = [
                { department: department },
                { shopfloor_job_id: { $in: jobIds } }
            ];
        }

        const list = await shopFloorEMRModel.find(query).sort({ createdAt: -1 }).lean();

        // 1. Gather all actual item IDs
        let allItemIds = [];
        let allCustomItemIds = [];
        list.forEach(emr => {
            (emr.materials || []).forEach(mat => {
                if (mat.actual_item_id && mat.type === "standard") {
                    allItemIds.push(mat.actual_item_id);
                } else {
                    allCustomItemIds.push(mat.actual_item_id);
                }
            });
        });

        // 2. Fetch all matching standard and custom items from database
        const validObjectIds = allItemIds.filter(id => mongoose.Types.ObjectId.isValid(id));
        const customNanoids = allCustomItemIds.filter(id => !mongoose.Types.ObjectId.isValid(id));

        const items = await itemModel.find({
            _id: { $in: validObjectIds }
        }).populate("stock_sizes").populate("type_id").lean();

        const customItems = await customItemModel.find({
            id: { $in: customNanoids }
        }).populate("type_id").lean();

        // 3. Map stock value to each material inside each EMR
        const updatedList = list.map(emr => {
            const materialsWithStock = (emr.materials || []).map(mat => {
                let item;
                if (mat.type === "standard") {
                    item = items.find(i => String(i._id) === String(mat.actual_item_id))
                } else {
                    item = customItems.find(i => String(i.id) === String(mat.actual_item_id));
                }

                let stockVal = 0;
                if (item) {
                    if (item.item_type === 'sheet') {
                        const matSize = emr.sheet_size;
                        if (matSize && item.stock_sizes) {
                            const normalize = s => (s || '').toLowerCase().replace(/\s+/g, '');
                            const inputSize = normalize(matSize);

                            const foundSizeDoc = item.stock_sizes.find(sz => {
                                const nameSize = normalize(sz.size);
                                const dimSize = normalize(`${sz.width}x${sz.height}`);
                                return nameSize === inputSize || dimSize === inputSize;
                            });

                            if (foundSizeDoc) {
                                const sizeStock = item.size_wise_stock?.find(s =>
                                    String(s.size_id) === String(foundSizeDoc._id) ||
                                    String(s.size_id?._id) === String(foundSizeDoc._id)
                                );
                                stockVal = sizeStock ? (sizeStock.count || 0) : 0;
                            }
                        }
                    } else {
                        stockVal = item.stock || 0;
                    }
                }

                let typeName = "";
                if (item && item.type_id) {
                    typeName = typeof item.type_id === 'object' ? (item.type_id.name || "") : String(item.type_id);
                } else if (mat && mat.type) {
                    typeName = mat.type;
                }

                return {
                    ...mat,
                    stock: stockVal,
                    type: typeName
                };
            });

            return {
                ...emr,
                materials: materialsWithStock
            };
        });

        return res.status(200).json({ success: true, data: updatedList });
    } catch (error) {
        console.error("getExtraMaterialEMRList error:", error);
        return res.status(500).json({ success: false, message: "Server error fetching EMR list", error: error.message });
    }
};

export const confirmEMRReceipt = async (req, res) => {
    try {
        const { id } = req.params;
        const emr = await shopFloorEMRModel.findById(id);
        if (!emr) {
            return res.status(404).json({ success: false, message: "EMR request not found" });
        }

        if (emr.status === "RECEIVED") {
            return res.status(200).json({ success: true, message: "Material receipt already confirmed", data: emr });
        }

        emr.status = "RECEIVED";
        emr.updated_at = getCurrentDate();
        await emr.save();

        // Also update the job's process history
        const job = await shopFloorJobModel.findById(emr.shopfloor_job_id);
        if (job) {
            const group = job.material_groups?.find(mg => String(mg._id) === String(emr.group_id) || String(mg.group_id) === String(emr.group_id));
            if (group) {
                if (!group.process_history) group.process_history = [];
                group.process_history.push({
                    activity_type: "production",
                    action: `✓ EXTRA MATERIAL RECEIVED BY OPERATOR: ${emr.qty} ${emr.unit.toUpperCase()}`,
                    operator_name: req.user?.name || "Operator",
                    operator_id: req.user?._id || null,
                    timestamp: getCurrentDate(),
                    affected_groups: [emr.group_id],
                    details: { emr_id: emr._id }
                });
                await job.save();
            }
        }

        // Sync with shopfloor process flow session state
        const flow = await shopFloorProcessFlowModel.findOne({
            shopfloor_job_id: emr.shopfloor_job_id,
            group_id: emr.group_id
        });
        if (flow && flow.session_state) {
            if (!flow.session_state.quantities) {
                flow.session_state.quantities = {};
            }
            const q = flow.session_state.quantities;

            // 1. Mark material as issued
            q.material_issued = true;

            // 2. Update ready for recut qty
            const emrRecutQty = Number(emr.recut_qty || 0);
            q.recut_received = (q.recut_received || 0) + emrRecutQty;

            // 3. Clear/reduce EMR not inwarded sheet qty
            q.recut_not_inwarded = Math.max(0, (q.recut_not_inwarded || 0) - (emr.qty || 0));

            // 4. Update is_inwarded inside the selected_recut_option array for New Sheet options
            if (Array.isArray(q.selected_recut_option)) {
                let updated = false;
                q.selected_recut_option = q.selected_recut_option.map(opt => {
                    if ((opt.type === "New Sheet" || opt.type === "new sheet") && opt.is_inwarded === false && updated === false) {
                        updated = true;
                        return { ...opt, is_inwarded: true };
                    }
                    return opt;
                });
            }

            // 5. Stamp quantities_updated_at timestamp
            q.quantities_updated_at = new Date().toISOString();

            flow.markModified('session_state');
            await flow.save();
        }

        return res.status(200).json({ success: true, message: "Material receipt confirmed", data: emr });
    } catch (error) {
        console.error("confirmEMRReceipt error:", error);
        return res.status(500).json({ success: false, message: "Server error confirming EMR receipt", error: error.message });
    }
};

export const approveExtraMaterialEMR = async (req, res) => {
    try {
        const { id } = req.params;
        const emr = await shopFloorEMRModel.findById(id);
        if (!emr) {
            return res.status(404).json({ success: false, message: "EMR request not found" });
        }

        emr.status = "APPROVED";
        emr.updated_at = getCurrentDate();
        await emr.save();

        // Update Inventory Stock Sync for EMR Materials
        try {
            for (const mat of (emr.materials || [])) {
                const actualItemId = mat.material_id;
                if (actualItemId) {
                    let item = null;
                    if (mongoose.Types.ObjectId.isValid(actualItemId)) {
                        item = await itemModel.findById(actualItemId).populate('stock_sizes');
                    } else {
                        item = await itemModel.findOne({ id: actualItemId }).populate('stock_sizes');
                    }

                    if (item) {
                        const qtyChange = -parseFloat(emr.qty);

                        if (item.item_type === 'sheet') {
                            const matSize = emr.sheet_size;

                            if (matSize && item.stock_sizes) {
                                const normalize = s => (s || '').toLowerCase().replace(/\s+/g, '');
                                const inputSize = normalize(matSize);

                                const foundSizeDoc = item.stock_sizes.find(sz => {
                                    const nameSize = normalize(sz.size);
                                    const dimSize = normalize(`${sz.width}x${sz.height}`);
                                    return nameSize === inputSize || dimSize === inputSize;
                                });

                                if (foundSizeDoc) {
                                    let sizeStock = item.size_wise_stock.find(s =>
                                        String(s.size_id) === String(foundSizeDoc._id) ||
                                        String(s.size_id?._id) === String(foundSizeDoc._id)
                                    );

                                    if (sizeStock) {
                                        sizeStock.count = (sizeStock.count || 0) + qtyChange;
                                    } else {
                                        item.size_wise_stock.push({
                                            size_id: foundSizeDoc._id,
                                            count: qtyChange,
                                            sqinch: 0
                                        });
                                    }
                                    item.stock = (item.stock || 0) + qtyChange;
                                }
                            }
                        } else {
                            item.stock = (item.stock || 0) + qtyChange;
                        }
                        await item.save();
                    } else {
                        let customItem = null;
                        if (mongoose.Types.ObjectId.isValid(actualItemId)) {
                            customItem = await customItemModel.findById(actualItemId);
                        } else {
                            customItem = await customItemModel.findOne({ id: actualItemId });
                        }

                        if (customItem) {
                            const qtyChange = -parseFloat(emr.qty);
                            customItem.stock = (customItem.stock || 0) + qtyChange;
                            await customItem.save();
                        }
                    }
                }
            }
        } catch (stockError) {
            console.error("Failed to sync EMR inventory stock:", stockError);
        }

        // Also update the job's process history
        const job = await shopFloorJobModel.findById(emr.shopfloor_job_id);
        if (job) {
            const group = job.material_groups?.find(mg => String(mg._id) === String(emr.group_id) || String(mg.group_id) === String(emr.group_id));
            if (group) {
                if (!group.process_history) group.process_history = [];
                group.process_history.push({
                    activity_type: "production",
                    action: `✓ EXTRA MATERIAL APPROVED BY ADMIN: ${emr.qty} ${emr.unit.toUpperCase()}`,
                    operator_name: req.user?.name || "Admin",
                    operator_id: req.user?._id || null,
                    timestamp: getCurrentDate(),
                    affected_groups: [emr.group_id],
                    details: { emr_id: emr._id }
                });
                await job.save();
            }
        }

        return res.status(200).json({ success: true, message: "EMR approved successfully", data: emr });
    } catch (error) {
        console.error("approveExtraMaterialEMR error:", error);
        return res.status(500).json({ success: false, message: "Server error approving EMR", error: error.message });
    }
};

export const rejectExtraMaterialEMR = async (req, res) => {
    try {
        const { id } = req.params;
        const emr = await shopFloorEMRModel.findById(id);
        if (!emr) {
            return res.status(404).json({ success: false, message: "EMR request not found" });
        }

        emr.status = "REJECTED";
        emr.updated_at = getCurrentDate();
        await emr.save();

        // Also update the job's process history
        const job = await shopFloorJobModel.findById(emr.shopfloor_job_id);
        if (job) {
            const group = job.material_groups?.find(mg => String(mg._id) === String(emr.group_id) || String(mg.group_id) === String(emr.group_id));
            if (group) {
                if (!group.process_history) group.process_history = [];
                group.process_history.push({
                    activity_type: "production",
                    action: `X EXTRA MATERIAL REJECTED BY ADMIN: ${emr.qty} ${emr.unit.toUpperCase()}`,
                    operator_name: req.user?.name || "Admin",
                    operator_id: req.user?._id || null,
                    timestamp: getCurrentDate(),
                    affected_groups: [emr.group_id],
                    details: { emr_id: emr._id }
                });
                await job.save();
            }
        }

        return res.status(200).json({ success: true, message: "EMR rejected successfully", data: emr });
    } catch (error) {
        console.error("rejectExtraMaterialEMR error:", error);
        return res.status(500).json({ success: false, message: "Server error rejecting EMR", error: error.message });
    }
};
