import mongoose from "mongoose";

const shopFloorMaterialReturnSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true }, // Unique return tracking ID
    return_type: {
        type: String,
        enum: ["defective", "wrong_material", "excess"],
        required: true
    },
    destination: {
        type: String,
        enum: ["main_store", "local_inventory"],
        default: "main_store"
    },
    job_no: { type: String, required: true },
    shop_floor_job_id: { type: mongoose.ObjectId, ref: "shop_floor_job" },
    material_group: { type: String, required: true },
    quantity: { type: Number, required: true },
    return_by: { type: String, required: true },
    reason: { type: String },
    size: { type: String },
    size_id: { type: mongoose.Schema.Types.ObjectId, ref: "stock_sizes" },
    created_at: { type: String },
    updated_at: { type: String }
}, { timestamps: true });

shopFloorMaterialReturnSchema.index({ return_type: 1 });
shopFloorMaterialReturnSchema.index({ job_no: 1 });
shopFloorMaterialReturnSchema.index({ created_at: -1 });

export default mongoose.model("shop_floor_material_return", shopFloorMaterialReturnSchema);
