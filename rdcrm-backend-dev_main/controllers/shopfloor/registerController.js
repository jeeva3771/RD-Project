import ShopFloorProcessFlow from "../../models/shopfloor/shopFloorProcessFlowModel.js";
import ScrapDisposal from "../../models/shopfloor/scrapDisposalModel.js";
import shopFloorJobModel from "../../models/shopfloor/shopFloorJobModel.js";

// Fetch excess stock and rejections logged at job completion
export const getInventoryLogs = async (req, res) => {
    try {
        const flows = await ShopFloorProcessFlow.find({
            $or: [
                { "excess_stock.0": { $exists: true } },
                { "rejection.0": { $exists: true } }
            ]
        }).sort({ updatedAt: -1 });

        // Extract and flatten logs
        const excessStockList = [];
        const rejectionsList = [];

        // Extract job IDs to avoid N+1 queries
        const jobIds = [...new Set(flows.map(flow => flow.shopfloor_job_id).filter(Boolean))];
        const jobs = await shopFloorJobModel.find({ _id: { $in: jobIds } }).populate('bom_id');
        const jobMap = new Map(jobs.map(job => [job._id.toString(), job]));

        // Helper: parse size string like "12x18" or "12X18" → sq inches
        const parseSqInch = (sizeStr = '') => {
            const s = String(sizeStr).replace(/in/gi, '').trim();
            const sep = s.includes('X') ? 'X' : 'x';
            const [w, h] = s.split(sep).map(parseFloat);
            return (!isNaN(w) && !isNaN(h)) ? w * h : 0;
        };

        // Helper: calculate estimated monetary loss from BOM rates
        // Formula: Σ ( rate × sq_inch_per_unit × rejected_qty ) per non-consumable/non-hardware material
        const calcEstLoss = (job, groupId, rejectedQty) => {
            const bom = job?.bom_id;  // populated
            if (!bom) return 0;

            const bomGroup = (bom.material_groups || []).find(
                bg => String(bg.group_id) === String(groupId)
            );
            if (!bomGroup) return 0;

            return (bomGroup.materials || []).reduce((total, bm) => {
                const cat = (bm.category_type || '').toLowerCase();
                if (cat.includes('consumable') || cat.includes('hardware')) return total;

                const rate = parseFloat(bm.rate) || 0;
                const sqIn = parseSqInch(bm.input?.size);
                return total + rate * sqIn * (rejectedQty || 0);
            }, 0);
        };

        flows.forEach((flow) => {
            const job = flow.shopfloor_job_id ? jobMap.get(flow.shopfloor_job_id.toString()) : null;

            if (flow.excess_stock && flow.excess_stock.length > 0) {
                flow.excess_stock.forEach((item) => {
                    excessStockList.push({
                        _id: item._id,
                        sub_job_no: item.sub_job_no || flow.sub_job_no,
                        shopfloor_job_id: job || null,
                        group_name: item.group_name,
                        process_name: item.process_name,
                        excess_qty: item.excess_qty,
                        excess_sqft: item.excess_sqft || 0,
                        timestamp: item.timestamp
                    });
                });
            }

            if (flow.rejection && flow.rejection.length > 0) {
                flow.rejection.forEach((item) => {
                    rejectionsList.push({
                        _id: item._id,
                        flow_id: flow._id,
                        job_no: flow.job_no,
                        shopfloor_job_id: job || null,
                        sub_job_no: flow.sub_job_no,
                        category: flow.category,
                        subcategory: flow.subcategory,
                        group_id: flow.group_id,
                        material_name: item.material_name,
                        size: item.size,
                        rejected_qty: item.rejected_qty,
                        recut_qty: item.recut_qty,
                        sqin_lost: item.sqin_lost,
                        sqft_lost: item.sqft_lost,
                        machine: item.machine,
                        est_loss: Math.round(calcEstLoss(job, flow.group_id, item.rejected_qty)),
                        recut_status: item.recut_status,
                        write_off_status: item.write_off_status,
                        timestamp: item.timestamp
                    });
                });
            }
        });

        res.status(200).json({ success: true, excess_stock: excessStockList, rejections: rejectionsList });
    } catch (error) {
        console.error("getInventoryLogs error:", error);
        res.status(500).json({ success: false, message: "Server error fetching inventory logs" });
    }
};

// Fetch all scrap disposal records
export const getScrapDisposalList = async (req, res) => {
    try {
        const scrapList = await ScrapDisposal.find({}).sort({ createdAt: -1 });
        res.status(200).json({ success: true, scrap: scrapList });
    } catch (error) {
        console.error("getScrapDisposalList error:", error);
        res.status(500).json({ success: false, message: "Server error fetching scrap list" });
    }
};

// Update scrap disposal status
export const updateScrapDisposal = async (req, res) => {
    const { id } = req.params;
    const { disposal_method, remarks, authorised_by, sale_amount } = req.body;
    try {
        const scrapItem = await ScrapDisposal.findById(id);
        if (!scrapItem) return res.status(404).json({ success: false, message: "Scrap item not found" });

        scrapItem.disposal_method = disposal_method;
        scrapItem.remarks = remarks || "";
        scrapItem.authorised_by = authorised_by || "";
        scrapItem.sale_amount = typeof sale_amount === 'number' ? sale_amount : (Number(sale_amount) || 0);
        scrapItem.disposed_at = new Date();

        await scrapItem.save();
        res.status(200).json({ success: true, message: "Scrap disposal recorded successfully", scrap: scrapItem });
    } catch (error) {
        console.error("updateScrapDisposal error:", error);
        res.status(500).json({ success: false, message: "Server error updating scrap disposal status" });
    }
};
