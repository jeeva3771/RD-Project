import mongoose from "mongoose";

const personalisationMasterSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true, unique: true }, // e.g. Printed sticker, Metal engraved plate
    extra_cost: { type: Number, default: 0 }, // 30, 60, 90
    is_active: { type: Boolean, default: true },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "users", default: null },
  },
  { timestamps: true }
);

export default mongoose.model("PersonalisationMaster", personalisationMasterSchema, "personalisation_masters");
