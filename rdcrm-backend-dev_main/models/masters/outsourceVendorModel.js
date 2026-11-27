import mongoose from "mongoose";

const outsourceVendorSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
    },
    whatsapp_no: {
      type: Number,
      required: true,
    },
    has_gst: {
      type: Boolean,
      default: false,
    },
    gst_no: {
      type: String,
      trim: true,
      default: "",
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    gst_tax: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'tax_masters',
      default: null,
    },
    gst_rate: {
      type: Number,
      default: 0,
      min: 0,
    },
    tds_tax: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'tax_masters',
      default: null,
    },
    tds_rate: {
      type: Number,
      default: 0,
      min: 0,
    },
    process_type: [
      {
        type: mongoose.ObjectId,
        ref: 'process',
      }
    ],
    is_active: {
      type: Boolean,
      default: true,
    },
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

export default mongoose.model("outsource_vendors", outsourceVendorSchema);
