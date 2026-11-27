import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Import Models
import AssemblyTeamJob from '../models/teams/assemblyTeamModel.js';
import SalesOrder from '../models/sales_orders/sales_order_list_Model.js';
import Enquiry from '../models/enquiry/enquiryModel.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../.env') });

const updateAssemblyJobs = async () => {
    try {
        if (!process.env.DB_URL) {
            throw new Error('DB_URL not found in .env file');
        }

        await mongoose.connect(process.env.DB_URL);
        console.log('Connected to MongoDB');

        // Find assembly jobs that are missing enquiry_id or reference_no
        const assemblyJobs = await AssemblyTeamJob.find({
            $or: [
                { enquiry_id: { $exists: false } },
                { enquiry_id: null },
                { reference_no: { $exists: false } },
                { reference_no: "" },
                { reference_no: null }
            ]
        });

        console.log(`Found ${assemblyJobs.length} assembly jobs to check/update`);

        let updatedCount = 0;

        for (const job of assemblyJobs) {
            try {
                // Find the associated Sales Order
                const salesOrder = await SalesOrder.findById(job.sales_order_id);
                if (!salesOrder) {
                    console.warn(`[WARN] Sales Order not found for Assembly Job: ${job.job_no}/${job.sub_job_no}`);
                    continue;
                }

                // Find the associated Enquiry
                const enquiry = await Enquiry.findById(salesOrder.enquiry_id);
                if (!enquiry) {
                    console.warn(`[WARN] Enquiry not found for Sales Order: ${salesOrder.job_no}/${salesOrder.sub_job_no}`);
                    continue;
                }

                // Update fields
                job.enquiry_id = salesOrder.enquiry_id;
                job.reference_no = enquiry.reference_no || "";
                
                await job.save();
                console.log(`[SUCCESS] Updated Job: ${job.job_no}/${job.sub_job_no} (Ref: ${job.reference_no})`);
                updatedCount++;
            } catch (err) {
                console.error(`[ERROR] Failed to update Job: ${job.job_no}/${job.sub_job_no}:`, err.message);
            }
        }

        console.log(`\nMigration complete. Updated ${updatedCount} jobs.`);
        process.exit(0);
    } catch (error) {
        console.error('CRITICAL ERROR during migration:', error);
        process.exit(1);
    }
};

updateAssemblyJobs();
