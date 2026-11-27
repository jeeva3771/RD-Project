import ShopFloorJob from '../../models/shopfloor/shopFloorJobModel.js';
import FgStore from '../../models/controltower/fgStoreModel.js';
import CtQc from '../../models/controltower/ctQcModel.js';
import CtInvoice from '../../models/controltower/ctInvoiceModel.js';
import ReadyJob from '../../models/shopfloor/shopFloorReadyJobModel.js';
import { generateSignedUrl, uploadToR2 } from '../../helpers/r2helper.js';
import { generateInvoicePDFBuffer } from './generateInvoicePDFBuffer.js';
import SalesOrderForm from '../../models/sales_orders/sales_order_form_Model.js';
import Bom from '../../models/bom/bomModel.js';
import CtPack from '../../models/controltower/ctPackModel.js';
import customerModel from '../../models/masters/customerModel.js';
import mongoose from 'mongoose';

export const syncFgStore = async (req, res) => {
    try {
        const jobs = await ShopFloorJob.find({}).lean();
        const subJobMap = {};

        // Group and find highest process index job for each sub_job_no
        for (const job of jobs) {
            const subJobNo = job.sub_job_no;
            if (!subJobNo) continue;

            let maxIndex = 0;
            if (job.material_groups && job.material_groups.length > 0) {
                for (const mg of job.material_groups) {
                    if (mg.process_index) {
                        const val = parseFloat(mg.process_index);
                        if (!isNaN(val) && val > maxIndex) {
                            maxIndex = val;
                        }
                    }
                }
            }

            if (!subJobMap[subJobNo] || subJobMap[subJobNo].maxIndex < maxIndex) {
                subJobMap[subJobNo] = {
                    job: job,
                    maxIndex: maxIndex
                };
            }
        }

        let debugLogs = [];
        let createdCount = 0;

        for (const [subJobNo, data] of Object.entries(subJobMap)) {
            const highestJob = data.job;
            const shopfloor_job_id = highestJob._id;
            const department = highestJob.department;

            const readyJobs = await ReadyJob.find({ sub_job_no: subJobNo });

            let logMsg = `subJobNo: ${subJobNo} | highest: (dept: ${department}, id: ${shopfloor_job_id}, maxIdx: ${data.maxIndex}, totalQty: ${highestJob.total_qty}) | readyJobs found: ${readyJobs.length}`;

            let sumGoodQty = 0;
            const highestJobIdStr = String(shopfloor_job_id);
            for (const rj of readyJobs) {
                const isHighest = rj.shopfloor_job_id && String(rj.shopfloor_job_id) === highestJobIdStr;
                if (rj.line_items) {
                    for (const line of rj.line_items) {
                        if (line.cycles) {
                            for (const cycle of line.cycles) {
                                const toDept = (cycle.handover_to_department || '').toLowerCase();
                                const isFgHandover = cycle.handed_over && (toDept.includes('fg') || toDept.includes('store') || toDept.includes('warehouse') || toDept.includes('dispatch'));
                                if (isHighest || isFgHandover) {
                                    sumGoodQty += (Number(cycle.good_qty) || 0);
                                }
                            }
                        }
                    }
                }
            }

            let historySum = 0;
            if (highestJob.material_groups && highestJob.material_groups.length > 0) {
                for (const mg of highestJob.material_groups) {
                    if (mg.process_history) {
                        for (const ph of mg.process_history) {
                            const action = (ph.action || '').toUpperCase();
                            if (action.includes("HANDED OVER") && (action.includes("STORES") || action.includes("FG"))) {
                                historySum += (Number(ph.details?.good_qty) || 0);
                            }
                        }
                    }
                }
            }

            logMsg += ` | sumGoodQty (ReadyJob): ${sumGoodQty} | historySum: ${historySum} | status: ${highestJob.status}`;

            const isCompleted = highestJob.status === 'Completed';

            // Check if ANY good qty is handed over OR if job is explicitly marked Completed
            if (sumGoodQty > 0 || historySum > 0 || isCompleted) {
                const exists = await FgStore.findOne({ sub_job_no: subJobNo });
                const handedOverQty = Math.max(sumGoodQty, historySum);

                if (!exists) {
                    let unitPrice = 0;
                    let bom = await Bom.findOne({ sub_job_no: subJobNo });

                    if (bom && bom.quotation && bom.quotation.finalUnitPrice) {
                        unitPrice = Number((Number(bom.quotation.finalUnitPrice) || 0).toFixed(2));
                    }

                    let paymentTerms = "";
                    let salesOrder = await SalesOrderForm.findOne({ sub_job_no: subJobNo });
                    if (salesOrder && salesOrder.payment) {
                        paymentTerms = salesOrder.payment;
                    }

                    await FgStore.create({
                        job_no: highestJob.job_no,
                        sub_job_no: subJobNo,
                        client_name: highestJob.client_name,
                        product_name: highestJob.product_name,
                        category: highestJob.category,
                        subcategory: highestJob.subcategory,
                        product_image: highestJob.product_image,
                        delivery_date: highestJob.delivery_date,
                        job_completion_date: highestJob.job_completion_date,
                        total_qty: highestJob.total_qty,
                        unit_price: unitPrice,
                        payment_terms: paymentTerms,
                        shopfloor_handed_over_qty: handedOverQty,
                        inward_qty: 0,
                        balance_qty: highestJob.total_qty,
                        stage: 'INWARD',
                        status: 'Pending'
                    });
                    logMsg += ` -> CREATED`;
                    createdCount++;
                } else {
                    exists.shopfloor_handed_over_qty = handedOverQty;
                    await exists.save();
                    logMsg += ` -> ALREADY EXISTS, UPDATED QTY: ${handedOverQty}`;
                }
            } else {
                logMsg += ` -> NOT ENOUGH QTY`;
            }

            debugLogs.push(logMsg);
        }

        res.status(200).json({ message: `Successfully synced ${createdCount} records to FG Store.`, debugLogs });
    } catch (error) {
        console.error("Error syncing FG Store:", error);
        res.status(500).json({ error: error.message });
    }
};

