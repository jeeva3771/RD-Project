import StoreMaterialIssue from "../../models/store/materialIssueModel.js";
import dtpStudioModel from "../../models/dtp_studio/dtpStudioModel.js";
import salesorder from "../../models/sales_orders/sales_order_list_Model.js";
import bomModel from "../../models/bom/bomModel.js";
import departmentModel from "../../models/masters/departmentModel.js";
import processModel from "../../models/masters/processModel.js";
import { getCurrentDate } from "../../helpers/dateTime.js";
import { generateSignedUrl } from "../../helpers/r2helper.js";
import itemModel from "../../models/inventory/item/itemModel.js";
import customItemModel from "../../models/inventory/customItem/customItemModel.js";
import enquiryModel from "../../models/enquiry/enquiryModel.js";
import mongoose from "mongoose";
import { recordStockMovement } from "../inventory/stockLedgerController.js";

const formatStoreIssue = (job) => {
    if (!job) return null;
    const obj = job.toObject ? job.toObject() : job;
    if (obj.product_image) {
        obj.product_image = generateSignedUrl(obj.product_image);
    }
    // Fallback for reference_no from populated enquiry
    if (!obj.reference_no && obj.sample_order_id?.enquiry_id?.reference_no) {
        obj.reference_no = obj.sample_order_id.enquiry_id.reference_no;
    }
    return obj;
};

