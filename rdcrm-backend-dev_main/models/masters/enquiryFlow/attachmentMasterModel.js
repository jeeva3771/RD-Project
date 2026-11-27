import mongoose from "mongoose";

const attachmentMasterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: [
        "pin_back",
        "badge_fixing",
        "cufflink_closure",
        "medal_hook",
        "stand_accessory",
        "coaster_backing",
        "scroll_hardware",
        "magnet_hardware",
        "other",
      ],
      required: true,
      trim: true,
    },
    applicable_products: [
      {
        type: String,
        trim: true,
      },
    ],
    extra_cost: {
      type: Number,
      default: 0,
      min: 0,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      default: null,
    },
    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      default: null,
    },
  },
  { timestamps: true }
);

attachmentMasterSchema.index({ type: 1, name: 1 }, { unique: true });

export default mongoose.model("AttachmentMaster", attachmentMasterSchema, "attachment_masters");
