import CtQc from '../../models/controltower/ctQcModel.js';
import shopFloorJobModel from '../../models/shopfloor/shopFloorJobModel.js';
import CtPack from '../../models/controltower/ctPackModel.js';
import { generateSignedUrl } from '../../helpers/r2helper.js';

export const getCtQcJobs = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const skip = (page - 1) * limit;
        const statusFilter = req.query.status;
        const search = req.query.search;

        let query = {};
        if (statusFilter && statusFilter !== 'ALL') {
            query.status = statusFilter;
        }
        if (search && search.trim()) {
            const q = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            query.$or = [
                { job_no: { $regex: q, $options: 'i' } },
                { sub_job_no: { $regex: q, $options: 'i' } },
                { client_name: { $regex: q, $options: 'i' } },
                { product_name: { $regex: q, $options: 'i' } }
            ];
        }

        const total = await CtQc.countDocuments(query);
        const jobs = await CtQc.find(query).lean().sort({ createdAt: -1 }).skip(skip).limit(limit);

        // Compute Counts for tabs
        const aggCounts = await CtQc.aggregate([
            { $group: { _id: "$status", count: { $sum: 1 } } }
        ]);
        const counts = { 'Pending': 0, 'In QC': 0, 'QC Completed': 0, 'ALL': 0 };
        aggCounts.forEach(c => {
            if (counts[c._id] !== undefined) counts[c._id] = c.count;
            counts.ALL += c.count;
        });

        const mappedJobs = jobs.map(job => {
            if (job.product_image) {
                try {
                    job.product_image = generateSignedUrl(job.product_image);
                } catch (e) {
                    console.error("Failed to sign url for ct_qc:", e);
                }
            }
            return job;
        });

        res.status(200).json({
            data: mappedJobs,
            counts,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const updateJobStatus = (job) => {
    const isCompleted = job.total_qty > 0 &&
        job.received_from_inward >= job.total_qty &&
        job.arrived_qty >= job.received_from_inward &&
        (job.qc_good_qty + job.qc_bad_qty) >= job.arrived_qty &&
        job.released_to_packing_qty >= job.qc_good_qty &&
        job.rejected_handover_qty >= job.qc_bad_qty &&
        (job.qc_good_qty + job.qc_bad_qty) >= job.total_qty;

    if (isCompleted) {
        job.status = 'QC Completed';
    } else if (job.arrived_qty > 0 || job.received_from_inward > 0) {
        job.status = 'In QC';
    } else {
        job.status = 'Pending';
    }
};

export const arrivalQcJob = async (req, res) => {
    try {
        const { id } = req.params;
        const { qty, by, remarks } = req.body;

        const job = await CtQc.findById(id);
        if (!job) return res.status(404).json({ error: 'QC Job not found' });

        const arrived = Number(qty) || 0;

        if (job.arrived_qty + arrived > job.received_from_inward) {
            return res.status(400).json({ error: 'Cannot arrive more than what was handed over from FG Store.' });
        }

        job.arrived_qty += arrived;
        job.logs.push({
            type: 'ARRIVAL',
            qty: arrived,
            by: by,
            remarks: remarks,
            date: new Date()
        });

        updateJobStatus(job);
        await job.save();
        res.status(200).json(job);
    } catch (error) {
        if (error.name === 'VersionError') {
            return res.status(409).json({ error: 'Data was modified by another user simultaneously. Please refresh and try again.' });
        }
        res.status(500).json({ error: error.message });
    }
};

export const inwardQcJob = async (req, res) => {
    try {
        const { id } = req.params;
        const { good, bad, by, remarks } = req.body;

        const job = await CtQc.findById(id);
        if (!job) return res.status(404).json({ error: 'QC Job not found' });

        const goodQty = Number(good) || 0;
        const badQty = Number(bad) || 0;
        const total = goodQty + badQty;

        // Ensure they don't inward more than received
        // Ensure they don't inward more than arrived
        if (job.qc_good_qty + job.qc_bad_qty + total > job.arrived_qty) {
            return res.status(400).json({ error: 'Cannot QC more than what has arrived.' });
        }

        job.qc_good_qty += goodQty;
        job.qc_bad_qty += badQty;

        job.logs.push({
            type: 'QC_INWARD',
            qty: total,
            good: goodQty,
            bad: badQty,
            by: by,
            remarks: remarks,
            date: new Date()
        });

        updateJobStatus(job);
        await job.save();
        res.status(200).json(job);
    } catch (error) {
        if (error.name === 'VersionError') {
            return res.status(409).json({ error: 'Data was modified by another user simultaneously. Please refresh and try again.' });
        }
        res.status(500).json({ error: error.message });
    }
};

export const handoverToPacking = async (req, res) => {
    try {
        const { id } = req.params;
        const { total, by, remarks } = req.body;

        const job = await CtQc.findById(id);
        if (!job) return res.status(404).json({ error: 'QC Job not found' });

        const qty = Number(total) || 0;

        if (job.released_to_packing_qty + qty > job.qc_good_qty) {
            return res.status(400).json({ error: 'Cannot handover more than good QC quantity.' });
        }

        job.released_to_packing_qty += qty;

        job.logs.push({
            type: 'HANDOVER_PACKING',
            qty: qty,
            by: by,
            remarks: remarks,
            date: new Date()
        });

        updateJobStatus(job);
        await job.save();

        let packJob = await CtPack.findOne({ sub_job_no: job.sub_job_no });
        if (!packJob) {
            packJob = new CtPack({
                job_no: job.job_no,
                sub_job_no: job.sub_job_no,
                client_name: job.client_name,
                product_name: job.product_name,
                product_image: job.product_image,
                job_completion_date: job.job_completion_date,
                delivery_date: job.delivery_date,
                total_qty: job.total_qty,
                received_from_qc: 0,
                packed_qty: 0,
                status: 'Pending'
            });
        }
        
        packJob.received_from_qc += qty;
        

        
        packJob.logs.push({
            type: 'HANDOVER_RECEIVED',
            qty: qty,
            by: by,
            remarks: remarks,
            date: new Date()
        });
        
        await packJob.save();

        res.status(200).json(job);
    } catch (error) {
        if (error.name === 'VersionError') {
            return res.status(409).json({ error: 'Data was modified by another user simultaneously. Please refresh and try again.' });
        }
        res.status(500).json({ error: error.message });
    }
};

// Handover Rejects back to Department
export const handoverRejection = async (req, res) => {
    try {
        const { id } = req.params;
        const { qty, department, by, remarks } = req.body;

        const job = await CtQc.findById(id);
        if (!job) return res.status(404).json({ error: 'QC Job not found' });

        const rejectionQty = Number(qty) || 0;
        const availableRejects = job.qc_bad_qty - (job.rejected_handover_qty || 0);

        if (rejectionQty > availableRejects) {
            return res.status(400).json({ error: 'Cannot handover more than available rejected quantity.' });
        }

        job.rejected_handover_qty = (job.rejected_handover_qty || 0) + rejectionQty;

        job.logs.push({
            type: 'REJECTION_HANDOVER',
            qty: rejectionQty,
            department: department,
            by: by,
            remarks: remarks,
            date: new Date()
        });

        updateJobStatus(job);
        await job.save();

        // Auto-create reprocess shop floor jobs
        try {
            // Extract base sub_job_no (just in case the original QC job was already a reprocess)
            let baseSubJobNo = job.sub_job_no;
            if (baseSubJobNo.match(/-R\d+$/)) {
                baseSubJobNo = baseSubJobNo.replace(/-R\d+$/, '');
            }

            // Find all jobs that start with this base sub_job_no to get the highest reprocess count
            const allRelatedJobs = await shopFloorJobModel.find({ sub_job_no: new RegExp(`^${baseSubJobNo}`) });
            if (allRelatedJobs && allRelatedJobs.length > 0) {
                // Find highest reprocess count
                let maxReprocessCount = 0;
                for (const oj of allRelatedJobs) {
                    if (oj.reprocess_count > maxReprocessCount) maxReprocessCount = oj.reprocess_count;
                }
                const nextReprocessCount = maxReprocessCount + 1;
                const reprocessSuffix = `-R${nextReprocessCount}`;

                // Get all root jobs (original, without -R) to clone the entire process line
                const baseJobs = await shopFloorJobModel.find({ sub_job_no: baseSubJobNo });

                for (const bj of baseJobs) {
                    const pjObj = bj.toObject();
                    delete pjObj._id;
                    delete pjObj.createdAt;
                    delete pjObj.updatedAt;

                    pjObj.sub_job_no = `${baseSubJobNo}${reprocessSuffix}`;
                    pjObj.status = 'Pending';
                    pjObj.completed_qty = 0;
                    pjObj.progress = 0;
                    pjObj.assigned_shifts = [];
                    pjObj.is_reprocess = true;
                    pjObj.reprocess_count = nextReprocessCount;
                    pjObj.parent_job_id = bj._id;
                    pjObj.total_qty = rejectionQty;
                    pjObj.reprocess_created_from = department || "QC";

                    if (pjObj.material_groups) {
                        pjObj.material_groups = pjObj.material_groups.map(mg => {
                            const updatedMg = { ...mg };
                            updatedMg.status = 'Pending';
                            updatedMg.progress = 0;
                            updatedMg.assigned_shifts = [];
                            updatedMg.outsource_assignments = [];
                            updatedMg.inward_history = [];
                            updatedMg.process_history = [];
                            updatedMg.process_qty = rejectionQty;

                            if (updatedMg.is_outsource) {
                                updatedMg.outsource_qty = rejectionQty;
                                updatedMg.inhouse_qty = 0;
                            } else {
                                updatedMg.inhouse_qty = rejectionQty;
                                updatedMg.outsource_qty = 0;
                            }

                            if (updatedMg.materials) {
                                updatedMg.materials = updatedMg.materials.map(m => {
                                    return { ...m, quantity: rejectionQty };
                                });
                            }
                            return updatedMg;
                        });
                    }

                    const newJob = new shopFloorJobModel(pjObj);
                    await newJob.save();
                }
            }
        } catch (repErr) {
            console.error("Error auto-creating reprocess sequence for QC rejection:", repErr);
        }

        res.status(200).json(job);
    } catch (error) {
        if (error.name === 'VersionError') {
            return res.status(409).json({ error: 'Data was modified by another user simultaneously. Please refresh and try again.' });
        }
        res.status(500).json({ error: error.message });
    }
};
