import materialIssueModel from "../../models/store/materialIssueModel.js";
import bomModel from "../../models/bom/bomModel.js";
import shopFloorEMRModel from "../../models/shopfloor/shopFloorEMRModel.js";
import salesorderModel from "../../models/sales_orders/sales_order_list_Model.js";

export const getBomAnalysis = async (req, res) => {
    try {
        const { page = 1, limit = 10, search } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        let query = {};
        if (search) {
            query.$or = [
                { sub_job_no: { $regex: new RegExp(search, 'i') } },
                { job_no: { $regex: new RegExp(search, 'i') } },
                { client_name: { $regex: new RegExp(search, 'i') } },
                { product_name: { $regex: new RegExp(search, 'i') } }
            ];
        }

        const { filterType, filterValue } = req.query;
        if (filterType && filterType !== 'all' && filterValue) {
            let startDate, endDate;
            
            if (filterType === 'today') {
                const [year, month, day] = filterValue.split('-');
                startDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                endDate.setHours(23, 59, 59, 999);
            } else if (filterType === 'week') {
                const parts = filterValue.split('-W');
                const y = parseInt(parts[0]);
                const w = parseInt(parts[1]);
                
                const simple = new Date(y, 0, 1 + (w - 1) * 7);
                const dow = simple.getDay();
                const ISOweekStart = simple;
                if (dow <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
                else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
                
                startDate = new Date(ISOweekStart);
                startDate.setHours(0, 0, 0, 0);
                
                endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 6);
                endDate.setHours(23, 59, 59, 999);
                
            } else if (filterType === 'month') {
                const [year, month] = filterValue.split('-');
                startDate = new Date(parseInt(year), parseInt(month) - 1, 1);
                endDate = new Date(parseInt(year), parseInt(month), 0);
                endDate.setHours(23, 59, 59, 999);
                
            } else if (filterType === 'fy') {
                const startYear = parseInt(filterValue);
                startDate = new Date(startYear, 3, 1); // April 1
                endDate = new Date(startYear + 1, 2, 31); // March 31
                endDate.setHours(23, 59, 59, 999);
            }

            if (startDate && endDate) {
                const dateQuery = { 
                    $gte: startDate,
                    $lte: endDate
                };
                
                // Fetch sub_job_nos from salesorder based on its created_at
                const matchingSOs = await salesorderModel.find({ 
                    $or: [
                        { created_at: dateQuery },
                        { createdAt: dateQuery } // Fallback to Mongoose timestamp if needed
                    ]
                }).select('sub_job_no').lean();
                
                const validSubJobs = matchingSOs.map(so => so.sub_job_no);
                
                // Apply the sub_job_no filter to the main query
                if (query.sub_job_no) {
                    // If a search filter already set sub_job_no, intersect them
                    query.sub_job_no = { $in: validSubJobs, ...query.sub_job_no };
                } else {
                    query.sub_job_no = { $in: validSubJobs };
                }
            }
        }

        // 1. Fetch minimal EMRs globally (extremely fast, no massive $in clauses)
        const allEMRs = await shopFloorEMRModel.find({
            status: { $in: ['APPROVED', 'RECEIVED', 'ISSUED'] }
        }).select('sub_job_no qty reason created_at createdAt materials.material_name').lean();

        const globalEmrMap = {};
        allEMRs.forEach(emr => {
            if (!globalEmrMap[emr.sub_job_no]) globalEmrMap[emr.sub_job_no] = {};
            const emrQty = Number(emr.qty) || 0;
            const emrReason = emr.reason || 'Extra material requested';
            const emrDate = emr.created_at || (emr.createdAt ? new Date(emr.createdAt).toLocaleDateString() : '-');

            if (emr.materials && Array.isArray(emr.materials)) {
                emr.materials.forEach(m => {
                    if (m.material_name) {
                        if (!globalEmrMap[emr.sub_job_no][m.material_name]) {
                            globalEmrMap[emr.sub_job_no][m.material_name] = { totalQty: 0, breakdowns: [] };
                        }
                        globalEmrMap[emr.sub_job_no][m.material_name].totalQty += emrQty;
                        globalEmrMap[emr.sub_job_no][m.material_name].breakdowns.push({ 
                            qty: emrQty, 
                            reason: emrReason, 
                            date: emrDate, 
                            sub_job_no: emr.sub_job_no 
                        });
                    }
                });
            }
        });

        // 2. Calculate Metrics using minimal fields (saves huge amounts of memory)
        const allIssuesMinimal = await materialIssueModel.find({ ...query, "materials.material_type": "sheet" })
            .select('sub_job_no materials.material_type materials.required_qty materials.issued_qty materials.material_name')
            .lean();

        let metrics = { totalJobs: allIssuesMinimal.length, overBom: 0, underBom: 0, exactBom: 0 };

        allIssuesMinimal.forEach(issue => {
            if (!issue.materials || !Array.isArray(issue.materials)) return;

            issue.materials.forEach(mat => {
                if (mat.material_type === 'sheet') {
                    const bomQty = Number(mat.required_qty) || 0;
                    let actQty = Number(mat.issued_qty) || 0;

                    const matName = mat.material_name;
                    if (globalEmrMap[issue.sub_job_no] && globalEmrMap[issue.sub_job_no][matName]) {
                        actQty += globalEmrMap[issue.sub_job_no][matName].totalQty;
                    }

                    if (actQty > 0) {
                        const diff = actQty - bomQty;
                        if (diff > 0) metrics.overBom++;
                        else if (diff < 0) metrics.underBom++;
                        else metrics.exactBom++;
                    }
                }
            });
        });

        // 3. Database-level Pagination using Aggregation Framework (Job-wise)
        const countPipeline = [
            { $match: { ...query, "materials.material_type": "sheet" } },
            { $count: "total" }
        ];
        const countResult = await materialIssueModel.aggregate(countPipeline);
        const totalCount = countResult.length > 0 ? countResult[0].total : 0;

        const dataPipeline = [
            { $match: { ...query, "materials.material_type": "sheet" } },
            { $sort: { createdAt: -1, _id: -1 } },
            { $skip: skip },
            { $limit: limitNum },
            { $unwind: "$materials" },
            { $match: { "materials.material_type": "sheet" } }
        ];
        const paginatedIssues = await materialIssueModel.aggregate(dataPipeline);

        // 4. Fetch BOM names only for the current paginated rows
        const pageSubJobNos = [...new Set(paginatedIssues.map(i => i.sub_job_no))];
        const boms = await bomModel.find({ sub_job_no: { $in: pageSubJobNos } })
            .select('sub_job_no client_name product_name job_quantity').lean();

        const bomMap = {};
        boms.forEach(b => bomMap[b.sub_job_no] = b);

        // 5. Map final response
        const paginatedRows = paginatedIssues.map(issue => {
            const bom = bomMap[issue.sub_job_no];
            const mat = issue.materials; // Because of $unwind, this is a single material object

            const bomQty = Number(mat.required_qty) || 0;
            let actQty = Number(mat.issued_qty) || 0;

            const matName = mat.material_name;
            let emrInfo = '';
            let emrBreakdowns = [];
            if (globalEmrMap[issue.sub_job_no] && globalEmrMap[issue.sub_job_no][matName]) {
                const emrData = globalEmrMap[issue.sub_job_no][matName];
                actQty += emrData.totalQty;
                emrBreakdowns = emrData.breakdowns;
                emrInfo = ` (+${emrData.totalQty} EMR)`;
            }

            let diff = 0;
            let pct = 0;
            let st = '-';
            let reason = '-';

            if (actQty > 0) {
                diff = actQty - bomQty;
                pct = bomQty > 0 ? (diff / bomQty) * 100 : 0;
                if (diff > 0) {
                    st = 'over';
                    reason = `Excess material issued${emrInfo}`;
                } else if (diff < 0) {
                    st = 'under';
                    reason = '-';
                } else {
                    st = 'exact';
                    reason = '-';
                }
            }

            return {
                id: issue.sub_job_no || issue.job_no,
                client: issue.client_name || (bom ? bom.client_name : 'Unknown'),
                product: issue.product_name || (bom ? bom.product_name : 'Unknown'),
                qty: issue.job_quantity || (bom ? bom.job_quantity : 0),
                mat: mat.material_name,
                bom: parseFloat(bomQty.toFixed(2)),
                act: parseFloat(actQty.toFixed(2)),
                diff: parseFloat(diff.toFixed(2)),
                pct: parseFloat(pct.toFixed(1)),
                st: st,
                reason: reason,
                emrBreakdowns
            };
        });

        const groupedData = [];
        paginatedRows.forEach(row => {
            let group = groupedData.find(g => g.id === row.id);
            if (!group) {
                group = { id: row.id, client: row.client, product: row.product, qty: row.qty, materials: [] };
                groupedData.push(group);
            }
            group.materials.push({
                mat: row.mat,
                bom: row.bom,
                act: row.act,
                diff: row.diff,
                pct: row.pct,
                st: row.st,
                reason: row.reason,
                emrBreakdowns: row.emrBreakdowns
            });
        });

        return res.status(200).json({
            success: true,
            data: groupedData,
            totalCount: totalCount,
            metrics
        });

    } catch (error) {
        console.error("getBomAnalysis error:", error);
        return res.status(500).json({ success: false, message: "Server error during BOM analysis", error: error.message });
    }
};
