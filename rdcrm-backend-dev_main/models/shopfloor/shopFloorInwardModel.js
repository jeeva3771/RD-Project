import mongoose from "mongoose";

const shopFloorInwardSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true }, // Internal ID or MRN
    inward_number: { type: String, required: true, unique: true }, // MRN-XXXX
    job_id: { type: mongoose.ObjectId, ref: "shop_floor_job", required: true },
    job_no: { type: String },
    sub_job_no: { type: String },
    material_group_id: { type: String },
    material_name: { type: String },
    size: { type: String },
    
    inspect_qty: { type: Number, required: true },
    good_qty: { type: Number, required: true },
    bad_qty: { type: Number, required: true },
    
    operator_id: { type: mongoose.ObjectId, ref: "users" },
    operator_name: { type: String },
    recorded_by: { type: mongoose.ObjectId, ref: "users" },
    remarks: { type: String },
    
    // Detailed Material Info
    materials: [{
        material_name: String,
        rate: Number,
        sq_inch_per_unit: Number
    }],
    total_sq_inch_accepted: { type: Number, default: 0 },
    accepted_value: { type: Number, default: 0 },
    
    timestamp: { type: String }, // User-facing timestamp
    status: { type: String, enum: ['PASS', 'PARTIAL', 'REJECT'], default: 'PASS' },
    laser_return: { type: Boolean, default: false },
    
    created_at: { type: String },
    updated_at: { type: String }
}, { timestamps: true });

shopFloorInwardSchema.index({ job_id: 1 });
shopFloorInwardSchema.index({ created_at: -1 });

export default mongoose.model("shop_floor_inward", shopFloorInwardSchema);
