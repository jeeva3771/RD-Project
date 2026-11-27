import mongoose from "mongoose";

const vendorSchema = new mongoose.Schema(
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
    mobile_no: {
      type: Number,
      required: true,
    },
    material_categories: {
      type: [{
        type: mongoose.ObjectId,
        ref: 'material_categories',
      }],
      required: true,
    },
    material_types: [{
      type: mongoose.ObjectId,
      ref: 'material_types',
    }],
    contract_type: {
      type: mongoose.ObjectId,
      ref: 'contract_type',
      required: true,
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

export default mongoose.model("vendors", vendorSchema);