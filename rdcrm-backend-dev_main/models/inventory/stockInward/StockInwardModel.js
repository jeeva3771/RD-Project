import mongoose from "mongoose";

const inwardItemSchema = new mongoose.Schema(
  {
    item_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "item",
      required: true,
    },
    item_code: { type: String, required: true },
    name: { type: String, required: true },
    category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "material_categories",
    },
    unit_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "material_units",
    },
    qty_received: { type: Number, required: true, default: 0 },
    qty_rejected: { type: Number, required: true, default: 0 },
    qc_status: {
      type: String,
      enum: ["Completed", "Pending", "Reject"],
      default: "Pending",
    },
    remarks: { type: String, default: "" },
  },
  { _id: false }
);

const inwardSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    inward_number: { type: String, required: true, unique: true }, // e.g., INW001
    po_number: { type: String, required: true }, // link to Purchase Order
    job_number: { type: String, required: true }, // related job/project
    reference_no: { type: String }, // link to Enquiry reference
    vendor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "vendors",
      required: true,
    },
    vendor_name: { type: String, required: true },
    invoice_no: { type: String, default: "" },
    challan_no: { type: String, default: "" },
    min_no: { type: String, default: "" },
    date: { type: String, required: true },
    items: [inwardItemSchema],
    inward_status: {
      type: String,
      enum: ["Pending", "Completed", "Partially Received"],
      default: "Completed",
    },
    qc_required: { type: Boolean, default: false },
    remarks: { type: String, default: "" },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    created_at: { type: String, required: true },
    updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
    updated_at: { type: String },
  },
  {
    timestamps: true,
  }
);

// Helpful indexes for reporting
inwardSchema.index({ po_number: 1 });
inwardSchema.index({ vendor_id: 1 });
inwardSchema.index({ date: -1 });

export default mongoose.model("inward_records", inwardSchema);
