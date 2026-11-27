import mongoose from "mongoose";

const assemblyTeamSchema = new mongoose.Schema(
  {
    job_no: { type: String, required: true },
    sub_job_no: { type: String },
    reference_no: { type: String },
    client_name: { type: String },
    product_name: { type: String },
    type: { type: String }, // Job type (Sample, Production, etc.)
    image: { type: String },
    qty: { type: Number, required: true },
    start_date_time: { type: Date },
    end_date_time: { type: Date },
    sales_order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "salesorder", // Corrected ref based on sales_order_list_Model.js
      required: true
    },
    enquiry_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "enquiry",
    },
    team_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "teams",
      default: null
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed"],
      default: "pending"
    },
    assigned_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users"
    },
    opQty: { type: Number }, // Snapshot at push
    opJobCompDate: { type: String }, // Snapshot at push
    is_qty_changed: { type: Boolean, default: false },
    is_date_changed: { type: Boolean, default: false },
    isNotHeadQty: { type: Boolean, default: false },
    isNotHeadDate: { type: Boolean, default: false },
    prevNotHeadQty: { type: Number },
    prevNotHeadDate: { type: String },
    prevNotHeadStart: { type: Date },
    prevNotHeadEnd: { type: Date },
    // Soft-delete flag: false = archived/superseded (kept for history), true = currently active
    is_active: { type: Boolean, default: true },
    reassign_history: [
      {
        from_team: { type: mongoose.Schema.Types.ObjectId, ref: "teams" },
        to_team: { type: mongoose.Schema.Types.ObjectId, ref: "teams" },
        from_start_date_time: { type: Date },
        from_end_date_time: { type: Date },
        to_start_date_time: { type: Date },
        to_end_date_time: { type: Date },
        from_qty: { type: Number },
        to_qty: { type: Number },
        from_split_details: [{
          team_id: { type: mongoose.Schema.Types.ObjectId, ref: "teams" },
          qty: { type: Number },
          start_date_time: { type: Date },
          end_date_time: { type: Date }
        }],
        split_details: [{
          team_id: { type: mongoose.Schema.Types.ObjectId, ref: "teams" },
          qty: { type: Number },
          start_date_time: { type: Date },
          end_date_time: { type: Date }
        }],
        reassigned_by: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
        date: { type: Date, default: Date.now },
        action: { type: String },
        note: { type: String }
      }
    ]
  },
  { timestamps: true }
);

const assemblyTeamModel = mongoose.model("assembly_team_job", assemblyTeamSchema);

export default assemblyTeamModel;