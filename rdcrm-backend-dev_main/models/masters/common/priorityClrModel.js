import mongoose from "mongoose";

const PriorityClrSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true, trim: true },
  is_active: { type: Boolean, default: true },
  priority: {
    days_from: { type: Number, required: true },
    days_to: { type: Number, required: true },
    color: { type: String, required: true },
  },
  created_at: { type: String, required: true },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
  updated_at: { type: String },
  updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
},
  {
    timestamps: true,
  },);

export default mongoose.model("priority_Clr", PriorityClrSchema);
