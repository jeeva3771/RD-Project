import mongoose from "mongoose";

const blockedMaterialSchema = new mongoose.Schema(
  {
    sales_order_id: { type: mongoose.Schema.Types.ObjectId, ref: "salesorder", required: true },
    job_no: { type: String },
    item_id: { type: mongoose.Schema.Types.ObjectId, ref: "item", required: true },
    materialId: { type: String, required: true }, // nanoid from BOM
    material_name: { type: String },
    sheet_size: { type: String },
    sheet_size_id: { type: mongoose.Schema.Types.ObjectId },
    quantity: { type: Number, required: true },
    unit: { type: String },
    blocked_by: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
    blocked_at: { type: String, required: true },
    status: { type: String, enum: ["blocked", "released", "consumed"], default: "blocked" },
  },
  { timestamps: true }
);

export default mongoose.model("blocked_material", blockedMaterialSchema);