// Helper/Helper to Create a Store Record from a DTP Job
export const createStoreIssueFromDTPJob = async (job) => {
    try {
        // Sample orders do not require Store Material Issue
        if (job.sample_order_id) {
            const soDoc = await salesorder.findById(job.sample_order_id).select("type category").lean();
            if (soDoc && (soDoc.type === "sample" || soDoc.category === "Sample" || String(soDoc.type || "").toLowerCase() === "sample")) {
                console.log(`[StoreMaterialIssue] Skipping store issue creation for sample job: ${job.sub_job_no}`);
                return null;
            }
        }
        if (job.job_type === "sample" || job.category === "Sample") {
            console.log(`[StoreMaterialIssue] Skipping store issue creation for sample job: ${job.sub_job_no}`);
            return null;
        }

        // Find if already exists
        const existing = await StoreMaterialIssue.findOne({ dtp_id: job._id });
        if (existing) return existing;

        let bomData = null;
        if (job.bom_id) {
            bomData = await bomModel.findById(job.bom_id).lean();
        }

        const departments = await departmentModel.find({ is_active: true }).lean();
        const processes = await processModel.find({ is_active: true }).lean();

        const getDepartmentForMaterial = (mat) => {
            if (!bomData || !bomData.material_groups || !bomData.materialprocess) return '';

            // Find group holding this material
            const group = bomData.material_groups.find(g =>
                g.materials && g.materials.some(m =>
                    (m.material_id && m.material_id.toString() === mat.material_id?.toString()) ||
                    (mat.item_id && m.item_id === mat.item_id) ||
                    (m.material_name === mat.material_name)
                )
            );
            if (!group) return '';

            // Find material process for this group
            const processGroup = bomData.materialprocess.find(p => p.material_group_name === group.group_name);
            if (!processGroup || !processGroup.processes || processGroup.processes.length === 0) return '';

            const processId = processGroup.processes[0].process_id;
            const deptName = processGroup.processes[0].department;

            // Try to find the process in our pre-fetched list to get linked_department ID
            const procObj = processes.find(p => p._id.toString() === processId?.toString() || p.id === processId);

            if (procObj && procObj.linked_department) {
                return procObj.linked_department.toString();
            }

            // Fallback: Find department ID by name if linked_department isn't available
            if (deptName) {
                const deptObj = departments.find(d => d.name.toLowerCase() === deptName.toLowerCase());
                return deptObj ? deptObj._id.toString() : '';
            }

            return '';
        };

        console.log("bomData?.materialSpecification", bomData.material_specification)

        // Extract materials from job sheet material specification
        const materials = (bomData?.material_specification || []).map(mat => ({
            ...mat,
            type: "Material",
            department: getDepartmentForMaterial(mat),
            specs: `Type: ${mat.material_type || ''} ${mat.color ? 'Color: ' + mat.color : ''} ${mat.input?.size ? 'Size: ' + mat.input?.size : ''} ${mat.input?.thickness ? 'Thickness: ' + mat.input?.thickness : ''}`.trim(),
            required_qty: mat.final_total || 0,
            unit: mat.input?.unit || '',
            logs: []
        }));

        // Add packing materials
        if (bomData?.packingdatas) {
            const packingDept = departments.find(d => d.name.toLowerCase() === 'packing' || d.name.toLowerCase() === 'dispatch');
            const packingId = packingDept ? packingDept._id.toString() : '';

            bomData.packingdatas.forEach(pack => {
                if (pack.name && pack.name.toUpperCase() !== 'PACKING LABOUR') {
                    materials.push({
                        material_id: pack.itemId,
                        material_name: pack.name,
                        material_type: pack.itemType,
                        type: "Packing",
                        department: packingId,
                        specs: `Type: ${pack.itemType || ''} ${pack.logic1 ? 'Size: ' + pack.logic1 : ''}${pack.logic2 ? ' x ' + pack.logic2 : ''}${pack.logic3 ? ' x ' + pack.logic3 : ''}`.trim(),
                        required_qty: pack.total_qty || 0,
                        unit: '',
                        logs: []
                    });
                }
            });
        }

        let reference_no = '';
        if (job.enquiry_id) {
            const enq = await enquiryModel.findById(job.enquiry_id).select('reference_no').lean();
            if (enq) reference_no = enq.reference_no;
        }

        const storeRecord = new StoreMaterialIssue({
            dtp_id: job._id,
            sample_order_id: job.sample_order_id?._id || job.sample_order_id,
            enquiry_id: job.enquiry_id,
            job_no: job.job_no,
            sub_job_no: job.sub_job_no,
            reference_no: reference_no,
            client_name: job.client_name,
            product_name: job.product_name,
            product_image: job.image, // Map from DTP job image
            delivery_date: job.delivery_date,
            job_completion_date: job.job_completion_date,
            job_quantity: job.job_quantity,
            is_on_hold: job.is_on_hold || false,
            status: 'NEW',
            materials: materials,
            items: bomData?.items || [],
            material_groups: bomData?.material_groups || [],
            materialprocess: bomData?.materialprocess || [],
            created_at: getCurrentDate(),
            updated_at: getCurrentDate()
        });

        return await storeRecord.save();
    } catch (error) {
        console.error("Error creating store issue record:", error);
        throw error;
    }
};

