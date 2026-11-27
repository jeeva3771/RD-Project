import dotenv from "dotenv";
import connectDB from "../config/db.js";
import RFQ from "../models/rfq/rfqModel.js";
import StoreMaterialIssue from "../models/store/materialIssueModel.js";
import InwardRecord from "../models/inventory/stockInward/StockInwardModel.js";
import MaterialPurchaseRequest from "../models/store/materialPurchaseRequestModel.js";
import Enquiry from "../models/enquiry/enquiryModel.js";

dotenv.config({ quiet: true });

const backfillReferenceNo = async () => {
    try {
        await connectDB();
        console.log("Database connected for backfilling reference numbers...");

        const models = [
            { model: RFQ, name: "RFQ", jobField: "jobNo" },
            { model: StoreMaterialIssue, name: "StoreMaterialIssue", jobField: "job_no" },
            { model: InwardRecord, name: "InwardRecord", jobField: "job_number" },
            { model: MaterialPurchaseRequest, name: "MaterialPurchaseRequest", jobField: "job_no" }
        ];

        // Cache for enquiris to avoid redundant DB calls
        const enquiryCache = new Map();

        for (const item of models) {
            // Find records where reference_no is missing or empty
            const records = await item.model.find({ 
                $or: [
                    { reference_no: { $exists: false } },
                    { reference_no: "" },
                    { reference_no: null }
                ]
            });
            console.log(`Processing ${records.length} records for ${item.name}...`);

            let updatedCount = 0;
            for (const record of records) {
                let jobNo = record[item.jobField];
                
                // Special handling for MaterialPurchaseRequest which might not have job_no directly
                if (!jobNo && item.name === "MaterialPurchaseRequest") {
                   // Try to find job number in purpose of items
                   if (record.items && record.items.length > 0) {
                       for (const it of record.items) {
                           if (it.purpose) {
                               const match = it.purpose.match(/\d{5,}/); // Look for 5+ digit number
                               if (match) {
                                   jobNo = match[0];
                                   break;
                               }
                           }
                       }
                   }
                }

                if (!jobNo) continue;

                let referenceNo = enquiryCache.get(jobNo);
                if (!referenceNo) {
                    const enquiry = await Enquiry.findOne({ job_no: jobNo });
                    if (enquiry && enquiry.reference_no) {
                        referenceNo = enquiry.reference_no;
                        enquiryCache.set(jobNo, referenceNo);
                    }
                }

                if (referenceNo) {
                    record.reference_no = referenceNo;
                    await record.save();
                    updatedCount++;
                }
            }
            console.log(`Updated ${updatedCount} records for ${item.name}.`);
        }

        console.log("Backfill completed successfully.");
        process.exit(0);
    } catch (error) {
        console.error("Backfill failed:", error);
        process.exit(1);
    }
};

backfillReferenceNo();
