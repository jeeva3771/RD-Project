import dotenv from "dotenv";
import connectDB from "../config/db.js";
import salesorder from "../models/sales_orders/sales_order_list_Model.js";
import salesorderform from "../models/sales_orders/sales_order_form_Model.js";
import assembly_team_job from "../models/teams/assemblyTeamModel.js";

dotenv.config({ quiet: true });

const migrateAssemblyTeamJobs = async () => {
    try {
        await connectDB();
        console.log("Database connected for migration...");

        // 1. Find all pushed sales orders
        const pushedOrders = await salesorder.find({ is_pushed_shop_floor: true });
        console.log(`Found ${pushedOrders.length} pushed sales orders.`);

        let createdCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const order of pushedOrders) {
            try {
                // 2. Check if assembly job already exists
                const existingJob = await assembly_team_job.findOne({ sales_order_id: order._id });
                if (existingJob) {
                    skippedCount++;
                    continue;
                }

                // 3. Gather data from Sales Order Form (Fallback source)
                const orderForm = await salesorderform.findOne({ sample__order_id: order._id });

                if (orderForm) {
                    const jobData = {
                        job_no: order.job_no,
                        sub_job_no: order.sub_job_no,
                        client_name: orderForm?.client_name || 'N/A',
                        product_name: orderForm?.product_name || 'N/A',
                        type: order.type,
                        image: order.image,
                        qty: orderForm?.job_quantity || 0,
                        sales_order_id: order._id,
                        opQty: orderForm?.job_quantity || 0,
                        opJobCompDate: orderForm?.job_completion_datetime || '',
                        status: 'pending',
                        is_active: true
                    };

                    // 5. Create Assembly Team Job
                    const newJob = new assembly_team_job(jobData);
                    await newJob.save();
                    createdCount++;
                }
            } catch (err) {
                console.error(`Error processing Order ${order.sub_job_no}:`, err.message);
                errorCount++;
            }
        }

        console.log(`Migration completed.`);
        console.log(`Created: ${createdCount}`);
        console.log(`Skipped (already exists): ${skippedCount}`);
        console.log(`Errors: ${errorCount}`);
        process.exit(0);
    } catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    }
};

migrateAssemblyTeamJobs();
