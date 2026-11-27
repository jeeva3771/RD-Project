import mongoose from "mongoose";

const historyEntrySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["call", "email", "whatsapp", "note", "receipt"],
      default: "note",
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    by: {
      type: String,
      default: "Accounts Team",
      trim: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    date_label: {
      type: String,
      default: "",
    },
  },
  { _id: true }
);

const collectionCaseSchema = new mongoose.Schema(
  {
    client_name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    client_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "customer",
      default: null,
    },
    contact_person: {
      type: String,
      default: "",
      trim: true,
    },
    phone: {
      type: String,
      default: "",
      trim: true,
    },
    email: {
      type: String,
      default: "",
      trim: true,
    },
    owner: {
      type: String,
      default: "Accounts Team",
      trim: true,
      index: true,
    },
    owner_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      default: null,
    },
    stage: {
      type: String,
      enum: ["new", "contacted", "promised", "followup", "escalated", "closed"],
      default: "new",
      index: true,
    },
    escalation_count: {
      type: Number,
      default: 0,
      min: 0,
    },
    next_followup_date: {
      type: Date,
      default: null,
    },
    next_followup_label: {
      type: String,
      default: "",
    },
    promised_date: {
      type: Date,
      default: null,
    },
    promised_amount: {
      type: Number,
      default: null,
    },
    promised_note: {
      type: String,
      default: "",
    },
    gst_hold_policy: {
      type: Boolean,
      default: false,
    },
    notes: {
      type: String,
      default: "",
    },
    history: [historyEntrySchema],
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("collection_cases", collectionCaseSchema);
