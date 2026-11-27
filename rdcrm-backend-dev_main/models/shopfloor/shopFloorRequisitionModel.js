import mongoose from "mongoose";

const shopFloorRequisitionSchema = new mongoose.Schema({
    requisition_no: { type: String, required: true, unique: true },
    type: { 
        type: String, 
        enum: ["Extra Material", "Consumable", "Reprocess", "Excess Return", "Sample Material"], 
        required: true 
    },
    category: { type: String }, // e.g. Acrylic, MDF, Foam Board, Consumables, Hardware, etc.
    job_no: { type: String }, // e.g. "UV/25/1103" or "General / No specific job"
    shopfloor_job_id: { type: mongoose.Schema.Types.ObjectId, ref: "shop_floor_job" },
    group_id: { type: String },
    item_description: { type: String },
    qty: { type: Number, required: true },
    reprocess_job_qty: { type: Number },
    unit: { type: String, default: "pcs" },
    urgent: { type: Boolean, default: false },
    remarks: { type: String },
    requested_by: { type: String, default: "Operator" },
    requested_by_id: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
    department: { type: String, default: "Laser" },
    item_id: { type: mongoose.Schema.Types.ObjectId, ref: "item" },
    custom_item_id: { type: mongoose.Schema.Types.ObjectId, ref: "customItem" },
    size_id: { type: mongoose.Schema.Types.ObjectId, ref: "stock_sizes" },
    size_name: { type: String },
    status: {
        type: String,
        enum: ["PENDING", "PARTIAL", "ISSUED", "RECEIVED", "REJECTED"],
        default: "PENDING"
    },
    issued_qty: { type: Number, default: 0 },
    issued_by: { type: String },
    issued_at: { type: String },
    received_by: { type: String },
    received_at: { type: String },
    created_at: { type: String, required: true },
    updated_at: { type: String }
}, { timestamps: true });

shopFloorRequisitionSchema.index({ status: 1 });
shopFloorRequisitionSchema.index({ type: 1 });
shopFloorRequisitionSchema.index({ created_at: -1 });

export default mongoose.model("shop_floor_requisition", shopFloorRequisitionSchema, "shop_floor_requisitions");
