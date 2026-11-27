import mongoose from "mongoose";

// Process Schema
const processSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    service_category: {
      type: mongoose.ObjectId,
      required: true,
      ref: 'service_category'
    },
    type: {
      type: String,
      enum: ["Both", "In House", "Out Source"],
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    department: [{
      type: mongoose.ObjectId,
      ref: 'department',
    }],
    machine: [{
      type: mongoose.ObjectId,
      ref: 'machine',
    }],
    available_vendors: [{
      type: mongoose.ObjectId,
      ref: 'vendors',
    }],
    has_custom_input: {
      type: Boolean,
      default: false,
    },
    unit_type: {
      type: [String],
      trim: true,
    },
    unit: [{
      type: mongoose.ObjectId,
      ref: 'unit',
    }],
    variables: [
      {
        key: { type: String, trim: true },
        label: { type: String, trim: true },
        allowed_values: [{ type: String }],
        is_rate_variable: { type: Boolean, default: false },
        is_size_variable: { type: Boolean, default: false },
      }
    ],
    additional_columns: [{
      type: mongoose.ObjectId,
      ref: 'processcolumn',
    }],
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

export default mongoose.model("process", processSchema);
