import mongoose from "mongoose";

const elementMasterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    icon: { type: String, default: "⚙️" },
    extra_cost: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
  },
  { timestamps: true }
);

export default mongoose.model("ElementMaster", elementMasterSchema, "element_masters");
