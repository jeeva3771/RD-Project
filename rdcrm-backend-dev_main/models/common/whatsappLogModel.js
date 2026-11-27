import mongoose from "mongoose";

const whatsappLogSchema = new mongoose.Schema({
  wamid: {
    type: String,
    required: true,
    unique: true,
  },
  phone_number: {
    type: String,
    required: true,
  },
  template_name: {
    type: String,
  },
  status: {
    type: String,
    default: "accepted", // accepted, sent, delivered, read, failed
  },
  failed_reason: {
    type: String,
  },
  raw_response: {
    type: mongoose.Schema.Types.Mixed,
  },
}, { timestamps: true });

export default mongoose.model("WhatsappLog", whatsappLogSchema);
