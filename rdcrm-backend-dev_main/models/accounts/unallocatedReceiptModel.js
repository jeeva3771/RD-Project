import mongoose from "mongoose";

const allocationEntrySchema = new mongoose.Schema(
  {
    invoice_id: {
      type: String,
      default: "",
    },
    invoice_no: {
      type: String,
      default: "",
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    allocated_at: {
      type: Date,
      default: Date.now,
    },
    allocated_by: {
      type: String,
      default: "Accounts Team",
    },
  },
  { _id: true }
);

const unallocatedReceiptSchema = new mongoose.Schema(
  {
    receipt_no: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    client_name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    client_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "customer",
      default: null,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    mode: {
      type: String,
      default: "NEFT",
      trim: true,
    },
    reference_no: {
      type: String,
      default: "",
      trim: true,
    },
    payment_date: {
      type: Date,
      default: Date.now,
    },
    date_label: {
      type: String,
      default: "",
    },
    confirmed_by: {
      type: String,
      default: "Accounts Team",
      trim: true,
    },
    allocations: [allocationEntrySchema],
    notes: {
      type: String,
      default: "",
    },
    attachment: {
      type: String,
      default: "",
      trim: true,
    },
    attachment_name: {
      type: String,
      default: "",
      trim: true,
    },
    attachments: [
      {
        url: { type: String, default: "", trim: true },
        name: { type: String, default: "", trim: true },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("unallocated_receipts", unallocatedReceiptSchema);
