import mongoose from "mongoose";

const occasionGroupMasterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    icon: { type: String, default: "📁", trim: true },
    description: { type: String, default: "", trim: true },
    sort_order: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
  },
  { timestamps: true }
);

export default mongoose.model("OccasionGroupMaster", occasionGroupMasterSchema, "occasion_group_masters");

