import mongoose from "mongoose";

const stockLedgerSchema = new mongoose.Schema(
  {
    item_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "item",
      required: true,
      index: true
    },
    item_code: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    item_name: {
      type: String,
      required: true,
      trim: true
    },
    unit: {
      type: String,
      default: "pcs"
    },
    date: {
      type: Date,
      default: Date.now,
      index: true
    },
    type: {
      type: String,
      enum: ["OPENING", "INWARD", "ISSUE", "RETURN", "ADJUSTMENT"],
      required: true,
      index: true
    },
    ref_type: {
      type: String,
      enum: ["STORE_ISSUE", "INWARD_RECEIPT", "INITIAL_SEED", "MANUAL_ADJUSTMENT"],
      default: "MANUAL_ADJUSTMENT"
    },
    ref_id: {
      type: String,
      default: ""
    },
    job_no: {
      type: String,
      default: ""
    },
    sub_job_no: {
      type: String,
      default: ""
    },
    qty_in: {
      type: Number,
      default: 0
    },
    qty_out: {
      type: Number,
      default: 0
    },
    balance_after: {
      type: Number,
      required: true
    },
    cost_per_unit: {
      type: Number,
      default: 0
    },
    total_value: {
      type: Number,
      default: 0
    },
    location: {
      type: String,
      default: "G-1"
    },
    remarks: {
      type: String,
      default: ""
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users"
    }
  },
  {
    timestamps: true
  }
);

stockLedgerSchema.index({ item_id: 1, date: 1 });
stockLedgerSchema.index({ date: -1 });

export default mongoose.model("stock_ledger", stockLedgerSchema, "stock_ledgers");
