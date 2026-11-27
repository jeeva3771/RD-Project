import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      lowercase: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
    },
    password: {
      type: String,
      required: true,
    },
    email_app_password: {
      type: String,
      trim: true,
      default: "",
    },
    department_id: {
      type: mongoose.ObjectId,
      ref: 'department',
      required: true,
    },
    role: {
      type: mongoose.ObjectId,
      ref: 'role',
    },
    team_id: {
      type: mongoose.ObjectId,
      ref: 'teams',
      default: null,
    },
    company_id: {
      type: mongoose.ObjectId,
      ref: 'Company',
      default: null,
    },
    work_id: {
      type: mongoose.ObjectId,
      ref: 'Work',
      default: null,
    },
    image: {
      type: String,
    },
    uuid: {
      type: String,
    },
    permission: {
      type: Array
    },
    is_head: {
      type: Boolean,
      default: false,
    },
    is_pricing_specialist: {
      type: Boolean,
      default: false,
    },
    is_active: {
      type: Boolean,
    },
    only_profile: {
      type: Boolean,
      default: false,
    },
    dob: {
      type: String,
      required: true,
      trim: true
    },
    doj: {
      type: String,
      required: true,
      trim: true
    },
    phone_number: {
      type: Number,
      required: true,
      trim: true,
      match: [/^\d{10}$/, "phone number must be exactly 10 digits"],
    },
    emergency_number: {
      type: Number,
      required: true,
      trim: true,
      match: [/^\d{10}$/, "Emergency number must be exactly 10 digits"],
    },
    reference_name: {
      type: String,
      trim: true,
      required: true,
    },
    emp_id: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    created_by: {
      type: mongoose.ObjectId,
      ref: 'users',
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
  },
);

export default mongoose.model("users", userSchema);
