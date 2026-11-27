import mongoose from "mongoose";

const deliveryTypeSchema = new mongoose.Schema(
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

export default mongoose.model("delivery_type", deliveryTypeSchema);