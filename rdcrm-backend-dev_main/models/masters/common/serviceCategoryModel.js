import mongoose from "mongoose";

const serviceCategorySchema = new mongoose.Schema(
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
    // service_charge_parameter: {
    //   type: String,
    //   trim: true,
    // },
    // service_cost: {
    //   type: Number,
    // },
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

export default mongoose.model("service_category", serviceCategorySchema);