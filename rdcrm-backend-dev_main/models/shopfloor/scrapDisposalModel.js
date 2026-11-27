import mongoose from "mongoose";

const scrapDisposalSchema = new mongoose.Schema({
    job_no: { type: String, required: true },
    sub_job_no: { type: String, required: true },
    group_name: { type: String, required: true },
    process_name: { type: String, required: true },
    material_name: { type: String, required: true },
    scrap_qty: { type: Number, required: true },
    disposal_method: { 
        type: String, 
        enum: ['Pending', 'Disposed', 'Sold', 'Recycled', 'Donated'], 
        default: 'Pending' 
    },
    sale_amount: { type: Number, default: 0 },
    authorised_by: { type: String, default: "" },
    remarks: { type: String, default: "" },
    disposed_at: { type: Date },
    timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model("ScrapDisposal", scrapDisposalSchema);
