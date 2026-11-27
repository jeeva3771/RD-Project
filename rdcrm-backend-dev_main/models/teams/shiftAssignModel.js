import mongoose from "mongoose";
import { nanoid } from "nanoid";

const shiftAssignmentSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      default: () => nanoid(16),
      index: { unique: true },
    },
    user_id: {
      type: mongoose.ObjectId,
      ref: "users",
      required: true,
    },
    department_id: {
      type: mongoose.ObjectId,
      ref: "department",
      required: true,
    },
    shift_time_id: {
      type: mongoose.ObjectId,
      ref: "shift_time",
      required: true,
    },
    remarks: {
      type: String,
      trim: true,
      default: "",
    },
    assigned_by: {
      type: mongoose.ObjectId,
      ref: "users",
      required: true,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    created_at: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true, 
  }
);

export default mongoose.model("shift_assignment", shiftAssignmentSchema);