// MIGRATE: Create Store Records for all existing Pushed Jobs
export const migratePushedJobsToStore = async (req, res) => {
    try {
        const userId = req.user?._id;

        // 1. Find all Sales Orders already marked as pushed
        const pushedSalesOrders = await salesorder.find({ is_pushed_shop_floor: true });
        const sampleOrderIds = pushedSalesOrders.map(so => so._id);

        // 2. Find corresponding DTP Studio jobs
        const dtpJobs = await dtpStudioModel.find({
            sample_order_id: { $in: sampleOrderIds },
            is_active: true
        });

        const results = {
            found: dtpJobs.length,
            created: 0,
            alreadyExists: 0,
            updated: 0,
            errors: 0
        };

        for (const job of dtpJobs) {
            try {
                const existing = await StoreMaterialIssue.findOne({ dtp_id: job._id });
                if (existing) {
                    // Update image or completion date if missing
                    let needsUpdate = false;
                    if (!existing.product_image && job.image) {
                        existing.product_image = job.image;
                        needsUpdate = true;
                    }
                    if (!existing.job_completion_date && job.job_completion_date) {
                        existing.job_completion_date = job.job_completion_date;
                        needsUpdate = true;
                    }

                    // Sync reference_no and enquiry_id if missing
                    if (!existing.reference_no || !existing.enquiry_id) {
                        const enq = await enquiryModel.findOne({ job_no: existing.job_no }).select('reference_no _id').lean();
                        if (enq) {
                            existing.reference_no = enq.reference_no;
                            existing.enquiry_id = enq._id;
                            needsUpdate = true;
                        }
                    }

                    if (needsUpdate) {
                        await existing.save();
                        results.updated++;
                    }
                    results.alreadyExists++;
                    continue;
                }

                await createStoreIssueFromDTPJob(job, userId);
                results.created++;
            } catch (err) {
                results.errors++;
                console.error(`Migration error for job ${job.job_no}:`, err);
            }
        }

        return res.status(200).json({
            success: true,
            message: "Migration completed",
            results: {
                ...results,
                updated: results.updated
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Get all Store Material Issues (for the Kanban Feed)
export const getAllStoreIssues = async (req, res) => {
    try {
        const { status, search } = req.query;
        let query = { is_active: true };

        if (status && status !== 'All') query.status = status;

        // Fetch data with status/is_active filters first
        const data = await StoreMaterialIssue.find(query)
            .sort({ created_at: -1 })
            .populate({
                path: 'sample_order_id',
                populate: {
                    path: 'enquiry_id',
                    select: 'reference_no'
                }
            });

        // Format and then filter if search is provided
        let formattedData = data.map(job => formatStoreIssue(job));

        if (search) {
            const searchRegex = new RegExp(search, 'i');
            formattedData = formattedData.filter(item =>
                searchRegex.test(item.job_no) ||
                searchRegex.test(item.sub_job_no) ||
                searchRegex.test(item.reference_no) ||
                searchRegex.test(item.client_name) ||
                searchRegex.test(item.product_name)
            );
        }

        // Fetch matching shop floor jobs to calculate and inject inward good quantities
        try {
            const shopFloorJobs = await mongoose.model("shop_floor_job").find({
                store_material_issue_id: { $in: formattedData.map(d => d._id) }
            }).lean();

            formattedData.forEach(job => {
                const matchingSFJobs = shopFloorJobs.filter(sf => sf.store_material_issue_id?.toString() === job._id?.toString());

                if (matchingSFJobs.length > 0 && job.materials) {
                    job.materials.forEach(mat => {
                        let totalGoodInward = 0;
                        let foundMatch = false;
                        let hasPendingReturn = false;

                        matchingSFJobs.forEach(sfJob => {
                            const matchingGroups = sfJob.material_groups?.filter(group =>
                                group.materials && group.materials.some(m => {
                                    if (m.material_name?.toLowerCase().trim() === mat.material_name?.toLowerCase().trim() || m.item_id === mat.item_id) {
                                        const s = m.material_input?.size || m.size;
                                        if (s && mat.specs) {
                                            const normSpecs = mat.specs.toUpperCase().replace(/\s/g, '');
                                            const normSize = s.toUpperCase().replace(/\s/g, '');
                                            return normSpecs.includes(normSize);
                                        }
                                        return true;
                                    }
                                    return false;
                                })
                            ) || [];

                            matchingGroups.forEach(mg => {
                                foundMatch = true;
                                const groupGoodInward = (mg.inward_history || []).reduce(
                                    (acc, log) => acc + (Number(log.good_qty) || 0),
                                    0
                                );
                                totalGoodInward += groupGoodInward;

                                // Check for pending laser return for this material group
                                const hasPending = (mg.inward_history || []).some(log => log.laser_return === true);
                                if (hasPending) {
                                    hasPendingReturn = true;
                                }
                            });
                        });

                        if (foundMatch) {
                            mat.inward_good_qty = totalGoodInward;
                            mat.has_pending_laser_return = hasPendingReturn;
                        } else {
                            mat.inward_good_qty = 0;
                            mat.has_pending_laser_return = false;
                        }
                    });
                } else if (job.materials) {
                    job.materials.forEach(mat => {
                        mat.inward_good_qty = 0;
                    });
                }
            });
        } catch (sfError) {
            console.error("Failed to inject shop floor inward good qty to store records:", sfError);
        }

        return res.status(200).json({ success: true, data: formattedData });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Update Material Log (Issue/Return)
export const updateMaterialLog = async (req, res) => {
    try {
        const { id, material_id } = req.params;
        const { qty, type, dept, recipient, isLaserReturn } = req.body;
        const userId = req.user?._id;

        const storeJob = await StoreMaterialIssue.findById(id);
        if (!storeJob) return res.status(404).json({ success: false, message: "Store record not found" });

        const matIndex = storeJob.materials.findIndex(m => m._id.toString() === material_id);
        if (matIndex === -1) return res.status(404).json({ success: false, message: "Material not found" });

        const material = storeJob.materials[matIndex];

        if (type === 'RETURN' && !isLaserReturn && String(isLaserReturn) !== 'true') {
            // Check if this material has already been consumed (inwarded as GOOD) on the shop floor
            try {
                const shopFloorJobs = await mongoose.model("shop_floor_job").find({ store_material_issue_id: storeJob._id }).lean();

                let totalGoodInward = 0;
                let foundMatch = false;

                shopFloorJobs.forEach(sfJob => {
                    const matchingGroups = sfJob.material_groups?.filter(group =>
                        group.materials && group.materials.some(m => {
                            if (m.material_name?.toLowerCase().trim() === material.material_name?.toLowerCase().trim() || m.item_id === material.item_id) {
                                const s = m.material_input?.size || m.size;
                                if (s && material.specs) {
                                    const normSpecs = material.specs.toUpperCase().replace(/\s/g, '');
                                    const normSize = s.toUpperCase().replace(/\s/g, '');
                                    return normSpecs.includes(normSize);
                                }
                                return true;
                            }
                            return false;
                        })
                    ) || [];

                    matchingGroups.forEach(mg => {
                        foundMatch = true;
                        const groupGoodInward = (mg.inward_history || []).reduce(
                            (acc, log) => acc + (Number(log.good_qty) || 0),
                            0
                        );
                        totalGoodInward += groupGoodInward;
                    });
                });

                if (foundMatch) {
                    const currentIssued = (material.logs || []).reduce((acc, log) => {
                        return log.type === 'ISSUE' ? acc + parseFloat(log.qty || 0) : acc - parseFloat(log.qty || 0);
                    }, 0);

                    const allowedReturnQty = Math.max(0, currentIssued - totalGoodInward);

                    if (parseFloat(qty) > allowedReturnQty) {
                        return res.status(400).json({
                            success: false,
                            message: `Cannot return ${qty} sheets. ${totalGoodInward} sheets of this material have already been recorded as GOOD (processed/handed over) on the shop floor. Maximum allowed manual return is ${allowedReturnQty} sheets.`
                        });
                    }
                }
            } catch (sfErr) {
                console.error("Failed to perform shop floor return validation check:", sfErr);
            }
        }

        // Log entries
        material.logs.push({
            qty: parseFloat(qty),
            type,
            dept,
            recipient,
            recorded_by: userId,
            recorded_at: getCurrentDate()
        });

        // Update totals
        if (type === 'ISSUE') {
            material.issued_qty += parseFloat(qty);
        } else if (type === 'RETURN') {
            material.returned_qty += parseFloat(qty);
            if (isLaserReturn || String(isLaserReturn) === 'true' || (dept === 'Laser' && recipient === 'Shop Floor')) {
                material.laserreturn_qty = 0;
            }
        }

        // Determine Job Status - Do not automatically move to ISSUED
        const anyIssued = storeJob.materials.some(m => m.issued_qty > 0);

        if (anyIssued && storeJob.status !== 'ALERT') {
            storeJob.status = 'PARTIAL';
        }

        storeJob.markModified('materials');
        storeJob.updated_at = getCurrentDate();
        await storeJob.save();

        // Update Inventory Stock Sync
        try {
            const jobItem = material.item_id ? storeJob.items?.find(i => i.item_id === material.item_id) : null;
            const actualItemId = material.material_id || jobItem?.subCategoryId || jobItem?.item_id || material.item_id;

            if (actualItemId) {
                let item = null;
                if (mongoose.Types.ObjectId.isValid(actualItemId)) {
                    item = await itemModel.findById(actualItemId).populate('stock_sizes');
                } else {
                    item = await itemModel.findOne({ id: actualItemId }).populate('stock_sizes');
                }

                if (item) {
                    const qtyChange = type === 'ISSUE' ? -parseFloat(qty) : parseFloat(qty);

                    if (item.item_type === 'sheet') {
                        const matSizeMatch = material.specs?.match(/Size:\s*([^\s]+)/);
                        const matSize = matSizeMatch ? matSizeMatch[1] : null;

                        if (matSize && item.stock_sizes) {
                            const normalize = s => (s || '').toLowerCase().replace(/\s+/g, '');
                            const inputSize = normalize(matSize);

                            const foundSizeDoc = item.stock_sizes.find(sz => {
                                const nameSize = normalize(sz.size);
                                const dimSize = normalize(`${sz.width}x${sz.height}`);
                                return nameSize === inputSize || dimSize === inputSize;
                            });

                            if (foundSizeDoc) {
                                // Find size stock entry
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
                                        sqinch: 0 // Could potentially calculate this but usually added via GRN
                                    });
                                }
                                // Overall stock also updated
                                item.stock = (item.stock || 0) + qtyChange;
                            }
                        }
                    } else {
                        // Non-sheet items
                        item.stock = (item.stock || 0) + qtyChange;
                    }
                    await item.save();

                    // Record movement in StockLedger
                    try {
                        await recordStockMovement({
                            item_id: item._id,
                            item_code: item.item_code,
                            item_name: item.name,
                            unit: item.unit?.name || 'pcs',
                            type: type === 'ISSUE' ? 'ISSUE' : 'RETURN',
                            ref_type: 'STORE_ISSUE',
                            ref_id: storeJob._id,
                            job_no: storeJob.job_no,
                            sub_job_no: storeJob.sub_job_no,
                            qty_in: type === 'RETURN' ? parseFloat(qty) : 0,
                            qty_out: type === 'ISSUE' ? parseFloat(qty) : 0,
                            cost_per_unit: Number(item.cost) || 0,
                            location: item.location || 'G-1',
                            remarks: `${type === 'ISSUE' ? 'Issued to' : 'Returned from'} ${dept || 'shopfloor'} for job ${storeJob.sub_job_no || storeJob.job_no}`,
                            created_by: userId
                        });
                    } catch (ledgerErr) {
                        console.error("[Store Issue] Failed to log to StockLedger:", ledgerErr);
                    }
                } else {
                    // Try custom item lookup!
                    let customItem = null;
                    if (mongoose.Types.ObjectId.isValid(actualItemId)) {
                        customItem = await customItemModel.findById(actualItemId);
                    } else {
                        customItem = await customItemModel.findOne({ id: actualItemId });
                    }

                    if (customItem) {
                        const qtyChange = type === 'ISSUE' ? -parseFloat(qty) : parseFloat(qty);
                        customItem.stock = (customItem.stock || 0) + qtyChange;
                        await customItem.save();
                        console.log(`Successfully synced custom item ${customItem.item_code} stock: new stock = ${customItem.stock}`);

                        // Record movement in StockLedger
                        try {
                            await recordStockMovement({
                                item_id: customItem._id,
                                item_code: customItem.item_code,
                                item_name: customItem.name,
                                unit: customItem.unit?.name || 'pcs',
                                type: type === 'ISSUE' ? 'ISSUE' : 'RETURN',
                                ref_type: 'STORE_ISSUE',
                                ref_id: storeJob._id,
                                job_no: storeJob.job_no,
                                sub_job_no: storeJob.sub_job_no,
                                qty_in: type === 'RETURN' ? parseFloat(qty) : 0,
                                qty_out: type === 'ISSUE' ? parseFloat(qty) : 0,
                                cost_per_unit: Number(customItem.cost) || 0,
                                location: customItem.location || 'G-1',
                                remarks: `${type === 'ISSUE' ? 'Issued to' : 'Returned from'} ${dept || 'shopfloor'} for job ${storeJob.sub_job_no || storeJob.job_no}`,
                                created_by: userId
                            });
                        } catch (ledgerErr) {
                            console.error("[Store Issue] Failed to log custom item to StockLedger:", ledgerErr);
                        }
                    }
                }
            }
        } catch (stockError) {
            console.error("Failed to sync inventory stock:", stockError);
        }

        return res.status(200).json({ success: true, data: formatStoreIssue(storeJob) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Mark Alert Escalation
export const markStoreEscalation = async (req, res) => {
    try {
        const { id } = req.params;
        const { remark } = req.body;
        const userId = req.user?._id;

        const storeJob = await StoreMaterialIssue.findById(id);
        if (!storeJob) return res.status(404).json({ success: false, message: "Store record not found" });

        storeJob.status = 'ALERT';
        storeJob.esc_alert = {
            is_active: true,
            remark,
            marked_at: getCurrentDate(),
            marked_by: userId
        };

        storeJob.updated_at = getCurrentDate();
        await storeJob.save();

        return res.status(200).json({ success: true, data: formatStoreIssue(storeJob) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Authorize Completion
export const authorizeStoreIssue = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?._id;

        const storeJob = await StoreMaterialIssue.findById(id);
        if (!storeJob) return res.status(404).json({ success: false, message: "Store record not found" });

        // Validate all materials are issued
        const allCompleted = storeJob.materials.every(m => (m.issued_qty - m.returned_qty) >= m.required_qty);
        if (!allCompleted) {
            return res.status(400).json({
                success: false,
                message: "Cannot authorize completion: Some materials are not fully issued."
            });
        }

        storeJob.status = 'ISSUED';
        storeJob.authorized_at = getCurrentDate();
        storeJob.authorized_by = userId;
        storeJob.updated_at = getCurrentDate();

        await storeJob.save();

        return res.status(200).json({ success: true, data: formatStoreIssue(storeJob) });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Clear Change Flags (Acknowledge Action)
export const clearStoreFlags = async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.body; // 'qty', 'date', or 'both'

        const storeJob = await StoreMaterialIssue.findById(id);
        if (!storeJob) return res.status(404).json({ success: false, message: "Store record not found" });

        const isQtyChangedCleared = type === 'qty' || type === 'both';

        if (isQtyChangedCleared) {
            console.log(`[StoreAcknowledge] Acknowledged quantity change for sub_job_no: ${storeJob.sub_job_no}. Updating required quantities...`);

            // Fetch the committed BOM
            const bomObj = await bomModel.findOne({ sub_job_no: storeJob.sub_job_no });
            if (bomObj) {
                const departments = await departmentModel.find({ is_active: true }).lean();
                const processes = await processModel.find({ is_active: true }).lean();

                const getDepartmentForMaterial = (mat) => {
                    if (!bomObj.material_groups || !bomObj.materialprocess) return '';

                    const group = bomObj.material_groups.find(g =>
                        g.materials && g.materials.some(m =>
                            (m.material_id && m.material_id.toString() === mat.material_id?.toString()) ||
                            (mat.item_id && m.item_id === mat.item_id) ||
                            (m.material_name === mat.material_name)
                        )
                    );
                    if (!group) return '';

                    const processGroup = bomObj.materialprocess.find(p => p.material_group_name === group.group_name);
                    if (!processGroup || !processGroup.processes || processGroup.processes.length === 0) return '';

                    const processId = processGroup.processes[0].process_id;
                    const deptName = processGroup.processes[0].department;

                    const procObj = processes.find(p => p._id.toString() === processId?.toString() || p.id === processId);

                    if (procObj && procObj.linked_department) {
                        return procObj.linked_department.toString();
                    }

                    if (deptName) {
                        const deptObj = departments.find(d => d.name.toLowerCase() === deptName.toLowerCase());
                        return deptObj ? deptObj._id.toString() : '';
                    }

                    return '';
                };

                const newMaterials = [];

                // 1. Process standard raw materials
                (bomObj.material_specification || []).forEach(mat => {
                    const existingMat = storeJob.materials?.find(m =>
                        (m.material_id && m.material_id.toString() === mat.material_id?.toString()) ||
                        (m.item_id && m.item_id === mat.item_id) ||
                        (m.material_name === mat.material_name)
                    );

                    newMaterials.push({
                        material_id: mat.material_id,
                        item_id: mat.item_id,
                        material_name: mat.material_name,
                        material_type: mat.material_type,
                        type: "Material",
                        department: getDepartmentForMaterial(mat),
                        specs: `Type: ${mat.material_type || ''} ${mat.color ? 'Color: ' + mat.color : ''} ${mat.input?.size ? 'Size: ' + mat.input?.size : ''} ${mat.input?.thickness ? 'Thickness: ' + mat.input?.thickness : ''}`.trim(),
                        required_qty: mat.final_total || 0,
                        issued_qty: existingMat ? existingMat.issued_qty : 0,
                        returned_qty: existingMat ? existingMat.returned_qty : 0,
                        laserreturn_qty: existingMat ? existingMat.laserreturn_qty : 0,
                        unit: mat.input?.unit || '',
                        logs: existingMat ? existingMat.logs : [],
                        _id: existingMat ? existingMat._id : new mongoose.Types.ObjectId()
                    });
                });

                // 2. Process packing materials
                if (bomObj.packingdatas) {
                    const packingDept = departments.find(d => d.name.toLowerCase() === 'packing' || d.name.toLowerCase() === 'dispatch');
                    const packingId = packingDept ? packingDept._id.toString() : '';

                    bomObj.packingdatas.forEach(pack => {
                        if (pack.name && pack.name.toUpperCase() !== 'PACKING LABOUR') {
                            const existingPack = storeJob.materials?.find(m =>
                                m.type === "Packing" &&
                                ((m.material_id && m.material_id.toString() === pack.itemId?.toString()) ||
                                 (m.material_name === pack.name))
                            );

                            newMaterials.push({
                                material_id: pack.itemId,
                                material_name: pack.name,
                                material_type: pack.itemType,
                                type: "Packing",
                                department: packingId,
                                specs: `Type: ${pack.itemType || ''} ${pack.logic1 ? 'Size: ' + pack.logic1 : ''}${pack.logic2 ? ' x ' + pack.logic2 : ''}${pack.logic3 ? ' x ' + pack.logic3 : ''}`.trim(),
                                required_qty: pack.total_qty || 0,
                                issued_qty: existingPack ? existingPack.issued_qty : 0,
                                returned_qty: existingPack ? existingPack.returned_qty : 0,
                                laserreturn_qty: existingPack ? existingPack.laserreturn_qty : 0,
                                unit: '',
                                logs: existingPack ? existingPack.logs : [],
                                _id: existingPack ? existingPack._id : new mongoose.Types.ObjectId()
                            });
                        }
                    });
                }

                storeJob.materials = newMaterials;
                storeJob.material_groups = bomObj.material_groups || [];
                storeJob.materialprocess = bomObj.materialprocess || [];
                storeJob.items = bomObj.items || [];
                storeJob.markModified("materials");
                console.log(`[StoreAcknowledge] Successfully synced required quantities from BOM for sub_job_no: ${storeJob.sub_job_no}`);
            }
        }

        if (type === 'qty') {
            storeJob.is_qty_changed = false;
        } else if (type === 'date') {
            storeJob.is_date_changed = false;
        } else {
            storeJob.is_qty_changed = false;
            storeJob.is_date_changed = false;
        }

        storeJob.updated_at = getCurrentDate();
        await storeJob.save();

        return res.status(200).json({ success: true, message: "Flags cleared successfully", data: formatStoreIssue(storeJob) });
    } catch (error) {
        console.error("[clearStoreFlags] Error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

