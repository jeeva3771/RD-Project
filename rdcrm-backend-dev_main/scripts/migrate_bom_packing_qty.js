import dotenv from "dotenv";
import connectDB from "../config/db.js";
import bomModel from "../models/bom/bomModel.js";
import dtpStudioModel from "../models/dtp_studio/dtpStudioModel.js";
import materialIssueModel from "../models/store/materialIssueModel.js";

dotenv.config({ quiet: true });

const migrateBOMPackingQty = async () => {
    try {
        await connectDB();
        console.log("Database connected for migration...");

        // 1. Process BOM Models
        const boms = await bomModel.find({});
        console.log(`Found ${boms.length} BOMs to process.`);

        let bomUpdatedCount = 0;
        for (const bom of boms) {
            let hasChanged = false;
            const jobQty = Number(bom.job_quantity || 1);

            if (bom.packingdatas && bom.packingdatas.length > 0) {
                bom.packingdatas = bom.packingdatas.map(pack => {
                    if (pack.itemType === 'logic' && (pack.total_qty === undefined || pack.total_qty === null || pack.total_qty === 0)) {
                        pack.total_qty = jobQty;
                        hasChanged = true;
                    } else if (pack.itemType !== 'logic' && (pack.total_qty === undefined || pack.total_qty === null)) {
                        pack.total_qty = Number(pack.qty || 0) * jobQty;
                        hasChanged = true;
                    }
                    return pack;
                });
            }

            if (bom.costdetails?.packingdatas) {
                bom.costdetails.packingdatas = bom.costdetails.packingdatas.map(pack => {
                    if (pack.itemType === 'logic' && (pack.total_qty === undefined || pack.total_qty === null || pack.total_qty === 0)) {
                        pack.total_qty = jobQty;
                        hasChanged = true;
                    } else if (pack.itemType !== 'logic' && (pack.total_qty === undefined || pack.total_qty === null)) {
                        pack.total_qty = Number(pack.qty || 0) * jobQty;
                        hasChanged = true;
                    }
                    return pack;
                });
            }

            if (bom.jobSheet?.packingdatas) {
                bom.jobSheet.packingdatas = bom.jobSheet.packingdatas.map(pack => {
                    if (pack.itemType === 'logic' && (pack.total_qty === undefined || pack.total_qty === null || pack.total_qty === 0)) {
                        pack.total_qty = jobQty;
                        hasChanged = true;
                    } else if (pack.itemType !== 'logic' && (pack.total_qty === undefined || pack.total_qty === null)) {
                        pack.total_qty = Number(pack.qty || 0) * jobQty;
                        hasChanged = true;
                    }
                    return pack;
                });
            }

            if (hasChanged) {
                bom.markModified('packingdatas');
                bom.markModified('costdetails');
                bom.markModified('jobSheet');
                await bom.save();
                bomUpdatedCount++;
            }
        }

        // 2. Process DTP Studio Models
        const dtpJobs = await dtpStudioModel.find({});
        console.log(`Found ${dtpJobs.length} DTP Jobs to process.`);

        let dtpUpdatedCount = 0;
        for (const job of dtpJobs) {
            let hasChanged = false;
            const jobQty = Number(job.job_quantity || 1);

            if (job.job_sheet?.packingdatas && job.job_sheet.packingdatas.length > 0) {
                job.job_sheet.packingdatas = job.job_sheet.packingdatas.map(pack => {
                    if (pack.itemType === 'logic' && (pack.total_qty === undefined || pack.total_qty === null || pack.total_qty === 0)) {
                        pack.total_qty = jobQty;
                        hasChanged = true;
                    } else if (pack.itemType !== 'logic' && (pack.total_qty === undefined || pack.total_qty === null)) {
                        pack.total_qty = Number(pack.qty || 0) * jobQty;
                        hasChanged = true;
                    }
                    return pack;
                });
            }

            if (hasChanged) {
                job.markModified('job_sheet.packingdatas');
                await job.save();
                dtpUpdatedCount++;
            }
        }

        const storeIssues = await materialIssueModel.find({});
        console.log(`Found ${storeIssues.length} Store Issues to process.`);

        let storeUpdatedCount = 0;
        for (const issue of storeIssues) {
            let hasChanged = false;
            const jobQty = Number(issue.job_quantity || 1);

            if (issue.materials && issue.materials.length > 0) {
                issue.materials = issue.materials.map(mat => {
                    if (mat.type === "Packing" && mat.specs?.includes("Type: logic") && (mat.required_qty === 0 || !mat.required_qty)) {
                        mat.required_qty = jobQty;
                        hasChanged = true;
                    } else if (mat.type === "Packing" && !mat.specs?.includes("Type: logic") && (mat.required_qty === undefined || mat.required_qty === null)) {
                        mat.required_qty = Number(mat.qty || 0) * jobQty;
                        hasChanged = true;
                    }
                    return mat;
                });
            }

            if (hasChanged) {
                issue.markModified('materials');
                await issue.save();
                storeUpdatedCount++;
            }
        }

        console.log(`Migration completed successfully.`);
        console.log(`Updated ${bomUpdatedCount} BOMs.`);
        console.log(`Updated ${dtpUpdatedCount} DTP Jobs.`);
        console.log(`Updated ${storeUpdatedCount} Store Issues.`);
        process.exit(0);
    } catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    }
};

migrateBOMPackingQty();
