import mongoose from "mongoose";

// Rate Card Schema
const rateCardSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    process_id: {
      type: mongoose.ObjectId,
      ref: 'process',
      required: true,
    },
    rate_unit: {
      type: String,
      trim: true,
    },
    variable_rates: [
      {
        type: Object,
        required: true,
      }
    ],
    is_internal: {
      type: Boolean,
      default: false,
    },
    vendor: {
      type: mongoose.ObjectId,
      ref: 'vendors',
      required: function () {
        return !this.is_internal;
      },
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    remarks: { type: String, trim: true },
    created_by: {
      type: mongoose.ObjectId,
      ref: 'users',
      required: true,
    },
    created_at: {
      type: String,
      required: true,
    },
    updated_by: [
      {
        user: {
          type: mongoose.ObjectId,
          ref: 'users',
        },
        date: String,
      },
    ],
    updated_at: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("ratecard", rateCardSchema);
