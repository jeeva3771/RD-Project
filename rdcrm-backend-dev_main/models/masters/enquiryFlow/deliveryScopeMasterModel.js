import mongoose from "mongoose";

const deliveryScopeMasterSchema = new mongoose.Schema(
  {
    scope_key: { type: String, required: true, trim: true, unique: true }, // local, state, domestic, intl
    title: { type: String, required: true, trim: true }, // Local delivery
    subtitle: { type: String, default: "" }, // Within Mumbai / MMR
    icon: { type: String, default: "🏙️" },
    transit_days: { type: Number, default: 0 },
    carriers: [{ type: String }], // ['Our vehicle', 'Hand delivery', 'Porter']
    is_active: { type: Boolean, default: true },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
  },
  { timestamps: true }
);

export default mongoose.model("DeliveryScopeMaster", deliveryScopeMasterSchema, "delivery_scope_masters");
