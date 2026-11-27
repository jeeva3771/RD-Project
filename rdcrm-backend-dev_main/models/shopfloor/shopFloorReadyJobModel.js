import mongoose from "mongoose";

const cycleSchema = new mongoose.Schema({
    // Cycle info
    cycle_number: { type: Number },
    good_qty: { type: Number, default: 0 },
    bad_qty: { type: Number, default: 0 },
    completed_at: { type: String },
    completed_by_name: { type: String },
    completed_by: { type: mongoose.Schema.Types.ObjectId, ref: "users" },

    // Outsource tracking
    is_outsource: { type: Boolean, default: false },
    vendor_name: { type: String },

    // Handover tracking
    handed_over: { type: Boolean, default: false },
    handover_to_department: { type: String },
    handover_to_receiver: { type: String },
    handover_at: { type: String },
    handover_by: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
    handover_by_name: { type: String }
});

const lineItemSchema = new mongoose.Schema({
    // Line item identity
    group_id: { type: String, required: true },
    material_name: { type: String },
    material_specs: { type: String },

    // Array of cycles representing all handed-over cycles for this line item
    cycles: [cycleSchema]
});

const readyJobSchema = new mongoose.Schema({
    // Parent reference (unique per shopfloor job)
    shopfloor_job_id: { type: mongoose.Schema.Types.ObjectId, ref: "shop_floor_job", required: true, unique: true },

    // Job identity
    job_no: { type: String, required: true },
    sub_job_no: { type: String },
    process_name: { type: String },
    department: { type: String },
    client_name: { type: String },

    // Array of line items
    line_items: [lineItemSchema]
}, { timestamps: true });

export default mongoose.model("ready_job", readyJobSchema);
