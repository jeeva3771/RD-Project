import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
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
    contact_person: {
      type: String,
      required: false,
      trim: true,
      default: "",
    },
    mobile_no: {
      type: Number,
      required: false,
      default: null,
    },
    email: {
      type: String,
      required: false,
      trim: true,
      default: "",
    },
    address: [
      {
        label: { type: String }, // e.g. "Head office, Lower Parel" or "Pune regional office"
        address_1: { type: String, required: true },
        address_2: { type: String },
        city: { type: String, required: true },
        state: { type: String, required: true },
        postal_code: { type: String, required: true },
        gst_no: { type: String },
        is_billing: { type: Boolean, default: false },
        is_shipping: { type: Boolean, default: false },
        site_contact: { type: String },
        site_phone: { type: String },
      },
    ],

    delivery_type: {
      type: mongoose.ObjectId,
      ref: "delivery_type",
    },
    courier: {
      type: mongoose.ObjectId,
      ref: "courier",
    },
    payment_terms: {
      type: mongoose.ObjectId,
      ref: "payment_terms",
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    enquiries_origin: {
      type: String,
      trim: true,
    },

    // newjob_flow change: Added fields to support the new Enquiry Job Flow
    short_name: { type: String, trim: true }, // e.g., SL for Suraksha Life
    color_hue: { type: String, enum: ["ind", "mint", "gold", "coral"], default: "ind" },
    owner: { type: mongoose.ObjectId, ref: "users" }, // Primary RD Account Manager (legacy fallback)
    owner_name: { type: String, trim: true },
    rd_account_managers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
      },
    ],
    client_servicing_persons: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
      },
    ],
    contacts: [
      {
        name: String,
        role: String,
        email: String,
        mobile_no: String,
        is_primary: { type: Boolean, default: false },
      },
    ],
    additional_contacts: [
      {
        name: String,
        role: String,
        email: String,
        mobile_no: String,
        is_primary: { type: Boolean, default: false }
      }
    ],

    // Commercial & Payment terms
    terms_text: { type: String, trim: true }, // e.g. "50% advance against order" or "30 days credit"
    advance_percentage: { type: Number, default: 50 }, // 0, 50, 100
    credit_days: { type: Number, default: 0 },
    outstanding_amount: { type: Number, default: 0 },

    // CRM Insights & Stats
    since_year: { type: Number, default: 2020 },
    season_insight: { type: String, trim: true }, // e.g. "Their annual awards order usually lands in Jan–Feb."
    stats: {
      total_jobs: { type: Number, default: 0 },
      enquiries_count: { type: Number, default: 0 },
      won_count: { type: Number, default: 0 },
      avg_order_value: { type: Number, default: 0 },
      last_enquiry_summary: { type: String, trim: true },
    },

    // GST Status for new client workflow
    gst_status: { type: String, enum: ["have", "later", "none"], default: "have" },
    gst_remind_stages: [{ type: String }], // e.g. ["sample", "production"]

    // Statutory Tax Configuration (Referencing Tax Master)
    gst_tax: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "tax_masters",
      default: null,
    },
    gst_rate: {
      type: Number,
      default: 0,
      min: 0,
    },
    tds_tax: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "tax_masters",
      default: null,
    },
    tds_rate: {
      type: Number,
      default: 0,
      min: 0,
    },

    created_by: {
      type: mongoose.ObjectId,
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
          type: mongoose.ObjectId,
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

export default mongoose.model("customer", customerSchema);
