import mongoose from "mongoose";

// Bed Sub Schema
const bedSchema = new mongoose.Schema(
  {
    bed_id: {
      type: String,
      required: true,
      trim: true,
    },
    width: {
      type: Number,
      required: true,
      min: 0,
    },
    height: {
      type: Number,
      required: true,
      min: 0,
    },
    bed_area: {
      type: Number,
      required: true,
      min: 0,
    },
    rate: {
      type: Number,
      required: true,
      min: 0,
    },
    min_cycle_cost: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

// Process Schema
const processSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    rate: {
      type: Number,
      required: true,
      min: 0
    },

    // this rate only use if the job qty below 25
    min_rate_slab_1: {
      type: Number,
      min: 0,
    },
    // this rate only use if the job qty 1 to 5
    min_rate_slab_2: {
      type: Number,
      min: 0,
    },

    type: {
      type: String,
      required: true,
      enum: [
        "sheet_time_based",
        "sheet_rate_based",
        "job_absolute_area",
        "standard_unit",
        "ups_based"
      ]
    },

    unit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "rate_units",
      required: true,
    },

    department: {
      type: String,
      required: true,
      trim: true,
    },

    linked_department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "department",
    },

    prompt: {
      type: String,
      trim: true,
    },

    is_active: {
      type: Boolean,
      default: true,
    },

    is_outsource_open: {
      type: Boolean,
      default: false,
    },

    // 🔥 NEW FIELDS (UV SUPPORT)

    is_uv: {
      type: Boolean,
      default: false,
    },

    mov: {
      type: Number,
      min: 0,
      default: 0,
    },

    beds: [bedSchema], // Array of bed configs

    // Existing audit fields
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
