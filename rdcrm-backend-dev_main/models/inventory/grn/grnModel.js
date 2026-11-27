import mongoose from "mongoose";

const grnItemSchema = new mongoose.Schema(
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
    remarks: { type: String, default: "" },
  },
  { _id: false }
);

const grnSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    grn_number: { type: String, required: true, unique: true }, // GRN001 etc.
    po_number: { type: String, required: true }, // Reference to PO
    job_number: { type: String, required: true }, // Related Job/Project
    vendor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "vendors",
      required: true,
    },
    vendor_name: { type: String, required: true },
    invoice_no: { type: String, default: "" },
    challan_no: { type: String, default: "" },
    min_no: { type: String, default: "" }, // Material Inward Note number
    date: { type: String, required: true },
    items: [grnItemSchema], // Array of items with received & rejected qty
    qc_status: {
      type: String,
      enum: ["Pending", "Completed", "Rejected"],
      default: "Completed",
    },
    status: {
      type: String,
      enum: ["Pending", "Completed", "Partially Received"],
      default: "Completed",
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    created_at: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

// Optional indexes for faster reports
grnSchema.index({ po_number: 1 });
grnSchema.index({ vendor_id: 1 });
grnSchema.index({ date: -1 });

export default mongoose.model("grn_records", grnSchema);
