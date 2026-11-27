import mongoose from "mongoose";

const shopfloorEMRSchema = new mongoose.Schema({
    job_no: { type: String, required: true },
    sub_job_no: { type: String, required: true },
    shopfloor_job_id: { type: mongoose.Schema.Types.ObjectId, ref: "shop_floor_job", required: true },
    group_id: { type: String, required: true },
    category: { type: String },
    subcategory: { type: String },
    operator_id: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
    operator_name: { type: String },
    department: { type: String, default: "Laser" },

    // Requested Extra Material Info
    sheet_size: { type: String, required: true },
    qty: { type: Number, required: true },
    unit: { type: String, default: "pcs" },
    urgent: { type: Boolean, default: false },
    reason: { type: String },
    recut_qty: { type: Number },
    materials: [
        {
            type: { type: String },
            material_name: { type: String },
            material_id: { type: String },
            actual_item_id: { type: String },
            stock: { type: Number },
        }
    ],

    // EMR Status Tracking
    status: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'ISSUED', 'RECEIVED', 'REJECTED'],
        default: 'PENDING'
    },
    issued_qty: { type: Number, default: 0 },
    remarks: { type: String },
    created_at: { type: String, required: true },
    updated_at: { type: String }
}, { timestamps: true });

export default mongoose.model("shopfloor_emr", shopfloorEMRSchema, "shopfloor_emr");
