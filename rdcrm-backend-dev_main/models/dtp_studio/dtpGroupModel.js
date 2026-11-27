import mongoose from "mongoose";

const dtpGroupSchema = new mongoose.Schema({
    folder_name: { type: String, required: true },
    job_no: { type: String, required: true },
    enquiry_id: { type: mongoose.ObjectId, ref: "enquiry", required: true },
    assigned_to: { type: mongoose.ObjectId, ref: "users" },
    assigned_to_name: { type: String },
    jobs: [{ type: mongoose.ObjectId, ref: "dtp_studio" }],
    status: {
        type: String,
        enum: ['Pending', 'Assigned', 'Master Template', 'Content Proofing', 'Final Prep', 'Push to Shop Floor', 'Completed', 'Reprocess', 'Hold'],
        default: 'Pending'
    },
    is_on_hold: { type: Boolean, default: false },
    hold_history: [
        {
            reason: String,
            start_time: String,
            end_time: String,
            hold_by: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "users",
            },
            unhold_by: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "users",
            },
        }
    ],
    created_by: { type: mongoose.ObjectId, ref: "users" },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

export default mongoose.model("dtp_group", dtpGroupSchema);
