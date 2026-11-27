import mongoose from "mongoose";

const departmentSchema = new mongoose.Schema(
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
    // under_process: {
    //   type: [mongoose.ObjectId],
    //   ref: 'process',
    // },
    type: {
      type: String,
    },
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

export default mongoose.model("department", departmentSchema);
