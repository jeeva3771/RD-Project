import mongoose from "mongoose";

const samplesalesorderSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true,
    },
    enquiry_id: {
      type: mongoose.ObjectId,
      ref: "enquiry",
      required: true,
    },
    sample_order_nanoid: {
      type: String,
    },
    sample__order_id: {
      type: mongoose.ObjectId,
      ref: "salesorder",
    },
    job_no: {
      type: String,
      required: true,
    },
    sub_job_no: {
      type: String,
      required: true,
    },
    job_quantity: {
      type: Number,
      default: "",
    },
    job_completion_datetime: {
      type: String,
      default: "",
    },
    category: {
      type: String,
      default: "",
    },
    subcategory: {
      type: String,
      default: "",
    },
    client_name: {
      type: String,
      default: "",
    },
    contact_person: {
      type: String,
      default: "",
    },
    mobile_no: {
      type: Number,
      trim: true,
      match: [/^\d{10}$/, "Mobile number must be exactly 10 digits"],
    },
    wp_number: [
      {
        type: Number,
        trim: true,
        match: [/^\d{10}$/, "Mobile number must be exactly 10 digits"],
      },
    ],
    email: [
      {
        type: String,
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
      },
    ],
    billing_address_1: {
      type: String,
      default: "",
    },
    billing_address_2: {
      type: String,
      default: "",
    },
    billing_city: {
      type: String,
      default: "",
    },
    billing_state: {
      type: String,
      default: "",
    },
    billing_postal_code: {
      type: Number,
      default: "",
    },
    billing_gst_no: {
      type: String,
      default: "",
    },
    delivery_date: {
      type: String,
      default: "",
    },
    delivery_address: {
      type: String,
      default: "",
    },
    delivery_type: {
      type: String,
      default: "",
    },
    delivery_mode: {
      type: String,
      default: "",
    },
    who_will_pay: {
      type: String,
      default: "",
    },
    courier_amount: {
      type: String,
      default: "",
    },
    add_in_invoice: {
      type: Boolean,
      default: false,
    },
    multi_deliveries: [
      {
        type: Object,
      },
    ],

    product_name: {
      type: String,
      default: "",
    },
    unit: { type: String, default: "" },
    product_size: [
      {
        type: Object,
      },
    ],
    price_per_piece: {
      type: String,
      default: "",
    },
    packing_type: {
      type: String,
      default: "",
    },
    inner_packing_type: {
      type: String,
      default: "",
    },
    premium_packing_option: {
      type: String,
      default: "",
    },
    packing_instruction: {
      type: String,
      default: "",
    },
    packing_mode: {
      type: String,
      default: "",
    },
    job_content: {
      type: String,
      default: "",
    },
    payment: {
      type: String,
      default: "",
    },
    image: { type: String, default: "" },
    product_files: [
      {
        type: String,
      },
    ],
    bank_details_description: {
      type: String,
      default: "",
    },
    marketing_cordinator: [
      {
        user: { type: mongoose.ObjectId, ref: "users" },
        remarks: { type: String },
      },
    ],
    remarks: {
      type: String,
      default: "",
    },
    sample_required:{
      type: Boolean,
      default: false,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    created_by: {
      type: mongoose.ObjectId,
      ref: "users",
    },
    created_at: {
      type: String,
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

samplesalesorderSchema.index({ sub_job_no: 1 });
samplesalesorderSchema.index({ job_no: 1 });
samplesalesorderSchema.index({ type: 1, category: 1 });

export default mongoose.model("salesorderform", samplesalesorderSchema);
