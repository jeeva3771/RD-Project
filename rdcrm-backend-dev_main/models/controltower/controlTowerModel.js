import mongoose from "mongoose";

const controlTowerSchema = new mongoose.Schema(
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
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    icon: {
      type: String,
      default: "🖥️",
    },
    accent: {
      type: String,
      default: "#0D9488",
    },
    pattern: {
      type: String,
      enum: ["A", "B", "C"],
      default: "A",
    },
    processes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "process",
      },
    ],
    primary_variable: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "rate_units",
    },
    machines: [
      {
        type: String,
        trim: true,
      },
    ],
    sub_stages: [
      {
        type: String,
        trim: true,
      },
    ],
    supervisors: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "role",
      },
    ],
    operators: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "role",
      },
    ],
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    created_at: {
      type: String,
      required: true,
    },
    updated_by: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "users",
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

export default mongoose.model("control_tower_dept", controlTowerSchema);
