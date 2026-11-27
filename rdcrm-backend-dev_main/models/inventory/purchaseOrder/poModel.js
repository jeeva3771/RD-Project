import mongoose from "mongoose";

const poItemSchema = new mongoose.Schema(
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
    unit_id: { type: mongoose.Schema.Types.ObjectId, ref: "material_units" },
    required_qty: { type: Number, required: true, default: 0 },
    purchase_qty: { type: Number, required: true, default: 0 },
    rate: { type: Number, required: true, default: 0 },
    total: { type: Number, required: true, default: 0 },
    received_qty: { type: Number, default: 0 },
    pending_qty: { type: Number, default: 0 },
  },
  { _id: false }
);

const vendorOrderSchema = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
    vendor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "vendors",
      required: true,
    },
    vendor_name: { type: String, required: true },
    mobile_no: { type: Number },
    email: { type: String, default: "" },
    items: [poItemSchema],
    total_amount: { type: Number, required: true, default: 0 },
    share_status: {
      type: String,
      enum: ["NotShared", "Shared", "Accepted", "Rejected"],
      default: "NotShared",
    },
    order_status: {
      type: String,
      enum: ["Pending", "Dispatched", "Accepted", "Completed", "Rejected"],
      default: "Pending",
    },
    notes: { type: String, default: "" },
    terms: { type: String, default: "" },
  },
  { _id: true }
);

const purchaseOrderSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  po_number: { type: String, required: true, unique: true },
  job_number: { type: String, required: true },
  po_date: { type: String, required: true },
  expected_delivery: { type: String, default: "" },
  status: {
    type: String,
    enum: [
      "Pending",
      "Dispatched",
      "Completed",
      "Rejected",
      "Partially Received",
    ],
    default: "Pending",
  },
  vendors: [vendorOrderSchema],
  grand_total: { type: Number, required: true, default: 0 },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  created_at: { type: String, required: true },
  updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
  updated_at: { type: String },
});

export default mongoose.model("purchase_orders", purchaseOrderSchema);
