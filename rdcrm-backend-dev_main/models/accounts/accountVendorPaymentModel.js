import mongoose from "mongoose";

const accountVendorPaymentSchema = new mongoose.Schema(
  {
    vendor_id: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    vendor_name: {
      type: String,
      trim: true,
      default: "",
    },
    bill_no: {
      type: String,
      trim: true,
      index: true,
      default: "",
    },
    assignment_id: {
      type: String,
      trim: true,
      default: "",
    },
    job_no: {
      type: String,
      trim: true,
      index: true,
      default: "",
    },
    sub_job_no: {
      type: String,
      trim: true,
      index: true,
      default: "",
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paid_qty: {
      type: Number,
      default: 0,
    },
    total_amount: {
      type: Number,
      default: 0,
    },
    tds_section: {
      type: String,
      trim: true,
      default: "",
    },
    tds_rate: {
      type: Number,
      default: 0,
      min: 0,
    },
    tds_amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    gross_amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    gst_rate: {
      type: Number,
      default: 0,
      min: 0,
    },
    gst_amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    payment_mode: {
      type: String,
      trim: true,
      default: "Bank Transfer (NEFT/RTGS)",
    },
    bank_account_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "bank_masters",
      default: null,
    },
    bank_account_label: {
      // Snapshot: "ICICI Bank ••••5678" stored for audit trail
      type: String,
      trim: true,
      default: "",
    },
    payment_date: {
      type: Date,
      default: Date.now,
    },
    reference_no: {
      type: String,
      trim: true,
      default: "",
    },
    cash_voucher_no: {
      type: String,
      trim: true,
      default: "",
    },
    cash_paid_to: {
      type: String,
      trim: true,
      default: "",
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    attachment: {
      type: String,
      trim: true,
      default: "",
    },
    attachment_name: {
      type: String,
      trim: true,
      default: "",
    },
    attachments: [
      {
        url: {
          type: String,
          trim: true,
        },
        name: {
          type: String,
          trim: true,
        },
      },
    ],
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      default: null,
    },
    created_by_name: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

export default mongoose.model("account_vendor_payments", accountVendorPaymentSchema);