export const getFgStoreJobs = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const skip = (page - 1) * limit;
        const stageFilter = req.query.stage;
        const search = req.query.search;

        // Build base aggregation pipeline to resolve join fields for filtering
        let pipeline = [
            {
                $lookup: {
                    from: 'ct_qcs',
                    localField: 'sub_job_no',
                    foreignField: 'sub_job_no',
                    as: 'qc_info'
                }
            },
            {
                $lookup: {
                    from: 'ct_packs',
                    localField: 'sub_job_no',
                    foreignField: 'sub_job_no',
                    as: 'pack_info'
                }
            },
            {
                $project: {
                    _id: 1,
                    job_no: 1,
                    sub_job_no: 1,
                    client_name: 1,
                    product_name: 1,
                    category: 1,
                    subcategory: 1,
                    product_image: 1,
                    delivery_date: 1,
                    job_completion_date: 1,
                    total_qty: 1,
                    unit_price: 1,
                    payment_terms: 1,
                    shopfloor_handed_over_qty: 1,
                    inward_qty: 1,
                    invoiced_qty: 1,
                    balance_qty: 1,
                    stage: 1,
                    status: 1,
                    logs: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    qc_received: { $ifNull: [{ $arrayElemAt: ["$qc_info.received_from_inward", 0] }, 0] },
                    qc_released: { $ifNull: [{ $arrayElemAt: ["$qc_info.released_to_packing_qty", 0] }, 0] },
                    qc_rejected: { $ifNull: [{ $arrayElemAt: ["$qc_info.rejected_handover_qty", 0] }, 0] },
                    pack_received: { $ifNull: [{ $arrayElemAt: ["$pack_info.received_from_qc", 0] }, 0] },
                    pack_packed: { $ifNull: [{ $arrayElemAt: ["$pack_info.packed_qty", 0] }, 0] },
                    pack_stage: { $ifNull: [{ $arrayElemAt: ["$pack_info.stage", 0] }, ""] },
                    pack_status: { $ifNull: [{ $arrayElemAt: ["$pack_info.status", 0] }, ""] }
                }
            }
        ];

        if (search && search.trim()) {
            const q = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            pipeline.push({
                $match: {
                    $or: [
                        { job_no: { $regex: q, $options: 'i' } },
                        { sub_job_no: { $regex: q, $options: 'i' } },
                        { client_name: { $regex: q, $options: 'i' } },
                        { product_name: { $regex: q, $options: 'i' } }
                    ]
                }
            });
        }

        if (stageFilter && stageFilter !== 'ALL') {
            if (stageFilter === 'INWARD') {
                pipeline.push({ $match: { $expr: { $lt: ["$qc_received", "$total_qty"] } } });
            } else if (stageFilter === 'QC') {
                pipeline.push({
                    $match: {
                        qc_received: { $gt: 0 },
                        $expr: { $lt: [{ $add: ["$qc_released", "$qc_rejected"] }, "$qc_received"] }
                    }
                });
            } else if (stageFilter === 'PACKING') {
                pipeline.push({
                    $match: {
                        pack_received: { $gt: 0 },
                        pack_stage: { $ne: 'complete' },
                        pack_status: { $nin: ['Packed', 'Complete'] },
                        $expr: {
                            $and: [
                                {
                                    $or: [
                                        { $eq: ["$qc_released", 0] },
                                        { $lt: ["$pack_packed", "$qc_released"] }
                                    ]
                                },
                                {
                                    $or: [
                                        { $eq: ["$total_qty", 0] },
                                        { $lt: ["$pack_packed", "$total_qty"] }
                                    ]
                                }
                            ]
                        }
                    }
                });
            } else if (stageFilter === 'INVOICE') {
                pipeline.push({
                    $match: {
                        $or: [
                            { $expr: { $gt: ["$inward_qty", "$invoiced_qty"] } },
                            {
                                $and: [
                                    {
                                        $or: [
                                            { pack_stage: 'complete' },
                                            { pack_status: { $in: ['Packed', 'Complete'] } },
                                            {
                                                $expr: {
                                                    $and: [
                                                        { $gt: ["$qc_released", 0] },
                                                        { $gte: ["$pack_packed", "$qc_released"] }
                                                    ]
                                                }
                                            },
                                            {
                                                $expr: {
                                                    $and: [
                                                        { $gt: ["$total_qty", 0] },
                                                        { $gte: ["$pack_packed", "$total_qty"] }
                                                    ]
                                                }
                                            }
                                        ]
                                    },
                                    { $expr: { $lt: ["$invoiced_qty", "$total_qty"] } }
                                ]
                            }
                        ]
                    }
                });
            } else if (stageFilter === 'DISPATCHED') {
                pipeline.push({
                    $match: {
                        $or: [
                            { pack_stage: 'complete' },
                            { pack_status: { $in: ['Packed', 'Complete'] } },
                            {
                                $expr: {
                                    $and: [
                                        { $gt: ["$qc_released", 0] },
                                        { $gte: ["$pack_packed", "$qc_released"] }
                                    ]
                                }
                            },
                            {
                                $expr: {
                                    $and: [
                                        { $gt: ["$total_qty", 0] },
                                        { $gte: ["$pack_packed", "$total_qty"] }
                                    ]
                                }
                            }
                        ]
                    }
                });
            }
        }

        // Count total matching items
        const countPipeline = [...pipeline, { $count: "total" }];
        const countResult = await FgStore.aggregate(countPipeline);
        const total = countResult[0]?.total || 0;

        // Apply pagination and sorting
        pipeline.push({ $sort: { createdAt: -1 } });
        pipeline.push({ $skip: skip });
        pipeline.push({ $limit: limit });

        const storeJobs = await FgStore.aggregate(pipeline);

        // Fetch related info for mapping
        const subJobNos = storeJobs.map(j => j.sub_job_no).filter(Boolean);
        const jobNos = storeJobs.map(j => j.job_no).filter(Boolean);

        const qcJobs = await CtQc.find({
            $or: [
                { sub_job_no: { $in: subJobNos } },
                { job_no: { $in: jobNos } },
                { sub_job_no: { $in: jobNos } }
            ]
        }).lean();
        const invoiceJobs = await CtInvoice.find({ sub_job_no: { $in: subJobNos } }).lean().sort({ createdAt: 1 });
        const salesOrderForms = await SalesOrderForm.find({ sub_job_no: { $in: subJobNos } }).lean();
        const packJobs = await CtPack.find({
            $or: [
                { sub_job_no: { $in: subJobNos } },
                { job_no: { $in: jobNos } },
                { sub_job_no: { $in: jobNos } }
            ]
        }).lean();

        // Fetch Customer Master to attach configured GST info
        const clientNames = Array.from(new Set([
            ...storeJobs.map(j => j.client_name).filter(Boolean),
            ...salesOrderForms.map(s => s.client_name).filter(Boolean)
        ]));
        const customerRegexes = clientNames.map(cn => new RegExp(`^${cn.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'));
        const customers = customerRegexes.length > 0 
            ? await customerModel.find({ name: { $in: customerRegexes } }).populate('gst_tax').lean()
            : [];

        // Calculate counts for all tabs dynamically using $facet
        const countsPipeline = [
            {
                $lookup: {
                    from: 'ct_qcs',
                    localField: 'sub_job_no',
                    foreignField: 'sub_job_no',
                    as: 'qc_info'
                }
            },
            {
                $lookup: {
                    from: 'ct_packs',
                    localField: 'sub_job_no',
                    foreignField: 'sub_job_no',
                    as: 'pack_info'
                }
            },
            {
                $project: {
                    total_qty: 1,
                    inward_qty: 1,
                    invoiced_qty: 1,
                    qc_received: { $ifNull: [{ $arrayElemAt: ["$qc_info.received_from_inward", 0] }, 0] },
                    qc_released: { $ifNull: [{ $arrayElemAt: ["$qc_info.released_to_packing_qty", 0] }, 0] },
                    qc_rejected: { $ifNull: [{ $arrayElemAt: ["$qc_info.rejected_handover_qty", 0] }, 0] },
                    pack_received: { $ifNull: [{ $arrayElemAt: ["$pack_info.received_from_qc", 0] }, 0] },
                    pack_packed: { $ifNull: [{ $arrayElemAt: ["$pack_info.packed_qty", 0] }, 0] },
                    pack_stage: { $ifNull: [{ $arrayElemAt: ["$pack_info.stage", 0] }, ""] },
                    pack_status: { $ifNull: [{ $arrayElemAt: ["$pack_info.status", 0] }, ""] }
                }
            },
            {
                $facet: {
                    INWARD: [
                        { $match: { $expr: { $lt: ["$qc_received", "$total_qty"] } } },
                        { $count: "count" }
                    ],
                    QC: [
                        {
                            $match: {
                                qc_received: { $gt: 0 },
                                $expr: { $lt: [{ $add: ["$qc_released", "$qc_rejected"] }, "$qc_received"] }
                            }
                        },
                        { $count: "count" }
                    ],
                    PACKING: [
                        {
                            $match: {
                                pack_received: { $gt: 0 },
                                pack_stage: { $ne: 'complete' },
                                pack_status: { $nin: ['Packed', 'Complete'] },
                                $expr: {
                                    $and: [
                                        {
                                            $or: [
                                                { $eq: ["$qc_released", 0] },
                                                { $lt: ["$pack_packed", "$qc_released"] }
                                            ]
                                        },
                                        {
                                            $or: [
                                                { $eq: ["$total_qty", 0] },
                                                { $lt: ["$pack_packed", "$total_qty"] }
                                            ]
                                        }
                                    ]
                                }
                            }
                        },
                        { $count: "count" }
                    ],
                    INVOICE: [
                        {
                            $match: {
                                $or: [
                                    { $expr: { $gt: ["$inward_qty", "$invoiced_qty"] } },
                                    {
                                        $and: [
                                            {
                                                $or: [
                                                    { pack_stage: 'complete' },
                                                    { pack_status: { $in: ['Packed', 'Complete'] } },
                                                    {
                                                        $expr: {
                                                            $and: [
                                                                { $gt: ["$qc_released", 0] },
                                                                { $gte: ["$pack_packed", "$qc_released"] }
                                                            ]
                                                        }
                                                    },
                                                    {
                                                        $expr: {
                                                            $and: [
                                                                { $gt: ["$total_qty", 0] },
                                                                { $gte: ["$pack_packed", "$total_qty"] }
                                                            ]
                                                        }
                                                    }
                                                ]
                                            },
                                            { $expr: { $lt: ["$invoiced_qty", "$total_qty"] } }
                                        ]
                                    }
                                ]
                            }
                        },
                        { $count: "count" }
                    ],
                    DISPATCHED: [
                        {
                            $match: {
                                $or: [
                                    { pack_stage: 'complete' },
                                    { pack_status: { $in: ['Packed', 'Complete'] } },
                                    {
                                        $expr: {
                                            $and: [
                                                { $gt: ["$qc_released", 0] },
                                                { $gte: ["$pack_packed", "$qc_released"] }
                                            ]
                                        }
                                    },
                                    {
                                        $expr: {
                                            $and: [
                                                { $gt: ["$total_qty", 0] },
                                                { $gte: ["$pack_packed", "$total_qty"] }
                                            ]
                                        }
                                    }
                                ]
                            }
                        },
                        { $count: "count" }
                    ],
                    ALL: [
                        { $count: "count" }
                    ]
                }
            }
        ];

        const countsResult = await FgStore.aggregate(countsPipeline);
        const counts = { INWARD: 0, QC: 0, PACKING: 0, INVOICE: 0, DISPATCHED: 0, ALL: 0 };
        if (countsResult && countsResult.length > 0) {
            const resObj = countsResult[0];
            counts.INWARD = resObj.INWARD[0]?.count || 0;
            counts.QC = resObj.QC[0]?.count || 0;
            counts.PACKING = resObj.PACKING[0]?.count || 0;
            counts.INVOICE = resObj.INVOICE[0]?.count || 0;
            counts.DISPATCHED = resObj.DISPATCHED[0]?.count || 0;
            counts.ALL = resObj.ALL[0]?.count || 0;
        }

        const normSubJob = (sj) => (sj || '').replace(/[/\-_]/g, '').toLowerCase();

        const mappedJobs = storeJobs.map(job => {
            if (job.product_image) {
                try {
                    job.product_image = generateSignedUrl(job.product_image);
                } catch (e) {
                    console.error("Failed to sign url for ct_store:", e);
                }
            }

            // Attach Sales Order Client Info
            const soForm = salesOrderForms.find(so => normSubJob(so.sub_job_no) === normSubJob(job.sub_job_no));
            if (soForm) {
                job.client_phone = soForm.mobile_no || (soForm.wp_number && soForm.wp_number[0]) || '';
                job.client_email = (soForm.email && soForm.email[0]) || '';

                let addr = [];
                if (soForm.billing_address_1) addr.push(soForm.billing_address_1);
                let cityState = [];
                if (soForm.billing_city) cityState.push(soForm.billing_city);
                if (soForm.billing_state) cityState.push(soForm.billing_state);
                if (soForm.billing_postal_code) cityState.push(soForm.billing_postal_code);
                if (cityState.length > 0) addr.push(cityState.join(', '));

                job.client_address = addr.join(', ');
            }

            // Attach Customer Master GST Tax Info
            const matchedCustomer = customers.find(c => 
                (c.name && job.client_name && c.name.trim().toLowerCase() === job.client_name.trim().toLowerCase())
            );
            if (matchedCustomer) {
                job.customer_id = matchedCustomer._id;
                job.customer_gst_tax = matchedCustomer.gst_tax?._id || matchedCustomer.gst_tax || null;
                job.customer_gst_name = matchedCustomer.gst_tax?.tax_name || null;
                job.customer_gst_rate = matchedCustomer.gst_tax?.tax_rate !== undefined 
                    ? matchedCustomer.gst_tax.tax_rate 
                    : (matchedCustomer.gst_rate !== undefined ? matchedCustomer.gst_rate : null);
            } else {
                job.customer_id = null;
                job.customer_gst_tax = null;
                job.customer_gst_name = null;
                job.customer_gst_rate = null;
            }

            const currentSubJobNorm = normSubJob(job.sub_job_no);

            // Attach QC data strictly by normalized sub_job_no
            const qcRecord = qcJobs.find(q => normSubJob(q.sub_job_no) === currentSubJobNorm);
            if (qcRecord) {
                job.qc = {
                    pending: qcRecord.received_from_inward - qcRecord.qc_good_qty - qcRecord.qc_bad_qty,
                    good: qcRecord.qc_good_qty,
                    bad: qcRecord.qc_bad_qty,
                    received: qcRecord.received_from_inward,
                    arrived: qcRecord.arrived_qty || 0,
                    released_to_packing: qcRecord.released_to_packing_qty || 0,
                    rejected_handover: qcRecord.rejected_handover_qty || 0
                };
            } else {
                job.qc = { pending: 0, good: 0, bad: 0, received: 0, arrived: 0, released_to_packing: 0, rejected_handover: 0 };
            }

            // Attach CTPack data strictly by normalized sub_job_no
            const packRecord = packJobs.find(p => normSubJob(p.sub_job_no) === currentSubJobNorm);
            if (packRecord) {
                job.pack = {
                    received_from_qc: packRecord.received_from_qc || 0,
                    qc_accepted_qty: packRecord.qcAcceptedQty || 0,
                    packed_qty: packRecord.packed_qty || 0,
                    delivered_qty: packRecord.deliveredQty || 0,
                    box_count: packRecord.boxCount || 0,
                    stage: packRecord.stage || 'qc_pending',
                    status: packRecord.status || 'Pending',
                    packedBy: packRecord.packedBy || '',
                    packingDt: packRecord.packingDt || '',
                    dispatchType: packRecord.dispatchType || '',
                    expectedDelivery: packRecord.expectedDelivery || ''
                };
            } else {
                job.pack = null;
            }

            // Attach Invoices
            const jobInvoices = invoiceJobs.filter(inv => inv.sub_job_no === job.sub_job_no).map(inv => {
                if (inv.pdf_url) {
                    try {
                        inv.pdf_url = generateSignedUrl(inv.pdf_url);
                    } catch (e) {
                        console.error("Failed to sign url for invoice:", e);
                    }
                }
                return inv;
            });
            job.invoices = jobInvoices;

            // Dynamically override job.stage for frontend representation
            const totalQty = job.total_qty || 0;
            const qcReceived = job.qc?.received || 0;
            const packReceived = job.pack?.received_from_qc || 0;
            const packPacked = job.pack?.packed_qty || 0;

            let displayStage = 'INWARD';
            if (
                (job.pack?.stage === 'complete') ||
                (job.pack?.status && ['Packed', 'Complete'].includes(job.pack?.status)) ||
                (packPacked >= totalQty && totalQty > 0) ||
                (job.qc?.released_to_packing && packPacked >= job.qc.released_to_packing && job.qc.released_to_packing > 0)
            ) {
                displayStage = 'DISPATCHED';
            } else if (packReceived > 0) {
                displayStage = 'PACKING';
            } else if (qcReceived > 0) {
                displayStage = 'QC';
            } else if (job.inward_qty > 0) {
                displayStage = 'INWARD';
            }

            if (stageFilter && stageFilter !== 'ALL') {
                job.stage = stageFilter;
            } else {
                job.stage = displayStage;
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

export const checkAndCreateFgStoreForSubJob = async (subJobNo) => {
    try {
        const jobs = await ShopFloorJob.find({ sub_job_no: subJobNo }).lean();
        if (!jobs || jobs.length === 0) return null;

        let highestJob = null;
        let maxIndex = -1;

        for (const job of jobs) {
            if (job.material_groups && job.material_groups.length > 0) {
                for (const mg of job.material_groups) {
                    if (mg.process_index) {
                        const val = parseFloat(mg.process_index);
                        if (!isNaN(val) && val > maxIndex) {
                            maxIndex = val;
                            highestJob = job;
                        }
                    } else if (maxIndex === -1 && !highestJob) {
                        highestJob = job;
                    }
                }
            } else if (!highestJob) {
                highestJob = job;
            }
        }

        if (!highestJob) return null;

        const shopfloor_job_id = highestJob._id;
        const highestJobIdStr = String(shopfloor_job_id);

        const readyJobs = await ReadyJob.find({ sub_job_no: subJobNo });

        let sumGoodQty = 0;
        for (const rj of readyJobs) {
            const isHighest = rj.shopfloor_job_id && String(rj.shopfloor_job_id) === highestJobIdStr;
            if (rj.line_items) {
                for (const line of rj.line_items) {
                    if (line.cycles) {
                        for (const cycle of line.cycles) {
                            const toDept = (cycle.handover_to_department || '').toLowerCase();
                            const isFgHandover = cycle.handed_over && (toDept.includes('fg') || toDept.includes('store') || toDept.includes('warehouse') || toDept.includes('dispatch'));
                            if (isHighest || isFgHandover) {
                                sumGoodQty += (Number(cycle.good_qty) || 0);
                            }
                        }
                    }
                }
            }
        }

        let historySum = 0;
        if (highestJob.material_groups && highestJob.material_groups.length > 0) {
            for (const mg of highestJob.material_groups) {
                if (mg.process_history) {
                    for (const ph of mg.process_history) {
                        const action = (ph.action || '').toUpperCase();
                        if (action.includes("HANDED OVER") && (action.includes("STORES") || action.includes("FG"))) {
                            historySum += (Number(ph.details?.good_qty) || 0);
                        }
                    }
                }
            }
        }

        const isCompleted = highestJob.status === 'Completed';

        if (sumGoodQty > 0 || historySum > 0 || isCompleted) {
            const exists = await FgStore.findOne({ sub_job_no: subJobNo });
            const handedOverQty = Math.max(sumGoodQty, historySum);

            if (!exists) {
                let unitPrice = 0;
                let bom = await Bom.findOne({ sub_job_no: subJobNo });

                if (bom && bom.quotation && bom.quotation.finalUnitPrice) {
                    unitPrice = Number((Number(bom.quotation.finalUnitPrice) || 0).toFixed(2));
                }

                let paymentTerms = "";
                let salesOrder = await SalesOrderForm.findOne({ sub_job_no: subJobNo });
                if (salesOrder && salesOrder.payment) {
                    paymentTerms = salesOrder.payment;
                }

                const newStore = await FgStore.create({
                    job_no: highestJob.job_no,
                    sub_job_no: subJobNo,
                    client_name: highestJob.client_name,
                    product_name: highestJob.product_name,
                    category: highestJob.category,
                    subcategory: highestJob.subcategory,
                    product_image: highestJob.product_image,
                    delivery_date: highestJob.delivery_date,
                    job_completion_date: highestJob.job_completion_date,
                    total_qty: highestJob.total_qty,
                    unit_price: unitPrice,
                    payment_terms: paymentTerms,
                    shopfloor_handed_over_qty: handedOverQty,
                    inward_qty: 0,
                    balance_qty: highestJob.total_qty,
                    stage: 'INWARD',
                    status: 'Pending'
                });
                console.log(`[FG Store] Automatically created FG Store record for ${subJobNo}`);
                return newStore;
            } else {
                exists.shopfloor_handed_over_qty = handedOverQty;
                await exists.save();
                console.log(`[FG Store] Automatically updated handed over qty for ${subJobNo} to ${handedOverQty}`);
                return exists;
            }
        }
        return null;
    } catch (error) {
        console.error("Error in checkAndCreateFgStoreForSubJob:", error);
        return null;
    }
};

export const inwardJob = async (req, res) => {
    try {
        const { id } = req.params;
        const { qty, by, remarks } = req.body;

        const job = await FgStore.findById(id);
        if (!job) return res.status(404).json({ error: 'Job not found' });

        const inwardQtyNumber = Number(qty);
        if (job.inward_qty + inwardQtyNumber > job.total_qty) {
            return res.status(400).json({ error: `Cannot inward more than total quantity. Available: ${job.total_qty - job.inward_qty}` });
        }

        job.inward_qty += inwardQtyNumber;
        job.logs.push({
            type: 'INWARD',
            qty: Number(qty),
            by: by,
            remarks: remarks,
            time: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
        });

        await job.save();
        res.status(200).json(job);
    } catch (error) {
        if (error.name === 'VersionError') {
            return res.status(409).json({ error: 'Data was modified by another user simultaneously. Please refresh and try again.' });
        }
        res.status(500).json({ error: error.message });
    }
};

export const handoverToQc = async (req, res) => {
    try {
        const { id } = req.params;
        const { total, by, remarks } = req.body; // Inward only sends total handed over

        const job = await FgStore.findById(id);
        if (!job) return res.status(404).json({ error: 'Job not found' });

        // Find or create QC record
        let qcJob = await CtQc.findOne({ sub_job_no: job.sub_job_no });
        if (!qcJob) {
            qcJob = new CtQc({
                job_no: job.job_no,
                sub_job_no: job.sub_job_no,
                client_name: job.client_name,
                product_name: job.product_name,
                product_image: job.product_image,
                job_completion_date: job.job_completion_date,
                delivery_date: job.delivery_date,
                total_qty: job.total_qty,
                received_from_inward: 0,
                qc_good_qty: 0,
                qc_bad_qty: 0,
                released_to_packing_qty: 0
            });
        } else {
            if (!qcJob.job_completion_date && job.job_completion_date) {
                qcJob.job_completion_date = job.job_completion_date;
            }
            if (!qcJob.delivery_date && job.delivery_date) {
                qcJob.delivery_date = job.delivery_date;
            }
        }

        const handoverQtyNumber = Number(total);
        if (qcJob.received_from_inward + handoverQtyNumber > job.inward_qty) {
            return res.status(400).json({ error: `Cannot handover more than inwarded quantity. Available: ${job.inward_qty - qcJob.received_from_inward}` });
        }

        qcJob.received_from_inward += handoverQtyNumber;
        qcJob.logs.push({
            type: 'HANDOVER_RECEIVED',
            qty: handoverQtyNumber,
            by: by,
            remarks: remarks,
            date: new Date()
        });

        await qcJob.save();

        // Also update FgStore log
        job.logs.push({
            type: 'HANDOVER',
            qty: Number(total),
            by: by,
            remarks: remarks,
            time: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
        });

        await job.save();
        res.status(200).json(job);
    } catch (error) {
        if (error.name === 'VersionError') {
            return res.status(409).json({ error: 'Data was modified by another user simultaneously. Please refresh and try again.' });
        }
        res.status(500).json({ error: error.message });
    }
};

export const generateInvoice = async (req, res) => {
    try {
        const { id } = req.params;
        const entry = req.body;

        const job = await FgStore.findById(id);
        if (!job) return res.status(404).json({ error: 'Job not found' });

        // Fetch client info for PDF generation
        const soForm = await SalesOrderForm.findOne({ sub_job_no: job.sub_job_no });
        if (soForm) {
            job.client_phone = soForm.mobile_no || (soForm.wp_number && soForm.wp_number[0]) || '';
            job.client_email = (soForm.email && soForm.email[0]) || '';

            let addr = [];
            if (soForm.billing_address_1) addr.push(soForm.billing_address_1);
            let cityState = [];
            if (soForm.billing_city) cityState.push(soForm.billing_city);
            if (soForm.billing_state) cityState.push(soForm.billing_state);
            if (soForm.billing_postal_code) cityState.push(soForm.billing_postal_code);
            if (cityState.length > 0) addr.push(cityState.join(', '));
            job.client_address = addr.join(', ');
        }

        const invoiceQty = Number(entry.qty);
        if (isNaN(invoiceQty) || invoiceQty <= 0) {
            return res.status(400).json({ error: 'Invalid invoice quantity' });
        }

        // Concurrency Check: Ensure we do not invoice more than inward received qty
        // since they said "inward panna qty 1 vanthalum generate panalam"
        const availableToInvoice = job.inward_qty - job.invoiced_qty;

        if (invoiceQty > availableToInvoice) {
            return res.status(400).json({ error: `Cannot invoice more than available received quantity. Available: ${availableToInvoice}` });
        }

        const year = new Date().getFullYear();
        const prefix = `INV-${year}-`;

        // Find the latest invoice in the current year to determine the next sequence number
        const lastInvoice = await CtInvoice.findOne({ invoiceNo: new RegExp(`^${prefix}`) })
            .sort({ invoiceNo: -1 })
            .collation({ locale: "en_US", numericOrdering: true });

        let seqNo = 1;
        if (lastInvoice && lastInvoice.invoiceNo) {
            const parts = lastInvoice.invoiceNo.split('-');
            if (parts.length === 3) {
                const lastSeq = parseInt(parts[2], 10);
                if (!isNaN(lastSeq)) {
                    seqNo = lastSeq + 1;
                }
            }
        }

        const invoiceNo = `${prefix}${String(seqNo).padStart(4, '0')}`;

        let invoiceDueDate = null;
        if (soForm && soForm.payment) {
            const pt = soForm.payment.toLowerCase();
            const now = new Date();

            if (pt.includes('100% advance')) {
                invoiceDueDate = null;
            } else if (pt.includes('45days') || pt.includes('45 days')) {
                invoiceDueDate = new Date(now.setDate(now.getDate() + 45));
            } else if (
                pt.includes('30days') || pt.includes('30 days') ||
                pt.includes('50% advance against order') ||
                pt.includes('once material passes qc') ||
                pt.includes('net 30') ||
                pt.includes('50%') || pt.includes('30')
            ) {
                invoiceDueDate = new Date(now.setDate(now.getDate() + 30));
            }
        }

        const newInvoice = new CtInvoice({
            job_no: job.job_no,
            sub_job_no: job.sub_job_no,
            invoiceNo,
            qty: invoiceQty,
            pricePerQty: Number(Number(entry.pricePerQty).toFixed(2)),
            gstPct: Number(entry.gstPct),
            gst_tax: entry.gst_tax && mongoose.Types.ObjectId.isValid(entry.gst_tax) ? entry.gst_tax : null,
            subtotal: Number(Number(entry.subtotal).toFixed(2)),
            gstAmt: Number(Number(entry.gstAmt).toFixed(2)),
            totalAmt: Number(Number(entry.totalAmt).toFixed(2)),
            by: req.user?.name || 'System',
            remarks: entry.remarks,
            dueDate: invoiceDueDate,
            time: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
        });

        // Generate PDF and upload to R2
        try {
            const pdfBuffer = await generateInvoicePDFBuffer(newInvoice, job);
            const pdfUrl = await uploadToR2(`invoice/${job.job_no}`, pdfBuffer, `${invoiceNo}.pdf`, "application/pdf");
            newInvoice.pdf_url = pdfUrl;
        } catch (pdfErr) {
            console.error("Error generating or uploading invoice PDF:", pdfErr);
        }

        await newInvoice.save();

        job.invoiced_qty += invoiceQty;

        if (job.invoiced_qty >= job.total_qty) {
            job.stage = 'DISPATCHED'; // Fully invoiced, moves to dispatched/completed state
        } else {
            // "andha stage vena create panikala no restriction"
            // If they are generating invoice, we shouldn't necessarily move them backward if they were in QC.
            if (job.stage === 'INWARD') {
                job.stage = 'INVOICE';
            }
        }

        job.logs.push({
            type: 'INVOICE',
            qty: invoiceQty,
            by: req.user?.name || 'System',
            remarks: entry.remarks,
            time: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
        });

        await job.save();
        res.status(200).json({ job, invoice: newInvoice });
    } catch (error) {
        if (error.name === 'VersionError') {
            return res.status(409).json({ error: 'Data was modified by another user simultaneously. Please refresh and try again.' });
        }
        res.status(500).json({ error: error.message });
    }
};
