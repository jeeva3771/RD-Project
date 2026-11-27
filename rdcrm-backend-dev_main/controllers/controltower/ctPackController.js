import CtPack from '../../models/controltower/ctPackModel.js';
import CtQc from '../../models/controltower/ctQcModel.js';
import BomModel from '../../models/bom/bomModel.js';
import StoreMaterialIssue from '../../models/store/materialIssueModel.js';
import SalesOrderForm from '../../models/sales_orders/sales_order_form_Model.js';
import DeliveryChallan from '../../models/accounts/deliveryChallanModel.js';
import { generateSignedUrl, downloadFromR2 } from '../../helpers/r2helper.js';
import { ZipArchive } from 'archiver';
export const getCtPackJobs = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const skip = (page - 1) * limit;
        const statusFilter = req.query.status;
        const search = req.query.search;

        let query = {};
        if (statusFilter && statusFilter !== 'ALL') {
            if (statusFilter === 'PENDING' || statusFilter === 'Pending') {
                query.status = 'Pending';
            } else if (statusFilter === 'IN_PROGRESS' || statusFilter === 'Packing in Progress') {
                query.status = 'Packing in Progress';
            } else if (statusFilter === 'COMPLETE' || statusFilter === 'Packed' || statusFilter === 'Complete') {
                query.status = { $in: ['Packed', 'Complete'] };
            } else {
                query.status = statusFilter;
            }
        }
        if (search && search.trim()) {
            const q = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            query.$or = [
                { job_no: { $regex: q, $options: 'i' } },
                { sub_job_no: { $regex: q, $options: 'i' } },
                { client_name: { $regex: q, $options: 'i' } },
                { product_name: { $regex: q, $options: 'i' } },
                { challanNo: { $regex: q, $options: 'i' } },
                { courierName: { $regex: q, $options: 'i' } }
            ];
        }

        const total = await CtPack.countDocuments(query);
        const jobs = await CtPack.find(query).lean().sort({ createdAt: -1 }).skip(skip).limit(limit);

        const normSubJob = (sj) => (sj || '').replace(/[-_]/g, '').toLowerCase();
        const subJobNos = jobs.map(j => j.sub_job_no).filter(Boolean);
        const subJobRegexes = subJobNos.map(s => new RegExp(`^${(s || '').trim()}$`, 'i'));
        const boms = await BomModel.find({ sub_job_no: { $in: subJobNos } }, 'sub_job_no job_quantity packingdatas').lean();
        const materialIssues = await StoreMaterialIssue.find({ sub_job_no: { $in: subJobNos } }, 'sub_job_no materials').lean();
        const salesOrders = await SalesOrderForm.find({ sub_job_no: { $in: subJobNos } }, 'sub_job_no delivery_address delivery_type delivery_mode who_will_pay courier_amount multi_deliveries client_name contact_person product_files mobile_no').lean();
        const qcJobs = await CtQc.find({ sub_job_no: { $in: subJobNos } }, 'sub_job_no total_qty received_from_inward qc_good_qty qc_bad_qty status').lean();
        const deliveryChallans = subJobRegexes.length > 0 ? await DeliveryChallan.find({ sub_job_no: { $in: subJobRegexes } }).lean() : [];

        // Compute Counts for tabs
        const aggCounts = await CtPack.aggregate([
            { $group: { _id: "$status", count: { $sum: 1 } } }
        ]);
        const counts = { 'Pending': 0, 'Packing in Progress': 0, 'Packed': 0, 'Complete': 0, 'ALL': 0 };
        aggCounts.forEach(c => {
            if (counts[c._id] !== undefined) counts[c._id] = c.count;
            counts.ALL += c.count;
        });
        counts['PENDING'] = counts['Pending'];
        counts['IN_PROGRESS'] = counts['Packing in Progress'];
        counts['COMPLETE'] = (counts['Packed'] || 0) + (counts['Complete'] || 0);

        const mappedJobs = jobs.map(job => {
            const bom = boms.find(b => b.sub_job_no === job.sub_job_no);
            const storeIssue = materialIssues.find(mi => mi.sub_job_no === job.sub_job_no);
            const so = salesOrders.find(s => s.sub_job_no === job.sub_job_no);

            if (bom?.job_quantity && (!job.total_qty || job.total_qty < bom.job_quantity)) {
                job.total_qty = bom.job_quantity;
            }
            if (job.deliveredQty > 0 && job.total_qty > 0 && job.deliveredQty < job.total_qty) {
                if (job.status === 'Dispatched') job.status = 'Partial Dispatched';
                if (job.stage === 'complete') job.stage = 'dispatch';
            }

            if (so) {
                job.sales_order = {
                    delivery_address: so.delivery_address,
                    delivery_type: so.delivery_type,
                    delivery_mode: so.delivery_mode,
                    who_will_pay: so.who_will_pay,
                    courier_amount: so.courier_amount,
                    mobile_no: so.mobile_no,
                    multi_deliveries: so.multi_deliveries,
                    client_name: so.client_name,
                    contact_person: so.contact_person,
                    product_files: Array.isArray(so.product_files)
                        ? so.product_files.map((file) => {
                            try {
                                return generateSignedUrl(file, 86400, true);
                            } catch (e) {
                                console.log(e);
                                return file;
                            }
                        })
                        : []
                };
            }

            if (bom && bom.packingdatas) {
                const existingPmat = job.pmatItems || [];
                const isLabourOrService = (name) => {
                    if (!name) return false;
                    const n = String(name).toLowerCase();
                    return n.includes('labour') || n.includes('labor') || n.includes('charge') || n.includes('freight');
                };

                job.pmatItems = bom.packingdatas
                    .filter(pmat => !isLabourOrService(pmat.name || pmat.itemType))
                    .map(pmat => {
                        const matchedStoreItem = storeIssue?.materials?.find(m =>
                            (m.material_id && pmat.itemId && m.material_id.toString() === pmat.itemId.toString()) ||
                            (m.material_name === pmat.name)
                        );

                        // Preserve saved progress from the DB
                        const savedItem = existingPmat.find(ep =>
                            (ep.id && pmat.itemId && ep.id.toString() === pmat.itemId.toString()) ||
                            (ep.name === pmat.name) ||
                            (ep._id && ep._id.toString() === (pmat._id ? pmat._id.toString() : ""))
                        );

                        return {
                            ...pmat,
                            issued_qty: matchedStoreItem ? (matchedStoreItem.issued_qty || 0) : 0,
                            receivedQty: savedItem ? (savedItem.receivedQty || 0) : 0,
                            received: savedItem ? (savedItem.received || false) : false
                        };
                    });
            } else {
                job.pmatItems = [];
            }

            if (job.product_image) {
                try {
                    job.product_image = generateSignedUrl(job.product_image);

                } catch (e) {
                    console.error("Failed to sign url for ct_pack:", e);
                }
            }

            if (job.dispatchFiles && Array.isArray(job.dispatchFiles)) {
                job.dispatchFiles = job.dispatchFiles.map(file => {
                    try {
                        return generateSignedUrl(file, 86400, true);
                        // eslint-disable-next-line no-unused-vars
                    } catch (e) {

                        return file;
                    }
                });
            }



            // Merge Delivery Challans created from Accounts Console
            const currentSubKey = String(job.sub_job_no || '').trim().toLowerCase();
            const subChallans = deliveryChallans.filter(dc =>
                String(dc.sub_job_no || '').trim().toLowerCase() === currentSubKey
            );

            if (subChallans.length > 0) {
                const existingList = Array.isArray(job.challanList) ? [...job.challanList] : [];
                const seenNos = new Set(existingList.map(c => String(c.challanNo || '').trim().toLowerCase()).filter(Boolean));

                subChallans.forEach((dc, idx) => {
                    const dcNoKey = String(dc.challanNo || '').trim().toLowerCase();
                    if (!seenNos.has(dcNoKey)) {
                        seenNos.add(dcNoKey);
                        existingList.push({
                            id: String(dc._id || `ch_${idx}`),
                            challanNo: dc.challanNo,
                            qty: Number(dc.qty) || 0,
                            challanDate: dc.challanDate || job.challanDate,
                            destId: 0,
                            destName: dc.destName || "Main Destination",
                            dispatchMode: dc.dispatchMode || "Courier",
                            challanNote: dc.remarks || "",
                            challanFile: dc.challanFile || "",
                            by: dc.by || "Accounts",
                            dt: dc.challanDate,
                        });
                    } else {
                        const existingItem = existingList.find(c => String(c.challanNo || '').trim().toLowerCase() === dcNoKey);
                        if (existingItem) {
                            if (!existingItem.challanFile && dc.challanFile) {
                                existingItem.challanFile = dc.challanFile;
                            }
                            if (!existingItem.by) {
                                existingItem.by = dc.by || "Accounts";
                            }
                        }
                    }
                });

                job.challanList = existingList;

                if (!job.challanNo && existingList.length > 0) {
                    job.challanNo = Array.from(new Set(existingList.map(c => c.challanNo).filter(Boolean))).join(", ");
                }
                if (!job.challanDate && subChallans[0]?.challanDate) {
                    job.challanDate = subChallans[0].challanDate;
                }
                if (!job.challanFile && subChallans[0]?.challanFile) {
                    job.challanFile = subChallans[0].challanFile;
                }
                if (!job.challanFiles || job.challanFiles.length === 0) {
                    job.challanFiles = subChallans.map(dc => dc.challanFile).filter(Boolean);
                }
            }

            if (job.challanFile) {
                try {
                    job.challanFile = generateSignedUrl(job.challanFile, 86400, true);
                } catch (e) {
                    console.error("Failed to sign challanFile url:", e);
                }
            }
            if (job.challanFiles && Array.isArray(job.challanFiles)) {
                job.challanFiles = job.challanFiles.map(file => {
                    try {
                        return generateSignedUrl(file, 86400, true);
                    } catch (e) {
                        console.log(e);
                        return file;
                    }
                });
            }
            if (job.destinations && !Array.isArray(job.destinations)) {
                job.destinations = [job.destinations];
            }
            if (job.destinations && Array.isArray(job.destinations)) {
                job.destinations = job.destinations.map(d => {
                    if (d) {
                        let updated = { ...d };
                        if (d.challanFile) {
                            try { updated.challanFile = generateSignedUrl(d.challanFile, 86400, true); } catch (e) { console.log(e); }
                        }
                        if (d.awbFile) {
                            try { updated.awbFile = generateSignedUrl(d.awbFile, 86400, true); } catch (e) { console.log(e); }
                        }
                        if (d.misLabelFile) {
                            try { updated.misLabelFile = generateSignedUrl(d.misLabelFile, 86400, true); } catch (e) { console.log(e); }
                        }
                        return updated;
                    }
                    return d;
                });
            }
            if (job.challanList && Array.isArray(job.challanList)) {
                job.challanList = job.challanList.map(item => {
                    if (item) {
                        let updated = { ...item };
                        if (item.challanFile) {
                            try { updated.challanFile = generateSignedUrl(item.challanFile, 86400, true); } catch (e) { console.log(e); }
                        }
                        if (item.awbFile) {
                            try { updated.awbFile = generateSignedUrl(item.awbFile, 86400, true); } catch (e) { console.log(e); }
                        }
                        if (item.misLabelFile) {
                            try { updated.misLabelFile = generateSignedUrl(item.misLabelFile, 86400, true); } catch (e) { console.log(e); }
                        }
                        return updated;
                    }
                    return item;
                });
            }
            if (job.misLabelFiles && Array.isArray(job.misLabelFiles)) {
                job.misLabelFiles = job.misLabelFiles.map(file => {
                    try { return generateSignedUrl(file, 86400, true); } catch (e) { console.log(e); return file; }
                });
            }
            if (job.labelFiles && Array.isArray(job.labelFiles)) {
                job.labelFiles = job.labelFiles.map(file => {
                    try { return generateSignedUrl(file, 86400, true); } catch (e) { console.log(e); return file; }
                });
            }

            if (job.dispatchFileRejections && Array.isArray(job.dispatchFileRejections)) {
                job.dispatchFileRejections.forEach(rej => {
                    if (rej.fileUrls && Array.isArray(rej.fileUrls)) {
                        rej.fileUrls = rej.fileUrls.map(url => {
                            try {
                                return generateSignedUrl(url, 86400, true);
                            } catch (e) {
                                console.log(e)
                                return url;
                            }
                        });
                    }
                });
            }

            if (Array.isArray(job.destinations) && job.destinations.length > 0) {
                const hasAnyDestAwb = job.destinations.some(d => d && d.awb);
                if (hasAnyDestAwb) {
                    job.awbNumbers = job.destinations.map((d, i) => {
                        if (d && d.awb && String(d.awb).trim()) return String(d.awb).trim();
                        return (Array.isArray(job.awbNumbers) && job.awbNumbers[i]) ? String(job.awbNumbers[i]).trim() : "";
                    });
                }
            }

            const currentSubNorm = normSubJob(job.sub_job_no);
            const qcRecord = qcJobs.find(q => normSubJob(q.sub_job_no) === currentSubNorm);
            if (qcRecord) {
                job.qc_good_qty = qcRecord.qc_good_qty || 0;
                job.qc_bad_qty = qcRecord.qc_bad_qty || 0;
                job.qc_status = qcRecord.status || '';
                job.qc_completed = (qcRecord.status === 'QC Completed' || ((qcRecord.qc_good_qty || 0) + (qcRecord.qc_bad_qty || 0)) >= (qcRecord.total_qty || 0));
            } else {
                job.qc_good_qty = 0;
                job.qc_bad_qty = 0;
                job.qc_status = '';
                job.qc_completed = false;
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

export const packJob = async (req, res) => {
    try {
        const { id } = req.params;
        const { qty, by, remarks } = req.body;

        const job = await CtPack.findById(id);
        if (!job) return res.status(404).json({ error: 'Packing Job not found' });

        const packedQty = Number(qty) || 0;

        if (job.packed_qty + packedQty > job.received_from_qc) {
            return res.status(400).json({ error: 'Cannot pack more than what was received from QC.' });
        }

        job.packed_qty += packedQty;
        job.logs.push({
            type: 'PACKED',
            qty: packedQty,
            by: by,
            remarks: remarks,
            date: new Date()
        });

        if (job.packed_qty >= job.total_qty) {
            job.status = 'Packed';
        } else if (job.packed_qty > 0 || job.received_from_qc > 0) {
            job.status = 'Packing in Progress';
        } else {
            job.status = 'Pending';
        }

        await job.save();
        res.status(200).json(job);
    } catch (error) {
        if (error.name === 'VersionError') {
            return res.status(409).json({ error: 'Data was modified by another user simultaneously. Please refresh and try again.' });
        }
        res.status(500).json({ error: error.message });
    }
};

export const updateCtPackJob = async (req, res) => {
    try {
        const { id } = req.params;
        const patch = { ...req.body };

        const job = await CtPack.findById(id);
        if (!job) {
            return res.status(404).json({ error: 'Packing Job not found' });
        }

        // Parse any stringified JSON fields if sent via FormData
        ['destinations', 'pmatItems', 'shipments', 'handDelivery', 'clientPickup', 'awbNumbers', 'challanList'].forEach(field => {
            if (typeof patch[field] === 'string') {
                try {
                    patch[field] = JSON.parse(patch[field]);
                } catch (e) {
                    console.error(`Failed to parse patch.${field}:`, e);
                }
            }
            if (Array.isArray(patch[field])) {
                patch[field] = patch[field].map(item => {
                    if (typeof item === 'string') {
                        try { return JSON.parse(item); } catch (e) { console.log(e); return item; }
                    }
                    return item;
                });
            } else if (patch[field] && typeof patch[field] === 'object' && (field === 'destinations' || field === 'shipments' || field === 'challanList')) {
                patch[field] = [patch[field]];
            }
        });



        if (typeof patch.newLog === 'string') {
            try {
                patch.newLog = JSON.parse(patch.newLog);

            } catch (e) { void e; }
        }

        const activeDestinations = patch.destinations || job.destinations;
        if (Array.isArray(activeDestinations) && activeDestinations.length > 0) {
            const hasAnyDestAwb = activeDestinations.some(d => d && d.awb);
            if (hasAnyDestAwb) {
                const alignedAwbs = activeDestinations.map((d, i) => {
                    if (d && d.awb && String(d.awb).trim()) return String(d.awb).trim();
                    if (Array.isArray(patch.awbNumbers) && patch.awbNumbers[i]) return String(patch.awbNumbers[i]).trim();
                    if (Array.isArray(job.awbNumbers) && job.awbNumbers[i]) return String(job.awbNumbers[i]).trim();
                    return "";
                });
                patch.awbNumbers = alignedAwbs;
            }
        }

        // 1. Stage Check
        if (patch.expectedStage && patch.stage) {
            if (job.stage !== patch.expectedStage) {
                return res.status(400).json({ error: 'Already moved to next step by another user. Please refresh page.' });
            }
            delete patch.expectedStage;
        }

        // 2. QC Inward Check
        let incPatch = {};
        if (patch.incrementQc) {
            const increment = Number(patch.incrementQc) || 0;
            const remaining = (job.received_from_qc || job.total_qty) - (job.qcAcceptedQty || 0);

            if (increment > remaining) {
                return res.status(400).json({ error: `Cannot inward ${increment}. Only ${remaining} qty pending. Please refresh page.` });
            }

            // Use MongoDB's native $inc for atomic addition
            incPatch.qcAcceptedQty = increment;

            // Determine qcPartial accurately by doing DB calculation directly in $set if needed
            // But since we use $inc, qcPartial might be outdated if we don't recalculate it properly.
            // Actually, we can just delete incrementQc and let $inc handle it.
            delete patch.incrementQc;
            delete patch.qcAcceptedQty; // Remove it from $set
        }

        // 3. Handle newLog / newLogs atomically with $push to preserve history
        let pushPatch = {};
        if (patch.newLog) {
            if (Array.isArray(patch.newLog)) {
                pushPatch.logs = { $each: patch.newLog };
            } else {
                const logObj = typeof patch.newLog === 'string'
                    ? { msg: patch.newLog, dt: new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) }
                    : patch.newLog;
                pushPatch.logs = logObj;
            }
            delete patch.newLog;
        }

        // Handle uploaded files (Challan files, labels, or dispatch files)
        let uploadedUrls = [];
        if (req.files && req.files.length > 0) {
            const { uploadToR2 } = await import('../../helpers/r2helper.js');
            for (const file of req.files) {
                try {
                    const field = file.fieldname || '';
                    if (field === 'challan_file' || field === 'challan_files') {
                        const fileUrl = await uploadToR2(
                            `controltower/packing/${job.job_no}/${job.sub_job_no}/challan`,
                            file.buffer,
                            file.originalname,
                            file.mimetype
                        );
                        if (!patch.challanList && Array.isArray(job.challanList)) {
                            patch.challanList = JSON.parse(JSON.stringify(job.challanList));
                        }
                        if (Array.isArray(patch.challanList) && patch.challanList[0]) {
                            patch.challanList[0].challanFile = fileUrl;
                        }
                    } else if (field.startsWith('challan_item_') || field.startsWith('challan_file_')) {
                        const itemIdx = parseInt(field.replace('challan_item_', '').replace('challan_file_', ''));
                        const fileUrl = await uploadToR2(
                            `controltower/packing/${job.job_no}/${job.sub_job_no}/challan/item_${itemIdx}`,
                            file.buffer,
                            file.originalname,
                            file.mimetype
                        );
                        if (!patch.challanList && Array.isArray(job.challanList)) {
                            patch.challanList = JSON.parse(JSON.stringify(job.challanList));
                        }
                        if (Array.isArray(patch.challanList) && patch.challanList[itemIdx]) {
                            patch.challanList[itemIdx].challanFile = fileUrl;
                        }
                    } else if (field.startsWith('challan_dest_')) {
                        const destIdx = parseInt(field.replace('challan_dest_', ''));
                        const fileUrl = await uploadToR2(
                            `controltower/packing/${job.job_no}/${job.sub_job_no}/challan/dest_${destIdx}`,
                            file.buffer,
                            file.originalname,
                            file.mimetype
                        );
                        if (!patch.destinations && Array.isArray(job.destinations)) {
                            patch.destinations = JSON.parse(JSON.stringify(job.destinations));
                        }
                        if (Array.isArray(patch.destinations) && patch.destinations[destIdx]) {
                            patch.destinations[destIdx].challanFile = fileUrl;
                        }
                    } else if (field.startsWith('awb_label_item_') || field.startsWith('mis_label_item_')) {
                        const itemIdx = parseInt(field.replace('awb_label_item_', '').replace('mis_label_item_', ''));
                        const fileUrl = await uploadToR2(
                            `controltower/packing/${job.job_no}/${job.sub_job_no}/awb_labels/item_${itemIdx}`,
                            file.buffer,
                            file.originalname,
                            file.mimetype
                        );
                        if (!patch.challanList) {
                            patch.challanList = (Array.isArray(job.challanList) && job.challanList.length > 0)
                                ? JSON.parse(JSON.stringify(job.challanList))
                                : [];
                        }
                        if (!patch.destinations) {
                            patch.destinations = (Array.isArray(job.destinations) && job.destinations.length > 0)
                                ? JSON.parse(JSON.stringify(job.destinations))
                                : [];
                        }

                        if (patch.challanList.length > itemIdx) {
                            patch.challanList[itemIdx].awbFile = fileUrl;
                            patch.challanList[itemIdx].misLabelFile = fileUrl;
                        }
                        if (patch.destinations.length > itemIdx) {
                            patch.destinations[itemIdx].awbFile = fileUrl;
                            patch.destinations[itemIdx].misLabelFile = fileUrl;
                        } else if (patch.challanList.length === 0 && patch.destinations.length === 0 && itemIdx === 0) {
                            patch.destinations = [{
                                id: "d1",
                                name: job.client_name || "Client",
                                addr: "Standard Delivery Address",
                                qty: job.qcAcceptedQty || job.total_qty || 1,
                                awbFile: fileUrl,
                                misLabelFile: fileUrl
                            }];
                        }

                        if (!patch.misLabelUploaded) {
                            patch.misLabelUploaded = true;
                        }
                        if (!pushPatch.misLabelFiles) pushPatch.misLabelFiles = { $each: [] };
                        pushPatch.misLabelFiles.$each.push(fileUrl);
                    } else {
                        const fileUrl = await uploadToR2(
                            `controltower/packing/${job.job_no}/${job.sub_job_no}/dispatch_files`,
                            file.buffer,
                            file.originalname,
                            file.mimetype
                        );
                        uploadedUrls.push(fileUrl);
                    }
                } catch (err) {
                    console.error("Failed to upload file to R2 in updateCtPackJob:", err);
                }
            }
        }

        if (uploadedUrls.length > 0) {
            const pdfUrl = uploadedUrls.find(u => u.toLowerCase().endsWith('.pdf')) || uploadedUrls[uploadedUrls.length - 1];
            const isShippingLabel = patch.labelsGenerated || req.body.labelsGenerated === "true" || req.body.labelsGenerated === true;
            const isMisLabel = patch.misLabelUploaded || req.body.misLabelUploaded === "true" || req.body.misLabelUploaded === true;

            if (isShippingLabel) {
                patch.labelsUploaded = true;
                if (!pushPatch.labelFiles) pushPatch.labelFiles = { $each: [] };
                pushPatch.labelFiles.$each.push(pdfUrl);
            } else if (isMisLabel) {
                patch.misLabelUploaded = true;
                if (!pushPatch.misLabelFiles) pushPatch.misLabelFiles = { $each: [] };
                pushPatch.misLabelFiles.$each.push(pdfUrl);
            } else {
                pushPatch.dispatchFiles = { $each: uploadedUrls };
            }
        }

        let updateQuery = { $set: patch };
        if (Object.keys(incPatch).length > 0) {
            updateQuery.$inc = incPatch;
        }
        if (Object.keys(pushPatch).length > 0) {
            updateQuery.$push = pushPatch;
        }

        const updatedJob = await CtPack.findByIdAndUpdate(id, updateQuery, { new: true });

        // After atomic update, we must re-evaluate qcPartial and status based on the NEW data!
        if (updatedJob) {
            let needsSave = false;

            // 1. Re-evaluate qcPartial if there was an increment
            if (Object.keys(incPatch).length > 0) {
                const isPartial = (updatedJob.qcAcceptedQty || 0) < (updatedJob.total_qty || job.qty);
                if (updatedJob.qcPartial !== isPartial) {
                    updatedJob.qcPartial = isPartial;
                    needsSave = true;
                }
            }

            // 2. Re-evaluate Status based on User Rules (support partial dispatch)
            const total = updatedJob.total_qty || updatedJob.qty || 0;
            let newStatus = updatedJob.status;

            if (updatedJob.deliveredQty >= total && total > 0) {
                newStatus = 'Packed';
            } else if ((updatedJob.qcAcceptedQty || 0) > 0 || (updatedJob.stage && updatedJob.stage !== 'qc_pending')) {
                newStatus = 'Packing in Progress';
            } else {
                newStatus = 'Pending';
            }

            if (updatedJob.status !== newStatus) {
                updatedJob.status = newStatus;
                needsSave = true;
            }

            if (needsSave) {
                await updatedJob.save();
            }
        }

        // Bi-directional sync: Ensure all Delivery Challans created or modified in Packing are synced to DeliveryChallan collection
        if (updatedJob && Array.isArray(updatedJob.challanList)) {
            try {
                const subJobNo = updatedJob.sub_job_no;
                const keepChallanNos = updatedJob.challanList.map(c => String(c.challanNo || '').trim()).filter(Boolean);

                // If challanList was updated, delete any DeliveryChallans that were removed
                if (patch.challanList && keepChallanNos.length > 0) {
                    await DeliveryChallan.deleteMany({
                        sub_job_no: new RegExp(`^${subJobNo.trim()}$`, 'i'),
                        challanNo: { $nin: keepChallanNos.map(c => new RegExp(`^${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')) }
                    });
                }

                for (const item of updatedJob.challanList) {
                    const cNo = String(item.challanNo || '').trim();
                    if (!cNo) continue;
                    const subJobNo = updatedJob.sub_job_no;
                    const cQty = Number(item.qty) || 0;
                    const cDate = item.challanDate || updatedJob.challanDate || '';
                    const cFile = item.challanFile || '';
                    const cDest = item.destName || '';
                    const cMode = item.dispatchMode || '';
                    const cRemarks = item.challanNote || item.remarks || '';

                    const updateFields = {
                        sub_job_no: subJobNo,
                        job_no: updatedJob.job_no || '',
                        client_name: updatedJob.client_name || '',
                        product_name: updatedJob.product_name || '',
                        challanNo: cNo,
                        qty: cQty,
                        challanDate: cDate,
                        destName: cDest,
                        dispatchMode: cMode,
                        remarks: cRemarks,
                        pack_id: updatedJob._id,
                    };
                    if (cFile) {
                        updateFields.challanFile = cFile;
                    }
                    if (item.by) {
                        updateFields.by = item.by;
                    } else {
                        updateFields.by = 'Packing';
                    }

                    const escaped = cNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    await DeliveryChallan.findOneAndUpdate(
                        {
                            sub_job_no: new RegExp(`^${subJobNo.trim()}$`, 'i'),
                            challanNo: new RegExp(`^${escaped}$`, 'i'),
                        },
                        {
                            $set: updateFields,
                        },
                        { upsert: true, new: true }
                    );
                }
            } catch (dcSyncErr) {
                console.error("Error syncing packing challans to DeliveryChallan collection:", dcSyncErr);
            }
        }

        let jobObj = updatedJob ? updatedJob.toObject() : null;
        if (jobObj) {
            if (jobObj.challanFile) {
                try {
                    jobObj.challanFile = generateSignedUrl(jobObj.challanFile, 86400, true);
                } catch (e) { console.error("Failed to sign challanFile url:", e); }
            }
            if (jobObj.challanFiles && Array.isArray(jobObj.challanFiles)) {
                jobObj.challanFiles = jobObj.challanFiles.map(file => {
                    try {
                        return generateSignedUrl(file, 86400, true);
                    } catch (e) {
                        console.log(e);
                        return file;
                    }
                });
            }
            if (jobObj.destinations && !Array.isArray(jobObj.destinations)) {
                jobObj.destinations = [jobObj.destinations];
            } else if (!jobObj.destinations) {
                jobObj.destinations = [];
            }
            if (jobObj.destinations && Array.isArray(jobObj.destinations)) {
                jobObj.destinations = jobObj.destinations.map(d => {
                    if (d) {
                        let updated = { ...d };
                        if (d.challanFile) {
                            try { updated.challanFile = generateSignedUrl(d.challanFile, 86400, true); } catch (e) { console.log(e); }
                        }
                        if (d.awbFile) {
                            try { updated.awbFile = generateSignedUrl(d.awbFile, 86400, true); } catch (e) { console.log(e); }
                        }
                        if (d.misLabelFile) {
                            try { updated.misLabelFile = generateSignedUrl(d.misLabelFile, 86400, true); } catch (e) { console.log(e); }
                        }
                        return updated;
                    }
                    return d;
                });
            }
            if (jobObj.challanList && Array.isArray(jobObj.challanList)) {
                jobObj.challanList = jobObj.challanList.map(item => {
                    if (item) {
                        let updated = { ...item };
                        if (item.challanFile) {
                            try { updated.challanFile = generateSignedUrl(item.challanFile, 86400, true); } catch (e) { console.log(e); }
                        }
                        if (item.awbFile) {
                            try { updated.awbFile = generateSignedUrl(item.awbFile, 86400, true); } catch (e) { console.log(e); }
                        }
                        if (item.misLabelFile) {
                            try { updated.misLabelFile = generateSignedUrl(item.misLabelFile, 86400, true); } catch (e) { console.log(e); }
                        }
                        return updated;
                    }
                    return item;
                });
            }
            if (jobObj.misLabelFiles && Array.isArray(jobObj.misLabelFiles)) {
                jobObj.misLabelFiles = jobObj.misLabelFiles.map(file => {
                    try { return generateSignedUrl(file, 86400, true); } catch (e) { console.log(e); return file; }
                });
            }
            if (jobObj.labelFiles && Array.isArray(jobObj.labelFiles)) {
                jobObj.labelFiles = jobObj.labelFiles.map(file => {
                    try { return generateSignedUrl(file, 86400, true); } catch (e) { console.log(e); return file; }
                });
            }
            if (jobObj.dispatchFiles && Array.isArray(jobObj.dispatchFiles)) {
                jobObj.dispatchFiles = jobObj.dispatchFiles.map(file => {
                    try {
                        return generateSignedUrl(file, 86400, true);
                    } catch (e) { console.log(e); return file; }
                });
            }
            if (jobObj.labelFile) {
                try {
                    jobObj.labelFile = generateSignedUrl(jobObj.labelFile, 86400, true);

                } catch (e) { console.error("Failed to sign labelFile url:", e); }
            }
            if (jobObj.misLabelFile) {
                try {
                    jobObj.misLabelFile = generateSignedUrl(jobObj.misLabelFile, 86400, true);

                } catch (e) { console.error("Failed to sign misLabelFile url:", e); }
            }
            if (jobObj.dispatchFileRejections && Array.isArray(jobObj.dispatchFileRejections)) {
                jobObj.dispatchFileRejections.forEach(rej => {
                    if (rej.fileUrls && Array.isArray(rej.fileUrls)) {
                        rej.fileUrls = rej.fileUrls.map(url => {
                            try {
                                return generateSignedUrl(url, 86400, true);
                                // eslint-disable-next-line no-unused-vars
                            } catch (e) { return url; }

                        });
                    }
                });
            }
        }

        const finalJob = jobObj || (updatedJob ? updatedJob.toObject() : null);
        res.status(200).json({ success: true, job: finalJob, ...(finalJob || {}) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const downloadDispatchFiles = async (req, res) => {
    try {
        const { id } = req.params;
        let job = await CtPack.findById(id).catch(() => null);
        if (!job) {
            job = await CtPack.findOne({ $or: [{ sub_job_no: id }, { job_no: id }] });
        }

        let filesToDownload = [];
        let subJobNo = job?.sub_job_no || id;

        if (job) {
            if (job.dispatchFiles && job.dispatchFiles.length > 0) {
                filesToDownload.push(...job.dispatchFiles);
            }
            if (job.challanFile) filesToDownload.push(job.challanFile);
            if (job.challanFiles && Array.isArray(job.challanFiles)) {
                filesToDownload.push(...job.challanFiles);
            }
            if (job.destinations && Array.isArray(job.destinations)) {
                job.destinations.forEach(d => {
                    if (d && d.challanFile) filesToDownload.push(d.challanFile);
                    if (d && d.awbFile) filesToDownload.push(d.awbFile);
                    if (d && d.misLabelFile) filesToDownload.push(d.misLabelFile);
                });
            }
            if (job.challanList && Array.isArray(job.challanList)) {
                job.challanList.forEach(c => {
                    if (c && c.challanFile) filesToDownload.push(c.challanFile);
                    if (c && c.awbFile) filesToDownload.push(c.awbFile);
                    if (c && c.misLabelFile) filesToDownload.push(c.misLabelFile);
                });
            }
            if (job.labelFile) filesToDownload.push(job.labelFile);
            if (job.misLabelFile) filesToDownload.push(job.misLabelFile);
            if (job.misLabelFiles && Array.isArray(job.misLabelFiles)) {
                filesToDownload.push(...job.misLabelFiles);
            }
        }
        if (filesToDownload.length === 0) {
            const so = await SalesOrderForm.findOne({
                $or: [{ _id: id }, { sub_job_no: subJobNo }, { job_no: subJobNo }]
            }).lean().catch(() => null);

            if (so && so.product_files && so.product_files.length > 0) {
                filesToDownload = so.product_files;
            }
        }

        const uniqueFiles = Array.from(new Set(filesToDownload.filter(Boolean)));
        if (uniqueFiles.length === 0) {
            return res.status(404).json({ error: 'No dispatch files found' });
        }

        const zipFilename = `${subJobNo}_pack_file.zip`;

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

        const archive = new ZipArchive({
            zlib: { level: 9 },
            forceZip64: true
        });

        archive.on('error', (err) => {
            console.error('Archiver error:', err);
            if (!res.headersSent) res.status(500).send({ error: err.message });
        });

        archive.pipe(res);

        let fileIndex = 1;
        for (const fileUrl of uniqueFiles) {
            try {
                if (!fileUrl) continue;
                const buffer = await downloadFromR2(fileUrl);
                if (!buffer) continue;

                let filename = 'file';
                try {
                    /* global URL */
                    const parsedUrl = new URL(fileUrl);
                    filename = decodeURIComponent(parsedUrl.pathname.substring(1)).split('/').pop() || 'file';
                    // eslint-disable-next-line no-unused-vars
                } catch (e) {

                    filename = String(fileUrl).split('/').pop() || 'file';
                }
                if (filename.includes('?')) {
                    filename = filename.split('?')[0];
                }
                if (filename.includes('---')) {
                    filename = filename.split('---').slice(1).join('---');
                }

                const uniqueFilename = `${fileIndex}_${filename}`;
                archive.append(buffer, { name: uniqueFilename });
                fileIndex++;
            } catch (err) {
                console.error(`Error downloading file for zip:`, err);
            }
        }

        await archive.finalize();
    } catch (error) {
        console.error("Error in downloadDispatchFiles:", error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: "Error downloading dispatch files" });
        }
    }
};

export const updateDispatchStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, rejection } = req.body;

        let updateQuery = { $set: { dispatchFileStatus: status } };
        let logMsg = "";

        const jobData = await CtPack.findById(id);
        if (!jobData) return res.status(404).json({ success: false, message: "Job not found" });

        let uploadedUrls = [];
        if (req.files && req.files.length > 0) {
            const { uploadToR2 } = await import('../../helpers/r2helper.js');
            for (const file of req.files) {
                try {
                    const fileUrl = await uploadToR2(
                        `controltower/packing/${jobData.job_no}/${jobData.sub_job_no}/dispatch_files`,
                        file.buffer,
                        file.originalname,
                        file.mimetype
                    );
                    uploadedUrls.push(fileUrl);
                } catch (err) {
                    console.error("Failed to upload dispatch file to R2:", err);
                }
            }
        }

        if (status === "rejected" && rejection) {
            if (typeof rejection === 'string') {
                try {
                    req.body.rejection = JSON.parse(rejection);

                } catch (e) { void e; }
            }
            const rejData = req.body.rejection || rejection;

            let rejectedUrls = [];
            if (rejData.type === "existing") {
                if (jobData.dispatchFiles && jobData.dispatchFiles.length > 0) {
                    rejectedUrls = jobData.dispatchFiles;
                } else {
                    const { default: SalesOrderForm } = await import('../../models/sales_orders/sales_order_form_Model.js');
                    const so = await SalesOrderForm.findOne({ sub_job_no: jobData.sub_job_no });
                    if (so && so.product_files && so.product_files.length > 0) {
                        rejectedUrls = so.product_files.map(f => f.url || f);
                    }
                }
            } else if (rejData.type === "new" && uploadedUrls.length > 0) {
                rejectedUrls = uploadedUrls;
            }

            updateQuery.$push = {
                dispatchFileRejections: {
                    remarks: rejData.remarks,
                    type: rejData.type,
                    fileNames: rejData.fileNames || [],
                    fileUrls: rejectedUrls,
                    rejectedBy: req.user?.name || "User",
                    date: new Date()
                }
            };
            logMsg = `→ Dispatch file rejected: ${rejData.remarks}`;
        } else if (status === "approved") {
            logMsg = `→ Dispatch file approved`;
            if (uploadedUrls.length > 0) {
                if (!updateQuery.$push) updateQuery.$push = {};
                updateQuery.$push.dispatchFiles = { $each: uploadedUrls };
            }
        }

        if (logMsg) {
            if (!updateQuery.$push) updateQuery.$push = {};
            updateQuery.$push.logs = {
                type: 'DISPATCH_STATUS',
                by: req.user?.name || "User",
                date: new Date(),
                dt: new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date()),
                msg: logMsg
            };
        }

        const updatedJob = await CtPack.findByIdAndUpdate(id, updateQuery, { new: true });

        let jobObj = updatedJob.toObject();
        if (jobObj.dispatchFiles && Array.isArray(jobObj.dispatchFiles)) {
            jobObj.dispatchFiles = jobObj.dispatchFiles.map(file => {
                try {
                    return generateSignedUrl(file, 86400, true);
                    // eslint-disable-next-line no-unused-vars
                } catch (e) { return file; }

            });
        }
        if (jobObj.dispatchFileRejections && Array.isArray(jobObj.dispatchFileRejections)) {
            jobObj.dispatchFileRejections.forEach(rej => {
                if (rej.fileUrls && Array.isArray(rej.fileUrls)) {
                    rej.fileUrls = rej.fileUrls.map(url => {
                        try {
                            return generateSignedUrl(url, 86400, true);
                            // eslint-disable-next-line no-unused-vars
                        } catch (e) { return url; }
                    });
                }
            });
        }

        res.status(200).json({ success: true, message: "Status updated successfully", job: jobObj });
    } catch (error) {
        console.error("Update dispatch status error:", error);
        res.status(500).json({ success: false, message: "Error updating dispatch status: " + error.message });
    }
};