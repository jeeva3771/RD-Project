import mongoose from "mongoose";

/**
 * Bank Master — stores company bank accounts.
 * account_number stored in full; masked to last 4 digits on API responses.
 * Balance is NEVER stored here — always computed live from bank_transactions.
 */
const bankMasterSchema = new mongoose.Schema(
  {
    bank_name: {
      type: String,
      required: true,
      trim: true,
    },
    account_holder: {
      type: String,
      trim: true,
      default: "",
    },
    account_number: {
      type: String,
      required: true,
      trim: true,
    },
    ifsc_code: {
      type: String,
      trim: true,
      default: "",
    },
    account_type: {
      type: String,
      trim: true,
      enum: ["Current", "Savings", "Cash", "Cash in Hand", "OD / CC", "CC", "OD"],
      default: "Current",
    },
    branch: {
      type: String,
      trim: true,
      default: "",
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
    created_by_name: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

export default mongoose.model("bank_masters", bankMasterSchema);
