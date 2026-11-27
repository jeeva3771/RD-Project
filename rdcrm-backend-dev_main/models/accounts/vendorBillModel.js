import mongoose from "mongoose";

const vendorBillSchema = new mongoose.Schema(
  {
    vendor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "vendors",
    },
    vendor_name: {
      type: String,
      trim: true,
      default: "",
    },
    rfq_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RFQ",
    },
    po_number: {
      type: String,
      trim: true,
    },
    product_name: {
      type: String,
      trim: true,
      default: "",
    },
    challan_no: {
      type: String,
      trim: true,
      default: "",
    },
    invoice_no: {
      type: String,
      trim: true,
      required: true,
    },
    invoice_url: {
      type: String,
      default: "",
    },
    receipt_date: {
      type: Date,
      default: Date.now,
    },
    challan_url: {
      type: String,
      default: "",
    },
    received_qty: {
      type: Number,
      required: true,
    },
    paid_qty: {
      type: Number,
      default: 0,
    },
    po_unit_rate: {
      type: Number,
      default: 0,
    },
    gst_rate: {
      type: Number,
      default: 0,
    },
    payable_amount: {
      type: Number,
      required: true,
    },
    paid_amount: {
      type: Number,
      default: 0,
    },
    balance_due: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["Pending", "Partial Paid", "Paid"],
      default: "Pending",
    },
    payment_reference: {
      type: String,
      default: "",
    },
    recorded_by: {
      type: String,
      trim: true,
    },
    material: {
      type: String,
      trim: true,
      default: "",
    },
    bill_date: {
      type: Date,
      default: Date.now,
    },
    due_date: {
      type: Date,
      default: null,
    },
    scheduled_date: {
      type: Date,
      default: null,
    },
    stage: {
      type: String,
      enum: ["received", "approved", "scheduled", "partial", "paid"],
      default: "received",
      index: true,
    },
    challan_matched: {
      type: Boolean,
      default: true,
    },
    mismatch_notes: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

export default mongoose.model("vendor_bills", vendorBillSchema);


