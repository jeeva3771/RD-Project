import mongoose from "mongoose";

const machineSchema = new mongoose.Schema(
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
    machine_number: {
        type: String,
        required: true,
        unique: true,
    },
    department: {
     type: mongoose.ObjectId,
      ref: 'department',
      required: true,
    },
    maintanence: {
        type:Array,
    },
    type: {
      type: String,
    },
    location: {
      type: String,
      trim: true,
    },
    commission_date: {
      type: String,
    },
    last_service_date: {
      type: String,
    },
    gross_cost: {
      type: Number,
      default: 0,
      min: 0,
    },
    book_value: {
      type: Number,
      default: 0,
      min: 0,
    },
    accumulated_depreciation: {
      type: Number,
      default: 0,
      min: 0,
    },
    add_fields: [
        {
        key: { type: String },
        value: { type: mongoose.Schema.Types.Mixed },
        },
    ],
    is_active: {
      type: Boolean,
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

export default mongoose.model("machine", machineSchema);
