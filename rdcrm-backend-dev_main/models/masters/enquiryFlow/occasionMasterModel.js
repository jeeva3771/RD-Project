import mongoose from "mongoose";

const occasionMasterSchema = new mongoose.Schema(
  {
    group_id: { type: mongoose.Schema.Types.ObjectId, ref: "OccasionGroupMaster", required: true },
    name: { type: String, required: true, trim: true }, // Annual awards, Diwali, etc.
    icon: { type: String, default: "🎯" },
    is_active: { type: Boolean, default: true },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
  },
  { timestamps: true }
);

occasionMasterSchema.index({ group_id: 1, name: 1 }, { unique: true });

export default mongoose.model("OccasionMaster", occasionMasterSchema, "occasion_masters");
