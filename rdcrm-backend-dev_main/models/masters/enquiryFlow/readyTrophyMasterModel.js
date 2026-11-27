import mongoose from "mongoose";

const readyTrophySizeSchema = new mongoose.Schema(
  {
    size: { type: Number, required: true },
    rate: { type: Number, required: true },
    stock: { type: Number, default: 0 },
  },
  { _id: false }
);

const readyTrophyMasterSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true, unique: true }, // RT-101
    name: { type: String, required: true, trim: true }, // Victory Cup, gold
    icon: { type: String, default: "🏆" },
    rate: { type: Number, default: 0 },
    sizes: [readyTrophySizeSchema],
    is_active: { type: Boolean, default: true },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
  },
  { timestamps: true }
);

export default mongoose.model("ReadyTrophyMaster", readyTrophyMasterSchema, "ready_trophy_masters");
