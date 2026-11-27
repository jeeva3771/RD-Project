import mongoose from "mongoose";

const enquirySchema = new mongoose.Schema(
  {
    job_no: {
      type: String,
      required: true,
      unique: true,
    },
    reference_no: {
      type: String,
      required: false,
    },
    cloned_from: {
      type: String,
      default: "",
    },
    id: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    subcategory: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    mobile_no: {
      type: Number,
      required: false,
    },
    wp_number: [{
      type: Number,
      required: true,
      trim: true,
      match: [/^\d{10}$/, "Mobile number must be exactly 10 digits"],
    }],
    email: [{
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
    }],
    enquiry_origin: {
      type: String,
      trim: true,
    },
    no_of_options: {
      type: Number,
      required: true,
    },
    reference_images: [{
      type: String,
    }],
    images: [
      {
        url: { type: String },
        starttime: { type: String },
        endtime: { type: String },
        imageunit: { type: String },
        image_product_size: [
          {
            type: Object,
          }
        ],
        designer_person: { type: String },
        pause_time: { type: String },
        pause_notes: { type: String },
        resume_time: { type: String },
        is_accepted: { type: Boolean },
        feedback: { type: String },
        accepted_date_time: { type: String },
        watermark_image_url: { type: String },
        image_to_sample: { type: Boolean, default: false },
        image_to_production: { type: Boolean, default: false },
        image_rework: { type: Boolean, default: false },
        additional_files: [{ type: String }]
      },
    ],
    is_designer_needed: {
      type: Boolean
    },
    additional_attachments: [{
      type: String,
    }],
    quatation_purpose_only: {
      type: Boolean,
      default: false,
    },
    is_client_design: {
      type: Boolean,
      default: false,
    },
    client_design_files: [{
      type: String,
    }],
    product_name: {
      type: String,
      required: true,
      trim: true,
    },
    product_quantity: {
      type: Number,
      required: true,
    },
    unit: { type: String },
    product_size: [
      {
        type: Object,
      }
    ],
    budget: {
      type: Number,
      required: true,
    },
    budget_to: {
      type: Number,
    },
    preferred_material: {
      type: String,
      required: true,
      trim: true,
    },
    product_description: {
      type: String,
      required: true,
      trim: true,
    },
    show_logo: {
      type: Boolean,
      default: false,
    },
    show_content: {
      type: Boolean,
      default: false,
    },
    copyright_content: {
      type: String,
    },
    links_duration: {
      type: Number,
      required: true,
    },
    delivery_date: {
      type: String,
      required: true,
      trim: true,
    },
    delivery_type: {
      type: String,
      required: true,
      trim: true,
    },
    delivery_location: {
      type: String,
      required: true,
      trim: true,
    },
    delivery_mode: {
      type: String,
      required: true,
      trim: true,
    },
    who_will_pay: {
      type: String,
      required: false,
      trim: true,
    },
    briefing: {
      type: String,
      required: true,
      trim: true,
    },
    payment_terms: {
      type: String,
      required: true,
      trim: true,
    },
    cordinator: {
      type: mongoose.ObjectId,
      ref: "users",
    },
    marketing_cordinator: {
      type: [mongoose.ObjectId],
      ref: "users",
    },
    cordinator_remarks: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
    },
    is_designer_allocated: {
      type: Boolean,
      default: false,
    },
    is_design_rejected: {
      type: Boolean
    },
    accept_button: {
      type: Boolean,
    },
    submit_button: {
      type: Boolean,
    },
    is_design_processing: {
      type: String,
      default: false,
    },
    is_designer_completed: {
      type: Boolean,
      default: false,
    },
    designer_person: [
      {
        user: { type: mongoose.ObjectId, ref: 'users' },
        completed: { type: Boolean, default: false }
      }
    ],
    designer_remarks: {
      type: String,
    },
    is_accept: {
      type: Boolean,
      default: false,
    },
    is_completed: {
      type: Boolean,
      default: false,
    },
    is_cancelled: {
      type: Boolean,
      default: false,
    },
    is_cancelled_by: {
      user: {
        type: mongoose.ObjectId,
        ref: "users",
      },
      date: {
        type: String,
      }
    },
    is_rework: {
      type: Boolean,
      default: false,
    },
    to_sample: {
      type: Boolean,
      default: false,
    },
    to_production: {
      type: Boolean,
      default: false,
    },
    is_redo: {
      type: String,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    is_on_hold: {
      type: Boolean,
      default: false,
    },
    hold_history: [
      {
        reason: String,
        start_time: String,
        end_time: String,
        hold_by: {
          type: mongoose.ObjectId,
          ref: "users",
        },
        unhold_by: {
          type: mongoose.ObjectId,
          ref: "users",
        },
      }
    ],
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

export default mongoose.model("enquiry", enquirySchema);
