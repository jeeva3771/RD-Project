import mongoose from "mongoose";

const accountPaymentSchema = new mongoose.Schema(
  {
    sub_job_no: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    job_no: {
      type: String,
      trim: true,
      index: true,
      default: "",
    },
    client_name: {
      type: String,
      trim: true,
      default: "",
    },
    invoice_id: {
      type: String,
      trim: true,
      default: "",
    },
    invoice_no: {
      type: String,
      trim: true,
      default: "",
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    tds_amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    tds_rate: {
      type: Number,
      default: 0,
      min: 0,
    },
    gross_amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    tds_tax: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "tax_masters",
      default: null,
    },
    total_payable: {
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
      // Snapshot: "HDFC Bank ••••1234" stored for audit trail
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
    receipt_no: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    cash_voucher_no: {
      type: String,
      trim: true,
      default: "",
    },
    cash_collected_by: {
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
          default: "",
        },
        name: {
          type: String,
          trim: true,
          default: "",
        },
      },
    ],
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
    },
    created_by_name: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("account_payments", accountPaymentSchema);
