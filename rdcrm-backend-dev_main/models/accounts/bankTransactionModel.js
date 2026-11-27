import mongoose from "mongoose";

/**
 * Bank Transaction — every credit/debit against a bank_master account.
 * Balance = SUM(credits) - SUM(debits) per bank_id.
 */
const bankTransactionSchema = new mongoose.Schema(
  {
    bank_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "bank_masters",
      required: true,
      index: true,
    },
    bank_name: { type: String, default: "" },
    account_number_masked: { type: String, default: "" },
    type: {
      type: String,
      enum: ["credit", "debit"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    // Reference to source payment record
    reference_id: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    reference_type: {
      type: String,
      enum: ["client_payment", "vendor_payment", "manual", "opening_balance", "ClientPayment", "VendorPayment", "OpeningBalance"],
      default: "manual",
    },
    sub_job_no: { type: String, default: "" },
    party_name: { type: String, default: "" },
    // Human readable context
    description: {
      type: String,
      trim: true,
      default: "",
    },
    txn_date: {
      type: Date,
      default: Date.now,
      index: true,
    },
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

export default mongoose.model("bank_transactions", bankTransactionSchema);
